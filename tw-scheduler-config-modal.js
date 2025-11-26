(function () {
    'use strict';

    // === CONSTANTES E CONFIGURAÇÕES ===
    const CONFIG_STORAGE_KEY = 'tws_global_config_v2';
    
    // Configurações padrão
    const DEFAULT_CONFIG = {
        velocidadesUnidades: {
            spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
            light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
            knight: 10, snob: 35
        },
        telegram: {
            enabled: false,
            botToken: '',
            chatId: '',
            notifications: {
                success: true,
                failure: true,
                farmCycle: false,
                error: true
            }
        },
        theme: 'light',
        behavior: {
            autoStartScheduler: true,
            showNotifications: true,
            soundOnComplete: false,
            retryOnFail: true,
            maxRetries: 3,
            delayBetweenAttacks: 1000
        },
        security: {
            confirmDeletion: true,
            confirmMassActions: true,
            askBeforeSend: false,
            backupInterval: 86400000
        }
    };

    // === GERENCIAMENTO DE CONFIGURAÇÕES ===
    const ConfigManager = {
        /**
         * Obtém as configurações atuais
         * @returns {Object} Configurações salvas ou padrão
         */
        get() {
            try {
                const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}');
                return { ...DEFAULT_CONFIG, ...saved };
            } catch (error) {
                console.error('[Config] Erro ao carregar configurações:', error);
                return DEFAULT_CONFIG;
            }
        },

        /**
         * Salva as configurações
         * @param {Object} newConfig - Novas configurações
         * @returns {boolean} Sucesso da operação
         */
        save(newConfig) {
            try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
                this.apply(newConfig);
                return true;
            } catch (error) {
                console.error('[Config] Erro ao salvar configurações:', error);
                return false;
            }
        },

        /**
         * Aplica as configurações no sistema
         * @param {Object} config - Configurações a aplicar
         */
        apply(config) {
            this.applyTheme(config.theme);
            
            // Aplica velocidades globalmente se o backend existir
            if (window.TWS_Backend && config.velocidadesUnidades) {
                window.TWS_Backend._internal.velocidadesUnidades = config.velocidadesUnidades;
            }
            
            console.log('[Config] Configurações aplicadas com sucesso');
        },

        /**
         * Aplica o tema selecionado
         * @param {string} theme - Tema ('light', 'dark', 'auto')
         */
        applyTheme(theme) {
            const isDark = theme === 'dark' || 
                          (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.setAttribute('data-tws-theme', isDark ? 'dark' : 'light');
        },

        /**
         * Reseta as configurações para os valores padrão
         */
        reset() {
            localStorage.removeItem(CONFIG_STORAGE_KEY);
            this.apply(DEFAULT_CONFIG);
        }
    };

    // === UTILITÁRIOS ===
    const Utils = {
        /**
         * Calcula distância entre duas coordenadas
         * @param {string} coord1 - Coordenada origem (x|y)
         * @param {string} coord2 - Coordenada destino (x|y)
         * @returns {number} Distância em campos
         */
        calcularDistancia(coord1, coord2) {
            const [x1, y1] = coord1.split('|').map(Number);
            const [x2, y2] = coord2.split('|').map(Number);
            const deltaX = Math.abs(x1 - x2);
            const deltaY = Math.abs(y1 - y2);
            return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        },

        /**
         * Cria elemento DOM com estilos
         * @param {string} tag - Tag do elemento
         * @param {Object} styles - Estilos CSS
         * @param {string} innerHTML - Conteúdo HTML
         * @returns {HTMLElement} Elemento criado
         */
        createElement(tag, styles = {}, innerHTML = '') {
            const element = document.createElement(tag);
            Object.assign(element.style, styles);
            if (innerHTML) element.innerHTML = innerHTML;
            return element;
        },

        /**
         * Exporta dados como arquivo JSON
         * @param {Object} data - Dados para exportar
         * @param {string} filename - Nome do arquivo
         */
        exportJSON(data, filename) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    // === MODAL DE CONFIGURAÇÕES ===
    const ConfigModal = {
        currentConfig: null,
        tempFunctions: new Set(),

        /**
         * Exibe o modal de configurações
         */
        show() {
            this.closeExisting();
            this.currentConfig = ConfigManager.get();
            
            const overlay = this.createOverlay();
            const modal = this.createModal();
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            this.attachGlobalFunctions();
        },

        /**
         * Fecha modais existentes
         */
        closeExisting() {
            const existing = document.getElementById('tws-config-modal');
            if (existing) existing.remove();
        },

        /**
         * Cria overlay do modal
         * @returns {HTMLElement} Elemento overlay
         */
        createOverlay() {
            return Utils.createElement('div', {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.8)',
                zIndex: '999999',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }, '', { id: 'tws-config-modal' });
        },

        /**
         * Cria o modal principal
         * @returns {HTMLElement} Elemento modal
         */
        createModal() {
            const modal = Utils.createElement('div', {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: '3px solid #4A5568',
                borderRadius: '12px',
                padding: '0',
                width: '95%',
                maxWidth: '1000px',
                maxHeight: '90vh',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column'
            });

            modal.innerHTML = this.getModalHTML();
            return modal;
        },

        /**
         * Gera HTML do modal
         * @returns {string} HTML do modal
         */
        getModalHTML() {
            return `
                ${this.getModalStyles()}
                ${this.getModalHeader()}
                ${this.getModalTabs()}
                ${this.getModalContent()}
                ${this.getModalFooter()}
            `;
        },

        /**
         * Gera estilos CSS do modal
         * @returns {string} Estilos CSS
         */
        getModalStyles() {
            return `
                <style>
                    .tws-config-tabs { display: flex; background: #4A5568; padding: 0; }
                    .tws-config-tab { 
                        padding: 15px 20px; color: white; cursor: pointer; border: none; 
                        background: none; font-weight: bold; transition: all 0.3s; 
                    }
                    .tws-config-tab:hover { background: #5a6578; }
                    .tws-config-tab.active { background: #667eea; }
                    .tws-config-tab-content { 
                        display: none; padding: 20px; background: #F7FAFC; 
                        overflow-y: auto; max-height: 60vh; 
                    }
                    .tws-config-tab-content.active { display: block; }
                    .tws-config-section { 
                        background: white; border-radius: 8px; padding: 20px; 
                        margin: 10px 0; border-left: 4px solid #667eea; 
                    }
                    .tws-config-grid { 
                        display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
                        gap: 15px; margin-top: 15px; 
                    }
                    .tws-config-item { display: flex; align-items: center; gap: 10px; }
                    .tws-config-label { min-width: 80px; font-weight: bold; font-size: 14px; }
                    .tws-config-input { 
                        width: 80px; padding: 8px; border: 1px solid #CBD5E0; 
                        border-radius: 4px; text-align: center; 
                    }
                    .tws-config-btn { 
                        padding: 10px 16px; border: none; border-radius: 6px; color: white; 
                        font-weight: bold; cursor: pointer; margin: 5px; transition: all 0.3s; 
                    }
                    .tws-config-btn:hover { 
                        transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
                    }
                    .btn-primary { background: #667eea; }
                    .btn-success { background: #48BB78; }
                    .btn-warning { background: #ED8936; }
                    .btn-danger { background: #F56565; }
                    .btn-secondary { background: #718096; }
                    
                    [data-tws-theme="dark"] .tws-config-tab-content { 
                        background: #2D3748; color: #E2E8F0; 
                    }
                    [data-tws-theme="dark"] .tws-config-section { 
                        background: #4A5568; color: #E2E8F0; 
                    }
                    [data-tws-theme="dark"] .tws-config-input { 
                        background: #2D3748; border-color: #718096; color: #E2E8F0; 
                    }
                </style>
            `;
        },

        /**
         * Gera cabeçalho do modal
         * @returns {string} HTML do cabeçalho
         */
        getModalHeader() {
            return `
                <div style="background: #4A5568; padding: 20px; text-align: center; border-bottom: 3px solid #667eea;">
                    <div style="font-size: 24px; font-weight: bold; color: white;">
                        ⚙️ CONFIGURAÇÕES GLOBAIS
                    </div>
                    <div style="color: #E2E8F0; font-size: 14px; margin-top: 5px;">
                        Ajuste velocidades, Telegram, aparência e comportamento do sistema
                    </div>
                </div>
            `;
        },

        /**
         * Gera abas do modal
         * @returns {string} HTML das abas
         */
        getModalTabs() {
            const tabs = [
                { id: 'unidades', label: '🎯 Unidades' },
                { id: 'telegram', label: '🤖 Telegram' },
                { id: 'aparencia', label: '🎨 Aparência' },
                { id: 'comportamento', label: '⚡ Comportamento' },
                { id: 'backup', label: '💾 Backup' }
            ];

            return `
                <div class="tws-config-tabs">
                    ${tabs.map(tab => `
                        <button class="tws-config-tab ${tab.id === 'unidades' ? 'active' : ''}" 
                                onclick="TWS_ConfigModal.switchTab('${tab.id}')">
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>
            `;
        },

        /**
         * Gera conteúdo das abas
         * @returns {string} HTML do conteúdo
         */
        getModalContent() {
            return `
                <div style="flex: 1; overflow-y: auto;">
                    ${this.getUnitsTab()}
                    ${this.getTelegramTab()}
                    ${this.getAppearanceTab()}
                    ${this.getBehaviorTab()}
                    ${this.getBackupTab()}
                </div>
            `;
        },

        /**
         * Gera aba de unidades
         * @returns {string} HTML da aba
         */
        getUnitsTab() {
            return `
                <div id="tab-unidades" class="tws-config-tab-content active">
                    <div class="tws-config-section">
                        <h3 style="margin-top: 0; color: #2D3748;">🎯 Velocidades das Unidades</h3>
                        <p style="color: #718096; font-size: 13px; margin-bottom: 15px;">
                            Ajuste as velocidades conforme as configurações do seu mundo. Valores em minutos por campo.
                        </p>
                        
                        <div class="tws-config-grid" id="unit-speed-config">
                            ${Object.entries(this.currentConfig.velocidadesUnidades).map(([unit, speed]) => `
                                <div class="tws-config-item">
                                    <span class="tws-config-label">${unit}:</span>
                                    <input type="number" class="tws-config-input" data-unit="${unit}" 
                                           value="${speed}" min="1" max="100" step="0.1" />
                                    <span style="font-size: 11px; color: #718096;">min/campo</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="margin-top: 20px; display: flex; gap: 10px;">
                            <button class="tws-config-btn btn-secondary" onclick="TWS_ConfigModal.resetUnitSpeeds()">
                                🔄 Resetar Velocidades
                            </button>
                            <button class="tws-config-btn btn-success" onclick="TWS_ConfigModal.testUnitSpeed()">
                                🧪 Testar Cálculo
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Gera aba do Telegram
         * @returns {string} HTML da aba
         */
        getTelegramTab() {
            const t = this.currentConfig.telegram;
            return `
                <div id="tab-telegram" class="tws-config-tab-content">
                    <div class="tws-config-section">
                        <h3 style="margin-top: 0; color: #2D3748;">🤖 Configurações do Telegram</h3>
                        
                        <div style="margin-bottom: 15px;">
                            <label>
                                <input type="checkbox" id="telegram-enabled" ${t.enabled ? 'checked' : ''}>
                                Ativar notificações do Telegram
                            </label>
                        </div>
                        
                        <div style="display: grid; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Bot Token:</label>
                                <input type="password" style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                                       id="telegram-token" value="${t.botToken}" placeholder="123456789:ABCdefGHIjkl..." />
                            </div>
                            
                            <div>
                                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Chat ID:</label>
                                <input type="text" style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                                       id="telegram-chatid" value="${t.chatId}" placeholder="-100123456789" />
                            </div>
                        </div>
                        
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 10px;">Notificações:</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <label>
                                    <input type="checkbox" id="telegram-notif-success" ${t.notifications.success ? 'checked' : ''}>
                                    ✅ Ataques bem-sucedidos
                                </label>
                                <label>
                                    <input type="checkbox" id="telegram-notif-failure" ${t.notifications.failure ? 'checked' : ''}>
                                    ❌ Ataques falhos
                                </label>
                                <label>
                                    <input type="checkbox" id="telegram-notif-farm" ${t.notifications.farmCycle ? 'checked' : ''}>
                                    🔄 Ciclos de Farm
                                </label>
                                <label>
                                    <input type="checkbox" id="telegram-notif-error" ${t.notifications.error ? 'checked' : ''}>
                                    🚨 Erros do sistema
                                </label>
                            </div>
                        </div>
                        
                        <button class="tws-config-btn btn-primary" onclick="TWS_ConfigModal.testTelegram()" style="margin-top: 15px;">
                            🧪 Testar Conexão Telegram
                        </button>
                    </div>
                </div>
            `;
        },

        /**
         * Gera aba de aparência
         * @returns {string} HTML da aba
         */
        getAppearanceTab() {
            const b = this.currentConfig.behavior;
            return `
                <div id="tab-aparencia" class="tws-config-tab-content">
                    <div class="tws-config-section">
                        <h3 style="margin-top: 0; color: #2D3748;">🎨 Aparência e Tema</h3>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Tema:</label>
                            <select style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" id="theme-select">
                                <option value="light" ${this.currentConfig.theme === 'light' ? 'selected' : ''}>🌞 Claro</option>
                                <option value="dark" ${this.currentConfig.theme === 'dark' ? 'selected' : ''}>🌙 Escuro</option>
                                <option value="auto" ${this.currentConfig.theme === 'auto' ? 'selected' : ''}>⚡ Automático (Sistema)</option>
                            </select>
                        </div>
                        
                        <div style="display: grid; gap: 10px;">
                            <label>
                                <input type="checkbox" id="show-notifications" ${b.showNotifications ? 'checked' : ''}>
                                Mostrar notificações na tela
                            </label>
                            <label>
                                <input type="checkbox" id="sound-on-complete" ${b.soundOnComplete ? 'checked' : ''}>
                                Som quando ataques são concluídos
                            </label>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Gera aba de comportamento
         * @returns {string} HTML da aba
         */
        getBehaviorTab() {
            const b = this.currentConfig.behavior;
            return `
                <div id="tab-comportamento" class="tws-config-tab-content">
                    <div class="tws-config-section">
                        <h3 style="margin-top: 0; color: #2D3748;">⚡ Comportamento do Sistema</h3>
                        
                        <div style="display: grid; gap: 15px;">
                            <label>
                                <input type="checkbox" id="auto-start-scheduler" ${b.autoStartScheduler ? 'checked' : ''}>
                                Iniciar scheduler automaticamente
                            </label>
                            
                            <label>
                                <input type="checkbox" id="retry-on-fail" ${b.retryOnFail ? 'checked' : ''}>
                                Tentar novamente em caso de falha
                            </label>
                            
                            <div>
                                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Máximo de tentativas:</label>
                                <input type="number" style="width: 100px; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                                       id="max-retries" value="${b.maxRetries}" min="1" max="10" />
                            </div>
                            
                            <div>
                                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Delay entre ataques (ms):</label>
                                <input type="number" style="width: 150px; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                                       id="delay-between-attacks" value="${b.delayBetweenAttacks}" min="0" max="10000" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Gera aba de backup
         * @returns {string} HTML da aba
         */
        getBackupTab() {
            const stats = this.getSystemStats();
            return `
                <div id="tab-backup" class="tws-config-tab-content">
                    <div class="tws-config-section">
                        <h3 style="margin-top: 0; color: #2D3748;">💾 Backup e Restauração</h3>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <button class="tws-config-btn btn-success" onclick="TWS_ConfigModal.exportConfig()">
                                📤 Exportar Configurações
                            </button>
                            
                            <button class="tws-config-btn btn-primary" onclick="TWS_ConfigModal.importConfig()">
                                📥 Importar Configurações
                            </button>
                            
                            <button class="tws-config-btn btn-warning" onclick="TWS_ConfigModal.backupData()">
                                💾 Backup Completo
                            </button>
                            
                            <button class="tws-config-btn btn-danger" onclick="TWS_ConfigModal.resetConfig()">
                                🗑️ Resetar Tudo
                            </button>
                        </div>
                        
                        <div style="background: #EDF2F7; padding: 15px; border-radius: 6px;">
                            <h4 style="margin-top: 0;">📊 Estatísticas do Sistema</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                                <div>Agendamentos: <span id="stats-agendamentos">${stats.schedules}</span></div>
                                <div>Farms: <span id="stats-farms">${stats.farms}</span></div>
                                <div>Configurações: <span id="stats-config-size">${stats.configSize}</span> KB</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Gera rodapé do modal
         * @returns {string} HTML do rodapé
         */
        getModalFooter() {
            return `
                <div style="background: #F7FAFC; padding: 15px; text-align: center; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
                    <button class="tws-config-btn btn-secondary" onclick="TWS_ConfigModal.close()">
                        ❌ Cancelar
                    </button>
                    
                    <div>
                        <button class="tws-config-btn btn-warning" onclick="TWS_ConfigModal.save()">
                            💾 Salvar
                        </button>
                        
                        <button class="tws-config-btn btn-success" onclick="TWS_ConfigModal.saveAndClose()">
                            ✅ Salvar e Fechar
                        </button>
                    </div>
                </div>
            `;
        },

        /**
         * Obtém estatísticas do sistema
         * @returns {Object} Estatísticas
         */
        getSystemStats() {
            const config = this.currentConfig;
            return {
                schedules: window.TWS_Backend ? window.TWS_Backend.getList().length : 0,
                farms: window.TWS_FarmInteligente ? window.TWS_FarmInteligente._getFarmList().length : 0,
                configSize: Math.round(JSON.stringify(config).length / 1024 * 100) / 100
            };
        },

        // === FUNÇÕES DO MODAL ===
        
        /**
         * Alterna entre abas
         * @param {string} tabName - Nome da aba
         */
        switchTab(tabName) {
            document.querySelectorAll('.tws-config-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tws-config-tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(`.tws-config-tab[onclick="TWS_ConfigModal.switchTab('${tabName}')"]`).classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        },

        /**
         * Reseta velocidades das unidades
         */
        resetUnitSpeeds() {
            if (confirm('Resetar velocidades para valores padrão?')) {
                this.currentConfig.velocidadesUnidades = { ...DEFAULT_CONFIG.velocidadesUnidades };
                
                document.querySelectorAll('.tws-config-input').forEach(input => {
                    const unit = input.dataset.unit;
                    input.value = this.currentConfig.velocidadesUnidades[unit];
                });
                
                alert('✅ Velocidades resetadas!');
            }
        },

        /**
         * Testa cálculo de velocidade
         */
        testUnitSpeed() {
            const origem = prompt('Coordenada de origem (ex: 500|500):', '500|500');
            const destino = prompt('Coordenada de destino (ex: 501|501):', '501|501');
            
            if (origem && destino) {
                const distancia = Utils.calcularDistancia(origem, destino);
                const unidadeMaisLenta = 'spear';
                const velocidade = this.currentConfig.velocidadesUnidades[unidadeMaisLenta];
                const tempo = distancia * velocidade;
                
                alert(`🧪 TESTE DE CÁLCULO:\n\n📍 ${origem} → ${destino}\n📏 Distância: ${distancia.toFixed(2)} campos\n🐌 Unidade: ${unidadeMaisLenta}\n⚡ Velocidade: ${velocidade} min/campo\n⏱️ Tempo: ${tempo.toFixed(1)} min`);
            }
        },

        /**
         * Testa conexão com Telegram
         */
        testTelegram() {
            alert('🧪 Funcionalidade de teste do Telegram será implementada!');
        },

        /**
         * Exporta configurações
         */
        exportConfig() {
            Utils.exportJSON(this.currentConfig, `tws_config_${Date.now()}.json`);
            alert('✅ Configurações exportadas!');
        },

        /**
         * Importa configurações
         */
        importConfig() {
            alert('📥 Funcionalidade de importação será implementada!');
        },

        /**
         * Faz backup completo
         */
        backupData() {
            alert('💾 Funcionalidade de backup completo será implementada!');
        },

        /**
         * Reseta todas as configurações
         */
        resetConfig() {
            if (confirm('⚠️ TEM CERTEZA?\n\nIsso resetará TODAS as configurações para os valores padrão.')) {
                ConfigManager.reset();
                alert('✅ Configurações resetadas!');
                this.close();
            }
        },

        /**
         * Salva configurações
         */
        save() {
            this.gatherFormData();
            
            if (ConfigManager.save(this.currentConfig)) {
                alert('✅ Configurações salvas com sucesso!');
            }
        },

        /**
         * Salva e fecha o modal
         */
        saveAndClose() {
            this.save();
            this.close();
        },

        /**
         * Coleta dados do formulário
         */
        gatherFormData() {
            // Velocidades das unidades
            document.querySelectorAll('.tws-config-input').forEach(input => {
                const unit = input.dataset.unit;
                const value = parseInt(input.value) || DEFAULT_CONFIG.velocidadesUnidades[unit];
                this.currentConfig.velocidadesUnidades[unit] = Math.max(1, value);
            });
            
            // Telegram
            this.currentConfig.telegram.enabled = document.getElementById('telegram-enabled').checked;
            this.currentConfig.telegram.botToken = document.getElementById('telegram-token').value;
            this.currentConfig.telegram.chatId = document.getElementById('telegram-chatid').value;
            this.currentConfig.telegram.notifications.success = document.getElementById('telegram-notif-success').checked;
            this.currentConfig.telegram.notifications.failure = document.getElementById('telegram-notif-failure').checked;
            this.currentConfig.telegram.notifications.farmCycle = document.getElementById('telegram-notif-farm').checked;
            this.currentConfig.telegram.notifications.error = document.getElementById('telegram-notif-error').checked;
            
            // Aparência e comportamento
            this.currentConfig.theme = document.getElementById('theme-select').value;
            this.currentConfig.behavior.showNotifications = document.getElementById('show-notifications').checked;
            this.currentConfig.behavior.soundOnComplete = document.getElementById('sound-on-complete').checked;
            this.currentConfig.behavior.autoStartScheduler = document.getElementById('auto-start-scheduler').checked;
            this.currentConfig.behavior.retryOnFail = document.getElementById('retry-on-fail').checked;
            this.currentConfig.behavior.maxRetries = parseInt(document.getElementById('max-retries').value) || 3;
            this.currentConfig.behavior.delayBetweenAttacks = parseInt(document.getElementById('delay-between-attacks').value) || 1000;
        },

        /**
         * Fecha o modal
         */
        close() {
            this.closeExisting();
            this.cleanupGlobalFunctions();
        },

        /**
         * Anexa funções globais temporárias
         */
        attachGlobalFunctions() {
            const functions = [
                'switchTab', 'resetUnitSpeeds', 'testUnitSpeed', 'testTelegram',
                'exportConfig', 'importConfig', 'backupData', 'resetConfig',
                'save', 'saveAndClose', 'close'
            ];

            functions.forEach(func => {
                window.TWS_ConfigModal[func] = this[func].bind(this);
                this.tempFunctions.add(func);
            });

            // Fechar modal ao clicar fora
            const overlay = document.getElementById('tws-config-modal');
            if (overlay) {
                overlay.onclick = (e) => {
                    if (e.target === overlay) this.close();
                };
            }
        },

        /**
         * Limpa funções globais temporárias
         */
        cleanupGlobalFunctions() {
            this.tempFunctions.forEach(func => {
                delete window.TWS_ConfigModal[func];
            });
            this.tempFunctions.clear();
        }
    };

    // === INICIALIZAÇÃO ===
    function init() {
        if (!window.TWS_ConfigModal) {
            window.TWS_ConfigModal = {};
        }
        
        // Expor API pública
        Object.assign(window.TWS_ConfigModal, {
            show: () => ConfigModal.show(),
            getConfig: () => ConfigManager.get(),
            saveConfig: (config) => ConfigManager.save(config),
            resetConfig: () => ConfigManager.reset()
        });
        
        // Aplicar configurações ao carregar
        ConfigManager.apply(ConfigManager.get());
        
        console.log('[TW Config] ✅ Sistema de configurações carregado!');
    }

    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
