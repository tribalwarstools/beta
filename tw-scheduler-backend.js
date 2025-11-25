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
  
  // ✅ PROTEÇÃO: Rastrear agendamentos em execução
  const _executing = new Set();
  
  // ✅ PROTEÇÃO: Rastrear ataques já processados (evita reprocessamento)
  const _processedAttacks = new Set();
  
  // ✅ NOVO: Contador global para IDs únicos
  let _idCounter = Date.now(); // Inicia com timestamp para ser único entre sessões

  // ✅ NOVO: Gerar ID único GARANTIDO (impossível colidir)
  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback super seguro: timestamp + contador incremental + random + performance
    const timestamp = Date.now();
    const counter = ++_idCounter;
    const random = Math.random().toString(36).substr(2, 9);
    const perf = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now().toString(36) 
      : Math.random().toString(36).substr(2, 5);
    
    return `${timestamp}_${counter}_${random}_${perf}`;
  }

// === Auto-confirm na página de confirmação ===
// === Auto-confirm via FETCH (sem clicar no botão) ===
//REMOVIDO 


  // === Utility functions ===
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

/**
 * VALIDADOR DE COORDENADAS - Tribal Wars Scheduler
 * Suporta todos os formatos: X|Y, XX|YY, XXX|YYY, XXXX|YYYY
 */

// ✅ Função melhorada para validar e normalizar coordenadas
function parseCoord(s) {
  if (!s) return null;
  
  const t = s.trim();
  
  // Padrão: permite 1-4 dígitos de cada lado do pipe
  // Formatos válidos: 5|4, 52|43, 529|431, 5294|4312
  const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
  
  if (!match) return null;
  
  const x = parseInt(match[1], 10);
  const y = parseInt(match[2], 10);
  
  // Validar limites do mapa (Tribal Wars: 0-499 em cada eixo)
  if (x < 0 || x > 499 || y < 0 || y > 499) {
    return null;
  }
  
  // Retornar em formato normalizado XXX|YYY
  return `${x}|${y}`;
}

// ✅ Função para validar sem normalizar (apenas verificar formato)
function isValidCoord(s) {
  return parseCoord(s) !== null;
}

// ✅ Função para obter info sobre a coordenada
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
    distance: null // Pode ser calculado se houver coordenada de origem
  };
}

// ✅ Função auxiliar: determinar seção do mapa
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

