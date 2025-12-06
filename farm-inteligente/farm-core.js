// ========== FARM-CORE.JS ==========
// Lógica de negócio, cálculos, validações e monitoramento
// ATUALIZADO COM VELOCITY MANAGER INTEGRADO
(function() {
    'use strict';
    
    // ============================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS E INICIALIZAÇÃO
    // ============================================
    
    // Verificar se jQuery está disponível
    if (typeof jQuery === 'undefined') {
        console.error('❌ [Farm] jQuery não encontrado! Sistema não será inicializado.');
        return;
    }
    
    // Criar namespace se não existir
    if (!window.TWS_FarmInteligente) {
        window.TWS_FarmInteligente = {};
    }
    
    // Verificar se VelocityManager foi carregado (dependência opcional)
    if (!window.TWS_FarmInteligente.VelocityManager) {
        console.warn('⚠️ [Farm] VelocityManager não encontrado. Usando velocidades padrão/estáticas.');
        
        // Criar um placeholder mínimo para não quebrar o sistema
        window.TWS_FarmInteligente.VelocityManager = {
            getVelocidadesParaFarmCore: function() {
                return null; // Força usar fallback
            },
            getCurrentSpeeds: function() {
                return null;
            },
            forceRefresh: function() {
                console.log('[Farm] VelocityManager não disponível para refresh');
            }
        };
    }
    
    // ============================================
    // MÓDULO PRINCIPAL FARM CORE
    // ============================================
    
    var FarmCore = {
        // === CONFIGURAÇÃO E CÁLCULOS ===
        
        /**
         * OBTÉM VELOCIDADES DAS UNIDADES COM PRIORIDADES:
         * 1. Velocity Manager (velocidades reais do mundo atual)
         * 2. Configuração do usuário (TWS_ConfigModal)
         * 3. LocalStorage (configuração salva)
         * 4. Valores padrão (fallback seguro)
         */
        getVelocidadesUnidades: function() {
            try {
                // 1. PRIORIDADE: Velocity Manager (velocidades reais em tempo real)
                if (window.TWS_FarmInteligente.VelocityManager) {
                    const realSpeeds = window.TWS_FarmInteligente.VelocityManager.getVelocidadesParaFarmCore();
                    if (realSpeeds && Object.keys(realSpeeds).length > 0) {
                        console.log('[Farm] ✅ Usando velocidades REAIS do mundo atual');
                        return realSpeeds;
                    }
                }
                
                // 2. Configuração do modal do usuário
                if (window.TWS_ConfigModal && window.TWS_ConfigModal.getConfig) {
                    const config = window.TWS_ConfigModal.getConfig();
                    if (config.velocidadesUnidades) {
                        console.log('[Farm] Usando velocidades da configuração do modal');
                        return config.velocidadesUnidades;
                    }
                }
                
                // 3. Configuração salva no localStorage
                const savedConfig = localStorage.getItem('tws_global_config_v2');
                if (savedConfig) {
                    try {
                        const config = JSON.parse(savedConfig);
                        if (config.velocidadesUnidades) {
                            console.log('[Farm] Usando velocidades do localStorage');
                            return config.velocidadesUnidades;
                        }
                    } catch (e) {
                        console.warn('[Farm] Erro ao parsear config do localStorage:', e);
                    }
                }
                
                // 4. Fallback para valores padrão
                console.log('[Farm] Usando velocidades padrão (fallback)');
                return this.getVelocidadesPadrao();
                
            } catch (error) {
                console.warn('[Farm] Erro ao obter velocidades:', error);
                return this.getVelocidadesPadrao();
            }
        },
        
        /**
         * VELOCIDADES PADRÃO (fallback seguro)
         * Estes valores são usados se nenhuma outra fonte estiver disponível
         */
        getVelocidadesPadrao: function() {
            return {
                spear: 18,      // 18 minutos por campo
                sword: 22,      // 22 minutos por campo
                axe: 18,
                archer: 18,
                spy: 9,
                light: 10,
                marcher: 10,
                heavy: 11,
                ram: 30,
                catapult: 30,
                knight: 10,
                snob: 35,
                militia: 0.017  // ~1 segundo por campo
            };
        },
        
        /**
         * ORDEM DAS UNIDADES POR VELOCIDADE (do mais lento ao mais rápido)
         * Snob é o mais lento (35 min/campo), Spy é o mais rápido (9 min/campo)
         */
        unidadesPorVelocidade: [
            'snob',     // 35 min/campo (mais lento)
            'catapult', // 30
            'ram',      // 30
            'sword',    // 22
            'spear',    // 18
            'archer',   // 18
            'axe',      // 18
            'heavy',    // 11
            'light',    // 10
            'marcher',  // 10
            'knight',   // 10
            'spy'       // 9 min/campo (mais rápido)
        ],
        
        /**
         * IDENTIFICA A UNIDADE MAIS LENTA EM UM GRUPO DE TROPAS
         * O tempo de viagem é determinado pela unidade mais lenta
         */
        getUnidadeMaisLenta: function(tropas) {
            for (const unidade of this.unidadesPorVelocidade) {
                if (tropas[unidade] > 0) {
                    return unidade;
                }
            }
            return null;
        },
        
        /**
         * CALCULA DISTÂNCIA EUCLIDIANA ENTRE DUAS COORDENADAS
         * Fórmula: √((x2-x1)² + (y2-y1)²)
         */
        calcularDistancia: function(coord1, coord2) {
            const [x1, y1] = coord1.split('|').map(Number);
            const [x2, y2] = coord2.split('|').map(Number);
            const deltaX = Math.abs(x1 - x2);
            const deltaY = Math.abs(y1 - y2);
            return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        },
        
        /**
         * CALCULA TEMPO DE VIAGEM (IDA)
         * Fórmula: tempo(segundos) = distância × velocidade_unidade × 60
         */
        calculateTravelTime: function(origem, destino, troops) {
            try {
                const distancia = this.calcularDistancia(origem, destino);
                const unidadeMaisLenta = this.getUnidadeMaisLenta(troops);
                
                if (!unidadeMaisLenta) {
                    console.warn('[Farm] Nenhuma unidade encontrada, usando tempo padrão (1h)');
                    return 3600;
                }
                
                const velocidadesUnidades = this.getVelocidadesUnidades();
                const velocidadeBase = velocidadesUnidades[unidadeMaisLenta] || 18;
                
                // Log detalhado para debug
                const tempoMinutos = distancia * velocidadeBase;
                const tempoSegundos = tempoMinutos * 60;
                
                console.log(`[Farm] 📊 Cálculo de tempo:`);
                console.log(`  Origem: ${origem} → Destino: ${destino}`);
                console.log(`  Distância: ${distancia.toFixed(2)} campos`);
                console.log(`  Unidade mais lenta: ${unidadeMaisLenta}`);
                console.log(`  Velocidade: ${velocidadeBase} min/campo`);
                console.log(`  Tempo: ${tempoMinutos.toFixed(1)} min = ${this.formatSeconds(tempoSegundos)}`);
                
                // Limites de segurança: mínimo 5min, máximo 4h
                const result = Math.max(300, Math.min(tempoSegundos, 14400));
                
                // Informações adicionais do Velocity Manager
                if (window.TWS_FarmInteligente.VelocityManager) {
                    const worldInfo = window.TWS_FarmInteligente.VelocityManager.getWorldInfo();
                    if (worldInfo && worldInfo.world) {
                        console.log(`[Farm] Mundo: ${worldInfo.world}, Fonte: ${worldInfo.speeds ? 'REAL' : 'CACHE/FALLBACK'}`);
                    }
                }
                
                return result;
                
            } catch (error) {
                console.error('[Farm] Erro no cálculo de tempo:', error);
                return 3600; // Fallback: 1 hora
            }
        },
        
        /**
         * CALCULA TEMPO DE RETORNO (VOLTA)
         * Mesmo cálculo, mas invertendo origem/destino
         */
        calculateReturnTime: function(origem, destino, troops) {
            return this.calculateTravelTime(destino, origem, troops);
        },
        
        /**
         * FORMATADOR DE SEGUNDOS PARA STRING LEGÍVEL
         */
        formatSeconds: function(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        },
        
        /**
         * ATUALIZA VELOCIDADES DO MUNDO REAL
         * Método público para forçar sincronização
         */
        updateVelocitiesFromRealWorld: function() {
            if (window.TWS_FarmInteligente.VelocityManager) {
                console.log('[Farm] 🔄 Solicitando atualização de velocidades do mundo real...');
                window.TWS_FarmInteligente.VelocityManager.forceRefresh();
                
                // Recalcular todos os farms após atualização
                setTimeout(() => {
                    this.recarregarVelocidades();
                    console.log('[Farm] ✅ Todos os farms recalculados com novas velocidades');
                }, 3000);
                
                return true;
            }
            
            console.warn('[Farm] VelocityManager não disponível para atualização');
            return false;
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
        
        // === LOGGING E MONITORAMENTO ===
        
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

                // Adicionar contexto de velocidades se disponível
                if (window.TWS_FarmInteligente.VelocityManager && farm) {
                    const worldInfo = window.TWS_FarmInteligente.VelocityManager.getWorldInfo();
                    if (worldInfo) {
                        entry.world = worldInfo.world;
                        entry.velocitySource = worldInfo.speeds ? 'REAL' : 'CACHE/FALLBACK';
                    }
                }

                console.log(`[Farm] [${event}] ${entry.farmInfo}`, details);
            },

            getHistory: function() {
                return this.history;
            },

            exportHistory: function() {
                const csv = [
                    ['Timestamp', 'Event', 'Farm ID', 'Info', 'World', 'Velocity Source'],
                    ...this.history.map(e => [
                        e.timestamp, 
                        e.event, 
                        e.farmId, 
                        e.farmInfo,
                        e.world || 'unknown',
                        e.velocitySource || 'unknown'
                    ])
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
            
            // Calcular tempo inicial com velocidades atuais
            const travelTimeToTarget = this.calculateTravelTime(agendamento.origem, agendamento.alvo, troops);
            const returnTime = this.calculateReturnTime(agendamento.origem, agendamento.alvo, troops);
            
            const farm = {
                id: this.generateId(),
                agendamentoBaseId: agendamentoIndex,
                origem: agendamento.origem,
                alvo: agendamento.alvo,
                troops: troops,
                intervalo: parseInt(intervalo) || 5,
                paused: false,
                active: true,
                stats: { 
                    totalRuns: 0, 
                    successRuns: 0, 
                    lastRun: null,
                    initialTravelTime: travelTimeToTarget,
                    initialReturnTime: returnTime
                },
                nextRun: agendamento.datetime,
                created: new Date().toISOString(),
                lastReturnTime: returnTime,
                failedAttempts: 0,
                velocitySource: this.getVelocitySourceInfo()
            };
            
            const farms = this.getFarmList();
            farms.push(farm);
            this.setFarmList(farms);
            
            this.FarmLogger.log('CREATED', farm, { 
                intervalo,
                travelTime: this.formatSeconds(travelTimeToTarget),
                returnTime: this.formatSeconds(returnTime)
            });
            
            console.log(`[Farm] ✅ Agendamento convertido para farm: ${farm.origem} → ${farm.alvo}`);
            console.log(`[Farm] ⏱️ Tempos: Ida ${this.formatSeconds(travelTimeToTarget)}, Volta ${this.formatSeconds(returnTime)}`);
            
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
            
            console.log(`[Farm] Convertendo ${agendamentosIds.length} agendamentos para farms...`);
            
            agendamentosIds.forEach(id => {
                if (this.convertToFarm(id, intervalo)) {
                    success++;
                } else {
                    errors++;
                }
            });
            
            console.log(`[Farm] ✅ Conversão concluída: ${success} sucessos, ${errors} erros`);
            
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
                            
                            // RECALCULAR tempos com velocidades ATUAIS
                            const travelTimeToTarget = this.calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                            const returnTime = this.calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                            
                            farm.stats.lastTravelTime = travelTimeToTarget;
                            farm.stats.lastReturnTime = returnTime;
                            
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
                            
                            console.log(`[Farm] 🔄 Farm recalculado: ${farm.origem} → ${farm.alvo}`);
                            console.log(`[Farm] ⏱️ Novos tempos: Ida ${this.formatSeconds(travelTimeToTarget)}, Volta ${this.formatSeconds(returnTime)}`);
                            
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
        
        // === GESTÃO DE VELOCIDADES ===
        
        /**
         * INICIA MONITORAMENTO DE CONFIGURAÇÕES
         * Verifica mudanças nas velocidades a cada 10 segundos
         */
        iniciarMonitorConfig: function() {
            let ultimaConfig = JSON.stringify(this.getVelocidadesUnidades());
            
            setInterval(() => {
                const configAtual = JSON.stringify(this.getVelocidadesUnidades());
                if (configAtual !== ultimaConfig) {
                    console.log('[Farm] ⚠️ Configurações de velocidade alteradas, recalculando...');
                    ultimaConfig = configAtual;
                    this.recarregarVelocidades();
                }
            }, 10000);
        },
        
        /**
         * RECARREGA TODOS OS FARMS COM VELOCIDADES ATUAIS
         * Método chamado quando velocidades são alteradas
         */
        recarregarVelocidades: function() {
            console.log('[Farm] 🔄 Recarregando velocidades das unidades...');
            
            const farms = this.getFarmList().filter(f => !f.paused && f.active !== false);
            const lista = window.TWS_Backend.getList();
            
            if (farms.length === 0) {
                console.log('[Farm] Nenhum farm ativo para recarregar');
                return;
            }
            
            let recalculados = 0;
            
            farms.forEach(farm => {
                if (farm.agendamentoBaseId >= lista.length) return;
                
                const agendamento = lista[farm.agendamentoBaseId];
                if (!agendamento || agendamento.done) return;
                
                // Recalcular tempos com velocidades atuais
                const travelTimeToTarget = this.calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                const returnTime = this.calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                const totalCycleTime = travelTimeToTarget + returnTime + (farm.intervalo * 60);
                
                const now = new Date();
                const nextRunTime = new Date(now.getTime() + (totalCycleTime * 1000));
                
                farm.nextRun = this.formatDateTime(nextRunTime);
                farm.lastReturnTime = returnTime;
                farm.stats.lastRecalculation = new Date().toISOString();
                farm.velocitySource = this.getVelocitySourceInfo();
                
                recalculados++;
                
                console.log(`[Farm] ↻ Farm ${farm.origem}→${farm.alvo}: ${this.formatSeconds(totalCycleTime)} total`);
            });
            
            this.setFarmList(this.getFarmList());
            console.log(`[Farm] ✅ ${recalculados} farms recarregados com velocidades atualizadas`);
            
            // Notificar UI se disponível
            if (window.TWS_FarmInteligente.UI && window.TWS_FarmInteligente.UI.refreshFarmList) {
                window.TWS_FarmInteligente.UI.refreshFarmList();
            }
        },
        
        /**
         * OBTÉM INFORMAÇÕES SOBRE A FONTE DAS VELOCIDADES
         */
        getVelocitySourceInfo: function() {
            if (window.TWS_FarmInteligente.VelocityManager) {
                const worldInfo = window.TWS_FarmInteligente.VelocityManager.getWorldInfo();
                if (worldInfo) {
                    return {
                        world: worldInfo.world,
                        source: worldInfo.speeds ? 'REAL' : 'CACHE',
                        lastUpdate: worldInfo.lastUpdate ? new Date(worldInfo.lastUpdate).toLocaleString() : null
                    };
                }
            }
            
            return {
                world: 'unknown',
                source: 'FALLBACK',
                lastUpdate: new Date().toLocaleString()
            };
        },
        
        /**
         * EXPORTA RELATÓRIO DE VELOCIDADES
         */
        exportVelocityReport: function() {
            const velocities = this.getVelocidadesUnidades();
            const sourceInfo = this.getVelocitySourceInfo();
            
            const report = {
                generated: new Date().toISOString(),
                source: sourceInfo,
                velocities: velocities,
                farmsCount: this.getFarmList().length,
                activeFarms: this.getFarmList().filter(f => !f.paused && f.active !== false).length
            };
            
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `velocity_report_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('[Farm] 📄 Relatório de velocidades exportado');
            
            return report;
        }
    };
    
    // ============================================
    // INICIALIZAÇÃO AUTOMÁTICA
    // ============================================
    
    // Aguardar o DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFarmCore);
    } else {
        initializeFarmCore();
    }
    
    function initializeFarmCore() {
        // Aguardar um pouco para garantir que o jogo carregou
        setTimeout(() => {
            console.log('[Farm] 🚀 Farm Core inicializando...');
            
            // Exportar para namespace global
            window.TWS_FarmInteligente.Core = FarmCore;
            
            // Iniciar monitoramento
            FarmCore.iniciarMonitorConfig();
            
            // Verificar farms atrasados a cada minuto
            setInterval(() => FarmCore.verificarFarmsAtrasados(), 60000);
            
            // Monitorar agendamentos a cada 30 segundos
            setInterval(() => FarmCore.monitorAgendamentosParaFarm(), 30000);
            
            console.log('[Farm] ✅ Farm Core inicializado com sucesso!');
            console.log('[Farm] 📊 Fonte de velocidades:', FarmCore.getVelocitySourceInfo());
            
            // Exibir velocidades atuais no console
            const velocities = FarmCore.getVelocidadesUnidades();
            console.log('[Farm] 🏃 Velocidades atuais:', velocities);
            
        }, 2000);
    }
    
})();
