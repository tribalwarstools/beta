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

  const _executing = new Set();
  const _processedAttacks = new Set();
  let _idCounter = Date.now();

  // ═════════════════════════════════════════════════════════
  // ✅ UTILITIES
  // ═════════════════════════════════════════════════════════

  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const timestamp = Date.now();
    const counter = ++_idCounter;
    const random = Math.random().toString(36).substr(2, 9);
    const perf = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now().toString(36) 
      : Math.random().toString(36).substr(2, 5);
    return `${timestamp}_${counter}_${random}_${perf}`;
  }

  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss = '00'] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function parseCoord(s) {
    if (!s) return null;
    const t = s.toString().trim();
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

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function safeTimeout(ms = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    return { controller, timeout };
  }

  async function safeFetch(url, options = {}, retries = 1) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fetch(url, options);
      } catch (e) {
        if (i === retries) throw e;
        await sleep(150);
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // ✅ VILLAGE LOADING
  // ═════════════════════════════════════════════════════════

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
        let availableEl = doc.querySelector(`#units_entry_all_${u}`) ||
                          doc.querySelector(`#units_home_${u}`) ||
                          doc.querySelector(`[id*="${u}"][class*="unit"]`);
        let available = 0;
        if (availableEl) {
          const txt = (availableEl.textContent || '').replace(/\./g,'').replace(/,/g,'').trim();
          const m = txt.match(/(\d+)/g);
          if (m) available = parseInt(m.join(''), 10);
        }
        troops[u] = available;
      });
      return troops;
    } catch (err) {
      console.error('[TWS_Backend] getVillageTroops error:', err);
      return null;
    }
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

  // ═════════════════════════════════════════════════════════
  // ✅ EXECUTE ATTACK
  // ═════════════════════════════════════════════════════════

  const ATTACK_TIMEOUT = 5000;

  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try { if (statusEl) statusEl.innerHTML = msg; } catch (e) { }
      console.log('[TWScheduler]', msg);
    };

    const origemId = cfg.origemId || _villageMap[cfg.origem];
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
    if (availableTroops && window.TWS_Validations) {
      const errors = window.TWS_Validations.validateTroops(cfg, availableTroops);
      if (errors.length) {
        setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
        cfg.status = 'no_troops';
        cfg.statusText = `Sem tropas: ${errors.slice(0, 2).join(', ')}`;
        throw new Error('Tropas insuficientes');
      }
    }

    const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
    try {
      const { controller: c1, timeout: t1 } = safeTimeout(ATTACK_TIMEOUT);
      const getRes = await safeFetch(placeUrl, { credentials: 'same-origin', signal: c1.signal });
      clearTimeout(t1);
      if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
      const html = await getRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let form = doc.querySelector('#command-data-form') || doc.querySelector('form[action*="screen=place"]') || doc.forms[0];
      if (!form) throw new Error('Form de envio não encontrado');

      const payloadObj = {};
      form.querySelectorAll('input, select, textarea').forEach(inp => {
        const name = inp.name;
        if (!name) return;
        if (inp.type === 'checkbox' || inp.type === 'radio') {
          if (inp.checked) payloadObj[name] = inp.value || 'on';
        } else {
          payloadObj[name] = inp.value || '';
        }
      });

      payloadObj['x'] = String(x);
      payloadObj['y'] = String(y);
      TROOP_LIST.forEach(u => payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0'));

      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        const n = submitBtn.name;
        const v = submitBtn.value || '';
        if (n) payloadObj[n] = v;
      }

      if (!payloadObj['x'] || !payloadObj['y']) throw new Error('Payload sem coordenadas.');
      if (Object.keys(payloadObj).length < 5) throw new Error('Payload incompleto.');

      const urlEncoded = Object.entries(payloadObj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      let postUrl = form.getAttribute('action') || placeUrl;
      if (postUrl.startsWith('/')) postUrl = `${location.protocol}//${location.host}${postUrl}`;

      setStatus(`⏳ Enviando comando...`);
      const { controller: c2, timeout: t2 } = safeTimeout(ATTACK_TIMEOUT);
      const postRes = await safeFetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        signal: c2.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache'
        },
        body: urlEncoded
      }, 1);
      clearTimeout(t2);
      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();
      const postDoc = parser.parseFromString(postText, 'text/html');

      let confirmForm = postDoc.querySelector('form[action*="try=confirm"]') || postDoc.querySelector('#command-data-form') || postDoc.forms[0];
      if (confirmForm) {
        const confirmPayload = {};
        confirmForm.querySelectorAll('input, select, textarea').forEach(inp => {
          const name = inp.name;
          if (!name) return;
          if (inp.type === 'checkbox' || inp.type === 'radio') {
            if (inp.checked) confirmPayload[name] = inp.value || 'on';
          } else {
            confirmPayload[name] = inp.value || '';
          }
        });

        const btn = confirmForm.querySelector('#troop_confirm_submit, button[type="submit"], input[type="submit"]');
        if (btn) {
          const n = btn.name;
          const v = btn.value || '';
          if (n) confirmPayload[n] = v;
        }

        if (Object.keys(confirmPayload).length < 5) throw new Error('Confirm payload incompleto.');

        const confirmEncoded = Object.entries(confirmPayload).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        let confirmUrl = confirmForm.getAttribute('action') || postRes.url || placeUrl;
        if (confirmUrl.startsWith('/')) confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;

        setStatus('⏳ Confirmando ataque...');
        const { controller: c3, timeout: t3 } = safeTimeout(ATTACK_TIMEOUT);
        const confirmRes = await safeFetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          signal: c3.signal,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache'
          },
          body: confirmEncoded
        }, 1);
        clearTimeout(t3);
        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        const finalText = await confirmRes.text();
        if (isAttackConfirmed(finalText)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        }
      }

      if (isAttackConfirmed(postText)) {
        setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
        return true;
      }
      
      setStatus('⚠️ Resposta não indicou confirmação.');
      return false;
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      setStatus(`❌ Erro: ${err.message}`);
      throw err;
    }
  }

  // ═════════════════════════════════════════════════════════
  // ✅ STORAGE
  // ═════════════════════════════════════════════════════════

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

  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    for (const linha of linhas) {
      const coords = linha.match(/(\d{1,4}\|\d{1,4})/g) || [];
      const origem = coords[0] || '';
      const destino = coords[1] || '';
      const dataHora = linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}(?::\d{2})?)/)?.[1] || '';
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
      const cfg = {
        _id: generateUniqueId(),
        origem,
        origemId,
        alvo: destino,
        datetime: dataHora,
        done: false,
        locked: false,
        status: 'scheduled',
        statusText: 'Agendado'
      };
      TROOP_LIST.forEach(u => cfg[u] = Number(params['att_' + u] || 0));
      if (origem && destino && dataHora) agendamentos.push(cfg);
    }
    return agendamentos;
  }

  // ═════════════════════════════════════════════════════════
  // ✅ SCHEDULER
  // ═════════════════════════════════════════════════════════

  const _processedAttacksWithTTL = new Map();
  const PROCESSED_ATTACKS_TTL = 86400000;

  function cleanupProcessedAttacks() {
    const now = Date.now();
    let cleaned = 0;
    for (const [timestamp] of _processedAttacksWithTTL.entries()) {
      if (now - timestamp > PROCESSED_ATTACKS_TTL) {
        _processedAttacksWithTTL.delete(timestamp);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[Scheduler] Limpeza: ${cleaned} fingerprints antigos removidos`);
  }

  function markAttackProcessed(fingerprint) {
    _processedAttacksWithTTL.set(Date.now(), fingerprint);
  }

  const SchedulerMetrics = {
    cycleStart: null,
    cycleEnd: null,
    executionsThisCycle: 0,
    successCount: 0,
    failureCount: 0,
    lastCycleDuration: 0,

    start() {
      this.cycleStart = Date.now();
      this.executionsThisCycle = 0;
      this.successCount = 0;
      this.failureCount = 0;
    },

    recordExecution(success) {
      this.executionsThisCycle++;
      if (success) this.successCount++;
      else this.failureCount++;
    },

    end() {
      this.cycleEnd = Date.now();
      this.lastCycleDuration = this.cycleEnd - this.cycleStart;
      if (this.executionsThisCycle > 0) {
        const taxa = ((this.successCount / this.executionsThisCycle) * 100).toFixed(1);
        console.log(`[Scheduler] Ciclo: ${this.executionsThisCycle} exec | ${this.successCount}✅ ${this.failureCount}❌ | ${taxa}% sucesso | ${this.lastCycleDuration}ms`);
      }
    },

    getStats() {
      return {
        lastCycleDuration: this.lastCycleDuration,
        successCount: this.successCount,
        failureCount: this.failureCount,
        successRate: this.executionsThisCycle > 0 ? ((this.successCount / this.executionsThisCycle) * 100).toFixed(1) : 0
      };
    }
  };

  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    let cleanupCounter = 0;
    
    _schedulerInterval = setInterval(async () => {
      SchedulerMetrics.start();
      const list = getList();
      const now = Date.now();
      const ataquesPorHorario = {};

      for (const a of list) {
        if (a.locked || a.done) continue;
        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        const diff = t - now;
        if (diff <= 0 && diff > -10000) {
          if (!ataquesPorHorario[a.datetime]) ataquesPorHorario[a.datetime] = [];
          ataquesPorHorario[a.datetime].push(a);
        }
      }

      let needsSave = false;
      const ataquesPendentes = Object.values(ataquesPorHorario).flat();
      if (ataquesPendentes.length > 0) {
        ataquesPendentes.forEach(a => {
          if (!_executing.has(a._id)) {
            a.locked = true;
            a.status = 'executing';
            a.statusText = 'Enviando...';
            a.executedAt = new Date().toISOString();
            _executing.add(a._id);
            needsSave = true;
          }
        });
        if (needsSave) setList(list);
      }

      for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {
        if (ataques.length > 0) {
          const executionPromises = ataques.map(a => (async () => {
            if (a.done) return { attack: a, success: false, skipped: true };
            const fingerprint = window.TWS_Validations ? window.TWS_Validations.getAttackFingerprint(a) : null;
            
            try {
              const success = await executeAttack(a);
              a.done = true;
              a.success = success;
              
              if (success) {
                if (fingerprint) markAttackProcessed(fingerprint);
                a.status = 'sent';
                a.statusText = '✅ Enviado';
                SchedulerMetrics.recordExecution(true);
              } else {
                a.status = 'failed';
                a.statusText = '❌ Falhou (verificar manualmente)';
                SchedulerMetrics.recordExecution(false);
              }
              return { attack: a, success: success };
            } catch (err) {
              a.done = true;
              a.success = false;
              a.error = err.message;
              a.status = 'failed';
              a.statusText = `❌ Falha: ${err.message}`;
              SchedulerMetrics.recordExecution(false);
              console.error(`[Scheduler] Erro ao executar ${a.origem}→${a.alvo}:`, err.message);
              return { attack: a, success: false, error: err.message };
            } finally {
              a.locked = false;
              _executing.delete(a._id);
            }
          })());

          await Promise.allSettled(executionPromises);
          setList(list);
        }
      }

      cleanupCounter++;
      if (cleanupCounter >= 21600) {
        cleanupProcessedAttacks();
        cleanupCounter = 0;
      }

      SchedulerMetrics.end();
    }, 1000);

    console.log('[Scheduler] ✅ Iniciado (v2.0 - Com validações externas)');
  }

  // ═════════════════════════════════════════════════════════
  // ✅ DEBUG & EXPORT
  // ═════════════════════════════════════════════════════════

  function getSchedulerStats() {
    return {
      executingCount: _executing.size,
      processedCount: _processedAttacksWithTTL.size,
      metrics: SchedulerMetrics.getStats()
    };
  }

  function dumpSchedulerState() {
    const stats = getSchedulerStats();
    console.table({
      'Em Execução': stats.executingCount,
      'Processados (24h)': stats.processedCount,
      'Taxa de Sucesso': `${stats.metrics.successRate}%`,
      'Último Ciclo': `${stats.metrics.lastCycleDuration}ms`
    });
  }

  window.TWS_SchedulerDebug = {
    getStats: getSchedulerStats,
    dumpState: dumpSchedulerState,
    getMetrics: () => SchedulerMetrics,
    clearProcessed: () => _processedAttacksWithTTL.clear()
  };

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
    generateUniqueId,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get executing() { return _executing; }
    }
  };

  console.log('[TWS_Backend] Backend carregado - Validações delegadas ao módulo separado');
})();