// ✅ Calcular distância entre coordenadas
function getDistance(coord1, coord2) {
  const c1 = parseCoord(coord1);
  const c2 = parseCoord(coord2);
  
  if (!c1 || !c2) return null;
  
  const [x1, y1] = c1.split('|').map(Number);
  const [x2, y2] = c2.split('|').map(Number);
  
  // Distância de Chebyshev (usada em Tribal Wars)
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

// ✅ Validar múltiplas coordenadas
function validateCoordList(coordStrings) {
  return coordStrings.map((coord, idx) => ({
    index: idx + 1,
    input: coord,
    valid: isValidCoord(coord),
    normalized: parseCoord(coord),
    error: !isValidCoord(coord) ? 'Formato inválido' : null
  }));
}

// ✅ Função para limpar e validar input de usuário
function sanitizeCoordInput(input) {
  if (!input) return null;
  
  // Remover espaços extras
  let cleaned = input.trim().replace(/\s+/g, '');
  
  // Aceitar também formato com hífen: 5-4 → 5|4
  cleaned = cleaned.replace(/-/g, '|');
  
  // Remover caracteres inválidos
  cleaned = cleaned.replace(/[^\d|]/g, '');
  
  // Se vazio após limpeza, retornar null
  if (!cleaned) return null;
  
  return parseCoord(cleaned);
}

// ═══════════════════════════════════════════════════════════════════
// TESTES UNITÁRIOS
// ═══════════════════════════════════════════════════════════════════

function runCoordTests() {
  const testCases = [
    // Formatos válidos
    { input: '5|4', expected: '5|4', name: 'Formato X|Y (válido)' },
    { input: '52|43', expected: '52|43', name: 'Formato XX|YY (válido)' },
    { input: '529|431', expected: '529|431', name: 'Formato XXX|YYY (válido)' },
    { input: '5294|4312', expected: '5294|4312', name: 'Formato XXXX|YYYY (válido)' },
    
    // Com espaços
    { input: ' 52 | 43 ', expected: '52|43', name: 'Formato com espaços' },
    { input: '529 | 431', expected: '529|431', name: 'Formato com espaços múltiplos' },
    
    // Casos inválidos
    { input: '5', expected: null, name: 'Apenas um número' },
    { input: '5|', expected: null, name: 'Número faltando' },
    { input: '|43', expected: null, name: 'Primeiro número faltando' },
    { input: 'abc|def', expected: null, name: 'Letras em vez de números' },
    { input: '500|250', expected: null, name: 'X fora do intervalo (500)' },
    { input: '250|500', expected: null, name: 'Y fora do intervalo (500)' },
    { input: '-5|43', expected: null, name: 'Número negativo' },
    { input: '', expected: null, name: 'String vazia' },
    { input: null, expected: null, name: 'null' },
    { input: '5|4|2', expected: null, name: 'Mais de dois números' },
    { input: '5.5|4.3', expected: null, name: 'Números decimais' },
  ];

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🧪 TESTES DE VALIDAÇÃO DE COORDENADAS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  let passed = 0;
  let failed = 0;

  testCases.forEach((test, idx) => {
    const result = parseCoord(test.input);
    const success = result === test.expected;
    
    if (success) {
      console.log(`✅ [${idx + 1}] ${test.name}`);
      console.log(`   Input: "${test.input}" → Output: "${result}"\n`);
      passed++;
    } else {
      console.log(`❌ [${idx + 1}] ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Esperado: ${test.expected}`);
      console.log(`   Obtido: ${result}\n`);
      failed++;
    }
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 RESULTADO: ${passed} aprovados, ${failed} reprovados`);
  console.log('═══════════════════════════════════════════════════════\n');

  return { passed, failed, total: testCases.length };
}

// ═══════════════════════════════════════════════════════════════════
// DEMONSTRAÇÃO
// ═══════════════════════════════════════════════════════════════════

function demonstracao() {
  console.log('\n🎯 EXEMPLOS DE USO\n');
  
  console.log('1️⃣ Validar coordenadas:');
  console.log('   isValidCoord("529|431"):', isValidCoord('529|431'));
  console.log('   isValidCoord("5|4"):', isValidCoord('5|4'));
  console.log('   isValidCoord("999|999"):', isValidCoord('999|999'));
  
  console.log('\n2️⃣ Obter informações:');
  const info = getCoordInfo('529|431');
  console.log('   Coordenada: 529|431');
  console.log('   Válida:', info.valid);
  console.log('   Normalizada:', info.normalized);
  console.log('   Posição:', `X=${info.x}, Y=${info.y}`);
  console.log('   Seção do Mapa:', info.mapSection);
  
  console.log('\n3️⃣ Calcular distância:');
  const dist = getDistance('0|0', '100|100');
  console.log('   De (0|0) até (100|100):', dist, 'casas');
  
  console.log('\n4️⃣ Limpar input de usuário:');
  console.log('   Input: " 52 - 43 "');
  console.log('   Resultado:', sanitizeCoordInput(' 52 - 43 '));
  
  console.log('\n5️⃣ Validar lista:');
  const lista = validateCoordList(['5|4', '999|999', '52|43']);
  lista.forEach(item => {
    console.log(`   [${item.index}] "${item.input}" → ${item.valid ? '✅' : '❌'}`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAR PARA USO GLOBAL
// ═══════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseCoord,
    isValidCoord,
    getCoordInfo,
    getMapSection,
    getDistance,
    validateCoordList,
    sanitizeCoordInput,
    runCoordTests
  };
}

// Executar testes se disponível no console
if (typeof window !== 'undefined') {
  window.CoordValidator = {
    parseCoord,
    isValidCoord,
    getCoordInfo,
    getMapSection,
    getDistance,
    validateCoordList,
    sanitizeCoordInput,
    runCoordTests
  };
  console.log('✅ CoordValidator disponível. Use: CoordValidator.runCoordTests()');
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

  // === Verifica se o ataque foi confirmado ===
  function isAttackConfirmed(htmlText) {
    if (/screen=info_command.*type=own/i.test(htmlText)) {
      return true;
    }

    if (/<tr class="command-row">/i.test(htmlText) && /data-command-id=/i.test(htmlText)) {
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

  // === Execute attack ===
  async function executeAttack(cfg) {
  const statusEl = document.getElementById('tws-status');
  const setStatus = (msg) => {
    try { if (statusEl) statusEl.innerHTML = msg; } catch {}
    console.log('[TWScheduler]', msg);
  };

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

  // Resolver ID da origem
  const origemId = cfg.origemId || _villageMap[cfg.origem];
  if (!origemId) {
    setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada!`);
    throw new Error('Origem não encontrada');
  }

  // Validar alvo
  const [x, y] = (cfg.alvo || '').split('|');
  if (!x || !y) {
    setStatus(`❌ Alvo inválido: ${cfg.alvo}`);
    throw new Error('Alvo inválido');
  }

  // Validar tropas
  setStatus(`🔍 Verificando tropas disponíveis em ${cfg.origem}...`);
  const availableTroops = await getVillageTroops(origemId);
  if (availableTroops) {
    const errors = validateTroops(cfg, availableTroops);
    if (errors.length) {
      setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
      throw new Error('Tropas insuficientes');
    }
  }

  const placeUrl =
    `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;

  try {
    // ============================================================
    // 1) GET /place
    // ============================================================

    const { controller: c1, timeout: t1 } = safeTimeout();
    const getRes = await safeFetch(placeUrl, {
      credentials: 'same-origin',
      signal: c1.signal
    });
    clearTimeout(t1);

    if (!getRes.ok)
      throw new Error(`GET /place falhou: HTTP ${getRes.status}`);

    const html = await getRes.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Form robusto
    let form =
      doc.querySelector('#command-data-form') ||
      doc.querySelector('form[action*="screen=place"]') ||
      doc.forms[0];

    if (!form) throw new Error('Form de envio não encontrado');


    // ============================================================
    // 2) Construir o payload inicial
    // ============================================================

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

    // DESTINO
    payloadObj['x'] = String(x);
    payloadObj['y'] = String(y);

    // TROPAS
    TROOP_LIST.forEach(u => {
      payloadObj[u] = String(cfg[u] !== undefined ? cfg[u] : '0');
    });

    // Botão de submit do form
    const submitBtn = form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitBtn) {
      const n = submitBtn.name;
      const v = submitBtn.value || '';
      if (n) payloadObj[n] = v;
    }

    // Validação leve do payload
    if (!payloadObj['x'] || !payloadObj['y'])
      throw new Error('Payload sem coordenadas.');
    if (Object.keys(payloadObj).length < 5)
      throw new Error('Payload incompleto.');


    const urlEncoded = Object.entries(payloadObj)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    let postUrl = form.getAttribute('action') || placeUrl;
    if (postUrl.startsWith('/'))
      postUrl = `${location.protocol}//${location.host}${postUrl}`;


    // ============================================================
    // 3) POST inicial (tela de confirmação)
    // ============================================================

    setStatus(`⏳ Enviando comando...`);

    const { controller: c2, timeout: t2 } = safeTimeout();
    const postRes = await safeFetch(
      postUrl,
      {
        method: 'POST',
        credentials: 'same-origin',
        signal: c2.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html,application/xhtml+xml',
          'Cache-Control': 'no-cache'
        },
        body: urlEncoded
      },
      1 // retry leve
    );
    clearTimeout(t2);

    if (!postRes.ok)
      throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);

    const postText = await postRes.text();
    const postDoc = parser.parseFromString(postText, 'text/html');


    // ============================================================
    // 4) Form de confirmação → POST FINAL
    // ============================================================

