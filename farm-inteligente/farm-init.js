// ========== FARM-INIT.JS ==========
// VERSÃO CORRIGIDA - Aguarda Velocity Manager
(function() {
    'use strict';
    
    console.log('[Farm Init] ⏳ Aguardando inicialização segura...');
    
    // FUNÇÃO PRINCIPAL COM WAIT PARA VELOCITY MANAGER
    async function initializeFarmSystem() {
        console.log('[Farm Init] 🔄 Iniciando sistema...');
        
        // 1. Aguardar backend
        await waitForModule('TWS_Backend', 10, 500);
        
        // 2. Aguardar Velocity Manager ter velocidades (CRÍTICO!)
        await waitForVelocities();
        
        // 3. Verificar módulos do Farm
        if (!window.TWS_FarmInteligente || !window.TWS_FarmInteligente.Core) {
            console.error('[Farm Init] ❌ Farm Core não carregado!');
            return;
        }
        
        if (!window.TWS_FarmInteligente.UI) {
            console.error('[Farm Init] ❌ Farm UI não carregada!');
            return;
        }
        
        // 4. LOG DAS VELOCIDADES REAIS
        const velocidades = window.TWS_FarmInteligente.Core.getVelocidadesUnidades();
        const sourceInfo = window.TWS_FarmInteligente.Core.getVelocitySourceInfo();
        
        console.log(`[Farm Init] 📊 Velocidades: ${sourceInfo.source} (${sourceInfo.world || 'desconhecido'})`);
        
        // Verificar se são velocidades reais ou padrão
        if (sourceInfo.source === 'REAL' || sourceInfo.source === 'CACHE') {
            console.log('[Farm Init] ✅ Usando velocidades do mundo real');
            console.log(`[Farm Init] 📏 Snob: ${velocidades.snob} min/campo (esperado: 35 para brp10)`);
            
            // Validar velocidades do brp10
            if (velocidades.snob === 35 && velocidades.ram === 30) {
                console.log('[Farm Init] 🎯 Velocidades VALIDADAS para brp10!');
            } else {
                console.warn('[Farm Init] ⚠️ Velocidades podem não ser do brp10');
            }
        } else {
            console.warn('[Farm Init] ⚠️ Usando velocidades padrão/fallback');
        }
        
        // 5. Adicionar função "Enviar Agora"
        window.TWS_FarmInteligente._enviarAgora = enviarFarmAgora;
        
        // 6. Configurar função de exibição
        window.TWS_FarmInteligente.show = function() {
            return window.TWS_FarmInteligente.UI.showModal();
        };
        
        // 7. Iniciar monitoramento
        startFarmMonitoring();
        
        // 8. Adicionar botão na interface
        addFarmButtonToUI();
        
        console.log('[Farm Inteligente] ✅ Sistema inicializado com velocidades atualizadas!');
    }
    
    // AGUARDAR MÓDULO ESPECÍFICO
    async function waitForModule(modulePath, maxAttempts = 10, delay = 500) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const exists = modulePath.split('.').reduce((obj, key) => obj && obj[key], window);
            
            if (exists) {
                console.log(`[Farm Init] ✅ ${modulePath} carregado (tentativa ${attempt + 1})`);
                return true;
            }
            
            if (attempt < maxAttempts - 1) {
                console.log(`[Farm Init] ⏳ Aguardando ${modulePath}... (${attempt + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw new Error(`Timeout aguardando ${modulePath}`);
    }
    
    // AGUARDAR VELOCIDADES DO VELOCITY MANAGER
    async function waitForVelocities(maxAttempts = 15, delay = 500) {
        console.log('[Farm Init] 🔄 Aguardando velocidades do Velocity Manager...');
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Verificar se Velocity Manager está carregado
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.VelocityManager) {
                const worldInfo = window.TWS_FarmInteligente.VelocityManager.getWorldInfo();
                
                // Verificar se tem velocidades válidas
                if (worldInfo && worldInfo.speeds && Object.keys(worldInfo.speeds).length >= 10) {
                    console.log(`[Farm Init] ✅ Velocidades obtidas (${Object.keys(worldInfo.speeds).length} unidades)`);
                    return true;
                }
                
                // Verificar se está buscando (pode estar em progresso)
                if (worldInfo && worldInfo.world) {
                    console.log(`[Farm Init] 🔍 Velocity Manager ativo no mundo: ${worldInfo.world}`);
                }
            }
            
            if (attempt < maxAttempts - 1) {
                const remaining = (maxAttempts - attempt - 1) * delay / 1000;
                console.log(`[Farm Init] ⏳ Aguardando velocidades... (${attempt + 1}/${maxAttempts}) - ${remaining}s restantes`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.warn('[Farm Init] ⚠️ Timeout aguardando velocidades. Usando fallback.');
        return false;
    }
    
    // FUNÇÃO "ENVIAR AGORA" (mantida igual)
    function enviarFarmAgora(farmId) {
        if (!window.TWS_FarmInteligente || !window.TWS_FarmInteligente.Core) {
            alert('❌ Sistema de farm não carregado!');
            return false;
        }
        
        const farms = window.TWS_FarmInteligente.Core.getFarmList();
        const farm = farms.find(f => f.id === farmId);
        
        if (!farm) {
            alert('❌ Farm não encontrado!');
            return false;
        }

        const lista = window.TWS_Backend.getList();
        const agendamento = lista[farm.agendamentoBaseId];
        
        if (!agendamento) {
            alert('❌ Agendamento base não encontrado!');
            return false;
        }

        if (!confirm(`🚀 ENVIAR FARM AGORA?\n\n📍 ${farm.origem} → ${farm.alvo}\n🪖 ${Object.entries(farm.troops).filter(([_, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}\n\nEsta ação enviará as tropas imediamente.`)) {
            return false;
        }

        try {
            agendamento.locked = true;
            agendamento.status = 'executing';
            agendamento.statusText = '🔥 Enviando Agora...';
            
            window.TWS_FarmInteligente.Core.FarmLogger.log('MANUAL_SEND_ATTEMPT', farm);
            
            window.TWS_Backend.executeAttack(agendamento)
                .then(success => {
                    if (success) {
                        agendamento.done = true;
                        agendamento.success = true;
                        agendamento.executedAt = new Date().toISOString();
                        agendamento.status = 'sent';
                        agendamento.statusText = '✅ Enviado (Manual)';
                        
                        farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                        farm.stats.successRuns = (farm.stats.successRuns || 0) + 1;
                        farm.stats.lastRun = new Date().toISOString();
                        
                        window.TWS_FarmInteligente.Core.FarmLogger.log('MANUAL_SEND_SUCCESS', farm);
                        
                        const now = new Date();
                        const travelTimeToTarget = window.TWS_FarmInteligente.Core.calculateTravelTime(farm.origem, farm.alvo, farm.troops);
                        const returnTime = window.TWS_FarmInteligente.Core.calculateReturnTime(farm.origem, farm.alvo, farm.troops);
                        const totalCycleTime = travelTimeToTarget + returnTime + (farm.intervalo * 60);
                        
                        let nextRunTime = new Date(now.getTime() + (totalCycleTime * 1000));
                        
                        agendamento.datetime = window.TWS_FarmInteligente.Core.formatDateTime(nextRunTime);
                        agendamento.done = false;
                        agendamento.success = false;
                        agendamento.executedAt = null;
                        agendamento.error = null;
                        
                        farm.nextRun = agendamento.datetime;
                        farm.lastReturnTime = returnTime;
                        
                        window.TWS_FarmInteligente.Core.FarmLogger.log('MANUAL_NEXT_CYCLE', farm, { 
                            nextRun: farm.nextRun,
                            travelTime: travelTimeToTarget,
                            returnTime: returnTime,
                            totalCycleTime: totalCycleTime,
                            intervalo: farm.intervalo
                        });
                        
                        alert(`✅ FARM ENVIADO COM SUCESSO!\n\n${farm.origem} → ${farm.alvo}\nPróximo ciclo: ${farm.nextRun}`);
                        
                    } else {
                        agendamento.done = false;
                        agendamento.success = false;
                        agendamento.status = 'failed';
                        agendamento.statusText = '❌ Falha (Manual)';
                        agendamento.error = 'Falha no envio manual';
                        
                        farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                        farm.stats.lastRun = new Date().toISOString();
                        
                        window.TWS_FarmInteligente.Core.FarmLogger.log('MANUAL_SEND_FAILED', farm);
                        alert(`❌ FALHA NO ENVIO MANUAL!\n\nVerifique as tropas e tente novamente.`);
                    }
                    
                    agendamento.locked = false;
                    window.TWS_Backend.setList(lista);
                    
                    const updatedFarms = window.TWS_FarmInteligente.Core.getFarmList();
                    const farmIdx = updatedFarms.findIndex(f => f.id === farm.id);
                    if (farmIdx !== -1) {
                        updatedFarms[farmIdx] = farm;
                        window.TWS_FarmInteligente.Core.setFarmList(updatedFarms);
                    }
                    
                    window.dispatchEvent(new CustomEvent('tws-farm-updated'));
                    
                    if (document.getElementById('farm-list-container')) {
                        document.getElementById('farm-list-container').innerHTML = 
                            window.TWS_FarmInteligente.UI.renderFarmList();
                    }
                })
                .catch(error => {
                    console.error('[Farm] Erro no envio manual:', error);
                    
                    agendamento.done = false;
                    agendamento.success = false;
                    agendamento.locked = false;
                    agendamento.status = 'failed';
                    agendamento.statusText = '❌ Erro (Manual)';
                    agendamento.error = error.message;
                    
                    farm.stats.totalRuns = (farm.stats.totalRuns || 0) + 1;
                    farm.stats.lastRun = new Date().toISOString();
                    
                    window.TWS_FarmInteligente.Core.FarmLogger.log('MANUAL_SEND_ERROR', farm, { error: error.message });
                    
                    window.TWS_Backend.setList(lista);
                    window.TWS_FarmInteligente.Core.setFarmList(farms);
                    
                    alert(`❌ ERRO NO ENVIO MANUAL!\n\n${error.message}\n\nO farm permanecerá ativo para tentar novamente.`);
                });
            
            return true;
        } catch (error) {
            console.error('[Farm] Erro no processo manual:', error);
            alert(`❌ ERRO CRÍTICO: ${error.message}`);
            return false;
        }
    }
    
    // INICIAR MONITORAMENTO DO FARM
    function startFarmMonitoring() {
        console.log('[Farm Init] 🔧 Iniciando monitoramento...');
        
        // Monitorar agendamentos para farm
        setInterval(() => {
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core) {
                window.TWS_FarmInteligente.Core.monitorAgendamentosParaFarm();
            }
        }, 10000);
        
        // Verificar farms atrasados
        setInterval(() => {
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core) {
                window.TWS_FarmInteligente.Core.verificarFarmsAtrasados();
            }
        }, 15000);
        
        // Limpeza periódica
        setInterval(() => {
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core && window.TWS_Backend) {
                const farms = window.TWS_FarmInteligente.Core.getFarmList();
                const lista = window.TWS_Backend.getList();
                const validFarms = farms.filter(farm => {
                    return farm.agendamentoBaseId < lista.length && lista[farm.agendamentoBaseId];
                });
                
                if (validFarms.length < farms.length) {
                    console.log(`[Farm Init] 🧹 Limpando ${farms.length - validFarms.length} farms inválidos`);
                    window.TWS_FarmInteligente.Core.setFarmList(validFarms);
                }
            }
        }, 60000);
        
        // Iniciar monitor de configurações
        if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core) {
            window.TWS_FarmInteligente.Core.iniciarMonitorConfig();
        }
        
        console.log('[Farm Init] ✅ Monitoramento iniciado');
    }
    
    // ADICIONAR BOTÃO NA INTERFACE DO SCHEDULER
    function addFarmButtonToUI() {
        console.log('[Farm Init] 🎨 Adicionando botão à interface...');
        
        const maxAttempts = 20;
        const checkInterval = 1000;
        let attempts = 0;
        
        const intervalId = setInterval(() => {
            attempts++;
            
            const schedulerPanel = document.querySelector('#tws-scheduler-panel');
            
            if (schedulerPanel) {
                clearInterval(intervalId);
                
                // Verificar se botão já existe
                if (document.querySelector('#tws-farm-button')) {
                    console.log('[Farm Init] ✅ Botão do farm já existe');
                    return;
                }
                
                // Criar botão
                const farmButton = document.createElement('button');
                farmButton.id = 'tws-farm-button';
                farmButton.innerHTML = '🌾 Farm Inteligente';
                farmButton.title = 'Sistema de Farm Automático - Velocidades em tempo real';
                farmButton.style.cssText = `
                    background: linear-gradient(135deg, #27ae60, #2ecc71);
                    border: 1px solid #1e8449;
                    color: white;
                    padding: 8px 15px;
                    margin: 5px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    transition: all 0.3s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                `;
                
                // Efeitos hover
                farmButton.onmouseenter = () => {
                    farmButton.style.transform = 'translateY(-2px)';
                    farmButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                };
                
                farmButton.onmouseleave = () => {
                    farmButton.style.transform = 'translateY(0)';
                    farmButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                };
                
                // Ação do clique
                farmButton.onclick = () => {
                    if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.show) {
                        window.TWS_FarmInteligente.show();
                    } else {
                        alert('❌ Interface do Farm não disponível. Recarregue a página.');
                    }
                };
                
                // Adicionar badge de status das velocidades
                const velocityBadge = document.createElement('span');
                velocityBadge.id = 'tws-velocity-badge';
                velocityBadge.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #27ae60;
                    color: white;
                    font-size: 9px;
                    padding: 1px 4px;
                    border-radius: 8px;
                    font-weight: bold;
                `;
                updateVelocityBadge(velocityBadge);
                farmButton.appendChild(velocityBadge);
                
                // Atualizar badge periodicamente
                setInterval(() => updateVelocityBadge(velocityBadge), 30000);
                
                // Encontrar container de botões
                const buttonContainer = schedulerPanel.querySelector('.button-container') || 
                                       schedulerPanel.querySelector('.vis') || 
                                       schedulerPanel;
                
                buttonContainer.appendChild(farmButton);
                console.log('[Farm Init] ✅ Botão do farm adicionado à interface');
                
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.warn('[Farm Init] ⚠️ Painel do scheduler não encontrado após 20 tentativas');
            }
        }, checkInterval);
    }
    
    // ATUALIZAR BADGE DE VELOCIDADES
    function updateVelocityBadge(badge) {
        if (!window.TWS_FarmInteligente || !window.TWS_FarmInteligente.Core) return;
        
        const sourceInfo = window.TWS_FarmInteligente.Core.getVelocitySourceInfo();
        
        let badgeText = '?';
        let badgeColor = '#e74c3c';
        let badgeTitle = 'Velocidades desconhecidas';
        
        if (sourceInfo.source === 'REAL') {
            badgeText = '⚡';
            badgeColor = '#27ae60';
            badgeTitle = `Velocidades REAIS do mundo ${sourceInfo.world}`;
        } else if (sourceInfo.source === 'CACHE') {
            badgeText = '♻️';
            badgeColor = '#f39c12';
            badgeTitle = `Velocidades em cache (${sourceInfo.lastUpdate || 'desconhecido'})`;
        } else if (sourceInfo.source === 'FALLBACK') {
            badgeText = '⚠️';
            badgeColor = '#e74c3c';
            badgeTitle = 'Usando velocidades padrão';
        }
        
        badge.textContent = badgeText;
        badge.style.background = badgeColor;
        badge.title = badgeTitle;
    }
    
    // INICIALIZAÇÃO PRINCIPAL
    async function init() {
        try {
            console.log('[Farm Init] 🚀 Iniciando sistema Farm Inteligente...');
            await initializeFarmSystem();
        } catch (error) {
            console.error('[Farm Init] ❌ Erro na inicialização:', error);
            
            // Tentar fallback após erro
            setTimeout(() => {
                console.log('[Farm Init] 🔄 Tentando fallback...');
                if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.UI) {
                    window.TWS_FarmInteligente.show = function() {
                        return window.TWS_FarmInteligente.UI.showModal();
                    };
                    console.log('[Farm Init] ✅ Fallback aplicado');
                }
            }, 5000);
        }
    }
    
    // AGUARDAR DOM E INICIAR
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 2000); // Delay para garantir carregamento
        });
    } else {
        setTimeout(init, 2000);
    }
    
})();
