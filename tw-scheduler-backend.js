(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0] || 'world';
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  // Tempo (ms) configuráveis
  const SAVE_DEBOUNCE_MS = 500;      // Debounce para escrita no localStorage
  const LOCK_TIMEOUT_MS = 60000;     // 60s timeout para locks entre abas
  const SCHEDULE_INTERVAL_MS = 1000; // Intervalo de checagem do scheduler

  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  let _pendingSaveTimeout = null;

  // -------------------------------
  // 🚀 Gerenciador de Broadcast Channel (melhorado)
  // -------------------------------
  class AttackCoordinator {
    constructor() {
      this.processingAttacks = new Map(); // attackId -> timestamp
      this.currentTabId = this.generateTabId();
      this.useBroadcast = false;
      this.channel = null;

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_attacks');
          this.useBroadcast = true;
          this.channel.onmessage = (event) => this.handleMessage(event.data);
          console.log(`✅ [${this.currentTabId}] BroadcastChannel ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível:', e);
        }
      } else {
        console.warn('⚠️ BroadcastChannel não suportado neste navegador');
      }

      window.addEventListener('beforeunload', () => this.cleanup());
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    notifyAttackStart(attackId) {
      this.processingAttacks.set(attackId, Date.now());
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'ATTACK_START', attackId, tabId: this.currentTabId, timestamp: Date.now() });
      }
      console.log(`📤 [${this.currentTabId}] Iniciando: ${attackId}`);
    }

    notifyAttackEnd(attackId) {
      this.processingAttacks.delete(attackId);
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'ATTACK_END', attackId, tabId: this.currentTabId, timestamp: Date.now() });
      }
      console.log(`📤 [${this.currentTabId}] Finalizado: ${attackId}`);
    }

    isBeingProcessed(attackId) {
      if (!attackId) return false;
      const timestamp = this.processingAttacks.get(attackId);
      if (!timestamp) return false;
      const age = Date.now() - timestamp;
      if (age > LOCK_TIMEOUT_MS) {
        console.warn(`⚠️ Ataque ${attackId} expirado (${age}ms), removendo lock`);
        this.processingAttacks.delete(attackId);
        return false;
      }
      return true;
    }

    handleMessage(data) {
      try {
        const { type, attackId, tabId, timestamp, attackIds } = data || {};
        switch (type) {
          case 'ATTACK_START':
            this.processingAttacks.set(attackId, timestamp || Date.now());
            console.log(`📥 Aba ${tabId} iniciou: ${attackId}`);
            break;
          case 'ATTACK_END':
            this.processingAttacks.delete(attackId);
            console.log(`📥 Aba ${tabId} finalizou: ${attackId}`);
            break;
          case 'CLEANUP':
            (attackIds || []).forEach(id => this.processingAttacks.delete(id));
            console.log(`📥 Aba ${tabId} encerrou, removendo ${attackIds?.length || 0} locks`);
            break;
        }
      } catch (e) {
        console.warn('[AttackCoordinator] erro ao tratar mensagem:', e);
      }
    }

    cleanup() {
      const attackIds = Array.from(this.processingAttacks.keys());
      if (this.useBroadcast && this.channel) {
        this.channel.postMessage({ type: 'CLEANUP', tabId: this.currentTabId, attackIds });
      }
      console.log(`🧹 [${this.currentTabId}] Limpando ${attackIds.length} locks`);
      if (this.channel) this.channel.close();
    }

    getStats() {
      return { tabId: this.currentTabId, processingCount: this.processingAttacks.size, useBroadcast: this.useBroadcast };
    }
  }

  const attackCoordinator = new AttackCoordinator();

  // -------------------------------
  // Helper utilities
  // -------------------------------
  function parseDateTimeToMs(str) {
    if (!str) return NaN;
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    // Use Date.UTC to avoid timezone quirks if desired; here we keep local time
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function parseCoord(s) {
    if (!s) return null;
    const t = s.trim();
    const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
    if (!match) return null;
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    // Ajustado para mapas até 999x999 (mais realista)
    if (x < 0 || x > 999 || y < 0 || y > 999) return null;
    return `${x}|${y}`;
  }

  function isValidCoord(s) { return parseCoord(s) !== null; }

  function getCoordInfo(s) {
    const normalized = parseCoord(s);
    if (!normalized) return { valid: false, error: 'Formato inválido. Use X|Y (ex: 5|4, 52|43, 529|431)' };
    const [x, y] = normalized.split('|').map(Number);
    return { valid: true, original: s.trim(), normalized, x, y, mapSection: getMapSection(x, y), distance: null };
  }

  function getMapSection(x, y) {
    const sections = [];
    sections.push(x < 250 ? 'Oeste' : (x > 250 ? 'Leste' : 'Centro'));
    sections.push(y < 250 ? 'Norte' : (y > 250 ? 'Sul' : 'Centro'));
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
    return coordStrings.map((coord, idx) => ({ index: idx + 1, input: coord, valid: isValidCoord(coord), normalized: parseCoord(coord), error: !isValidCoord(coord) ? 'Formato inválido' : null }));
  }

  function sanitizeCoordInput(input) {
    if (!input) return null;
    let cleaned = input.trim().replace(/\s+/g, '');
    cleaned = cleaned.replace(/-/g, '|');
    cleaned = cleaned.replace(/[^\d|]/g, '');
    if (!cleaned) return null;
    return parseCoord(cleaned);
  }

  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const perf = (typeof performance !== 'undefined' && performance.now) ? Math.floor(performance.now()).toString(36) : Math.random().toString(36).substr(2, 5);
    return `${timestamp}_${random}_${perf}`;
  }

  // -------------------------------
  // localStorage helpers (debounced save)
  // -------------------------------
  function getList() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      console.error('[TWS_Backend] Erro ao ler lista:', e);
      return [];
    }
  }

  function saveListNow(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      if (window.renderTable) window.renderTable();
    } catch (e) {
      console.error('[TWS_Backend] Erro ao salvar lista:', e);
    }
  }

  function setList(list) {
    // debounce para reduzir escritas
    if (_pendingSaveTimeout) clearTimeout(_pendingSaveTimeout);
    _pendingSaveTimeout = setTimeout(() => { saveListNow(list); _pendingSaveTimeout = null; }, SAVE_DEBOUNCE_MS);
  }

  // -------------------------------
  // Carrega village.txt com parsing seguro
  // -------------------------------
  async function loadVillageTxt() {
    try {
      const res = await fetch(VILLAGE_TXT_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao buscar village.txt: ' + res.status);
      const text = await res.text();
      const map = {};
      const myVillages = [];
      for (const line of text.trim().split('\n')) {
        // formato: id,name,x,y,playerId
        const [id, name, x, y, playerId] = line.split(',');
        const coord = `${x}|${y}`;
        map[coord] = id;
        if (playerId === (window.game_data?.player?.id || '').toString()) {
          const clean = decodeURIComponent((name || '').replace(/\+/g, ' '));
          myVillages.push({ id, name: clean, coord });
        }
      }
      _villageMap = map; _myVillages = myVillages;
      console.log(`[TWS_Backend] Carregadas ${myVillages.length} aldeias próprias`);
      return { map, myVillages };
    } catch (err) {
      console.error('[TWS_Backend] loadVillageTxt error:', err);
      return { map: {}, myVillages: [] };
    }
  }

  // -------------------------------
  // Busca tropas disponíveis (mais robusto)
  // -------------------------------
  async function getVillageTroops(villageId) {
    try {
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place`;
      const res = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao carregar /place: ' + res.status);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const troops = {};

      // Estratégia: procurar por elementos com ids/names que contenham a unidade
      TROOP_LIST.forEach(u => {
        troops[u] = 0; // default
        // 1) selectores previsíveis
        const selectors = [
          `#units_entry_all_${u}`,
          `#units_home_${u}`,
          `[id*="_${u}"]`,
          `[name*="${u}"]`,
          `.${u}-count`,
          `.unit-${u}`
        ];

        let found = null;
        for (const sel of selectors) {
          const el = doc.querySelector(sel);
          if (el && el.textContent) { found = el; break; }
        }

        // 2) fallback: procurar por textos com números próximos ao nome (regex simples)
        if (!found) {
          const re = new RegExp(`(\\d[\\d.,]*)\\s*(?=${u})`, 'i');
          const text = doc.body.textContent || '';
          const m = text.match(re);
          if (m) found = { textContent: m[1] };
        }

        if (found && found.textContent) {
          const match = String(found.textContent).replace(/[^\d]/g, '').match(/\d+/);
          troops[u] = match ? parseInt(match[0], 10) : 0;
        }
      });

      console.log(`[TWS_Backend] Tropas da aldeia ${villageId}:`, troops);
      return troops;
    } catch (err) {
      console.error('[TWS_Backend] getVillageTroops error:', err);
      return null;
    }
  }

  // -------------------------------
  // Valida tropas
  // -------------------------------
  function validateTroops(requested, available) {
    const errors = [];
    TROOP_LIST.forEach(u => {
      const req = parseInt(requested[u] || 0, 10);
      const avail = parseInt(available?.[u] || 0, 10);
      if (req > avail) errors.push(`${u}: solicitado ${req}, disponível ${avail}`);
    });
    return errors;
  }

  // -------------------------------
  // Detecção de confirmação (melhorada)
  // -------------------------------
  function isAttackConfirmed(htmlText) {
    if (!htmlText) return false;
    // padrões diversos (pt/en/es)
    const patterns = [/screen=info_command.*type=own/i, /<tr class="command-row">/i, /data-command-id=/i,
      /attack sent/i, /ataque enviado/i, /tropas enviadas/i, /comando enviado/i, /enviado/i, /march started/i,
      /comando foi criado/i, /A batalha começou/i
    ];
    return patterns.some(p => p.test(htmlText));
  }

  // -------------------------------
  // Auto-confirm robusto na página de confirmação
  // -------------------------------
  try {
    if (location.href.includes('screen=place&try=confirm')) {
      const attemptClick = () => {
        const btn = document.querySelector('#troop_confirm_submit') || document.querySelector('button[name="submit"], input[name="submit"]');
        if (btn) { console.log('[TWS_Backend] Auto-confirmando ataque...'); btn.click(); return true; }
        return false;
      };

      // tentar até encontrar o botão (mais confiável que setTimeout fixo)
      const interval = setInterval(() => { if (attemptClick()) clearInterval(interval); }, 150);
      // fallback para limpar o intervalo após 5s
      setTimeout(() => clearInterval(interval), 5000);
    }
  } catch (e) {
    console.error('[TWS_Backend] Erro no auto-confirm:', e);
  }

  // -------------------------------
  // Execute attack (refatorado e seguro)
  // -------------------------------
  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => { try { if (statusEl) statusEl.innerHTML = msg; } catch {} console.log('[TWScheduler]', msg); };

    const origemId = cfg.origemId || _villageMap[cfg.origem] || null;
    if (!origemId) { setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada!`); throw new Error('Origem não encontrada'); }

    const [x, y] = (cfg.alvo || '').split('|');
    if (!x || !y) { setStatus(`❌ Alvo inválido: ${cfg.alvo}`); throw new Error('Alvo inválido'); }

    setStatus(`🔍 Verificando tropas disponíveis em ${cfg.origem}...`);
    const availableTroops = await getVillageTroops(origemId);
    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length > 0) { setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`); throw new Error('Tropas insuficientes'); }
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

      // 2) Encontrar form de envio
      let form = Array.from(doc.querySelectorAll('form')).find(f => (f.action && f.action.includes('screen=place')) || f.querySelector('input[name="x"]') || TROOP_LIST.some(u => f.querySelector(`input[name="${u}"]`)) );
      if (!form) throw new Error('Form de envio não encontrado');

      // 3) Construir payload a partir do form (clonando valores padrão)
      const payloadObj = {};
      Array.from(form.querySelectorAll('input, select, textarea')).forEach(inp => {
        const name = inp.getAttribute('name'); if (!name) return;
        if (inp.type === 'checkbox' || inp.type === 'radio') { if (inp.checked) payloadObj[name] = inp.value || 'on'; }
        else payloadObj[name] = inp.value || '';
      });

      // 4) Substituir destino e tropas
      payloadObj['x'] = String(x); payloadObj['y'] = String(y);
      TROOP_LIST.forEach(u => { payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0'); });

      // 5) Capturar botão de submit para pegar o name/value
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) { const n = submitBtn.getAttribute('name'); const v = submitBtn.getAttribute('value') || ''; if (n) payloadObj[n] = v; }

      // 6) URL encode
      const urlEncoded = Object.entries(payloadObj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

      // 7) POST
      let postUrl = form.getAttribute('action') || placeUrl;
      if (postUrl.startsWith('/')) postUrl = `${location.protocol}//${location.host}${postUrl}`;
      if (!postUrl.includes('screen=place')) postUrl = placeUrl;

      setStatus('⏳ Enviando comando...');
      const postRes = await fetch(postUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: urlEncoded });
      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();

      // 8) Procurar necessidade de confirmação
      const postDoc = parser.parseFromString(postText, 'text/html');
      let confirmForm = Array.from(postDoc.querySelectorAll('form')).find(f => (f.action && f.action.includes('try=confirm')) || f.querySelector('#troop_confirm_submit') || /confirm/i.test(f.outerHTML));

      if (confirmForm) {
        const confirmPayload = {};
        Array.from(confirmForm.querySelectorAll('input, select, textarea')).forEach(inp => { const name = inp.getAttribute('name'); if (!name) return; if (inp.type === 'checkbox' || inp.type === 'radio') { if (inp.checked) confirmPayload[name] = inp.value || 'on'; } else confirmPayload[name] = inp.value || ''; });
        const confirmBtn = confirmForm.querySelector('button[type="submit"], input[type="submit"], #troop_confirm_submit');
        if (confirmBtn) { const n = confirmBtn.getAttribute('name'); const v = confirmBtn.getAttribute('value') || ''; if (n) confirmPayload[n] = v; }
        const confirmBody = Object.entries(confirmPayload).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        let confirmUrl = confirmForm.getAttribute('action') || postRes.url || placeUrl;
        if (confirmUrl.startsWith('/')) confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;
        setStatus('⏳ Confirmando ataque...');
        const confirmRes = await fetch(confirmUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: confirmBody });
        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        const finalText = await confirmRes.text();
        if (isAttackConfirmed(finalText)) { setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`); return true; }
        setStatus(`⚠️ Confirmação inconclusiva`); return false;
      } else {
        if (isAttackConfirmed(postText)) { setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`); return true; }
        setStatus('⚠️ Resposta não indicou confirmação'); return false;
      }
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      setStatus(`❌ Erro: ${err.message}`);
      throw err;
    }
  }

  // -------------------------------
  // Utilities
  // -------------------------------
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // -------------------------------
  // Scheduler (melhorias: id pré-criação de _id, gravação em lote, respeito a abas ocultas)
  // -------------------------------
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);

    _schedulerInterval = setInterval(async () => {
      // Se a aba estiver oculta, não faça trabalho pesado: apenas atualize contagens/estado mínimo
      if (document.hidden) {
        // atualizar status mínimo
        const status = document.getElementById('tws-status'); if (status) status.innerHTML = 'Aba em segundo plano — scheduler pausado.';
        return;
      }

      // Use requestIdleCallback quando disponível para reduzir bloqueios
      const runner = async () => {
        const list = getList();
        const now = Date.now();
        const msgs = [];
        let hasChanges = false;
        const ataquesPorHorario = {};

        // 1) preparo: garanta que cada item que pode ser executado tenha _id já
        for (const a of list) {
          if (!a._id) { a._id = generateUniqueId(); hasChanges = true; }
        }

        // 2) identificar ataques a executar e mensagens de contagem
        for (const a of list) {
          if (a.done || a.locked) continue;

          // Proteção via BroadcastChannel: se outro processo pegou, pule
          if (attackCoordinator.isBeingProcessed(a._id)) { continue; }

          const t = parseDateTimeToMs(a.datetime);
          if (!t || isNaN(t)) continue;
          const diff = t - now;
          if (diff <= 0 && diff > -10000) { if (!ataquesPorHorario[a.datetime]) ataquesPorHorario[a.datetime] = []; ataquesPorHorario[a.datetime].push(a); }
          else if (diff > 0) {
            const seconds = Math.ceil(diff / 1000); const minutes = Math.floor(seconds / 60); const secs = seconds % 60; msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2,'0')}`);
          }
        }

        // 3) executar agrupamentos por horário
        for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {
          msgs.push(`🔥 Executando ${ataques.length} ataque(s) agendados para ${horario}...`);
          for (let i = 0; i < ataques.length; i++) {
            const a = ataques[i];

            // checar novamente
            if (attackCoordinator.isBeingProcessed(a._id)) continue;

            // notifica lock e atualiza estado local antes de executar
            attackCoordinator.notifyAttackStart(a._id);
            a.locked = true; hasChanges = true;

            try {
              const success = await executeAttack(a);
              a.done = true; a.success = success; a.executedAt = new Date().toISOString(); hasChanges = true;
            } catch (err) {
              a.error = err.message; a.done = true; a.success = false; hasChanges = true;
            } finally {
              attackCoordinator.notifyAttackEnd(a._id);
              a.locked = false; hasChanges = true;
            }

            // espaçamento curto entre ataques
            if (i < ataques.length - 1) await sleep(100);
          }
        }

        // 4) gravar alterações em lote (uma única chamada setList)
        if (hasChanges) setList(list);

        // 5) atualizar status
        const status = document.getElementById('tws-status'); if (status) status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      };

      if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(runner, { timeout: 500 });
      else runner();
    }, SCHEDULE_INTERVAL_MS);

    console.log('[TWS_Backend] Scheduler iniciado (v4)');
  }

  // -------------------------------
  // Importador de BBCode (melhorado)
  // -------------------------------
  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    for (const linha of linhas) {
      const coords = linha.match(/(\d{1,4}\|\d{1,4})/g) || [];
      const origem = coords[0] || '';
      const destino = coords[1] || '';
      const dataHora = linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)?.[1] || '';
      const url = linha.match(/\[url=(.*?)\]/)?.[1] || '';
      const params = {};
      if (url) {
        const query = url.split('?')[1];
        if (query) query.split('&').forEach(p => { const [k,v] = p.split('='); params[k] = decodeURIComponent(v || ''); });
      }
      const origemId = params.village || _villageMap[origem];
      const uniqueId = generateUniqueId();
      const cfg = { _id: uniqueId, origem, origemId, alvo: destino, datetime: dataHora, done: false, locked: false };
      TROOP_LIST.forEach(u => { cfg[u] = parseInt(params['att_' + u] || 0, 10) || 0; });
      if (origem && destino && dataHora) agendamentos.push(cfg);
    }
    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    return agendamentos;
  }

  // -------------------------------
  // Exportar API
  // -------------------------------
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

  console.log('[TWS_Backend] ✅ Backend v4 carregado (melhorias: locks, debounce, coord 0-999, auto-confirm robusto)');
})();
