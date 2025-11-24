// == TW Scheduler Backend — Full rewrite (v4) ==
// Clean, modular, 100% fetch, robust place->confirm flow.
// Load this BEFORE the frontend script.

(function () {
  'use strict';

  // -----------------------------
  // Config / Constants
  // -----------------------------
  const STORAGE_KEY = 'tw_scheduler_v4';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  // Internal state
  let _villageMap = {};       // coord -> villageId
  let _myVillages = [];       // player's villages
  let _schedulerInterval = null;
  let _idCounter = Date.now();

  // Execution guards
  const _executing = new Set();           // attack._id currently executing
  const _processedFingerprints = new Set(); // fingerprint already handled

  // -----------------------------
  // Helpers
  // -----------------------------
  function log(...args){ console.log('[TWS_Backend]', ...args); }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function generateUniqueId(){
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const ts = Date.now();
    const c = ++_idCounter;
    const r = Math.random().toString(36).slice(2,10);
    return `${ts}_${c}_${r}`;
  }

  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  // Coordinate parsing/validation
  function parseCoord(s){
    if (!s) return null;
    const cleaned = String(s).trim().replace(/\s+/g,'').replace(/-/g,'|');
    const match = cleaned.match(/^(\d{1,3})\|(\d{1,3})$/);
    if (!match) return null;
    const x = parseInt(match[1],10), y = parseInt(match[2],10);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    if (x < 0 || x > 999 || y < 0 || y > 999) return null;
    return `${x}|${y}`;
  }

  function isValidCoord(s){ return !!parseCoord(s); }

  // Local storage helpers
  function getList(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { log('getList parse error', e); return []; }
  }
  function setList(list){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); if (window.renderTable) window.renderTable(); }
    catch (e) { log('setList error', e); }
  }

  // Fingerprint to avoid duplicates (origemId/alvo/datetime)
  function getAttackFingerprint(a){
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
  }

  // -----------------------------
  // village.txt loader
  // -----------------------------
  async function loadVillageTxt(){
    try{
      const res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();

      const map = {};
      const mine = [];
      const myId = String(window.game_data?.player?.id || '');

      for (const line of text.trim().split('\n')){
        const [id, name, x, y, playerId] = line.split(',');
        const coord = `${x}|${y}`;
        map[coord] = id;
        if (playerId === myId){
          const clean = decodeURIComponent((name || '').replace(/\+/g,' '));
          mine.push({ id, name: clean, coord });
        }
      }

      _villageMap = map;
      _myVillages = mine;
      log('village.txt loaded — my villages:', mine.length);
      return { map, myVillages: mine };
    } catch (err){
      log('loadVillageTxt error', err);
      return { map: {}, myVillages: [] };
    }
  }

  // -----------------------------
  // Get troops available in a village
  // -----------------------------
  async function getVillageTroops(villageId){
    try{
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place`;
      const res = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const troops = {};
      TROOP_LIST.forEach(u => {
        const el = doc.querySelector(`#units_entry_all_${u}`) || doc.querySelector(`#units_home_${u}`) || doc.querySelector(`[id*="${u}"][class*="unit"]`);
        let available = 0;
        if (el) {
          const m = el.textContent.match(/\d+/);
          available = m ? parseInt(m[0], 10) : 0;
        }
        troops[u] = available;
      });

      log('getVillageTroops', villageId, troops);
      return troops;
    } catch (err){
      log('getVillageTroops error', err);
      return null;
    }
  }

  // -----------------------------
  // Validate troops requested vs available
  // -----------------------------
  function validateTroops(requested, available){
    const errors = [];
    TROOP_LIST.forEach(u => {
      const req = parseInt(requested[u] || 0, 10);
      const avail = parseInt(available[u] || 0, 10);
      if (req > avail) errors.push(`${u}: solicitado ${req}, disponível ${avail}`);
    });
    return errors;
  }

  // -----------------------------
  // Helpers to detect success
  // -----------------------------
  function isAttackConfirmed(htmlText){
    if (!htmlText) return false;
    if (/screen=info_command.*type=own/i.test(htmlText)) return true;
    if (/<tr class="command-row">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) return true;
    const successPatterns = [
      /attack sent/i,
      /attack in queue/i,
      /enviado/i,
      /ataque enviado/i,
      /enfileirad/i,
      /A batalha começou/i,
      /march started/i,
      /comando enviado/i,
      /tropas enviadas/i,
      /foi enfileirado/i,
      /command sent/i,
      /comando foi criado/i
    ];
    return successPatterns.some(p => p.test(htmlText));
  }

  // -----------------------------
  // Execute Attack — robust two-step (place -> confirm) POST using fetch
  // Ensures all troop fields, ch/form tokens and coordinates are included
  // -----------------------------
  async function executeAttack(cfg){
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try { if (statusEl) statusEl.innerHTML = msg; } catch(e){}
      log(msg);
    };

    try{
      // resolve origin id
      const origemId = cfg.origemId || _villageMap[cfg.origem];
      if (!origemId) {
        setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada`);
        throw new Error('Origem não encontrada');
      }

      // validate target
      const coord = parseCoord(cfg.alvo);
      if (!coord) {
        setStatus(`❌ Alvo inválido: ${cfg.alvo}`);
        throw new Error('Alvo inválido');
      }
      const [x,y] = coord.split('|');

      // check troops availability
      setStatus(`🔍 Verificando tropas disponíveis em ${cfg.origem}...`);
      const availableTroops = await getVillageTroops(origemId);
      if (availableTroops) {
        const errors = validateTroops(cfg, availableTroops);
        if (errors.length > 0) {
          setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
          throw new Error('Tropas insuficientes');
        }
      }

      // 1) GET /place to retrieve form and tokens
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
      setStatus('📥 Carregando formulário de envio...');
      const getRes = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!getRes.ok) throw new Error('Falha ao carregar /place: ' + getRes.status);
      const getHtml = await getRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(getHtml, 'text/html');

      // find the form that contains troop inputs
      let form = Array.from(doc.querySelectorAll('form')).find(f => 
        (f.action && f.action.includes('screen=place')) ||
        f.querySelector('input[name="x"]') ||
        TROOP_LIST.some(u => f.querySelector(`input[name="${u}"]`))
      );
      if (!form) form = doc.querySelector('form');
      if (!form) throw new Error('Form de envio não encontrado');

      // build payload object from form defaults
      const payload = {};
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(inp => {
        const name = inp.getAttribute('name');
        if (!name) return;
        if (inp.type === 'checkbox' || inp.type === 'radio') {
          if (inp.checked) payload[name] = inp.value || 'on';
        } else {
          payload[name] = inp.value || '';
        }
      });

      // overwrite coordinates
      payload['x'] = String(x);
      payload['y'] = String(y);

      // ensure ALL troop fields are present (server requires them)
      TROOP_LIST.forEach(u => { payload[u] = String(cfg[u] !== undefined ? cfg[u] : '0'); });

      // include submit button if present
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        const n = submitBtn.getAttribute('name');
        const v = submitBtn.getAttribute('value') || '';
        if (n) payload[n] = v;
      }

      // POST initial (go to confirm page)
      setStatus('⏳ Enviando comando (etapa 1)...');
      const postUrl = (form.getAttribute('action') || placeUrl).startsWith('/')
        ? `${location.protocol}//${location.host}${form.getAttribute('action') || ''}`
        : (form.getAttribute('action') || placeUrl);

      const postRes = await fetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams(payload).toString()
      });

      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();

      // If server returned confirmation or direct success
      if (isAttackConfirmed(postText)) {
        setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
        return true;
      }

      // 2) Parse confirm form
      const postDoc = parser.parseFromString(postText, 'text/html');
      let confirmForm = Array.from(postDoc.querySelectorAll('form')).find(f => 
        (f.action && f.action.includes('try=confirm')) ||
        f.querySelector('#troop_confirm_submit') ||
        /confirm/i.test(f.outerHTML)
      );

      if (confirmForm) {
        const confirmPayload = {};
        Array.from(confirmForm.querySelectorAll('input, select, textarea')).forEach(inp => {
          const name = inp.getAttribute('name');
          if (!name) return;
          if (inp.type === 'checkbox' || inp.type === 'radio') {
            if (inp.checked) confirmPayload[name] = inp.value || 'on';
          } else {
            confirmPayload[name] = inp.value || '';
          }
        });

        const confirmBtn = confirmForm.querySelector('button[type="submit"], input[type="submit"], #troop_confirm_submit');
        if (confirmBtn) {
          const n = confirmBtn.getAttribute('name');
          const v = confirmBtn.getAttribute('value') || '';
          if (n) confirmPayload[n] = v;
        }

        // ensure x/y and troops still present on confirm page
        confirmPayload['x'] = String(x);
        confirmPayload['y'] = String(y);
        TROOP_LIST.forEach(u => { if (!(u in confirmPayload)) confirmPayload[u] = String(cfg[u] !== undefined ? cfg[u] : '0'); });

        let confirmUrl = confirmForm.getAttribute('action') || postRes.url || placeUrl;
        if (confirmUrl.startsWith('/')) confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;

        setStatus('⏳ Confirmando ataque (etapa 2)...');
        const confirmRes = await fetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams(confirmPayload).toString()
        });

        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        const finalText = await confirmRes.text();

        if (isAttackConfirmed(finalText)) {
          setStatus(`✅ Ataque confirmado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus('⚠️ Confirmação concluída, verifique manualmente se o ataque foi enfileirado');
          console.warn('[TWS_Backend] Resposta de confirmação não indicou sucesso claro');
          return false;
        }
      } else {
        setStatus('⚠️ Não foi encontrada a tela de confirmação; verifique manualmente');
        console.log('[TWS_Backend] Resposta POST:', postText.substring(0,500));
        return false;
      }

    } catch (err) {
      setStatus(`❌ Erro: ${err.message}`);
      console.error('[TWS_Backend] executeAttack error', err);
      return false;
    }
  }

  // -----------------------------
  // Scheduler
  // -----------------------------
  function startScheduler(){
    if (_schedulerInterval) clearInterval(_schedulerInterval);

    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      let hasChanges = false;

      // group attacks that should run now (within a small window)
      const toRunByDatetime = {};

      for (const a of list){
        const fp = getAttackFingerprint(a);
        if (_processedFingerprints.has(fp)) continue; // skip already processed
        if (a.done || a.locked) continue;

        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        const diff = t - now;

        if (diff <= 0 && diff > -10000) { // within 10s window
          toRunByDatetime[a.datetime] ||= [];
          toRunByDatetime[a.datetime].push(a);
        }
      }

      for (const [dt, attacks] of Object.entries(toRunByDatetime)){
        for (let i = 0; i < attacks.length; i++){
          const a = attacks[i];
          const fp = getAttackFingerprint(a);

          if (_processedFingerprints.has(fp)) continue;

          // ensure id
          if (!a._id) { a._id = generateUniqueId(); hasChanges = true; }

          // lock + mark processed early to avoid duplicates
          a.locked = true; hasChanges = true;
          _processedFingerprints.add(fp);
          setList(list);

          // skip if already executing
          if (_executing.has(a._id)) continue;
          _executing.add(a._id);

          try {
            const success = await executeAttack(a);
            a.done = true;
            a.success = success;
            a.executedAt = new Date().toISOString();
            hasChanges = true;
          } catch (err) {
            a.error = err?.message || String(err);
            a.done = true;
            a.success = false;
            hasChanges = true;
            console.error('[TWS_Backend] Scheduler execute error', err);
          } finally {
            a.locked = false;
            _executing.delete(a._id);
            hasChanges = true;
            log('Finished attack', a._id, 'success=', a.success);
          }

          // small debounce between attacks
          if (i < attacks.length - 1) await sleep(150);
        }
      }

      if (hasChanges) setList(list);

      const statusEl = document.getElementById('tws-status');
      if (statusEl) statusEl.innerHTML = 'Sem agendamentos ativos.';
    }, 1000);

    log('Scheduler iniciado');
  }

  // -----------------------------
  // Import BBCode
  // -----------------------------
  function importarDeBBCode(bbcode){
    const lines = bbcode.split('[*]').filter(l => l.trim());
    const out = [];

    for (const line of lines){
      const coords = line.match(/(\d{1,3}\|\d{1,3})/g) || [];
      const origem = parseCoord(coords[0]);
      const destino = parseCoord(coords[1]);
      const datetime = line.match(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/)?.[1] || '';
      const url = line.match(/\[url=(.*?)\]/)?.[1] || '';

      const params = {};
      if (url){
        const query = url.split('?')[1] || '';
        query.split('&').forEach(p => { const [k,v] = p.split('='); if (k) params[k] = decodeURIComponent(v || ''); });
      }

      const origemId = params.village || _villageMap[origem];

      if (origem && destino && datetime){
        const cfg = { _id: generateUniqueId(), origem, origemId, alvo: destino, datetime, done:false, locked:false };
        TROOP_LIST.forEach(u => { cfg[u] = params['att_' + u] ? Number(params['att_' + u]) : 0; });
        out.push(cfg);
      }
    }

    log('importarDeBBCode ->', out.length, 'agendamentos');
    return out;
  }

  // -----------------------------
  // Export API
  // -----------------------------
  window.TWS_Backend = {
    loadVillageTxt,
    parseDateTimeToMs,
    parseCoord,
    isValidCoord,
    getList,
    setList,
    startScheduler,
    executeAttack,
    getVillageTroops,
    validateTroops,
    importarDeBBCode,
    TROOP_LIST,
    STORAGE_KEY,

    _internal: {
      get villageMap(){ return _villageMap; },
      get myVillages(){ return _myVillages; },
      get executing(){ return _executing; },
      get processed(){ return _processedFingerprints; }
    }
  };

  log('TWS_Backend v4 carregado com sucesso');

})();
