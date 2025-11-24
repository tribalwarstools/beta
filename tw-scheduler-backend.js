// === TW Scheduler Backend — Complete & Optimized ===
// Integrated: BroadcastChannel, Tab-lock master, lightweight executeAttack (fetch),
// persistent processed map, FIFO queue, robust scheduler.

(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PROCESSED_KEY = STORAGE_KEY + '_processed_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  // Scheduler tuning
  const SCHEDULER_TICK = 500; // ms
  const EXEC_WINDOW = 1500; // ms

  // Tab lock (master tab) settings
  const TAB_LOCK_KEY = 'tws_tab_lock_v1';
  const TAB_LOCK_TIMEOUT = 3000; // ms

  // Internal state
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;

  // Running sets
  const _executing = new Set(); // attack._id currently executing in this tab
  const _processedAttacks = new Map(); // fingerprint -> timestamp (persisted)

  // queue for sequential execution (FIFO)
  const _execQueue = [];
  let _queueRunning = false;

  // ID counter fallback
  let _idCounter = Date.now();

  // ----------------- BroadcastChannel Coordinator -----------------
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map(); // attackId -> ts
      this.currentTabId = this.generateTabId();
      this.useBroadcast = false;
      this.channel = null;

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          this.channel.onmessage = (ev) => this.handleMessage(ev.data);
          console.log('[' + this.currentTabId + '] BroadcastChannel ready');
        } catch (e) {
          console.warn('BroadcastChannel init failed', e);
        }
      }

      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }

    generateTabId() {
      return 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    }

    notifyAttackStart(attackId, fingerprint) {
      this.processingAttacks.set(attackId, Date.now());
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'ATTACK_START', attackId, fingerprint, tabId: this.currentTabId, ts: Date.now() });
      }
    }

    notifyAttackEnd(attackId, fingerprint) {
      this.processingAttacks.delete(attackId);
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'ATTACK_END', attackId, fingerprint, tabId: this.currentTabId, ts: Date.now() });
      }
    }

    handleMessage(msg) {
      if (!msg || !msg.type) return;
      var type = msg.type, attackId = msg.attackId, fingerprint = msg.fingerprint;
      switch (type) {
        case 'ATTACK_START':
          if (fingerprint) _persistedMarkProcessed(fingerprint);
          this.processingAttacks.set(attackId, msg.ts || Date.now());
          break;
        case 'ATTACK_END':
          this.processingAttacks.delete(attackId);
          break;
        case 'CLEANUP':
          (msg.attackIds || []).forEach(function(id){ this.processingAttacks.delete(id); }.bind(this));
          break;
      }
    }

    isBeingProcessed(attackId) {
      const ts = this.processingAttacks.get(attackId);
      if (!ts) return false;
      if ((Date.now() - ts) > 60000) { this.processingAttacks.delete(attackId); return false; }
      return true;
    }

    cleanup() {
      const ids = Array.from(this.processingAttacks.keys());
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'CLEANUP', tabId: this.currentTabId, attackIds: ids });
        this.channel.close();
      }
    }

    getStats() { return { tabId: this.currentTabId, processingCount: this.processingAttacks.size, useBroadcast: this.useBroadcast }; }
  }

  const attackCoordinator = new AttackCoordinator();

  // ----------------- Utilities -----------------
  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    var ts = Date.now();
    var c = ++_idCounter;
    var rnd = Math.random().toString(36).slice(2,8);
    return ts + '_' + c + '_' + rnd;
  }

  function getAttackFingerprint(a) { return (a.origemId || a.origem) + '_' + a.alvo + '_' + a.datetime; }

  function parseDateTimeToMs(str) {
    if (!str) return NaN;
    var m = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    var d = +m[1], mo = +m[2], y = +m[3], hh = +m[4], mm = +m[5], ss = +m[6];
    return new Date(y, mo-1, d, hh, mm, ss).getTime();
  }

  // ----------------- Persist processed map (TTL capable) -----------------
  function _loadProcessedMap() {
    try {
      var raw = localStorage.getItem(PROCESSED_KEY);
      if (!raw) return new Map();
      var obj = JSON.parse(raw);
      var m = new Map();
      Object.keys(obj).forEach(function(k){ m.set(k, obj[k]); });
      return m;
    } catch (e) { return new Map(); }
  }

  function _saveProcessedMap(map) {
    try {
      var obj = {};
      map.forEach(function(v,k){ obj[k]=v; });
      localStorage.setItem(PROCESSED_KEY, JSON.stringify(obj));
    } catch (e) { console.error('saveProcessedMap', e); }
  }

  function _persistedMarkProcessed(fingerprint) {
    var map = _loadProcessedMap();
    map.set(fingerprint, Date.now());
    _saveProcessedMap(map);
    _processedAttacks.set(fingerprint, Date.now());
  }

  function _isProcessed(fingerprint) {
    if (_processedAttacks.has(fingerprint)) return true;
    var map = _loadProcessedMap();
    if (map.has(fingerprint)) { _processedAttacks.set(fingerprint, map.get(fingerprint)); return true; }
    return false;
  }

  // cleanup TTL
  (function(){
    var map = _loadProcessedMap(); var now = Date.now(); var changed = false;
    map.forEach(function(ts,k){ if ((now - ts) > 24*3600*1000) { map.delete(k); changed = true; } });
    if (changed) _saveProcessedMap(map);
  })();

  // ----------------- Storage helpers -----------------
  function getList(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
  function setList(list){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); if (window.renderTable) window.renderTable(); } catch(e){ console.error(e); } }

  // ----------------- Village.txt loader -----------------
  async function loadVillageTxt(){
    try{
      var res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('village.txt fetch error');
      var text = await res.text(); var map = {}; var my = [];
      text.trim().split('\n').forEach(function(line){ var parts = line.split(','); var id=parts[0], name=parts[1], x=parts[2], y=parts[3], playerId=parts[4]; map[x+'|'+y]=id; if (playerId === (window.game_data?.player?.id||'').toString()) my.push({ id: id, name: decodeURIComponent((name||'').replace(/\+/g,' ')), coord: x+'|'+y }); });
      _villageMap = map; _myVillages = my; return { map: map, myVillages: my };
    } catch(err){ console.error('loadVillageTxt', err); return { map:{}, myVillages:[] }; }
  }

  // ----------------- getVillageTroops (uses DOMParser) -----------------
  async function getVillageTroops(villageId){
    try{
      var placeUrl = location.protocol + '//' + location.host + '/game.php?village=' + villageId + '&screen=place';
      var res = await fetch(placeUrl, { credentials: 'same-origin' }); if(!res.ok) throw new Error('GET /place failed');
      var html = await res.text(); var parser = new DOMParser(); var doc = parser.parseFromString(html, 'text/html');
      var troops = {};
      TROOP_LIST.forEach(function(u){ var el = doc.querySelector('#units_entry_all_' + u) || doc.querySelector('#units_home_' + u) || doc.querySelector('[id*="' + u + '"][class*="unit"]'); var val = 0; if (el) { var mm = el.textContent.match(/\d+/); val = mm ? parseInt(mm[0],10) : 0; } troops[u] = val; });
      return troops;
    } catch(err){ console.error('getVillageTroops', err); return null; }
  }

  // ----------------- Validation & helpers -----------------
  function validateTroops(requested, available){ var errs=[]; TROOP_LIST.forEach(function(u){ var req = parseInt(requested[u]||0,10); var avail = parseInt(available[u]||0,10); if (req>avail) errs.push(u + ': ' + req + '>' + avail); }); return errs; }
  function isAttackConfirmed(htmlText){ if (/screen=info_command.*type=own/i.test(htmlText)) return true; if (/<tr class=\"command-row\">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) return true; var pats = [/attack sent/i,/attack in queue/i,/enviado/i,/ataque enviado/i,/enfileirad/i,/march started/i,/tropas enviadas/i]; return pats.some(function(p){ return p.test(htmlText); }); }

  // ----------------- Lightweight form extractor (string parsing) -----------------
  function extractFormInputsFromHtml(html){
    var idx = html.toLowerCase().indexOf('<form'); if (idx === -1) return null;
    var start = html.indexOf('>', idx); if (start === -1) return null; // start of form content
    var endTag = '</form>';
    var end = html.toLowerCase().indexOf(endTag, start); if (end === -1) return null;
    var formHtml = html.slice(idx, end + endTag.length);

    var inputs = {};
    // naive parse: find occurrences of name= then capture the enclosing value attribute if present
    var pos = 0;
    while (true) {
      var nameIdx = formHtml.indexOf('name=', pos);
      if (nameIdx === -1) break;
      var nameStart = nameIdx + 5; // after name=
      var quote = formHtml.charAt(nameStart);
      var name = '';
      if (quote === '"' || quote === "'") {
        nameStart++;
        var nameEnd = formHtml.indexOf(quote, nameStart);
        if (nameEnd === -1) break;
        name = formHtml.slice(nameStart, nameEnd);
        pos = nameEnd + 1;
      } else {
        // unquoted
        var m = formHtml.slice(nameStart).match(/^[^\s>]+/);
        if (!m) break;
        name = m[0];
        pos = nameStart + name.length;
      }

      // look backwards in the same tag for value=
      var tagStart = formHtml.lastIndexOf('<', nameIdx);
      var tagEnd = formHtml.indexOf('>', nameIdx);
      var tag = formHtml.slice(tagStart, tagEnd+1);
      var val = '';
      var vIdx = tag.indexOf('value=');
      if (vIdx !== -1) {
        var vStart = vIdx + 6; var vq = tag.charAt(vStart);
        if (vq === '"' || vq === "'") { vStart++; var vEnd = tag.indexOf(vq, vStart); if (vEnd !== -1) val = tag.slice(vStart, vEnd); }
        else { var mm2 = tag.slice(vStart).match(/^[^\s>]+/); if (mm2) val = mm2[0]; }
      }
      inputs[name] = val;
    }

    // try selects: find <select ... name="..."> ... <option selected value="...">
    var selPos = 0;
    while (true) {
      var sIdx = formHtml.toLowerCase().indexOf('<select', selPos);
      if (sIdx === -1) break;
      var sEnd = formHtml.indexOf('>', sIdx); if (sEnd === -1) break;
      var selTag = formHtml.slice(sIdx, sEnd+1);
      var nameMatch = selTag.match(/name=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      var selName = nameMatch ? (nameMatch[1]||nameMatch[2]||nameMatch[3]) : null;
      var closeIdx = formHtml.toLowerCase().indexOf('</select>', sEnd);
      var selHtml = formHtml.slice(sEnd+1, closeIdx);
      var optMatch = selHtml.match(/<option[^>]*selected[^>]*value=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || selHtml.match(/<option[^>]*value=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      var sval = optMatch ? (optMatch[1]||optMatch[2]||optMatch[3]||'') : '';
      if (selName) inputs[selName] = sval;
      selPos = closeIdx + 9;
    }

    return { formHtml: formHtml, inputs: inputs };
  }

async function executeAttack(task) {
    try {
        // 1. Monta a URL da página de confirmação do ataque
        const url = `/game.php?village=${task.source}&screen=place&target=${task.target}`;

        // 2. Primeira requisição → busca a página para extrair os campos do form
        const response = await fetch(url, { credentials: 'include' });
        const html = await response.text();

        // 3. Parseia o HTML com DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // 4. Localiza o formulário que contém o botão "Atacar" (action=command)
        const form = doc.querySelector('form[action*="action=command"]');

        if (!form) {
            console.error("[ERRO] Formulário de ataque não encontrado.");
            return;
        }

        // 5. Extrai TODOS os inputs automaticamente
        const params = new URLSearchParams();

        form.querySelectorAll("input, select").forEach(el => {
            if (el.name) params.append(el.name, el.value || "");
        });

        // 6. Insere as tropas definidas na tarefa
        Object.keys(task.troops).forEach(type => {
            params.set(type, task.troops[type]); // substitui os valores do formulário
        });

        // 7. Monta a URL de envio (action=command)
        const finalUrl = form.getAttribute("action");

        // 8. Envia o ataque de fato
        const sendResponse = await fetch(finalUrl, {
            method: "POST",
            body: params,
            credentials: "include",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            }
        });

        const sendHtml = await sendResponse.text();

        // 9. Verifica se o ataque foi confirmado (busca "O ataque foi enviado!" ou similar)
        const confirmed = sendHtml.includes("comando foi enviado") ||
                          sendHtml.includes("O ataque foi enviado") ||
                          sendHtml.includes("command-confirm");

        if (confirmed) {
            console.log("✓ ATAQUE ENVIADO COM SUCESSO:", task);
        } else {
            console.warn("⚠ Ataque NÃO foi confirmado pelo servidor:", task);
        }

    } catch (err) {
        console.error("Erro ao executar ataque:", err);
    }
}


// ----------------- Queue worker (corrigido) -----------------
async function queueWorker() {
  if (_queueRunning) return;
  _queueRunning = true;

  while (_execQueue.length > 0) {
    const task = _execQueue.shift();
    if (!task) continue;

    const fingerprint = getAttackFingerprint(task);

    // Ignorar se já processado ou em outra aba
    if (_isProcessed(fingerprint)) continue;
    if (attackCoordinator.isBeingProcessed(task._id)) continue;

    _executing.add(task._id);
    attackCoordinator.notifyAttackStart(task._id, fingerprint);

    try {
      const res = await executeAttack(task);

      if (res.success) {
        console.log('[Queue] Attack executed successfully:', task);
        _persistedMarkProcessed(fingerprint); // marca apenas se enviado
      } else {
        console.warn('[Queue] Attack failed:', res.message, task);
      }

    } catch (e) {
      console.error('[Queue] executeAttack error:', e);
    }

    attackCoordinator.notifyAttackEnd(task._id, fingerprint);
    _executing.delete(task._id);

    await new Promise(r => setTimeout(r, 80)); // throttle
  }

  _queueRunning = false;
}


  // ----------------- Scheduler (master tab) -----------------
  function tryAcquireTabLock() {
    var now = Date.now();
    var lock = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || 'null');
    if (!lock || (now - lock.ts) > TAB_LOCK_TIMEOUT) { localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ts: now })); return true; }
    return false;
  }
  function refreshTabLock(){ localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ts: Date.now() })); }
  function isTabMaster(){ var lock = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || 'null'); return lock && (Date.now() - lock.ts) < TAB_LOCK_TIMEOUT; }

  async function schedulerTick() {
    if (!tryAcquireTabLock()) return;
    refreshTabLock();
    var now = Date.now(); var list = getList(); var dirty = false; var buckets = {};
    for (var i=0;i<list.length;i++){ var a = list[i]; if (a.done) continue; var fp = getAttackFingerprint(a); if (_isProcessed(fp)) continue; if (attackCoordinator.isBeingProcessed(a._id)) continue; var t = parseDateTimeToMs(a.datetime); if (!t || isNaN(t)) continue; var diff = t - now; if (diff <= 0 && diff > -10000) { (buckets[a.datetime] = buckets[a.datetime] || []).push(a); } }
    var keys = Object.keys(buckets).sort(); for (var j=0;j<keys.length;j++){ var dt = keys[j]; var arr = buckets[dt]; for (var k=0;k<arr.length;k++){ var task = arr[k]; var fp2 = getAttackFingerprint(task); _persistedMarkProcessed(fp2); if (!task._id) task._id = generateUniqueId(); _execQueue.push(task); dirty = true; } }
    if (dirty) { setList(list); queueWorker(); }
  }

  // ----------------- Other utilities -----------------
  function importarDeBBCode(bbcode){ var linhas = bbcode.split('[*]').filter(function(l){ return l.trim()!== ''; }); var ag = []; linhas.forEach(function(linha){ var coords = linha.match(/(\d{1,3}\|\d{1,3})/g) || []; var origem = coords[0]||''; var destino = coords[1]||''; var dt = (linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)||[])[1]||''; var url = (linha.match(/\[url=(.*?)\]/)||[])[1]||''; var params={}; if (url){ var q = (url.split('?')[1]||''); q.split('&').forEach(function(p){ var sp = p.split('='); params[sp[0]] = decodeURIComponent(sp[1]||''); }); } var origemId = params.village || _villageMap[origem]; var id = generateUniqueId(); var cfg = { _id:id, origem:origem, origemId:origemId, alvo:destino, datetime:dt, done:false, locked:false }; TROOP_LIST.forEach(function(u){ cfg[u] = params['att_'+u]||0; }); if (origem && destino && dt) ag.push(cfg); }); return ag; }

  // ----------------- Public API export -----------------
  window.TWS_Backend = {
    loadVillageTxt: loadVillageTxt,
    parseDateTimeToMs: parseDateTimeToMs,
    parseCoord: function(s){ if(!s) return null; var m = s.trim().match(/^(\d{1,4})\|(\d{1,4})$/); if(!m) return null; var x=+m[1], y=+m[2]; if(x<0||x>499||y<0||y>499) return null; return x+'|'+y; },
    getList: getList,
    setList: setList,
    startScheduler: function(){ if (_schedulerInterval) clearInterval(_schedulerInterval); _schedulerInterval = setInterval(schedulerTick, SCHEDULER_TICK); console.log('Scheduler started'); },
    importarDeBBCode: importarDeBBCode,
    executeAttack: executeAttack,
    getVillageTroops: getVillageTroops,
    validateTroops: validateTroops,
    generateUniqueId: generateUniqueId,
    getAttackFingerprint: getAttackFingerprint,
    attackCoordinator: attackCoordinator,
    TROOP_LIST: TROOP_LIST,
    STORAGE_KEY: STORAGE_KEY,
    PANEL_STATE_KEY: PANEL_STATE_KEY,
    _internal: {
      get villageMap(){ return _villageMap; },
      get myVillages(){ return _myVillages; },
      get executing(){ return _executing; },
      get processedAttacks(){ return _processedAttacks; },
      get coordinatorStats(){ return attackCoordinator.getStats(); }
    }
  };

  console.log('[TWS_Backend] ✅ Backend v5 loaded (optimized scheduler + lightweight executeAttack)');

})();


