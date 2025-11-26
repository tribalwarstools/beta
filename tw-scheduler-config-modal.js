// === MODAL DE CONFIGURAÇÕES - BLOCO UNIDADES CORRIGIDO ===
function showConfigModal() {
    const existing = document.getElementById('tws-config-modal');
    if (existing) existing.remove();

    const config = getConfig();
    
    const overlay = document.createElement('div');
    overlay.id = 'tws-config-modal';
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
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: 3px solid #4A5568;
        border-radius: 12px;
        padding: 0;
        width: 95%;
        max-width: 1000px;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
    `;

    modal.innerHTML = `
        <style>
            .tws-config-tabs {
                display: flex;
                background: #4A5568;
                padding: 0;
                flex-wrap: wrap;
            }
            .tws-config-tab {
                padding: 12px 16px;
                color: white;
                cursor: pointer;
                border: none;
                background: none;
                font-weight: bold;
                transition: all 0.3s;
                font-size: 14px;
                white-space: nowrap;
            }
            .tws-config-tab:hover {
                background: #5a6578;
            }
            .tws-config-tab.active {
                background: #667eea;
            }
            .tws-config-tab-content {
                display: none;
                padding: 20px;
                background: #F7FAFC;
                overflow-y: auto;
                max-height: 60vh;
            }
            .tws-config-tab-content.active {
                display: block;
            }
            .tws-config-section {
                background: white;
                border-radius: 8px;
                padding: 20px;
                margin: 10px 0;
                border-left: 4px solid #667eea;
            }
            .tws-unit-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 12px;
                margin: 15px 0;
            }
            .tws-unit-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }
            .tws-unit-label {
                font-weight: bold;
                font-size: 14px;
                color: #2D3748;
                min-width: 80px;
            }
            .tws-unit-input {
                width: 70px;
                padding: 6px 8px;
                border: 1px solid #CBD5E0;
                border-radius: 4px;
                text-align: center;
                font-size: 14px;
            }
            .tws-unit-suffix {
                font-size: 12px;
                color: #718096;
                min-width: 70px;
                text-align: right;
            }
            .tws-config-btn {
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                cursor: pointer;
                margin: 5px;
                transition: all 0.3s;
                font-size: 14px;
            }
            .tws-config-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .btn-primary { background: #667eea; }
            .btn-success { background: #48BB78; }
            .btn-warning { background: #ED8936; }
            .btn-danger { background: #F56565; }
            .btn-secondary { background: #718096; }
            
            /* Dark theme */
            [data-tws-theme="dark"] .tws-config-tab-content {
                background: #2D3748;
                color: #E2E8F0;
            }
            [data-tws-theme="dark"] .tws-config-section {
                background: #4A5568;
                color: #E2E8F0;
            }
            [data-tws-theme="dark"] .tws-unit-item {
                background: #4A5568;
                border-color: #718096;
            }
            [data-tws-theme="dark"] .tws-unit-label {
                color: #E2E8F0;
            }
            [data-tws-theme="dark"] .tws-unit-input {
                background: #2D3748;
                border-color: #718096;
                color: #E2E8F0;
            }
            [data-tws-theme="dark"] .tws-unit-suffix {
                color: #CBD5E0;
            }
        </style>

        <!-- Cabeçalho -->
        <div style="background: #4A5568; padding: 20px; text-align: center; border-bottom: 3px solid #667eea;">
            <div style="font-size: 24px; font-weight: bold; color: white;">⚙️ CONFIGURAÇÕES GLOBAIS</div>
            <div style="color: #E2E8F0; font-size: 14px; margin-top: 5px;">
                Ajuste velocidades, Telegram, aparência e comportamento do sistema
            </div>
        </div>

        <!-- Abas -->
        <div class="tws-config-tabs">
            <button class="tws-config-tab active" onclick="switchConfigTab('unidades')">🎯 Unidades</button>
            <button class="tws-config-tab" onclick="switchConfigTab('telegram')">🤖 Telegram</button>
            <button class="tws-config-tab" onclick="switchConfigTab('aparencia')">🎨 Aparência</button>
            <button class="tws-config-tab" onclick="switchConfigTab('comportamento')">⚡ Comportamento</button>
            <button class="tws-config-tab" onclick="switchConfigTab('backup')">💾 Backup</button>
        </div>

        <!-- Conteúdo das Abas -->
        <div style="flex: 1; overflow-y: auto;">
            <!-- ABA: UNIDADES -->
            <div id="tab-unidades" class="tws-config-tab-content active">
                <div class="tws-config-section">
                    <h3 style="margin-top: 0; color: #2D3748; margin-bottom: 10px;">🎯 Velocidades das Unidades</h3>
                    <p style="color: #718096; font-size: 13px; margin-bottom: 20px;">
                        Ajuste as velocidades conforme as configurações do seu mundo. Valores em minutos por campo.
                    </p>
                    
                    <!-- GRID DE UNIDADES ORGANIZADO -->
                    <div class="tws-unit-grid">
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">spear:</span>
                            <input type="number" class="tws-unit-input" data-unit="spear" 
                                   value="${config.velocidadesUnidades.spear}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">sword:</span>
                            <input type="number" class="tws-unit-input" data-unit="sword" 
                                   value="${config.velocidadesUnidades.sword}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">axe:</span>
                            <input type="number" class="tws-unit-input" data-unit="axe" 
                                   value="${config.velocidadesUnidades.axe}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">archer:</span>
                            <input type="number" class="tws-unit-input" data-unit="archer" 
                                   value="${config.velocidadesUnidades.archer}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">spy:</span>
                            <input type="number" class="tws-unit-input" data-unit="spy" 
                                   value="${config.velocidadesUnidades.spy}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">light:</span>
                            <input type="number" class="tws-unit-input" data-unit="light" 
                                   value="${config.velocidadesUnidades.light}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">marcher:</span>
                            <input type="number" class="tws-unit-input" data-unit="marcher" 
                                   value="${config.velocidadesUnidades.marcher}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">heavy:</span>
                            <input type="number" class="tws-unit-input" data-unit="heavy" 
                                   value="${config.velocidadesUnidades.heavy}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">ram:</span>
                            <input type="number" class="tws-unit-input" data-unit="ram" 
                                   value="${config.velocidadesUnidades.ram}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">catapult:</span>
                            <input type="number" class="tws-unit-input" data-unit="catapult" 
                                   value="${config.velocidadesUnidades.catapult}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">knight:</span>
                            <input type="number" class="tws-unit-input" data-unit="knight" 
                                   value="${config.velocidadesUnidades.knight}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                        <div class="tws-unit-item">
                            <span class="tws-unit-label">snob:</span>
                            <input type="number" class="tws-unit-input" data-unit="snob" 
                                   value="${config.velocidadesUnidades.snob}" min="1" max="100" step="0.1" />
                            <span class="tws-unit-suffix">min/campo</span>
                        </div>
                    </div>
                    
                    <!-- BOTÕES DE AÇÃO -->
                    <div style="margin-top: 25px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="tws-config-btn btn-secondary" onclick="resetUnitSpeeds()">
                            🔄 Resetar Velocidades
                        </button>
                        <button class="tws-config-btn btn-success" onclick="testUnitSpeed()">
                            🧪 Testar Cálculo
                        </button>
                    </div>
                </div>
            </div>

            <!-- ABA: TELEGRAM -->
            <div id="tab-telegram" class="tws-config-tab-content">
                <div class="tws-config-section">
                    <h3 style="margin-top: 0; color: #2D3748;">🤖 Configurações do Telegram</h3>
                    <p style="color: #718096; font-size: 13px; margin-bottom: 20px;">
                        Configure as notificações via Telegram para receber alertas dos seus ataques.
                    </p>
                    <!-- Conteúdo do Telegram... -->
                </div>
            </div>

            <!-- ABA: APARÊNCIA -->
            <div id="tab-aparencia" class="tws-config-tab-content">
                <div class="tws-config-section">
                    <h3 style="margin-top: 0; color: #2D3748;">🎨 Aparência e Tema</h3>
                    <!-- Conteúdo da Aparência... -->
                </div>
            </div>

            <!-- ABA: COMPORTAMENTO -->
            <div id="tab-comportamento" class="tws-config-tab-content">
                <div class="tws-config-section">
                    <h3 style="margin-top: 0; color: #2D3748;">⚡ Comportamento do Sistema</h3>
                    <!-- Conteúdo do Comportamento... -->
                </div>
            </div>

            <!-- ABA: BACKUP -->
            <div id="tab-backup" class="tws-config-tab-content">
                <div class="tws-config-section">
                    <h3 style="margin-top: 0; color: #2D3748;">💾 Backup e Restauração</h3>
                    <!-- Conteúdo do Backup... -->
                </div>
            </div>
        </div>

        <!-- Rodapé -->
        <div style="background: #F7FAFC; padding: 15px; text-align: center; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
            <button class="tws-config-btn btn-secondary" onclick="closeConfigModal()">
                ❌ Cancelar
            </button>
            
            <div>
                <button class="tws-config-btn btn-warning" onclick="saveConfig()">
                    💾 Salvar
                </button>
                
                <button class="tws-config-btn btn-success" onclick="saveAndCloseConfig()">
                    ✅ Salvar e Fechar
                </button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Adicionar funções globais temporárias
    window.switchConfigTab = function(tabName) {
        document.querySelectorAll('.tws-config-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tws-config-tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`.tws-config-tab[onclick="switchConfigTab('${tabName}')"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    };

    window.resetUnitSpeeds = function() {
        if (confirm('Resetar velocidades para valores padrão?')) {
            const config = getConfig();
            config.velocidadesUnidades = { ...defaultConfig.velocidadesUnidades };
            saveConfig(config);
            
            // Atualizar os inputs
            document.querySelectorAll('.tws-unit-input').forEach(input => {
                const unit = input.dataset.unit;
                input.value = config.velocidadesUnidades[unit];
            });
            alert('✅ Velocidades resetadas para os valores padrão!');
        }
    };

    window.testUnitSpeed = function() {
        const origem = prompt('Coordenada de origem (ex: 500|500):', '500|500');
        const destino = prompt('Coordenada de destino (ex: 501|501):', '501|501');
        
        if (origem && destino) {
            const config = getConfig();
            const distancia = calcularDistancia(origem, destino);
            const unidadeMaisLenta = 'spear';
            const velocidade = config.velocidadesUnidades[unidadeMaisLenta];
            const tempo = distancia * velocidade;
            
            alert(`🧪 TESTE DE CÁLCULO:\n\n📍 ${origem} → ${destino}\n📏 Distância: ${distancia.toFixed(2)} campos\n🐌 Unidade: ${unidadeMaisLenta}\n⚡ Velocidade: ${velocidade} min/campo\n⏱️ Tempo: ${tempo.toFixed(1)} min`);
        }
    };

    // ... resto das funções (saveConfig, closeConfigModal, etc.)
    window.saveConfig = function() {
        const config = getConfig();
        
        // Salvar velocidades das unidades
        document.querySelectorAll('.tws-unit-input').forEach(input => {
            const unit = input.dataset.unit;
            const value = parseFloat(input.value) || defaultConfig.velocidadesUnidades[unit];
            config.velocidadesUnidades[unit] = Math.max(0.1, value);
        });
        
        if (saveConfig(config)) {
            alert('✅ Configurações salvas com sucesso!');
        }
    };

    window.saveAndCloseConfig = function() {
        window.saveConfig();
        window.closeConfigModal();
    };

    window.closeConfigModal = function() {
        const modal = document.getElementById('tws-config-modal');
        if (modal) modal.remove();
        
        // Limpar funções globais temporárias
        ['switchConfigTab', 'resetUnitSpeeds', 'testUnitSpeed', 'saveConfig', 'saveAndCloseConfig', 'closeConfigModal'].forEach(fn => {
            delete window[fn];
        });
    };

    // Fechar modal ao clicar fora
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            window.closeConfigModal();
        }
    };
}
