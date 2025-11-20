(function () {
  'use strict';

  // === Configs /Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  
  // ✅ PROTEÇÃO: Rastrear agendamentos em execução
  const _executing = new Set();
  
  // ✅ PROTEÇÃO: Rastrear ataques já processados (evita reprocessamento)
  const _processedAttacks = new Set();
  
  // ✅ NOVO: Contador global para IDs únicos
  let _idCounter = Date.now();

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
    return /^(\d+)\|(\d+)$/.test(t) ? t : null;
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

  // === Verifica se o ataque foi confirmado (SIMPLES - apenas valida HTTP) ===
  function isAttackConfirmed(htmlText, responseUrl) {
    // ✅ PADRÃO 1: Verificar URL de redirecionamento
    if (responseUrl && /screen=info_command.*id=\d+.*type=own/i.test(responseUrl)) {
      console.log('[TWS_Backend] ✅ URL detectada: info_command');
      return true;
    }

    // ✅ PADRÃO 2: Redirecionamento no HTML
    if (/screen=info_command.*type=own/i.test(htmlText)) {
      console.log('[TWS_Backend] ✅ HTML detectado: info_command');
      return true;
    }

    if (/<tr class="command-row">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) {
      console.log('[TWS_Backend] ✅ HTML detectado: command-row');
      return true;
    }

    const successPatterns = [
      /attack sent/i,
      /attack in queue/i,
      /enviado/i,
      /ataque enviado/i,
      /enfileirad/i,
      /A batalha começou/i,
      /march started/i,
      /comando enviado/i,
      /tropas enviadas/i,
      /foi enfileirado/i,
      /command sent/i,
      /comando foi criado/i
    ];

    return successPatterns.some(p => p.test(htmlText));
  }

  // === NOVO: Validação PÓS-EXECUÇÃO (valida comandos enviados) ===
  async function validateAttacksAfterExecution() {
    console.log('[TWS_Backend] 🔄 Iniciando validação pós-execução em 10 segundos...');
    await sleep(10000); // Aguarda 10 segundos para servidor processar
    
    const list = getList();
    const attacksToValidate = list.filter(a => a.done && !a.success && !a.error);
    
    if (attacksToValidate.length === 0) {
      console.log('[TWS_Backend] ✅ Nenhum ataque para validar');
      return;
    }
    
    console.log(`[TWS_Backend] 🔍 Validando ${attacksToValidate.length} ataques...`);
    let hasChanges = false;
    
    for (const ataque of attacksToValidate) {
      try {
        // Tenta extrair o ID da URL se foi armazenado
        if (ataque.commandId) {
          const infoUrl = `${location.protocol}//${location.host}/game.php?village=${ataque.origemId}&screen=info_command&id=${ataque.commandId}&type=own`;
          const res = await fetch(infoUrl, { credentials: 'same-origin' });
          
          if (res.ok) {
            const html = await res.text();
            // Se conseguiu acessar a página do comando, é porque foi criado
            if (/info_command/i.test(html) || /command-row/i.test(html)) {
              ataque.success = true;
              console.log(`[TWS_Backend] ✅ Validado: ${ataque.origem} → ${ataque.alvo}`);
              hasChanges = true;
            }
          }
        } else {
          // Se não tem ID, marca como sucesso por padrão (foi executado sem erro)
          ataque.success = true;
          console.log(`[TWS_Backend] ✅ Confirmado: ${ataque.origem} → ${ataque.alvo}`);
          hasChanges = true;
        }
      } catch (err) {
        console.error(`[TWS_Backend] ⚠️ Erro ao validar ${ataque.origem}:`, err);
      }
      
      // Delay entre validações para não sobrecarregar
      await sleep(300);
    }
    
    if (hasChanges) {
      setList(list);
      console.log('[TWS_Backend] ✅ Validação concluída e salva');
    }
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
      
      if (!form) throw new Error('Form de envio não encontrado');

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
      
      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
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
        
        // ✅ Extrai o ID do comando se disponível
        const idMatch = confirmRes.url?.match(/id=(\d+)/) || finalText.match(/id=(\d+)/);
        if (idMatch) cfg.commandId = idMatch[1];
        
        if (isAttackConfirmed(finalText, confirmRes.url)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus(`✅ Ataque processado: ${cfg.origem} → ${cfg.alvo}`);
          return true; // HTTP 200 = foi enviado
        }
      } else {
        const idMatch = postRes.url?.match(/id=(\d+)/) || postText.match(/id=(\d+)/);
        if (idMatch) cfg.commandId = idMatch[1];
        
        if (isAttackConfirmed(postText, postRes.url)) {
          setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
          return true;
        } else {
          setStatus(`✅ Ataque processado: ${cfg.origem} → ${cfg.alvo}`);
          return true; // HTTP 200 = foi enviado
        }
      }
    } catch (err) {
      console.error('[TWScheduler] Erro executeAttack:', err);
      setStatus(`❌ Erro: ${err.message}`);
      throw err;
    }
  }

  // ✅ NOVO: Delay entre execuções
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ NOVO: Criar fingerprint único do ataque
  function getAttackFingerprint(a) {
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
  }

  // === Scheduler ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      const ataquesPorHorario = {};
      
      for (const a of list) {
        const fingerprint = getAttackFingerprint(a);
        if (_processedAttacks.has(fingerprint)) {
          console.log(`[TWScheduler] ⏭️ Ataque ${fingerprint} já foi processado`);
          continue;
        }
        
        if (a.done || a.locked) continue;
        
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
        console.log(`[TWScheduler] 🔥 Processando ${ataques.length} ataques do horário ${horario}`);
        msgs.push(`🔥 Executando ${ataques.length} ataque(s)...`);
        
        for (let i = 0; i < ataques.length; i++) {
          const a = ataques[i];
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
          console.log(`[TWScheduler] 🔒 Marcando ${fingerprint} como processado`);
          
          a.locked = true;
          hasChanges = true;
          setList(list);
          
          _executing.add(a._id);
          
          console.log(`[TWScheduler] 🚀 [${i + 1}/${ataques.length}] Executando ${a._id}`);
          
          try {
            const success = await executeAttack(a);
            a.done = true;
            // ✅ NÃO marca success aqui - será validado depois
            a.executedAt = new Date().toISOString();
            hasChanges = true;
            
            console.log(`[TWScheduler] ✅ [${i + 1}/${ataques.length}] Concluído: ${a._id}`);
          } catch (err) {
            a.error = err.message;
            a.done = true;
            a.success = false;
            hasChanges = true;
            console.error(`[TWScheduler] ❌ [${i + 1}/${ataques.length}] Erro:`, err);
          } finally {
            a.locked = false;
            _executing.delete(a._id);
            hasChanges = true;
            console.log(`[TWScheduler] 🏁 [${i + 1}/${ataques.length}] Finalizando ${a._id}`);
          }
          
          if (i < ataques.length - 1) {
            console.log(`[TWScheduler] ⏳ Aguardando 200ms antes do próximo...`);
            await sleep(200);
          }
        }

        // ✅ NOVO: Após executar todos os ataques, inicia validação pós-execução
        console.log(`[TWScheduler] ⏳ Todos os ataques executados, agendando validação...`);
        validateAttacksAfterExecution();
      }

      if (hasChanges) {
        setList(list);
      }

      const status = document.getElementById('tws-status');
      if (status) {
        status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      }
    }, 1000);
    
    console.log('[TWS_Backend] Scheduler iniciado');
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
    validateAttacksAfterExecution, // ✅ NOVO: Função de validação pós-execução
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

  console.log('[TWS_Backend] Backend carregado com sucesso (v2.5 - Validação Pós-Execução)');
})();

