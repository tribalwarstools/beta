// ========== FARM-INIT.JS ==========
// Inicialização, integração com backend e função "Enviar Agora"
(function() {
    'use strict';
    
    // Aguardar backend carregar
    function waitForBackend(callback, attempts = 0) {
        if (window.TWS_Backend) {
            callback();
        } else if (attempts < 10) {
            setTimeout(() => waitForBackend(callback, attempts + 1), 500);
        } else {
            console.error('[Farm] Backend não carregado após 5 segundos');
        }
    }
    
    // Função "Enviar Agora" que depende do backend
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
    
    // Inicializar sistema completo
    function initFarmSystem() {
        // Criar namespace principal se não existir
        if (!window.TWS_FarmInteligente) {
            window.TWS_FarmInteligente = {};
        }
        
        // Verificar se os módulos foram carregados
        if (!window.TWS_FarmInteligente.Core || !window.TWS_FarmInteligente.UI) {
            console.error('[Farm] Módulos não carregados!');
            console.log('Core:', !!window.TWS_FarmInteligente.Core);
            console.log('UI:', !!window.TWS_FarmInteligente.UI);
            return;
        }
        
        // Adicionar função "Enviar Agora" ao namespace principal
        window.TWS_FarmInteligente._enviarAgora = enviarFarmAgora;
        
        // Iniciar monitoramento
        function startMonitor() {
            setInterval(() => {
                window.TWS_FarmInteligente.Core.monitorAgendamentosParaFarm();
            }, 10000);
            
            setInterval(() => {
                window.TWS_FarmInteligente.Core.verificarFarmsAtrasados();
            }, 15000);
            
            setInterval(() => {
                // Cleanup simples
                const farms = window.TWS_FarmInteligente.Core.getFarmList();
                const lista = window.TWS_Backend.getList();
                const validFarms = farms.filter(farm => {
                    return farm.agendamentoBaseId < lista.length && lista[farm.agendamentoBaseId];
                });
                
                if (validFarms.length < farms.length) {
                    window.TWS_FarmInteligente.Core.setFarmList(validFarms);
                }
            }, 60000);
            
            window.TWS_FarmInteligente.Core.iniciarMonitorConfig();
            
            console.log('[Farm Inteligente] ✅ Sistema inicializado!');
            console.log('[Farm] ⚙️ Velocidades:', window.TWS_FarmInteligente.Core.getVelocidadesUnidades());
        }
        
        // Expor função principal de exibição
        window.TWS_FarmInteligente.show = function() {
            return window.TWS_FarmInteligente.UI.showModal();
        };
        
        // Iniciar
        startMonitor();
    }
    
    // Aguardar backend e DOM
    waitForBackend(function() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFarmSystem);
        } else {
            initFarmSystem();
        }
    });
    
})();
