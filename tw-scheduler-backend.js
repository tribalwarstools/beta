(function () {
  'use strict';

  // === Configs ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const PROCESSED_ATTACKS_KEY = 'tw_scheduler_processed'; // ✅ NOVO
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ✅ NOVA: Set em memória para detecção rápida
  const _executingNow = new Set();
  
  // ✅ HYBRID: Gerenciador com 3 camadas de proteção
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map(); // BroadcastChannel
      this.currentTabId = this.generateTabId();
      this.useBroadcast = false;
      this.channel = null;
      
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          
          this.channel.onmessage = (event) => {
            this.handleMessage(event.data);
          };
          
          console.log(`✅ BroadcastChannel ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível');
          this.useBroadcast = false;
        }
      }
      
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ✅ CAMADA 1: Gerar fingerprint para detecção
    getFingerprint(attackId, origem, alvo, datetime) {
      return `${origem}_${alvo}_${datetime}`;
    }

    // ✅ CAMADA 2: Verificar se já foi processado (persistente)
    wasAlreadyProcessed(fingerprint) {
      try {
        const processed = JSON.parse(localStorage.getItem(PROCESSED_ATTACKS_KEY) || '[]');
        return processed.includes(fingerprint);
      } catch (e) {
        console.warn('Erro ao verificar processed:', e);
        return false;
      }
    }

    // ✅ CAMADA 2: Marcar como processado (persistente)
    markAsProcessed(fingerprint) {
      try {
        const processed = JSON.parse(localStorage.getItem(PROCESSED_ATTACKS_KEY) || '[]');
        if (!processed.includes(fingerprint)) {
          processed.push(fingerprint);
          // Manter apenas últimos 1000
          if (processed.length > 1000) {
            processed.shift();
          }
          localStorage.setItem(PROCESSED_ATTACKS_KEY, JSON.stringify(processed));
        }
      } catch (e) {
        console.error('Erro ao marcar processado:', e);
      }
    }

    // ✅ CAMADA 3: Verificar se está executando AGORA (em memória)
    isExecutingNow(attackId) {
      return _executingNow.has(attackId);
    }

    // ✅ CAMADA 3: Marcar como executando AGORA
    markExecuting(attackId) {
      _executingNow.add(attackId);
    }

    // ✅ CAMADA 3: Remover de executando
    unmarkExecuting(attackId) {
      _executingNow.delete(attackId);
    }

    // ✅ BroadcastChannel: Notificar início
    notifyAttackStart(attackId, fingerprint) {
      this.processingAttacks.set(attackId, {
        timestamp: Date.now(),
        fingerprint
      });
      
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'ATTACK_START',
          attackId,
          fingerprint,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      console.log(`📤 [${this.currentTabId}] Iniciando: ${attackId}`);
    }

    // ✅ BroadcastChannel: Notificar fim
    notifyAttackEnd(attackId) {
      this.processingAttacks.delete(attackId);
      
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'ATTACK_END',
          attackId,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      console.log(`📤 [${this.currentTabId}] Finalizado: ${attackId}`);
    }

    // ✅ VERIFICAÇÃO TRIPLA (camadas combinadas)
    isBeingProcessed(attackId, fingerprint) {
      // CAMADA 1: Já foi processado? (localStorage)
      if (this.wasAlreadyProcessed(fingerprint)) {
        console.log(`🛑 CAMADA 1: ${attackId} já foi processado (fingerprint)`);
        return true;
      }
      
      // CAMADA 2: Está executando agora? (memória local)
      if (this.isExecutingNow(attackId)) {
        console.log(`🛑 CAMADA 2: ${attackId} está executando agora`);
        return true;
      }
      
      // CAMADA 3: Outra aba está processando? (BroadcastChannel)
      const data = this.processingAttacks.get(attackId);
      if (data) {
        const age = Date.now() - data.timestamp;
        const TIMEOUT = 120000; // 120 segundos
        
        if (age > TIMEOUT) {
          console.warn(`⚠️ CAMADA 3: ${attackId} expirado (${age}ms), removendo`);
          this.processingAttacks.delete(attackId);
          return false;
        }
        
        console.log(`🛑 CAMADA 3: ${attackId} sendo processado por outra aba`);
        return true;
      }
      
      return false;
    }

    // ✅ Processar mensagens BroadcastChannel
    handleMessage(data) {
      const { type, attackId, fingerprint, tabId, timestamp } = data;
      
      switch (type) {
        case 'ATTACK_START':
          console.log(`📥 [${tabId}] Iniciou: ${attackId}`);
          this.processingAttacks.set(attackId, { timestamp, fingerprint });
          break;
          
        case 'ATTACK_END':
          console.log(`📥 [${tabId}] Finalizou: ${attackId}`);
          this.processingAttacks.delete(attackId);
          break;
          
        case 'CLEANUP':
          console.log(`📥 [${tabId}] Limpou ${data.attackIds?.length || 0} locks`);
          data.attackIds?.forEach(id => this.processingAttacks.delete(id));
          break;
      }
    }

    // ✅ Limpeza ao fechar aba
    cleanup() {
      const attackIds = Array.from(this.processingAttacks.keys());
      
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({
          type: 'CLEANUP',
          tabId: this.currentTabId,
          attackIds
        });
      }
      
      console.log(`🧹 Limpando ${attackIds.length} locks`);
      if (this.channel) this.channel.close();
    }

    // ✅ Stats
    getStats() {
      return {
        tabId: this.currentTabId,
        processingCount: this.processingAttacks.size,
        executingNow: _executingNow.size,
        useBroadcast: this.useBroadcast
      };
    }

    // ✅ DEBUG: Limpar processados
    debugClearProcessed() {
      localStorage.removeItem(PROCESSED_ATTACKS_KEY);
      this.processingAttacks.clear();
      _executingNow.clear();
      console.log('🧹 Todos os locks limpos (DEBUG)');
    }
  }

  // ✅ Instância global
  const attackCoordinator = new AttackCoordinator();

  // === Auto-confirm ===
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
    if (x < 0 || x > 9999 || y < 0 || y > 9999) return null;
    
    return `${x}|${y}`;
  }

  function isValidCoord(s) {
    return parseCoord(s) !== null;
  }

  function getCoordInfo(s) {
    const normalized = parseCoord(s);
    if (!normalized) {
      return { valid: false, error: 'Formato inválido' };
    }
    const [x, y] = normalized.split('|').map(Number);
    return {
      valid: true,
      original: s.trim(),
      normalized,
      x, y,
      mapSection: getMapSection(x, y)
    };
  }

  function getMapSection(x, y) {
    const sections = [];
    if (x < 250) sections.push('Oeste');
    else if (x > 250) sections.push('Leste');
    else sections.push('Centro');
    if (y < 250) sections.push('Norte');
    else if (y > 250) sections.push('Sul');
    else sections.push('Centro');
    return sections.join('-');
  }

  function getDistance(coord1, coord2) {
    const c1 = parseCoord(coord1);
    const c2 = parseCoord(coord2);
    if (!c1 || !c2) return null;
    const [x1, y1] = c1.split('|').map(Number);
    const [x2, y2] = c2.split('|').map(Number);
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${random}`;
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
      try {
        if (statusEl) statusEl.innerHTML = msg;
      } catch {}
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

    setStatus(`🔍 Verificando tropas...`);
    const availableTroops = await getVillageTroops(origemId);
    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length > 0) {
        setStatus(`❌ Tropas insuficientes`);
        throw new Error('Tropas insuficientes');
      }
    }

    const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
    setStatus(`📤 Enviando: ${cfg.origem} → ${cfg.alvo}...`);

    try {
      const getRes = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
      
      const html = await getRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let form = Array.from(doc.querySelectorAll('form')).find(f => 
        (f.action && f.action.includes('screen=place')) || 
        f.querySelector('input[name="x"]') ||
        TROOP_LIST.some(u => f.querySelector(`input[name="${u}"]`))
      );
      
      if (!form) throw new Error('Form não encontrado');

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

      payloadObj['x'] = String(x);
      payloadObj['y'] = String(y);
      TROOP_LIST.forEach(u => {
        payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0');
      });

      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        const n = submitBtn.getAttribute('name');
        const v = submitBtn.getAttribute('value') || '';
        if (n) payloadObj[n] = v;
      }

      const urlEncoded = Object.entries(payloadObj)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      let postUrl = form.getAttribute('action') || placeUrl;
      if (postUrl.startsWith('/')) {
        postUrl = `${location.protocol}//${location.host}${postUrl}`;
      }
      if (!postUrl.includes('screen=place')) postUrl = placeUrl;

      setStatus(`⏳ Enviando comando...`);
      const postRes = await fetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: urlEncoded
      });
      
      if (!postRes.ok) throw new Error(`POST falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();

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

        setStatus('⏳ Confirmando...');
        const confirmRes = await fetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: confirmBody
        });

        if (!confirmRes.ok) throw new Error(`POST confirmação falhou`);
        const finalText = await confirmRes.text();
        
        if (isAttackConfirmed(finalText)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus(`⚠️ Verifique manualmente`);
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

  // === Scheduler com 3 camadas ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      const ataquesPorHorario = {};
      
      for (const a of list) {
        if (a.done || a.locked) continue;
        
        // ✅ GERAR FINGERPRINT
        const fingerprint = attackCoordinator.getFingerprint(a._id, a.origem, a.alvo, a.datetime);
        
        // ✅ VERIFICAÇÃO TRIPLA
        if (attackCoordinator.isBeingProcessed(a._id, fingerprint)) {
          console.log(`⏭️ Pulando ${a._id} (duplicação detectada em camadas)`);
          continue;
        }
        
        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        
        const diff = t - now;
        
        if (diff <= 0 && diff > -10000) {
          if (!ataquesPorHorario[a.datetime]) {
            ataquesPorHorario[a.datetime] = [];
          }
          ataquesPorHorario[a.datetime].push(a);
        } else if (diff > 0) {
          const seconds = Math.ceil(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        }
      }

      for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {
        console.log(`🔥 Processando ${ataques.length} ataques`);
        msgs.push(`🔥 Executando ${ataques.length} ataque(s)...`);
        
        for (let i = 0; i < ataques.length; i++) {
          const a = ataques[i];
          
          // ✅ GERAR FINGERPRINT NOVAMENTE (antes de executar)
          const fingerprint = attackCoordinator.getFingerprint(a._id, a.origem, a.alvo, a.datetime);
          
          // ✅ VERIFICAÇÃO FINAL (antes de tudo)
          if (attackCoordinator.isBeingProcessed(a._id, fingerprint)) {
            console.log(`⏭️ Pulando ${a._id} (verificação final)`);
            continue;
          }
          
          // ✅ GERAR ID SE NECESSÁRIO
          if (!a._id) {
            a._id = generateUniqueId();
            hasChanges = true;
          }
          
          // ✅ MARCAR FINGERPRINT COMO PROCESSADO (IMEDIATAMENTE)
          attackCoordinator.markAsProcessed(fingerprint);
          
          // ✅ MARCAR COMO EXECUTANDO AGORA (memória)
          attackCoordinator.markExecuting(a._id);
          
          // ✅ NOTIFICAR VIA BROADCASTCHANNEL
          attackCoordinator.notifyAttackStart(a._id, fingerprint);
          
          // ✅ LOCK NO BANCO DE DADOS
          a.locked = true;
          hasChanges = true;
          setList(list);
          
          console.log(`🚀 [${i + 1}/${ataques.length}] Executando ${a._id}`);
          
          try {
            const success = await executeAttack(a);
            a.done = true;
            a.success = success;
            a.executedAt = new Date().toISOString();
            hasChanges = true;
            console.log(`✅ [${i + 1}/${ataques.length}] Concluído`);
          } catch (err) {
            a.error = err.message;
            a.done = true;
            a.success = false;
            hasChanges = true;
            console.error(`❌ [${i + 1}/${ataques.length}] Erro:`, err);
          } finally {
            // ✅ REMOVER DE EXECUTANDO
            attackCoordinator.unmarkExecuting(a._id);
            
            // ✅ NOTIFICAR FIM
            attackCoordinator.notifyAttackEnd(a._id);
            
            a.locked = false;
            hasChanges = true;
            console.log(`🏁 Finalizando ${a._id}`);
          }
          
          if (i < ataques.length - 1) {
            console.log(`⏳ Aguardando 200ms...`);
            await sleep(200);
          }
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
    
    console.log('[TWS_Backend] Scheduler iniciado (Hybrid: localStorage + BroadcastChannel + memória)');
  }

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

  // === Exportar API ===
  window.TWS_Backend = {
    loadVillageTxt,
    parseDateTimeToMs,
    parseCoord,
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

  console.log('[TWS_Backend] ✅ v3.1 HYBRID Carregado (localStorage + BroadcastChannel + memória)');
})();
