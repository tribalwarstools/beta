// === TW Scheduler Backend — Complete & Optimized ===
(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PROCESSED_KEY = STORAGE_KEY + '_processed_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  const SCHEDULER_TICK = 500; // ms
  const TAB_LOCK_KEY = 'tws_tab_lock_v1';
  const TAB_LOCK_TIMEOUT = 3000; // ms

  // === Internal State ===
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  const _executing = new Set();
  const _processedAttacks = new Map();
  const _execQueue = [];
  let _queueRunning = false;
  let _idCounter = Date.now();

  // ----------------- BroadcastChannel Coordinator -----------------
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map();
      this.currentTabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      this.useBroadcast = false;
      this.channel = null;

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          this.channel.onmessage = (ev) => this.handleMessage(ev.data);
          console.log(`[${this.currentTabId}] BroadcastChannel ready`);
        } catch(e) { console.warn('BroadcastChannel init failed', e); }
      }

      window.addEventListener('beforeunload', () => this.cleanup());
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
      const { type, attackId, fingerprint } = msg;
      switch(type) {
        case 'ATTACK_START':
          if(fingerprint) _persistedMarkProcessed(fingerprint);
          this.processingAttacks.set(attackId, msg.ts || Date.now());
          break;
        case 'ATTACK_END':
          this.processingAttacks.delete(attackId);
          break;
        case 'CLEANUP':
          (msg.attackIds || []).forEach(id => this.processingAttacks.delete(id));
          break;
      }
    }

    isBeingProcessed(attackId) {
      const ts = this.processingAttacks.get(attackId);
      if (!ts) return false;
      if (Date.now() - ts > 60000) { this.processingAttacks.delete(attackId); return false; }
      return true;
    }

    cleanup() {
      const ids = Array.from(this.processingAttacks.keys());
      if(this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'CLEANUP', tabId: this.currentTabId, attackIds: ids });
        this.channel.close();
      }
    }

    getStats() {
      return { tabId: this.currentTabId, processingCount: this.processingAttacks.size, useBroadcast: this.useBroadcast };
    }
  }

  const attackCoordinator = new AttackCoordinator();

  // ----------------- Utilities -----------------
  function generateUniqueId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const ts = Date.now();
    const c = ++_idCounter;
    return `${ts}_${c}_${Math.random().toString(36).slice(2,8)}`;
  }

  function getAttackFingerprint(a) { return (a.origemId || a.origem) + '_' + a.alvo + '_' + a.datetime; }

  function parseDateTimeToMs(str) {
    if(!str) return NaN;
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if(!m) return NaN;
    const [_, d, mo, y, hh, mm, ss] = m.map(Number);
    return new Date(y, mo-1, d, hh, mm, ss).getTime();
  }

  // ----------------- Processed map -----------------
  function _loadProcessedMap() {
    try {
      const raw = localStorage.getItem(PROCESSED_KEY);
      if (!raw) return new Map();
      const obj = JSON.parse(raw);
      return new Map(Object.entries(obj));
    } catch { return new Map(); }
  }

  function _saveProcessedMap(map) {
    try { localStorage.setItem(PROCESSED_KEY, JSON.stringify(Object.fromEntries(map))); } 
    catch(e){ console.error('saveProcessedMap', e); }
  }

  function _persistedMarkProcessed(fingerprint) {
    const map = _loadProcessedMap();
    map.set(fingerprint, Date.now());
    _saveProcessedMap(map);
    _processedAttacks.set(fingerprint, Date.now());
  }

  function _isProcessed(fingerprint) {
    if(_processedAttacks.has(fingerprint)) return true;
    const map = _loadProcessedMap();
    if(map.has(fingerprint)) { _processedAttacks.set(fingerprint, map.get(fingerprint)); return true; }
    return false;
  }

  // Cleanup TTL 24h
  (function(){
    const map = _loadProcessedMap();
    const now = Date.now();
    let changed = false;
    map.forEach((ts,k) => { if(now - ts > 24*3600*1000){ map.delete(k); changed = true; } });
    if(changed) _saveProcessedMap(map);
  })();

  // ----------------- Storage helpers -----------------
  function getList(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function setList(list){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); if(window.renderTable) window.renderTable(); } catch(e){ console.error(e); } }

  // ----------------- Village loader -----------------
  async function loadVillageTxt(){
    try{
      const res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if(!res.ok) throw new Error('village.txt fetch error');
      const text = await res.text();
      const map = {};
      const my = [];
      text.trim().split('\n').forEach(line => {
        const [id,name,x,y,playerId] = line.split(',');
        map[x+'|'+y] = id;
        if(playerId === (window.game_data?.player?.id||'').toString()){
          my.push({ id, name: decodeURIComponent((name||'').replace(/\+/g,' ')), coord: x+'|'+y });
        }
      });
      _villageMap = map; _myVillages = my;
      return { map, myVillages: my };
    } catch(err){ console.error('loadVillageTxt', err); return { map:{}, myVillages:[] }; }
  }

  // ----------------- Get village troops -----------------
  async function getVillageTroops(villageId){
    try{
      const url = `/game.php?village=${villageId}&screen=place`;
      const html = await fetch(url, { credentials: 'include' }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, "text/html");
      const troops = {};
      TROOP_LIST.forEach(u => {
        const el = doc.querySelector(`#units_entry_all_${u}, #units_home_${u}, [id*="${u}"][class*="unit"]`);
        troops[u] = el?.textContent.match(/\d+/)?.[0]*1 || 0;
      });
      return troops;
    } catch(err){ console.error('getVillageTroops', err); return null; }
  }

  // ----------------- Execute Attack -----------------
  async function executeAttack(task){
    try{
      const confirmUrl = `/game.php?village=${task.source}&screen=place&try=confirm&target=${task.target}`;
      const html = await fetch(confirmUrl, { credentials:'include' }).then(r => r.text());

      const formMatch = html.match(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
      if(!formMatch) return { success:false, message:'Formulário não encontrado' };

      const [_, finalUrl, formHtml] = formMatch;

      const inputs = {};
      const inputRegex = /<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
      let match;
      while((match = inputRegex.exec(formHtml)) !== null){
        inputs[match[1]] = match[2];
      }

      // Substituir tropas
      Object.keys(task.troops || {}).forEach(t => { inputs[t] = task.troops[t]; });

      const params = new URLSearchParams();
      for(const key in inputs) params.append(key, inputs[key]);

      const resp = await fetch(finalUrl, {
        method:'POST',
        credentials:'include',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
        body: params.toString()
      });

      const text = await resp.text();
      const confirmed = /(attack sent|attack in queue|enviado|ataque enviado|comando foi enviado)/i.test(text);

      return { success: confirmed, message: confirmed ? 'Ataque enviado' : 'Falha ao enviar', data: task };

    } catch(err){
      return { success:false, message:'Erro interno', error:String(err) };
    }
  }

  // ----------------- Queue Worker -----------------
  async function queueWorker(){
    if(_queueRunning) return;
    _queueRunning = true;

    while(_execQueue.length > 0){
      const task = _execQueue.shift();
      if(!task) continue;
      const fp = getAttackFingerprint(task);
      if(_isProcessed(fp)) continue;
      if(attackCoordinator.isBeingProcessed(task._id)) continue;

      _executing.add(task._id);
      attackCoordinator.notifyAttackStart(task._id, fp);

      try{
        const res = await executeAttack(task);
        if(res.success) _persistedMarkProcessed(fp);
      } catch(e){ console.error('queueWorker executeAttack', e); }

      attackCoordinator.notifyAttackEnd(task._id, fp);
      _executing.delete(task._id);
      await new Promise(r => setTimeout(r, 80));
    }

    _queueRunning = false;
  }

  // ----------------- Scheduler -----------------
  function tryAcquireTabLock() {
    const now = Date.now();
    const lock = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || 'null');
    if(!lock || (now - lock.ts) > TAB_LOCK_TIMEOUT){
      localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ts: now }));
      return true;
    }
    return false;
  }

  function refreshTabLock(){ localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ts: Date.now() })); }

  async function schedulerTick(){
    if(!tryAcquireTabLock()) return;
    refreshTabLock();

    const now = Date.now();
    const list = getList();
    let dirty = false;
    const buckets = {};

    for(const a of list){
      if(a.done) continue;
      const fp = getAttackFingerprint(a);
      if(_isProcessed(fp)) continue;
      if(attackCoordinator.isBeingProcessed(a._id)) continue;
      const t = parseDateTimeToMs(a.datetime);
      if(!t || isNaN(t)) continue;
      const diff = t - now;
      if(diff <=0 && diff > -10000){
        (buckets[a.datetime] = buckets[a.datetime] || []).push(a);
      }
    }

    const keys = Object.keys(buckets).sort();
    for(const dt of keys){
      for(const task of buckets[dt]){
        const fp = getAttackFingerprint(task);
        _persistedMarkProcessed(fp);
        if(!task._id) task._id = generateUniqueId();
        _execQueue.push(task);
        dirty = true;
      }
    }

    if(dirty){ setList(list); queueWorker(); }
  }

  // ----------------- BBCode importer -----------------
  function importarDeBBCode(bbcode){
    const linhas = bbcode.split('[*]').filter(l => l.trim()!=='');
    const ag = [];
    linhas.forEach(linha => {
      const coords = linha.match(/(\d{1,3}\|\d{1,3})/g) || [];
      const origem = coords[0]||'', destino = coords[1]||'';
      const dt = (linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)||[])[1]||'';
      const url = (linha.match(/\[url=(.*?)\]/)||[])[1]||'';
      const params={};
      if(url){
        const q = (url.split('?')[1]||'');
        q.split('&').forEach(p => { const sp = p.split('='); params[sp[0]] = decodeURIComponent(sp[1]||''); });
      }
      const origemId = params.village || _villageMap[origem];
      const id = generateUniqueId();
      const cfg = { _id:id, origem, origemId, alvo:destino, datetime:dt, done:false, locked:false };
      TROOP_LIST.forEach(u => { cfg[u] = params['att_'+u]||0; });
      if(origem && destino && dt) ag.push(cfg);
    });
    return ag;
  }

  // ----------------- Public API -----------------
  window.TWS_Backend = {
    loadVillageTxt,
    parseDateTimeToMs,
    parseCoord: s => { const m = s?.trim().match(/^(\d{1,4})\|(\d{1,4})$/); if(!m) return null; const x=+m[1], y=+m[2]; if(x<0||x>499||y<0||y>499) return null; return x+'|'+y; },
    getList,
    setList,
    startScheduler: ()=>{ if(_schedulerInterval) clearInterval(_schedulerInterval); _schedulerInterval=setInterval(schedulerTick,SCHEDULER_TICK); console.log('Scheduler started'); },
    importarDeBBCode,
    executeAttack,
    getVillageTroops,
    validateTroops: (requested, available) => TROOP_LIST.reduce((errs,u)=>{ const req=+requested[u]||0, avail=+available[u]||0; if(req>avail) errs.push(`${u}:${req}>${avail}`); return errs; }, []),
    generateUniqueId,
    getAttackFingerprint,
    attackCoordinator,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    _internal: { get villageMap(){return _villageMap;}, get myVillages(){return _myVillages;}, get executing(){return _executing;}, get processedAttacks(){return _processedAttacks;}, get coordinatorStats(){return attackCoordinator.getStats();} }
  };

  console.log('[TWS_Backend] ✅ Backend v6 loaded (queue + fetch executeAttack corrigido)');
})();
