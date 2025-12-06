(function () {
    'use strict';

    if (!window.TWS_Backend) {
        console.warn('[Config Modal] Backend não carregado!');
        return;
    }

    // ============================================
    // CONFIGURAÇÕES PADRÃO
    // ============================================
    const DEFAULT_CONFIG = {
        // Comportamento do Scheduler
        behavior: {
            schedulerCheckInterval: 50,      // Intervalo de checagem em ms
            retryOnFail: true,               // Tentar novamente em caso de falha
            maxRetries: 3,                   // Máximo de tentativas
            autoCleanCompleted: true,        // Limpar automaticamente concluídos após 24h
            enableTelegram: false,           // Habilitar notificações Telegram
        },
        
        // Interface/UI
        interface: {
            showNotifications: true,         // Mostrar notificações no jogo
            autoOpenPanel: false,            // Abrir painel automaticamente ao carregar
            compactMode: false,              // Modo compacto do painel
            theme: 'brown',                  // 'brown', 'blue', 'dark', 'green'
        },
        
        // Execução de Ataques
        execution: {
            simultaneousAttackLimit: 10,     // Máximo de ataques simultâneos
            attackTimeout: 3000,             // Timeout por ataque (ms)
            delayBetweenAttacks: 0,          // Delay entre ataques (ms)
            validateTroops: true,            // Validar tropas antes de enviar
            skipIfNoTroops: true,            // Pular se não tiver tropas
        },
        
        // Backup/Segurança
        backup: {
            autoExport: false,               // Exportar automaticamente
            exportInterval: 3600000,         // Intervalo de exportação (1 hora)
            maxBackups: 10,                  // Máximo de backups mantidos
            encryptBackups: false,           // Criptografar backups
        }
    };

    // ============================================
    // STORAGE KEYS
    // ============================================
    const CONFIG_STORAGE_KEY = 'tws_global_config_v2';
    const BACKUP_STORAGE_KEY = 'tws_backup_';

    // ============================================
    // GERENCIAMENTO DE CONFIGURAÇÃO
    // ============================================
    let currentConfig = { ...DEFAULT_CONFIG };

    // Carregar configuração salva
    function loadConfig() {
        try {
            const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                currentConfig = {
                    behavior: { ...DEFAULT_CONFIG.behavior, ...parsed.behavior },
                    interface: { ...DEFAULT_CONFIG.interface, ...parsed.interface },
                    execution: { ...DEFAULT_CONFIG.execution, ...parsed.execution },
                    backup: { ...DEFAULT_CONFIG.backup, ...parsed.backup }
                };
                console.log('[Config] Configuração carregada');
            }
        } catch (e) {
            console.error('[Config] Erro ao carregar configuração:', e);
            currentConfig = { ...DEFAULT_CONFIG };
        }
        return currentConfig;
    }

    // Salvar configuração
    function saveConfig(config) {
        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
            currentConfig = config;
            console.log('[Config] Configuração salva');
            return true;
        } catch (e) {
            console.error('[Config] Erro ao salvar configuração:', e);
            return false;
        }
    }

    // Resetar para padrão
    function resetToDefault() {
        if (confirm('Deseja resetar TODAS as configurações para os valores padrão?')) {
            saveConfig({ ...DEFAULT_CONFIG });
            showSuccess('Configurações resetadas para padrão!');
            setTimeout(() => location.reload(), 1500);
            return true;
        }
        return false;
    }

    // ============================================
    // FUNÇÕES DE BACKUP
    // ============================================
    function createBackup() {
        try {
            const list = window.TWS_Backend.getList();
            const timestamp = new Date().toISOString();
            const backup = {
                id: `backup_${Date.now()}`,
                timestamp,
                count: list.length,
                data: list,
                config: currentConfig
            };
            
            const key = `${BACKUP_STORAGE_KEY}${Date.now()}`;
            localStorage.setItem(key, JSON.stringify(backup));
            
            // Manter apenas os últimos N backups
            cleanupOldBackups(currentConfig.backup.maxBackups);
            
            return { success: true, backup };
        } catch (e) {
            console.error('[Config] Erro ao criar backup:', e);
            return { success: false, error: e.message };
        }
    }

    function listBackups() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(BACKUP_STORAGE_KEY)) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key,
                        timestamp: backup.timestamp,
                        count: backup.count,
                        id: backup.id
                    });
                } catch (e) {
                    // Ignorar backups corrompidos
                }
            }
        }
        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function restoreBackup(backupKey) {
        try {
            const backup = JSON.parse(localStorage.getItem(backupKey));
            if (!backup || !backup.data || !Array.isArray(backup.data)) {
                throw new Error('Backup inválido ou corrompido');
            }
            
            // Restaurar agendamentos
            window.TWS_Backend.setList(backup.data);
            
            // Restaurar configuração se disponível
            if (backup.config) {
                saveConfig(backup.config);
            }
            
            return { success: true, count: backup.data.length };
        } catch (e) {
            console.error('[Config] Erro ao restaurar backup:', e);
            return { success: false, error: e.message };
        }
    }

    function deleteBackup(backupKey) {
        localStorage.removeItem(backupKey);
        return true;
    }

    function cleanupOldBackups(maxToKeep = 10) {
        const backups = listBackups();
        if (backups.length > maxToKeep) {
            const toDelete = backups.slice(maxToKeep);
            toDelete.forEach(backup => {
                localStorage.removeItem(backup.key);
            });
            console.log(`[Config] ${toDelete.length} backups antigos removidos`);
        }
    }

    // ============================================
    // FUNÇÕES DO SCHEDULER
    // ============================================
    function restartScheduler() {
        try {
            window.TWS_Backend.startScheduler();
            showSuccess('Scheduler reiniciado com novas configurações!');
            return true;
        } catch (e) {
            showError('Erro ao reiniciar scheduler: ' + e.message);
            return false;
        }
    }

    function getSchedulerStats() {
        if (window.TWS_SchedulerDebug) {
            return window.TWS_SchedulerDebug.getStats();
        }
        return { error: 'Debug API não disponível' };
    }

    // ============================================
    // FUNÇÕES UTILITÁRIAS
    // ============================================
    function showSuccess(message) {
        alert(`✅ ${message}`);
    }

    function showError(message) {
        alert(`❌ ${message}`);
    }

    function showInfo(message) {
        alert(`ℹ️ ${message}`);
    }

    function exportConfig() {
        const blob = new Blob([JSON.stringify(currentConfig, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tws_config_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    saveConfig(imported);
                    showSuccess('Configuração importada com sucesso! Reinicie para aplicar.');
                } catch (err) {
                    showError('Erro ao importar configuração: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ============================================
    // UI DO MODAL
    // ============================================
    function createModal() {
        // Remover modal existente
        const existing = document.getElementById('tws-config-modal');
        if (existing) existing.remove();

        // Criar overlay
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

        // Criar modal
        const modal = document.createElement('div');
        modal.id = 'tws-config-modal';
        modal.style.cssText = `
            background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
            border: 3px solid #D2691E;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 85vh;
            overflow-y: auto;
            padding: 0;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
            color: #F4E4C1;
        `;

        // Carregar configuração atual
        loadConfig();

        // Conteúdo do modal
        modal.innerHTML = `
            <div style="padding: 20px;">
                <!-- Cabeçalho -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #D2691E;">
                    <h2 style="margin: 0; color: #F4E4C1;">⚙️ Configurações TW Scheduler</h2>
                    <button id="tws-config-close" style="background: #D2691E; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 18px;">×</button>
                </div>

                <!-- Abas -->
                <div style="display: flex; gap: 5px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button class="config-tab active" data-tab="behavior">🔄 Comportamento</button>
                    <button class="config-tab" data-tab="interface">🎨 Interface</button>
                    <button class="config-tab" data-tab="execution">⚔️ Execução</button>
                    <button class="config-tab" data-tab="backup">💾 Backup</button>
                    <button class="config-tab" data-tab="tools">🛠️ Ferramentas</button>
                </div>

                <!-- Conteúdo das abas -->
                <div id="config-content">
                    <!-- Conteúdo será carregado dinamicamente -->
                </div>

                <!-- Rodapé -->
                <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #D2691E; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <button id="tws-config-reset" style="background: #D32F2F; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; margin-right: 10px;">🔄 Resetar Tudo</button>
                        <button id="tws-config-save" style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">💾 Salvar Configurações</button>
                    </div>
                    <div style="font-size: 11px; color: #D4B35D;">
                        v1.0 | Configurações aplicadas após reiniciar
                    </div>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Event Listeners
        document.getElementById('tws-config-close').onclick = hide;
        
        // Abas
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadTabContent(tab.dataset.tab);
            };
        });

        // Botões do rodapé
        document.getElementById('tws-config-reset').onclick = () => {
            if (confirm('⚠️ ATENÇÃO!\nIsso irá resetar TODAS as configurações para os valores padrão.\nO scheduler será reiniciado.\n\nContinuar?')) {
                resetToDefault();
            }
        };

        document.getElementById('tws-config-save').onclick = saveCurrentConfig;

        // Carregar primeira aba
        loadTabContent('behavior');
    }

    // ============================================
    // CONTEÚDO DAS ABAS
    // ============================================
    function loadTabContent(tabName) {
        const contentDiv = document.getElementById('config-content');
        
        switch (tabName) {
            case 'behavior':
                contentDiv.innerHTML = getBehaviorTab();
                break;
            case 'interface':
                contentDiv.innerHTML = getInterfaceTab();
                break;
            case 'execution':
                contentDiv.innerHTML = getExecutionTab();
                break;
            case 'backup':
                contentDiv.innerHTML = getBackupTab();
                break;
            case 'tools':
                contentDiv.innerHTML = getToolsTab();
                break;
        }

        // Aplicar valores atuais
        updateFormValues();
    }

    function getBehaviorTab() {
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #D4B35D;">🔄 Comportamento do Scheduler</h3>
                
                <div style="display: grid; gap: 15px;">
                    <!-- Intervalo de checagem -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            ⏱️ Intervalo de Checagem (ms)
                        </label>
                        <input type="range" id="schedulerCheckInterval" min="50" max="5000" step="50" 
                               style="width: 100%;" 
                               oninput="document.getElementById('intervalValue').textContent = this.value + 'ms'">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #D4B35D;">
                            <span>⚡ 50ms (Preciso)</span>
                            <span id="intervalValue">${currentConfig.behavior.schedulerCheckInterval}ms</span>
                            <span>🔋 5000ms (Econômico)</span>
                        </div>
                        <div style="font-size: 11px; color: #AAA; margin-top: 5px;">
                            Controla com que frequência o scheduler verifica ataques pendentes.
                            Menor = mais preciso, maior = economia de CPU.
                        </div>
                    </div>

                    <!-- Retry on fail -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="retryOnFail" ${currentConfig.behavior.retryOnFail ? 'checked' : ''}>
                            🔁 Tentar novamente em caso de falha
                        </label>
                        <div style="font-size: 11px; color: #AAA; margin-left: 24px; margin-top: 3px;">
                            Se habilitado, tentará reenviar ataques que falharam.
                        </div>
                    </div>

                    <!-- Max retries -->
                    <div ${!currentConfig.behavior.retryOnFail ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            🔄 Máximo de Tentativas
                        </label>
                        <select id="maxRetries" style="width: 100%; padding: 8px; border-radius: 4px; background: #654321; color: white; border: 1px solid #D2691E;">
                            <option value="1" ${currentConfig.behavior.maxRetries === 1 ? 'selected' : ''}>1 tentativa</option>
                            <option value="2" ${currentConfig.behavior.maxRetries === 2 ? 'selected' : ''}>2 tentativas</option>
                            <option value="3" ${currentConfig.behavior.maxRetries === 3 ? 'selected' : ''}>3 tentativas</option>
                            <option value="5" ${currentConfig.behavior.maxRetries === 5 ? 'selected' : ''}>5 tentativas</option>
                        </select>
                    </div>

                    <!-- Auto clean -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="autoCleanCompleted" ${currentConfig.behavior.autoCleanCompleted ? 'checked' : ''}>
                            🗑️ Limpar automaticamente concluídos (após 24h)
                        </label>
                    </div>

                    <!-- Telegram -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="enableTelegram" ${currentConfig.behavior.enableTelegram ? 'checked' : ''}>
                            📱 Habilitar notificações Telegram
                        </label>
                        <div style="font-size: 11px; color: #AAA; margin-left: 24px; margin-top: 3px;">
                            Requer configuração prévia do bot Telegram.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function getInterfaceTab() {
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #D4B35D;">🎨 Interface & Aparência</h3>
                
                <div style="display: grid; gap: 15px;">
                    <!-- Tema -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            🎨 Tema do Painel
                        </label>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="radio" name="theme" value="brown" ${currentConfig.interface.theme === 'brown' ? 'checked' : ''}>
                                <span style="background: #8B4513; padding: 2px 8px; border-radius: 3px; color: white;">Marrom</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="radio" name="theme" value="blue" ${currentConfig.interface.theme === 'blue' ? 'checked' : ''}>
                                <span style="background: #1976D2; padding: 2px 8px; border-radius: 3px; color: white;">Azul</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="radio" name="theme" value="dark" ${currentConfig.interface.theme === 'dark' ? 'checked' : ''}>
                                <span style="background: #333; padding: 2px 8px; border-radius: 3px; color: white;">Escuro</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="radio" name="theme" value="green" ${currentConfig.interface.theme === 'green' ? 'checked' : ''}>
                                <span style="background: #2E7D32; padding: 2px 8px; border-radius: 3px; color: white;">Verde</span>
                            </label>
                        </div>
                    </div>

                    <!-- Auto open panel -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="autoOpenPanel" ${currentConfig.interface.autoOpenPanel ? 'checked' : ''}>
                            📂 Abrir painel automaticamente ao carregar
                        </label>
                    </div>

                    <!-- Show notifications -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="showNotifications" ${currentConfig.interface.showNotifications ? 'checked' : ''}>
                            🔔 Mostrar notificações no jogo
                        </label>
                    </div>

                    <!-- Compact mode -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="compactMode" ${currentConfig.interface.compactMode ? 'checked' : ''}>
                            📱 Modo compacto do painel
                        </label>
                        <div style="font-size: 11px; color: #AAA; margin-left: 24px; margin-top: 3px;">
                            Reduz o tamanho dos elementos para telas menores.
                        </div>
                    </div>

                    <!-- Preview -->
                    <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                        <div style="font-weight: bold; margin-bottom: 10px; color: #D4B35D;">👁️ Visualização do Tema</div>
                        <div id="themePreview" style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="background: #8B4513; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">Botão</div>
                            <div style="background: #654321; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">Card</div>
                            <div style="background: #D2691E; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">Destaque</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function getExecutionTab() {
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #D4B35D;">⚔️ Execução de Ataques</h3>
                
                <div style="display: grid; gap: 15px;">
                    <!-- Simultaneous attacks -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            🚀 Limite de Ataques Simultâneos
                        </label>
                        <input type="range" id="simultaneousAttackLimit" min="1" max="50" step="1" 
                               style="width: 100%;" 
                               oninput="document.getElementById('attackLimitValue').textContent = this.value">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #D4B35D;">
                            <span>🎯 1 ataque</span>
                            <span id="attackLimitValue">${currentConfig.execution.simultaneousAttackLimit}</span>
                            <span>⚡ 50 ataques</span>
                        </div>
                        <div style="font-size: 11px; color: #AAA; margin-top: 5px;">
                            Máximo de ataques que podem ser executados ao mesmo tempo.
                        </div>
                    </div>

                    <!-- Attack timeout -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            ⏱️ Timeout por Ataque (ms)
                        </label>
                        <input type="range" id="attackTimeout" min="1000" max="10000" step="500" 
                               style="width: 100%;" 
                               oninput="document.getElementById('timeoutValue').textContent = this.value + 'ms'">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #D4B35D;">
                            <span>⚡ 1s (Rápido)</span>
                            <span id="timeoutValue">${currentConfig.execution.attackTimeout}ms</span>
                            <span>🛡️ 10s (Seguro)</span>
                        </div>
                    </div>

                    <!-- Delay between attacks -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            ⏳ Delay Entre Ataques (ms)
                        </label>
                        <input type="range" id="delayBetweenAttacks" min="0" max="5000" step="100" 
                               style="width: 100%;" 
                               oninput="document.getElementById('delayValue').textContent = this.value + 'ms'">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #D4B35D;">
                            <span>⚡ 0ms (Simultâneo)</span>
                            <span id="delayValue">${currentConfig.execution.delayBetweenAttacks}ms</span>
                            <span>🐌 5s (Lento)</span>
                        </div>
                        <div style="font-size: 11px; color: #AAA; margin-top: 5px;">
                            Delay entre ataques do mesmo horário. 0 = todos simultâneos.
                        </div>
                    </div>

                    <!-- Validate troops -->
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="validateTroops" ${currentConfig.execution.validateTroops ? 'checked' : ''}>
                            ✅ Validar tropas antes de enviar
                        </label>
                    </div>

                    <!-- Skip if no troops -->
                    <div ${!currentConfig.execution.validateTroops ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="skipIfNoTroops" ${currentConfig.execution.skipIfNoTroops ? 'checked' : ''}>
                            ⏭️ Pular se não tiver tropas
                        </label>
                        <div style="font-size: 11px; color: #AAA; margin-left: 24px; margin-top: 3px;">
                            Se habilitado, ataques sem tropas suficientes serão automaticamente marcados como falha.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function getBackupTab() {
        const backups = listBackups();
        
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #D4B35D;">💾 Backup & Segurança</h3>
                
                <div style="display: grid; gap: 20px;">
                    <!-- Configurações de backup -->
                    <div>
                        <h4 style="color: #D4B35D; margin-bottom: 10px;">📊 Configurações</h4>
                        <div style="display: grid; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="autoExport" ${currentConfig.backup.autoExport ? 'checked' : ''}>
                                🔄 Exportar automaticamente
                            </label>
                            
                            <div ${!currentConfig.backup.autoExport ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                                    ⏱️ Intervalo de Exportação
                                </label>
                                <select id="exportInterval" style="width: 100%; padding: 8px; border-radius: 4px; background: #654321; color: white; border: 1px solid #D2691E;">
                                    <option value="900000" ${currentConfig.backup.exportInterval === 900000 ? 'selected' : ''}>15 minutos</option>
                                    <option value="1800000" ${currentConfig.backup.exportInterval === 1800000 ? 'selected' : ''}>30 minutos</option>
                                    <option value="3600000" ${currentConfig.backup.exportInterval === 3600000 ? 'selected' : ''}>1 hora</option>
                                    <option value="7200000" ${currentConfig.backup.exportInterval === 7200000 ? 'selected' : ''}>2 horas</option>
                                    <option value="21600000" ${currentConfig.backup.exportInterval === 21600000 ? 'selected' : ''}>6 horas</option>
                                </select>
                            </div>

                            <div>
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                                    🗃️ Máximo de Backups Mantidos
                                </label>
                                <input type="number" id="maxBackups" min="1" max="50" value="${currentConfig.backup.maxBackups}" 
                                       style="width: 100%; padding: 8px; border-radius: 4px; background: #654321; color: white; border: 1px solid #D2691E;">
                            </div>

                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="encryptBackups" ${currentConfig.backup.encryptBackups ? 'checked' : ''}>
                                🔐 Criptografar backups (experimental)
                            </label>
                        </div>
                    </div>

                    <!-- Lista de backups -->
                    <div>
                        <h4 style="color: #D4B35D; margin-bottom: 10px;">📋 Backups Disponíveis (${backups.length})</h4>
                        ${backups.length > 0 ? `
                            <div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px;">
                                ${backups.map((backup, index) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                        <div>
                                            <div style="font-weight: bold;">Backup #${index + 1}</div>
                                            <div style="font-size: 11px; color: #AAA;">
                                                ${new Date(backup.timestamp).toLocaleString('pt-BR')} | ${backup.count} agendamentos
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 5px;">
                                            <button onclick="TWS_ConfigModal.restoreBackup('${backup.key}')" 
                                                    style="background: #4CAF50; color: white; border: none; border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
                                                🔄 Restaurar
                                            </button>
                                            <button onclick="TWS_ConfigModal.deleteBackup('${backup.key}')" 
                                                    style="background: #D32F2F; color: white; border: none; border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 20px; color: #AAA; background: rgba(0,0,0,0.3); border-radius: 6px;">
                                📭 Nenhum backup disponível
                            </div>
                        `}
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button id="createBackupBtn" 
                                    style="background: #2196F3; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; flex: 1;">
                                💾 Criar Backup Agora
                            </button>
                            <button id="exportConfigBtn" 
                                    style="background: #607D8B; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; flex: 1;">
                                📤 Exportar Config
                            </button>
                            <button id="importConfigBtn" 
                                    style="background: #795548; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; flex: 1;">
                                📥 Importar Config
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function getToolsTab() {
        const stats = getSchedulerStats();
        
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #D4B35D;">🛠️ Ferramentas & Diagnóstico</h3>
                
                <div style="display: grid; gap: 20px;">
                    <!-- Estatísticas -->
                    <div>
                        <h4 style="color: #D4B35D; margin-bottom: 10px;">📊 Estatísticas do Sistema</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 11px; color: #AAA;">Agendamentos</div>
                                <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">
                                    ${window.TWS_Backend.getList().length}
                                </div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 11px; color: #AAA;">Em Execução</div>
                                <div style="font-size: 20px; font-weight: bold; color: #FF9800;">
                                    ${stats.executingCount || 0}
                                </div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 11px; color: #AAA;">Taxa de Sucesso</div>
                                <div style="font-size: 20px; font-weight: bold; color: ${(stats.metrics?.successRate || 0) > 80 ? '#4CAF50' : '#FF9800'}">
                                    ${stats.metrics?.successRate || 0}%
                                </div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 11px; color: #AAA;">Último Ciclo</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">
                                    ${stats.metrics?.lastCycleDuration || 0}ms
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Ferramentas -->
                    <div>
                        <h4 style="color: #D4B35D; margin-bottom: 10px;">⚙️ Ferramentas</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <button id="restartSchedulerBtn" 
                                    style="background: #FF9800; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-size: 14px;">
                                🔄 Reiniciar Scheduler
                            </button>
                            <button id="clearCacheBtn" 
                                    style="background: #9C27B0; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-size: 14px;">
                                🧹 Limpar Cache
                            </button>
                            <button id="dumpStatsBtn" 
                                    style="background: #2196F3; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-size: 14px;">
                                📊 Dump Estatísticas
                            </button>
                            <button id="testTelegramBtn" 
                                    style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 10px; cursor: pointer; font-size: 14px;">
                                📱 Testar Telegram
                            </button>
                        </div>
                    </div>

                    <!-- Informações do sistema -->
                    <div>
                        <h4 style="color: #D4B35D; margin-bottom: 10px;">ℹ️ Informações do Sistema</h4>
                        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 6px; font-size: 12px;">
                            <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px;">
                                <div style="color: #AAA;">Versão:</div>
                                <div>TW Scheduler Config v1.0</div>
                                
                                <div style="color: #AAA;">Backend:</div>
                                <div>${window.TWS_Backend ? '✅ Carregado' : '❌ Não carregado'}</div>
                                
                                <div style="color: #AAA;">Agendamentos:</div>
                                <div>${window.TWS_Backend.getList().length} registros</div>
                                
                                <div style="color: #AAA;">Configuração:</div>
                                <div>${Object.keys(currentConfig).length} categorias</div>
                                
                                <div style="color: #AAA;">Storage:</div>
                                <div>${Math.round((JSON.stringify(currentConfig).length / 1024) * 100) / 100} KB</div>
                            </div>
                        </div>
                    </div>

                    <!-- Debug -->
                    <div>
                        <button id="debugConsoleBtn" 
                                style="background: #607D8B; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 10px;">
                            🐛 Abrir Console de Debug
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // ATUALIZAR VALORES DO FORMULÁRIO
    // ============================================
    function updateFormValues() {
        // Behavior
        const intervalInput = document.getElementById('schedulerCheckInterval');
        if (intervalInput) {
            intervalInput.value = currentConfig.behavior.schedulerCheckInterval;
            const intervalValue = document.getElementById('intervalValue');
            if (intervalValue) intervalValue.textContent = intervalInput.value + 'ms';
        }
        
        const retryCheckbox = document.getElementById('retryOnFail');
        if (retryCheckbox) retryCheckbox.checked = currentConfig.behavior.retryOnFail;
        
        const maxRetriesSelect = document.getElementById('maxRetries');
        if (maxRetriesSelect) maxRetriesSelect.value = currentConfig.behavior.maxRetries;
        
        const autoCleanCheckbox = document.getElementById('autoCleanCompleted');
        if (autoCleanCheckbox) autoCleanCheckbox.checked = currentConfig.behavior.autoCleanCompleted;
        
        const telegramCheckbox = document.getElementById('enableTelegram');
        if (telegramCheckbox) telegramCheckbox.checked = currentConfig.behavior.enableTelegram;
        
        // Interface
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        if (themeRadios.length > 0) {
            themeRadios.forEach(radio => {
                radio.checked = radio.value === currentConfig.interface.theme;
            });
        }
        
        const autoOpenCheckbox = document.getElementById('autoOpenPanel');
        if (autoOpenCheckbox) autoOpenCheckbox.checked = currentConfig.interface.autoOpenPanel;
        
        const notificationsCheckbox = document.getElementById('showNotifications');
        if (notificationsCheckbox) notificationsCheckbox.checked = currentConfig.interface.showNotifications;
        
        const compactCheckbox = document.getElementById('compactMode');
        if (compactCheckbox) compactCheckbox.checked = currentConfig.interface.compactMode;
        
        // Execution
        const attackLimitInput = document.getElementById('simultaneousAttackLimit');
        if (attackLimitInput) {
            attackLimitInput.value = currentConfig.execution.simultaneousAttackLimit;
            const attackLimitValue = document.getElementById('attackLimitValue');
            if (attackLimitValue) attackLimitValue.textContent = attackLimitInput.value;
        }
        
        const timeoutInput = document.getElementById('attackTimeout');
        if (timeoutInput) {
            timeoutInput.value = currentConfig.execution.attackTimeout;
            const timeoutValue = document.getElementById('timeoutValue');
            if (timeoutValue) timeoutValue.textContent = timeoutInput.value + 'ms';
        }
        
        const delayInput = document.getElementById('delayBetweenAttacks');
        if (delayInput) {
            delayInput.value = currentConfig.execution.delayBetweenAttacks;
            const delayValue = document.getElementById('delayValue');
            if (delayValue) delayValue.textContent = delayInput.value + 'ms';
        }
        
        const validateCheckbox = document.getElementById('validateTroops');
        if (validateCheckbox) validateCheckbox.checked = currentConfig.execution.validateTroops;
        
        const skipCheckbox = document.getElementById('skipIfNoTroops');
        if (skipCheckbox) skipCheckbox.checked = currentConfig.execution.skipIfNoTroops;
        
        // Backup
        const autoExportCheckbox = document.getElementById('autoExport');
        if (autoExportCheckbox) autoExportCheckbox.checked = currentConfig.backup.autoExport;
        
        const exportIntervalSelect = document.getElementById('exportInterval');
        if (exportIntervalSelect) exportIntervalSelect.value = currentConfig.backup.exportInterval;
        
        const maxBackupsInput = document.getElementById('maxBackups');
        if (maxBackupsInput) maxBackupsInput.value = currentConfig.backup.maxBackups;
        
        const encryptCheckbox = document.getElementById('encryptBackups');
        if (encryptCheckbox) encryptCheckbox.checked = currentConfig.backup.encryptBackups;
        
        // Atualizar event listeners dinâmicos
        updateDynamicEventListeners();
    }

    function updateDynamicEventListeners() {
        // Botões da aba Backup
        const createBackupBtn = document.getElementById('createBackupBtn');
        if (createBackupBtn) {
            createBackupBtn.onclick = () => {
                const result = createBackup();
                if (result.success) {
                    showSuccess(`Backup criado com ${result.backup.count} agendamentos!`);
                    loadTabContent('backup'); // Recarregar lista
                } else {
                    showError('Erro ao criar backup: ' + result.error);
                }
            };
        }
        
        const exportConfigBtn = document.getElementById('exportConfigBtn');
        if (exportConfigBtn) exportConfigBtn.onclick = exportConfig;
        
        const importConfigBtn = document.getElementById('importConfigBtn');
        if (importConfigBtn) importConfigBtn.onclick = importConfig;
        
        // Botões da aba Tools
        const restartSchedulerBtn = document.getElementById('restartSchedulerBtn');
        if (restartSchedulerBtn) restartSchedulerBtn.onclick = restartScheduler;
        
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.onclick = () => {
                if (confirm('Limpar cache local? Isso não afeta os agendamentos.')) {
                    // Limpar caches específicos do TWS
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key.startsWith('tws_cache_') || key.startsWith('TWS_')) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    showSuccess('Cache limpo!');
                }
            };
        }
        
        const dumpStatsBtn = document.getElementById('dumpStatsBtn');
        if (dumpStatsBtn) {
            dumpStatsBtn.onclick = () => {
                const stats = getSchedulerStats();
                console.table(stats);
                showInfo('Estatísticas exibidas no console (F12)');
            };
        }
        
        const testTelegramBtn = document.getElementById('testTelegramBtn');
        if (testTelegramBtn) {
            testTelegramBtn.onclick = () => {
                if (window.TWS_Backend.sendTelegramNotification) {
                    window.TWS_Backend.sendTelegramNotification('system_error', {
                        module: 'Config Modal',
                        error: 'Teste de notificação',
                        details: 'Esta é uma notificação de teste do modal de configurações',
                        action: 'Nenhuma ação necessária'
                    }).then(() => {
                        showInfo('Notificação de teste enviada para o Telegram!');
                    }).catch(e => {
                        showError('Erro ao enviar teste: ' + e.message);
                    });
                } else {
                    showError('Função de notificação não disponível');
                }
            };
        }
        
        const debugConsoleBtn = document.getElementById('debugConsoleBtn');
        if (debugConsoleBtn) {
            debugConsoleBtn.onclick = () => {
                if (window.TWS_SchedulerDebug) {
                    window.TWS_SchedulerDebug.dumpState();
                    showInfo('Informações de debug exibidas no console');
                } else {
                    showError('Debug API não disponível');
                }
            };
        }
        
        // Atualizar preview do tema
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        if (themeRadios.length > 0) {
            themeRadios.forEach(radio => {
                radio.onchange = () => {
                    const preview = document.getElementById('themePreview');
                    if (preview) {
                        const colors = {
                            brown: ['#8B4513', '#654321', '#D2691E'],
                            blue: ['#1976D2', '#0D47A1', '#42A5F5'],
                            dark: ['#333', '#222', '#555'],
                            green: ['#2E7D32', '#1B5E20', '#4CAF50']
                        };
                        const selectedColor = colors[radio.value] || colors.brown;
                        preview.children[0].style.background = selectedColor[0];
                        preview.children[1].style.background = selectedColor[1];
                        preview.children[2].style.background = selectedColor[2];
                    }
                };
            });
        }
    }

    // ============================================
    // SALVAR CONFIGURAÇÃO ATUAL
    // ============================================
    function saveCurrentConfig() {
        const newConfig = { ...currentConfig };
        
        // Behavior
        const intervalInput = document.getElementById('schedulerCheckInterval');
        if (intervalInput) newConfig.behavior.schedulerCheckInterval = parseInt(intervalInput.value);
        
        const retryCheckbox = document.getElementById('retryOnFail');
        if (retryCheckbox) newConfig.behavior.retryOnFail = retryCheckbox.checked;
        
        const maxRetriesSelect = document.getElementById('maxRetries');
        if (maxRetriesSelect) newConfig.behavior.maxRetries = parseInt(maxRetriesSelect.value);
        
        const autoCleanCheckbox = document.getElementById('autoCleanCompleted');
        if (autoCleanCheckbox) newConfig.behavior.autoCleanCompleted = autoCleanCheckbox.checked;
        
        const telegramCheckbox = document.getElementById('enableTelegram');
        if (telegramCheckbox) newConfig.behavior.enableTelegram = telegramCheckbox.checked;
        
        // Interface
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        if (themeRadios.length > 0) {
            themeRadios.forEach(radio => {
                if (radio.checked) newConfig.interface.theme = radio.value;
            });
        }
        
        const autoOpenCheckbox = document.getElementById('autoOpenPanel');
        if (autoOpenCheckbox) newConfig.interface.autoOpenPanel = autoOpenCheckbox.checked;
        
        const notificationsCheckbox = document.getElementById('showNotifications');
        if (notificationsCheckbox) newConfig.interface.showNotifications = notificationsCheckbox.checked;
        
        const compactCheckbox = document.getElementById('compactMode');
        if (compactCheckbox) newConfig.interface.compactMode = compactCheckbox.checked;
        
        // Execution
        const attackLimitInput = document.getElementById('simultaneousAttackLimit');
        if (attackLimitInput) newConfig.execution.simultaneousAttackLimit = parseInt(attackLimitInput.value);
        
        const timeoutInput = document.getElementById('attackTimeout');
        if (timeoutInput) newConfig.execution.attackTimeout = parseInt(timeoutInput.value);
        
        const delayInput = document.getElementById('delayBetweenAttacks');
        if (delayInput) newConfig.execution.delayBetweenAttacks = parseInt(delayInput.value);
        
        const validateCheckbox = document.getElementById('validateTroops');
        if (validateCheckbox) newConfig.execution.validateTroops = validateCheckbox.checked;
        
        const skipCheckbox = document.getElementById('skipIfNoTroops');
        if (skipCheckbox) newConfig.execution.skipIfNoTroops = skipCheckbox.checked;
        
        // Backup
        const autoExportCheckbox = document.getElementById('autoExport');
        if (autoExportCheckbox) newConfig.backup.autoExport = autoExportCheckbox.checked;
        
        const exportIntervalSelect = document.getElementById('exportInterval');
        if (exportIntervalSelect) newConfig.backup.exportInterval = parseInt(exportIntervalSelect.value);
        
        const maxBackupsInput = document.getElementById('maxBackups');
        if (maxBackupsInput) newConfig.backup.maxBackups = parseInt(maxBackupsInput.value);
        
        const encryptCheckbox = document.getElementById('encryptBackups');
        if (encryptCheckbox) newConfig.backup.encryptBackups = encryptCheckbox.checked;
        
        // Salvar
        if (saveConfig(newConfig)) {
            showSuccess('Configurações salvas! O scheduler será reiniciado.');
            setTimeout(() => {
                restartScheduler();
                hide();
            }, 1000);
        } else {
            showError('Erro ao salvar configurações!');
        }
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    function show() {
        createModal();
    }

    function hide() {
        const overlay = document.getElementById('tws-config-overlay');
        if (overlay) overlay.remove();
    }

    function getCurrentConfig() {
        return { ...currentConfig };
    }

    // ============================================
    // EXPORTAR API GLOBAL
    // ============================================
    window.TWS_ConfigModal = {
        show,
        hide,
        getCurrentConfig,
        loadConfig,
        saveConfig,
        resetToDefault,
        createBackup,
        listBackups,
        restoreBackup,
        deleteBackup,
        restartScheduler,
        getSchedulerStats,
        exportConfig,
        importConfig,
        showSuccess,
        showError,
        showInfo
    };

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    console.log('[TW Scheduler Config Modal] ✅ Carregado! Use window.TWS_ConfigModal.show()');

})();
