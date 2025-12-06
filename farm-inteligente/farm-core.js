// ========== FARM-CORE.JS ==========
// Lógica de negócio, cálculos, validações e monitoramento
(function() {
    'use strict';
    
    if (!window.TWS_FarmInteligente) {
        window.TWS_FarmInteligente = {};
    }
    
    // === CONFIGURAÇÃO E CÁLCULOS ===
    var FarmCore = {
        getVelocidadesUnidades: function() {
            try {
                if (window.TWS_ConfigModal && window.TWS_ConfigModal.getConfig) {
                    const config = window.TWS_ConfigModal.getConfig();
                    return config.velocidadesUnidades || this.getVelocidadesPadrao();
                }
                
                const savedConfig = localStorage.getItem('tws_global_config_v2');
                if (savedConfig) {
                    const config = JSON.parse(savedConfig);
                    return config.velocidadesUnidades || this.getVelocidadesPadrao();
                }
                
                return this.getVelocidadesPadrao();
            } catch (error) {
                console.warn('[Farm] Erro ao obter velocidades:', error);
                return this.getVelocidadesPadrao();
            }
        },
        
        getVelocidadesPadrao: function() {
            return {
                spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
                light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
                knight: 10, snob: 35
            };
        },
        
        unidadesPorVelocidade: [
            'snob', 'catapult', 'ram', 'sword', 'spear', 'archer', 'axe',
            'heavy', 'light', 'marcher', 'knight', 'spy'
        ],
        
        getUnidadeMaisLenta: function(tropas) {
            for (const unidade of this.unidadesPorVelocidade) {
                if (tropas[unidade] > 0) {
                    return unidade;
                }
            }
            return null;
        },
        
        calcularDistancia: function(coord1, coord2) {
            const [x1, y1] = coord1.split('|').map(Number);
            const [x2, y2] = coord2.split('|').map(Number);
            const deltaX = Math.abs(x1 - x2);
            const deltaY = Math.abs(y1 - y2);
            return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        },
        
        calculateTravelTime: function(origem, destino, troops) {
            try {
                const distancia = this.calcularDistancia(origem, destino);
                const unidadeMaisLenta = this.getUnidadeMaisLenta(troops);
                
                if (!unidadeMaisLenta) {
                    console.warn('[Farm] Nenhuma unidade encontrada, usando padrão');
                    return 3600;
                }
                
                const velocidadesUnidades = this.getVelocidadesUnidades();
                const velocidadeBase = velocidadesUnidades[unidadeMaisLenta] || 18;
                
                const tempoMinutos = distancia * velocidadeBase;
                const tempoSegundos = tempoMinutos * 60;
                
                return Math.max(300, Math.min(tempoSegundos, 14400));
            } catch (error) {
                console.error('[Farm] Erro no cálculo de tempo:', error);
                return 3600;
            }
        },
        
        calculateReturnTime: function(origem, destino, troops) {
            return this.calculateTravelTime(destino, origem, troops);
        },
        
        // === VALIDAÇÕES ===
        validateIntervalo: function(input) {
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
        },
        
        validateFarmCreation: function(agendamento, intervalo) {
            const errors = [];
            
            if (!agendamento.origem || !agendamento.alvo) {
                errors.push('❌ Origem ou alvo inválido');
            }
            
            const TROOP_LIST = window.TWS_Backend ? window.TWS_Backend.TROOP_LIST : [];
            const hasTroops = TROOP_LIST.some(u => agendamento[u] > 0);
            if (!hasTroops) {
                errors.push('❌ Nenhuma tropa configurada');
            }

            const validation = this.validateIntervalo(intervalo);
            if (!validation.valid) {
                errors.push(validation.error);
            }

            return {
                valid: errors.length === 0,
                errors
            };
        },
        
        // === LOGGING ===
        FarmLogger: {
            history: [],
            MAX_HISTORY: 100,

            log: function(event, farm, details = {}) {
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

            getHistory: function() {
                return this.history;
            },

            exportHistory: function() {
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
        },
        
        // === GESTÃO DE DADOS ===
        getFarmList: function() {
            return JSON.parse(localStorage.getItem('tws_farm_inteligente') || '[]');
        },
        
        setFarmList: function(list) {
            localStorage.setItem('tws_farm_inteligente', JSON.stringify(list));
        },
        
        generateId: function() {
            return 'farm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },
        
        formatDateTime: function(date) {
            if (!(date instanceof Date) || isNaN(date.getTime())) {
                const fallback = new Date(Date.now() + 60000);
                const pad = (n) => n.toString().padStart(2, '0');
                return `${pad(fallback.getDate())}/${pad(fallback.getMonth() + 1)}/${fallback.getFullYear()} ${pad(fallback.getHours())}:${pad(fallback.getMinutes())}:${pad(fallback.getSeconds())}`;
            }
            
            const pad = (n) => n.toString().padStart(2, '0');
            return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        },
        
        // === CONVERSÃO DE AGENDAMENTOS ===
        convertToFarm: function(agendamentoIndex, intervalo = 5) {
            const lista = window.TWS_Backend.getList();
            
            if (agendamentoIndex < 0 || agendamentoIndex >= lista.length) {
                console.error('❌ Agendamento não encontrado!');
                return false;
            }
            
            const agendamento = lista[agendamentoIndex];
            const validation = this.validateFarmCreation(agendamento, intervalo);
            
            if (!validation.valid) {
                console.error('[Farm] Validação falhou:', validation.errors);
                alert('❌ Erro ao criar farm:\n' + validation.errors.join('\n'));
                return false;
            }
            
            if (agendamento.done) {
                agendamento.done = false;
                agendamento.success = false;
                agendamento.executedAt = null;
                agendamento.error = null;
                
                const now = new Date();
                const newDate = new Date(now.getTime() + 60000);
                agendamento.datetime = this.formatDateTime(newDate);
                
                window.TWS_Backend.setList(lista);
            }
            
            const TROOP_LIST = window.TWS_Backend.TROOP_LIST;
            const troops = {};
            TROOP_LIST.forEach(u => {
                troops[u] = agendamento[u] || 0;
            });
            
            const farm = {
                id: this.generateId(),
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
                lastReturnTime: null,
                failedAttempts: 0
            };
            
            const farms = this.getFarmList();
            farms.push(farm);
            this.setFarmList(farms);
            
            this.FarmLogger.log('CREATED', farm, { intervalo });
            console.log(`[Farm] ✅ Agendamento convertido: ${farm.origem} → ${farm.alvo}`);
            return true;
        },
        
        convertPorFiltro: function(filtro, intervalo = 5) {
            const lista = window.TWS_Backend.getList();
            const TROOP_LIST = window.TWS_Backend.TROOP_LIST;
            
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
            
            let success = 0;
            let errors = 0;
            
            agendamentosIds.forEach(id => {
                if (this.convertToFarm(id, intervalo)) {
                    success++;
                } else {
                    errors++;
                }
            });
            
            return { success, errors };
        },
        
        // === MONITORAMENTO ===
        verificarFarmsAtrasados: function() {
            const lista = window.TWS_Backend.getList();
            const farms = this.getFarmList().filter(f => !f.paused && f.active !== false);
            const now = Date.now();
            
            let atrasosDetectados = 0;
            
            farms.forEach(farm => {
                if (farm.agendamentoBaseId >= lista.length) return;
                
                const agendamentoBase = lista[farm.agendamentoBaseId];
                if (!agendamentoBase || agendamentoBase.done || agendamentoBase.locked) return;
                
                try {
                    const nextRun = farm.nextRun ? window.TWS_Backend.parseDateTimeToMs(farm.nextRun) : null;
                    
                    if (nextRun && nextRun < now) {
                        atrasosDetectados++;
                        
                        if (atrasosDetectados <= 3) {
                            console.log(`[Farm] ⏰ Farm atrasado: ${farm.origem} → ${farm.alvo} (${Math.floor((now - nextRun) / 60000)} min atrás)`);
                        }
                        
                        if (!agendamentoBase.status || !agendamentoBase.status.includes('Atrasado')) {
                            agendamentoBase.status = 'delayed';
                            agendamentoBase.statusText = `⏰ ${Math.floor((now - nextRun) / 60000)} min atrás`;
                            agendamentoBase.error = 'Horário no passado - Use "Enviar Agora" para executar';
                            
                            this.FarmLogger.log('DELAYED_DETECTED', farm, { 
                                nextRun: farm.nextRun,
                                atrasoMs: now - nextRun,
                                atrasoMinutos: Math.floor((now - nextRun) / 60000)
                            });
                        }
                    }
                } catch (error) {
                    console.error('[Farm] Erro ao verificar farm atrasado:', error);
                }
            });
            
            if (atrasosDetectados > 0) {
                window.TWS_Backend.setList(lista);
            }
        },
        
        monitorAgendamentosParaFarm: function() {
            const lista = window.TWS_Backend.getList();
            const farms = this.getFarmList().filter(f => !f.paused && f.active !== false);
            
            farms.forEach(farm => {
                if (farm.agendamentoBaseId >= lista.length) return;
                
                const agendamentoBase = lista[farm.agendamentoBaseId];
                if (!agendamentoBase) return;
                
                if (agendamentoBase.done) {
                    this.FarmLogger.log('CYCLE_COMPLETED', farm, { 
                        success: agendamentoBase.success,
                        failedAttempts: farm.failedAttempts || 0
                    });
                    
                    farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                    farm.stats.lastRun = new Date().toISOString();
                    
                    const now = new Date();
                    
                    try {
                        if (agendamentoBase.success) {
                            farm.stats.successRuns = (farm.stats.successRuns || 0) + 1;
                            farm.failedAttempts = 0;
                            
                            const travelTimeToTarget = this.calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                            const returnTime = this.calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                            
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
                                nextRunTime = new Date(retornoEstimado.getTime() + (farm.intervalo || 5) * 60000);
                            }
                            
                            const novoAgendamento = {
                                ...agendamentoBase,
                                datetime: this.formatDateTime(nextRunTime),
                                done: false,
                                success: false,
                                executedAt: null,
                                error: null
                            };
                            
                            lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                            window.TWS_Backend.setList(lista);
                            
                            farm.nextRun = novoAgendamento.datetime;
                            farm.lastReturnTime = returnTime;
                            
                        } else {
                            farm.failedAttempts = (farm.failedAttempts || 0) + 1;
                            const retryIntervals = [1, 2, 5];
                            const maxAttempts = retryIntervals.length;
                            
                            if (farm.failedAttempts <= maxAttempts) {
                                const retryMinutes = retryIntervals[farm.failedAttempts - 1];
                                const nextRunTime = new Date(now.getTime() + retryMinutes * 60000);
                                
                                const novoAgendamento = {
                                    ...agendamentoBase,
                                    datetime: this.formatDateTime(nextRunTime),
                                    done: false,
                                    success: false,
                                    executedAt: null,
                                    error: `Tentativa ${farm.failedAttempts}/${maxAttempts} - ${agendamentoBase.error || 'Falha desconhecida'}`
                                };
                                
                                lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                                window.TWS_Backend.setList(lista);
                                
                                farm.nextRun = novoAgendamento.datetime;
                                
                            } else {
                                farm.paused = true;
                                farm.nextRun = "⏸️ PAUSADO - Muitas falhas consecutivas";
                                
                                const novoAgendamento = {
                                    ...agendamentoBase,
                                    done: false,
                                    success: false,
                                    error: `PAUSADO - ${maxAttempts} falhas consecutivas - ${agendamentoBase.error || 'Falha desconhecida'}`
                                };
                                
                                lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
                                window.TWS_Backend.setList(lista);
                            }
                        }
                        
                        const updatedFarms = this.getFarmList();
                        const farmIdx = updatedFarms.findIndex(f => f.id === farm.id);
                        if (farmIdx !== -1) {
                            updatedFarms[farmIdx] = farm;
                            this.setFarmList(updatedFarms);
                        }
                        
                    } catch (error) {
                        console.error('[Farm] Erro no processamento:', error);
                    }
                }
            });
        },
        
        iniciarMonitorConfig: function() {
            let ultimaConfig = JSON.stringify(this.getVelocidadesUnidades());
            
            setInterval(() => {
                const configAtual = JSON.stringify(this.getVelocidadesUnidades());
                if (configAtual !== ultimaConfig) {
                    console.log('[Farm] Configurações de velocidade alteradas, recalculando...');
                    ultimaConfig = configAtual;
                    this.recarregarVelocidades();
                }
            }, 10000);
        },
        
        recarregarVelocidades: function() {
            console.log('[Farm] Recarregando velocidades das unidades');
            
            const farms = this.getFarmList().filter(f => !f.paused && f.active !== false);
            const lista = window.TWS_Backend.getList();
            
            farms.forEach(farm => {
                if (farm.agendamentoBaseId >= lista.length) return;
                
                const agendamento = lista[farm.agendamentoBaseId];
                if (!agendamento || agendamento.done) return;
                
                const travelTimeToTarget = this.calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                const returnTime = this.calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                const totalCycleTime = travelTimeToTarget + returnTime + (farm.intervalo * 60);
                
                const now = new Date();
                const nextRunTime = new Date(now.getTime() + (totalCycleTime * 1000));
                farm.nextRun = this.formatDateTime(nextRunTime);
                farm.lastReturnTime = returnTime;
            });
            
            this.setFarmList(this.getFarmList());
            console.log('[Farm] Velocidades recarregadas para', farms.length, 'farms');
        }
    };
    
    // Exportar para namespace global
    window.TWS_FarmInteligente.Core = FarmCore;
    
})();
