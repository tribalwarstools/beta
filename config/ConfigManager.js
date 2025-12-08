//ConfigManager.js
(function () {
    'use strict';

    if (!window.TWS_Backend) {
        console.warn('[ConfigManager] Backend não carregado!');
        return;
    }

    // ============================================
    // CONFIGURAÇÕES PADRÃO
    // ============================================
    const DEFAULT_CONFIG = {
        behavior: {
            schedulerCheckInterval: 50,
            retryOnFail: true,
            maxRetries: 3,
            autoCleanCompleted: true
        },
        interface: {
            showNotifications: true,
            autoOpenPanel: false,
            compactMode: false,
            theme: 'brown'
        },
        execution: {
            simultaneousAttackLimit: 10,
            attackTimeout: 3000,
            delayBetweenAttacks: 0,
            validateTroops: true,
            skipIfNoTroops: true
        },
        backup: {
            autoExport: false,
            exportInterval: 3600000,
            maxBackups: 10,
            encryptBackups: false
        }
    };

    const CONFIG_STORAGE_KEY = 'tws_global_config_v2';
    let currentConfig = { ...DEFAULT_CONFIG };

    // ============================================
    // API PÚBLICA
    // ============================================
    const ConfigManager = {
        loadConfig: function() {
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
                    console.log('[ConfigManager] Configuração carregada');
                }
            } catch (e) {
                console.error('[ConfigManager] Erro ao carregar configuração:', e);
                currentConfig = { ...DEFAULT_CONFIG };
            }
            return currentConfig;
        },

        saveConfig: function(config) {
            try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
                currentConfig = config;
                console.log('[ConfigManager] Configuração salva');
                return true;
            } catch (e) {
                console.error('[ConfigManager] Erro ao salvar configuração:', e);
                return false;
            }
        },

        getCurrentConfig: function() {
            return { ...currentConfig };
        },

        resetToDefault: function() {
            if (confirm('Deseja resetar TODAS as configurações para os valores padrão?')) {
                this.saveConfig({ ...DEFAULT_CONFIG });
                this.showSuccess('Configurações resetadas para padrão!');
                setTimeout(() => location.reload(), 1500);
                return true;
            }
            return false;
        },

        showSuccess: function(message) {
            alert(`✅ ${message}`);
        },

        showError: function(message) {
            alert(`❌ ${message}`);
        },

        showInfo: function(message) {
            alert(`ℹ️ ${message}`);
        },

        exportConfig: function() {
            const blob = new Blob([JSON.stringify(currentConfig, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tws_config_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },

        importConfig: function() {
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
                        this.saveConfig(imported);
                        this.showSuccess('Configuração importada com sucesso! Reinicie para aplicar.');
                    } catch (err) {
                        this.showError('Erro ao importar configuração: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        },

        restartScheduler: function() {
            try {
                if (window.TWS_Backend && window.TWS_Backend.startScheduler) {
                    window.TWS_Backend.startScheduler();
                    this.showSuccess('Scheduler reiniciado com novas configurações!');
                    return true;
                }
            } catch (e) {
                this.showError('Erro ao reiniciar scheduler: ' + e.message);
                return false;
            }
        },

        getSchedulerStats: function() {
            if (window.TWS_SchedulerDebug) {
                return window.TWS_SchedulerDebug.getStats();
            }
            return { error: 'Debug API não disponível' };
        },

        clearCache: function() {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('tws_cache_') || key.startsWith('TWS_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            return keysToRemove.length;
        }
    };

    // Inicialização automática
    ConfigManager.loadConfig();

    // Exportar globalmente
    window.TWS_ConfigManager = ConfigManager;
    console.log('[ConfigManager] ✅ Carregado!');

})();
