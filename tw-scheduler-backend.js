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
  let _idCounter = Date.now();

  // ✅ NOVO: Gerenciador de Broadcast Channel
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
      
      // Limpar ao fechar aba
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }

    generateTabId() {
      return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 📤 Notificar que vou processar um ataque
    notifyAttackStart(attackId) {
      this.processingAttacks.set(attackId, Date.now());
      
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'ATTACK_START',
          attackId,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      console.log(`📤 [${this.currentTabId}] Iniciando: ${attackId}`);
    }

    // 📥 Notificar que terminei de processar
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

    // ✅ Verificar se outro ataque já está processando
    isBeingProcessed(attackId) {
      const timestamp = this.processingAttacks.get(attackId);
      
      if (!timestamp) return false;
      
      const age = Date.now() - timestamp;
      const TIMEOUT = 60000; // 60 segundos
      
      // Se processando há mais de 60s, considerar morto
      if (age > TIMEOUT) {
        console.warn(`⚠️ Ataque ${attackId} expirado (${age}ms), removendo lock`);
        this.processingAttacks.delete(attackId);
        return false;
      }
      
      return true;
    }

    // 📋 Processar mensagens recebidas
    handleMessage(data) {
      const { type, attackId, tabId, timestamp } = data;
      
      switch (type) {
        case 'ATTACK_START':
          console.log(`📥 Aba ${tabId} iniciou: ${attackId}`);
          this.processingAttacks.set(attackId, timestamp);
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
        this.channel.postMessage({
          type: 'CLEANUP',
          tabId: this.currentTabId,
          attackIds
        });
      }
      
      console.log(`🧹 [${this.currentTabId}] Limpando ${attackIds.length} locks`);
      
      if (this.channel) {
        this.channel.close();
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

  // === Utility functions ===
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  /**
   * VALIDADOR DE COORDENADAS - Tribal Wars Scheduler
   */
  function parseCoord(s) {
    if (!s) return null;
    
    const t = s.trim();
    const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
    
    if (!match) return null;
    
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    
    if (x < 0 || x > 499 || y < 0 || y > 499) {
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

  // ✅ NOVO: Criar fingerprint único do ataque (para detectar duplicatas)
  function getAttackFingerprint(a) {
    return `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
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

executeAttack: async function (task) {
    try {
        // 1. Abre a página de confirmação
        const confirmUrl =
            `/game.php?village=${task.source}` +
            `&screen=place&try=confirm` +
            `&target=${task.target}`;

        const html = await fetch(confirmUrl, {
            credentials: "include"
        }).then(r => r.text());

        // 2. Extrair o <form> inteiro sem DOMParser
        const formMatch = html.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
        if (!formMatch) {
            return { success: false, message: "Formulário não encontrado" };
        }
        const formHtml = formMatch[1];

        // 3. Extrair todos os inputs
        const inputs = {};
        const inputRegex = /<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;

        let match;
        while ((match = inputRegex.exec(formHtml)) !== null) {
            inputs[match[1]] = match[2];
        }

        // 4. Gerar o body do POST final
        const params = new URLSearchParams();

        for (const key in inputs) {
            params.append(key, inputs[key]);
        }

        const body = params.toString();

        // 5. Montar a URL final
        const finalUrl =
            `/game.php?village=${inputs["village"]}` +
            `&screen=place&action=command&h=${inputs["h"]}`;

        // 6. Enviar o ataque
        const resp = await fetch(finalUrl, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body
        });

        if (!resp.ok) {
            return { success: false, message: "Erro no fetch final" };
        }

        return {
            success: true,
            message: "Ataque enviado",
            executedAt: Date.now(),
            data: {
                source: task.source,
                target: task.target,
                troops: task.troops,
                finalUrl
            }
        };

    } catch (error) {
        return {
            success: false,
            message: "Erro interno no executeAttack",
            error: String(error)
        };
    }
},


  
// ✅ MAIS PRECISO para 0ms (execução no próximo tick)
function sleep(ms) {
  if (ms <= 0) {
    return new Promise(resolve => queueMicrotask(resolve));
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Uso: sleep(0) → executa no próximo ciclo de evento

  
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
        
        // ✅ PROTEÇÃO: Verificar BroadcastChannel
        if (attackCoordinator.isBeingProcessed(a._id)) {
          console.log(`⏳ [BroadcastChannel] Ataque ${a._id} já está sendo processado`);
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
          
          // ✅ PROTEÇÃO 3: Verificação dupla com BroadcastChannel
          if (attackCoordinator.isBeingProcessed(a._id)) {
            console.log(`⏭️ Pulando ${a._id} (outra aba pegou)`);
            continue;
          }
          
          // ✅ PROTEÇÃO 4: Criar ID único se não existir
          if (!a._id) {
            a._id = generateUniqueId();
            hasChanges = true;
          }
          
          // ✅ PROTEÇÃO 5: Verificar se já está executando
          if (_executing.has(a._id)) {
            console.log(`[TWScheduler] ⏭️ Pulando ${a._id} (já em execução)`);
            continue;
          }
          
          // ✅ PROTEÇÃO 6: Marcar como processado IMEDIATAMENTE
          _processedAttacks.add(fingerprint);
          console.log(`[TWScheduler] 🔒 Marcando ${fingerprint} como processado`);
          
          // ✅ PROTEÇÃO 7: Notificar início via BroadcastChannel
          attackCoordinator.notifyAttackStart(a._id);
          
          // ✅ PROTEÇÃO 8: Lock imediato ANTES de executar
          a.locked = true;
          hasChanges = true;
          setList(list); // Salvar ANTES de executar
          
          // ✅ PROTEÇÃO 9: Adicionar ao Set
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
            // ✅ PROTEÇÃO 10: Notificar fim via BroadcastChannel
            attackCoordinator.notifyAttackEnd(a._id);
            
            // ✅ PROTEÇÃO 11: Remover lock e do Set
            a.locked = false;
            _executing.delete(a._id);
            hasChanges = true;
            console.log(`[TWScheduler] 🏁 [${i + 1}/${ataques.length}] Finalizando ${a._id}`);
          }
          
          // ✅ PROTEÇÃO 12: Debounce entre ataques (100ms)
          if (i < ataques.length - 1) {
            console.log(`[TWScheduler] ⏳ Aguardando 100ms antes do próximo...`);
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
    
    console.log('[TWS_Backend] Scheduler iniciado com TODAS as proteções anti-duplicação');
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
    attackCoordinator,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    
    _internal: {
      get villageMap() { return _villageMap; },
      get myVillages() { return _myVillages; },
      get executing() { return _executing; },
      get processedAttacks() { return _processedAttacks; },
      get coordinatorStats() { return attackCoordinator.getStats(); }
    }
  };

  console.log('[TWS_Backend] ✅ Backend v4 carregado (BroadcastChannel + TODAS proteções anti-duplicação)');
})();





