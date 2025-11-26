(function () {
  'use strict';

  // === SISTEMA DE CÁLCULO DO PAINEL DE ATAQUES ===
  const velocidadesUnidades = {
      spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
      light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
      knight: 10, snob: 35
  };

  const unidadesPorVelocidade = [
      'snob', 'catapult', 'ram', 'sword', 'spear', 'archer', 'axe',
      'heavy', 'light', 'marcher', 'knight', 'spy'
  ];

  function getUnidadeMaisLenta(tropas) {
      for (const unidade of unidadesPorVelocidade) {
          if (tropas[unidade] > 0) {
              return unidade;
          }
      }
      return null;
  }

  // ✅ DISTÂNCIA EUCLIDIANA (CORRETA PARA TW)
  function calcularDistancia(coord1, coord2) {
      const [x1, y1] = coord1.split('|').map(Number);
      const [x2, y2] = coord2.split('|').map(Number);
      const deltaX = Math.abs(x1 - x2);
      const deltaY = Math.abs(y1 - y2);
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  // ✅ CALCULA TEMPO DE VIAGEM
  function calculateTravelTime(origem, destino, troops) {
      try {
          const distancia = calcularDistancia(origem, destino);
          const unidadeMaisLenta = getUnidadeMaisLenta(troops);
          
          if (!unidadeMaisLenta) {
              console.warn('[Farm] Nenhuma unidade encontrada, usando padrão');
              return 3600;
          }
          
          const velocidadeBase = velocidadesUnidades[unidadeMaisLenta];
          const tempoMinutos = distancia * velocidadeBase;
          const tempoSegundos = tempoMinutos * 60;
          
          console.log(`[Farm] Cálculo: ${distancia.toFixed(2)} campos × ${velocidadeBase} min/campo (${unidadeMaisLenta}) = ${tempoMinutos.toFixed(1)} min`);
          
          return Math.max(300, Math.min(tempoSegundos, 14400));
          
      } catch (error) {
          console.error('[Farm] Erro no cálculo de tempo:', error);
          return 3600;
      }
  }

  function calculateReturnTime(origem, destino, troops) {
      return calculateTravelTime(destino, origem, troops);
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #1 VALIDAÇÃO FORTE DO INTERVALO
  // ═════════════════════════════════════════════════════════

  function validateIntervalo(input) {
      const intervalo = parseInt(input);
      
      if (isNaN(intervalo)) {
          return { valid: false, error: '❌ Digite um número válido!', default: 5 };
      }
      
      if (intervalo < 1) {
          return { valid: false, error: '❌ Mínimo: 1 minuto!', default: 5 };
      }
      
      if (intervalo > 1440) {
          return { valid: false, error: '⚠️ Máximo recomendado: 1440 minutos (24h)', default: 1440 };
      }
      
      if (intervalo > 300) {
          return { 
              valid: true, 
              warning: `⚠️ Intervalo longo: ${intervalo} minutos = ${(intervalo/60).toFixed(1)} horas`, 
              value: intervalo 
          };
      }
      
      return { valid: true, value: intervalo };
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #2 LOGGING MELHORADO
  // ═════════════════════════════════════════════════════════

  const FarmLogger = {
      history: [],
      MAX_HISTORY: 100,

      log(event, farm, details = {}) {
          const entry = {
              timestamp: new Date().toISOString(),
              event,
              farmId: farm?.id || 'unknown',
              farmInfo: farm ? `${farm.origem}→${farm.alvo}` : '',
              ...details
          };

          this.history.push(entry);
          if (this.history.length > this.MAX_HISTORY) {
              this.history.shift();
          }

          console.log(`[Farm] [${event}] ${entry.farmInfo}`, details);
      },

      getHistory() {
          return this.history;
      },

      exportHistory() {
          const csv = [
              ['Timestamp', 'Event', 'Farm ID', 'Info'],
              ...this.history.map(e => [e.timestamp, e.event, e.farmId, e.farmInfo])
          ].map(row => row.map(cell => `"${cell}"`).join(','))
           .join('\n');

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `farm_history_${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
      }
  };

  // ═════════════════════════════════════════════════════════
  // ✅ #3 SINCRONIZAÇÃO FARM ↔ AGENDAMENTO
  // ═════════════════════════════════════════════════════════

  const FarmSyncManager = {
      
      sync(farm, agendamento) {
          if (farm.paused && !agendamento.locked) {
              agendamento.locked = true;
              FarmLogger.log('PAUSED_SYNC', farm, { locked: true });
          }
          
          if (!farm.paused && agendamento.locked && !agendamento.done) {
              agendamento.locked = false;
              FarmLogger.log('RESUMED_SYNC', farm, { locked: false });
          }
          
          return { farm, agendamento };
      },

      updateAndSync(farmId, updates) {
          const farms = getFarmList();
          const farmIdx = farms.findIndex(f => f.id === farmId);
          
          if (farmIdx === -1) {
              console.error(`[Sync] Farm não encontrado: ${farmId}`);
              return false;
          }

          const farm = farms[farmIdx];
          const lista = getList();
          const agendamento = lista[farm.agendamentoBaseId];

          if (!agendamento) {
              console.error(`[Sync] Agendamento orfão: ${farm.agendamentoBaseId}`);
              farms.splice(farmIdx, 1);
              setFarmList(farms);
              FarmLogger.log('DELETED_ORPHAN', farm);
              return false;
          }

          Object.assign(farm, updates);
          this.sync(farm, agendamento);

          farms[farmIdx] = farm;
          lista[farm.agendamentoBaseId] = agendamento;
          
          setFarmList(farms);
          setList(lista);

          return true;
      }
  };

  // ═════════════════════════════════════════════════════════
  // ✅ #4 CLEANUP DE FARMS ÓRFÃS
  // ═════════════════════════════════════════════════════════

  function cleanupOrphanFarms() {
      const lista = getList();
      const farms = getFarmList();
      
      const validFarms = farms.filter(farm => {
          if (farm.agendamentoBaseId >= lista.length) {
              console.warn(`[Cleanup] Farm órfão deletado: ${farm.id}`);
              FarmLogger.log('CLEANUP_ORPHAN', farm);
              return false;
          }
          
          const agendamento = lista[farm.agendamentoBaseId];
          
          if (!agendamento) {
              console.warn(`[Cleanup] Farm sem agendamento: ${farm.id}`);
              FarmLogger.log('CLEANUP_INVALID', farm);
              return false;
          }
          
          return true;
      });

      if (validFarms.length < farms.length) {
          console.log(`[Cleanup] ${farms.length - validFarms.length} farm(s) orfã(s) removida(s)`);
          setFarmList(validFarms);
      }
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #5 VALIDAÇÃO AO CRIAR FARM
  // ═════════════════════════════════════════════════════════

  function validateFarmCreation(agendamento, intervalo) {
      const errors = [];

      if (!agendamento.origem || !agendamento.alvo) {
          errors.push('❌ Origem ou alvo inválido');
      }
      
      const hasTroops = TROOP_LIST.some(u => agendamento[u] > 0);
      if (!hasTroops) {
          errors.push('❌ Nenhuma tropa configurada');
      }

      const validation = validateIntervalo(intervalo);
      if (!validation.valid) {
          errors.push(validation.error);
      }

      const farms = getFarmList();
      if (farms.some(f => 
          f.origem === agendamento.origem && 
          f.alvo === agendamento.alvo &&
          !f.paused
      )) {
          errors.push('⚠️ Já existe um farm ativo com mesma origem/alvo');
      }

      return {
          valid: errors.length === 0,
          errors
      };
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #6 FUNÇÃO ENVIAR AGORA (NOVA)
  // ═════════════════════════════════════════════════════════

// ✅ FUNÇÃO ENVIAR AGORA (CORREÇÃO ESPECÍFICA)
function enviarFarmAgora(farmId) {
    const farms = getFarmList();
    const farm = farms.find(f => f.id === farmId);
    
    if (!farm) {
        alert('❌ Farm não encontrado!');
        return false;
    }

    const lista = getList();
    const agendamento = lista[farm.agendamentoBaseId];
    
    if (!agendamento) {
        alert('❌ Agendamento base não encontrado!');
        return false;
    }

    if (agendamento.locked) {
        alert('⚠️ Este farm já está em processo de envio!');
        return false;
    }

    // ✅ CONFIRMAÇÃO
    if (!confirm(`🚀 ENVIAR FARM AGORA?\n\n📍 ${farm.origem} → ${farm.alvo}\n🪖 ${Object.entries(farm.troops).filter(([_, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}\n\nEsta ação enviará as tropas imediatamente.`)) {
        return false;
    }

    try {
        // ✅ MARCAR COMO EXECUTANDO
        agendamento.locked = true;
        agendamento.status = 'executing';
        agendamento.statusText = '🔥 Enviando Agora...';
        
        FarmLogger.log('MANUAL_SEND_ATTEMPT', farm);
        
        // ✅ EXECUTAR O ATAQUE
        executeAttack(agendamento)
            .then(success => {
                if (success) {
                    // ✅ SUCESSO - Atualizar estados
                    agendamento.done = true;
                    agendamento.success = true;
                    agendamento.executedAt = new Date().toISOString();
                    agendamento.status = 'sent';
                    agendamento.statusText = '✅ Enviado (Manual)';
                    
                    farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                    farm.stats.successRuns = (farm.stats.successRuns || 0) + 1;
                    farm.stats.lastRun = new Date().toISOString();
                    
                    FarmLogger.log('MANUAL_SEND_SUCCESS', farm);
                    
                    // ✅ CORREÇÃO: CÁLCULO SIMPLIFICADO E CONSISTENTE
                    const now = new Date();
                    const travelTimeToTarget = calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                    const returnTime = calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                    
                    // ✅ CORREÇÃO: Usar o mesmo cálculo do sistema automático
                    // Tempo total do ciclo: ida + volta + intervalo
                    const totalCycleTime = travelTimeToTarget + returnTime + (farm.intervalo * 60);
                    
                    // Próximo envio: agora + tempo total do ciclo
                    let nextRunTime = new Date(now.getTime() + (totalCycleTime * 1000));
                    
                    // ✅ ATUALIZAR DATETIME PARA PRÓXIMO CICLO
                    agendamento.datetime = formatDateTime(nextRunTime);
                    agendamento.done = false;
                    agendamento.success = false;
                    agendamento.executedAt = null;
                    agendamento.error = null;
                    
                    farm.nextRun = agendamento.datetime;
                    farm.lastReturnTime = returnTime;
                    
                    FarmLogger.log('MANUAL_NEXT_CYCLE', farm, { 
                        nextRun: farm.nextRun,
                        travelTime: travelTimeToTarget,
                        returnTime: returnTime,
                        totalCycleTime: totalCycleTime,
                        intervalo: farm.intervalo
                    });
                    
                    alert(`✅ FARM ENVIADO COM SUCESSO!\n\n${farm.origem} → ${farm.alvo}\nPróximo ciclo: ${farm.nextRun}`);
                    
                } else {
                    // ❌ FALHA - CORREÇÃO: manter o agendamento para tentar novamente
                    agendamento.done = false; // ✅ CORREÇÃO: Não marcar como done em caso de falha
                    agendamento.success = false;
                    agendamento.status = 'failed';
                    agendamento.statusText = '❌ Falha (Manual)';
                    agendamento.error = 'Falha no envio manual';
                    
                    farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                    farm.stats.lastRun = new Date().toISOString();
                    
                    FarmLogger.log('MANUAL_SEND_FAILED', farm);
                    alert(`❌ FALHA NO ENVIO MANUAL!\n\nVerifique as tropas e tente novamente.`);
                }
                
                // ✅ SEMPRE LIBERAR O LOCK (mesmo em caso de falha)
                agendamento.locked = false;
                
                // ✅ SALVAR ALTERAÇÕES
                setList(lista);
                
                const updatedFarms = getFarmList();
                const farmIdx = updatedFarms.findIndex(f => f.id === farm.id);
                if (farmIdx !== -1) {
                    updatedFarms[farmIdx] = farm;
                    setFarmList(updatedFarms);
                }
                
                // ✅ ATUALIZAR UI
                window.dispatchEvent(new CustomEvent('tws-farm-updated'));
                window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
                
                if (document.getElementById('farm-list-container')) {
                    document.getElementById('farm-list-container').innerHTML = renderFarmList();
                }
                
            })
            .catch(error => {
                // ❌ ERRO NA EXECUÇÃO - CORREÇÃO: não marcar como done
                console.error('[Farm] Erro no envio manual:', error);
                
                agendamento.done = false; // ✅ CORREÇÃO: Maniver como pendente
                agendamento.success = false;
                agendamento.locked = false;
                agendamento.status = 'failed';
                agendamento.statusText = '❌ Erro (Manual)';
                agendamento.error = error.message;
                
                farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                farm.stats.lastRun = new Date().toISOString();
                
                FarmLogger.log('MANUAL_SEND_ERROR', farm, { error: error.message });
                
                setList(lista);
                setFarmList(farms);
                
                alert(`❌ ERRO NO ENVIO MANUAL!\n\n${error.message}\n\nO farm permanecerá ativo para tentar novamente.`);
                
                if (document.getElementById('farm-list-container')) {
                    document.getElementById('farm-list-container').innerHTML = renderFarmList();
                }
            });
        
        return true;
        
    } catch (error) {
        console.error('[Farm] Erro no processo manual:', error);
        alert(`❌ ERRO CRÍTICO: ${error.message}`);
        return false;
    }
}

  // ═════════════════════════════════════════════════════════
  // BACKEND ORIGINAL (Integrado com melhorias)
  // ═════════════════════════════════════════════════════════

  if (!window.TWS_Backend) {
    console.error('[TW Farm Inteligente] Backend não carregado!');
    return;
  }

  const {
    parseCoord,
    parseDateTimeToMs,
    getList,
    setList,
    TROOP_LIST,
    executeAttack
  } = window.TWS_Backend;

  function formatDateTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      const fallback = new Date(Date.now() + 60000);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(fallback.getDate())}/${pad(fallback.getMonth() + 1)}/${fallback.getFullYear()} ${pad(fallback.getHours())}:${pad(fallback.getMinutes())}:${pad(fallback.getSeconds())}`;
    }
    
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function generateId() {
    return 'farm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getFarmList() {
    return JSON.parse(localStorage.getItem('tws_farm_inteligente') || '[]');
  }

  function setFarmList(list) {
    localStorage.setItem('tws_farm_inteligente', JSON.stringify(list));
  }

  // ✅ CONVERSÃO COM VALIDAÇÃO COMPLETA
  function convertToFarm(agendamentoIndex, intervalo = 5) {
    const lista = getList();
    
    if (agendamentoIndex < 0 || agendamentoIndex >= lista.length) {
        console.error('❌ Agendamento não encontrado!');
        return false;
    }
    
    const agendamento = lista[agendamentoIndex];

    // ✅ VALIDAR ANTES DE CONVERTER
    const validation = validateFarmCreation(agendamento, intervalo);
    if (!validation.valid) {
        console.error('[Farm] Validação falhou:', validation.errors);
        alert('❌ Erro ao criar farm:\n' + validation.errors.join('\n'));
        return false;
    }
    
    const farms = getFarmList();
    const jaExiste = farms.find(f => f.agendamentoBaseId === agendamentoIndex);
    if (jaExiste) {
        console.warn('❌ Este agendamento já é um Farm Inteligente!');
        return false;
    }
    
    if (agendamento.done) {
        agendamento.done = false;
        agendamento.success = false;
        agendamento.executedAt = null;
        agendamento.error = null;
        
        const now = new Date();
        const newDate = new Date(now.getTime() + 60000);
        agendamento.datetime = formatDateTime(newDate);
        
        setList(lista);
    }
    
    const troops = {};
    TROOP_LIST.forEach(u => {
        troops[u] = agendamento[u] || 0;
    });
    
    const farm = {
        id: generateId(),
        agendamentoBaseId: agendamentoIndex,
        origem: agendamento.origem,
        alvo: agendamento.alvo,
        troops: troops,
        intervalo: parseInt(intervalo) || 5,
        paused: false,
        active: true,
        stats: { totalRuns: 0, successRuns: 0, lastRun: null },
        nextRun: agendamento.datetime,
        created: new Date().toISOString(),
        lastReturnTime: null
    };
    
    farms.push(farm);
    setFarmList(farms);
    
    FarmLogger.log('CREATED', farm, { intervalo });
    console.log(`[Farm] ✅ Agendamento convertido: ${farm.origem} → ${farm.alvo}`);
    return true;
  }

  // ✅ CONVERSÃO EM MASSA COM VALIDAÇÃO
  function convertAgendamentosEmMassa(agendamentosIds, intervalo = 5) {
    const validation = validateIntervalo(intervalo);
    if (!validation.valid) {
        return {
            success: 0,
            errors: agendamentosIds.length,
            details: agendamentosIds.map(id => ({
                id,
                status: 'error',
                message: validation.error
            }))
        };
    }

    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    agendamentosIds.forEach(agendamentoId => {
      try {
        const success = convertToFarm(agendamentoId, intervalo);
        if (success) {
          results.success++;
          results.details.push({
            id: agendamentoId,
            status: 'success',
            message: 'Convertido com sucesso'
          });
          FarmLogger.log('CONVERSION_SUCCESS', null, { agendamentoId });
        } else {
          results.errors++;
          results.details.push({
            id: agendamentoId,
            status: 'error',
            message: 'Falha na conversão'
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          id: agendamentoId,
          status: 'error',
          message: `Erro: ${error.message}`
        });
        FarmLogger.log('CONVERSION_ERROR', null, { agendamentoId, error: error.message });
      }
    });

    return results;
  }

  function convertTodosPendentes(intervalo = 5) {
    const lista = getList();
    const agendamentosPendentes = lista
      .map((agendamento, index) => ({ agendamento, index }))
      .filter(({ agendamento }) => !agendamento.done);

    const agendamentosIds = agendamentosPendentes.map(({ index }) => index);
    
    return convertAgendamentosEmMassa(agendamentosIds, intervalo);
  }

  function convertPorFiltro(filtro, intervalo = 5) {
    const lista = getList();
    
    const agendamentosFiltrados = lista
      .map((agendamento, index) => ({ agendamento, index }))
      .filter(({ agendamento }) => {
        if (agendamento.done) return false;
        
        if (filtro.origem && !agendamento.origem.includes(filtro.origem)) {
          return false;
        }
        
        if (filtro.alvo && !agendamento.alvo.includes(filtro.alvo)) {
          return false;
        }
        
        if (filtro.temTropas) {
          const temTropas = TROOP_LIST.some(u => agendamento[u] > 0);
          if (!temTropas) return false;
        }
        
        return true;
      });

    const agendamentosIds = agendamentosFiltrados.map(({ index }) => index);
    
    return convertAgendamentosEmMassa(agendamentosIds, intervalo);
  }

  // ✅ MONITOR COM CLEANUP AUTOMÁTICO
function monitorAgendamentosParaFarm() {
    cleanupOrphanFarms();
    
    const lista = getList();
    const farms = getFarmList().filter(f => !f.paused && f.active !== false);
    
    farms.forEach(farm => {
        if (farm.agendamentoBaseId >= lista.length) {
            console.warn(`[Monitor] Índice inválido: ${farm.agendamentoBaseId}`);
            FarmSyncManager.updateAndSync(farm.id, { active: false });
            return;
        }

        const agendamentoBase = lista[farm.agendamentoBaseId];
        
        if (!agendamentoBase) {
            console.warn(`[Monitor] Agendamento não encontrado: ${farm.id}`);
            return;
        }
        
        // ✅ ALTERAÇÃO AQUI: Processa tanto sucesso quanto falha
        if (agendamentoBase.done) {
            FarmLogger.log('CYCLE_COMPLETED', farm, { 
                success: agendamentoBase.success,
                failedAttempts: farm.failedAttempts || 0
            });
            
            farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
            farm.stats.lastRun = new Date().toISOString();
            
            const now = new Date();
            
            try {
                if (agendamentoBase.success) {
                    // ✅ SUCESSO - Ciclo normal
                    farm.stats.successRuns = (farm.stats.successRuns || 0) + 1;
                    farm.failedAttempts = 0; // Resetar contador de falhas
                    
                    const travelTimeToTarget = calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                    const returnTime = calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                    
                    let baseTime;
                    
                    if (agendamentoBase.executedAt) {
                        baseTime = new Date(agendamentoBase.executedAt);
                    } else {
                        const tempoIdaMs = travelTimeToTarget * 1000;
                        baseTime = new Date(now.getTime() + tempoIdaMs);
                    }
                    
                    const intervaloMs = (farm.intervalo || 5) * 60 * 1000;
                    let nextRunTime = new Date(baseTime.getTime() + (returnTime * 1000) + intervaloMs);
                    
                    const retornoEstimado = new Date(now.getTime() + (travelTimeToTarget * 1000) + (returnTime * 1000));
                    
                    if (nextRunTime < retornoEstimado) {
                        console.warn(`[Farm] Ajuste: próximo era antes do retorno`);
                        nextRunTime = new Date(retornoEstimado.getTime() + (farm.intervalo || 5) * 60000);
                    }
                    
                    const novoAgendamento = {
                        ...agendamentoBase,
                        datetime: formatDateTime(nextRunTime),
                        done: false,
                        success: false,
                        executedAt: null,
                        error: null
                    };
                    
                    lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                    setList(lista);
                    
                    farm.nextRun = novoAgendamento.datetime;
                    farm.lastReturnTime = returnTime;
                    
                    FarmLogger.log('NEXT_CYCLE_SUCCESS', farm, { 
                        nextRun: farm.nextRun, 
                        travelTime: travelTimeToTarget, 
                        returnTime 
                    });
                    
                } else {
                    // ❌ FALHA - Tentativas escalonadas
                    farm.failedAttempts = (farm.failedAttempts || 0) + 1;
                    
                    // 🎯 ESCALONAMENTO: 1min, 2min, 5min, depois pausa
                    const retryIntervals = [1, 2, 5]; // minutos
                    const maxAttempts = retryIntervals.length;
                    
                    if (farm.failedAttempts <= maxAttempts) {
                        const retryMinutes = retryIntervals[farm.failedAttempts - 1];
                        const nextRunTime = new Date(now.getTime() + retryMinutes * 60000);
                        
                        const novoAgendamento = {
                            ...agendamentoBase,
                            datetime: formatDateTime(nextRunTime),
                            done: false,
                            success: false,
                            executedAt: null,
                            error: `Tentativa ${farm.failedAttempts}/${maxAttempts} - ${agendamentoBase.error || 'Falha desconhecida'}`
                        };
                        
                        lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                        setList(lista);
                        
                        farm.nextRun = novoAgendamento.datetime;
                        
                        FarmLogger.log('RETRY_SCHEDULED', farm, { 
                            attempt: farm.failedAttempts,
                            nextRun: farm.nextRun,
                            retryMinutes: retryMinutes
                        });
                        
                        console.warn(`[Farm] ❌ Falha ${farm.failedAttempts}/${maxAttempts} - Reagendando para ${farm.nextRun}`);
                        
                    } else {
                        // 🛑 MUITAS FALHAS - Pausar automaticamente
                        farm.paused = true;
                        farm.nextRun = "⏸️ PAUSADO - Muitas falhas consecutivas";
                        
                        const novoAgendamento = {
                            ...agendamentoBase,
                            done: false,
                            success: false,
                            error: `PAUSADO - ${maxAttempts} falhas consecutivas - ${agendamentoBase.error || 'Falha desconhecida'}`
                        };
                        
                        lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                        setList(lista);
                        
                        FarmLogger.log('AUTO_PAUSED', farm, { 
                            attempts: farm.failedAttempts,
                            reason: 'Muitas falhas consecutivas'
                        });
                        
                        console.error(`[Farm] 🛑 Pausado automaticamente após ${maxAttempts} falhas: ${farm.origem} → ${farm.alvo}`);
                    }
                }
                
                // ✅ ATUALIZAR FARM (em ambos os casos)
                const updatedFarms = getFarmList();
                const farmIdx = updatedFarms.findIndex(f => f.id === farm.id);
                if (farmIdx !== -1) {
                    updatedFarms[farmIdx] = farm;
                    setFarmList(updatedFarms);
                }
                
            } catch (error) {
                console.error('[Farm] Erro no processamento:', error);
                FarmLogger.log('PROCESS_ERROR', farm, { error: error.message });
            }
        }
    });
}


//=======================
  
  function renderFarmList() {
    const farms = getFarmList().filter(f => f.active !== false);
    const listaAgendamentos = getList();
    
    if (farms.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">🌾</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum farm inteligente ativo</div>
          <small>Use as opções abaixo para converter agendamentos em farms automáticos</small>
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 10px;">';
    
    farms.forEach((farm) => {
      const now = Date.now();
      let nextRun = null;
      
      try {
        nextRun = farm.nextRun ? parseDateTimeToMs(farm.nextRun) : null;
      } catch (e) {
        console.error('[Farm] Erro ao parsear data:', farm.nextRun);
      }
      
      const status = farm.paused ? 'pausado' : (nextRun && nextRun > now ? 'agendado' : 'ativo');
      
      let statusColor = '#4CAF50';
      let statusText = '🟢 Ativo';
      
      if (farm.paused) {
        statusColor = '#FF9800';
        statusText = '⏸️ Pausado';
      } else if (nextRun && nextRun > now) {
        statusColor = '#2196F3';
        statusText = '⏰ Agendado';
      }

      const stats = farm.stats || { totalRuns: 0, successRuns: 0 };
      
      const agendamentoBase = listaAgendamentos[farm.agendamentoBaseId];
      const baseStatus = agendamentoBase ? 
        (agendamentoBase.done ? 
          (agendamentoBase.success ? '✅ Concluído' : '❌ Falhou') : 
          '⏳ Pendente') : 
        '❓ Agendamento não encontrado';
      
      let tempoRestante = '';
      if (nextRun && nextRun > now) {
        const diffMs = nextRun - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        
        if (diffHours > 0) {
          tempoRestante = `${diffHours}h ${remainingMins}m`;
        } else {
          tempoRestante = `${diffMins}m`;
        }
      }
      
      const distancia = calcularDistancia(farm.origem, farm.alvo);
      const unidadeMaisLenta = getUnidadeMaisLenta(farm.troops);
      const velocidade = unidadeMaisLenta ? velocidadesUnidades[unidadeMaisLenta] : 0;
      const tempoIda = distancia * velocidade;
      const tempoVolta = tempoIda;
      const tempoTotalCiclo = tempoIda + tempoVolta;
      
      html += `
        <div style="
          background: white;
          border: 3px solid ${statusColor};
          border-radius: 8px;
          padding: 15px;
          transition: all 0.3s;
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #8B4513; font-size: 16px;">
                ${farm.origem} → ${farm.alvo}
              </div>
              <div style="color: #666; font-size: 12px; margin-top: 4px;">
                🪖 ${Object.entries(farm.troops).filter(([_, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ') || 'Nenhuma'}
              </div>
              <div style="color: #888; font-size: 11px; margin-top: 2px;">
                📋 ${baseStatus} | ⏰ Ciclo: ${farm.intervalo} min
                ${farm.lastReturnTime ? `| 🔄 Retorno: ${Math.round(farm.lastReturnTime/60)}min` : ''}
              </div>
              <div style="color: #666; font-size: 10px; margin-top: 2px;">
                📏 Dist: ${distancia.toFixed(1)} | 🐌 ${unidadeMaisLenta}: ${velocidade}min/campo 
              </div>
              <div style="color: #888; font-size: 10px; margin-top: 1px;">
                ⏱️ Ida: ${Math.round(tempoIda)}min | Volta: ${Math.round(tempoVolta)}min | Total: ${Math.round(tempoTotalCiclo)}min
              </div>

          ${farm.failedAttempts ? `<div style="color: #FF6B6B; font-size: 10px; margin-top: 2px;">🔄 Tentativa
          ${farm.failedAttempts}/3</div>` : ''}
              
            </div>
            <div style="
              background: ${statusColor};
              color: white;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              min-width: 80px;
              text-align: center;
            ">
              ${statusText}
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; color: #666;">
            <div>
              <strong>Próximo envio:</strong><br>
              ${farm.nextRun || 'Calculando...'}
              ${tempoRestante ? `<br><small>⏱️ ${tempoRestante}</small>` : ''}
            </div>
            <div>
              <strong>Estatísticas:</strong><br>
              ${stats.totalRuns} ciclos (${stats.successRuns} sucessos)
              ${stats.lastRun ? `<br><small>Último: ${new Date(stats.lastRun).toLocaleTimeString()}</small>` : ''}
            </div>
          </div>
          
          <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
            <!-- BOTÃO ENVIAR AGORA (NOVO) -->
            <button onclick="TWS_FarmInteligente._enviarAgora('${farm.id}')" style="
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              background: #2196F3;
              color: white;
              font-size: 11px;
              cursor: pointer;
              transition: all 0.2s;
              font-weight: bold;
            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"
            title="Forçar envio imediato (útil em caso de falhas)">
              🚀 Enviar Agora
            </button>
            
            <button onclick="TWS_FarmInteligente._toggleFarm('${farm.id}')" style="
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              background: ${farm.paused ? '#4CAF50' : '#FF9800'};
              color: white;
              font-size: 11px;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
              ${farm.paused ? '▶️ Retomar' : '⏸️ Pausar'}
            </button>
            
            <button onclick="TWS_FarmInteligente._deleteFarm('${farm.id}')" style="
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              background: #F44336;
              color: white;
              font-size: 11px;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  function startFarmMonitor() {
    setInterval(monitorAgendamentosParaFarm, 10000);
    setInterval(cleanupOrphanFarms, 60000);
    console.log('[Farm Inteligente] ✅ Monitor iniciado com cleanup automático!');
  }

  function showFarmModal() {
    const existing = document.getElementById('tws-farm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tws-farm-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #E8F5E8 0%, #C8E6C9 100%);
      border: 3px solid #4CAF50;
      border-radius: 12px;
      padding: 0;
      width: 90%;
      max-width: 900px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease;
      display: flex;
      flex-direction: column;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: scale(0.9) translateY(-20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        .farm-btn { padding: 12px 16px; border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; font-size: 14px; margin: 5px; transition: all 0.3s; }
        .farm-btn:hover { transform: scale(1.05); opacity: 0.9; }
        .btn-primary { background: #2196F3; }
        .btn-success { background: #4CAF50; }
        .btn-warning { background: #FF9800; }
        .btn-danger { background: #F44336; }
        .btn-info { background: #9C27B0; }
      </style>

      <!-- Cabeçalho -->
      <div style="background: #4CAF50; padding: 20px; text-align: center; border-bottom: 3px solid #388E3C;">
        <div style="font-size: 24px; font-weight: bold; color: white;">🌾 FARM INTELIGENTE v2.0</div>
        <div style="color: #E8F5E8; font-size: 14px; margin-top: 5px;">
          Sistema automático com validação completa, logging e cleanup
        </div>
      </div>

      <!-- Conteúdo -->
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #155724;">
          <strong>✨ MELHORIAS APLICADAS:</strong><br>
          ✅ Validação forte de intervalo (1-1440 min)<br>
          ✅ Logging detalhado de eventos<br>
          ✅ Sincronização farm ↔ agendamento<br>
          ✅ Cleanup automático de farms órfãs<br>
          ✅ Tratamento de erros robusto<br>
          ✅ 🚀 BOTÃO "ENVIAR AGORA" para falhas
        </div>

        <!-- Botões de Conversão em Massa -->
        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; color: #388E3C; margin-bottom: 10px; font-size: 16px;">🔄 CONVERSÃO EM MASSA:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button class="farm-btn btn-success" onclick="TWS_FarmInteligente._convertTodosPendentes()">
              📋 Converter Todos Pendentes
            </button>
            <button class="farm-btn btn-primary" onclick="TWS_FarmInteligente._showFiltroModal()">
              🔍 Converter por Filtro
            </button>
            <button class="farm-btn btn-warning" onclick="TWS_FarmInteligente._showIdsModal()">
              🔢 Converter IDs Específicos
            </button>
            <button class="farm-btn btn-info" onclick="TWS_FarmInteligente._convertAgendamento()">
              ✨ Converter Individual
            </button>
            <button class="farm-btn btn-danger" onclick="TWS_FarmInteligente._exportLogs()">
              📊 Exportar Logs (CSV)
            </button>
            <button class="farm-btn btn-primary" onclick="TWS_FarmInteligente._viewStats()">
              📈 Ver Estatísticas
            </button>
          </div>
        </div>

        <div id="farm-list-container">
          ${renderFarmList()}
        </div>
      </div>

      <!-- Rodapé -->
      <div style="background: #f5f5f5; padding: 15px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        Farm Inteligente v2.0 | Total: ${getFarmList().filter(f => f.active !== false).length} farms ativos | Eventos: ${FarmLogger.history.length}
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Funções expostas
    const farmFunctions = {
      _toggleFarm(id) {
        const farms = getFarmList();
        const farm = farms.find(f => f.id === id);
        if (farm) {
          farm.paused = !farm.paused;
          const lista = getList();
          const agendamento = lista[farm.agendamentoBaseId];
          if (agendamento) {
            FarmSyncManager.sync(farm, agendamento);
            setList(lista);
          }
          setFarmList(farms);
          FarmLogger.log(farm.paused ? 'PAUSED' : 'RESUMED', farm);
          document.getElementById('farm-list-container').innerHTML = renderFarmList();
        }
      },

      _deleteFarm(id) {
        if (confirm('Tem certeza que deseja excluir este farm inteligente?\n\nO agendamento original será mantido.')) {
          const farms = getFarmList();
          const farm = farms.find(f => f.id === id);
          if (farm) {
            FarmLogger.log('DELETED', farm);
          }
          const updatedFarms = farms.filter(f => f.id !== id);
          setFarmList(updatedFarms);
          document.getElementById('farm-list-container').innerHTML = renderFarmList();
        }
      },

      _enviarAgora(id) {
        if (enviarFarmAgora(id)) {
          // Fechar modal após sucesso?
          // Opcional: this._closeModal();
        }
      },

      _convertAgendamento() {
        const lista = getList();
        const pendentes = lista.filter(a => !a.done);
        
        if (pendentes.length === 0) {
          alert('❌ Nenhum agendamento pendente encontrado!');
          return;
        }
        
        let mensagem = '📋 SELECIONE UM AGENDAMENTO PARA CONVERTER EM FARM:\n\n';
        pendentes.forEach((agend, idx) => {
          const listaIdx = lista.findIndex(a => a === agend);
          const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
          const distancia = calcularDistancia(agend.origem, agend.alvo);
          
          mensagem += `[${idx + 1}] ${agend.origem} → ${agend.alvo}\n`;
          mensagem += `   📅 ${agend.datetime} | 🪖 ${tropas}\n`;
          mensagem += `   📏 ${distancia.toFixed(1)} campos\n\n`;
        });
        
        mensagem += 'Digite o número do agendamento:';
        
        const escolha = prompt(mensagem);
        if (escolha === null) return;
        
        const idxEscolhido = parseInt(escolha) - 1;
        
        if (idxEscolhido >= 0 && idxEscolhido < pendentes.length) {
          const agendamentoEscolhido = pendentes[idxEscolhido];
          const listaIdx = lista.findIndex(a => a === agendamentoEscolhido);
          
          let intervalo = null;
          while (intervalo === null) {
            const input = prompt('⏰ Intervalo entre ciclos (minutos)?\n\n✅ Recomendado: 5-30 min\n⚠️ Máximo: 1440 min (24h)', '5');
            if (input === null) return;
            
            const validation = validateIntervalo(input);
            
            if (!validation.valid) {
              alert(validation.error);
              continue;
            }
            
            if (validation.warning) {
              const confirm = prompt(validation.warning + '\n\nConfirmar? (S/N)', 'S');
              if (confirm?.toUpperCase() !== 'S') continue;
            }
            
            intervalo = validation.value;
          }
          
          if (convertToFarm(listaIdx, intervalo)) {
            alert(`✅ AGENDAMENTO CONVERTIDO EM FARM!\n\n🎯 ${agendamentoEscolhido.origem} → ${agendamentoEscolhido.alvo}\n⏰ Ciclo: ${intervalo} minutos`);
            document.getElementById('farm-list-container').innerHTML = renderFarmList();
          }
        } else {
          alert('❌ Número inválido!');
        }
      },

      _convertTodosPendentes() {
        const lista = getList();
        const pendentes = lista.filter(a => !a.done);
        
        if (pendentes.length === 0) {
          alert('❌ Nenhum agendamento pendente!');
          return;
        }

        let intervalo = null;
        while (intervalo === null) {
          const input = prompt(
            `⏰ CONVERTER ${pendentes.length} AGENDAMENTOS\n\n` +
            'Intervalo entre ciclos (minutos)?\n\n' +
            '✅ Recomendado: 5-30 min\n' +
            '⚠️ Máximo: 1440 min (24h)',
            '5'
          );
          if (input === null) return;
          
          const validation = validateIntervalo(input);
          
          if (!validation.valid) {
            alert(validation.error);
            continue;
          }
          
          if (validation.warning) {
            const confirm = prompt(validation.warning + '\n\nConfirmar? (S/N)', 'S');
            if (confirm?.toUpperCase() !== 'S') continue;
          }
          
          intervalo = validation.value;
        }
        
        const results = convertTodosPendentes(intervalo);
        
        alert(`✅ CONVERSÃO EM MASSA CONCLUÍDA!\n\n📊 Resultados:\n• ✅ ${results.success} convertidos com sucesso\n• ❌ ${results.errors} erros\n\nTotal de farms ativos: ${getFarmList().filter(f => f.active !== false).length}`);
        document.getElementById('farm-list-container').innerHTML = renderFarmList();
      },

      _showFiltroModal() {
        const filtroModal = document.createElement('div');
        filtroModal.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 1000000;
          min-width: 400px;
        `;

        filtroModal.innerHTML = `
          <h3 style="margin-top: 0; color: #388E3C;">🔍 Converter por Filtro</h3>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Origem (opcional):</label>
            <input type="text" id="filtro-origem" placeholder="Ex: 500|500" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Alvo (opcional):</label>
            <input type="text" id="filtro-alvo" placeholder="Ex: barb" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">
              <input type="checkbox" id="filtro-temTropas" checked>
              Apenas agendamentos com tropas
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Intervalo (minutos):</label>
            <input type="number" id="filtro-intervalo" value="5" min="1" max="1440" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 16px; background: #9E9E9E; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
            <button onclick="TWS_FarmInteligente._aplicarFiltro()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Aplicar Filtro</button>
          </div>
        `;

        document.body.appendChild(filtroModal);
      },

      _aplicarFiltro() {
        const origem = document.getElementById('filtro-origem')?.value || '';
        const alvo = document.getElementById('filtro-alvo')?.value || '';
        const temTropas = document.getElementById('filtro-temTropas')?.checked;
        const intervalo = parseInt(document.getElementById('filtro-intervalo')?.value) || 5;

        const validation = validateIntervalo(intervalo);
        if (!validation.valid) {
          alert(validation.error);
          return;
        }

        const filtro = { origem, alvo, temTropas };
        const results = convertPorFiltro(filtro, intervalo);

        const modals = document.querySelectorAll('div[style*="position: fixed"]');
        modals.forEach(m => {
          if (m.textContent.includes('Converter por Filtro')) m.remove();
        });

        alert(`✅ CONVERSÃO POR FILTRO CONCLUÍDA!\n\n📊 Resultados:\n• ✅ ${results.success} convertidos\n• ❌ ${results.errors} erros\n\nFiltros:\n• Origem: ${origem || 'Qualquer'}\n• Alvo: ${alvo || 'Qualquer'}\n• Com tropas: ${temTropas ? 'Sim' : 'Não'}`);
        document.getElementById('farm-list-container').innerHTML = renderFarmList();
      },

      _showIdsModal() {
        const lista = getList();
        let mensagemIds = '📋 AGENDAMENTOS DISPONÍVEIS:\n\n';
        lista.forEach((agend, index) => {
          if (!agend.done) {
            const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
            mensagemIds += `ID ${index}: ${agend.origem} → ${agend.alvo} | ${tropas}\n`;
          }
        });

        const ids = prompt(`🆔 CONVERTER IDs ESPECÍFICOS\n\n${mensagemIds}\n\nDigite os IDs separados por vírgula:\nEx: 0, 3, 5, 7`);
        if (ids === null) return;

        const idsArray = ids.split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id) && id >= 0 && id < lista.length && !lista[id].done);

        if (idsArray.length === 0) {
          alert('❌ Nenhum ID válido encontrado!');
          return;
        }

        let intervalo = null;
        while (intervalo === null) {
          const input = prompt(`⏰ Intervalo para ${idsArray.length} farms (minutos):`, '5');
          if (input === null) return;
          
          const validation = validateIntervalo(input);
          if (!validation.valid) {
            alert(validation.error);
            continue;
          }
          intervalo = validation.value;
        }

        const results = convertAgendamentosEmMassa(idsArray, intervalo);

        alert(`✅ CONVERSÃO DE IDs CONCLUÍDA!\n\n📊 Resultados:\n• ✅ ${results.success} convertidos\n• ❌ ${results.errors} erros\n\nIDs: ${idsArray.join(', ')}`);
        document.getElementById('farm-list-container').innerHTML = renderFarmList();
      },

      _exportLogs() {
        FarmLogger.exportHistory();
        alert('✅ Histórico de eventos exportado como CSV!');
      },

      _viewStats() {
        const farms = getFarmList();
        const stats = {
          total: farms.length,
          active: farms.filter(f => !f.paused && f.active !== false).length,
          paused: farms.filter(f => f.paused).length,
          totalCycles: farms.reduce((a, b) => a + (b.stats?.totalRuns || 0), 0),
          successCycles: farms.reduce((a, b) => a + (b.stats?.successRuns || 0), 0),
          events: FarmLogger.history.length
        };

        alert(
          '📊 ESTATÍSTICAS DO FARM INTELIGENTE\n\n' +
          `Total de Farms: ${stats.total}\n` +
          `Ativos: ${stats.active}\n` +
          `Pausados: ${stats.paused}\n\n` +
          `Ciclos Total: ${stats.totalCycles}\n` +
          `Ciclos Sucesso: ${stats.successCycles}\n` +
          `Taxa de Sucesso: ${stats.totalCycles > 0 ? ((stats.successCycles / stats.totalCycles) * 100).toFixed(1) : 0}%\n\n` +
          `Eventos Registrados: ${stats.events}`
        );
      }
    };

    Object.assign(window.TWS_FarmInteligente, farmFunctions);

    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove(); 
      }
    };
  }

  // === INICIALIZAÇÃO ===
  function init() {
    if (!window.TWS_FarmInteligente) {
      window.TWS_FarmInteligente = {};
    }
    
    window.TWS_FarmInteligente.show = showFarmModal;
    window.TWS_FarmInteligente.convertToFarm = convertToFarm;
    window.TWS_FarmInteligente.convertAgendamentosEmMassa = convertAgendamentosEmMassa;
    window.TWS_FarmInteligente.convertTodosPendentes = convertTodosPendentes;
    window.TWS_FarmInteligente.convertPorFiltro = convertPorFiltro;
    window.TWS_FarmInteligente._getFarmList = getFarmList;
    window.TWS_FarmInteligente.FarmLogger = FarmLogger;
    window.TWS_FarmInteligente._enviarAgora = enviarFarmAgora;
    
    startFarmMonitor();
    
    console.log('[TW Farm Inteligente] ✅ Carregado v2.0 - Com Validação, Logging, Cleanup e Botão Enviar Agora!');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
