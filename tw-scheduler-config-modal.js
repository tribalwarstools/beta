(function () {
  'use strict';

  // === TELEGRAM BOT MODULE ===
  const TelegramBot = {
    baseUrl: 'https://api.telegram.org/bot',
    timeout: 10000,
    maxRetries: 3,
    retryDelay: 2000,

    /**
     * Obter configurações do Telegram
     */
    getConfig() {
      try {
        if (window.TWS_ConfigModal && window.TWS_ConfigModal.getConfig) {
          const config = window.TWS_ConfigModal.getConfig();
          return config.telegram || {};
        }
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        return saved.telegram || {};
      } catch (e) {
        console.error('[Telegram] Erro ao carregar config:', e);
        return {};
      }
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
     * Fazer requisição para API do Telegram com retry
     */
    async makeRequest(method, params = {}, retryCount = 0) {
      const config = this.getConfig();
      const url = `${this.baseUrl}${config.botToken}/${method}`;

      const payload = {
        ...params,
        chat_id: config.chatId
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout)
        });

        const data = await response.json();

        if (!data.ok) {
          throw new Error(`API Error: ${data.description || 'Erro desconhecido'}`);
        }

        return { success: true, data: data.result };
      } catch (error) {
        console.error(`[Telegram] Erro na requisição (tentativa ${retryCount + 1}):`, error);
        
        // Retry automático
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.makeRequest(method, params, retryCount + 1);
        }
        
        return { 
          success: false, 
          error: error.message || 'Erro na conexão'
        };
      }
    },

    /**
     * Testar conexão com Telegram
     */
    async testConnection() {
      const validation = this.validate();
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      try {
        const result = await this.makeRequest('getMe');
        
        if (result.success) {
          const botInfo = result.data;
          return {
            success: true,
            message: `✅ Conexão bem-sucedida!`,
            details: `Bot: @${botInfo.username}\nID: ${botInfo.id}`
          };
        } else {
          return { success: false, error: `❌ ${result.error}` };
        }
      } catch (error) {
        return { success: false, error: `❌ ${error.message}` };
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

      try {
        const payload = {
          text,
          parse_mode: options.parseMode || 'HTML',
          disable_web_page_preview: true,
          ...options
        };

        const result = await this.makeRequest('sendMessage', payload);
        
        if (result.success) {
          this.addToHistory(text, 'enviado');
        }
        
        return result;
      } catch (error) {
        this.addToHistory(text, 'erro');
        return { success: false, error: error.message };
      }
    },

    /**
     * Enviar notificação formatada
     */
    async sendNotification(type, data) {
      const config = this.getConfig();

      // Verificar se esta notificação está habilitada
      const notificationType = this.getNotificationType(type);
      if (!config.notifications || !config.notifications[notificationType]) {
        console.log(`[Telegram] Notificação de tipo "${notificationType}" desativada`);
        return { success: false, error: 'Notificação desativada' };
      }

      const message = this.formatMessage(type, data);
      return await this.sendMessage(message);
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
          
<b>Origem:</b> ${data.origin || 'N/A'}
<b>Destino:</b> ${data.target || 'N/A'}
<b>Unidades:</b> ${data.units || 'N/A'}
<b>Tempo de viagem:</b> ${data.travelTime || 'N/A'}`;

        case 'attack_failure':
          return `❌ <b>Ataque Falhado</b>${baseInfo}
          
<b>Origem:</b> ${data.origin || 'N/A'}
<b>Destino:</b> ${data.target || 'N/A'}
<b>Motivo:</b> ${data.reason || 'Desconhecido'}`;

        case 'farm_cycle':
          return `🔄 <b>Ciclo de Farm Iniciado</b>${baseInfo}
          
<b>Farm:</b> ${data.farmName || 'N/A'}
<b>Ataques:</b> ${data.attackCount || '0'}
<b>Próxima execução:</b> ${data.nextExecution || 'N/A'}`;

        case 'system_error':
          return `🚨 <b>Erro do Sistema</b>${baseInfo}
          
<b>Módulo:</b> ${data.module || 'Desconhecido'}
<b>Erro:</b> ${data.error || 'N/A'}
<b>Detalhes:</b> ${data.details || 'N/A'}`;

        case 'test':
          return `🧪 <b>Mensagem de Teste</b>${baseInfo}
          
<b>Bot:</b> ${data.botName || 'TW Scheduler'}
<b>Status:</b> Operacional ✅
<b>Chat ID:</b> ${this.getConfig().chatId}`;

        default:
          return `📢 <b>${type}</b>${baseInfo}\n${data.message || ''}`;
      }
    },

    /**
     * Enviar múltiplas notificações em lote
     */
    async sendBatch(messages) {
      const results = [];
      
      for (const msg of messages) {
        const result = await this.sendMessage(msg);
        results.push(result);
        
        // Aguardar para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return results;
    },

    /**
     * Adicionar ao histórico
     */
    addToHistory(message, status, timestamp) {
      try {
        const history = JSON.parse(localStorage.getItem('tws_telegram_history') || '[]');
        history.push({
          message: message.substring(0, 100),
          status,
          timestamp: timestamp || new Date().toISOString()
        });

        // Manter apenas os últimos 100 registros
        if (history.length > 100) {
          history.shift();
        }

        localStorage.setItem('tws_telegram_history', JSON.stringify(history));
      } catch (e) {
        console.error('[Telegram] Erro ao salvar histórico:', e);
      }
    },

    /**
     * Obter histórico de mensagens
     */
    getHistory() {
      try {
        const history = JSON.parse(localStorage.getItem('tws_telegram_history') || '[]');
        return history;
      } catch (e) {
        return [];
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
    }
  };

  // === INTEGRAÇÃO COM O MODAL DE CONFIGURAÇÕES ===
  function integrateWithConfigModal() {
    // Substituir a função de teste do Telegram no modal
    if (!window.testTelegram) {
      window.testTelegram = async function() {
        const btn = event?.target;
        const originalText = btn?.innerHTML || '🧪 Testar Conexão Telegram';
        
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
          alert(`❌ Erro: ${error.message}`);
        } finally {
          if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
          }
        }
      };
    }

    // Função para enviar mensagem de teste
    window.sendTestMessage = async function() {
      try {
        const result = await TelegramBot.sendNotification('test', {
          botName: 'TW Scheduler Bot'
        });

        if (result.success) {
          alert('✅ Mensagem de teste enviada com sucesso!\n\nVerifique seu Telegram.');
        } else {
          alert(`❌ Erro: ${result.error}`);
        }
      } catch (error) {
        alert(`❌ Erro: ${error.message}`);
      }
    };
  }

  // === INICIALIZAÇÃO ===
  function init() {
    window.TelegramBot = TelegramBot;
    integrateWithConfigModal();
    console.log('[Telegram Bot] ✅ Módulo de Telegram carregado!');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
