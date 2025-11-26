(function () {
  'use strict';

  // === CONFIGURAÇÕES GLOBAIS ===
  const CONFIG_STORAGE_KEY = 'tws_global_config_v2';
  
  // Configurações padrão
  const defaultConfig = {
    // Velocidades das tropas (podem ser ajustadas por mundo)
    velocidadesUnidades: {
      spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
      light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
      knight: 10, snob: 35
    },
    
    // Configurações do Telegram
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
    
    // Aparência
    theme: 'light', // 'light' | 'dark' | 'auto'
    
    // Comportamento do sistema
    behavior: {
      autoStartScheduler: true,
      showNotifications: true,
      soundOnComplete: false,
      retryOnFail: true,
      maxRetries: 3,
      delayBetweenAttacks: 1000,
      cleanupInterval: 3600000 // 1 hora
    },
    
    // Segurança
    security: {
      confirmDeletion: true,
      confirmMassActions: true,
      askBeforeSend: false,
      backupInterval: 86400000 // 24 horas
    },
    
    // Performance
    performance: {
      cacheTroops: true,
      cacheTTL: 30000, // 30 segundos
      parallelExecutions: 1,
      monitorInterval: 1000
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

  function resetConfig() {
    if (confirm('⚠️ TEM CERTEZA?\n\nIsso resetará TODAS as configurações para os valores padrão.')) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      applyConfig(defaultConfig);
      return true;
    }
    return false;
  }

  function exportConfig() {
    const config = getConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tws_config_${Date.now()}.json`;
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
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (confirm(`✅ Configurações carregadas!\n\nDeseja aplicar agora?`)) {
            saveConfig(imported);
            alert('✅ Configurações importadas com sucesso!');
            if (window.TWS_ConfigModal && window.TWS_ConfigModal.refresh) {
              window.TWS_ConfigModal.refresh();
            }
          }
        } catch (err) {
          alert('❌ Erro ao importar: Arquivo inválido!');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // === APLICAÇÃO DAS CONFIGURAÇÕES ===
  function applyConfig(config) {
    // Aplicar tema
    applyTheme(config.theme);
    
    // Aplicar velocidades das tropas globalmente
    if (window.TWS_Backend && config.velocidadesUnidades) {
      window.TWS_Backend._internal.velocidadesUnidades = config.velocidadesUnidades;
    }
    
    // Aplicar configurações de comportamento
    if (config.behavior.autoStartScheduler && window.TWS_Backend && window.TWS_Backend.startScheduler) {
      window.TWS_Backend.startScheduler();
    }
    
    // Disparar evento de configurações alteradas
    window.dispatchEvent(new CustomEvent('tws-config-changed', { detail: config }));
    
    console.log('[Config] Configurações aplicadas:', config);
  }

  // === SISTEMA DE TEMAS ===
  function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    document.documentElement.setAttribute('data-tws-theme', isDark ? 'dark' : 'light');
    
    // Aplicar estilos específicos para componentes existentes
    const existingPanels = document.querySelectorAll('#tws-panel, #tws-farm-modal, #tws-config-modal');
    existingPanels.forEach(panel => {
      if (panel) {
        panel.style.backgroundColor = isDark ? '#2d3748' : '#F4E4C1';
        panel.style.color = isDark ? '#e2e8f0' : '#000000';
      }
    });
  }

  // === NOTIFICAÇÕES TELEGRAM ===
  async function sendTelegramNotification(message, type = 'info') {
    const config = getConfig();
    
    if (!config.telegram.enabled || !config.telegram.botToken || !config.telegram.chatId) {
      return false;
    }
    
    // Verificar se esta notificação está habilitada
    if (!config.telegram.notifications[type]) {
      return false;
    }
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text: `🤖 TW Scheduler\n${message}`,
          parse_mode: 'HTML'
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('[Telegram] Erro ao enviar notificação:', error);
      return false;
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
      z-index: 999999;
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
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease;
      display: flex;
      flex-direction: column;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: scale(0.9) translateY(-20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        
        .config-section {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 8px;
          padding: 20px;
          margin: 10px 0;
          border-left: 4px solid #667eea;
        }
        
        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 10px;
        }
        
        .config-item {
          margin-bottom: 15px;
        }
        
        .config-label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
          color: #2D3748;
          font-size: 14px;
        }
        
        .config-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #CBD5E0;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
        }
        
        .config-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .config-checkbox {
          margin-right: 8px;
        }
        
        .config-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
          margin: 5px;
          transition: all 0.3s;
        }
        
        .config-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .btn-primary { background: #667eea; }
        .btn-success { background: #48BB78; }
        .btn-warning { background: #ED8936; }
        .btn-danger { background: #F56565; }
        .btn-secondary { background: #718096; }
        
        .unit-speed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        
        .unit-speed-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .unit-speed-label {
          min-width: 80px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .unit-speed-input {
          width: 80px;
          padding: 4px 8px;
          border: 1px solid #CBD5E0;
          border-radius: 4px;
          text-align: center;
        }
        
        .tab-container {
          display: flex;
          background: #4A5568;
          padding: 0;
        }
        
        .tab {
          padding: 15px 20px;
          color: white;
          cursor: pointer;
          border: none;
          background: none;
          font-weight: bold;
          transition: all 0.3s;
        }
        
        .tab.active {
          background: #667eea;
        }
        
        .tab-content {
          display: none;
          padding: 20px;
          background: #F7FAFC;
          overflow-y: auto;
          max-height: 60vh;
        }
        
        .tab-content.active {
          display: block;
        }
        
        .test-telegram-btn {
          margin-top: 10px;
          padding: 8px 16px;
          background: #4299E1;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        /* Dark theme support */
        [data-tws-theme="dark"] .config-section {
          background: #2D3748;
          color: #E2E8F0;
        }
        
        [data-tws-theme="dark"] .config-label {
          color: #E2E8F0;
        }
        
        [data-tws-theme="dark"] .config-input {
          background: #4A5568;
          border-color: #718096;
          color: #E2E8F0;
        }
        
        [data-tws-theme="dark"] .tab-content {
          background: #2D3748;
          color: #E2E8F0;
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
      <div class="tab-container">
        <button class="tab active" onclick="TWS_ConfigModal.switchTab('unidades')">🎯 Unidades</button>
        <button class="tab" onclick="TWS_ConfigModal.switchTab('telegram')">🤖 Telegram</button>
        <button class="tab" onclick="TWS_ConfigModal.switchTab('aparencia')">🎨 Aparência</button>
        <button class="tab" onclick="TWS_ConfigModal.switchTab('comportamento')">⚡ Comportamento</button>
        <button class="tab" onclick="TWS_ConfigModal.switchTab('seguranca')">🔒 Segurança</button>
        <button class="tab" onclick="TWS_ConfigModal.switchTab('backup')">💾 Backup</button>
      </div>

      <!-- Conteúdo das Abas -->
      <div style="flex: 1; overflow-y: auto;">
        <!-- ABA: VELOCIDADES DAS UNIDADES -->
        <div id="tab-unidades" class="tab-content active">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🎯 Velocidades das Unidades</h3>
            <p style="color: #718096; font-size: 13px; margin-bottom: 15px;">
              Ajuste as velocidades conforme as configurações do seu mundo. Valores em minutos por campo.
            </p>
            
            <div class="unit-speed-grid" id="unit-speed-config">
              <!-- Preenchido dinamicamente via JavaScript -->
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
              <button class="config-btn btn-secondary" onclick="TWS_ConfigModal.resetUnitSpeeds()">
                🔄 Resetar Velocidades
              </button>
              <button class="config-btn btn-success" onclick="TWS_ConfigModal.testUnitSpeed()">
                🧪 Testar Cálculo
              </button>
            </div>
          </div>
        </div>

        <!-- ABA: TELEGRAM -->
        <div id="tab-telegram" class="tab-content">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🤖 Configurações do Telegram</h3>
            
            <div class="config-item">
              <label class="config-label">
                <input type="checkbox" class="config-checkbox" id="telegram-enabled" ${config.telegram.enabled ? 'checked' : ''}>
                Ativar notificações do Telegram
              </label>
            </div>
            
            <div class="config-grid">
              <div class="config-item">
                <label class="config-label">Bot Token:</label>
                <input type="password" class="config-input" id="telegram-token" 
                       value="${config.telegram.botToken}" placeholder="123456789:ABCdefGHIjkl..." />
              </div>
              
              <div class="config-item">
                <label class="config-label">Chat ID:</label>
                <input type="text" class="config-input" id="telegram-chatid" 
                       value="${config.telegram.chatId}" placeholder="-100123456789" />
              </div>
            </div>
            
            <div class="config-item">
              <label class="config-label">Notificações:</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
                <label>
                  <input type="checkbox" class="config-checkbox" id="telegram-notif-success" ${config.telegram.notifications.success ? 'checked' : ''}>
                  ✅ Ataques bem-sucedidos
                </label>
                <label>
                  <input type="checkbox" class="config-checkbox" id="telegram-notif-failure" ${config.telegram.notifications.failure ? 'checked' : ''}>
                  ❌ Ataques falhos
                </label>
                <label>
                  <input type="checkbox" class="config-checkbox" id="telegram-notif-farm" ${config.telegram.notifications.farmCycle ? 'checked' : ''}>
                  🔄 Ciclos de Farm
                </label>
                <label>
                  <input type="checkbox" class="config-checkbox" id="telegram-notif-error" ${config.telegram.notifications.error ? 'checked' : ''}>
                  🚨 Erros do sistema
                </label>
              </div>
            </div>
            
            <button class="test-telegram-btn" onclick="TWS_ConfigModal.testTelegram()">
              🧪 Testar Conexão Telegram
            </button>
          </div>
        </div>

        <!-- ABA: APARÊNCIA -->
        <div id="tab-aparencia" class="tab-content">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🎨 Aparência e Tema</h3>
            
            <div class="config-item">
              <label class="config-label">Tema:</label>
              <select class="config-input" id="theme-select">
                <option value="light" ${config.theme === 'light' ? 'selected' : ''}>🌞 Claro</option>
                <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>🌙 Escuro</option>
                <option value="auto" ${config.theme === 'auto' ? 'selected' : ''}>⚡ Automático (Sistema)</option>
              </select>
            </div>
            
            <div class="config-item">
              <label class="config-label">
                <input type="checkbox" class="config-checkbox" id="show-notifications" ${config.behavior.showNotifications ? 'checked' : ''}>
                Mostrar notificações na tela
              </label>
            </div>
            
            <div class="config-item">
              <label class="config-label">
                <input type="checkbox" class="config-checkbox" id="sound-on-complete" ${config.behavior.soundOnComplete ? 'checked' : ''}>
                Som quando ataques são concluídos
              </label>
            </div>
          </div>
        </div>

        <!-- ABA: COMPORTAMENTO -->
        <div id="tab-comportamento" class="tab-content">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">⚡ Comportamento do Sistema</h3>
            
            <div class="config-grid">
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="auto-start-scheduler" ${config.behavior.autoStartScheduler ? 'checked' : ''}>
                  Iniciar scheduler automaticamente
                </label>
              </div>
              
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="retry-on-fail" ${config.behavior.retryOnFail ? 'checked' : ''}>
                  Tentar novamente em caso de falha
                </label>
              </div>
              
              <div class="config-item">
                <label class="config-label">Máximo de tentativas:</label>
                <input type="number" class="config-input" id="max-retries" 
                       value="${config.behavior.maxRetries}" min="1" max="10" />
              </div>
              
              <div class="config-item">
                <label class="config-label">Delay entre ataques (ms):</label>
                <input type="number" class="config-input" id="delay-between-attacks" 
                       value="${config.behavior.delayBetweenAttacks}" min="0" max="10000" />
              </div>
              
              <div class="config-item">
                <label class="config-label">Execuções paralelas:</label>
                <input type="number" class="config-input" id="parallel-executions" 
                       value="${config.performance.parallelExecutions}" min="1" max="5" />
              </div>
              
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="cache-troops" ${config.performance.cacheTroops ? 'checked' : ''}>
                  Cache de tropas (performance)
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- ABA: SEGURANÇA -->
        <div id="tab-seguranca" class="tab-content">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🔒 Segurança e Confirmações</h3>
            
            <div class="config-grid">
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="confirm-deletion" ${config.security.confirmDeletion ? 'checked' : ''}>
                  Confirmar antes de excluir
                </label>
              </div>
              
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="confirm-mass-actions" ${config.security.confirmMassActions ? 'checked' : ''}>
                  Confirmar ações em massa
                </label>
              </div>
              
              <div class="config-item">
                <label class="config-label">
                  <input type="checkbox" class="config-checkbox" id="ask-before-send" ${config.security.askBeforeSend ? 'checked' : ''}>
                  Perguntar antes de enviar ataques
                </label>
              </div>
              
              <div class="config-item">
                <label class="config-label">Intervalo de backup (horas):</label>
                <input type="number" class="config-input" id="backup-interval" 
                       value="${config.security.backupInterval / 3600000}" min="1" max="168" />
              </div>
            </div>
          </div>
        </div>

        <!-- ABA: BACKUP -->
        <div id="tab-backup" class="tab-content">
          <div class="config-section">
            <h3 style="margin-top: 0; color: #2D3748;">💾 Backup e Restauração</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
              <button class="config-btn btn-success" onclick="TWS_ConfigModal.exportConfig()">
                📤 Exportar Configurações
              </button>
              
              <button class="config-btn btn-primary" onclick="TWS_ConfigModal.importConfig()">
                📥 Importar Configurações
              </button>
              
              <button class="config-btn btn-warning" onclick="TWS_ConfigModal.backupData()">
                💾 Backup Completo
              </button>
              
              <button class="config-btn btn-danger" onclick="TWS_ConfigModal.resetConfig()">
                🗑️ Resetar Tudo
              </button>
            </div>
            
            <div style="background: #EDF2F7; padding: 15px; border-radius: 6px;">
              <h4 style="margin-top: 0;">📊 Estatísticas do Sistema</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>Agendamentos: <span id="stats-agendamentos">0</span></div>
                <div>Farms: <span id="stats-farms">0</span></div>
                <div>Configurações: <span id="stats-config-size">0</span> KB</div>
                <div>Último backup: <span id="stats-last-backup">Nunca</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé com ações -->
      <div style="background: #F7FAFC; padding: 15px; text-align: center; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
        <button class="config-btn btn-secondary" onclick="TWS_ConfigModal.close()">
          ❌ Cancelar
        </button>
        
        <div>
          <button class="config-btn btn-warning" onclick="TWS_ConfigModal.save()">
            💾 Salvar
          </button>
          
          <button class="config-btn btn-success" onclick="TWS_ConfigModal.saveAndClose()">
            ✅ Salvar e Fechar
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Inicializar componentes
    initializeUnitSpeedGrid();
    updateStats();

    // Configurar funções
    const configFunctions = {
      switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`.tab[onclick="TWS_ConfigModal.switchTab('${tabName}')"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
      },

      save() {
        const config = getConfig();
        
        // Velocidades das unidades
        document.querySelectorAll('.unit-speed-input').forEach(input => {
          const unit = input.dataset.unit;
          const value = parseInt(input.value) || defaultConfig.velocidadesUnidades[unit];
          config.velocidadesUnidades[unit] = Math.max(1, value);
        });
        
        // Telegram
        config.telegram.enabled = document.getElementById('telegram-enabled').checked;
        config.telegram.botToken = document.getElementById('telegram-token').value;
        config.telegram.chatId = document.getElementById('telegram-chatid').value;
        config.telegram.notifications.success = document.getElementById('telegram-notif-success').checked;
        config.telegram.notifications.failure = document.getElementById('telegram-notif-failure').checked;
        config.telegram.notifications.farmCycle = document.getElementById('telegram-notif-farm').checked;
        config.telegram.notifications.error = document.getElementById('telegram-notif-error').checked;
        
        // Aparência
        config.theme = document.getElementById('theme-select').value;
        config.behavior.showNotifications = document.getElementById('show-notifications').checked;
        config.behavior.soundOnComplete = document.getElementById('sound-on-complete').checked;
        
        // Comportamento
        config.behavior.autoStartScheduler = document.getElementById('auto-start-scheduler').checked;
        config.behavior.retryOnFail = document.getElementById('retry-on-fail').checked;
        config.behavior.maxRetries = parseInt(document.getElementById('max-retries').value) || 3;
        config.behavior.delayBetweenAttacks = parseInt(document.getElementById('delay-between-attacks').value) || 1000;
        config.performance.parallelExecutions = parseInt(document.getElementById('parallel-executions').value) || 1;
        config.performance.cacheTroops = document.getElementById('cache-troops').checked;
        
        // Segurança
        config.security.confirmDeletion = document.getElementById('confirm-deletion').checked;
        config.security.confirmMassActions = document.getElementById('confirm-mass-actions').checked;
        config.security.askBeforeSend = document.getElementById('ask-before-send').checked;
        config.security.backupInterval = (parseInt(document.getElementById('backup-interval').value) || 24) * 3600000;
        
        if (saveConfig(config)) {
          alert('✅ Configurações salvas com sucesso!');
        } else {
          alert('❌ Erro ao salvar configurações!');
        }
      },

      saveAndClose() {
        this.save();
        this.close();
      },

      close() {
        const modal = document.getElementById('tws-config-modal');
        if (modal) modal.remove();
      },

      resetUnitSpeeds() {
        if (confirm('Resetar velocidades para valores padrão?')) {
          const config = getConfig();
          config.velocidadesUnidades = { ...defaultConfig.velocidadesUnidades };
          saveConfig(config);
          initializeUnitSpeedGrid();
        }
      },

      testUnitSpeed() {
        const origem = prompt('Coordenada de origem (ex: 500|500):', '500|500');
        const destino = prompt('Coordenada de destino (ex: 501|501):', '501|501');
        
        if (origem && destino) {
          const config = getConfig();
          const distancia = calcularDistancia(origem, destino);
          const unidadeMaisLenta = 'spear'; // Exemplo
          const velocidade = config.velocidadesUnidades[unidadeMaisLenta];
          const tempo = distancia * velocidade;
          
          alert(`🧪 TESTE DE CÁLCULO:\n\n📍 ${origem} → ${destino}\n📏 Distância: ${distancia.toFixed(2)} campos\n🐌 Unidade: ${unidadeMaisLenta}\n⚡ Velocidade: ${velocidade} min/campo\n⏱️ Tempo: ${tempo.toFixed(1)} min`);
        }
      },

      testTelegram() {
        const config = getConfig();
        
        if (!config.telegram.enabled || !config.telegram.botToken || !config.telegram.chatId) {
          alert('❌ Configure o Token e Chat ID primeiro!');
          return;
        }
        
        sendTelegramNotification('🧪 <b>Teste de Notificação</b>\n\nSe você recebeu esta mensagem, o Telegram está configurado corretamente!', 'info')
          .then(success => {
            if (success) {
              alert('✅ Mensagem de teste enviada com sucesso!');
            } else {
              alert('❌ Falha ao enviar mensagem. Verifique Token e Chat ID.');
            }
          });
      },

      exportConfig() {
        exportConfig();
      },

      importConfig() {
        importConfig();
      },

      backupData() {
        // Backup completo de todos os dados
        const backup = {
          config: getConfig(),
          agendamentos: window.TWS_Backend ? window.TWS_Backend.getList() : [],
          farms: window.TWS_FarmInteligente ? window.TWS_FarmInteligente._getFarmList() : [],
          timestamp: new Date().toISOString(),
          version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tws_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('✅ Backup completo exportado!');
      },

      resetConfig() {
        if (resetConfig()) {
          alert('✅ Configurações resetadas para padrão!');
          this.close();
        }
      },

      refresh() {
        initializeUnitSpeedGrid();
        updateStats();
      }
    };

    // Funções auxiliares
    function initializeUnitSpeedGrid() {
      const config = getConfig();
      const grid = document.getElementById('unit-speed-config');
      
      grid.innerHTML = Object.entries(config.velocidadesUnidades)
        .map(([unit, speed]) => `
          <div class="unit-speed-item">
            <span class="unit-speed-label">${unit}:</span>
            <input type="number" class="unit-speed-input" data-unit="${unit}" 
                   value="${speed}" min="1" max="100" step="0.1" />
            <span style="font-size: 11px; color: #718096;">min/campo</span>
          </div>
        `).join('');
    }

    function updateStats() {
      const agendamentos = window.TWS_Backend ? window.TWS_Backend.getList().length : 0;
      const farms = window.TWS_FarmInteligente ? window.TWS_FarmInteligente._getFarmList().length : 0;
      const configSize = Math.round(JSON.stringify(getConfig()).length / 1024 * 100) / 100;
      
      document.getElementById('stats-agendamentos').textContent = agendamentos;
      document.getElementById('stats-farms').textContent = farms;
      document.getElementById('stats-config-size').textContent = configSize;
    }

    Object.assign(window.TWS_ConfigModal, configFunctions);

    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove(); 
      }
    };
  }

  // === INICIALIZAÇÃO ===
  function init() {
    if (!window.TWS_ConfigModal) {
      window.TWS_ConfigModal = {};
    }
    
    window.TWS_ConfigModal.show = showConfigModal;
    window.TWS_ConfigModal.getConfig = getConfig;
    window.TWS_ConfigModal.saveConfig = saveConfig;
    window.TWS_ConfigModal.sendTelegramNotification = sendTelegramNotification;
    
    // Aplicar configurações ao carregar
    applyConfig(getConfig());
    
    console.log('[TW Config] ✅ Sistema de configurações carregado!');
  }

  // Função auxiliar para calcular distância (já existente no farm)
  function calcularDistancia(coord1, coord2) {
    const [x1, y1] = coord1.split('|').map(Number);
    const [x2, y2] = coord2.split('|').map(Number);
    const deltaX = Math.abs(x1 - x2);
    const deltaY = Math.abs(y1 - y2);
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
