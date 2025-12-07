// === TWS CONFIG MODAL ===
(function() {
  'use strict';

  // Criar o elemento modal
  const modalHTML = `
  <div id="tws-config-modal" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 999999;
    font-family: Arial, sans-serif;
  ">
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <!-- Cabeçalho -->
      <div style="
        background: #2c3e50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; font-size: 18px;">⚙️ Configurações TW Scheduler</h3>
        <button id="tws-close-modal" style="
          background: transparent;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
        ">&times;</button>
      </div>

      <!-- Abas -->
      <div style="
        border-bottom: 1px solid #ddd;
        display: flex;
        background: #f8f9fa;
      ">
        <button class="tab-btn active" data-tab="general" style="
          flex: 1;
          padding: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: bold;
          border-bottom: 3px solid transparent;
        ">⚙️ Geral</button>
        <button class="tab-btn" data-tab="telegram" style="
          flex: 1;
          padding: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: bold;
          border-bottom: 3px solid transparent;
        ">📱 Telegram</button>
        <button class="tab-btn" data-tab="advanced" style="
          flex: 1;
          padding: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: bold;
          border-bottom: 3px solid transparent;
        ">⚡ Avançado</button>
      </div>

      <!-- Conteúdo das Abas -->
      <div style="padding: 20px;">
        <!-- ABA GERAL -->
        <div id="tab-general" class="tab-content" style="display: block;">
          <h4 style="margin-top: 0; color: #2c3e50;">Configurações Gerais</h4>
          
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              <input type="checkbox" id="auto-start" checked> Iniciar scheduler automaticamente
            </label>
            <small style="color: #666;">Inicia o scheduler automaticamente ao carregar a página</small>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              <input type="checkbox" id="show-notifications" checked> Mostrar notificações
            </label>
            <small style="color: #666;">Mostrar notificações na tela quando ataques são executados</small>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              <input type="checkbox" id="sound-alerts"> Alertas sonoros
            </label>
            <small style="color: #666;">Tocar som quando ataques são executados</small>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              💾 Auto-save (segundos)
            </label>
            <input type="range" id="auto-save-interval" min="5" max="60" value="10" style="width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
              <span>5s</span>
              <span id="auto-save-value">10s</span>
              <span>60s</span>
            </div>
          </div>
        </div>

        <!-- ABA TELEGRAM -->
        <div id="tab-telegram" class="tab-content" style="display: none;">
          <h4 style="margin-top: 0; color: #2c3e50;">📱 Configurações do Telegram</h4>
          
          <!-- Ativar/Desativar -->
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px; font-weight: bold;">
              <input type="checkbox" id="telegram-enabled" style="margin-right: 8px;"> 
              Ativar notificações via Telegram
            </label>
            <small style="color: #666; display: block;">
              Receba notificações no seu celular quando ataques forem executados
            </small>
          </div>

          <!-- Token do Bot -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              🤖 Token do Bot
            </label>
            <input type="password" id="telegram-token" placeholder="Ex: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" 
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #666; display: block; margin-top: 5px;">
              Obtenha com o <a href="https://t.me/BotFather" target="_blank" style="color: #007bff;">@BotFather</a> no Telegram
            </small>
          </div>

          <!-- Chat ID -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              👥 Chat ID
            </label>
            <input type="text" id="telegram-chatid" placeholder="Ex: 987654321" 
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #666; display: block; margin-top: 5px;">
              Envie "/start" para <a href="https://t.me/chatid_echo_bot" target="_blank" style="color: #007bff;">@chatid_echo_bot</a> para obter seu ID
            </small>
          </div>

          <!-- Tipo de Notificações -->
          <div style="margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 4px;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">🔔 Tipos de Notificação</h5>
            
            <div style="margin-bottom: 8px;">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="telegram-notif-success" checked style="margin-right: 8px;">
                ✅ Ataques bem-sucedidos
              </label>
            </div>

            <div style="margin-bottom: 8px;">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="telegram-notif-failure" checked style="margin-right: 8px;">
                ❌ Ataques falhados
              </label>
            </div>

            <div style="margin-bottom: 8px;">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="telegram-notif-error" checked style="margin-right: 8px;">
                🚨 Erros do sistema
              </label>
            </div>

            <div style="margin-bottom: 0;">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="telegram-notif-farm" style="margin-right: 8px;">
                🔄 Ciclos de farm (se disponível)
              </label>
            </div>
          </div>

          <!-- Botões de Ação -->
          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="test-telegram" style="
              flex: 1;
              padding: 10px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">🔗 Testar Conexão</button>
            
            <button id="send-test-msg" style="
              flex: 1;
              padding: 10px;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">📤 Enviar Teste</button>
          </div>

          <!-- Status do Telegram -->
          <div id="telegram-status" style="
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            background: #f8f9fa;
            display: none;
          "></div>
        </div>

        <!-- ABA AVANÇADO -->
        <div id="tab-advanced" class="tab-content" style="display: none;">
          <h4 style="margin-top: 0; color: #2c3e50;">⚡ Configurações Avançadas</h4>
          
          <!-- Intervalo do Scheduler -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              ⏱️ Intervalo do Scheduler (ms)
            </label>
            <select id="scheduler-interval" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="50">50ms (Máxima precisão)</option>
              <option value="100" selected>100ms (Recomendado)</option>
              <option value="250">250ms (Balanceado)</option>
              <option value="500">500ms (Econômico)</option>
              <option value="1000">1000ms (Muito econômico)</option>
            </select>
            <small style="color: #666; display: block; margin-top: 5px;">
              Menor intervalo = maior precisão, maior uso de CPU
            </small>
          </div>

          <!-- Tentativas de Retry -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              🔄 Tentativas em caso de falha
            </label>
            <select id="max-retries" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="0">0 (Sem retry)</option>
              <option value="1">1 tentativa</option>
              <option value="2">2 tentativas</option>
              <option value="3" selected>3 tentativas (Padrão)</option>
              <option value="5">5 tentativas</option>
            </select>
          </div>

          <!-- Timeout das requisições -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              ⏰ Timeout das requisições (ms)
            </label>
            <input type="number" id="request-timeout" value="8000" min="1000" max="30000" 
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #666;">Tempo máximo para aguardar resposta do servidor</small>
          </div>

          <!-- Logs -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
              📝 Nível de Log
            </label>
            <select id="log-level" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="0">Nenhum</option>
              <option value="1">Apenas erros</option>
              <option value="2" selected>Normal</option>
              <option value="3">Detalhado</option>
              <option value="4">Debug completo</option>
            </select>
          </div>

          <!-- Botão de Reset -->
          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #ddd;">
            <button id="reset-settings" style="
              padding: 10px 20px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">🔄 Restaurar Padrões</button>
            <small style="color: #666; display: block; margin-top: 5px;">
              Restaura todas as configurações para os valores padrão
            </small>
          </div>
        </div>

        <!-- Botões de Ação Globais -->
        <div style="
          display: flex;
          gap: 10px;
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        ">
          <button id="tws-save-settings" style="
            flex: 1;
            padding: 12px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">💾 Salvar</button>
          
          <button id="tws-cancel-settings" style="
            flex: 1;
            padding: 12px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">❌ Cancelar</button>
        </div>
      </div>
    </div>
  </div>
  `;

  // Injetar o modal no DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Configurações padrão
  const defaultConfig = {
    general: {
      autoStart: true,
      showNotifications: true,
      soundAlerts: false,
      autoSaveInterval: 10
    },
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
      notifications: {
        success: true,
        failure: true,
        error: true,
        farm: false
      }
    },
    advanced: {
      schedulerInterval: 100,
      maxRetries: 3,
      requestTimeout: 8000,
      logLevel: 2
    }
  };

  // Obter configurações salvas
  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
      return {
        general: { ...defaultConfig.general, ...saved.general },
        telegram: { ...defaultConfig.telegram, ...saved.telegram },
        advanced: { ...defaultConfig.advanced, ...saved.advanced }
      };
    } catch (e) {
      return defaultConfig;
    }
  }

  // Salvar configurações
  function saveConfig(config) {
    try {
      localStorage.setItem('tws_global_config_v2', JSON.stringify(config));
      
      // Aplicar configurações em tempo real
      applyConfig(config);
      
      // Atualizar o scheduler se estiver rodando
      if (window.TWS_Backend && window.TWS_Backend.startScheduler) {
        window.TWS_Backend.startScheduler();
      }
      
      return true;
    } catch (e) {
      console.error('[TWS Config] Erro ao salvar configurações:', e);
      return false;
    }
  }

  // Aplicar configurações
  function applyConfig(config) {
    // Atualizar o intervalo do scheduler no backend
    if (window.getGlobalConfig) {
      window.getGlobalConfig = () => ({
        behavior: {
          schedulerCheckInterval: config.advanced.schedulerInterval,
          retryOnFail: config.advanced.maxRetries > 0,
          maxRetries: config.advanced.maxRetries
        }
      });
    }
    
    // Atualizar configurações do Telegram se o módulo existir
    if (window.TelegramBotReal) {
      window.TelegramBotReal.saveConfig(config.telegram);
    }
  }

  // Preencher o modal com configurações
  function populateModal() {
    const config = getConfig();
    
    // Aba Geral
    document.getElementById('auto-start').checked = config.general.autoStart;
    document.getElementById('show-notifications').checked = config.general.showNotifications;
    document.getElementById('sound-alerts').checked = config.general.soundAlerts;
    document.getElementById('auto-save-interval').value = config.general.autoSaveInterval;
    document.getElementById('auto-save-value').textContent = `${config.general.autoSaveInterval}s`;
    
    // Aba Telegram
    document.getElementById('telegram-enabled').checked = config.telegram.enabled;
    document.getElementById('telegram-token').value = config.telegram.botToken;
    document.getElementById('telegram-chatid').value = config.telegram.chatId;
    document.getElementById('telegram-notif-success').checked = config.telegram.notifications.success;
    document.getElementById('telegram-notif-failure').checked = config.telegram.notifications.failure;
    document.getElementById('telegram-notif-error').checked = config.telegram.notifications.error;
    document.getElementById('telegram-notif-farm').checked = config.telegram.notifications.farm;
    
    updateTelegramUI();
    
    // Aba Avançado
    document.getElementById('scheduler-interval').value = config.advanced.schedulerInterval;
    document.getElementById('max-retries').value = config.advanced.maxRetries;
    document.getElementById('request-timeout').value = config.advanced.requestTimeout;
    document.getElementById('log-level').value = config.advanced.logLevel;
  }

  // Atualizar UI do Telegram
  function updateTelegramUI() {
    const enabled = document.getElementById('telegram-enabled').checked;
    const inputs = ['telegram-token', 'telegram-chatid'];
    const checkboxes = ['telegram-notif-success', 'telegram-notif-failure', 'telegram-notif-error', 'telegram-notif-farm'];
    
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    
    checkboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  // Configurar eventos
  function setupEventListeners() {
    // Fechar modal
    document.getElementById('tws-close-modal').addEventListener('click', hideModal);
    document.getElementById('tws-cancel-settings').addEventListener('click', hideModal);
    
    // Salvar configurações
    document.getElementById('tws-save-settings').addEventListener('click', saveSettings);
    
    // Trocar abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const tab = this.getAttribute('data-tab');
        
        // Ativar botão
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.style.borderBottomColor = 'transparent';
          b.style.color = '#333';
        });
        this.style.borderBottomColor = '#007bff';
        this.style.color = '#007bff';
        
        // Mostrar conteúdo
        document.querySelectorAll('.tab-content').forEach(content => {
          content.style.display = 'none';
        });
        document.getElementById(`tab-${tab}`).style.display = 'block';
      });
    });
    
    // Atualizar valor do range
    document.getElementById('auto-save-interval').addEventListener('input', function() {
      document.getElementById('auto-save-value').textContent = `${this.value}s`;
    });
    
    // Telegram: Atualizar UI quando ativar/desativar
    document.getElementById('telegram-enabled').addEventListener('change', updateTelegramUI);
    
    // Telegram: Testar conexão
    document.getElementById('test-telegram').addEventListener('click', async function() {
      const btn = this;
      const originalText = btn.innerHTML;
      
      btn.innerHTML = '⏳ Testando...';
      btn.disabled = true;
      
      try {
        // Se o módulo Telegram estiver disponível, usar ele
        if (window.TelegramBotReal) {
          // Atualizar configurações primeiro
          updateTelegramFromModal();
          const result = await window.TelegramBotReal.testConnection();
          
          const statusEl = document.getElementById('telegram-status');
          if (result.success) {
            statusEl.innerHTML = `
              <div style="color: #155724; background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px;">
                <strong>✅ ${result.message}</strong><br>
                ${result.details.replace(/\n/g, '<br>')}
              </div>
            `;
          } else {
            statusEl.innerHTML = `
              <div style="color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px;">
                <strong>${result.error}</strong>
              </div>
            `;
          }
          statusEl.style.display = 'block';
        } else {
          alert('❌ Módulo do Telegram não está carregado!');
        }
      } catch (error) {
        alert(`❌ Erro: ${error.message}`);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
    
    // Telegram: Enviar mensagem de teste
    document.getElementById('send-test-msg').addEventListener('click', async function() {
      const btn = this;
      const originalText = btn.innerHTML;
      
      btn.innerHTML = '📤 Enviando...';
      btn.disabled = true;
      
      try {
        if (window.TelegramBotReal) {
          updateTelegramFromModal();
          const result = await window.TelegramBotReal.sendTestMessage();
          
          if (result.success) {
            alert('✅ Mensagem de teste enviada com sucesso!');
          } else {
            alert(`❌ Erro: ${result.error}`);
          }
        } else {
          alert('❌ Módulo do Telegram não está carregado!');
        }
      } catch (error) {
        alert(`❌ Erro: ${error.message}`);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
    
    // Botão de reset
    document.getElementById('reset-settings').addEventListener('click', function() {
      if (confirm('⚠️ Tem certeza que deseja restaurar todas as configurações para os valores padrão?')) {
        saveConfig(defaultConfig);
        populateModal();
        alert('✅ Configurações restauradas com sucesso!');
      }
    });
    
    // Fechar ao clicar fora do modal
    document.getElementById('tws-config-modal').addEventListener('click', function(e) {
      if (e.target === this) hideModal();
    });
    
    // Tecla ESC para fechar
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') hideModal();
    });
  }
  
  // Atualizar configurações do Telegram a partir do modal
  function updateTelegramFromModal() {
    const telegramConfig = {
      enabled: document.getElementById('telegram-enabled').checked,
      botToken: document.getElementById('telegram-token').value.trim(),
      chatId: document.getElementById('telegram-chatid').value.trim(),
      notifications: {
        success: document.getElementById('telegram-notif-success').checked,
        failure: document.getElementById('telegram-notif-failure').checked,
        error: document.getElementById('telegram-notif-error').checked,
        farm: document.getElementById('telegram-notif-farm').checked
      }
    };
    
    if (window.TelegramBotReal) {
      window.TelegramBotReal.saveConfig(telegramConfig);
    }
    
    return telegramConfig;
  }

  // Salvar todas as configurações
  function saveSettings() {
    const config = {
      general: {
        autoStart: document.getElementById('auto-start').checked,
        showNotifications: document.getElementById('show-notifications').checked,
        soundAlerts: document.getElementById('sound-alerts').checked,
        autoSaveInterval: parseInt(document.getElementById('auto-save-interval').value)
      },
      telegram: updateTelegramFromModal(),
      advanced: {
        schedulerInterval: parseInt(document.getElementById('scheduler-interval').value),
        maxRetries: parseInt(document.getElementById('max-retries').value),
        requestTimeout: parseInt(document.getElementById('request-timeout').value),
        logLevel: parseInt(document.getElementById('log-level').value)
      }
    };
    
    if (saveConfig(config)) {
      alert('✅ Configurações salvas com sucesso!');
      hideModal();
    } else {
      alert('❌ Erro ao salvar configurações!');
    }
  }

  // Mostrar modal
  function showModal() {
    populateModal();
    document.getElementById('tws-config-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  // Esconder modal
  function hideModal() {
    document.getElementById('tws-config-modal').style.display = 'none';
    document.body.style.overflow = '';
  }

  // Adicionar botão na interface do TW
  function addConfigButtonToUI() {
    // Criar botão flutuante
    const buttonHTML = `
      <div id="tws-config-button" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        font-size: 24px;
        transition: all 0.3s ease;
        user-select: none;
      ">
        ⚙️
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', buttonHTML);
    
    // Adicionar hover effect
    const btn = document.getElementById('tws-config-button');
    btn.addEventListener('mouseover', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    });
    
    btn.addEventListener('mouseout', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    });
    
    // Abrir modal ao clicar
    btn.addEventListener('click', showModal);
  }

  // Inicializar
  function init() {
    // Carregar configurações
    const config = getConfig();
    applyConfig(config);
    
    // Iniciar scheduler automaticamente se configurado
    if (config.general.autoStart && window.TWS_Backend && window.TWS_Backend.startScheduler) {
      setTimeout(() => {
        window.TWS_Backend.startScheduler();
      }, 1000);
    }
    
    // Configurar eventos
    setupEventListeners();
    
    // Adicionar botão de configurações
    setTimeout(addConfigButtonToUI, 1000);
    
    console.log('[TWS Config] Modal de configurações carregado!');
  }

  // Expor funções globalmente
  window.TWS_ConfigModal = {
    show: showModal,
    hide: hideModal,
    getConfig: getConfig,
    saveConfig: saveConfig
  };

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
