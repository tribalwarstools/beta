(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TIMESLOT_LOCK_KEY = 'tws_timeslot_locks';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ✅ SISTEMA DE LOCK POR TIMESLOT (HORÁRIO)
  class TimeslotCoordinator {
    constructor() {
      this.currentTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.activeTimeslots = new Set();
      this.executionQueue = new Map();
      this.useBroadcast = false;
      this.channel = null;
      
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_timeslots');
          this.useBroadcast = true;
          this.channel.onmessage = (event) => this.handleMessage(event.data);
          console.log(`✅ [${this.currentTabId}] TimeslotCoordinator ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível:', e);
        }
      }
      
      // Limpar locks expirados a cada 30s
      setInterval(() => this.cleanupExpiredLocks(), 30000);
      window.addEventListener('beforeunload', () => this.cleanup());
    }

    // 🕒 Gerar chave de timeslot (segundo específico)
    getTimeslotKey(datetimeStr) {
      const timestamp = parseDateTimeToMs(datetimeStr);
      if (isNaN(timestamp)) return null;
      
      // Arredonda para o segundo (remove milissegundos)
      const timeslot = Math.floor(timestamp / 1000);
      return `timeslot_${timeslot}`;
    }

    // 🔒 Tentar adquirir lock de um timeslot
    async acquireTimeslotLock(timeslotKey, attackCount = 1) {
      const now = Date.now();
      
      // ✅ Camada 1: Lock local (evita duplicata na mesma aba)
      if (this.activeTimeslots.has(timeslotKey)) {
        console.log(`⏭️ [Local] Timeslot ${timeslotKey} já está sendo processado`);
        return false;
      }

      // ✅ Camada 2: Lock em localStorage (entre abas)
      try {
        const allLocks = this.getGlobalLocks();
        const existingLock = allLocks[timeslotKey];
        
        if (existingLock) {
          const lockAge = now - existingLock.timestamp;
          
          // Se lock é recente (< 30 segundos), não permitir
          if (lockAge < 30000) {
            console.log(`⏭️ [Global] Timeslot ${timeslotKey} travado por ${existingLock.tabId} (${Math.round(lockAge/1000)}s)`);
            return false;
          } else {
            // Lock expirado, remover
            console.log(`🧹 Removendo lock expirado: ${timeslotKey}`);
            delete allLocks[timeslotKey];
          }
        }

        // Adquirir lock
        allLocks[timeslotKey] = {
          tabId: this.currentTabId,
          timestamp: now,
          attackCount: attackCount,
          acquiredAt: new Date().toISOString()
        };
        
        localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        
        // ✅ Camada 3: Notificar via BroadcastChannel
        if (this.useBroadcast) {
          this.channel.postMessage({
            type: 'TIMESLOT_ACQUIRED',
            timeslotKey,
            tabId: this.currentTabId,
            timestamp: now,
            attackCount
          });
        }

      } catch (e) {
        console.warn('⚠️ Erro no lock global:', e);
        return false;
      }

      // ✅ Adicionar ao controle local
      this.activeTimeslots.add(timeslotKey);
      console.log(`🔒 [${this.currentTabId}] Timeslot adquirido: ${timeslotKey} para ${attackCount} ataques`);
      
      return true;
    }

    // 🔓 Liberar lock do timeslot
    releaseTimeslotLock(timeslotKey) {
      // Remover localmente
      this.activeTimeslots.delete(timeslotKey);
      
      // Remover do localStorage
      try {
        const allLocks = this.getGlobalLocks();
        if (allLocks[timeslotKey]?.tabId === this.currentTabId) {
          delete allLocks[timeslotKey];
          localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao liberar lock global:', e);
      }
      
      // Notificar via Broadcast
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'TIMESLOT_RELEASED',
          timeslotKey,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      console.log(`🔓 [${this.currentTabId}] Timeslot liberado: ${timeslotKey}`);
    }

    // 🧹 Limpar locks expirados
    cleanupExpiredLocks() {
      try {
        const allLocks = this.getGlobalLocks();
        const now = Date.now();
        let changed = false;
        
        Object.keys(allLocks).forEach(timeslotKey => {
          const lock = allLocks[timeslotKey];
          if (now - lock.timestamp > 60000) { // 60 segundos
            delete allLocks[timeslotKey];
            changed = true;
            console.log(`🧹 Limpando lock expirado: ${timeslotKey}`);
          }
        });
        
        if (changed) {
          localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao limpar locks expirados:', e);
      }
    }

    // 📋 Obter locks globais
    getGlobalLocks() {
      try {
        return JSON.parse(localStorage.getItem(TIMESLOT_LOCK_KEY) || '{}');
      } catch {
        return {};
      }
    }

    // 📥 Processar mensagens
    handleMessage(data) {
      const { type, timeslotKey, tabId, timestamp } = data;
      
      switch (type) {
        case 'TIMESLOT_ACQUIRED':
          console.log(`📥 Aba ${tabId} adquiriu timeslot: ${timeslotKey}`);
          // Adicionar ao controle local para evitar conflitos
          this.activeTimeslots.add(timeslotKey);
          break;
          
        case 'TIMESLOT_RELEASED':
          console.log(`📥 Aba ${tabId} liberou timeslot: ${timeslotKey}`);
          this.activeTimeslots.delete(timeslotKey);
          break;
      }
    }

    // 🧹 Cleanup
    cleanup() {
      // Liberar todos os locks desta aba
      this.activeTimeslots.forEach(timeslotKey => {
        this.releaseTimeslotLock(timeslotKey);
      });
      
      if (this.channel) {
        this.channel.close();
      }
    }

    // 📊 Estatísticas
    getStats() {
      const globalLocks = this.getGlobalLocks();
      return {
        tabId: this.currentTabId,
        activeTimeslots: Array.from(this.activeTimeslots),
        globalLocks: Object.keys(globalLocks).length,
        useBroadcast: this.useBroadcast
      };
    }
  }

  // ✅ Instância global
  const timeslotCoordinator = new TimeslotCoordinator();

  // === FUNÇÕES UTILITÁRIAS COMPLETAS ===
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
    return `attack_${timestamp}_${random}`;
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

  // === CARREGAR village.txt ===
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

  // === BUSCAR TROPAS DISPONÍVEIS ===
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

  // === VALIDAR TROPAS ===
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

  // === VERIFICAR CONFIRMAÇÃO ===
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

  // === EXECUTAR ATAQUE (COMPLETO) ===
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

  // === SCHEDULER ANTI-DUPLICAÇÃO COMPLETO ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      // 🎯 AGORA: Agrupar ataques por timeslot (segundo específico)
      const attacksByTimeslot = {};
      
      // Fase 1: Coletar ataques elegíveis por timeslot
      for (const attack of list) {
        if (attack.done || attack.locked) continue;
        
        const attackTime = parseDateTimeToMs(attack.datetime);
        if (!attackTime || isNaN(attackTime)) continue;
        
        const timeDiff = attackTime - now;
        
        // ✅ Só considerar ataques entre -10s e +2s do horário
        if (timeDiff <= 2000 && timeDiff >= -10000) {
          const timeslotKey = timeslotCoordinator.getTimeslotKey(attack.datetime);
          if (!timeslotKey) continue;
          
          if (!attacksByTimeslot[timeslotKey]) {
            attacksByTimeslot[timeslotKey] = [];
          }
          
          attacksByTimeslot[timeslotKey].push(attack);
        } else if (timeDiff > 0) {
          // Mostrar contagem regressiva
          const seconds = Math.ceil(timeDiff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${attack.origem} → ${attack.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        }
      }

      // Fase 2: Processar UM timeslot de cada vez
      for (const [timeslotKey, attacks] of Object.entries(attacksByTimeslot)) {
        // 🔒 TENTAR ADQUIRIR LOCK DESTE TIMESLOT
        const acquired = await timeslotCoordinator.acquireTimeslotLock(timeslotKey, attacks.length);
        
        if (!acquired) {
          console.log(`⏭️ Pulando timeslot ${timeslotKey} (já está sendo processado)`);
          continue;
        }

        console.log(`🚀 PROCESSANDO TIMESLOT: ${timeslotKey} com ${attacks.length} ataques`);
        msgs.push(`🔥 Executando ${attacks.length} ataque(s) no horário...`);

        // ✅ EXECUTAR ATAQUES DESTE TIMESLOT EM SEQUÊNCIA
        for (let i = 0; i < attacks.length; i++) {
          const attack = attacks[i];
          
          // Marcar como locked
          attack.locked = true;
          hasChanges = true;
          setList(list);
          
          try {
            console.log(`🎯 [${i + 1}/${attacks.length}] ${attack.origem} → ${attack.alvo}`);
            
            const success = await executeAttack(attack);
            
            attack.done = true;
            attack.success = success;
            attack.executedAt = new Date().toISOString();
            hasChanges = true;
            
            console.log(`✅ [${i + 1}/${attacks.length}] Concluído`);
            msgs.push(`✅ ${attack.origem} → ${attack.alvo}`);
            
          } catch (err) {
            attack.error = err.message;
            attack.done = true;
            attack.success = false;
            hasChanges = true;
            
            console.error(`❌ [${i + 1}/${attacks.length}] Erro:`, err);
            msgs.push(`❌ ${attack.origem} → ${attack.alvo}: ${err.message}`);
          } finally {
            attack.locked = false;
            hasChanges = true;
          }
          
          // ⏳ Delay entre ataques do MESMO timeslot
          if (i < attacks.length - 1) {
            await sleep(400); // 400ms entre ataques
          }
        }

        // 🔓 LIBERAR LOCK DO TIMESLOT
        timeslotCoordinator.releaseTimeslotLock(timeslotKey);
        console.log(`🏁 TIMESLOT ${timeslotKey} CONCLUÍDO`);
        
        // ⏰ Aguardar antes do próximo timeslot (evita sobrecarga)
        await sleep(200);
      }

      // Atualizar storage se necessário
      if (hasChanges) {
        setList(list);
      }

      // Atualizar status
      const status = document.getElementById('tws-status');
      if (status) {
        status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      }
    }, 1000); // Verificar a cada 1 segundo
    
    console.log('[TWS_Backend] ✅ SCHEDULER ANTI-DUPLICAÇÃO ATIVADO');
  }

  // === IMPORTAR DE BBCODE ===
  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    
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
      
      if (origem && destino && dataHora) {
        agendamentos.push(cfg);
      }
    }
    
    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    return agendamentos;
  }

  // === AUTO-CONFIRM ===
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

  // === EXPORTAR API COMPLETA ===
  window.TWS_Backend = {
    loadVillageTxt,
    parseDateTimeToMs,
    parseCoord,
    isValidCoord,
    getList,
    setList,
    startScheduler,
    importarDeBBCode,
    executeAttack,
    getVillageTroops,
    validateTroops,
    generateUniqueId,
    timeslotCoordinator,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get coordinatorStats() { return timeslotCoordinator.getStats(); }
    }
  };

  console.log('[TWS_Backend] ✅ SISTEMA COMPLETO ANTI-DUPLICAÇÃO CARREGADO');
})();


//teste
