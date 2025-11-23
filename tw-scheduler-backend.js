(function () {
  'use strict';

  // === Configs / Constantes ===
  const STORAGE_KEY = 'tw_scheduler_multi_v1';
  const PANEL_STATE_KEY = 'tws_panel_state';
  const TIMESLOT_LOCK_KEY = 'tws_timeslot_locks';
  const TROOP_LIST = ['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  const world = location.hostname.split('.')[0];
  const VILLAGE_TXT_URL = `https://${world}.tribalwars.com.br/map/village.txt`;
  
  let _villageMap = {};
  let _myVillages = [];
  let _schedulerInterval = null;
  let _currentExecutionQueue = null;
  
  // ✅ SISTEMA DE LOCK POR TIMESLOT (HORÁRIO)
  class TimeslotCoordinator {
    constructor() {
      this.currentTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.activeTimeslots = new Set();
      this.executionQueue = new Map();
      this.useBroadcast = false;
      this.channel = null;
      
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('tws_timeslots');
          this.useBroadcast = true;
          this.channel.onmessage = (event) => this.handleMessage(event.data);
          console.log(`✅ [${this.currentTabId}] TimeslotCoordinator ativado`);
        } catch (e) {
          console.warn('⚠️ BroadcastChannel não disponível:', e);
        }
      }
      
      // Limpar locks expirados a cada 30s
      setInterval(() => this.cleanupExpiredLocks(), 30000);
      window.addEventListener('beforeunload', () => this.cleanup());
    }

    // 🕒 Gerar chave de timeslot (segundo específico)
    getTimeslotKey(datetimeStr) {
      const timestamp = parseDateTimeToMs(datetimeStr);
      if (isNaN(timestamp)) return null;
      
      // Arredonda para o segundo (remove milissegundos)
      const timeslot = Math.floor(timestamp / 1000);
      return `timeslot_${timeslot}`;
    }

    // 🔒 Tentar adquirir lock de um timeslot
    async acquireTimeslotLock(timeslotKey, attackCount = 1) {
      const now = Date.now();
      
      // ✅ Camada 1: Lock local (evita duplicata na mesma aba)
      if (this.activeTimeslots.has(timeslotKey)) {
        console.log(`⏭️ [Local] Timeslot ${timeslotKey} já está sendo processado`);
        return false;
      }

      // ✅ Camada 2: Lock em localStorage (entre abas)
      try {
        const allLocks = this.getGlobalLocks();
        const existingLock = allLocks[timeslotKey];
        
        if (existingLock) {
          const lockAge = now - existingLock.timestamp;
          
          // Se lock é recente (< 30 segundos), não permitir
          if (lockAge < 30000) {
            console.log(`⏭️ [Global] Timeslot ${timeslotKey} travado por ${existingLock.tabId} (${Math.round(lockAge/1000)}s)`);
            return false;
          } else {
            // Lock expirado, remover
            console.log(`🧹 Removendo lock expirado: ${timeslotKey}`);
            delete allLocks[timeslotKey];
          }
        }

        // Adquirir lock
        allLocks[timeslotKey] = {
          tabId: this.currentTabId,
          timestamp: now,
          attackCount: attackCount,
          acquiredAt: new Date().toISOString()
        };
        
        localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        
        // ✅ Camada 3: Notificar via BroadcastChannel
        if (this.useBroadcast) {
          this.channel.postMessage({
            type: 'TIMESLOT_ACQUIRED',
            timeslotKey,
            tabId: this.currentTabId,
            timestamp: now,
            attackCount
          });
        }

      } catch (e) {
        console.warn('⚠️ Erro no lock global:', e);
        return false;
      }

      // ✅ Adicionar ao controle local
      this.activeTimeslots.add(timeslotKey);
      console.log(`🔒 [${this.currentTabId}] Timeslot adquirido: ${timeslotKey} para ${attackCount} ataques`);
      
      return true;
    }

    // 🔓 Liberar lock do timeslot
    releaseTimeslotLock(timeslotKey) {
      // Remover localmente
      this.activeTimeslots.delete(timeslotKey);
      
      // Remover do localStorage
      try {
        const allLocks = this.getGlobalLocks();
        if (allLocks[timeslotKey]?.tabId === this.currentTabId) {
          delete allLocks[timeslotKey];
          localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao liberar lock global:', e);
      }
      
      // Notificar via Broadcast
      if (this.useBroadcast) {
        this.channel.postMessage({
          type: 'TIMESLOT_RELEASED',
          timeslotKey,
          tabId: this.currentTabId,
          timestamp: Date.now()
        });
      }
      
      console.log(`🔓 [${this.currentTabId}] Timeslot liberado: ${timeslotKey}`);
    }

    // 🧹 Limpar locks expirados
    cleanupExpiredLocks() {
      try {
        const allLocks = this.getGlobalLocks();
        const now = Date.now();
        let changed = false;
        
        Object.keys(allLocks).forEach(timeslotKey => {
          const lock = allLocks[timeslotKey];
          if (now - lock.timestamp > 60000) { // 60 segundos
            delete allLocks[timeslotKey];
            changed = true;
            console.log(`🧹 Limpando lock expirado: ${timeslotKey}`);
          }
        });
        
        if (changed) {
          localStorage.setItem(TIMESLOT_LOCK_KEY, JSON.stringify(allLocks));
        }
      } catch (e) {
        console.warn('⚠️ Erro ao limpar locks expirados:', e);
      }
    }

    // 📋 Obter locks globais
    getGlobalLocks() {
      try {
        return JSON.parse(localStorage.getItem(TIMESLOT_LOCK_KEY) || '{}');
      } catch {
        return {};
      }
    }

    // 📥 Processar mensagens
    handleMessage(data) {
      const { type, timeslotKey, tabId, timestamp } = data;
      
      switch (type) {
        case 'TIMESLOT_ACQUIRED':
          console.log(`📥 Aba ${tabId} adquiriu timeslot: ${timeslotKey}`);
          // Adicionar ao controle local para evitar conflitos
          this.activeTimeslots.add(timeslotKey);
          break;
          
        case 'TIMESLOT_RELEASED':
          console.log(`📥 Aba ${tabId} liberou timeslot: ${timeslotKey}`);
          this.activeTimeslots.delete(timeslotKey);
          break;
      }
    }

    // 🧹 Cleanup
    cleanup() {
      // Liberar todos os locks desta aba
      this.activeTimeslots.forEach(timeslotKey => {
        this.releaseTimeslotLock(timeslotKey);
      });
      
      if (this.channel) {
        this.channel.close();
      }
    }

    // 📊 Estatísticas
    getStats() {
      const globalLocks = this.getGlobalLocks();
      return {
        tabId: this.currentTabId,
        activeTimeslots: Array.from(this.activeTimeslots),
        globalLocks: Object.keys(globalLocks).length,
        useBroadcast: this.useBroadcast
      };
    }
  }

  // ✅ Instância global
  const timeslotCoordinator = new TimeslotCoordinator();

  // === Funções utilitárias (mantidas do código anterior) ===
  function parseDateTimeToMs(str) {
    const m = str?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss).getTime();
  }

  function generateUniqueId() {
    return `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  // === SCHEDULER REESCRITO - EVITA DUPLICAÇÃO POR HORÁRIO ===
  function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    
    _schedulerInterval = setInterval(async () => {
      const list = getList();
      const now = Date.now();
      const msgs = [];
      let hasChanges = false;

      // 🎯 AGORA: Agrupar ataques por timeslot (segundo específico)
      const attacksByTimeslot = {};
      
      // Fase 1: Coletar ataques elegíveis por timeslot
      for (const attack of list) {
        if (attack.done || attack.locked) continue;
        
        const attackTime = parseDateTimeToMs(attack.datetime);
        if (!attackTime || isNaN(attackTime)) continue;
        
        const timeDiff = attackTime - now;
        
        // ✅ Só considerar ataques entre -10s e +2s do horário
        if (timeDiff <= 2000 && timeDiff >= -10000) {
          const timeslotKey = timeslotCoordinator.getTimeslotKey(attack.datetime);
          if (!timeslotKey) continue;
          
          if (!attacksByTimeslot[timeslotKey]) {
            attacksByTimeslot[timeslotKey] = [];
          }
          
          attacksByTimeslot[timeslotKey].push(attack);
        } else if (timeDiff > 0) {
          // Mostrar contagem regressiva
          const seconds = Math.ceil(timeDiff / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          msgs.push(`🕒 ${attack.origem} → ${attack.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`);
        }
      }

      // Fase 2: Processar UM timeslot de cada vez
      for (const [timeslotKey, attacks] of Object.entries(attacksByTimeslot)) {
        // 🔒 TENTAR ADQUIRIR LOCK DESTE TIMESLOT
        const acquired = await timeslotCoordinator.acquireTimeslotLock(timeslotKey, attacks.length);
        
        if (!acquired) {
          console.log(`⏭️ Pulando timeslot ${timeslotKey} (já está sendo processado)`);
          continue;
        }

        console.log(`🚀 PROCESSANDO TIMESLOT: ${timeslotKey} com ${attacks.length} ataques`);
        msgs.push(`🔥 Executando ${attacks.length} ataque(s) no horário...`);

        // ✅ EXECUTAR ATACQUES DESTE TIMESLOT EM SEQUÊNCIA
        for (let i = 0; i < attacks.length; i++) {
          const attack = attacks[i];
          
          // Marcar como locked
          attack.locked = true;
          hasChanges = true;
          setList(list);
          
          try {
            console.log(`🎯 [${i + 1}/${attacks.length}] ${attack.origem} → ${attack.alvo}`);
            
            const success = await executeAttack(attack);
            
            attack.done = true;
            attack.success = success;
            attack.executedAt = new Date().toISOString();
            hasChanges = true;
            
            console.log(`✅ [${i + 1}/${attacks.length}] Concluído`);
            msgs.push(`✅ ${attack.origem} → ${attack.alvo}`);
            
          } catch (err) {
            attack.error = err.message;
            attack.done = true;
            attack.success = false;
            hasChanges = true;
            
            console.error(`❌ [${i + 1}/${attacks.length}] Erro:`, err);
            msgs.push(`❌ ${attack.origem} → ${attack.alvo}: ${err.message}`);
          } finally {
            attack.locked = false;
            hasChanges = true;
          }
          
          // ⏳ Delay entre ataques do MESMO timeslot
          if (i < attacks.length - 1) {
            await sleep(400); // 400ms entre ataques
          }
        }

        // 🔓 LIBERAR LOCK DO TIMESLOT
        timeslotCoordinator.releaseTimeslotLock(timeslotKey);
        console.log(`🏁 TIMESLOT ${timeslotKey} CONCLUÍDO`);
        
        // ⏰ Aguardar antes do próximo timeslot (evita sobrecarga)
        await sleep(200);
      }

      // Atualizar storage se necessário
      if (hasChanges) {
        setList(list);
      }

      // Atualizar status
      const status = document.getElementById('tws-status');
      if (status) {
        status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
      }
    }, 1000); // Verificar a cada 1 segundo
    
    console.log('[TWS_Backend] ✅ SCHEDULER ANTI-DUPLICAÇÃO ATIVADO');
  }

  // === Funções auxiliares ===
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function executeAttack(cfg) {
    // ✅ SIMPLIFIQUEI para focar no anti-duplicação
    // Mantenha sua implementação original aqui
    const statusEl = document.getElementById('tws-status');
    const setStatus = (msg) => {
      try { if (statusEl) statusEl.innerHTML = msg; } catch {}
      console.log('[TWScheduler]', msg);
    };

    setStatus(`🎯 Executando: ${cfg.origem} → ${cfg.alvo}`);
    
    // Simular execução (substitua pela sua implementação)
    await sleep(500);
    
    setStatus(`✅ Concluído: ${cfg.origem} → ${cfg.alvo}`);
    return true;
  }

  // === Exportar API ===
  window.TWS_Backend = {
    getList,
    setList,
    startScheduler,
    executeAttack,
    generateUniqueId,
    timeslotCoordinator,
    STORAGE_KEY,
    
    _internal: {
      get coordinatorStats() { return timeslotCoordinator.getStats(); }
    }
  };

  console.log('[TWS_Backend] ✅ SISTEMA ANTI-DUPLICAÇÃO CARREGADO');
  console.log('[TWS_Backend] 💡 AGORA: Apenas UMA aba processa cada horário específico!');
})();
