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
      display: flex;
      flex-direction: column;
    `;

    modal.innerHTML = `
      <style>
        .tws-config-tabs {
          display: flex;
          background: #4A5568;
          padding: 0;
        }
        .tws-config-tab {
          padding: 15px 20px;
          color: white;
          cursor: pointer;
          border: none;
          background: none;
          font-weight: bold;
          transition: all 0.3s;
        }
        .tws-config-tab:hover {
          background: #5a6578;
        }
        .tws-config-tab.active {
          background: #667eea;
        }
        .tws-config-tab-content {
          display: none;
          padding: 20px;
          background: #F7FAFC;
          overflow-y: auto;
          max-height: 60vh;
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
        }
        .tws-config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .tws-config-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tws-config-label {
          min-width: 80px;
          font-weight: bold;
          font-size: 14px;
        }
        .tws-config-input {
          width: 80px;
          padding: 8px;
          border: 1px solid #CBD5E0;
          border-radius: 4px;
          text-align: center;
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
        }
        .tws-config-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .btn-primary { background: #667eea; }
        .btn-success { background: #48BB78; }
        .btn-warning { background: #ED8936; }
        .btn-danger { background: #F56565; }
        .btn-secondary { background: #718096; }
        
        /* Dark theme */
        [data-tws-theme="dark"] .tws-config-tab-content {
          background: #2D3748;
          color: #E2E8F0;
        }
        [data-tws-theme="dark"] .tws-config-section {
          background: #4A5568;
          color: #E2E8F0;
        }
        [data-tws-theme="dark"] .tws-config-input {
          background: #2D3748;
          border-color: #718096;
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
      <div class="tws-config-tabs">
        <button class="tws-config-tab active" onclick="switchConfigTab('unidades')">🎯 Unidades</button>
        <button class="tws-config-tab" onclick="switchConfigTab('telegram')">🤖 Telegram</button>
        <button class="tws-config-tab" onclick="switchConfigTab('aparencia')">🎨 Aparência</button>
        <button class="tws-config-tab" onclick="switchConfigTab('comportamento')">⚡ Comportamento</button>
        <button class="tws-config-tab" onclick="switchConfigTab('backup')">💾 Backup</button>
      </div>

      <!-- Conteúdo das Abas -->
      <div style="flex: 1; overflow-y: auto;">
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
                  <span class="tws-config-label">${unit}:</span>
                  <input type="number" class="tws-config-input" data-unit="${unit}" 
                         value="${speed}" min="1" max="100" step="0.1" />
                  <span style="font-size: 11px; color: #718096;">min/campo</span>
                </div>
              `).join('')}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
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
            
            <div style="margin-bottom: 15px;">
              <label>
                <input type="checkbox" id="telegram-enabled" ${config.telegram.enabled ? 'checked' : ''}>
                Ativar notificações do Telegram
              </label>
            </div>
            
            <div style="display: grid; gap: 15px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Bot Token:</label>
                <input type="password" style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                       id="telegram-token" value="${config.telegram.botToken}" placeholder="123456789:ABCdefGHIjkl..." />
              </div>
              
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Chat ID:</label>
                <input type="text" style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                       id="telegram-chatid" value="${config.telegram.chatId}" placeholder="-100123456789" />
              </div>
            </div>
            
            <div>
              <label style="display: block; font-weight: bold; margin-bottom: 10px;">Notificações:</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <label>
                  <input type="checkbox" id="telegram-notif-success" ${config.telegram.notifications.success ? 'checked' : ''}>
                  ✅ Ataques bem-sucedidos
                </label>
                <label>
                  <input type="checkbox" id="telegram-notif-failure" ${config.telegram.notifications.failure ? 'checked' : ''}>
                  ❌ Ataques falhos
                </label>
                <label>
                  <input type="checkbox" id="telegram-notif-farm" ${config.telegram.notifications.farmCycle ? 'checked' : ''}>
                  🔄 Ciclos de Farm
                </label>
                <label>
                  <input type="checkbox" id="telegram-notif-error" ${config.telegram.notifications.error ? 'checked' : ''}>
                  🚨 Erros do sistema
                </label>
              </div>
            </div>
            
            <button class="tws-config-btn btn-primary" onclick="testTelegram()" style="margin-top: 15px;">
              🧪 Testar Conexão Telegram
            </button>
          </div>
        </div>

        <!-- ABA: APARÊNCIA -->
        <div id="tab-aparencia" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">🎨 Aparência e Tema</h3>
            
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-weight: bold; margin-bottom: 5px;">Tema:</label>
              <select style="width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" id="theme-select">
                <option value="light" ${config.theme === 'light' ? 'selected' : ''}>🌞 Claro</option>
                <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>🌙 Escuro</option>
                <option value="auto" ${config.theme === 'auto' ? 'selected' : ''}>⚡ Automático (Sistema)</option>
              </select>
            </div>
            
            <div style="display: grid; gap: 10px;">
              <label>
                <input type="checkbox" id="show-notifications" ${config.behavior.showNotifications ? 'checked' : ''}>
                Mostrar notificações na tela
              </label>
              <label>
                <input type="checkbox" id="sound-on-complete" ${config.behavior.soundOnComplete ? 'checked' : ''}>
                Som quando ataques são concluídos
              </label>
            </div>
          </div>
        </div>

        <!-- ABA: COMPORTAMENTO -->
        <div id="tab-comportamento" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">⚡ Comportamento do Sistema</h3>
            
            <div style="display: grid; gap: 15px;">
              <label>
                <input type="checkbox" id="auto-start-scheduler" ${config.behavior.autoStartScheduler ? 'checked' : ''}>
                Iniciar scheduler automaticamente
              </label>
              
              <label>
                <input type="checkbox" id="retry-on-fail" ${config.behavior.retryOnFail ? 'checked' : ''}>
                Tentar novamente em caso de falha
              </label>
              
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Máximo de tentativas:</label>
                <input type="number" style="width: 100px; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                       id="max-retries" value="${config.behavior.maxRetries}" min="1" max="10" />
              </div>
              
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Delay entre ataques (ms):</label>
                <input type="number" style="width: 150px; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px;" 
                       id="delay-between-attacks" value="${config.behavior.delayBetweenAttacks}" min="0" max="10000" />
              </div>
            </div>
          </div>
        </div>

        <!-- ABA: BACKUP -->
        <div id="tab-backup" class="tws-config-tab-content">
          <div class="tws-config-section">
            <h3 style="margin-top: 0; color: #2D3748;">💾 Backup e Restauração</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="background: #F7FAFC; padding: 15px; text-align: center; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
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

    // Adicionar funções globais temporárias
    window.switchConfigTab = function(tabName) {
      // Remover active de todas as abas
      document.querySelectorAll('.tws-config-tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tws-config-tab-content').forEach(content => content.classList.remove('active'));
      
      // Adicionar active à aba selecionada
      document.querySelector(`.tws-config-tab[onclick="switchConfigTab('${tabName}')"]`).classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');
    };

    window.resetUnitSpeeds = function() {
      if (confirm('Resetar velocidades para valores padrão?')) {
        const config = getConfig();
        config.velocidadesUnidades = { ...defaultConfig.velocidadesUnidades };
        saveConfig(config);
        
        // Atualizar os inputs
        document.querySelectorAll('.tws-config-input').forEach(input => {
          const unit = input.dataset.unit;
          input.value = config.velocidadesUnidades[unit];
        });
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

    window.testTelegram = function() {
      alert('🧪 Funcionalidade de teste do Telegram será implementada!');
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
      alert('✅ Configurações exportadas!');
    };

    window.importConfig = function() {
      alert('📥 Funcionalidade de importação será implementada!');
    };

    window.backupData = function() {
      alert('💾 Funcionalidade de backup completo será implementada!');
    };

    window.resetConfig = function() {
      if (confirm('⚠️ TEM CERTEZA?\n\nIsso resetará TODAS as configurações para os valores padrão.')) {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        applyConfig(defaultConfig);
        alert('✅ Configurações resetadas!');
        closeConfigModal();
      }
    };

    window.saveConfig = function() {
      const config = getConfig();
      
      // Salvar velocidades das unidades
      document.querySelectorAll('.tws-config-input').forEach(input => {
        const unit = input.dataset.unit;
        const value = parseInt(input.value) || defaultConfig.velocidadesUnidades[unit];
        config.velocidadesUnidades[unit] = Math.max(1, value);
      });
      
      // Salvar outras configurações
      config.telegram.enabled = document.getElementById('telegram-enabled').checked;
      config.telegram.botToken = document.getElementById('telegram-token').value;
      config.telegram.chatId = document.getElementById('telegram-chatid').value;
      config.telegram.notifications.success = document.getElementById('telegram-notif-success').checked;
      config.telegram.notifications.failure = document.getElementById('telegram-notif-failure').checked;
      config.telegram.notifications.farmCycle = document.getElementById('telegram-notif-farm').checked;
      config.telegram.notifications.error = document.getElementById('telegram-notif-error').checked;
      
      config.theme = document.getElementById('theme-select').value;
      config.behavior.showNotifications = document.getElementById('show-notifications').checked;
      config.behavior.soundOnComplete = document.getElementById('sound-on-complete').checked;
      config.behavior.autoStartScheduler = document.getElementById('auto-start-scheduler').checked;
      config.behavior.retryOnFail = document.getElementById('retry-on-fail').checked;
      config.behavior.maxRetries = parseInt(document.getElementById('max-retries').value) || 3;
      config.behavior.delayBetweenAttacks = parseInt(document.getElementById('delay-between-attacks').value) || 1000;
      
      if (saveConfig(config)) {
        alert('✅ Configurações salvas com sucesso!');
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
      delete window.switchConfigTab;
      delete window.resetUnitSpeeds;
      delete window.testUnitSpeed;
      delete window.testTelegram;
      delete window.exportConfig;
      delete window.importConfig;
      delete window.backupData;
      delete window.resetConfig;
      delete window.saveConfig;
      delete window.saveAndCloseConfig;
      delete window.closeConfigModal;
    };

    // Fechar modal ao clicar fora
    overlay.onclick = function(e) {
      if (e.target === overlay) {
        window.closeConfigModal();
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
    
    // Aplicar configurações ao carregar
    applyConfig(getConfig());
    
    console.log('[TW Config] ✅ Sistema de configurações carregado!');
  }

  // Função auxiliar para calcular distância
  function calcularDistancia(coord1, coord2) {
    const [x1, y1] = coord1.split('|').map(Number);
    const [x2, y2] = coord2.split('|').map(Number);
    const deltaX = Math.abs(x1 - x2);
    const deltaY = Math.abs(y1 - y2);
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
