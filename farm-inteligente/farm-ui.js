// ========== FARM-UI.JS ==========
// Interface do usuário, modais e renderização
// ATUALIZADO: Mostra mundo atual no badge de configuração
(function() {
    'use strict';
    
    if (!window.TWS_FarmInteligente) {
        window.TWS_FarmInteligente = {};
    }
    
    var FarmUI = {
        // === RENDERIZAÇÃO DA LISTA ===
        renderFarmList: function() {
            if (!window.TWS_FarmInteligente.Core) return '';
            
            const farms = window.TWS_FarmInteligente.Core.getFarmList().filter(f => f.active !== false);
            const listaAgendamentos = window.TWS_Backend.getList();
            const now = Date.now();
            
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
                let nextRun = null;
                
                try {
                    nextRun = farm.nextRun ? window.TWS_Backend.parseDateTimeToMs(farm.nextRun) : null;
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
                } else if (nextRun && nextRun < now) {
                    statusColor = '#FF6B6B';
                    statusText = '⏰ Atrasado';
                }

                const stats = farm.stats || { totalRuns: 0, successRuns: 0 };
                
                const agendamentoBase = listaAgendamentos[farm.agendamentoBaseId];
                const baseStatus = agendamentoBase ? 
                    (agendamentoBase.done ? 
                        (agendamentoBase.success ? '✅ Concluído' : '❌ Falhou') : 
                        (agendamentoBase.status === 'delayed' ? '⏰ Atrasado' : '⏳ Pendente')) : 
                    '❓ Agendamento não encontrado';
                
                let tempoRestante = '';
                let atrasoTexto = '';
                
                if (nextRun) {
                    const diffMs = nextRun - now;
                    
                    if (diffMs > 0) {
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const remainingMins = diffMins % 60;
                        
                        if (diffHours > 0) {
                            tempoRestante = `${diffHours}h ${remainingMins}m`;
                        } else {
                            tempoRestante = `${diffMins}m`;
                        }
                    } else {
                        const atrasoMins = Math.floor(Math.abs(diffMs) / 60000);
                        const atrasoHours = Math.floor(atrasoMins / 60);
                        const remainingAtrasoMins = atrasoMins % 60;
                        
                        if (atrasoHours > 0) {
                            atrasoTexto = `${atrasoHours}h ${remainingAtrasoMins}m atrás`;
                        } else {
                            atrasoTexto = `${atrasoMins}m atrás`;
                        }
                    }
                }
                
                const distancia = window.TWS_FarmInteligente.Core.calcularDistancia(farm.origem, farm.alvo);
                const unidadeMaisLenta = window.TWS_FarmInteligente.Core.getUnidadeMaisLenta(farm.troops);
                const velocidadesUnidades = window.TWS_FarmInteligente.Core.getVelocidadesUnidades();
                const velocidade = unidadeMaisLenta ? velocidadesUnidades[unidadeMaisLenta] : 0;
                const tempoIda = distancia * velocidade;
                const tempoVolta = tempoIda;
                const tempoTotalCiclo = tempoIda + tempoVolta;
                
                // ⭐ NOVO: Obter informações do mundo atual
                const worldInfo = this.getCurrentWorldInfo();
                
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
                                    <small style="color: #999;">
                                        (${worldInfo.source === 'REAL' ? '⚡ ' : ''}${worldInfo.world || 'Config Global'})
                                    </small>
                                </div>
                                <div style="color: #888; font-size: 10px; margin-top: 1px;">
                                    ⏱️ Ida: ${Math.round(tempoIda)}min | Volta: ${Math.round(tempoVolta)}min | Total: ${Math.round(tempoTotalCiclo)}min
                                </div>

                                ${farm.failedAttempts ? `<div style="color: #FF6B6B; font-size: 10px; margin-top: 2px;">🔄 Tentativa ${farm.failedAttempts}/3</div>` : ''}
                                ${farm.paused && farm.failedAttempts >= 3 ? `<div style="color: #FF9800; font-size: 10px; margin-top: 2px;">⚠️ Pausado: ${farm.failedAttempts} falhas consecutivas</div>` : ''}
                                
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
                                ${atrasoTexto ? `<br><small style="color: #FF6B6B; font-weight: bold;">⏰ ${atrasoTexto} atrás</small>` : ''}
                                ${atrasoTexto ? `<br><small style="color: #FF9800; font-size: 10px;">Use "Enviar Agora" para executar</small>` : ''}
                            </div>
                            <div>
                                <strong>Estatísticas:</strong><br>
                                ${stats.totalRuns} ciclos (${stats.successRuns} sucessos)
                                ${stats.lastRun ? `<br><small>Último: ${new Date(stats.lastRun).toLocaleTimeString()}</small>` : ''}
                            </div>
                        </div>
                        
                        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="TWS_FarmInteligente.UI._enviarAgora('${farm.id}')" style="
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
                            title="Forçar envio imediato (útil em caso de falhas ou atrasos)">
                                🚀 Enviar Agora
                            </button>
                            
                            <button onclick="TWS_FarmInteligente.UI._toggleFarm('${farm.id}')" style="
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
                            
                            <button onclick="TWS_FarmInteligente.UI._deleteFarm('${farm.id}')" style="
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
        },
        
        // === FUNÇÃO AUXILIAR: Obter informações do mundo atual ===
        getCurrentWorldInfo: function() {
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core) {
                try {
                    return window.TWS_FarmInteligente.Core.getVelocitySourceInfo();
                } catch (e) {
                    console.warn('[Farm UI] Erro ao obter info do mundo:', e);
                }
            }
            
            // Fallback
            try {
                // Tentar extrair do URL
                const url = window.location.href;
                const match = url.match(/https?:\/\/([^.]+)\.tribalwars/);
                const world = match && match[1] ? match[1] : 'desconhecido';
                
                return {
                    world: world,
                    source: 'URL',
                    lastUpdate: null
                };
            } catch (error) {
                return {
                    world: 'desconhecido',
                    source: 'FALLBACK',
                    lastUpdate: null
                };
            }
        },
        
        // === MODAL PRINCIPAL ===
        showModal: function() {
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

            // ⭐ NOVO: Obter informações do mundo para o título
            const worldInfo = this.getCurrentWorldInfo();
            const worldBadgeText = worldInfo.source === 'REAL' ? `⚡ ${worldInfo.world}` : 
                                  worldInfo.world !== 'desconhecido' ? `🌍 ${worldInfo.world}` : '⚙️ Config Global';
            const worldBadgeColor = worldInfo.source === 'REAL' ? '#27ae60' : 
                                   worldInfo.world !== 'desconhecido' ? '#3498db' : '#9b59b6';
            const worldBadgeTitle = worldInfo.source === 'REAL' ? 'Velocidades REAIS do mundo atual' :
                                   worldInfo.world !== 'desconhecido' ? `Mundo ${worldInfo.world}` : 
                                   'Velocidades das unidades configuradas globalmente';

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
                    .btn-warning { background: #FF9800; }
                    .btn-danger { background: #F44336; }
                </style>

                <!-- Cabeçalho -->
                <div style="background: #4CAF50; padding: 20px; text-align: center; border-bottom: 3px solid #388E3C;">
                    <div style="font-size: 24px; font-weight: bold; color: white;">
                        🌾 FARM INTELIGENTE v2.2
                        <span id="world-badge" style="
                            display: inline-block;
                            background: ${worldBadgeColor};
                            color: white;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 11px;
                            margin-left: 10px;
                            vertical-align: middle;
                            cursor: help;
                            font-weight: bold;
                        " title="${worldBadgeTitle}">
                            ${worldBadgeText}
                        </span>
                    </div>
                    <div style="color: #E8F5E8; font-size: 14px; margin-top: 5px;">
                        Sistema automático sem disparo automático de farms atrasados - Use "Enviar Agora" manualmente
                    </div>
                </div>

                <!-- Conteúdo -->
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #155724;">
                        <strong>✨ IMPORTANTE - MUDANÇA DE COMPORTAMENTO:</strong><br>
                        ✅ <strong>SEM DISPARO AUTOMÁTICO</strong> de farms atrasados<br>
                        ✅ Farms com horário no passado serão marcados como "Atrasado"<br>
                        ✅ Use o botão "🚀 Enviar Agora" para executar manualmente<br>
                        ✅ Tentativas escalonadas (1min, 2min, 5min) mantidas<br>
                        ✅ Pausa automática após 3 falhas consecutivas<br>
                        ✅ Distância Euclidiana correta para TW<br>
                        ✅ Logging detalhado de eventos<br>
                        <strong>🎯 VELOCIDADES ATUALIZADAS:</strong><br>
                        ✅ <span id="velocity-info">Usando configurações específicas do mundo atual</span><br>
                        ✅ Atualização automática quando velocidades mudam<br>
                        ✅ Fallback para valores padrão se necessário<br>
                        <strong>🎯 COMPORTAMENTO LIBERADO:</strong><br>
                        ✅ Múltiplos farms no mesmo alvo<br>
                        ✅ Mesmas tropas, mesmo alvo<br>
                        ✅ Mesmo agendamento convertido múltiplas vezes<br>
                        ✅ "Enviar Agora" sem verificações
                    </div>

                    <!-- Botões de Ação -->
                    <div style="margin-bottom: 20px;">
                        <div style="font-weight: bold; color: #388E3C; margin-bottom: 10px; font-size: 16px;">🛠️ AÇÕES DO SISTEMA:</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <button class="farm-btn btn-primary" onclick="TWS_FarmInteligente.UI._showFiltroModal()">
                                🔍 Converter por Filtro
                            </button>
                            <button class="farm-btn btn-danger" onclick="TWS_FarmInteligente.UI._exportLogs()">
                                📊 Exportar Logs (CSV)
                            </button>
                            <button class="farm-btn btn-primary" onclick="TWS_FarmInteligente.UI._viewStats()">
                                📈 Ver Estatísticas
                            </button>
                            <button class="farm-btn btn-warning" onclick="TWS_FarmInteligente.UI._recarregarVelocidades()">
                                🔄 Atualizar Velocidades
                            </button>
                        </div>
                    </div>

                    <div id="farm-list-container">
                        ${this.renderFarmList()}
                    </div>
                </div>

                <!-- Rodapé -->
                <div style="background: #f5f5f5; padding: 15px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                    Farm Inteligente v2.2 | Total: ${window.TWS_FarmInteligente.Core ? window.TWS_FarmInteligente.Core.getFarmList().filter(f => f.active !== false).length : 0} farms ativos | 
                    Eventos: ${window.TWS_FarmInteligente.Core ? window.TWS_FarmInteligente.Core.FarmLogger.history.length : 0} | 
                    <span id="footer-velocity-info">Velocidades: ${worldBadgeText}</span>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            overlay.onclick = (e) => { 
                if (e.target === overlay) {
                    overlay.remove(); 
                }
            };
            
            // Atualizar informações dinâmicas
            setTimeout(() => {
                this.updateDynamicInfo();
            }, 100);
        },
        

// === ATUALIZAR INFORMAÇÕES DINÂMICAS ===
updateDynamicInfo: function() {
    if (!window.TWS_FarmInteligente || !window.TWS_FarmInteligente.Core) return;
    
    try {
        const worldInfo = window.TWS_FarmInteligente.Core.getVelocitySourceInfo();
        const velocidades = window.TWS_FarmInteligente.Core.getVelocidadesUnidades(); // ⭐ Declaração em português
        
        // Atualizar badge no cabeçalho
        const badge = document.getElementById('world-badge');
        if (badge) {
            let badgeText = '';
            let badgeColor = '#9b59b6';
            let badgeTitle = '';
            
            if (worldInfo.source === 'REAL') {
                badgeText = `⚡ ${worldInfo.world}`;
                badgeColor = '#27ae60';
                badgeTitle = `Velocidades REAIS do mundo ${worldInfo.world} (atualizado: ${worldInfo.lastUpdate || 'agora'})`;
            } else if (worldInfo.source === 'CACHE') {
                badgeText = `♻️ ${worldInfo.world}`;
                badgeColor = '#f39c12';
                badgeTitle = `Velocidades em cache do mundo ${worldInfo.world} (${worldInfo.lastUpdate || 'desconhecido'})`;
            } else {
                badgeText = `🌍 ${worldInfo.world || 'Config'}`;
                badgeColor = '#3498db';
                badgeTitle = `Velocidades ${worldInfo.world ? `do mundo ${worldInfo.world}` : 'configuradas globalmente'}`;
            }
            
            badge.textContent = badgeText;
            badge.style.background = badgeColor;
            badge.title = badgeTitle;
        }
        
        // Atualizar info no conteúdo
        const velocityInfo = document.getElementById('velocity-info');
        if (velocityInfo) {
            let infoText = '';
            
            if (worldInfo.source === 'REAL') {
                infoText = `✅ Usando velocidades REAIS do mundo ${worldInfo.world}`;
            } else if (worldInfo.source === 'CACHE') {
                infoText = `♻️ Usando velocidades em cache do mundo ${worldInfo.world}`;
            } else {
                infoText = `⚙️ Usando velocidades configuradas globalmente`;
            }
            
            // ⭐⭐ CORREÇÃO APLICADA: Usar 'velocidades' (português) consistentemente
            if (velocidades && velocidades.sword && velocidades.snob) {
                infoText += ` (Ex: Sword: ${velocidades.sword.toFixed(2)} min/campo, Snob: ${velocidades.snob.toFixed(2)} min/campo)`;
            }
            
            velocityInfo.textContent = infoText;
        }
        
        // Atualizar rodapé
        const footerInfo = document.getElementById('footer-velocity-info');
        if (footerInfo) {
            footerInfo.textContent = `Velocidades: ${worldInfo.source === 'REAL' ? '⚡ REAIS' : worldInfo.source === 'CACHE' ? '♻️ CACHE' : '⚙️ CONFIG'} (${worldInfo.world || 'Global'})`;
        }
        
    } catch (error) {
        console.warn('[Farm UI] Erro ao atualizar info:', error);
    }
},
        
        // === FUNÇÕES DE AÇÃO DA UI ===
        _toggleFarm: function(id) {
            if (!window.TWS_FarmInteligente.Core) return;
            
            const farms = window.TWS_FarmInteligente.Core.getFarmList();
            const farm = farms.find(f => f.id === id);
            if (farm) {
                const estavaPausado = farm.paused;
                farm.paused = !farm.paused;
                
                if (estavaPausado && !farm.paused && farm.failedAttempts >= 3) {
                    farm.failedAttempts = 0;
                    farm.nextRun = "Calculando...";
                    console.log(`[Farm] 🔄 Reset de tentativas ao retomar: ${farm.origem} → ${farm.alvo}`);
                    window.TWS_FarmInteligente.Core.FarmLogger.log('RESET_ATTEMPTS', farm, { reason: 'Retomada manual após pausa automática' });
                }
                
                const lista = window.TWS_Backend.getList();
                const agendamento = lista[farm.agendamentoBaseId];
                if (agendamento) {
                    window.TWS_Backend.setList(lista);
                }
                window.TWS_FarmInteligente.Core.setFarmList(farms);
                window.TWS_FarmInteligente.Core.FarmLogger.log(farm.paused ? 'PAUSED' : 'RESUMED', farm);
                
                if (document.getElementById('farm-list-container')) {
                    document.getElementById('farm-list-container').innerHTML = this.renderFarmList();
                }
            }
        },
        
        _deleteFarm: function(id) {
            if (confirm('Tem certeza que deseja excluir este farm inteligente?\n\nO agendamento original será mantido.')) {
                const farms = window.TWS_FarmInteligente.Core.getFarmList();
                const farm = farms.find(f => f.id === id);
                if (farm) {
                    window.TWS_FarmInteligente.Core.FarmLogger.log('DELETED', farm);
                }
                const updatedFarms = farms.filter(f => f.id !== id);
                window.TWS_FarmInteligente.Core.setFarmList(updatedFarms);
                
                if (document.getElementById('farm-list-container')) {
                    document.getElementById('farm-list-container').innerHTML = this.renderFarmList();
                }
            }
        },
        
        _enviarAgora: function(id) {
            if (window.TWS_FarmInteligente && window.TWS_FarmInteligente._enviarAgora) {
                window.TWS_FarmInteligente._enviarAgora(id);
            }
        },
        
        _showFiltroModal: function() {
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

            // Obter info do mundo atual
            const worldInfo = this.getCurrentWorldInfo();

            filtroModal.innerHTML = `
                <h3 style="margin-top: 0; color: #388E3C;">🔍 Converter por Filtro</h3>
                <div style="margin-bottom: 10px; padding: 8px; background: #f0f8ff; border-radius: 4px; font-size: 12px;">
                    <strong>Mundo atual:</strong> ${worldInfo.world} 
                    <small style="color: #666;">(${worldInfo.source === 'REAL' ? '⚡ velocidades reais' : '⚙️ configuração'})</small>
                </div>
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
                    <small style="color: #666;">Entre cada ciclo do farm</small>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 16px; background: #9E9E9E; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button onclick="TWS_FarmInteligente.UI._aplicarFiltro()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Aplicar Filtro</button>
                </div>
            `;

            document.body.appendChild(filtroModal);
        },
        
        _aplicarFiltro: function() {
            const origem = document.getElementById('filtro-origem')?.value || '';
            const alvo = document.getElementById('filtro-alvo')?.value || '';
            const temTropas = document.getElementById('filtro-temTropas')?.checked;
            const intervalo = parseInt(document.getElementById('filtro-intervalo')?.value) || 5;

            const validation = window.TWS_FarmInteligente.Core.validateIntervalo(intervalo);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            const filtro = { origem, alvo, temTropas };
            const results = window.TWS_FarmInteligente.Core.convertPorFiltro(filtro, intervalo);

            const modals = document.querySelectorAll('div[style*="position: fixed"]');
            modals.forEach(m => {
                if (m.textContent.includes('Converter por Filtro')) m.remove();
            });

            alert(`✅ CONVERSÃO POR FILTRO CONCLUÍDA!\n\n📊 Resultados:\n• ✅ ${results.success} convertidos\n• ❌ ${results.errors} erros\n\nFiltros:\n• Origem: ${origem || 'Qualquer'}\n• Alvo: ${alvo || 'Qualquer'}\n• Com tropas: ${temTropas ? 'Sim' : 'Não'}`);
            
            if (document.getElementById('farm-list-container')) {
                document.getElementById('farm-list-container').innerHTML = this.renderFarmList();
            }
        },
        
        _exportLogs: function() {
            if (window.TWS_FarmInteligente.Core) {
                window.TWS_FarmInteligente.Core.FarmLogger.exportHistory();
                alert('✅ Histórico de eventos exportado como CSV!');
            }
        },
        
        _viewStats: function() {
            if (!window.TWS_FarmInteligente.Core) return;
            
            const farms = window.TWS_FarmInteligente.Core.getFarmList();
            const stats = {
                total: farms.length,
                active: farms.filter(f => !f.paused && f.active !== false).length,
                paused: farms.filter(f => f.paused).length,
                totalCycles: farms.reduce((a, b) => a + (b.stats?.totalRuns || 0), 0),
                successCycles: farms.reduce((a, b) => a + (b.stats?.successRuns || 0), 0),
                events: window.TWS_FarmInteligente.Core.FarmLogger.history.length
            };
            
            const velocities = window.TWS_FarmInteligente.Core.getVelocidadesUnidades();
            const worldInfo = window.TWS_FarmInteligente.Core.getVelocitySourceInfo();

            // Calcular eficiência (menor = melhor)
            const swordSpeed = velocities.sword || 22;
            const defaultSwordSpeed = 22; // brp10 padrão
            const efficiencyPercent = ((defaultSwordSpeed - swordSpeed) / defaultSwordSpeed * 100).toFixed(1);
            
            let efficiencyText = swordSpeed < defaultSwordSpeed ? 
                `(+${efficiencyPercent}% mais rápido que brp10)` : 
                `(${efficiencyPercent}% mais lento que brp10)`;

            alert(
                '📊 ESTATÍSTICAS DO FARM INTELIGENTE\n\n' +
                `🌍 Mundo: ${worldInfo.world || 'desconhecido'}\n` +
                `📊 Fonte: ${worldInfo.source === 'REAL' ? '⚡ REAL' : worldInfo.source === 'CACHE' ? '♻️ CACHE' : '⚙️ CONFIG'}\n\n` +
                `Farms Total: ${stats.total}\n` +
                `Ativos: ${stats.active}\n` +
                `Pausados: ${stats.paused}\n\n` +
                `Ciclos Total: ${stats.totalCycles}\n` +
                `Ciclos Sucesso: ${stats.successCycles}\n` +
                `Taxa de Sucesso: ${stats.totalCycles > 0 ? ((stats.successCycles / stats.totalCycles) * 100).toFixed(1) : 0}%\n\n` +
                `Eventos Registrados: ${stats.events}\n\n` +
                `⚡ VELOCIDADES (${worldInfo.world || 'Global'}):\n` +
                `Eficiência: ${efficiencyText}\n` +
                `Lanceiro: ${velocidades.spear?.toFixed(3) || '?'} min/campo\n` +
                `Espadachim: ${velocidades.sword?.toFixed(3) || '?'} min/campo\n` +
                `Nobre: ${velocidades.snob?.toFixed(3) || '?'} min/campo`
            );
        },
        
        _recarregarVelocidades: function() {
            if (window.TWS_FarmInteligente.Core) {
                // Forçar atualização das velocidades
                if (window.TWS_FarmInteligente.Core.updateVelocitiesFromRealWorld) {
                    window.TWS_FarmInteligente.Core.updateVelocitiesFromRealWorld();
                } else {
                    window.TWS_FarmInteligente.Core.recarregarVelocidades();
                }
                
                // Atualizar interface após 2 segundos
                setTimeout(() => {
                    if (document.getElementById('farm-list-container')) {
                        document.getElementById('farm-list-container').innerHTML = this.renderFarmList();
                        this.updateDynamicInfo();
                    }
                }, 2000);
                
                alert('✅ Velocidades sendo atualizadas do mundo atual!');
            }
        }
    };
    
    // Exportar para namespace global
    window.TWS_FarmInteligente.UI = FarmUI;
    
})();