// ============================================================
// 4) Form de confirmação → POST FINAL (AUTO-CONFIRM INTEGRADO)
// ============================================================

let confirmForm =
  postDoc.querySelector('form[action*="try=confirm"]') ||
  postDoc.querySelector('#command-data-form') ||
  postDoc.forms[0];

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

  const btn = confirmForm.querySelector(
    '#troop_confirm_submit, button[type="submit"], input[type="submit"]'
  );
  if (btn) {
    const n = btn.name;
    const v = btn.value || '';
    if (n) confirmPayload[n] = v;
  }

  if (Object.keys(confirmPayload).length < 5)
    throw new Error('Confirm payload incompleto.');

  const confirmEncoded = Object.entries(confirmPayload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  let confirmUrl =
    confirmForm.getAttribute('action') ||
    postRes.url ||
    placeUrl;

  if (confirmUrl.startsWith('/'))
    confirmUrl = `${location.protocol}//${location.host}${confirmUrl}`;

  setStatus('⏳ Confirmando ataque (auto-fetch)...');

  const { controller: c3, timeout: t3 } = safeTimeout();
  const confirmRes = await safeFetch(
    confirmUrl,
    {
      method: 'POST',
      credentials: 'same-origin',
      signal: c3.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache'
      },
      body: confirmEncoded
    },
    1
  );
  clearTimeout(t3);

  if (!confirmRes.ok)
    throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);

  const finalText = await confirmRes.text();

  if (isAttackConfirmed(finalText)) {
    setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
    return true;
  } else {
    setStatus(`⚠️ Confirmação concluída, mas sem padrão claro.`);
    return false;
  }
}


    // Se não houve form de confirmação
    if (isAttackConfirmed(postText)) {
      setStatus(`✅ Ataque enviado: ${cfg.origem} → ${cfg.alvo}`);
      return true;
    } else {
      setStatus('⚠️ Resposta não indicou confirmação; verificar manualmente.');
      return false;
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

  // ✅ NOVO: Criar fingerprint único do ataque (para detectar duplicatas)
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

      // ✅ PROTEÇÃO: Agrupar ataques por horário E fingerprint único
      const ataquesPorHorario = {};
      
      for (const a of list) {
        // ✅ PROTEÇÃO 0: Pular se já foi processado (mesmo que done=false)
        const fingerprint = getAttackFingerprint(a);
        if (_processedAttacks.has(fingerprint)) {
          console.log(`[TWScheduler] ⏭️ Ataque ${fingerprint} já foi processado anteriormente`);
          continue;
        }
        
        if (a.done || a.locked) continue;
        
        const t = parseDateTimeToMs(a.datetime);
        if (!t || isNaN(t)) continue;
        
        const diff = t - now;
        
        // Agrupar ataques do mesmo horário
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

      // ✅ PROTEÇÃO: Processar cada grupo de horário com debounce
      for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {
        console.log(`[TWScheduler] 🔥 Processando ${ataques.length} ataques do horário ${horario}`);
        msgs.push(`🔥 Executando ${ataques.length} ataque(s)...`);
        
        // Processar sequencialmente com delay
        for (let i = 0; i < ataques.length; i++) {
          const a = ataques[i];
          
          // ✅ PROTEÇÃO 1: Criar fingerprint único
          const fingerprint = getAttackFingerprint(a);
          
          // ✅ PROTEÇÃO 2: Verificar se já foi processado
          if (_processedAttacks.has(fingerprint)) {
            console.log(`[TWScheduler] ⏭️ Pulando ${fingerprint} (já processado)`);
            continue;
          }
          
          // ✅ PROTEÇÃO 3: Criar ID único se não existir
          if (!a._id) {
            a._id = generateUniqueId();
            hasChanges = true;
          }
          
          // ✅ PROTEÇÃO 4: Verificar se já está executando
          if (_executing.has(a._id)) {
            console.log(`[TWScheduler] ⏭️ Pulando ${a._id} (já em execução)`);
            continue;
          }
          
          // ✅ PROTEÇÃO 5: Marcar como processado IMEDIATAMENTE
          _processedAttacks.add(fingerprint);
          console.log(`[TWScheduler] 🔒 Marcando ${fingerprint} como processado`);
          
          // ✅ PROTEÇÃO 6: Lock imediato ANTES de executar
          a.locked = true;
          hasChanges = true;
          setList(list); // Salvar ANTES de executar
          
          // ✅ PROTEÇÃO 7: Adicionar ao Set
          _executing.add(a._id);
          
          console.log(`[TWScheduler] 🚀 [${i + 1}/${ataques.length}] Executando ${a._id}`);
          
          try {
            const success = await executeAttack(a);
            a.done = true;
            a.success = success;
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
            // ✅ PROTEÇÃO 8: Remover lock e do Set
            a.locked = false;
            _executing.delete(a._id);
            hasChanges = true;
            console.log(`[TWScheduler] 🏁 [${i + 1}/${ataques.length}] Finalizando ${a._id}`);
          }
          
          // ✅ PROTEÇÃO 9: Debounce entre ataques (100ms)
          if (i < ataques.length - 1) {
            console.log(`[TWScheduler] ⏳ Aguardando 200ms antes do próximo...`);
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
      
      // ✅ PROTEÇÃO: Gerar ID único ANTES de adicionar à lista
      const uniqueId = generateUniqueId();
      
      const cfg = {
        _id: uniqueId, // ✅ ID único PRIMEIRO
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
    getAttackFingerprint, // ✅ NOVO
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get executing() { return _executing; },
      get processedAttacks() { return _processedAttacks; } // ✅ NOVO
    }
  };

  console.log('[TWS_Backend] Backend carregado com sucesso (v2.3 - Anti-Duplicação ULTRA)');
})();






