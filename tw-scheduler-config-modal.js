(function () {
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

  // === MÓDULO TELEGRAM REAL ===
  const TelegramBotReal = {
    baseUrl: 'https://api.telegram.org/bot',
    timeout: 10000,

    getConfig() {
      try {
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        return saved.telegram || defaultConfig.telegram;
      } catch (e) {
        return defaultConfig.telegram;
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

  function updateIntervalPrecision() {
    const select = document.getElementById('scheduler-check-interval');
    const customInput = document.getElementById('scheduler-check-interval-custom');
    const precisionEl = document.getElementById('interval-precision');
    
    if (!select || !precisionEl) return;
    
    let intervalValue;
    
    if (select.value === 'custom') {
      intervalValue = parseInt(customInput.value) || 1000;
    } else {
      intervalValue = parseInt(select.value) || 1000;
    }
    
    const precision = calculatePrecision(intervalValue);
    precisionEl.innerHTML = `🎯 Precisão atual: ±${precision}ms`;
    precisionEl.style.background = getPrecisionColor(intervalValue);
  }

  function setupIntervalControls() {
    const select = document.getElementById('scheduler-check-interval');
    const customInput = document.getElementById('scheduler-check-interval-custom');
    
    if (!select || !customInput) return;
    
    // Mostrar/ocultar campo personalizado
    select.addEventListener('change', function() {
      if (this.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
      updateIntervalPrecision();
    });
    
    // Atualizar precisão quando campo personalizado mudar
    customInput.addEventListener('input', updateIntervalPrecision);
    
    // Inicializar
    updateIntervalPrecision();
  }

  function migrateOldConfig() {
    try {
      const config = getConfig();
      
      // Migrar delayBetweenAttacks para schedulerCheckInterval se necessário
      if (config.behavior.delayBetweenAttacks && !config.behavior.schedulerCheckInterval) {
        console.log('[Config] Migrando delayBetweenAttacks para schedulerCheckInterval');
        config.behavior.schedulerCheckInterval = config.behavior.delayBetweenAttacks;
        delete config.behavior.delayBetweenAttacks;
        saveConfig(config);
      }
      
      return config;
    } catch (e) {
      console.error('[Config] Erro na migração:', e);
      return getConfig();
    }
  }

  // === MODAL DE CONFIGURAÇÕES ===
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
      z-index: 1000000;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid #4A5568;
      border-radius: 12px;
      padding: 0;
      width: 95%;
      max-width: 1000px;
      height: 85vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .tws-config-tabs {
          display: flex;
          background: #4A5568;
          padding: 0;
          flex-shrink: 0;
          border-bottom: 2px solid #667eea;
        }
        .tws-config-tab {
          padding: 15px 20px;
          color: white;
          cursor: pointer;
          border: none;
          background: none;
          font-weight: bold;
          transition: all 0.3s;
          border-bottom: 3px solid transparent;
        }
        .tws-config-tab:hover {
          background: #5a6578;
        }
        .tws-config-tab.active {
          background: #667eea;
          border-bottom-color: #48BB78;
        }
        .tws-config-content-wrapper {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .tws-config-tab-content {
          display: none;
          padding: 20px;
          background: #F7FAFC;
          overflow-y: auto;
          flex: 1;
          color: #2D3748;
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
          color: #2D3748;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .tws-config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 15px;
        }
        .tws-config-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 10px;
          background: #F7FAFC;
          border-radius: 6px;
          border: 1px solid #E2E8F0;
          transition: all 0.2s;
        }
        .tws-config-item:hover {
          border-color: #667eea;
          transform: translateY(-1px);
        }
        .tws-config-label {
          font-weight: bold;
          font-size: 13px;
          color: #4A5568;
          text-transform: capitalize;
        }
        .tws-config-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tws-config-input {
          flex: 1;
          padding: 8px;
          border: 1px solid #CBD5E0;
          border-radius: 4px;
          text-align: center;
          font-size: 14px;
          background: white;
          color: #2D3748;
          transition: border-color 0.3s;
        }
        .tws-config-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .tws-config-unit {
          font-size: 11px;
          color: #718096;
          white-space: nowrap;
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
        .tws-config-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .tws-config-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        .btn-primary { background: #667eea; }
        .btn-success { background: #48BB78; }
        .btn-warning { background: #ED8936; }
        .btn-danger { background: #F56565; }
        .btn-secondary { background: #718096; }
        
        .tws-form-group {
          margin-bottom: 15px;
        }
        .tws-form-label {
          display: block;
          font-weight: bold;
          margin-bottom: 8px;
          color: #2D3748;
          font-size: 14px;
        }
        .tws-form-input {
          width: 50%;
          padding: 10px;
          border: 1px solid #CBD5E0;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.3s;
          background: white;
          color: #2D3748;
        }
        .tws-form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .tws-checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #2D3748;
        }
        .tws-checkbox-group input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        .tws-checkbox-group label {
          font-size: 14px;
          color: #4A5568;
          cursor: pointer;
        }

        /* Status indicators */
        .tws-status {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          margin: 5px 0;
          white-space: pre-wrap;
          line-height: 1.4;
        }
        .tws-status-success {
          background: #C6F6D5;
          color: #22543D;
          border: 1px solid #48BB78;
        }
        .tws-status-error {
          background: #FED7D7;
          color: #742A2A;
          border: 1px solid #F56565;
        }
        .tws-status-warning {
          background: #FEEBC8;
          color: #744210;
          border: 1px solid #ED8936;
        }

        /* Dark theme */
        [data-tws-theme="dark"] .tws-config-tab-content {
          background: #2D3748;
          color: #E2E8F0 !important;
        }
        [data-tws-theme="dark"] .tws-config-section {
          background: #4A5568;
          color: #E2E8F0 !important;
          border-left-color: #667eea;
        }
        [data-tws-theme="dark"] .tws-config-item {
          background: #2D3748;
          border-color: #718096;
        }
        [data-tws-theme="dark"] .tws-config-input {
          background: #1A202C;
          border-color: #718096;
          color: #E2E8F0;
        }
        [data-tws-theme="dark"] .tws-config-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        [data-tws-theme="dark"] .tws-config-label {
          color: #E2E8F0 !important;
        }
        [data-tws-theme="dark"] .tws-config-unit {
          color: #CBD5E0;
        }
        [data-tws-theme="dark"] .tws-form-label {
          color: #E2E8F0 !important;
        }
        [data-tws-theme="dark"] .tws-form-input {
          background: #1A202C;
          border-color: #718096;
          color: #E2E8F0;
        }
        [data-tws-theme="dark"] .tws-form-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        [data-tws-theme="dark"] .tws-checkbox-group {
          color: #E2E8F0 !important;
        }
        [data-tws-theme="dark"] .tws-checkbox-group label {
          color: #E2E8F0 !important;
        }
      </style>

      <!-- Cabeçalho -->
      <div style="background: #4A5568; padding: 20px; text-align: center; border-bottom: 3px solid #667eea; flex-shrink: 0;">
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
      <div class="tws-config-content-wrapper">
        <!-- ABA: UNIDADES -->
        <div id="tab-unidades" class="tws-config-tab-content active">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🎯 Velocidades das Unidades</h3>
            <p style="color: #718096; font-size: 13px; margin-bottom: 15px;">
              Ajuste as velocidades conforme as configurações do seu mundo. Valores em minutos por campo.
            </p>
            
            <div class="tws-config-grid" id="unit-speed-config">
              ${Object.entries(config.velocidadesUnidades).map(([unit, speed]) => `
                <div class="tws-config-item">
                  <div class="tws-config-label">${getUnitDisplayName(unit)}</div>
                  <div class="tws-config-input-wrapper">
                    <input type="number" class="tws-config-input" data-unit="${unit}" 
                           value="${speed}" min="1" max="100" step="0.1" />
                    <span class="tws-config-unit">min/campo</span>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
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
            
            <div class="tws-form-group">
              <div class="tws-checkbox-group">
                <input type="checkbox" id="telegram-enabled" ${config.telegram.enabled ? 'checked' : ''}>
                <label for="telegram-enabled">Ativar notificações do Telegram</label>
              </div>
            </div>
            
            <div class="tws-form-group">
              <label class="tws-form-label" for="telegram-token">Bot Token:</label>
              <input type="password" class="tws-form-input" 
                     id="telegram-token" value="${config.telegram.botToken}" placeholder="123456789:ABCdefGHIjkl..." />
              <small style="color: #718096; font-size: 12px;">
                Obtenha com @BotFather no Telegram
              </small>
            </div>
            
            <div class="tws-form-group">
              <label class="tws-form-label" for="telegram-chatid">Chat ID:</label>
              <input type="text" class="tws-form-input" 
                     id="telegram-chatid" value="${config.telegram.chatId}" placeholder="-100123456789" />
              <small style="color: #718096; font-size: 12px;">
                Use @userinfobot para obter seu Chat ID
              </small>
            </div>
            
            <div class="tws-form-group">
              <label class="tws-form-label">Notificações:</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="tws-checkbox-group">
                  <input type="checkbox" id="telegram-notif-success" ${config.telegram.notifications.success ? 'checked' : ''}>
                  <label for="telegram-notif-success">✅ Ataques bem-sucedidos</label>
                </div>
                <div class="tws-checkbox-group">
                  <input type="checkbox" id="telegram-notif-failure" ${config.telegram.notifications.failure ? 'checked' : ''}>
                  <label for="telegram-notif-failure">❌ Ataques falhos</label>
                </div>
                <div class="tws-checkbox-group">
                  <input type="checkbox" id="telegram-notif-farm" ${config.telegram.notifications.farmCycle ? 'checked' : ''}>
                  <label for="telegram-notif-farm">🔄 Ciclos de Farm</label>
                </div>
                <div class="tws-checkbox-group">
                  <input type="checkbox" id="telegram-notif-error" ${config.telegram.notifications.error ? 'checked' : ''}>
                  <label for="telegram-notif-error">🚨 Erros do sistema</label>
                </div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 15px;">
              <button class="tws-config-btn btn-primary" onclick="testTelegram()">
                🧪 Testar Conexão
              </button>
              
              <button class="tws-config-btn btn-success" onclick="sendTestMessage()">
                📤 Enviar Teste
              </button>
            </div>

            <!-- Status do Telegram -->
            <div id="telegram-status" style="margin-top: 15px;"></div>

            <!-- Estatísticas -->
            <div id="telegram-stats" style="margin-top: 15px; font-size: 12px; color: #718096;"></div>
          </div>
        </div>

        <!-- ABA: APARÊNCIA -->
        <div id="tab-aparencia" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🎨 Aparência e Tema</h3>
            
            <div class="tws-form-group">
              <label class="tws-form-label" for="theme-select">Tema:</label>
              <select class="tws-form-input" id="theme-select">
                <option value="light" ${config.theme === 'light' ? 'selected' : ''}>🌞 Claro</option>
                <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>🌙 Escuro</option>
                <option value="auto" ${config.theme === 'auto' ? 'selected' : ''}>⚡ Automático (Sistema)</option>
              </select>
            </div>
            
            <div class="tws-form-group">
              <label class="tws-form-label">Notificações:</label>
              <div class="tws-checkbox-group">
                <input type="checkbox" id="show-notifications" ${config.behavior.showNotifications ? 'checked' : ''}>
                <label for="show-notifications">Mostrar notificações na tela</label>
              </div>
              <div class="tws-checkbox-group">
                <input type="checkbox" id="sound-on-complete" ${config.behavior.soundOnComplete ? 'checked' : ''}>
                <label for="sound-on-complete">Som quando ataques são concluídos</label>
              </div>
            </div>
          </div>
        </div>

        <!-- ABA: COMPORTAMENTO -->
        <div id="tab-comportamento" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">⚡ Comportamento do Sistema</h3>
            
            <div class="tws-form-group">
              <div class="tws-checkbox-group">
                <input type="checkbox" id="auto-start-scheduler" ${config.behavior.autoStartScheduler ? 'checked' : ''}>
                <label for="auto-start-scheduler">Iniciar scheduler automaticamente</label>
              </div>
              
              <div class="tws-checkbox-group">
                <input type="checkbox" id="retry-on-fail" ${config.behavior.retryOnFail ? 'checked' : ''}>
                <label for="retry-on-fail">Tentar novamente em caso de falha</label>
              </div>

              <div class="tws-checkbox-group">
                <input type="checkbox" id="confirm-deletion" ${config.behavior.confirmDeletion ? 'checked' : ''}>
                <label for="confirm-deletion">Confirmar antes de excluir</label>
              </div>

              <div class="tws-checkbox-group">
                <input type="checkbox" id="ask-before-send" ${config.behavior.askBeforeSend ? 'checked' : ''}>
                <label for="ask-before-send">Perguntar antes de enviar ataques</label>
              </div>
            </div>
            
            <div class="tws-form-group">
              <label class="tws-form-label" for="max-retries">Máximo de tentativas:</label>
              <input type="number" class="tws-form-input" 
                     id="max-retries" value="${config.behavior.maxRetries}" min="1" max="10" style="width: 120px;" />
            </div>
            
            <!-- ✅ NOVO: schedulerCheckInterval substituindo delayBetweenAttacks -->
            <div class="tws-form-group">
              <label class="tws-form-label" for="scheduler-check-interval">Intervalo do Scheduler (ms):</label>

              <select class="tws-form-input" id="scheduler-check-interval" style="width: 200px;">
                  <option value="50" ${config.behavior.schedulerCheckInterval === 50 || !config.behavior.schedulerCheckInterval ? 'selected' : ''}>⚡ 50ms - Padrão (Máxima Precisão)</option>
                  <option value="100" ${config.behavior.schedulerCheckInterval === 100 ? 'selected' : ''}>⚡ 100ms - Alta Precisão</option>
                  <option value="250" ${config.behavior.schedulerCheckInterval === 250 ? 'selected' : ''}>⭐ 250ms - Rápido</option>
                  <option value="500" ${config.behavior.schedulerCheckInterval === 500 ? 'selected' : ''}>⭐ 500ms - Balanceado</option>
                  <option value="1000" ${config.behavior.schedulerCheckInterval === 1000 ? 'selected' : ''}>⭐ 1000ms - Moderado</option>
                  <option value="2000" ${config.behavior.schedulerCheckInterval === 2000 ? 'selected' : ''}>🔋 2000ms - Econômico</option>
                  <option value="5000" ${config.behavior.schedulerCheckInterval === 5000 ? 'selected' : ''}>🔋 5000ms - Muito Econômico</option>
                  <option value="custom">🎛️ Personalizado</option>
          </select>


              
              
              <!-- Campo personalizado (inicialmente oculto) -->
              <input type="number" class="tws-form-input" id="scheduler-check-interval-custom" 
                     value="${config.behavior.schedulerCheckInterval}" min="50" max="30000" step="50" 
                     style="width: 150px; display: none; margin-top: 5px;" 
                     placeholder="Digite o valor em ms" />
              
              <small style="color: #718096; font-size: 12px; display: block; margin-top: 5px;">
                ⏰ Controla a precisão de detecção dos ataques agendados<br>
                🔄 Menor intervalo = maior precisão (±) mas mais consumo de CPU<br>
                💡 Recomendado: 1000ms (1 segundo) para melhor balanceamento
              </small>
              
              <!-- Indicador de precisão -->
              <div id="interval-precision" style="margin-top: 8px; font-size: 12px; padding: 5px; border-radius: 4px; background: #E6FFFA; color: #234E52;">
                🎯 Precisão atual: ±${calculatePrecision(config.behavior.schedulerCheckInterval || 1000)}ms
              </div>
            </div>
          </div>
        </div>

        <!-- ABA: BACKUP -->
        <div id="tab-backup" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">💾 Backup e Restauração</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
              <button class="tws-config-btn btn-success" onclick="exportConfig()">
                📤 Exportar Configurações
              </button>
              
              <button class="tws-config-btn btn-primary" onclick="importConfig()">
                📥 Importar Configurações
              </button>
              
              <button class="tws-config-btn btn-warning" onclick="backupData()">
                💾 Backup Completo
              </button>
              
              <button class="tws-config-btn btn-danger" onclick="resetConfig()">
                🗑️ Resetar Tudo
              </button>
            </div>
            
            <div style="background: #EDF2F7; padding: 15px; border-radius: 6px;">
              <h4 style="margin-top: 0;">📊 Estatísticas do Sistema</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>Agendamentos: <span id="stats-agendamentos">${window.TWS_Backend ? window.TWS_Backend.getList().length : 0}</span></div>
                <div>Farms: <span id="stats-farms">${window.TWS_FarmInteligente ? window.TWS_FarmInteligente._getFarmList().length : 0}</span></div>
                <div>Configurações: <span id="stats-config-size">${Math.round(JSON.stringify(config).length / 1024 * 100) / 100}</span> KB</div>
                <div>Telegram: <span id="stats-telegram">${config.telegram.enabled ? '✅ Ativo' : '❌ Inativo'}</span></div>
              </div>
            </div>

            <!-- Histórico do Telegram -->
            <div style="margin-top: 20px;">
              <h4 style="margin-bottom: 10px;">📨 Histórico do Telegram</h4>
              <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button class="tws-config-btn btn-secondary" onclick="viewTelegramHistory()" style="padding: 8px 12px; font-size: 12px;">
                  📋 Ver Histórico
                </button>
                <button class="tws-config-btn btn-warning" onclick="clearTelegramHistory()" style="padding: 8px 12px; font-size: 12px;">
                  🗑️ Limpar Histórico
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="background: #F7FAFC; padding: 15px; text-align: center; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; flex-shrink: 0;">
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

    // Inicializar configurações do Telegram
    setTimeout(() => {
      TelegramBotReal.populateModal();
      updateTelegramStats();
    }, 100);

    // Inicializar controles do intervalo
    setTimeout(() => {
      setupIntervalControls();
    }, 100);

    // === FUNÇÕES GLOBAIS TEMPORÁRIAS ===
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
        
        document.querySelectorAll('.tws-config-input').forEach(input => {
          const unit = input.dataset.unit;
          input.value = config.velocidadesUnidades[unit];
        });
        
        showStatus('✅ Velocidades resetadas para padrão!', 'success');
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

    window.testTelegram = async function() {
      const btn = event.target;
      const originalText = btn.innerHTML;
      
      try {
        btn.innerHTML = '⏳ Testando...';
        btn.disabled = true;
        showTelegramStatus('⏳ Testando conexão com Telegram...', 'warning');

        TelegramBotReal.updateFromModal();
        const result = await TelegramBotReal.testConnection();

        if (result.success) {
          showTelegramStatus(`✅ ${result.message}\n${result.details}`, 'success');
        } else {
          showTelegramStatus(result.error, 'error');
        }
      } catch (error) {
        showTelegramStatus(`❌ Erro inesperado: ${error.message}`, 'error');
      } finally {
        btn.innerHTML = '🧪 Testar Conexão';
        btn.disabled = false;
        updateTelegramStats();
      }
    };

    window.sendTestMessage = async function() {
      const btn = event.target;
      const originalText = btn.innerHTML;
      
      try {
        btn.innerHTML = '📤 Enviando...';
        btn.disabled = true;
        showTelegramStatus('📤 Enviando mensagem de teste...', 'warning');

        TelegramBotReal.updateFromModal();
        const result = await TelegramBotReal.sendTestMessage();

        if (result.success) {
          showTelegramStatus('✅ Mensagem de teste enviada com sucesso!', 'success');
        } else {
          showTelegramStatus(`❌ Erro: ${result.error}`, 'error');
        }
      } catch (error) {
        showTelegramStatus(`❌ Erro inesperado: ${error.message}`, 'error');
      } finally {
        btn.innerHTML = '📤 Enviar Teste';
        btn.disabled = false;
        updateTelegramStats();
      }
    };

    window.exportConfig = function() {
      const config = getConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tws_config_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('✅ Configurações exportadas com sucesso!', 'success');
    };

    window.importConfig = function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedConfig = JSON.parse(event.target.result);
            if (confirm('Importar estas configurações? Isso substituirá suas configurações atuais.')) {
              saveConfig(importedConfig);
              showStatus('✅ Configurações importadas com sucesso!', 'success');
              setTimeout(() => location.reload(), 1000);
            }
          } catch (error) {
            showStatus('❌ Erro ao importar arquivo: formato inválido', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    window.backupData = function() {
      const backup = {
        config: getConfig(),
        schedules: window.TWS_Backend ? window.TWS_Backend.getList() : [],
        farms: window.TWS_FarmInteligente ? window.TWS_FarmInteligente._getFarmList() : [],
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tws_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('✅ Backup completo realizado!', 'success');
    };

    window.resetConfig = function() {
      if (confirm('⚠️ TEM CERTEZA?\n\nIsso resetará TODAS as configurações para os valores padrão.')) {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        applyConfig(defaultConfig);
        showStatus('✅ Configurações resetadas! Recarregando...', 'success');
        setTimeout(() => {
          closeConfigModal();
          location.reload();
        }, 1500);
      }
    };

    window.saveConfig = function() {
      const config = getConfig();
      
      // Salvar velocidades das unidades
      document.querySelectorAll('.tws-config-input').forEach(input => {
        const unit = input.dataset.unit;
        const value = parseFloat(input.value) || defaultConfig.velocidadesUnidades[unit];
        config.velocidadesUnidades[unit] = Math.max(0.1, value);
      });
      
      // Salvar configurações do Telegram
      TelegramBotReal.updateFromModal();
      Object.assign(config.telegram, TelegramBotReal.getConfig());
      
      // Salvar outras configurações
      config.theme = document.getElementById('theme-select').value;
      config.behavior.showNotifications = document.getElementById('show-notifications').checked;
      config.behavior.soundOnComplete = document.getElementById('sound-on-complete').checked;
      config.behavior.autoStartScheduler = document.getElementById('auto-start-scheduler').checked;
      config.behavior.retryOnFail = document.getElementById('retry-on-fail').checked;
      config.behavior.confirmDeletion = document.getElementById('confirm-deletion').checked;
      config.behavior.askBeforeSend = document.getElementById('ask-before-send').checked;
      config.behavior.maxRetries = parseInt(document.getElementById('max-retries').value) || 3;
      
      // ✅ NOVO: Salvar schedulerCheckInterval
      const intervalSelect = document.getElementById('scheduler-check-interval');
      let schedulerInterval;
      
      if (intervalSelect.value === 'custom') {
        schedulerInterval = parseInt(document.getElementById('scheduler-check-interval-custom').value) || 1000;
      } else {
        schedulerInterval = parseInt(intervalSelect.value) || 1000;
      }
      
      // Validar limites
      config.behavior.schedulerCheckInterval = Math.max(50, Math.min(30000, schedulerInterval));
      
      if (saveConfig(config)) {
        showStatus('✅ Configurações salvas com sucesso!', 'success');
        updateTelegramStats();
        
        // Reiniciar scheduler se estiver ativo
        if (window.TWS_Backend && window.TWS_Backend.startScheduler) {
          setTimeout(() => {
            window.TWS_Backend.startScheduler();
            showStatus('🔄 Scheduler reiniciado com novo intervalo!', 'success');
          }, 500);
        }
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
      const functions = [
        'switchConfigTab', 'resetUnitSpeeds', 'testUnitSpeed', 'testTelegram', 'sendTestMessage',
        'exportConfig', 'importConfig', 'backupData', 'resetConfig', 'saveConfig', 
        'saveAndCloseConfig', 'closeConfigModal', 'viewTelegramHistory', 'clearTelegramHistory'
      ];
      
      functions.forEach(fn => {
        delete window[fn];
      });
    };

    window.viewTelegramHistory = function() {
      const history = TelegramBotReal.getHistory();
      const stats = TelegramBotReal.getStats();
      
      const historyText = history.slice(0, 10).map((msg, i) => 
        `${i + 1}. ${new Date(msg.timestamp).toLocaleString()} - ${msg.status === 'sent' ? '✅' : '❌'} ${msg.message}`
      ).join('\n');
      
      alert(`📊 Estatísticas do Telegram:\n\n` +
            `📨 Total: ${stats.total} mensagens\n` +
            `✅ Enviadas: ${stats.sent}\n` +
            `❌ Falhas: ${stats.failed}\n` +
            `📈 Taxa de sucesso: ${stats.successRate}%\n\n` +
            `📋 Últimas mensagens:\n${historyText || 'Nenhuma mensagem no histórico'}`);
    };

    window.clearTelegramHistory = function() {
      if (confirm('Limpar todo o histórico do Telegram?')) {
        if (TelegramBotReal.clearHistory()) {
          showStatus('✅ Histórico do Telegram limpo!', 'success');
          updateTelegramStats();
        }
      }
    };

    // === FUNÇÕES AUXILIARES ===
    function showStatus(message, type) {
      alert(message);
    }

    function showTelegramStatus(message, type) {
      const statusEl = document.getElementById('telegram-status');
      if (statusEl) {
        statusEl.innerHTML = `<div class="tws-status tws-status-${type}">${message}</div>`;
      }
    }

    function updateTelegramStats() {
      const stats = TelegramBotReal.getStats();
      const statsEl = document.getElementById('telegram-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div style="background: #EDF2F7; padding: 10px; border-radius: 6px; font-size: 12px;">
            <strong>📊 Estatísticas:</strong><br>
            📨 Total: ${stats.total} mensagens | 
            ✅ ${stats.sent} enviadas | 
            ❌ ${stats.failed} falhas | 
            📈 ${stats.successRate}% sucesso
          </div>
        `;
      }
    }

    // Fechar modal ao clicar fora
    overlay.onclick = function(e) {
      if (e.target === overlay) {
        window.closeConfigModal();
      }
    };

    // Event listeners para atualização em tempo real
    document.getElementById('telegram-enabled')?.addEventListener('change', () => {
      TelegramBotReal.updateUIState();
    });
  }

  // === INICIALIZAÇÃO ===
  function init() {
    if (!window.TWS_ConfigModal) {
      window.TWS_ConfigModal = {};
    }
    
    // Migrar configurações antigas
    migrateOldConfig();
    
    window.TWS_ConfigModal.show = showConfigModal;
    window.TWS_ConfigModal.getConfig = getConfig;
    window.TWS_ConfigModal.saveConfig = saveConfig;
    
    // Aplicar configurações ao carregar
    applyConfig(getConfig());
    
    console.log('[TW Config] ✅ Modal de configurações carregado com schedulerCheckInterval!');
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
