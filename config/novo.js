(function () {
    'use strict';

    // Verificar dependências
    if (!window.TWS_ConfigManager || !window.TWS_BackupManager) {
        console.warn('[ConfigModalUI] Dependências não carregadas!');
        return;
    }

    // ============================================
    // CONSTANTES DE ESTILO (SEGUINDO O PADRÃO DO PAINEL)
    // ============================================
    const STYLE = {
        // Cores do painel principal
        panelBg: '#F4E4C1',        // Fundo bege
        panelBorder: '#8B4513',    // Borda marrom
        panelBorderSecondary: '#654321', // Borda marrom escuro
        panelText: '#333333',      // Texto escuro
        panelHeaderText: '#8B4513', // Texto header
        
        // Cores de botões (mesmas do painel)
        buttonGreen: '#4CAF50',
        buttonBlue: '#2196F3',
        buttonRed: '#F44336',
        buttonPurple: '#9C27B0',
        buttonOrange: '#FF6F00',
        buttonBrown: '#795548',
        buttonGray: '#607D8B',
        buttonDarkRed: '#D32F2F',
        
        // Gradientes dos cards do dashboard
        gradientBlue: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
        gradientOrange: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        gradientGreen: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
        gradientRed: 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
        
        // Outros
        cardBg: 'white',
        inputBg: 'white',
        tableHeaderBg: '#8B4513',
        tableHeaderText: 'white',
        tableBorder: '#654321'
    };

    // ============================================
    // VARIÁVEIS DO MODAL
    // ============================================
    let currentTab = 'behavior';

    // ============================================
    // FUNÇÕES DO MODAL (ESTILO ATUALIZADO)
    // ============================================
    const ConfigModalUI = {
        show: function() {
            this.createModal();
        },

        hide: function() {
            const overlay = document.getElementById('tws-config-overlay');
            if (overlay) overlay.remove();
        },

        createModal: function() {
            // Remover modal existente
            const existing = document.getElementById('tws-config-modal');
            if (existing) existing.remove();

            // Criar overlay e modal
            const overlay = this.createOverlay();
            const modal = this.createModalStructure();
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Configurar eventos
            this.setupModalEvents();
            
            // Carregar primeira aba
            this.loadTabContent(currentTab);
        },

        createOverlay: function() {
            const overlay = document.createElement('div');
            overlay.id = 'tws-config-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 100000;
                display: flex;
                justify-content: center;
                align-items: center;
                backdrop-filter: blur(3px);
            `;
            return overlay;
        },

        createModalStructure: function() {
            const modal = document.createElement('div');
            modal.id = 'tws-config-modal';
            modal.style.cssText = `
                background: ${STYLE.panelBg};
                border: 3px solid ${STYLE.panelBorder};
                border-radius: 8px;
                width: 90%;
                max-width: 1000px;
                max-height: 85vh;
                overflow-y: auto;
                padding: 15px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                font-family: Arial, sans-serif;
                color: ${STYLE.panelText};
                z-index: 100001;
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <!-- Cabeçalho (igual ao painel principal) -->
                    <h2 style="margin: 0 0 10px 0; color: ${STYLE.panelHeaderText};">
                        ⚙️ Configurações TW Scheduler
                    </h2>
                    
                    <!-- Barra de abas (estilo simplificado) -->
                    <div style="display: flex; gap: 5px; margin-bottom: 20px; flex-wrap: wrap; border-bottom: 2px solid ${STYLE.panelBorderSecondary}; padding-bottom: 10px;">
                        <button class="config-tab active" data-tab="behavior" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🔄 Comportamento</button>
                        <button class="config-tab" data-tab="interface" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🎨 Interface</button>
                        <button class="config-tab" data-tab="execution" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">⚔️ Execução</button>
                        <button class="config-tab" data-tab="backup" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">💾 Backup</button>
                        <button class="config-tab" data-tab="tools" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🛠️ Ferramentas</button>
                    </div>

                    <!-- Conteúdo das abas -->
                    <div id="config-content"></div>

                    <!-- Rodapé com botões (igual ao painel principal) -->
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid ${STYLE.panelBorderSecondary}; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button id="tws-config-reset" style="padding: 6px 12px; background: ${STYLE.buttonDarkRed}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🔄 Resetar Tudo</button>
                            <button id="tws-config-save" style="padding: 6px 12px; background: ${STYLE.buttonGreen}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">💾 Salvar Configurações</button>
                            <button id="tws-config-close" style="padding: 6px 12px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">❌ Fechar</button>
                        </div>
                        <div style="font-size: 11px; color: #666;">
                            v1.0 | Configurações aplicadas após reiniciar
                        </div>
                    </div>
                </div>
            `;

            return modal;
        },

        setupModalEvents: function() {
            // Fechar modal
            document.getElementById('tws-config-close').onclick = () => this.hide();
            
            // Abas
            document.querySelectorAll('.config-tab').forEach(tab => {
                tab.onclick = () => {
                    document.querySelectorAll('.config-tab').forEach(t => {
                        t.style.background = STYLE.buttonGray;
                        t.classList.remove('active');
                    });
                    tab.style.background = STYLE.buttonBlue;
                    tab.classList.add('active');
                    currentTab = tab.dataset.tab;
                    this.loadTabContent(currentTab);
                };
            });

            // Botões do rodapé
            document.getElementById('tws-config-reset').onclick = () => {
                if (confirm('⚠️ ATENÇÃO!\nIsso irá resetar TODAS as configurações para os valores padrão.\nO scheduler será reiniciado.\n\nContinuar?')) {
                    window.TWS_ConfigManager.resetToDefault();
                }
            };

            document.getElementById('tws-config-save').onclick = () => this.saveCurrentConfig();
        },

        loadTabContent: function(tabName) {
            const contentDiv = document.getElementById('config-content');
            
            switch (tabName) {
                case 'behavior':
                    contentDiv.innerHTML = this.getBehaviorTab();
                    break;
                case 'interface':
                    contentDiv.innerHTML = this.getInterfaceTab();
                    break;
                case 'execution':
                    contentDiv.innerHTML = this.getExecutionTab();
                    break;
                case 'backup':
                    contentDiv.innerHTML = this.getBackupTab();
                    break;
                case 'tools':
                    contentDiv.innerHTML = this.getToolsTab();
                    break;
            }

            // Aplicar valores atuais e eventos
            this.updateFormValues();
            this.setupTabEventListeners(tabName);
        },

        getBehaviorTab: function() {
            const config = window.TWS_ConfigManager.getCurrentConfig();
            return `
                <div style="background: ${STYLE.cardBg}; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: ${STYLE.panelHeaderText}; border-bottom: 1px solid #eee; padding-bottom: 10px;">🔄 Comportamento do Scheduler</h3>
                    
                    <div style="display: grid; gap: 15px;">
                        <!-- Intervalo de checagem -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                ⏱️ Intervalo de Checagem (ms)
                            </label>
                            <input type="range" id="schedulerCheckInterval" min="50" max="5000" step="50" 
                                   style="width: 100%; height: 8px; border-radius: 4px; background: #ddd; outline: none;" 
                                   oninput="document.getElementById('intervalValue').textContent = this.value + 'ms'">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: 5px;">
                                <span>⚡ 50ms (Preciso)</span>
                                <span id="intervalValue" style="font-weight: bold;">${config.behavior.schedulerCheckInterval}ms</span>
                                <span>🔋 5000ms (Econômico)</span>
                            </div>
                            <div style="font-size: 11px; color: #888; margin-top: 5px; padding-left: 5px;">
                                Controla com que frequência o scheduler verifica ataques pendentes.
                            </div>
                        </div>

                        <!-- Retry on fail -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="retryOnFail" ${config.behavior.retryOnFail ? 'checked' : ''} 
                                       style="width: 16px; height: 16px;">
                                🔁 Tentar novamente em caso de falha
                            </label>
                            <div style="font-size: 11px; color: #888; margin-left: 24px; margin-top: 3px;">
                                Se habilitado, tentará reenviar ataques que falharam.
                            </div>
                        </div>

                        <!-- Max retries -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                🔄 Máximo de Tentativas
                            </label>
                            <select id="maxRetries" style="width: 100%; padding: 8px; border-radius: 4px; background: ${STYLE.inputBg}; color: ${STYLE.panelText}; border: 1px solid ${STYLE.tableBorder};">
                                <option value="1" ${config.behavior.maxRetries === 1 ? 'selected' : ''}>1 tentativa</option>
                                <option value="2" ${config.behavior.maxRetries === 2 ? 'selected' : ''}>2 tentativas</option>
                                <option value="3" ${config.behavior.maxRetries === 3 ? 'selected' : ''}>3 tentativas</option>
                                <option value="5" ${config.behavior.maxRetries === 5 ? 'selected' : ''}>5 tentativas</option>
                            </select>
                        </div>

                        <!-- Auto clean -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="autoCleanCompleted" ${config.behavior.autoCleanCompleted ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                🗑️ Limpar automaticamente concluídos (após 24h)
                            </label>
                        </div>
                    </div>
                </div>
            `;
        },

        getInterfaceTab: function() {
            const config = window.TWS_ConfigManager.getCurrentConfig();
            return `
                <div style="background: ${STYLE.cardBg}; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: ${STYLE.panelHeaderText}; border-bottom: 1px solid #eee; padding-bottom: 10px;">🎨 Interface & Aparência</h3>
                    
                    <div style="display: grid; gap: 15px;">
                        <!-- Tema -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                🎨 Tema do Painel
                            </label>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="radio" name="theme" value="brown" ${config.interface.theme === 'brown' ? 'checked' : ''}>
                                    <span style="background: #8B4513; padding: 6px 12px; border-radius: 4px; color: white; font-size: 12px;">Marrom</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="radio" name="theme" value="blue" ${config.interface.theme === 'blue' ? 'checked' : ''}>
                                    <span style="background: #1976D2; padding: 6px 12px; border-radius: 4px; color: white; font-size: 12px;">Azul</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="radio" name="theme" value="dark" ${config.interface.theme === 'dark' ? 'checked' : ''}>
                                    <span style="background: #333; padding: 6px 12px; border-radius: 4px; color: white; font-size: 12px;">Escuro</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="radio" name="theme" value="green" ${config.interface.theme === 'green' ? 'checked' : ''}>
                                    <span style="background: #2E7D32; padding: 6px 12px; border-radius: 4px; color: white; font-size: 12px;">Verde</span>
                                </label>
                            </div>
                            <div style="font-size: 11px; color: #888; margin-top: 5px;">
                                Define as cores principais do painel e modais.
                            </div>
                        </div>

                        <!-- Auto open panel -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="autoOpenPanel" ${config.interface.autoOpenPanel ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                📂 Abrir painel automaticamente ao carregar
                            </label>
                        </div>

                        <!-- Show notifications -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="showNotifications" ${config.interface.showNotifications ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                🔔 Mostrar notificações no jogo
                            </label>
                        </div>

                        <!-- Compact mode -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="compactMode" ${config.interface.compactMode ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                📱 Modo compacto do painel
                            </label>
                            <div style="font-size: 11px; color: #888; margin-left: 24px; margin-top: 3px;">
                                Reduz o tamanho dos elementos para telas menores.
                            </div>
                        </div>

                        <!-- Preview -->
                        <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 6px; border: 1px dashed #ccc;">
                            <div style="font-weight: bold; margin-bottom: 10px; color: #555;">👁️ Visualização do Tema</div>
                            <div id="themePreview" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <div style="background: #8B4513; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; border: 1px solid #654321;">Botão</div>
                                <div style="background: #654321; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; border: 1px solid #8B4513;">Card</div>
                                <div style="background: #D2691E; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; border: 1px solid #8B4513;">Destaque</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        getExecutionTab: function() {
            const config = window.TWS_ConfigManager.getCurrentConfig();
            return `
                <div style="background: ${STYLE.cardBg}; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: ${STYLE.panelHeaderText}; border-bottom: 1px solid #eee; padding-bottom: 10px;">⚔️ Execução de Ataques</h3>
                    
                    <div style="display: grid; gap: 15px;">
                        <!-- Simultaneous attacks -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                🚀 Limite de Ataques Simultâneos
                            </label>
                            <input type="range" id="simultaneousAttackLimit" min="1" max="50" step="1" 
                                   style="width: 100%; height: 8px; border-radius: 4px; background: #ddd; outline: none;" 
                                   oninput="document.getElementById('attackLimitValue').textContent = this.value">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: 5px;">
                                <span>🎯 1 ataque</span>
                                <span id="attackLimitValue" style="font-weight: bold;">${config.execution.simultaneousAttackLimit}</span>
                                <span>⚡ 50 ataques</span>
                            </div>
                            <div style="font-size: 11px; color: #888; margin-top: 5px; padding-left: 5px;">
                                Máximo de ataques que podem ser executados ao mesmo tempo.
                            </div>
                        </div>

                        <!-- Attack timeout -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                ⏱️ Timeout por Ataque (ms)
                            </label>
                            <input type="range" id="attackTimeout" min="1000" max="10000" step="500" 
                                   style="width: 100%; height: 8px; border-radius: 4px; background: #ddd; outline: none;" 
                                   oninput="document.getElementById('timeoutValue').textContent = this.value + 'ms'">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: 5px;">
                                <span>⚡ 1s (Rápido)</span>
                                <span id="timeoutValue" style="font-weight: bold;">${config.execution.attackTimeout}ms</span>
                                <span>🛡️ 10s (Seguro)</span>
                            </div>
                        </div>

                        <!-- Delay between attacks -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                ⏳ Delay Entre Ataques (ms)
                            </label>
                            <input type="range" id="delayBetweenAttacks" min="0" max="5000" step="100" 
                                   style="width: 100%; height: 8px; border-radius: 4px; background: #ddd; outline: none;" 
                                   oninput="document.getElementById('delayValue').textContent = this.value + 'ms'">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: 5px;">
                                <span>⚡ 0ms (Simultâneo)</span>
                                <span id="delayValue" style="font-weight: bold;">${config.execution.delayBetweenAttacks}ms</span>
                                <span>🐌 5s (Lento)</span>
                            </div>
                            <div style="font-size: 11px; color: #888; margin-top: 5px; padding-left: 5px;">
                                Delay entre ataques do mesmo horário. 0 = todos simultâneos.
                            </div>
                        </div>

                        <!-- Validate troops -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="validateTroops" ${config.execution.validateTroops ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                ✅ Validar tropas antes de enviar
                            </label>
                        </div>

                        <!-- Skip if no troops -->
                        <div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="skipIfNoTroops" ${config.execution.skipIfNoTroops ? 'checked' : ''}
                                       style="width: 16px; height: 16px;">
                                ⏭️ Pular se não tiver tropas
                            </label>
                            <div style="font-size: 11px; color: #888; margin-left: 24px; margin-top: 3px;">
                                Se habilitado, ataques sem tropas suficientes serão automaticamente marcados como falha.
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        getBackupTab: function() {
            const config = window.TWS_ConfigManager.getCurrentConfig();
            const backups = window.TWS_BackupManager.listBackups();
            
            return `
                <div style="background: ${STYLE.cardBg}; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: ${STYLE.panelHeaderText}; border-bottom: 1px solid #eee; padding-bottom: 10px;">💾 Backup & Segurança</h3>
                    
                    <div style="display: grid; gap: 20px;">
                        <!-- Configurações de backup -->
                        <div>
                            <h4 style="color: #555; margin-bottom: 10px; font-size: 14px;">📊 Configurações</h4>
                            <div style="display: grid; gap: 10px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="autoExport" ${config.backup.autoExport ? 'checked' : ''}
                                           style="width: 16px; height: 16px;">
                                    🔄 Exportar automaticamente
                                </label>
                                
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                        ⏱️ Intervalo de Exportação
                                    </label>
                                    <select id="exportInterval" style="width: 100%; padding: 8px; border-radius: 4px; background: ${STYLE.inputBg}; color: ${STYLE.panelText}; border: 1px solid ${STYLE.tableBorder};">
                                        <option value="900000" ${config.backup.exportInterval === 900000 ? 'selected' : ''}>15 minutos</option>
                                        <option value="1800000" ${config.backup.exportInterval === 1800000 ? 'selected' : ''}>30 minutos</option>
                                        <option value="3600000" ${config.backup.exportInterval === 3600000 ? 'selected' : ''}>1 hora</option>
                                        <option value="7200000" ${config.backup.exportInterval === 7200000 ? 'selected' : ''}>2 horas</option>
                                        <option value="21600000" ${config.backup.exportInterval === 21600000 ? 'selected' : ''}>6 horas</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">
                                        🗃️ Máximo de Backups Mantidos
                                    </label>
                                    <input type="number" id="maxBackups" min="1" max="50" value="${config.backup.maxBackups}" 
                                           style="width: 100%; padding: 8px; border-radius: 4px; background: ${STYLE.inputBg}; color: ${STYLE.panelText}; border: 1px solid ${STYLE.tableBorder};">
                                </div>

                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="encryptBackups" ${config.backup.encryptBackups ? 'checked' : ''}
                                           style="width: 16px; height: 16px;">
                                    🔐 Criptografar backups (experimental)
                                </label>
                            </div>
                        </div>

                        <!-- Lista de backups -->
                        <div>
                            <h4 style="color: #555; margin-bottom: 10px; font-size: 14px;">📋 Backups Disponíveis (${backups.length})</h4>
                            ${backups.length > 0 ? `
                                <div style="max-height: 200px; overflow-y: auto; background: #f9f9f9; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 10px;">
                                    ${backups.map((backup, index) => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                                            <div>
                                                <div style="font-weight: bold; font-size: 12px;">Backup #${index + 1}</div>
                                                <div style="font-size: 10px; color: #888;">
                                                    ${new Date(backup.timestamp).toLocaleString('pt-BR')} | ${backup.count} agendamentos
                                                </div>
                                            </div>
                                            <div style="display: flex; gap: 5px;">
                                                <button class="restore-backup-btn" data-key="${backup.key}" 
                                                        style="padding: 4px 8px; background: ${STYLE.buttonGreen}; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">
                                                    🔄 Restaurar
                                                </button>
                                                <button class="delete-backup-btn" data-key="${backup.key}" 
                                                        style="padding: 4px 8px; background: ${STYLE.buttonRed}; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div style="text-align: center; padding: 20px; color: #888; background: #f9f9f9; border: 1px dashed #ccc; border-radius: 6px;">
                                    📭 Nenhum backup disponível
                                </div>
                            `}
                            
                            <div style="display: flex; gap: 10px; margin-top: 15px;">
                                <button id="createBackupBtn" 
                                        style="padding: 8px 16px; background: ${STYLE.buttonBlue}; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; font-size: 12px;">
                                    💾 Criar Backup Agora
                                </button>
                                <button id="exportConfigBtn" 
                                        style="padding: 8px 16px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; font-size: 12px;">
                                    📤 Exportar Config
                                </button>
                                <button id="importConfigBtn" 
                                        style="padding: 8px 16px; background: ${STYLE.buttonBrown}; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; font-size: 12px;">
                                    📥 Importar Config
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        getToolsTab: function() {
            const config = window.TWS_ConfigManager.getCurrentConfig();
            const stats = window.TWS_ConfigManager.getSchedulerStats();
            
            return `
                <div style="background: ${STYLE.cardBg}; border: 1px solid ${STYLE.tableBorder}; border-radius: 6px; padding: 20px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: ${STYLE.panelHeaderText}; border-bottom: 1px solid #eee; padding-bottom: 10px;">🛠️ Ferramentas & Diagnóstico</h3>
                    
                    <div style="display: grid; gap: 20px;">
                        <!-- Estatísticas -->
                        <div>
                            <h4 style="color: #555; margin-bottom: 10px; font-size: 14px;">📊 Estatísticas do Sistema</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                <div style="background: #f8f8f8; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #eee;">
                                    <div style="font-size: 10px; color: #888;">Agendamentos</div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${STYLE.buttonGreen};">
                                        ${window.TWS_Backend.getList().length}
                                    </div>
                                </div>
                                <div style="background: #f8f8f8; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #eee;">
                                    <div style="font-size: 10px; color: #888;">Em Execução</div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${STYLE.buttonOrange};">
                                        ${stats.executingCount || 0}
                                    </div>
                                </div>
                                <div style="background: #f8f8f8; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #eee;">
                                    <div style="font-size: 10px; color: #888;">Taxa de Sucesso</div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${(stats.metrics?.successRate || 0) > 80 ? STYLE.buttonGreen : STYLE.buttonOrange}">
                                        ${stats.metrics?.successRate || 0}%
                                    </div>
                                </div>
                                <div style="background: #f8f8f8; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #eee;">
                                    <div style="font-size: 10px; color: #888;">Último Ciclo</div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${STYLE.buttonBlue};">
                                        ${stats.metrics?.lastCycleDuration || 0}ms
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Ferramentas -->
                        <div>
                            <h4 style="color: #555; margin-bottom: 10px; font-size: 14px;">⚙️ Ferramentas</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                <button id="restartSchedulerBtn" 
                                        style="padding: 10px; background: ${STYLE.buttonOrange}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    🔄 Reiniciar Scheduler
                                </button>
                                <button id="clearCacheBtn" 
                                        style="padding: 10px; background: ${STYLE.buttonPurple}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    🧹 Limpar Cache
                                </button>
                                <button id="dumpStatsBtn" 
                                        style="padding: 10px; background: ${STYLE.buttonBlue}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    📊 Dump Estatísticas
                                </button>
                                <button id="debugConsoleBtn" 
                                        style="padding: 10px; background: ${STYLE.buttonGray}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    🐛 Console Debug
                                </button>
                            </div>
                        </div>

                        <!-- Informações do sistema -->
                        <div>
                            <h4 style="color: #555; margin-bottom: 10px; font-size: 14px;">ℹ️ Informações do Sistema</h4>
                            <div style="background: #f8f8f8; padding: 15px; border-radius: 6px; font-size: 12px; border: 1px solid #eee;">
                                <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px;">
                                    <div style="color: #888;">Versão:</div>
                                    <div>TW Scheduler Config v1.0</div>
                                    
                                    <div style="color: #888;">Backend:</div>
                                    <div>${window.TWS_Backend ? '✅ Carregado' : '❌ Não carregado'}</div>
                                    
                                    <div style="color: #888;">Agendamentos:</div>
                                    <div>${window.TWS_Backend.getList().length} registros</div>
                                    
                                    <div style="color: #888;">Configuração:</div>
                                    <div>${Object.keys(config).length} categorias</div>
                                    
                                    <div style="color: #888;">Storage:</div>
                                    <div>${Math.round((JSON.stringify(config).length / 1024) * 100) / 100} KB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        updateFormValues: function() {
            // ... (mantém a mesma lógica de atualização dos campos)
            // Só muda os estilos
        },

        setupTabEventListeners: function(tabName) {
            // ... (mantém a mesma lógica)
            // Só muda os estilos
        },

        setupBackupTabListeners: function() {
            // ... (mantém a mesma lógica)
        },

        setupToolsTabListeners: function() {
            // ... (mantém a mesma lógica)
        },

        setupInterfaceTabListeners: function() {
            // ... (mantém a mesma lógica)
        },

        saveCurrentConfig: function() {
            // ... (mantém a mesma lógica de coleta de dados)
            // Só muda os estilos
        }
    };

    // Exportar globalmente
    window.TWS_ConfigModal = ConfigModalUI;
    console.log('[ConfigModalUI] ✅ Carregado! Use window.TWS_ConfigModal.show()');

})();
