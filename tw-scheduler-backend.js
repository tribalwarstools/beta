(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const LOCK_PREFIX = 'tws_lock_';
  const LOCK_TTL = 15000; // 15s - tempo de validade do lock no localStorage
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ============================
  // AttackCoordinator (Broadcast + localStorage sync)
  // ============================
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map(); // { attackId: timestamp }
      this.currentTabId = this.generateTabId();
      this.useBroadcast = false;
      this.channel = null;
      
      // Tentar usar BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          
          this.channel.onmessage = (event) => {
            this.handleMessage(event.data);
          };
          
          console.log(`✅ [${this.currentTabId}] BroadcastChannel ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível:', e);
          this.useBroadcast = false;
        }
      } else {
        console.warn('⚠️ BroadcastChannel não suportado neste navegador');
      }

      // Sincronizar locks existentes do localStorage (startup)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith(LOCK_PREFIX)) {
            const id = key.replace(LOCK_PREFIX, '');
            const val = localStorage.getItem(key);
            if (!val) continue;
            try {
              const parsed = JSON.parse(val);
              const tsNum = Number(parsed.ts) || 0;
              if (Date.now() - tsNum < LOCK_TTL) {
                this.processingAttacks.set(id, tsNum);
              } else {
                // lock expirado, remover
                try { localStorage.removeItem(key); } catch (e) {}
              }
            } catch(e) {
              // formato antigo ou inválido: remover para segurança
              try { localStorage.removeItem(key); } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.warn('[AttackCoordinator] Erro ao sincronizar localStorage:', e);
      }
      
      // Limpar ao fechar aba
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });

      // Listener storage para atualizações cross-tab
      window.addEventListener('storage', (ev) => {
        if (!ev.key) return;
        if (!ev.key.startsWith(LOCK_PREFIX)) return;

        const id = ev.key.replace(LOCK_PREFIX, '');
        if (ev.newValue) {
          try {
            const parsed = JSON.parse(ev.newValue);
            this.processingAttacks.set(id, Number(parsed.ts) || Date.now());
          } catch (e) {
            // fallback: ignore
          }
        } else {
          this.processingAttacks.delete(id);
        }
      });
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 📤 Notificar que vou processar um ataque (também grava lock JSON no localStorage)
    notifyAttackStart(attackId) {
      const now = Date.now();
      this.processingAttacks.set(attackId, now);
      const payload = { ts: now, owner: this.currentTabId };
      try {
        localStorage.setItem(`${LOCK_PREFIX}${attackId}`, JSON.stringify(payload));
      } catch (e) {
        console.warn('[AttackCoordinator] falha ao setar localStorage lock:', e);
      }
      
      if (this.useBroadcast) {
        try {
          this.channel.postMessage({
            type: 'ATTACK_START',
            attackId,
            tabId: this.currentTabId,
            timestamp: now
          });
        } catch(e) {
          console.warn('[AttackCoordinator] broadcast falhou:', e);
        }
      }
      
      console.log(`📤 [${this.currentTabId}] Iniciando: ${attackId}`);
    }

    // 📥 Notificar que terminei de processar
    notifyAttackEnd(attackId) {
      this.processingAttacks.delete(attackId);
      try {
        const key = `${LOCK_PREFIX}${attackId}`;
        const val = localStorage.getItem(key);
        if (!val) {
          // nada
        } else {
          try {
            const parsed = JSON.parse(val);
            const tsNum = Number(parsed.ts) || 0;
            const owner = parsed.owner;
            if (owner === this.currentTabId || Date.now() - tsNum > LOCK_TTL) {
              try { localStorage.removeItem(key); } catch(e) {}
            }
          } catch (e) {
            // se formato inesperado, remover para segurança
            try { localStorage.removeItem(key); } catch(e) {}
          }
        }
      } catch (e) {
        console.warn('[AttackCoordinator] falha ao remover lock localStorage:', e);
      }

      if (this.useBroadcast) {
        try {
          this.channel.postMessage({
            type: 'ATTACK_END',
            attackId,
            tabId: this.currentTabId,
            timestamp: Date.now()
          });
        } catch(e) {
          console.warn('[AttackCoordinator] broadcast falhou:', e);
        }
      }
      
      console.log(`📤 [${this.currentTabId}] Finalizado: ${attackId}`);
    }

    // ✅ Verificar se outro ataque já está processando
    isBeingProcessed(attackId) {
      if (!attackId) return false;
      const timestamp = this.processingAttacks.get(attackId);
      const now = Date.now();

      // Se existir no Map e dentro do TTL
      if (timestamp && (now - timestamp) < LOCK_TTL) return true;

      // Caso contrário verificar localStorage (espera-se JSON)
      try {
        const key = `${LOCK_PREFIX}${attackId}`;
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            const tsNum = Number(parsed.ts) || 0;
            if (now - tsNum < LOCK_TTL) {
              // atualizar mapa local
              this.processingAttacks.set(attackId, tsNum);
              return true;
            } else {
              // expirado -> remover
              try { localStorage.removeItem(key); } catch (e) {}
              this.processingAttacks.delete(attackId);
              return false;
            }
          } catch (e) {
            // formato inválido -> remover
            try { localStorage.removeItem(key); } catch (e) {}
            this.processingAttacks.delete(attackId);
            return false;
          }
        }
      } catch (e) {
        console.warn('[AttackCoordinator] isBeingProcessed erro:', e);
      }

      return false;
    }

    // 📋 Processar mensagens recebidas
    handleMessage(data) {
      const { type, attackId, tabId, timestamp } = data;
      
      switch (type) {
        case 'ATTACK_START':
          console.log(`📥 Aba ${tabId} iniciou: ${attackId}`);
          this.processingAttacks.set(attackId, timestamp || Date.now());
          break;
          
        case 'ATTACK_END':
          console.log(`📥 Aba ${tabId} finalizou: ${attackId}`);
          this.processingAttacks.delete(attackId);
          break;
          
        case 'CLEANUP':
          console.log(`📥 Aba ${tabId} encerrada`);
          data.attackIds?.forEach(id => this.processingAttacks.delete(id));
          break;
      }
    }

    // 🧹 Limpar ao fechar aba
    cleanup() {
      const attackIds = Array.from(this.processingAttacks.keys());
      
      if (this.useBroadcast && this.channel) {
        try {
          this.channel.postMessage({
            type: 'CLEANUP',
            tabId: this.currentTabId,
            attackIds
          });
        } catch(e) {}
      }
      
      console.log(`🧹 [${this.currentTabId}] Limpando ${attackIds.length} locks`);
      
      // remover locks proprietários
      try {
        attackIds.forEach(id => {
          const key = `${LOCK_PREFIX}${id}`;
          const val = localStorage.getItem(key);
          if (!val) return;
          try {
            const parsed = JSON.parse(val);
            const owner = parsed.owner;
            if (owner === this.currentTabId) {
              try { localStorage.removeItem(key); } catch(e) {}
            }
          } catch (e) {
            try { localStorage.removeItem(key); } catch(e) {}
          }
        });
      } catch (e) {
        console.warn('[AttackCoordinator] cleanup error:', e);
      }

      if (this.channel) {
        try { this.channel.close(); } catch (e) {}
      }
    }

    // 📊 Obter estatísticas
    getStats() {
      return {
        tabId: this.currentTabId,
        processingCount: this.processingAttacks.size,
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
    
    if (x < 0 || x > 999 || y < 0 || y > 999) {
      return null;
    }
    
    return `${x}|${y}`;
  }

  function isValidCoord(s) {
    return parseCoord(s) !== null;
  }

  function getCoordInfo(s) {
    const normalized = parseCoord(s);
    
    if (!normalized) {
      return {
        valid: false,
        error: 'Formato inválido. Use X|Y (ex: 5|4, 52|43, 529|431)'
      };
    }
    
    const [x, y] = normalized.split('|').map(Number);
    
    return {
      valid: true,
      original: s.trim(),
      normalized,
      x,
      y,
      mapSection: getMapSection(x, y),
      distance: null
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

  function validateCoordList(coordStrings) {
    return coordStrings.map((coord, idx) => ({
      index: idx + 1,
      input: coord,
      valid: isValidCoord(coord),
      normalized: parseCoord(coord),
      error: !isValidCoord(coord) ? 'Formato inválido' : null
    }));
  }

  function sanitizeCoordInput(input) {
    if (!input) return null;
    
    let cleaned = input.trim().replace(/\s+/g, '');
    cleaned = cleaned.replace(/-/g, '|');
    cleaned = cleaned.replace(/[^\d|]/g, '');
    
    if (!cleaned) return null;
    
    return parseCoord(cleaned);
  }

  // ✅ Gerar ID único
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

  // === Lock utility via localStorage (atomic JSON)
  function acquireAtomicLock(id) {
    try {
      const key = `${LOCK_PREFIX}${id}`;
      const now = Date.now();

      // checar existente
      const existing = localStorage.getItem(key);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          const tsNum = Number(parsed.ts) || 0;
          if (now - tsNum < LOCK_TTL) {
            return false; // ainda válido
          }
        } catch (e) {
          // se formato inválido, iremos sobrescrever
        }
      }

      const payload = JSON.stringify({ ts: now, owner: attackCoordinator.currentTabId });
      localStorage.setItem(key, payload);
      const stored = localStorage.getItem(key);
      if (stored === payload) return true;

      // se outro sobrescreveu no meio, falha
      return false;
    } catch (e) {
      console.warn('[acquireAtomicLock] erro:', e);
      return false;
    }
  }

  function releaseAtomicLock(id) {
    try {
      const key = `${LOCK_PREFIX}${id}`;
      const stored = localStorage.getItem(key);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        const owner = parsed.owner;
        const tsNum = Number(parsed.ts) || 0;
        if (owner === attackCoordinator.currentTabId || Date.now() - tsNum > LOCK_TTL) {
          try { localStorage.removeItem(key); } catch (e) {}
        }
      } catch (e) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
    } catch (e) {
      console.warn('[releaseAtomicLock] erro:', e);
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

      console.log(`[TWS_Backend] Tropas da aldeia ${villageId}:`, troops);
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
    if (/screen=info_command.*type=own/i.test(htmlText)) {
      return true;
    }

    if (/<tr class="command-row">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) {
      return true;
    }

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

    // origemId robusto: usa origemId numérico se válido, senão tenta mapear por coordenada
    const origemId = (cfg.origemId && /^\d+$/.test(String(cfg.origemId)))
      ? String(cfg.origemId)
      : (_villageMap[cfg.origem] || null);

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
    } else {
      // se não conseguimos ler tropas (página não permitida / erro), não bloquear o envio
      console.warn('[TWS_Backend] Não foi possível validar tropas — prosseguindo com envio');
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
        
        console.log('[TWS_Backend] Resposta final recebida');
        
        if (isAttackConfirmed(finalText)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus(`⚠️ Confirmação concluída, verifique manualmente`);
          console.warn('[TWS_Backend] Resposta não indicou sucesso claro');
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

  // ✅ Delay entre execuções
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === Normalize IDs antes do scheduler rodar ===
  function normalizeAttackIds(list) {
    let changed = false;
    for (const a of list) {
      if (!a._id) {
        a._id = generateUniqueId();
        changed = true;
      }
    }
    if (changed) setList(list);
    return changed;
  }

  // === Scheduler ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);

    // garantir IDs antes de iniciar
    const initialList = getList();
    normalizeAttackIds(initialList);

    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      const ataquesPorHorario = {};

      // garantir IDs caso tenham sido adicionados externamente
      normalizeAttackIds(list);
      
      for (const a of list) {
        if (a.done || a.locked) continue;
        
        // ✅ PROTEÇÃO: Verificar BroadcastChannel / localStorage
        if (attackCoordinator.isBeingProcessed(a._id)) {
          // já está processando em outra aba
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
          
          // ✅ Verificação dupla
          if (attackCoordinator.isBeingProcessed(a._id)) {
            console.log(`⏭️ Pulando ${a._id} (outra aba pegou)`);
            continue;
          }

          // (2) Tentar lock cross-tab via atomic JSON localStorage
          const locked = acquireAtomicLock(a._id);
          if (!locked) {
            console.log(`⏭️ Pulando ${a._id} (falha ao adquirir lock)`);
            continue;
          }

          // ✅ Notificar início via BroadcastChannel + grava lock (notify também grava)
          attackCoordinator.notifyAttackStart(a._id);

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

            console.log(`✅ [${i + 1}/${ataques.length}] Concluído: ${a._id}`);
          } catch (err) {
            a.error = err.message;
            a.done = true;
            a.success = false;
            hasChanges = true;
            console.error(`❌ [${i + 1}/${ataques.length}] Erro:`, err);
          } finally {
            // ✅ Notificar fim via BroadcastChannel
            attackCoordinator.notifyAttackEnd(a._id);

            // liberar lock localStorage (atomic)
            releaseAtomicLock(a._id);

            a.locked = false;
            hasChanges = true;
            console.log(`🏁 [${i + 1}/${ataques.length}] Finalizando ${a._id}`);
          }

          if (i < ataques.length - 1) {
            console.log(`⏳ Aguardando 100ms antes do próximo...`);
            await sleep(100);
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
    
    console.log('[TWS_Backend] Scheduler iniciado com sincronização de locks');
  }

  // === Importar de BBCode ===
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
      
      // CORREÇÃO: origemId seguro
      const origemIdCandidate = params.village && /^\d+$/.test(params.village) ? params.village : null;
      const origemId = origemIdCandidate || _villageMap[origem] || null;

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

  console.log('[TWS_Backend] ✅ Backend v3 patched (locks JSON atômicos + BroadcastChannel)');
})();
