// ========== CONFIG-TELEGRAM.JS ==========
// Módulo completo de integração com Telegram
(function() {
    'use strict';

    // === MÓDULO TELEGRAM REAL ===
    const TelegramBotReal = {
        baseUrl: 'https://api.telegram.org/bot',
        timeout: 10000,

        getConfig() {
            try {
                const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
                return saved.telegram || window.TWS_ConfigModal.Core.defaultConfig.telegram;
            } catch (e) {
                return window.TWS_ConfigModal.Core.defaultConfig.telegram;
            }
        },

        updateFromModal() {
            try {
                const config = {
                    enabled: document.getElementById('telegram-enabled')?.checked || false,
                    botToken: document.getElementById('telegram-token')?.value.trim() || '',
                    chatId: document.getElementById('telegram-chatid')?.value.trim() || '',
                    notifications: {
                        success: document.getElementById('telegram-notif-success')?.checked !== false,
                        failure: document.getElementById('telegram-notif-failure')?.checked !== false,
                        farmCycle: document.getElementById('telegram-notif-farm')?.checked || false,
                        error: document.getElementById('telegram-notif-error')?.checked !== false
                    }
                };

                const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
                saved.telegram = config;
                localStorage.setItem('tws_global_config_v2', JSON.stringify(saved));
                return true;
            } catch (e) {
                console.error('[Telegram] Erro ao atualizar:', e);
                return false;
            }
        },

        populateModal() {
            try {
                const config = this.getConfig();
                
                const setValue = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.type === 'checkbox') {
                            el.checked = value;
                        } else {
                            el.value = value;
                        }
                    }
                };

                setValue('telegram-enabled', config.enabled);
                setValue('telegram-token', config.botToken);
                setValue('telegram-chatid', config.chatId);
                setValue('telegram-notif-success', config.notifications?.success);
                setValue('telegram-notif-failure', config.notifications?.failure);
                setValue('telegram-notif-farm', config.notifications?.farmCycle);
                setValue('telegram-notif-error', config.notifications?.error);

                this.updateUIState();
            } catch (e) {
                console.error('[Telegram] Erro ao preencher modal:', e);
            }
        },

        updateUIState() {
            const config = this.getConfig();
            const inputs = ['telegram-token', 'telegram-chatid'];
            const checkboxes = ['telegram-notif-success', 'telegram-notif-failure', 'telegram-notif-farm', 'telegram-notif-error'];
            
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.disabled = !config.enabled;
            });
            
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.disabled = !config.enabled;
            });
        },

        validateConfig() {
            const config = this.getConfig();
            
            if (!config.enabled) {
                return { valid: false, error: '❌ Telegram desativado' };
            }
            
            if (!config.botToken || config.botToken.trim() === '') {
                return { valid: false, error: '❌ Token do bot não configurado' };
            }
            
            if (!config.chatId || config.chatId.trim() === '') {
                return { valid: false, error: '❌ Chat ID não configurado' };
            }
            
            if (!config.botToken.includes(':')) {
                return { valid: false, error: '❌ Formato de token inválido' };
            }
            
            return { valid: true };
        },

        async makeRequest(method, params = {}) {
            const config = this.getConfig();
            
            if (!config.enabled) {
                return { success: false, error: 'Telegram desativado' };
            }

            const url = `${this.baseUrl}${config.botToken}/${method}`;

            const payload = {
                ...params,
                chat_id: config.chatId
            };

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.ok) {
                    throw new Error(data.description || 'Erro desconhecido da API');
                }

                return { success: true, data: data.result };
            } catch (error) {
                console.error('[Telegram] Erro na requisição:', error);
                return { 
                    success: false, 
                    error: this.getErrorMessage(error)
                };
            }
        },

        getErrorMessage(error) {
            const message = error.message || 'Erro desconhecido';
            
            if (message.includes('400')) return '❌ Requisição inválida - verifique o Chat ID';
            if (message.includes('401')) return '❌ Token inválido ou expirado';
            if (message.includes('403')) return '❌ Bot bloqueado pelo usuário';
            if (message.includes('404')) return '❌ Chat não encontrado';
            if (message.includes('429')) return '❌ Muitas requisições - aguarde um pouco';
            if (message.includes('500')) return '❌ Erro interno do servidor do Telegram';
            if (message.includes('network') || message.includes('Failed to fetch')) return '❌ Erro de conexão - verifique sua internet';
            if (message.includes('abort')) return '❌ Tempo esgotado - servidor não respondeu';
            
            return `❌ ${message}`;
        },

        async testConnection() {
            const validation = this.validateConfig();
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const result = await this.makeRequest('getMe');
            
            if (result.success) {
                const botInfo = result.data;
                return {
                    success: true,
                    message: '✅ Conexão bem-sucedida!',
                    details: `🤖 Bot: @${botInfo.username}\n🆔 ID: ${botInfo.id}\n📝 Nome: ${botInfo.first_name}`
                };
            } else {
                return { success: false, error: result.error };
            }
        },

        async sendTestMessage() {
            const validation = this.validateConfig();
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const timestamp = new Date().toLocaleString('pt-BR');
            const message = `🧪 <b>Mensagem de Teste</b>\n\n⏰ <b>${timestamp}</b>\n\n🤖 <b>Bot:</b> TW Scheduler\n✅ <b>Status:</b> Sistema operacional\n📡 <b>Conexão:</b> Estável\n⏰ <b>Horário:</b> ${timestamp}`;

            const result = await this.makeRequest('sendMessage', {
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });

            if (result.success) {
                this.addToHistory(message, 'sent');
            } else {
                this.addToHistory(message, 'failed');
            }

            return result;
        },

        addToHistory(message, status) {
            try {
                const history = this.getHistory();
                history.unshift({
                    message: message.substring(0, 200),
                    status,
                    timestamp: new Date().toISOString(),
                    type: 'outgoing'
                });

                // Manter apenas os últimos 50 registros
                if (history.length > 50) {
                    history.splice(50);
                }

                localStorage.setItem('tws_telegram_history', JSON.stringify(history));
            } catch (e) {
                console.error('[Telegram] Erro ao salvar histórico:', e);
            }
        },

        getHistory() {
            try {
                return JSON.parse(localStorage.getItem('tws_telegram_history') || '[]');
            } catch (e) {
                return [];
            }
        },

        getStats() {
            const history = this.getHistory();
            const sent = history.filter(msg => msg.status === 'sent').length;
            const failed = history.filter(msg => msg.status === 'failed').length;
            
            return {
                total: history.length,
                sent,
                failed,
                successRate: history.length > 0 ? Math.round((sent / history.length) * 100) : 0
            };
        },

        clearHistory() {
            try {
                localStorage.removeItem('tws_telegram_history');
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // === EXPORTAÇÃO PARA NAMESPACE ===
    if (!window.TWS_ConfigModal) {
        window.TWS_ConfigModal = {};
    }
    
    window.TWS_ConfigModal.Telegram = TelegramBotReal;

    // === INICIALIZAÇÃO ===
    console.log('[Config Telegram] ✅ Módulo Telegram carregado!');

})();
