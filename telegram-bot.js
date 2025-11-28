(function () {
  'use strict';

  // === TELEGRAM BOT MODULE ===
  const TelegramBot = {
    // Configuração
    baseUrl: 'https://api.telegram.org/bot',
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 2000,

    /**
     * Obter configurações do Telegram
     */
    getConfig() {
      try {
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        return saved.telegram || {
          enabled: false,
          botToken: '',
          chatId: '',
          notifications: {
            success: true,
            failure: true,
            farmCycle: false,
            error: true
          }
        };
      } catch (e) {
        console.error('[Telegram] Erro ao carregar config:', e);
        return {
          enabled: false,
          botToken: '',
          chatId: '',
          notifications: {
            success: true,
            failure: true,
            farmCycle: false,
            error: true
          }
        };
      }
    },

    /**
     * Salvar configurações do Telegram
     */
    saveConfig(config) {
      try {
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        saved.telegram = config;
        localStorage.setItem('tws_global_config_v2', JSON.stringify(saved));
        return true;
      } catch (e) {
        console.error('[Telegram] Erro ao salvar config:', e);
        return false;
      }
    },

    /**
     * Atualizar configurações a partir do modal
     */
    updateFromModal() {
      try {
        const enabled = document.getElementById('telegram-enabled')?.checked || false;
        const botToken = document.getElementById('telegram-token')?.value.trim() || '';
        const chatId = document.getElementById('telegram-chatid')?.value.trim() || '';
        
        const config = {
          enabled,
          botToken,
          chatId,
          notifications: {
            success: document.getElementById('telegram-notif-success')?.checked !== false,
            failure: document.getElementById('telegram-notif-failure')?.checked !== false,
            farmCycle: document.getElementById('telegram-notif-farm')?.checked || false,
            error: document.getElementById('telegram-notif-error')?.checked !== false
          }
        };

        return this.saveConfig(config);
      } catch (e) {
        console.error('[Telegram] Erro ao atualizar do modal:', e);
        return false;
      }
    },

    /**
     * Preencher formulário do modal com configurações atuais
     */
    populateModal() {
      try {
        const config = this.getConfig();
        
        const enabledEl = document.getElementById('telegram-enabled');
        const tokenEl = document.getElementById('telegram-token');
        const chatIdEl = document.getElementById('telegram-chatid');
        const notifSuccessEl = document.getElementById('telegram-notif-success');
        const notifFailureEl = document.getElementById('telegram-notif-failure');
        const notifFarmEl = document.getElementById('telegram-notif-farm');
        const notifErrorEl = document.getElementById('telegram-notif-error');

        if (enabledEl) enabledEl.checked = config.enabled;
        if (tokenEl) tokenEl.value = config.botToken || '';
        if (chatIdEl) chatIdEl.value = config.chatId || '';
        if (notifSuccessEl) notifSuccessEl.checked = config.notifications?.success !== false;
        if (notifFailureEl) notifFailureEl.checked = config.notifications?.failure !== false;
        if (notifFarmEl) notifFarmEl.checked = config.notifications?.farmCycle || false;
        if (notifErrorEl) notifErrorEl.checked = config.notifications?.error !== false;

        this.updateUIState();
      } catch (e) {
        console.error('[Telegram] Erro ao preencher modal:', e);
      }
    },

    /**
     * Atualizar estado da UI baseado na configuração
     */
    updateUIState() {
      const config = this.getConfig();
      const inputs = document.querySelectorAll('#telegram-token, #telegram-chatid');
      const checkboxes = document.querySelectorAll('#telegram-notif-success, #telegram-notif-failure, #telegram-notif-farm, #telegram-notif-error');
      
      inputs.forEach(input => {
        input.disabled = !config.enabled;
      });
      
      checkboxes.forEach(checkbox => {
        checkbox.disabled = !config.enabled;
      });
    },

    /**
     * Validar token e chat ID
     */
    validate() {
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

    /**
     * Fazer requisição para API do Telegram
     */
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

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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
          console.error(`[Telegram] Tentativa ${attempt}/${this.maxRetries} falhou:`, error);
          
          if (attempt === this.maxRetries) {
            return { 
              success: false, 
              error: this.getErrorMessage(error)
            };
          }
          
          // Aguardar antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    },

    /**
     * Traduzir mensagens de erro
     */
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

    /**
     * Testar conexão com Telegram
     */
    async testConnection() {
      // Atualizar configurações do modal primeiro
      this.updateFromModal();
      
      const validation = this.validate();
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const result = await this.makeRequest('getMe');
      
      if (result.success) {
        const botInfo = result.data;
        return {
          success: true,
          message: `✅ Conexão bem-sucedida!`,
          details: `🤖 Bot: @${botInfo.username}\n🆔 ID: ${botInfo.id}\n📝 Nome: ${botInfo.first_name}`
        };
      } else {
        return { success: false, error: result.error };
      }
    },

    /**
     * Enviar mensagem de texto
     */
    async sendMessage(text, options = {}) {
      const validation = this.validate();
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const payload = {
        text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: true,
        ...options
      };

      return await this.makeRequest('sendMessage', payload);
    },

    /**
     * Enviar notificação formatada
     */
    async sendNotification(type, data) {
      const config = this.getConfig();

      // Verificar se esta notificação está habilitada
      const notificationType = this.getNotificationType(type);
      if (!config.notifications || !config.notifications[notificationType]) {
        return { success: false, error: 'Notificação desativada' };
      }

      const message = this.formatMessage(type, data);
      const result = await this.sendMessage(message);
      
      // Adicionar ao histórico
      if (result.success) {
        this.addToHistory(message, 'sent');
      } else {
        this.addToHistory(message, 'failed');
      }
      
      return result;
    },

    /**
     * Obter tipo de notificação
     */
    getNotificationType(type) {
      const mapping = {
        'attack_success': 'success',
        'attack_failure': 'failure',
        'farm_cycle': 'farmCycle',
        'system_error': 'error'
      };
      return mapping[type] || type;
    },

    /**
     * Formatar mensagem conforme tipo
     */
    formatMessage(type, data) {
      const timestamp = new Date().toLocaleString('pt-BR');
      const baseInfo = `\n⏰ <b>${timestamp}</b>`;

      switch (type) {
        case 'attack_success':
          return `✅ <b>Ataque Bem-Sucedido</b>${baseInfo}
          
🎯 <b>Origem:</b> ${data.origin || 'N/A'}
🎯 <b>Destino:</b> ${data.target || 'N/A'}
⚔️ <b>Unidades:</b> ${data.units || 'N/A'}
⏱️ <b>Tempo de viagem:</b> ${data.travelTime || 'N/A'}
📊 <b>Recursos:</b> ${data.resources || 'N/A'}`;

        case 'attack_failure':
          return `❌ <b>Ataque Falhado</b>${baseInfo}
          
🎯 <b>Origem:</b> ${data.origin || 'N/A'}
🎯 <b>Destino:</b> ${data.target || 'N/A'}
🚫 <b>Motivo:</b> ${data.reason || 'Desconhecido'}
💡 <b>Sugestão:</b> ${data.suggestion || 'Verifique as configurações'}`;

        case 'farm_cycle':
          return `🔄 <b>Ciclo de Farm Iniciado</b>${baseInfo}
          
🏹 <b>Farm:</b> ${data.farmName || 'N/A'}
🎯 <b>Ataques:</b> ${data.attackCount || '0'}
⏰ <b>Próxima execução:</b> ${data.nextExecution || 'N/A'}
📈 <b>Status:</b> ${data.status || 'Em andamento'}`;

        case 'system_error':
          return `🚨 <b>Erro do Sistema</b>${baseInfo}
          
🔧 <b>Módulo:</b> ${data.module || 'Desconhecido'}
❌ <b>Erro:</b> ${data.error || 'N/A'}
📝 <b>Detalhes:</b> ${data.details || 'N/A'}
⚡ <b>Ação:</b> ${data.action || 'Verifique o console'}`;

        case 'test':
          return `🧪 <b>Mensagem de Teste</b>${baseInfo}
          
🤖 <b>Bot:</b> ${data.botName || 'TW Scheduler'}
✅ <b>Status:</b> Sistema operacional
📡 <b>Conexão:</b> Estável
⏰ <b>Horário:</b> ${timestamp}`;

        default:
          return `📢 <b>${type}</b>${baseInfo}\n${data.message || ''}`;
      }
    },

    /**
     * Enviar mensagem de teste
     */
    async sendTestMessage() {
      // Atualizar configurações do modal primeiro
      this.updateFromModal();
      
      return await this.sendNotification('test', {
        botName: 'TW Scheduler Bot',
        timestamp: new Date().toLocaleString('pt-BR')
      });
    },

    /**
     * Configurar listeners de eventos do sistema
     */
    setupEventListeners() {
      // Listener para mudanças no checkbox de ativação
      const enabledCheckbox = document.getElementById('telegram-enabled');
      if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', () => {
          this.updateUIState();
        });
      }

      // Integração com outros módulos se existirem
      if (window.TWS_Backend) {
        window.TWS_Backend.onAttackSuccess = (data) => {
          this.sendNotification('attack_success', data).catch(e => {
            console.error('[Telegram] Erro ao enviar notificação de sucesso:', e);
          });
        };

        window.TWS_Backend.onAttackFailure = (data) => {
          this.sendNotification('attack_failure', data).catch(e => {
            console.error('[Telegram] Erro ao enviar notificação de falha:', e);
          });
        };

        window.TWS_Backend.onSystemError = (data) => {
          this.sendNotification('system_error', data).catch(e => {
            console.error('[Telegram] Erro ao enviar notificação de erro:', e);
          });
        };
      }

      if (window.TWS_FarmInteligente) {
        window.TWS_FarmInteligente.onFarmCycleStart = (data) => {
          this.sendNotification('farm_cycle', data).catch(e => {
            console.error('[Telegram] Erro ao enviar notificação de farm:', e);
          });
        };
      }

      console.log('[Telegram] Event listeners configurados');
    },

    /**
     * Obter histórico de mensagens
     */
    getHistory() {
      try {
        return JSON.parse(localStorage.getItem('tws_telegram_history') || '[]');
      } catch (e) {
        return [];
      }
    },

    /**
     * Adicionar ao histórico
     */
    addToHistory(message, status, timestamp) {
      try {
        const history = this.getHistory();
        history.unshift({
          message: message.substring(0, 200),
          status,
          timestamp: timestamp || new Date().toISOString(),
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

    /**
     * Limpar histórico
     */
    clearHistory() {
      try {
        localStorage.removeItem('tws_telegram_history');
        return true;
      } catch (e) {
        console.error('[Telegram] Erro ao limpar histórico:', e);
        return false;
      }
    },

    /**
     * Obter estatísticas de uso
     */
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
    }
  };

  // === INTEGRAÇÃO COM O MODAL ===
  function integrateWithConfigModal() {
    // Substituir a função de teste do Telegram no modal
    window.testTelegram = async function() {
      const btn = event?.target || document.querySelector('#tab-telegram .btn-primary');
      const originalText = btn?.innerHTML;
      
      try {
        if (btn) {
          btn.innerHTML = '⏳ Testando...';
          btn.disabled = true;
        }

        const result = await TelegramBot.testConnection();

        if (result.success) {
          alert(`${result.message}\n\n${result.details}`);
        } else {
          alert(result.error);
        }
      } catch (error) {
        alert(`❌ Erro inesperado: ${error.message}`);
      } finally {
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      }
    };

    // Adicionar função para enviar mensagem de teste
    window.sendTestMessage = async function() {
      const btn = event?.target || document.querySelector('#tab-telegram .btn-success');
      const originalText = btn?.innerHTML;
      
      try {
        if (btn) {
          btn.innerHTML = '📤 Enviando...';
          btn.disabled = true;
        }

        const result = await TelegramBot.sendTestMessage();

        if (result.success) {
          alert('✅ Mensagem de teste enviada com sucesso!');
        } else {
          alert(`❌ Erro: ${result.error}`);
        }
      } catch (error) {
        alert(`❌ Erro inesperado: ${error.message}`);
      } finally {
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      }
    };

    // Adicionar validação em tempo real
    function setupRealTimeValidation() {
      const inputs = ['telegram-enabled', 'telegram-token', 'telegram-chatid'];
      
      inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener('input', TelegramBot.updateUIState.bind(TelegramBot));
          element.addEventListener('change', TelegramBot.updateUIState.bind(TelegramBot));
        }
      });
    }

    // Configurar validação quando o modal abrir
    const originalShowModal = window.TWS_ConfigModal?.show;
    if (originalShowModal) {
      window.TWS_ConfigModal.show = function() {
        originalShowModal.call(this);
        
        // Aguardar o modal ser renderizado
        setTimeout(() => {
          TelegramBot.populateModal();
          TelegramBot.setupEventListeners();
          setupRealTimeValidation();
        }, 100);
      };
    }
  }

  // === INICIALIZAÇÃO ===
  function init() {
    // Expor o módulo globalmente
    window.TelegramBot = TelegramBot;
    
    // Integrar com o modal de configurações
    integrateWithConfigModal();
    
    // Aplicar estado inicial da UI se os elementos existirem
    setTimeout(() => {
      if (document.getElementById('telegram-enabled')) {
        TelegramBot.populateModal();
        TelegramBot.setupEventListeners();
      }
    }, 500);

    console.log('[Telegram Bot] ✅ Módulo de Telegram carregado e integrado!');
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
