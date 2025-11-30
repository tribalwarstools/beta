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

  // Proteções / estados locais
  const _executing = new Set();
  // Usamos Set de fingerprints apenas para casos bem-sucedidos (evita reprocessar envios já enviados)
  const _processedAttacks = new Set();

  // Contador para fallback de ids
  let _idCounter = Date.now();

  // Gera ID único robusto
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

  // Parse de datas: aceita com ou sem segundos (dd/mm/yyyy hh:mm ou dd/mm/yyyy hh:mm:ss)
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss = '00'] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  // Validação de coord (retorna normalizado ou null)
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
  function isValidCoord(s){ return parseCoord(s)!==null; }

  function getMapSection(x, y) {
    const sections = [];
    if (x <= 249) sections.push('Oeste');
    else if (x >= 251) sections.push('Leste');
    else sections.push('Centro');

    if (y <= 249) sections.push('Norte');
    else if (y >= 251) sections.push('Sul');
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

  // fingerprint 
function getAttackFingerprint(a) {
  const dt = parseDateTimeToMs(a.datetime);
  const dtKey = isNaN(dt) ? (a.datetime || '') : String(dt);

  // fingerprint inclui _id para permitir ataques idênticos simultâneos
  return `${a._id}_${a.origemId || a.origem}_${a.alvo}_${dtKey}`;
}


  // Safefetch com timeout
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
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

  // === Village.txt loader
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

  // === Ler tropas da tela /place (fallbacks robustos)
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
                          doc.querySelector(`[id*="${u}"][class*="unit"]`) ||
                          doc.querySelector(`[class*="${u}"]`);
        let available = 0;
        if (availableEl) {
          const txt = (availableEl.textContent || '').replace(/\./g,'').replace(/,/g,'').trim();
          const m = txt.match(/(\d+)/g);
          if (m) available = parseInt(m.join(''), 10);
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

  // === Valida tropas
  function validateTroops(requested, available) {
    const errors = [];
    TROOP_LIST.forEach(u => {
      const req = Number(requested[u] || 0);
      const avail = Number(available[u] || 0);
      if (req > avail) errors.push(`${u}: solicitado ${req}, disponível ${avail}`);
    });
    return errors;
  }

  // === Detectar confirmação na resposta HTML
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

  // === executeAttack (faz todo fluxo via fetch)
  async function executeAttack(cfg) {
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => { try{ if(statusEl) statusEl.innerHTML = msg; }catch{} console.log('[TWScheduler]', msg); };

// No início do executeAttack, após setStatus
const ATTACK_TIMEOUT = 5000; // 5 segundos por ataque


    
    // resolver origemId
    const origemId = cfg.origemId || _villageMap[cfg.origem];
    if (!origemId) {
      setStatus(`❌ Origem ${cfg.origem || cfg.origemId} não encontrada!`);
      throw new Error('Origem não encontrada');
    }

    // validar alvo
    const [x, y] = (cfg.alvo || '').split('|');
    if (!x || !y) {
      setStatus(`❌ Alvo inválido: ${cfg.alvo}`);
      throw new Error('Alvo inválido');
    }

    setStatus(`🔍 Verificando tropas disponíveis em ${cfg.origem}...`);
    const availableTroops = await getVillageTroops(origemId);
    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length) {
        setStatus(`❌ Tropas insuficientes: ${errors.join(', ')}`);
        // atualiza status no objeto para o frontend exibir
        cfg.status = 'no_troops';
        cfg.statusText = `Sem tropas: ${errors.slice(0,2).join(', ')}`;
        throw new Error('Tropas insuficientes');
      }
    }

    const placeUrl = `${location.protocol}//${location.host}/game.php?village=${origemId}&screen=place`;
    try {
      // 1) GET /place
      // Modifique o safeTimeout dentro do executeAttack:
      const { controller: c1, timeout: t1 } = safeTimeout(ATTACK_TIMEOUT);
      const getRes = await safeFetch(placeUrl, { credentials: 'same-origin', signal: c1.signal });
      clearTimeout(t1);
      if (!getRes.ok) throw new Error(`GET /place falhou: HTTP ${getRes.status}`);
      const html = await getRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let form = doc.querySelector('#command-data-form') || doc.querySelector('form[action*="screen=place"]') || doc.forms[0];
      if (!form) throw new Error('Form de envio não encontrado');

      // 2) construir payload inicial
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

      // 3) POST inicial (tela de confirmação)
      setStatus(`⏳ Enviando comando...`);
      const { controller: c2, timeout: t2 } = safeTimeout(ATTACK_TIMEOUT);
      const postRes = await safeFetch(postUrl, {
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
      }, 1);
      clearTimeout(t2);
      if (!postRes.ok) throw new Error(`POST inicial falhou: HTTP ${postRes.status}`);
      const postText = await postRes.text();
      const postDoc = parser.parseFromString(postText, 'text/html');

      // 4) Form de confirmação → POST FINAL (auto-confirm if present)
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

        setStatus('⏳ Confirmando ataque (auto-fetch)...');
        const { controller: c3, timeout: t3 } = safeTimeout(ATTACK_TIMEOUT);
        const confirmRes = await safeFetch(confirmUrl, {
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
        }, 1);
        clearTimeout(t3);
        if (!confirmRes.ok) throw new Error(`POST confirmação falhou: HTTP ${confirmRes.status}`);
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

  // === Storage helpers
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

  // === importarDeBBCode (regex 1-4 dígitos)
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
      const uniqueId = generateUniqueId();
      const cfg = {
        _id: uniqueId,
        origem,
        origemId,
        alvo: destino,
        datetime: dataHora,
        done: false,
        locked: false,
        status: 'scheduled',
        statusText: 'Agendado'
      };
      TROOP_LIST.forEach(u => { cfg[u] = Number(params['att_' + u] || 0); });
      if (origem && destino && dataHora) agendamentos.push(cfg);
    }
    console.log(`[TWS_Backend] Importados ${agendamentos.length} agendamentos do BBCode`);
    return agendamentos;
  }

  // === Scheduler ====//


  // === SCHEDULER MELHORADO - Versão 2.0 ===

