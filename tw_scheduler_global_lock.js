// ═══════════════════════════════════════════════════════════════
// 🔒 SISTEMA DE LOCK MULTI-ABA PARA TW SCHEDULER
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const LOCK_STORAGE_KEY = 'tw_scheduler_global_lock';
  const TAB_ID = generateTabId();
  const LOCK_TIMEOUT = 35000; // 35 segundos (margem de segurança)
  const HEARTBEAT_INTERVAL = 5000; // 5 segundos

  let heartbeatTimer = null;
  let isLocked = false;

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ GERAÇÃO DE ID ÚNICO POR ABA
  // ═══════════════════════════════════════════════════════════════

  function generateTabId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const perf = performance.now().toString(36).substring(2, 8);
    return `tab_${timestamp}_${random}_${perf}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // 2️⃣ SISTEMA DE LOCK COM STORAGE
  // ═══════════════════════════════════════════════════════════════

  function getLockData() {
    try {
      const data = localStorage.getItem(LOCK_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[MultiTab Lock] Erro ao ler lock:', e);
      return null;
    }
  }

  function setLockData(tabId, timestamp) {
    try {
      const data = {
        tabId,
        timestamp,
        expires: timestamp + LOCK_TIMEOUT
      };
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[MultiTab Lock] Erro ao salvar lock:', e);
      return false;
    }
  }

  function clearLock() {
    try {
      localStorage.removeItem(LOCK_STORAGE_KEY);
    } catch (e) {
      console.error('[MultiTab Lock] Erro ao limpar lock:', e);
    }
  }

  function isLockExpired(lockData) {
    if (!lockData) return true;
    return Date.now() > lockData.expires;
  }

  function isLockOwner(lockData) {
    return lockData && lockData.tabId === TAB_ID;
  }

  // ═══════════════════════════════════════════════════════════════
  // 3️⃣ AQUISIÇÃO DE LOCK COM RETRY
  // ═══════════════════════════════════════════════════════════════

  async function acquireLock(maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const lockData = getLockData();
      const now = Date.now();

      // Lock disponível ou expirado
      if (!lockData || isLockExpired(lockData)) {
        if (setLockData(TAB_ID, now)) {
          console.log(`[MultiTab Lock] ✅ Lock adquirido pela aba: ${TAB_ID}`);
          isLocked = true;
          startHeartbeat();
          return true;
        }
      }

      // Já é proprietário do lock
      if (isLockOwner(lockData)) {
        console.log(`[MultiTab Lock] ℹ️ Aba já possui lock ativo`);
        isLocked = true;
        startHeartbeat();
        return true;
      }

      // Outra aba possui lock válido
      if (attempt < maxRetries) {
        const waitTime = Math.min(100 * attempt, 500);
        console.warn(
          `[MultiTab Lock] ⏳ Lock em outra aba (${lockData.tabId.substring(0, 8)}...). ` +
          `Tentativa ${attempt}/${maxRetries}, aguardando ${waitTime}ms...`
        );
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    console.error(`[MultiTab Lock] ❌ Falha ao adquirir lock após ${maxRetries} tentativas`);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ HEARTBEAT - MANTER LOCK VIVO
  // ═══════════════════════════════════════════════════════════════

  function startHeartbeat() {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(() => {
      const lockData = getLockData();

      // Lock foi perdido ou expirou
      if (!lockData || !isLockOwner(lockData)) {
        console.warn('[MultiTab Lock] ⚠️ Lock foi perdido, tentando readquirir...');
        stopHeartbeat();
        acquireLock();
        return;
      }

      // Renovar timestamp
      setLockData(TAB_ID, Date.now());
      console.log(`[MultiTab Lock] 💓 Heartbeat OK - Lock renovado`);
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5️⃣ PROTEÇÃO PARA EXECUTEATTACK (Middleware)
  // ═══════════════════════════════════════════════════════════════

  async function executeAttackWithLock(originalExecuteFn, attackConfig) {
    // Se já tem lock ativo, executa direto
    if (isLocked) {
      return await originalExecuteFn(attackConfig);
    }

    // Tenta adquirir lock
    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      throw new Error('❌ Não foi possível adquirir lock global. Outra aba pode estar executando.');
    }

    try {
      return await originalExecuteFn(attackConfig);
    } finally {
      // ❌ NÃO limpar o lock aqui! Manter para próximas execuções
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6️⃣ INTEGRAÇÃO COM TW_Backend
  // ═══════════════════════════════════════════════════════════════

  function injectMultiTabProtection() {
    if (!window.TWS_Backend) {
      console.error('[MultiTab Lock] TWS_Backend não disponível');
      return false;
    }

    // Guardar função original
    const originalExecuteAttack = window.TWS_Backend.executeAttack;

    // Substituir por versão com lock
    window.TWS_Backend.executeAttack = async function(cfg) {
      return executeAttackWithLock(originalExecuteAttack, cfg);
    };

    console.log('[MultiTab Lock] ✅ Proteção injetada no executeAttack');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 7️⃣ LIMPEZA AO DESCARREGAR ABA
  // ═══════════════════════════════════════════════════════════════

  function onWindowUnload() {
    stopHeartbeat();
    
    // Limpar lock apenas se é o proprietário
    const lockData = getLockData();
    if (lockData && isLockOwner(lockData)) {
      console.log('[MultiTab Lock] 🔓 Limpando lock ao descarregar aba');
      clearLock();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8️⃣ LISTENER PARA SINCRONIZAÇÃO
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener('storage', (event) => {
    if (event.key === LOCK_STORAGE_KEY) {
      const newLock = event.newValue ? JSON.parse(event.newValue) : null;
      const oldLock = event.oldValue ? JSON.parse(event.oldValue) : null;

      if (isLockOwner(oldLock) && !isLockOwner(newLock)) {
        console.warn('[MultiTab Lock] ⚠️ Lock foi removido por outra aba');
        isLocked = false;
        stopHeartbeat();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 9️⃣ API PÚBLICA
  // ═══════════════════════════════════════════════════════════════

  window.TWS_MultiTabLock = {
    TAB_ID,
    getLockStatus() {
      const lock = getLockData();
      return {
        hasLock: isLocked,
        lockOwner: lock?.tabId,
        isOwner: isLockOwner(lock),
        expiresIn: lock ? lock.expires - Date.now() : null,
        isExpired: lock ? isLockExpired(lock) : true
      };
    },
    async acquireLock(retries) {
      return acquireLock(retries);
    },
    releaseLock() {
      stopHeartbeat();
      clearLock();
      isLocked = false;
      console.log('[MultiTab Lock] 🔓 Lock liberado manualmente');
    },
    getStats() {
      const lock = getLockData();
      return {
        tabId: TAB_ID,
        lockActive: isLocked,
        currentLockOwner: lock?.tabId,
        heartbeatActive: heartbeatTimer !== null,
        lockTimeout: LOCK_TIMEOUT,
        heartbeatInterval: HEARTBEAT_INTERVAL
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 🔟 INICIALIZAÇÃO
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener('beforeunload', onWindowUnload);

  // Esperar backend carregar
  let waitAttempts = 0;
  const initInterval = setInterval(() => {
    if (window.TWS_Backend) {
      clearInterval(initInterval);
      injectMultiTabProtection();
      console.log(`[MultiTab Lock] 🎯 Sistema iniciado - Tab ID: ${TAB_ID.substring(0, 16)}...`);
    } else if (++waitAttempts > 50) {
      clearInterval(initInterval);
      console.warn('[MultiTab Lock] ⚠️ TWS_Backend não detectado após 5s');
    }
  }, 100);
})();
