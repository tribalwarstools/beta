(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const LOCK_STORAGE_KEY = 'tws_attack_locks';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ✅ SISTEMA HÍBRIDO ANTI-DUPLICAÇÃO
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map();
      this.currentTabId = this.generateTabId();
      this.useBroadcast = false;
      this.channel = null;
      this.localLocks = new Set();
      
      // Camada 1: BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          this.channel.onmessage = (event) => this.handleMessage(event.data);
          console.log(`✅ [${this.currentTabId}] BroadcastChannel ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível:', e);
        }
      }
      
      // Camada 2: Limpar locks antigos do localStorage
      this.cleanupExpiredLocks();
      
      window.addEventListener('beforeunload', () => this.cleanup());
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 🆔 Gerar fingerprint único para o ataque
    generateAttackFingerprint(attackData) {
      const { origem, alvo, datetime, ...troops } = attackData;
      const troopsHash = Object.keys(troops)
        .filter(k => TROOP_LIST.includes(k))
        .sort()
        .map(k => `${k}:${troops[k]}`)
        .join(';');
      
      return btoa(`${origem}|${alvo}|${datetime}|${troopsHash}`).substr(0, 32);
    }

    // 🔒 CAMADA 1: localStorage (Rápido)
    acquireLocalStorageLock(fingerprint) {
      try {
        const locks = this.getLocalStorageLocks();
        const now = Date.now();
        
        // Limpar locks expirados
        Object.keys(locks).forEach(fp => {
          if (now - locks[fp].timestamp > 60000) { // 60 segundos
            delete locks[fp];
          }
        });
        
        // Verificar se já está lockado
        if (locks[fingerprint] && (now - locks[fingerprint].timestamp < 30000)) {
          return false; // Lock ativo
        }
        
        // Adquirir lock
        locks[fingerprint] = {
          tabId: this.currentTabId,
          timestamp: now,
          attackData: fingerprint
        };
        
        localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(locks));
        return true;
      } catch (e) {
        console.warn('⚠️ Erro no localStorage lock:', e);
        return true; // Permite execução se localStorage falhar
      }
    }

    // 🔓 Liberar lock do localStorage
    releaseLocalStorageLock(fingerprint) {
      try {
        const locks = this.getLocalStorageLocks();
        if (locks[fingerprint]) {
          delete locks[fingerprint];
          localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(locks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao liberar localStorage lock:', e);
      }
    }

    // 📋 Obter locks do localStorage
    getLocalStorageLocks() {
      try {
        return JSON.parse(localStorage.getItem(LOCK_STORAGE_KEY) || '{}');
      } catch {
        return {};
      }
    }

    // 🧹 Limpar locks expirados
    cleanupExpiredLocks() {
      try {
        const locks = this.getLocalStorageLocks();
        const now = Date.now();
        let changed = false;
        
        Object.keys(locks).forEach(fp => {
          if (now - locks[fp].timestamp > 60000) {
            delete locks[fp];
            changed = true;
          }
        });
        
        if (changed) {
          localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(locks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao limpar locks expirados:', e);
      }
    }

    // 📤 CAMADA 2: BroadcastChannel
    notifyAttackStart(fingerprint, attackId) {
      this.processingAttacks.set(attackId, Date.now());
      
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'ATTACK_START',
          fingerprint,
          attackId,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
    }

    notifyAttackEnd(fingerprint, attackId) {
      this.processingAttacks.delete(attackId);
      this.localLocks.delete(fingerprint);
      
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'ATTACK_END',
          fingerprint,
          attackId,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      // Liberar lock do localStorage
      this.releaseLocalStorageLock(fingerprint);
    }

    // 🔒 CAMADA 3: Lock Local (Crítico)
    acquireLocalLock(fingerprint) {
      if (this.localLocks.has(fingerprint)) {
        return false;
      }
      this.localLocks.add(fingerprint);
      return true;
    }

    releaseLocalLock(fingerprint) {
      this.localLocks.delete(fingerprint);
    }

    // ✅ VERIFICAÇÃO HÍBRIDA (3 camadas)
    canProcessAttack(attackData) {
      const fingerprint = this.generateAttackFingerprint(attackData);
      const attackId = attackData._id;
      
      // Camada 3: Lock Local (Mais rápido)
      if (!this.acquireLocalLock(fingerprint)) {
        console.log(`⏭️ [LocalLock] Já em processamento: ${fingerprint}`);
        return false;
      }
      
      // Camada 1: localStorage (Verificação cross-tab)
      if (!this.acquireLocalStorageLock(fingerprint)) {
        this.releaseLocalLock(fingerprint);
        console.log(`⏭️ [LocalStorage] Outra aba processando: ${fingerprint}`);
        return false;
      }
      
      // Camada 2: BroadcastChannel (Sincronização em tempo real)
      if (this.isBeingProcessed(attackId)) {
        this.releaseLocalLock(fingerprint);
        this.releaseLocalStorageLock(fingerprint);
        console.log(`⏭️ [Broadcast] Já processado: ${attackId}`);
        return false;
      }
      
      return { fingerprint, attackId };
    }

    // 📥 Processar mensagens BroadcastChannel
    handleMessage(data) {
      const { type, fingerprint, attackId, tabId, timestamp } = data;
      
      switch (type) {
        case 'ATTACK_START':
          console.log(`📥 [${tabId}] Iniciou: ${fingerprint}`);
          this.processingAttacks.set(attackId, timestamp);
          break;
          
        case 'ATTACK_END':
          console.log(`📥 [${tabId}] Finalizou: ${fingerprint}`);
          this.processingAttacks.delete(attackId);
          break;
          
        case 'CLEANUP':
          console.log(`📥 [${tabId}] Encerrada`);
          data.attackIds?.forEach(id => this.processingAttacks.delete(id));
          break;
      }
    }

    // ✅ Verificação BroadcastChannel
    isBeingProcessed(attackId) {
      const timestamp = this.processingAttacks.get(attackId);
      if (!timestamp) return false;
      
      const age = Date.now() - timestamp;
      const TIMEOUT = 60000;
      
      if (age > TIMEOUT) {
        this.processingAttacks.delete(attackId);
        return false;
      }
      
      return true;
    }

    // 🧹 Cleanup
    cleanup() {
      const attackIds = Array.from(this.processingAttacks.keys());
      
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({
          type: 'CLEANUP',
          tabId: this.currentTabId,
          attackIds
        });
      }
      
      // Liberar todos os locks locais
      this.localLocks.clear();
      
      if (this.channel) {
        this.channel.close();
      }
    }

    // 📊 Estatísticas
    getStats() {
      return {
        tabId: this.currentTabId,
        processingCount: this.processingAttacks.size,
        localLocks: this.localLocks.size,
        storageLocks: Object.keys(this.getLocalStorageLocks()).length,
        useBroadcast: this.useBroadcast
      };
    }
  }

  // ✅ Instância global
  const attackCoordinator = new AttackCoordinator();

  // === Auto-confirm na página de confirmação ===
  try {
    if (location.href.includes('screen=place&try=confirm')) {
      const btn = document.querySelector('#troop_confirm_submit') || 
                   document.querySelector('button[name="submit"], input[name="submit"]');
      if (btn) {
        console.log('[TWS_Backend] Auto-confirmando ataque...');
        setTimeout(() => btn.click(), 300);
      }
    }
  } catch (e) {
    console.error('[TWS_Backend] Erro no auto-confirm:', e);
  }

  // === Utility functions ===
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function parseCoord(s) {
    if (!s) return null;
    const t = s.trim();
    const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
    if (!match) return null;
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    if (x < 0 || x > 499 || y < 0 || y > 499) return null;
    return `${x}|${y}`;
  }

  function isValidCoord(s) {
    return parseCoord(s) !== null;
  }

  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const perf = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now().toString(36) 
      : Math.random().toString(36).substr(2, 5);
    return `${timestamp}_${random}_${perf}`;
  }

  function getList() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      console.error('[TWS_Backend] Erro ao ler lista:', e);
      return [];
    }
  }

  function setList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      if (window.renderTable) window.renderTable();
    } catch (e) {
      console.error('[TWS_Backend] Erro ao salvar lista:', e);
    }
  }

  // === Carrega village.txt ===
  async function loadVillageTxt() {
    try {
      const res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao buscar village.txt: ' + res.status);
      const text = await res.text();
      const map = {};
      const myVillages = [];
      
      for (const line of text.trim().split('\n')) {
        const [id, name, x, y, playerId] = line.split(',');
        const coord = `${x}|${y}`;
        map[coord] = id;
        
        if (playerId === (window.game_data?.player?.id || '').toString()) {
          const clean = decodeURIComponent((name || '').replace(/\+/g, ' '));
          myVillages.push({ id, name: clean, coord });
        }
      }
      
      _villageMap = map;
      _myVillages = myVillages;
      console.log(`[TWS_Backend] Carregadas ${myVillages.length} aldeias próprias`);
      return { map, myVillages };
    } catch (err) {
      console.error('[TWS_Backend] loadVillageTxt error:', err);
      return { map: {}, myVillages: [] };
    }
  }

  // === Busca tropas disponíveis ===
  async function getVillageTroops(villageId) {
    try {
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place`;
      const res = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao carregar /place: ' + res.status);
      
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const troops = {};
      TROOP_LIST.forEach(u => {
        const availableEl = doc.querySelector(`#units_entry_all_${u}`) || 
                           doc.querySelector(`#units_home_${u}`) ||
                           doc.querySelector(`[id*="${u}"][class*="unit"]`);
        
        let available = 0;
        if (availableEl) {
          const match = availableEl.textContent.match(/\d+/);
          available = match ? parseInt(match[0], 10) : 0;
        }
        
        troops[u] = available;
      });

      return troops;
    } catch (err) {
      console.error('[TWS_Backend] getVillageTroops error:', err);
      return null;
    }
  }

  // === Valida tropas ===
  function validateTroops(requested, available) {
    const errors = [];
    TROOP_LIST.forEach(u => {
      const req = parseInt(requested[u] || 0, 10);
      const avail = parseInt(available[u] || 0, 10);
      if (req > avail) {
        errors.push(`${u}: solicitado ${req}, disponível ${avail}`);
      }
    });
    return errors;
  }

  // === Verifica confirmação ===
  function isAttackConfirmed(htmlText) {
    if (/screen=info_command.*type=own/i.test(htmlText)) return true;
    if (/<tr class="command-row">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) return true;

    const successPatterns = [
      /attack sent/i, /attack in queue/i, /enviado/i, /ataque enviado/i,
      /enfileirad/i, /A batalha começou/i, /march started/i, /comando enviado/i,
      /tropas enviadas/i, /foi enfileirado/i, /command sent/i, /comando foi criado/i
    ];

    return successPatterns.some(p => p.test(htmlText));
  }

  // === Execute attack ===
  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try { if (statusEl) statusEl.innerHTML = msg; } catch {}
      console.log('[TWScheduler]', msg);
    };

    const origemId = cfg.origemId || _villageMap[cfg.origem] || null;
    if (!origemId) {
      setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada!`);
      throw new Error('Origem não encontrada');
    }

    const [x, y] = (cfg.alvo || '').split('|');
    if (!x || !y) {
      setStatus(`❌ Alvo inválido: ${cfg.alvo}`);
      throw new Error('Alvo inválido');
    }

    setStatus(`🔍 Verificando tropas disponíveis em ${cfg.origem}...`);
    const availableTroops = await getVillageTroops(origemId);
    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length > 0) {
        setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
        throw new Error('Tropas insuficientes');
      }
    }

    const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
    setStatus(`📤 Enviando ataque: ${cfg.origem} → ${cfg.alvo}...`);

    try {
      // 1) GET /place
      const getRes = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
      
      const html = await getRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 2) Localizar form
      let form = Array.from(doc.querySelectorAll('form')).find(f => 
        (f.action && f.action.includes('screen=place')) || 
        f.querySelector('input[name="x"]') ||
        TROOP_LIST.some(u => f.querySelector(`input[name="${u}"]`))
      );
      
      if (!form) throw new Error('Form de envio não encontrado');

      // 3) Construir payload
      const payloadObj = {};
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(inp => {
        const name = inp.getAttribute('name');
        if (!name) return;
        
        if (inp.type === 'checkbox' || inp.type === 'radio') {
          if (inp.checked) payloadObj[name] = inp.value || 'on';
        } else {
          payloadObj[name] = inp.value || '';
        }
      });

      // 4) Sobrescrever destino e tropas
      payloadObj['x'] = String(x);
      payloadObj['y'] = String(y);
      TROOP_LIST.forEach(u => {
        payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0');
      });

      // 5) Submit button
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        const n = submitBtn.getAttribute('name');
        const v = submitBtn.getAttribute('value') || '';
        if (n) payloadObj[n] = v;
      }

      // 6) URL encode
      const urlEncoded = Object.entries(payloadObj)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      // 7) POST URL
      let postUrl = form.getAttribute('action') || placeUrl;
      if (postUrl.startsWith('/')) {
        postUrl = `${location.protocol}//${location.host}${postUrl}`;
      }
      if (!postUrl.includes('screen=place')) postUrl = placeUrl;

      // 8) POST inicial
      setStatus(`⏳ Enviando comando...`);
      const postRes = await fetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: urlEncoded
      });
      
      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();

      // 9) Procurar form de confirmação
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

        const confirmBtn = confirmForm.querySelector(
          'button[type="submit"], input[type="submit"], #troop_confirm_submit'
        );
        if (confirmBtn) {
          const n = confirmBtn.getAttribute('name');
          const v = confirmBtn.getAttribute('value') || '';
          if (n) confirmPayload[n] = v;
        }

        const confirmBody = Object.entries(confirmPayload)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        
        let confirmUrl = confirmForm.getAttribute('action') || postRes.url || placeUrl;
        if (confirmUrl.startsWith('/')) {
          confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;
        }

        setStatus('⏳ Confirmando ataque...');
        const confirmRes = await fetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: confirmBody
        });

        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        
        const finalText = await confirmRes.text();
        
        if (isAttackConfirmed(finalText)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus(`⚠️ Confirmação concluída, verifique manualmente`);
          return false;
        }
      } else {
        if (isAttackConfirmed(postText)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus('⚠️ Resposta não indicou confirmação');
          return false;
        }
      }
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      setStatus(`❌ Erro: ${err.message}`);
      throw err;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === Scheduler com Sistema Híbrido ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      for (const a of list) {
        if (a.done || a.locked) continue;
        
        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        
        const diff = t - now;
        
        // ✅ Só processar se estiver no timing correto (-10s a +2s de tolerância)
        if (diff <= 2000 && diff >= -10000) {
          
          // 🛡️ VERIFICAÇÃO HÍBRIDA (3 camadas)
          const lockInfo = attackCoordinator.canProcessAttack(a);
          if (!lockInfo) {
            console.log(`⏭️ Ataque bloqueado pelas 3 camadas: ${a.origem} → ${a.alvo}`);
            continue;
          }
          
          const { fingerprint, attackId } = lockInfo;
          
          console.log(`🚀 Executando ataque com fingerprint: ${fingerprint}`);
          
          // ✅ Notificar início (BroadcastChannel)
          attackCoordinator.notifyAttackStart(fingerprint, attackId);
          
          a.locked = true;
          hasChanges = true;
          setList(list);
          
          try {
            const success = await executeAttack(a);
            a.done = true;
            a.success = success;
            a.executedAt = new Date().toISOString();
            hasChanges = true;
            
            console.log(`✅ Ataque concluído: ${fingerprint}`);
            msgs.push(`✅ ${a.origem} → ${a.alvo}`);
          } catch (err) {
            a.error = err.message;
            a.done = true;
            a.success = false;
            hasChanges = true;
            console.error(`❌ Erro no ataque:`, err);
            msgs.push(`❌ ${a.origem} → ${a.alvo}: ${err.message}`);
          } finally {
            // ✅ Liberar todos os locks
            attackCoordinator.notifyAttackEnd(fingerprint, attackId);
            a.locked = false;
            hasChanges = true;
          }
          
          // ⏳ Delay entre execuções
          await sleep(300);
        } else if (diff > 0) {
          const seconds = Math.ceil(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        }
      }

      if (hasChanges) {
        setList(list);
      }

      const status = document.getElementById('tws-status');
      if (status) {
        status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      }
    }, 1000);
    
    console.log('[TWS_Backend] ✅ Scheduler iniciado com Sistema Híbrido Anti-Duplicação');
  }

  // === Importar de BBCode ===
  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    const fingerprints = new Set();
    
    for (const linha of linhas) {
      const coords = linha.match(/(\d{3}\|\d{3})/g) || [];
      const origem = coords[0] || '';
      const destino = coords[1] || '';
      const dataHora = linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)?.[1] || '';
      const url = linha.match(/\[url=(.*?)\]/)?.[1] || '';
      
      const params = {};
      if (url) {
        const query = url.split('?')[1];
        if (query) {
          query.split('&').forEach(p => {
            const [k, v] = p.split('=');
            params[k] = decodeURIComponent(v || '');
          });
        }
      }
      
      const origemId = params.village || _villageMap[origem];
      const uniqueId = generateUniqueId();
      
      const cfg = {
        _id: uniqueId,
        origem,
        origemId,
        alvo: destino,
        datetime: dataHora,
        done: false,
        locked: false
      };
      
      TROOP_LIST.forEach(u => {
        cfg[u] = params['att_' + u] || 0;
      });
      
      // ✅ Verificar duplicatas na importação
      const fingerprint = attackCoordinator.generateAttackFingerprint(cfg);
      if (!fingerprints.has(fingerprint)) {
        fingerprints.add(fingerprint);
        agendamentos.push(cfg);
      }
    }
    
    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    return agendamentos;
  }

  // === Exportar API ===
  window.TWS_Backend = {
    loadVillageTxt,
    parseDateTimeToMs,
    getList,
    setList,
    startScheduler,
    importarDeBBCode,
    executeAttack,
    getVillageTroops,
    validateTroops,
    generateUniqueId,
    attackCoordinator,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get coordinatorStats() { return attackCoordinator.getStats(); }
    }
  };

  console.log('[TWS_Backend] ✅ Backend Híbrido carregado (3 camadas anti-duplicação)');
})();
