(function () {
  'use strict';

  // === Configs / Constantes  ===
  const STORAGE_KEY = 'tw_scheduler_multi_v3';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  const AUTO_CONFIRM_TIMEOUT = 800; // ✅ AUMENTADO: 300ms → 800ms
  const ATTACK_EXECUTION_DELAY = 800; // ✅ NOVO: delay entre ataques
  const SCHEDULER_INTERVAL = 1500; // ms
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  let _schedulerLocked = false; // ✅ NOVO: Evita race condition no scheduler
  
  // ✅ PROTEÇÃO: Rastrear agendamentos em execução
  const _executing = new Set();
  
  // ✅ PROTEÇÃO: Rastrear ataques já processados (evita reprocessamento)
  const _processedAttacks = new Set();
  
  // ✅ NOVO: Contador global para IDs únicos
  let _idCounter = Date.now();

  // ✅ Mensagens de erro conhecidas do jogo
  const GAME_ERROR_PATTERNS = [
    /não há tropas suficientes/i,
    /no troops/i,
    /aldeia já está ocupada/i,
    /village already occupied/i,
    /alvo inválido/i,
    /invalid target/i,
    /você não pode atacar a sua própria aldeia/i,
    /cannot attack own village/i,
    /erro/i,
    /error/i,
    /falha/i,
    /failure/i
  ];

  // ✅ NOVO: Gerar ID único GARANTIDO (impossível colidir)
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

  // ✅ NOVO: Normalizar coordenadas (remove leading zeros, padroniza)
  function normalizeCoord(coord) {
    if (!coord) return null;
    const [x, y] = coord.split('|');
    if (!x || !y) return null;
    return `${parseInt(x, 10)}|${parseInt(y, 10)}`;
  }

  // ✅ NOVO: Detectar erros em respostas HTML
  function detectGameError(html) {
    if (!html) return null;
    
    for (const pattern of GAME_ERROR_PATTERNS) {
      if (pattern.test(html)) {
        return pattern.source;
      }
    }
    
    // ✅ Procura por div de erro específica
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const errorDiv = tempDiv.querySelector('[class*="error"], [id*="error"], .error-message');
    if (errorDiv && errorDiv.textContent.trim()) {
      return errorDiv.textContent.trim();
    }
    
    return null;
  }

  // ✅ NOVO: MutationObserver para auto-confirm (substituindo setTimeout)
  function setupAutoConfirmObserver() {
    if (!location.href.includes('screen=place&try=confirm')) return;

    console.log('[TWS_Backend] Configurando auto-confirm com MutationObserver...');
    
    const observer = new MutationObserver(() => {
      const btn = document.querySelector('#troop_confirm_submit') || 
                   document.querySelector('button[name="submit"], input[name="submit"][value*="confirm"]');
      
      if (btn && !btn.disabled) {
        console.log('[TWS_Backend] ✅ Botão de confirmação encontrado, clicando...');
        btn.click();
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled']
    });

    // Timeout de segurança: se não confirmar em 5s, desconecta observer
    setTimeout(() => {
      observer.disconnect();
      console.log('[TWS_Backend] ⚠️ Auto-confirm timeout (5s)');
    }, 5000);
  }

  // ✅ NOVO: Chamar observer ao carregar página
  try {
    setupAutoConfirmObserver();
  } catch (e) {
    console.error('[TWS_Backend] Erro no setupAutoConfirmObserver:', e);
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
    return /^\d{1,4}\|\d{1,4}$/.test(t) ? normalizeCoord(t) : null;
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

  // ✅ NOVO: Delay genérico
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        const coord = normalizeCoord(`${x}|${y}`);
        if (!coord) continue;
        
        map[coord] = id;
        
        if (playerId === (window.game_data?.player?.id || '').toString()) {
          const clean = decodeURIComponent((name || '').replace(/\+/g, ' '));
          myVillages.push({ id, name: clean, coord });
        }
      }
      
      _villageMap = map;
      _myVillages = myVillages;
      console.log(`[TWS_Backend] ✅ Carregadas ${myVillages.length} aldeias próprias (village.txt normalizado)`);
      return { map, myVillages };
    } catch (err) {
      console.error('[TWS_Backend] loadVillageTxt error:', err);
      return { map: {}, myVillages: [] };
    }
  }

  // === Busca tropas disponíveis em uma aldeia ===
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
      throw new Error(`Falha ao buscar tropas: ${err.message}`);
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

  // ✅ NOVO: Construir URL absoluta
  function buildAbsoluteUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${location.origin}${url}`;
    return `${location.origin}/game.php?${url}`;
  }

  // === Execute attack COM VALIDAÇÃO MELHORADA ===
  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try {
        if (statusEl) statusEl.innerHTML = msg;
      } catch {}
      console.log('[TWScheduler]', msg);
    };

    // Resolve origem
    const origem = normalizeCoord(cfg.origem);
    const origemId = cfg.origemId || _villageMap[origem] || null;
    if (!origemId) {
      setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada!`);
      throw new Error('Origem não encontrada');
    }

    const alvo = normalizeCoord(cfg.alvo);
    if (!alvo) {
      setStatus(`❌ Alvo inválido: ${cfg.alvo}`);
      throw new Error('Alvo inválido');
    }

    const [x, y] = alvo.split('|');

    // ✅ MELHORADO: Valida tropas com fallback melhor
    setStatus(`🔍 Verificando tropas disponíveis em ${origem}...`);
    let availableTroops;
    try {
      availableTroops = await getVillageTroops(origemId);
    } catch (err) {
      console.warn('[TWS_Backend] Falha ao obter tropas, continuando...', err);
      availableTroops = null;
    }

    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length > 0) {
        setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
        throw new Error('Tropas insuficientes');
      }
    } else {
      console.warn('[TWS_Backend] ⚠️ Não foi possível validar tropas, proceeding...');
    }

    const placeUrl = buildAbsoluteUrl(`?village=${origemId}&screen=place`);
    setStatus(`📤 Enviando ataque: ${origem} → ${alvo}...`);

    try {
      // 1) GET /place
      const getRes = await fetch(placeUrl, { credentials: 'same-origin' });
      if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
      
      const html = await getRes.text();
      
      // ✅ NOVO: Detectar erro na página inicial
      let gameError = detectGameError(html);
      if (gameError) {
        throw new Error(`Erro da página /place: ${gameError}`);
      }

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
      postUrl = buildAbsoluteUrl(postUrl);

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

      // ✅ NOVO: Detectar erro na resposta POST
      gameError = detectGameError(postText);
      if (gameError) {
        throw new Error(`Erro após POST: ${gameError}`);
      }

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
        confirmUrl = buildAbsoluteUrl(confirmUrl);

        setStatus('⏳ Confirmando ataque...');
        const confirmRes = await fetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: confirmBody
        });

        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        
        const confirmText = await confirmRes.text();
        
        // ✅ NOVO: Detectar erro na confirmação
        gameError = detectGameError(confirmText);
        if (gameError) {
          throw new Error(`Erro na confirmação: ${gameError}`);
        }
        
        setStatus(`✅ Ataque confirmado: ${origem} → ${alvo}`);
        console.log('[TWS_Backend] ✅ Ataque enviado e confirmado');
        return true;
      } else {
        setStatus(`✅ Ataque enviado: ${origem} → ${alvo}`);
        console.log('[TWS_Backend] ✅ Ataque enviado (sem confirmação)');
        return true;
      }
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      setStatus(`❌ Erro: ${err.message}`);
      throw err;
    }
  }

  // ✅ NOVO: Criar fingerprint único do ataque
  function getAttackFingerprint(a) {
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
  }

  // === Scheduler com proteção contra race condition ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      // ✅ NOVO: Proteção contra race condition
      if (_schedulerLocked) {
        console.log('[TWScheduler] ⏭️ Scheduler já em execução, pulando ciclo');
        return;
      }

      _schedulerLocked = true;

      try {
        const list = getList();
        const now = Date.now();
        const msgs = [];
        let hasChanges = false;

        // Processar TODOS os ataques do horário
        const ataquesParaExecutar = [];
        
        for (const a of list) {
          const fingerprint = getAttackFingerprint(a);
          if (_processedAttacks.has(fingerprint)) {
            continue;
          }
          
          if (a.done || a.locked) continue;
          
          const t = parseDateTimeToMs(a.datetime);
          if (!t || isNaN(t)) continue;
          
          const diff = t - now;
          
          if (diff <= 0 && diff > -300000) {
            ataquesParaExecutar.push(a);
          } else if (diff > 0) {
            const seconds = Math.ceil(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
          }
        }

        if (ataquesParaExecutar.length > 0) {
          console.log(`[TWScheduler] 🔥 Processando ${ataquesParaExecutar.length} ataques`);
          msgs.push(`🔥 Executando ${ataquesParaExecutar.length} ataque(s)...`);
          
          for (let i = 0; i < ataquesParaExecutar.length; i++) {
            const a = ataquesParaExecutar[i];
            const fingerprint = getAttackFingerprint(a);
            
            if (_processedAttacks.has(fingerprint)) {
              console.log(`[TWScheduler] ⏭️ Pulando ${fingerprint} (já processado)`);
              continue;
            }
            
            if (!a._id) {
              a._id = generateUniqueId();
              hasChanges = true;
            }
            
            if (_executing.has(a._id)) {
              console.log(`[TWScheduler] ⏭️ Pulando ${a._id} (já em execução)`);
              continue;
            }
            
            _processedAttacks.add(fingerprint);
            a.locked = true;
            hasChanges = true;
            setList(list);
            
            _executing.add(a._id);
            
            console.log(`[TWScheduler] 🚀 [${i + 1}/${ataquesParaExecutar.length}] Executando ${a._id}`);
            
            try {
              await executeAttack(a);
              a.done = true;
              a.success = true;
              a.executedAt = new Date().toISOString();
              hasChanges = true;
              
              console.log(`[TWScheduler] ✅ [${i + 1}/${ataquesParaExecutar.length}] Concluído: ${a._id}`);
            } catch (err) {
              a.error = err.message;
              a.done = true;
              a.success = false;
              hasChanges = true;
              console.error(`[TWScheduler] ❌ [${i + 1}/${ataquesParaExecutar.length}] Erro:`, err);
            } finally {
              a.locked = false;
              _executing.delete(a._id);
              hasChanges = true;
              console.log(`[TWScheduler] 🏁 [${i + 1}/${ataquesParaExecutar.length}] Finalizando ${a._id}`);
            }
            
            // ✅ MELHORADO: Delay aumentado
            if (i < ataquesParaExecutar.length - 1) {
              await sleep(ATTACK_EXECUTION_DELAY);
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
      } finally {
        _schedulerLocked = false;
      }
    }, SCHEDULER_INTERVAL);
  }

  // === Importar de BBCode ===
  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    
    for (const linha of linhas) {
      // Parse inteligente de coordenadas separadas por [|]
      const coordMatch = linha.match(/(\d{1,3}\|\d{1,3})\s*\[?\|?\]?\s*(\d{1,3}\|\d{1,3})/);
      const origem = normalizeCoord(coordMatch?.[1]);
      const destino = normalizeCoord(coordMatch?.[2]);
      
      if (!origem || !destino) continue;
      
      // Extrai data/hora no formato DD/MM/YYYY HH:MM:SS
      const dataHora = linha.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/)?.[1] || '';
      
      // Extrai URL com parâmetros
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
        console.log(`[TWS_Backend] ✅ Parsed: ${origem} → ${destino} em ${dataHora}`);
      }
    }
    
    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    console.log(`[TWS_Backend] IDs gerados:`, agendamentos.map(a => a._id.substring(0, 30) + '...'));
    
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
    getAttackFingerprint,
    normalizeCoord,
    detectGameError,
    buildAbsoluteUrl,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get executing() { return _executing; },
      get processedAttacks() { return _processedAttacks; },
      get schedulerLocked() { return _schedulerLocked; }
    }
  };

  console.log('[TWS_Backend] ✅ Backend v3.0 carregado com TODAS AS CORREÇÕES');
  console.log('[TWS_Backend] 🔧 Melhorias: detecção de erros, normalização coords, race condition protection');
})();
