(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v3';
  const PANEL_STATE_KEY = 'tws_panel_state_v3';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;

  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;

  // Proteções / Estados
  const _executing = new Set();         // ids em execução (mutex)
  const _processedAttacks = new Set(); // fingerprints processados com sucesso
  let _idCounter = Date.now();         // contador auxiliar para ids

  // === Utilitários ===
  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const timestamp = Date.now();
    const counter = ++_idCounter;
    const random = Math.random().toString(36).substr(2, 9);
    const perf = (typeof performance !== 'undefined' && performance.now)
      ? Math.floor(performance.now()).toString(36)
      : Math.random().toString(36).substr(2, 5);
    return `${timestamp}_${counter}_${random}_${perf}`;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function parseCoord(s) {
    if (!s) return null;
    const t = s.trim();
    return /^\d{1,4}\|\d{1,4}$/.test(t) ? t : null;
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

  // === Busca tropas disponíveis em uma aldeia (mais robusto) ===
  async function getVillageTroops(villageId) {
    try {
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place`;
      const res = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao carregar /place: ' + res.status);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const troops = {};

      // Tenta vários seletores possíveis para compatibilidade entre mundos/skins
      TROOP_LIST.forEach(u => {
        troops[u] = 0;
        // 1) seletor padrão de units_entry_all
        let el = doc.querySelector(`#units_entry_all_${u}`) || doc.querySelector(`#units_home_${u}`);
        if (!el) {
          // 2) procura por entrada com id contendo o nome da tropa
          el = Array.from(doc.querySelectorAll('[id]')).find(n => n.id && n.id.includes(u) && /unit/.test(n.className || ''));
        }
        if (!el) {
          // 3) procura por contagem textual em tabelas de tropas
          const textNode = Array.from(doc.querySelectorAll('*')).find(n => n.textContent && new RegExp(`\\b${u}\\b`, 'i').test(n.textContent));
          el = textNode || null;
        }

        if (el) {
          const match = (el.textContent || '').match(/(\d[\d\.\,]*)/);
          if (match) {
            // remove pontos de milhar e vírgula decimal
            const raw = match[1].replace(/\./g, '').replace(/,/g, '');
            troops[u] = parseInt(raw, 10) || 0;
          }
        }
      });

      console.log(`[TWS_Backend] Tropas da aldeia ${villageId}:`, troops);
      return troops;
    } catch (err) {
      console.error('[TWS_Backend] getVillageTroops error:', err);
      return null;
    }
  }

  // === Valida se há tropas suficientes ===
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

  // === Fingerprint de ataque para evitar duplicatas ===
  function getAttackFingerprint(a) {
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
  }

  // === Envia ataque (robusto, marca processed APÓS sucesso) ===
  async function executeAttack(cfg, opts = { validateResponses: true }) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => { try { if (statusEl) statusEl.innerHTML = msg; } catch {} console.log('[TWScheduler]', msg); };

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
    setStatus(`📤 Preparando ataque: ${cfg.origem} → ${cfg.alvo}...`);

    // 1) GET /place
    const getRes = await fetch(placeUrl, { credentials: 'same-origin' });
    if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
    const html = await getRes.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 2) Detecta o form de forma robusta
    let form = doc.querySelector('#command-data-form')
      || doc.querySelector('form[action*="mode=command"]')
      || Array.from(doc.querySelectorAll('form')).find(f => (f.action && f.action.includes('screen=place')));

    if (!form) {
      // fallback heurístico
      form = Array.from(doc.querySelectorAll('form')).find(f => f.querySelector('input[name="x"]') || f.querySelector('input[name="target_x"]') || TROOP_LIST.some(u => f.querySelector(`input[name="${u}"]`)));
    }

    if (!form) throw new Error('Form de envio não encontrado');

    // 3) Constrói payload inicial com os campos existentes do form (mantendo campos extras)
    const payloadObj = {};
    Array.from(form.querySelectorAll('input, select, textarea')).forEach(inp => {
      const name = inp.getAttribute('name');
      if (!name) return;

      if ((inp.type === 'checkbox' || inp.type === 'radio')) {
        if (inp.checked) payloadObj[name] = inp.value || 'on';
      } else {
        payloadObj[name] = inp.value || '';
      }
    });

    // 4) Sobrescreve destino (vários nomes possíveis) e tropas — apenas os campos necessários
    if ('x' in payloadObj || form.querySelector('input[name="x"]')) payloadObj['x'] = String(x);
    if ('y' in payloadObj || form.querySelector('input[name="y"]')) payloadObj['y'] = String(y);
    if ('target_x' in payloadObj || form.querySelector('input[name="target_x"]')) payloadObj['target_x'] = String(x);
    if ('target_y' in payloadObj || form.querySelector('input[name="target_y"]')) payloadObj['target_y'] = String(y);

    TROOP_LIST.forEach(u => {
      // só escreve se o campo existe no formulário ou for explicitamente passado
      if (form.querySelector(`input[name="${u}"]`) || cfg[u] !== undefined) {
        payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0');
      }
    });

    // 5) Substitui botão submit caso exista
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

    // 7) Resolve postUrl
    let postUrl = form.getAttribute('action') || placeUrl;
    if (postUrl.startsWith('/')) postUrl = `${location.protocol}//${location.host}${postUrl}`;
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

    // validações básicas de resposta (palavras-chave do TW que indicam erro)
    if (opts.validateResponses) {
      const lower = postText.toLowerCase();
      const blockedPhrases = ['session expired', 'sessão expirada', 'não foi possível', 'você não pode', 'impossible', 'failed'];
      for (const p of blockedPhrases) if (lower.includes(p)) throw new Error('TW rejeitou o comando: ' + p);
    }

    // 9) Procura form de confirmação
    const postDoc = parser.parseFromString(postText, 'text/html');
    let confirmForm = postDoc.querySelector('#command-confirm-form')
      || Array.from(postDoc.querySelectorAll('form')).find(f => (f.action && /try=confirm|confirm/i.test(f.action)) || f.querySelector('#troop_confirm_submit'));

    if (confirmForm) {
      // constrói confirmPayload a partir do form
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

      const confirmBody = Object.entries(confirmPayload)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      let confirmUrl = confirmForm.getAttribute('action') || postRes.url || placeUrl;
      if (confirmUrl.startsWith('/')) confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;

      setStatus('⏳ Confirmando ataque...');
      const confirmRes = await fetch(confirmUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: confirmBody
      });

      if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);

      const confirmText = await confirmRes.text();
      if (opts.validateResponses) {
        const lower = confirmText.toLowerCase();
        const blockedPhrases = ['session expired', 'sessão expirada', 'não foi possível', 'você não pode', 'impossible', 'failed'];
        for (const p of blockedPhrases) if (lower.includes(p)) throw new Error('TW rejeitou confirmação: ' + p);
      }

      setStatus(`✅ Ataque confirmado: ${cfg.origem} → ${cfg.alvo}`);
      return { success: true, detail: 'confirmado' };
    }

    // Se não houver confirmação — tenta inferir sucesso da resposta
    setStatus(`✅ Ataque processado (sem confirmação disponível): ${cfg.origem} → ${cfg.alvo}`);
    return { success: true, detail: 'no_confirm_form' };
  }

  // === Scheduler robusto ===
  function startScheduler(options = { intervalMs: 1500, windowMs: 300000 }) {
    const intervalMs = options.intervalMs || 1500; // frequência do check
    const windowMs = options.windowMs || 300000;   // janela posterior aceitável

    if (_schedulerInterval) clearInterval(_schedulerInterval);

    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      // Colete ataques que estão prontos para execução
      const ready = [];

      for (const a of list) {
        if (a.done || a.locked) continue;

        // assegura _id
        if (!a._id) { a._id = generateUniqueId(); hasChanges = true; }

        const fingerprint = getAttackFingerprint(a);
        if (_processedAttacks.has(fingerprint)) continue; // já executado com sucesso

        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;

        const diff = t - now;
        if (diff <= 0 && diff > -windowMs) {
          ready.push(a);
        } else if (diff > 0) {
          const seconds = Math.ceil(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        }
      }

      if (ready.length > 0) {
        msgs.push(`🔥 Executando ${ready.length} ataque(s)...`);

        // percorre em sequência para reduzir corrida de DOM e detectar erros individualmente
        for (let i = 0; i < ready.length; i++) {
          const a = ready[i];
          const fingerprint = getAttackFingerprint(a);

          // Mutex por _id
          if (_executing.has(a._id)) { console.log('[TWScheduler] ⏭️ Já em execução:', a._id); continue; }

          // marca locked no objeto e salva imediatamente (atomicidade simples)
          a.locked = true;
          hasChanges = true;
          setList(list);

          _executing.add(a._id);
          console.log(`[TWScheduler] 🚀 [${i + 1}/${ready.length}] Iniciando ${a._id}`);

          try {
            const res = await executeAttack(a);
            // marca processed APÓS confirmação de sucesso
            if (res && res.success) {
              _processedAttacks.add(fingerprint);
              a.done = true;
              a.success = true;
              a.executedAt = new Date().toISOString();
            } else {
              // considera falha se não retornou sucesso verdadeiro
              a.done = true;
              a.success = false;
              a.error = 'Resposta do executeAttack sem sucesso';
            }

            console.log(`[TWScheduler] ✅ [${i + 1}/${ready.length}] Concluído: ${a._id}`);
          } catch (err) {
            a.error = err?.message || String(err);
            a.done = true;
            a.success = false;
            console.error(`[TWScheduler] ❌ [${i + 1}/${ready.length}] Erro:`, err);
          } finally {
            // sempre limpa locks/exec
            a.locked = false;
            _executing.delete(a._id);
            hasChanges = true;
            // salva imediatamente para minimizar perda de estado
            setList(list);
            console.log(`[TWScheduler] 🏁 [${i + 1}/${ready.length}] Finalizado: ${a._id}`);
          }

          // pequeno delay entre ataques para evitar rate limits
          if (i < ready.length - 1) await sleep(500);
        }
      }

      if (hasChanges) setList(list);

      const status = document.getElementById('tws-status');
      if (status) {
        status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      }

    }, intervalMs);

    console.log('[TWScheduler] Scheduler iniciado (v3)');
  }

  // === Importar de BBCode (mais seguro) ===
  function importarDeBBCode(bbcode) {
    if (!bbcode) return [];
    const linhas = bbcode.split('[*]').map(s => s.trim()).filter(Boolean);
    const agendamentos = [];

    for (const linha of linhas) {
      // Tenta extrair origem/destino com formatos típicos, procura por coordenadas explícitas
      const coordPairs = Array.from(linha.matchAll(/(\d{1,4}\|\d{1,4})/g)).map(m => m[1]);
      const origem = coordPairs[0] || '';
      const destino = coordPairs[1] || '';

      // Data/hora no formato DD/MM/YYYY HH:MM:SS
      const dataHora = linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)?.[1] || '';

      // Extrai URL e parâmetros se houver
      const url = linha.match(/\[url=(.*?)\]/)?.[1] || '';
      const params = {};
      if (url && url.includes('?')) {
        const query = url.split('?')[1] || '';
        query.split('&').forEach(p => {
          const [k, v] = p.split('=');
          if (!k) return;
          params[k] = decodeURIComponent((v || '').replace(/\+/g, ' '));
        });
      }

      const origemId = params.village || _villageMap[origem] || undefined;

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
        const p = params['att_' + u];
        cfg[u] = p !== undefined ? (isNaN(Number(p)) ? 0 : Number(p)) : 0;
      });

      if (origem && destino && dataHora) {
        agendamentos.push(cfg);
        console.log(`[TWS_Backend] Parsed: ${origem} → ${destino} em ${dataHora}`);
      } else {
        console.log('[TWS_Backend] Linha ignorada (faltando dados):', linha);
      }
    }

    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    return agendamentos;
  }

  // === Auto-confirm na página de confirmação (com pequena melhoria) ===
  try {
    if (location.href.includes('screen=place&try=confirm') || /try=confirm/.test(location.href)) {
      const btn = document.querySelector('#troop_confirm_submit') || document.querySelector('button[name="submit"], input[name="submit"]');
      if (btn) {
        console.log('[TWS_Backend] Auto-confirmando ataque...');
        setTimeout(() => btn.click(), 300);
      }
    }
  } catch (e) { console.error('[TWS_Backend] Erro no auto-confirm:', e); }

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
    getAttackFingerprint,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,

    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get executing() { return _executing; },
      get processedAttacks() { return _processedAttacks; }
    }
  };

  console.log('[TWS_Backend] Backend carregado com sucesso (v3 - Correções e robustez)');
})();
