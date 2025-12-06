// ========== CONFIG-CORE.JS ==========
// Configurações globais, funções helper e gerenciamento básico
(function() {
    'use strict';

    // === CONFIGURAÇÕES GLOBAIS ===
    const CONFIG_STORAGE_KEY = 'tws_global_config_v2';
    
    // Configurações padrão
    const defaultConfig = {
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
            schedulerCheckInterval: 50, // ✅ NOVO: substitui delayBetweenAttacks
            confirmDeletion: true,
            askBeforeSend: false
        },
        security: {
            confirmMassActions: true,
            backupInterval: 86400000
        }
    };

    // === GERENCIAMENTO DE CONFIGURAÇÕES ===
    function getConfig() {
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}');
            return { ...defaultConfig, ...saved };
        } catch (e) {
            console.error('[Config] Erro ao carregar configurações:', e);
            return defaultConfig;
        }
    }

    function saveConfig(newConfig) {
        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
            applyConfig(newConfig);
            return true;
        } catch (e) {
            console.error('[Config] Erro ao salvar configurações:', e);
            return false;
        }
    }

    function applyConfig(config) {
        // Aplicar tema
        applyTheme(config.theme);
        
        // Aplicar velocidades das tropas globalmente
        if (window.TWS_Backend && config.velocidadesUnidades) {
            window.TWS_Backend._internal.velocidadesUnidades = config.velocidadesUnidades;
        }
        
        console.log('[Config] Configurações aplicadas');
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-tws-theme', isDark ? 'dark' : 'light');
    }

    // === FUNÇÕES AUXILIARES ===
    function getUnitDisplayName(unit) {
        const names = {
            spear: 'Lanceiro',
            sword: 'Espadachim',
            axe: 'Bárbaro',
            archer: 'Arqueiro',
            spy: 'Espião',
            light: 'Cav. Leve',
            marcher: 'Arqueiro Cav.',
            heavy: 'Cav. Pesado',
            ram: 'Ariete',
            catapult: 'Catapulta',
            knight: 'Paladino',
            snob: 'Nobre'
        };
        return names[unit] || unit;
    }

    function calcularDistancia(coord1, coord2) {
        const [x1, y1] = coord1.split('|').map(Number);
        const [x2, y2] = coord2.split('|').map(Number);
        const deltaX = Math.abs(x1 - x2);
        const deltaY = Math.abs(y1 - y2);
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    // === FUNÇÕES AUXILIARES PARA SCHEDULER CHECK INTERVAL ===
    function calculatePrecision(interval) {
        return Math.ceil(interval / 2);
    }

    function getPrecisionColor(interval) {
        if (interval <= 100) return '#C6F6D5'; // Verde - alta precisão
        if (interval <= 500) return '#E6FFFA'; // Verde água - boa precisão  
        if (interval <= 1000) return '#EBF8FF'; // Azul - balanceado
        if (interval <= 2000) return '#FEFCBF'; // Amarelo - econômico
        return '#FED7D7'; // Vermelho - baixa precisão
    }

    // === MIGRAÇÃO DE CONFIGURAÇÕES ===
    function migrateOldConfig() {
        try {
            const config = getConfig();
            
            // ✅ GARANTIR QUE schedulerCheckInterval SEMPRE EXISTA
            if (typeof config.behavior.schedulerCheckInterval !== 'number') {
                console.log('[Config] Inicializando schedulerCheckInterval para 50ms');
                config.behavior.schedulerCheckInterval = 50;
                saveConfig(config);
            }
            
            return config;
        } catch (e) {
            console.error('[Config] Erro na migração:', e);
            return getConfig();
        }
    }

    // === EXPORTAÇÃO PARA NAMESPACE ===
    if (!window.TWS_ConfigModal) {
        window.TWS_ConfigModal = {};
    }
    
    window.TWS_ConfigModal.Core = {
        CONFIG_STORAGE_KEY,
        defaultConfig,
        getConfig,
        saveConfig,
        applyConfig,
        applyTheme,
        getUnitDisplayName,
        calcularDistancia,
        calculatePrecision,
        getPrecisionColor,
        migrateOldConfig
    };

    // === INICIALIZAÇÃO ===
    function initCore() {
        // Migrar configurações antigas
        migrateOldConfig();
        
        // Aplicar configurações ao carregar
        const config = getConfig();
        applyConfig(config);
        
        console.log('[Config Core] ✅ Carregado com schedulerCheckInterval!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCore);
    } else {
        initCore();
    }

})();
