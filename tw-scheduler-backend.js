(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;

  // ✅ PROTEÇÃO
  const _executing = new Set();
  const _processedAttacks = new Set();
  let _idCounter = Date.now();

  // === BroadcastChannel / Coordenação de ataques ===
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map();
      this.currentTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.channel = null;
      this.useBroadcast = false;

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          this.channel.onmessage = e => this.handleMessage(e.data);
          console.log(`✅ [${this.currentTabId}] BroadcastChannel ativado`);
        } catch { this.useBroadcast = false; }
      }

      window.addEventListener('beforeunload', () => this.cleanup());
    }

    notifyAttackStart(id) {
      this.processingAttacks.set(id, Date.now());
      if (this.useBroadcast) this.channel.postMessage({ type: 'ATTACK_START', attackId: id, tabId: this.currentTabId, timestamp: Date.now() });
    }

    notifyAttackEnd(id) {
      this.processingAttacks.delete(id);
      if (this.useBroadcast) this.channel.postMessage({ type: 'ATTACK_END', attackId: id, tabId: this.currentTabId, timestamp: Date.now() });
    }

    isBeingProcessed(id) {
      const ts = this.processingAttacks.get(id);
      if (!ts) return false;
      if (Date.now() - ts > 60000) { this.processingAttacks.delete(id); return false; }
      return true;
    }

    handleMessage(data) {
      const { type, attackId } = data;
      if (type === 'ATTACK_START') this.processingAttacks.set(attackId, data.timestamp);
      else if (type === 'ATTACK_END') this.processingAttacks.delete(attackId);
      else if (type === 'CLEANUP') data.attackIds?.forEach(id => this.processingAttacks.delete(id));
    }

    cleanup() {
      const ids = Array.from(this.processingAttacks.keys());
      if (this.useBroadcast && this.channel) this.channel.postMessage({ type: 'CLEANUP', tabId: this.currentTabId, attackIds: ids });
      if (this.channel) this.channel.close();
    }

    getStats() { return { tabId: this.currentTabId, processingCount: this.processingAttacks.size, useBroadcast: this.useBroadcast }; }
  }

  const attackCoordinator = new AttackCoordinator();

  // === Utils ===
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function parseCoord(s) {
    const t = s?.trim();
    const m = t?.match(/^(\d{1,4})\|(\d{1,4})$/);
    if (!m) return null;
    const [x, y] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (x < 0 || x > 499 || y < 0 || y > 499) return null;
    return `${x}|${y}`;
  }

  function isValidCoord(s) { return parseCoord(s) !== null; }

  function getAttackFingerprint(a) { return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`; }

  function generateUniqueId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const ts = Date.now(), c = ++_idCounter, r = Math.random().toString(36).substr(2,9);
    return `${ts}_${c}_${r}`;
  }

  function sleep(ms) {
    const sab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, ms);
    return Promise.resolve();
  }

  // === Storage ===
  function getList() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function setList(list) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); if(window.renderTable) window.renderTable(); } catch {} }

  // === Village.txt ===
  async function loadVillageTxt() {
    try {
      const res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao buscar village.txt');
      const text = await res.text();
      const map = {}, myVillages = [];
      for (const line of text.trim().split('\n')) {
        const [id, name, x, y, playerId] = line.split(',');
        const coord = `${x}|${y}`;
        map[coord] = id;
        if (playerId === (window.game_data?.player?.id || '').toString()) {
          myVillages.push({ id, name: decodeURIComponent((name||'').replace(/\+/g,' ')), coord });
        }
      }
      _villageMap = map;
      _myVillages = myVillages;
      return { map, myVillages };
    } catch { return { map:{}, myVillages:[] }; }
  }

  // === Troops ===
async function getVillageTroops(villageId) {
  try {
    const url = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place&ajax=units`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`Falha ao buscar tropas: ${res.status}`);

    const data = await res.json();

    // data.units geralmente contém { spear: "10", sword: "5", ... } como string
    const troops = {};
    for (const t of ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob']) {
      troops[t] = parseInt(data.units?.[t] || '0', 10);
    }

    console.log(`[TWS_Backend] Tropas da aldeia ${villageId}:`, troops);
    return troops;

  } catch (err) {
    console.error('[TWS_Backend] getVillageTroops error:', err);
    return null;
  }
}


  function validateTroops(requested, available) {
    return TROOP_LIST.map(u => {
      const r = parseInt(requested[u]||0,10), a = parseInt(available[u]||0,10);
      return r>a ? `${u}: solicitado ${r}, disponível ${a}` : null;
    }).filter(Boolean);
  }

  function isAttackConfirmed(htmlText) {
    return /screen=info_command.*type=own|<tr class="command-row".*data-command-id|attack sent|enfileirad|tropas enviadas/i.test(htmlText);
  }

  // === Execute attack ===
  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = msg => { if(statusEl) statusEl.innerHTML = msg; console.log('[TWScheduler]', msg); };

    const origemId = cfg.origemId || _villageMap[cfg.origem];
    if(!origemId) { setStatus(`❌ Origem ${cfg.origem||cfg.origemId} não encontrada`); throw new Error('Origem inválida'); }
    const [x,y] = (cfg.alvo||'').split('|'); 
    if(!x||!y) { setStatus(`❌ Alvo inválido: ${cfg.alvo}`); throw new Error('Alvo inválido'); }

    setStatus(`🔍 Verificando tropas em ${cfg.origem}...`);
    const available = await getVillageTroops(origemId);
    const errors = available ? validateTroops(cfg,available) : [];
    if(errors.length){ setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`); throw new Error('Tropas insuficientes'); }

    const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
    setStatus(`📤 Enviando ataque: ${cfg.origem} → ${cfg.alvo}...`);

    try {
      const getRes = await fetch(placeUrl,{credentials:'same-origin'});
      const html = await getRes.text();
      const doc = new DOMParser().parseFromString(html,'text/html');
      const form = Array.from(doc.forms).find(f => f.action?.includes('screen=place') || TROOP_LIST.some(u=>f.querySelector(`input[name="${u}"]`)));
      if(!form) throw new Error('Form não encontrado');

      const payload = {};
      Array.from(form.elements).forEach(inp=>{
        const n=inp.name; if(!n) return;
        if(inp.type==='checkbox'||inp.type==='radio'){ if(inp.checked) payload[n]=inp.value||'on'; } 
        else payload[n]=inp.value||'';
      });
      payload['x']=x; payload['y']=y;
      TROOP_LIST.forEach(u=>payload[u]=cfg[u]||0);

      const submitBtn=form.querySelector('button[type="submit"], input[type="submit"]');
      if(submitBtn){ const n=submitBtn.name,v=submitBtn.value||''; if(n) payload[n]=v; }

      const body = Object.entries(payload).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      let postUrl=form.action||placeUrl; if(postUrl.startsWith('/')) postUrl=`${location.protocol}//${location.host}${postUrl}`;

      setStatus('⏳ Enviando comando...');
      const postRes = await fetch(postUrl,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
      const postText = await postRes.text();
      const postDoc = new DOMParser().parseFromString(postText,'text/html');
      const confirmForm = Array.from(postDoc.forms).find(f=>f.action?.includes('try=confirm')||/confirm/i.test(f.outerHTML));

      if(confirmForm){
        const cPayload={};
        Array.from(confirmForm.elements).forEach(inp=>{
          const n=inp.name; if(!n) return;
          if(inp.type==='checkbox'||inp.type==='radio'){ if(inp.checked)cPayload[n]=inp.value||'on'; } 
          else cPayload[n]=inp.value||'';
        });
        const cBtn=confirmForm.querySelector('button[type="submit"], input[type="submit"], #troop_confirm_submit');
        if(cBtn){ const n=cBtn.name,v=cBtn.value||''; if(n)cPayload[n]=v; }
        const cBody=Object.entries(cPayload).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        let cUrl=confirmForm.action||postRes.url||placeUrl; if(cUrl.startsWith('/')) cUrl=`${location.protocol}//${location.host}${cUrl}`;
        setStatus('⏳ Confirmando ataque...');
        const cRes = await fetch(cUrl,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:cBody});
        const finalText = await cRes.text();
        if(isAttackConfirmed(finalText)){ setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`); return true; }
        else { setStatus('⚠️ Confirmação concluída, verifique manualmente'); return false; }
      } else if(isAttackConfirmed(postText)){ setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`); return true; }
      else { setStatus('⚠️ Resposta não indicou confirmação'); return false; }

    } catch(err){ setStatus(`❌ Erro: ${err.message}`); throw err; }
  }

  // === Scheduler ===
  function startScheduler() {
    if(_schedulerInterval) clearInterval(_schedulerInterval);

    _schedulerInterval = setInterval(async()=>{
      const list=getList(); const now=Date.now(); let msgs=[]; let hasChanges=false;
      const ataquesPorHorario={};

      for(const a of list){
        const fingerprint=getAttackFingerprint(a);
        if(_processedAttacks.has(fingerprint)) continue;
        if(a.done||a.locked) continue;
        if(attackCoordinator.isBeingProcessed(a._id)) continue;
        const t=parseDateTimeToMs(a.datetime);
        if(!t||isNaN(t)) continue;
        const diff=t-now;
        if(diff<=0 && diff>-10000){ ataquesPorHorario[a.datetime]??=[]; ataquesPorHorario[a.datetime].push(a); }
        else if(diff>0){ const s=Math.ceil(diff/1000),m=Math.floor(s/60),sec=s%60; msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${m}:${sec.toString().padStart(2,'0')}`); }
      }

      for(const [horario,ataques] of Object.entries(ataquesPorHorario)){
        msgs.push(`🔥 Executando ${ataques.length} ataque(s)...`);
        for(let i=0;i<ataques.length;i++){
          const a=ataques[i];
          const fingerprint=getAttackFingerprint(a);
          if(_processedAttacks.has(fingerprint)) continue;
          if(attackCoordinator.isBeingProcessed(a._id)) continue;
          if(!a._id){ a._id=generateUniqueId(); hasChanges=true; }
          if(_executing.has(a._id)) continue;

          _processedAttacks.add(fingerprint);
          attackCoordinator.notifyAttackStart(a._id);
          a.locked=true; _executing.add(a._id); setList(list);

          try{ const success=await executeAttack(a); a.done=true; a.success=success; a.executedAt=new Date().toISOString(); hasChanges=true; }
          catch(err){ a.done=true; a.success=false; a.error=err.message; hasChanges=true; }
          finally{ attackCoordinator.notifyAttackEnd(a._id); a.locked=false; _executing.delete(a._id); hasChanges=true; }

          if(i<ataques.length-1) await sleep(100);
        }
      }

      if(hasChanges) setList(list);
      const status=document.getElementById('tws-status');
      if(status) status.innerHTML=msgs.length?msgs.join('<br>'):'Sem agendamentos ativos.';
    },1000);
    console.log('[TWS_Backend] Scheduler iniciado');
  }

  // === Importar BBCode ===
  function importarDeBBCode(bbcode){
    const linhas=bbcode.split('[*]').filter(l=>l.trim());
    const agendamentos=[];
    for(const linha of linhas){
      const coords=linha.match(/(\d{3}\|\d{3})/g)||[];
      const origem=coords[0]||'',destino=coords[1]||'';
      const dataHora=linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)?.[1]||'';
      const url=linha.match(/\[url=(.*?)\]/)?.[1]||'';
      const params={};
      if(url){ const q=url.split('?')[1]; if(q) q.split('&').forEach(p=>{ const [k,v]=p.split('='); params[k]=decodeURIComponent(v||''); }); }
      const origemId=params.village||_villageMap[origem];
      const cfg={ _id: generateUniqueId(), origem, origemId, alvo: destino, datetime: dataHora, done:false, locked:false };
      TROOP_LIST.forEach(u=>cfg[u]=params['att_'+u]||0);
      if(origem && destino && dataHora) agendamentos.push(cfg);
    }
    return agendamentos;
  }

  // === Export API ===
  window.TWS_Backend={
    loadVillageTxt, parseDateTimeToMs, parseCoord, getList, setList, startScheduler,
    importarDeBBCode, executeAttack, getVillageTroops, validateTroops,
    generateUniqueId, getAttackFingerprint, attackCoordinator, TROOP_LIST, STORAGE_KEY, PANEL_STATE_KEY,
    _internal:{ get villageMap(){return _villageMap;}, get myVillages(){return _myVillages;}, get executing(){return _executing;}, get processedAttacks(){return _processedAttacks;}, get coordinatorStats(){return attackCoordinator.getStats();} }
  };

  console.log('[TWS_Backend] ✅ Backend v4 headless pronto (BroadcastChannel + proteções)');
})();