// ═════════════════════════════════════════════════════════
// ✅ #1 LIMPEZA DE MEMÓRIA (Novo)
// ═════════════════════════════════════════════════════════

const _processedAttacksWithTTL = new Map(); // timestamp → fingerprint
const PROCESSED_ATTACKS_TTL = 86400000; // 24 horas em ms

function cleanupProcessedAttacks() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [timestamp, fingerprint] of _processedAttacksWithTTL.entries()) {
    if (now - timestamp > PROCESSED_ATTACKS_TTL) {
      _processedAttacksWithTTL.delete(timestamp);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Scheduler] Limpeza: ${cleaned} fingerprints antigos removidos (${_processedAttacksWithTTL.size} restantes)`);
  }
}

function isAttackProcessed(fingerprint) {
  return _processedAttacksWithTTL.has(fingerprint);
}

function markAttackProcessed(fingerprint) {
  _processedAttacksWithTTL.set(Date.now(), fingerprint);
}

// ═════════════════════════════════════════════════════════
// ✅ #2 MONITORAMENTO DE PERFORMANCE (Novo)
// ═════════════════════════════════════════════════════════

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
      console.log(
        `[Scheduler] Ciclo concluído: ` +
        `${this.executionsThisCycle} exec | ` +
        `${this.successCount}✅ ${this.failureCount}❌ | ` +
        `${taxa}% taxa de sucesso | ` +
        `${this.lastCycleDuration}ms`
      );
    }
  },

  getStats() {
    return {
      lastCycleDuration: this.lastCycleDuration,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: this.executionsThisCycle > 0 
        ? ((this.successCount / this.executionsThisCycle) * 100).toFixed(1) 
        : 0
    };
  }
};

// ═════════════════════════════════════════════════════════
// ✅ #3 SCHEDULER MELHORADO (Principal)
// ═════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════
// ✅ FUNÇÃO COMPLETA: startScheduler() com Intervalo Configurável
// ═════════════════════════════════════════════════════════

// ┌─────────────────────────────────────────────────────────┐
// │ ADICIONE ESTA FUNÇÃO AUXILIAR ANTES DO startScheduler() │
// └─────────────────────────────────────────────────────────┘

function getGlobalConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
    return {
      behavior: {
        schedulerCheckInterval: 1000, // padrão: 1 segundo
        retryOnFail: true,
        maxRetries: 3,
        ...saved.behavior
      }
    };
  } catch (e) {
    console.error('[Backend] Erro ao ler config global:', e);
    return { behavior: { schedulerCheckInterval: 1000, retryOnFail: true, maxRetries: 3 } };
  }
}

// ┌─────────────────────────────────────────────────────────┐
// │ FUNÇÃO PRINCIPAL: startScheduler()                      │
// │ SUBSTITUA A FUNÇÃO COMPLETA NO SEU BACKEND              │
// └─────────────────────────────────────────────────────────┘

function startScheduler() {
  if (_schedulerInterval) clearInterval(_schedulerInterval);
  
  // ✅ LER INTERVALO DA CONFIGURAÇÃO
  const config = getGlobalConfig();
  const checkIntervalMs = config.behavior.schedulerCheckInterval || 1000;
  
  console.log(`[Scheduler] ✅ Iniciando com intervalo de ${checkIntervalMs}ms`);
  
  // Cleanup a cada 6 horas (ajustado pelo intervalo)
  const cleanupThreshold = Math.floor(21600000 / checkIntervalMs); // 6 horas em ciclos
  let cleanupCounter = 0;
  
  _schedulerInterval = setInterval(async () => {
    SchedulerMetrics.start();
    
    const list = getList();
    const now = Date.now();
    const ataquesPorHorario = {};
    let needsSave = false;

    // ┌─ FASE 1: AGRUPAMENTO ─┐
    // Detectar ataques que devem ser executados AGORA
    
    for (const a of list) {
      // Skip se já está travado ou concluído
      if (a.locked || a.done) {
        continue;
      }

      // Parse datetime
      const t = parseDateTimeToMs(a.datetime);
      if (!t || isNaN(t)) {
        console.warn(`[Scheduler] Datetime inválido: ${a.datetime}`);
        continue;
      }

      const diff = t - now;

      // Janela de execução: até 10s após o horário agendado
      if (diff <= 0 && diff > -10000) {
        // Agrupar por horário para execução simultânea
        if (!ataquesPorHorario[a.datetime]) {
          ataquesPorHorario[a.datetime] = [];
        }
        ataquesPorHorario[a.datetime].push(a);
      }
    }

    // ┌─ FASE 2: MARCAÇÃO ─┐
    // Marcar ataques como "em execução"
    
    const ataquesPendentes = Object.values(ataquesPorHorario).flat();
    
    if (ataquesPendentes.length > 0) {
      ataquesPendentes.forEach(a => {
        // ✅ Proteção: skip se já está rodando
        if (_executing.has(a._id)) {
          console.warn(`[Scheduler] Ataque já em execução: ${a._id}`);
          return;
        }

        a.locked = true;
        a.status = 'executing';
        a.statusText = 'Enviando...';
        a.executedAt = new Date().toISOString();
        _executing.add(a._id);
        needsSave = true;
      });

      // Salvar estado de MARCAÇÃO
      if (needsSave) {
        setList(list);
      }
    }

    // ┌─ FASE 3: EXECUÇÃO SIMULTÂNEA ─┐
    // Executar TODOS os ataques do mesmo horário simultaneamente

    for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {
      if (ataques.length > 0) {
        console.log(`[Scheduler] Executando ${ataques.length} ataques simultâneos para ${horario}`);
        
        // Preparar todas as promessas de execução
        const executionPromises = ataques.map(a => {
          return (async () => {
            // ✅ Double-check: skip se já foi finalizado
            if (a.done) {
              return { attack: a, success: false, skipped: true };
            }

            // ✅ Calcular fingerprint para evitar reprocessamento
            const fingerprint = getAttackFingerprint(a);
            
            try {
              // Executar o ataque
              const success = await executeAttack(a);

              // ✅ TELEGRAM NOTIFICATIONS
              if (success) {
                await sendTelegramNotification('attack_success', {
                  origin: a.origem,
                  target: a.alvo,
                  units: TROOP_LIST.map(u => a[u] > 0 ? `${a[u]} ${u}` : null).filter(Boolean).join(', ') || 'Nenhuma tropa especificada',
                  travelTime: 'Calculando...'
                });
              } else {
                await sendTelegramNotification('attack_failure', {
                  origin: a.origem,
                  target: a.alvo,
                  reason: a.statusText || 'Falha na execução do comando',
                  suggestion: 'Verifique se as tropas estão disponíveis'
                });
              }

              // Registrar resultado
              a.done = true;
              a.success = success;
              
              if (success) {
                markAttackProcessed(fingerprint);
                a.status = 'sent';
                a.statusText = '✅ Enviado';
                SchedulerMetrics.recordExecution(true);
              } else {
                a.status = 'failed';
                a.statusText = '❌ Falhou (verificar manualmente)';
                SchedulerMetrics.recordExecution(false);
              }

              return { attack: a, success: success, error: null };

            } catch (err) {
              // Erro na execução
              a.done = true;
              a.success = false;
              a.error = err.message;
              a.status = 'failed';
              a.statusText = `❌ Falha: ${err.message}`;
              SchedulerMetrics.recordExecution(false);

              // ✅ NOTIFICAÇÃO DE ERRO
              await sendTelegramNotification('system_error', {
                module: 'Scheduler',
                error: err.message,
                details: `Ataque: ${a.origem} → ${a.alvo}`,
                action: 'Verificar console para detalhes'
              });

              console.error(
                `[Scheduler] Erro ao executar ${a.origem}→${a.alvo}:`,
                err.message
              );

              return { attack: a, success: false, error: err.message };

            } finally {
              // ✅ Sempre desbloquear
              a.locked = false;
              _executing.delete(a._id);
            }
          })();
        });

        // ⚡ EXECUTAR TODOS SIMULTANEAMENTE
        const results = await Promise.allSettled(executionPromises);
        
        // Salvar todos os resultados de uma vez
        setList(list);
        
        // Log de resultados
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        console.log(`[Scheduler] Lote ${horario}: ${successful}/${ataques.length} bem-sucedidos`);
      }
    }

    // ┌─ FASE 4: LIMPEZA ─┐
    // Cleanup periódico
    
    cleanupCounter++;
    if (cleanupCounter >= cleanupThreshold) {
      cleanupProcessedAttacks();
      cleanupCounter = 0;
    }

    // ┌─ MÉTRICAS ─┐
    SchedulerMetrics.end();

  }, checkIntervalMs); // ✅ USAR INTERVALO CONFIGURÁVEL

  console.log(`[Scheduler] ✅ Iniciado (v2.0 - Intervalo: ${checkIntervalMs}ms)`);
}

// ═════════════════════════════════════════════════════════
// 📊 COMO FUNCIONA
// ═════════════════════════════════════════════════════════

/*
EXECUÇÃO SIMULTÂNEA MANTIDA:
✅ Todos os ataques do MESMO horário executam juntos (Promise.allSettled)
✅ Não há delay entre ataques do mesmo horário
✅ Chegam juntos no alvo

INTERVALO CONFIGURÁVEL:
✅ checkIntervalMs controla a frequência de checagem
✅ Menor intervalo = maior precisão de detecção
✅ Não afeta a execução simultânea

EXEMPLO:
10 ataques agendados para 14:00:00 com intervalo de 1000ms:

📍 13:59:59 → Scheduler checa: "ainda não é hora"
📍 14:00:00 → Scheduler checa: "é hora! executar TODOS"
⚡ 14:00:00.050 → Todos os 10 ataques partem JUNTOS
✅ Resultado: Todos chegam no alvo simultaneamente

CONFIGURAÇÃO NO MODAL:
• 100ms = Precisão máxima (±0.1s) ⚡⚡⚡⚡⚡
• 1000ms = Balanceado (±1s) ⭐ [RECOMENDADO]
• 5000ms = Econômico (±5s) 🔋

BENEFÍCIOS:
• Mantém timing preciso dos ataques
• Configurável por perfil de uso
• Economia de CPU quando necessário
• Sem impacto na execução simultânea
*/
  
// ═════════════════════════════════════════════════════════
// ✅ #4 FUNÇÕES DE DEBUG (Novas)
// ═════════════════════════════════════════════════════════

function getSchedulerStats() {
  return {
    executingCount: _executing.size,
    processedCount: _processedAttacksWithTTL.size,
    metrics: SchedulerMetrics.getStats(),
    ttwlBudget: `${(_processedAttacksWithTTL.size * 100 / 1024).toFixed(2)} KB`
  };
}

function dumpSchedulerState() {
  const stats = getSchedulerStats();
  console.table({
    'Em Execução': stats.executingCount,
    'Processados (24h)': stats.processedCount,
    'Última Taxa': `${stats.metrics.successRate}%`,
    'Último Ciclo': `${stats.metrics.lastCycleDuration}ms`,
    'Memória': stats.ttwlBudget
  });
}

// ═════════════════════════════════════════════════════════
// ✅ TELEGRAM NOTIFICATIONS - VERSÃO MELHORADA
// ═════════════════════════════════════════════════════════

async function sendTelegramNotification(type, data) {
  // Fallback se TelegramBotReal não estiver disponível
  const Telegram = window.TelegramBotReal || {
    getConfig: () => ({ enabled: false }),
    makeRequest: () => Promise.resolve({ success: false })
  };
  
  try {
    const config = Telegram.getConfig();
    if (!config.enabled) return;
    
    let message = '';
    const timestamp = new Date().toLocaleString('pt-BR');
    
    switch (type) {
      case 'attack_success':
        if (!config.notifications?.success) return;
        message = `✅ <b>Ataque Bem-Sucedido</b>\n\n` +
                 `⏰ <b>${timestamp}</b>\n` +
                 `🎯 <b>Origem:</b> ${data.origin || 'N/A'}\n` +
                 `🎯 <b>Destino:</b> ${data.target || 'N/A'}\n` +
                 `⚔️ <b>Unidades:</b> ${data.units || 'N/A'}\n` +
                 `⏱️ <b>Status:</b> Comando enviado com sucesso`;
        break;
        
      case 'attack_failure':
        if (!config.notifications?.failure) return;
        message = `❌ <b>Ataque Falhado</b>\n\n` +
                 `⏰ <b>${timestamp}</b>\n` +
                 `🎯 <b>Origem:</b> ${data.origin || 'N/A'}\n` +
                 `🎯 <b>Destino:</b> ${data.target || 'N/A'}\n` +
                 `🚫 <b>Motivo:</b> ${data.reason || 'Erro desconhecido'}\n` +
                 `💡 <b>Sugestão:</b> ${data.suggestion || 'Verificar configurações'}`;
        break;
        
      case 'system_error':
        if (!config.notifications?.error) return;
        message = `🚨 <b>Erro do Sistema</b>\n\n` +
                 `⏰ <b>${timestamp}</b>\n` +
                 `🔧 <b>Módulo:</b> ${data.module || 'Desconhecido'}\n` +
                 `❌ <b>Erro:</b> ${data.error || 'N/A'}\n` +
                 `📝 <b>Detalhes:</b> ${data.details || 'N/A'}\n` +
                 `⚡ <b>Ação:</b> ${data.action || 'Verificar o console'}`;
        break;
        
      default:
        return; // Tipo não reconhecido
    }
    
    const result = await Telegram.makeRequest('sendMessage', {
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    if (result.success) {
      console.log(`[Telegram] Notificação ${type} enviada com sucesso`);
    } else {
      console.warn(`[Telegram] Falha ao enviar notificação ${type}:`, result.error);
    }
    
  } catch (error) {
    console.error('[Telegram] Erro ao enviar notificação:', error);
  }
}

  
// ═════════════════════════════════════════════════════════
// ✅ EXPORTAR API
// ═════════════════════════════════════════════════════════

window.TWS_SchedulerDebug = {
  getStats: getSchedulerStats,
  dumpState: dumpSchedulerState,
  getMetrics: () => SchedulerMetrics,
  clearProcessed: () => _processedAttacksWithTTL.clear()
};

console.log('[Scheduler] Debug API disponível em: window.TWS_SchedulerDebug');



// === Export API ===
window.TWS_Backend = {
  loadVillageTxt,
  parseDateTimeToMs,
  getList,
  setList,
  startScheduler,
  importarDeBBCode,
  executeAttack,
  getVillageTroops,
  validateTroops,
  generateUniqueId,
  getAttackFingerprint,
  sendTelegramNotification, // ✅ ADICIONE ESTA LINHA AQUI!
  TROOP_LIST,
  STORAGE_KEY,
  PANEL_STATE_KEY,
  _internal: {
    get villageMap(){ return _villageMap; },
    get myVillages(){ return _myVillages; },
    get executing(){ return _executing; },
    get processedAttacks(){ return _processedAttacks; }
  }
};

  console.log('[TWS_Backend] Backend carregado (vFinal - status unificado)');
})();




