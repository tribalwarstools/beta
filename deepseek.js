(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  // ✅ CORREÇÃO: Configurações de segurança
  const SCHEDULER_CONFIG = {
    INTERVAL: 1500,
    EXECUTION_WINDOW: 300000, // 5 minutos
    MAX_RETRIES: 2,
    REQUEST_TIMEOUT: 30000,
    DELAY_BETWEEN_ATTACKS: 1000,
    MAX_PROCESSED_ATTACKS: 1000 // Previne memory leak
  };

  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ✅ CORREÇÃO: Rastrear agendamentos em execução
  const _executing = new Set();
  
  // ✅ CORREÇÃO: Rastrear ataques já processados com limite
  const _processedAttacks = new Set();
  
  // ✅ CORREÇÃO: Contador global para IDs únicos
  let _idCounter = Date.now();

  // ✅ CORREÇÃO: Gerar ID único
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

  // ✅ CORREÇÃO: Auto-confirm melhorado
  try {
    if (location.href.includes('screen=place&try=confirm')) {
      const btn = document.querySelector('#troop_confirm_submit') || 
                   document.querySelector('button[name="submit"], input[name="submit"]');
      if (btn) {
        console.log('[TWS_Backend] Auto-confirmando ataque...');
        setTimeout(() => {
          if (btn && !btn.disabled) {
            btn.click();
          }
        }, 500);
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

  // ✅ CORREÇÃO: Cleanup processed attacks para prevenir memory leak
  function cleanupProcessedAttacks() {
    if (_processedAttacks.size > SCHEDULER_CONFIG.MAX_PROCESSED_ATTACKS) {
      const array = Array.from(_processedAttacks);
      const toRemove = array.slice(0, array.length - SCHEDULER_CONFIG.MAX_PROCESSED_ATTACKS / 2);
      toRemove.forEach(key => _processedAttacks.delete(key));
      console.log(`[TWScheduler] Cleanup: removidos ${toRemove.length} ataques processados`);
    }
  }

  // === Carrega village.txt ===
  async function loadVillageTxt() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCHEDULER_CONFIG.REQUEST_TIMEOUT);
      
      const res = await fetch(VILLAGE_TXT_URL, { 
        credentials: 'same-origin',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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

  // === Busca tropas disponíveis em uma aldeia ===
  async function getVillageTroops(villageId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCHEDULER_CONFIG.REQUEST_TIMEOUT);
      
      const placeUrl = `${location.protocol}//${location.host}/game.php?village=${villageId}&screen=place`;
      const res = await fetch(placeUrl, { 
        credentials: 'same-origin',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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

  // ✅ CORREÇÃO: Execute attack com timeout e retry
  async function executeAttack(cfg, retryCount = 0) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try {
        if (statusEl) statusEl.innerHTML = msg;
      } catch {}
      console.log('[TWScheduler]', msg);
    };

    // Resolve origem
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

    // Valida tropas disponíveis
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
      // 1) GET /place com timeout
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), SCHEDULER_CONFIG.REQUEST_TIMEOUT);
      
      const getRes = await fetch(placeUrl, { 
        credentials: 'same-origin',
        signal: getController.signal
      });
      
      clearTimeout(getTimeoutId);
      
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

      // 8) POST inicial com timeout
      setStatus(`⏳ Enviando comando...`);
      
      const postController = new AbortController();
      const postTimeoutId = setTimeout(() => postController.abort(), SCHEDULER_CONFIG.REQUEST_TIMEOUT);
      
      const postRes = await fetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: urlEncoded,
        signal: postController.signal
      });
      
      clearTimeout(postTimeoutId);
      
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
        
        const confirmController = new AbortController();
        const confirmTimeoutId = setTimeout(() => confirmController.abort(), SCHEDULER_CONFIG.REQUEST_TIMEOUT);
        
        const confirmRes = await fetch(confirmUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: confirmBody,
          signal: confirmController.signal
        });

        clearTimeout(confirmTimeoutId);

        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
        
        setStatus(`✅ Ataque processado: ${cfg.origem} → ${cfg.alvo}`);
        console.log('[TWS_Backend] Ataque enviado com sucesso');
        return true;
      } else {
        setStatus(`✅ Ataque processado: ${cfg.origem} → ${cfg.alvo}`);
        console.log('[TWS_Backend] Ataque enviado (sem confirmação necessária)');
        return true;
      }
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      
      // ✅ CORREÇÃO: Tentar novamente se não excedeu o limite
      if (retryCount < SCHEDULER_CONFIG.MAX_RETRIES) {
        setStatus(`🔄 Tentativa ${retryCount + 1}/${SCHEDULER_CONFIG.MAX_RETRIES + 1}...`);
        await sleep(1000 * (retryCount + 1));
        return executeAttack(cfg, retryCount + 1);
      }
      
      setStatus(`❌ Erro após ${SCHEDULER_CONFIG.MAX_RETRIES + 1} tentativas: ${err.message}`);
      throw err;
    }
  }

  // ✅ CORREÇÃO: Delay entre execuções
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ CORREÇÃO: Criar fingerprint único do ataque
  function getAttackFingerprint(a) {
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
  }

  // ✅ CORREÇÃO: Scheduler revisado
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      // ✅ CORREÇÃO: Cleanup periódico
      cleanupProcessedAttacks();
      
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      const ataquesParaExecutar = [];
      
      for (const a of list) {
        // ✅ CORREÇÃO: Pular se já foi processado com sucesso
        const fingerprint = getAttackFingerprint(a);
        if (_processedAttacks.has(fingerprint)) {
          continue;
        }
        
        // ✅ CORREÇÃO: Não processar se já está feito ou travado
        if (a.done || a.locked) continue;
        
        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        
        const diff = t - now;
        
        // ✅ CORREÇÃO: Janela de execução mais restrita
        if (diff <= 0 && diff > -SCHEDULER_CONFIG.EXECUTION_WINDOW) {
          ataquesParaExecutar.push(a);
        } else if (diff > 0) {
          const seconds = Math.ceil(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        } else if (diff <= -SCHEDULER_CONFIG.EXECUTION_WINDOW) {
          // ✅ CORREÇÃO: Marcar como expirado para não reprocessar
          a.done = true;
          a.success = false;
          a.error = 'Expirado - fora da janela de execução';
          hasChanges = true;
          _processedAttacks.add(fingerprint);
        }
      }

      // ✅ CORREÇÃO: Processar ataques com controle de concorrência
      if (ataquesParaExecutar.length > 0) {
        console.log(`[TWScheduler] 🔥 Processando ${ataquesParaExecutar.length} ataques`);
        msgs.push(`🔥 Executando ${ataquesParaExecutar.length} ataque(s)...`);
        
        for (let i = 0; i < ataquesParaExecutar.length; i++) {
          const a = ataquesParaExecutar[i];
          
          const fingerprint = getAttackFingerprint(a);
          
          // ✅ CORREÇÃO: Verificação dupla
          if (_processedAttacks.has(fingerprint) || a.done || a.locked) {
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
          
          // ✅ CORREÇÃO: Marcar como processado ANTES de executar
          _processedAttacks.add(fingerprint);
          a.locked = true;
          a.retryCount = (a.retryCount || 0) + 1;
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
            // ✅ CORREÇÃO: Só marca como done se excedeu as tentativas
            if ((a.retryCount || 0) >= SCHEDULER_CONFIG.MAX_RETRIES + 1) {
              a.done = true;
              a.success = false;
            } else {
              a.locked = false;
              _processedAttacks.delete(fingerprint); // Permite retry
            }
            hasChanges = true;
            console.error(`[TWScheduler] ❌ [${i + 1}/${ataquesParaExecutar.length}] Erro:`, err);
          } finally {
            _executing.delete(a._id);
            hasChanges = true;
            console.log(`[TWScheduler] 🏁 [${i + 1}/${ataquesParaExecutar.length}] Finalizando ${a._id}`);
          }
          
          // ✅ CORREÇÃO: Delay entre execuções
          if (i < ataquesParaExecutar.length - 1) {
            await sleep(SCHEDULER_CONFIG.DELAY_BETWEEN_ATTACKS);
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
    }, SCHEDULER_CONFIG.INTERVAL);
  }

  // === Importar de BBCode ===
  function importarDeBBCode(bbcode) {
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    const agendamentos = [];
    
    for (const linha of linhas) {
      const coordMatch = linha.match(/(\d{1,3}\|\d{1,3})\s*\[?\|?\]?\s*(\d{1,3}\|\d{1,3})/);
      const origem = coordMatch?.[1] || '';
      const destino = coordMatch?.[2] || '';
      
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
        locked: false,
        retryCount: 0
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

  console.log('[TWS_Backend] Backend carregado com sucesso (v2.6 - CORRIGIDO)');
})();
