// === PAINEL VISUAL DE BENCHMARK ===
const TWS_BenchmarkUI = {
  isOpen: false,
  panel: null,
  
  // Configurações de teste
  testProfiles: {
    precisao: {
      name: "⚡ Máxima Precisão",
      configs: [
        { ATTACK_TIMEOUT: 3000, retries: 1, schedulerInterval: 50, name: "Precisão-1" },
        { ATTACK_TIMEOUT: 4000, retries: 2, schedulerInterval: 50, name: "Precisão-2" },
        { ATTACK_TIMEOUT: 5000, retries: 1, schedulerInterval: 100, name: "Precisão-3" }
      ]
    },
    estabilidade: {
      name: "🛡️ Máxima Estabilidade", 
      configs: [
        { ATTACK_TIMEOUT: 8000, retries: 3, schedulerInterval: 500, name: "Estabilidade-1" },
        { ATTACK_TIMEOUT: 10000, retries: 3, schedulerInterval: 1000, name: "Estabilidade-2" },
        { ATTACK_TIMEOUT: 8000, retries: 2, schedulerInterval: 250, name: "Estabilidade-3" }
      ]
    },
    balanceado: {
      name: "⭐ Balanceado",
      configs: [
        { ATTACK_TIMEOUT: 5000, retries: 2, schedulerInterval: 100, name: "Balanceado-1" },
        { ATTACK_TIMEOUT: 6000, retries: 2, schedulerInterval: 250, name: "Balanceado-2" },
        { ATTACK_TIMEOUT: 5000, retries: 1, schedulerInterval: 500, name: "Balanceado-3" }
      ]
    },
    personalizado: {
      name: "🎛️ Personalizado",
      configs: []
    }
  },

  showPanel() {
    if (this.isOpen) return;
    
    this.createPanel();
    this.isOpen = true;
  },

  createPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'tws-benchmark-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 100000;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.3s ease;
    `;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid #4A5568;
      border-radius: 12px;
      padding: 0;
      width: 95%;
      max-width: 1200px;
      height: 90vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
    `;

    this.panel.innerHTML = this.getPanelHTML();
    overlay.appendChild(this.panel);
    document.body.appendChild(overlay);

    this.initializeEventListeners();
    this.updateCustomConfigForm();

    // Fechar ao clicar fora
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.closePanel();
      }
    };
  },

  getPanelHTML() {
    return `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        
        .benchmark-tabs { display: flex; background: #4A5568; padding: 0; border-bottom: 2px solid #667eea; }
        .benchmark-tab { padding: 15px 20px; color: white; cursor: pointer; border: none; background: none; font-weight: bold; transition: all 0.3s; border-bottom: 3px solid transparent; }
        .benchmark-tab:hover { background: #5a6578; }
        .benchmark-tab.active { background: #667eea; border-bottom-color: #48BB78; }
        
        .benchmark-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .benchmark-tab-content { display: none; padding: 20px; background: #F7FAFC; overflow-y: auto; flex: 1; color: #2D3748; }
        .benchmark-tab-content.active { display: block; }
        
        .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 15px 0; }
        .config-card { background: white; border-radius: 8px; padding: 15px; border-left: 4px solid #667eea; cursor: pointer; transition: all 0.3s; }
        .config-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .config-card.selected { border-left-color: #48BB78; background: #F0FFF4; }
        
        .metric-bar { height: 8px; background: #E2E8F0; border-radius: 4px; margin: 5px 0; overflow: hidden; }
        .metric-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
        
        .test-progress { height: 6px; background: #E2E8F0; border-radius: 3px; margin: 10px 0; overflow: hidden; }
        .test-progress-fill { height: 100%; background: linear-gradient(90deg, #48BB78, #38A169); border-radius: 3px; transition: width 0.3s ease; }
        
        .result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; }
        .result-card { background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #E2E8F0; }
        
        .btn { padding: 10px 16px; border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; margin: 5px; transition: all 0.3s; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: #667eea; }
        .btn-success { background: #48BB78; }
        .btn-warning { background: #ED8936; }
        .btn-danger { background: #F56565; }
        .btn-secondary { background: #718096; }
        
        .form-group { margin-bottom: 15px; }
        .form-label { display: block; font-weight: bold; margin-bottom: 5px; color: #2D3748; }
        .form-input { width: 100%; padding: 8px; border: 1px solid #CBD5E0; border-radius: 4px; }
        
        .live-stats { background: #EDF2F7; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2D3748; }
        
        [data-tws-theme="dark"] .benchmark-tab-content { background: #2D3748; color: #E2E8F0; }
        [data-tws-theme="dark"] .config-card { background: #4A5568; color: #E2E8F0; }
        [data-tws-theme="dark"] .result-card { background: #4A5568; color: #E2E8F0; border-color: #718096; }
        [data-tws-theme="dark"] .form-label { color: #E2E8F0; }
        [data-tws-theme="dark"] .form-input { background: #2D3748; border-color: #718096; color: #E2E8F0; }
        [data-tws-theme="dark"] .live-stats { background: #4A5568; color: #E2E8F0; }
        [data-tws-theme="dark"] .stat-value { color: #E2E8F0; }
      </style>

      <!-- Cabeçalho -->
      <div style="background: #4A5568; padding: 20px; text-align: center; border-bottom: 3px solid #667eea;">
        <div style="font-size: 24px; font-weight: bold; color: white;">🧪 PAINEL DE OTIMIZAÇÃO</div>
        <div style="color: #E2E8F0; font-size: 14px; margin-top: 5px;">
          Encontre a configuração perfeita para seu ambiente
        </div>
      </div>

      <!-- Abas -->
      <div class="benchmark-tabs">
        <button class="benchmark-tab active" onclick="TWS_BenchmarkUI.switchTab('profiles')">📊 Perfis</button>
        <button class="benchmark-tab" onclick="TWS_BenchmarkUI.switchTab('custom')">🎛️ Personalizado</button>
        <button class="benchmark-tab" onclick="TWS_BenchmarkUI.switchTab('results')">📈 Resultados</button>
        <button class="benchmark-tab" onclick="TWS_BenchmarkUI.switchTab('live')">📡 Monitoramento</button>
      </div>

      <!-- Conteúdo -->
      <div class="benchmark-content">
        
        <!-- ABA: PERFIS PRONTOS -->
        <div id="tab-profiles" class="benchmark-tab-content active">
          <h3>🎯 Selecione um Perfil de Teste</h3>
          <p>Escolha um perfil que combine com suas necessidades:</p>
          
          <div class="config-grid">
            ${this.getProfileCardsHTML()}
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <button class="btn btn-success" onclick="TWS_BenchmarkUI.startSelectedProfile()" id="start-profile-btn">
              🚀 Executar Benchmark do Perfil Selecionado
            </button>
          </div>
        </div>

        <!-- ABA: CONFIGURAÇÃO PERSONALIZADA -->
        <div id="tab-custom" class="benchmark-tab-content">
          <h3>🎛️ Configuração Personalizada</h3>
          
          <div class="form-group">
            <label class="form-label">Timeout do Ataque (ms):</label>
            <input type="number" class="form-input" id="custom-timeout" value="5000" min="1000" max="15000">
          </div>
          
          <div class="form-group">
            <label class="form-label">Tentativas de Retry:</label>
            <input type="number" class="form-input" id="custom-retries" value="2" min="0" max="5">
          </div>
          
          <div class="form-group">
            <label class="form-label">Intervalo do Scheduler (ms):</label>
            <input type="number" class="form-input" id="custom-interval" value="100" min="50" max="5000">
          </div>
          
          <div class="form-group">
            <label class="form-label">Número de Testes:</label>
            <input type="number" class="form-input" id="custom-tests" value="5" min="1" max="20">
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <button class="btn btn-warning" onclick="TWS_BenchmarkUI.startCustomTest()">
              🔬 Executar Teste Personalizado
            </button>
          </div>
        </div>

        <!-- ABA: RESULTADOS -->
        <div id="tab-results" class="benchmark-tab-content">
          <h3>📈 Resultados dos Testes</h3>
          <div id="results-container">
            <div style="text-align: center; padding: 40px; color: #718096;">
              Nenhum teste executado ainda. Execute um benchmark para ver os resultados.
            </div>
          </div>
        </div>

        <!-- ABA: MONITORAMENTO AO VIVO -->
        <div id="tab-live" class="benchmark-tab-content">
          <h3>📡 Monitoramento em Tempo Real</h3>
          
          <div class="live-stats">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
              <div>
                <div class="form-label">Taxa de Sucesso</div>
                <div class="stat-value" id="live-success">0%</div>
              </div>
              <div>
                <div class="form-label">Tempo Médio</div>
                <div class="stat-value" id="live-response">0ms</div>
              </div>
              <div>
                <div class="form-label">Precisão</div>
                <div class="stat-value" id="live-precision">±0ms</div>
              </div>
              <div>
                <div class="form-label">Performance</div>
                <div class="stat-value" id="live-score">0</div>
              </div>
            </div>
          </div>
          
          <div style="margin: 20px 0;">
            <h4>Progresso do Teste Atual</h4>
            <div class="test-progress">
              <div class="test-progress-fill" id="test-progress-bar" style="width: 0%"></div>
            </div>
            <div id="test-status" style="text-align: center; font-size: 14px; color: #718096;">
              Aguardando início do teste...
            </div>
          </div>
          
          <div class="result-grid" id="live-results">
            <!-- Resultados em tempo real aparecerão aqui -->
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="background: #F7FAFC; padding: 15px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
        <button class="btn btn-secondary" onclick="TWS_BenchmarkUI.closePanel()">
          ❌ Fechar
        </button>
        <div>
          <button class="btn btn-danger" onclick="TWS_BenchmarkUI.stopAllTests()" id="stop-btn" disabled>
            ⏹️ Parar Todos os Testes
          </button>
          <button class="btn btn-primary" onclick="TWS_BenchmarkUI.applyBestConfig()" id="apply-btn" disabled>
            ✅ Aplicar Melhor Configuração
          </button>
        </div>
      </div>
    `;
  },

  getProfileCardsHTML() {
    let html = '';
    for (const [key, profile] of Object.entries(this.testProfiles)) {
      if (key === 'personalizado') continue;
      
      html += `
        <div class="config-card" onclick="TWS_BenchmarkUI.selectProfile('${key}')" id="profile-${key}">
          <h4 style="margin: 0 0 10px 0;">${profile.name}</h4>
          <div style="font-size: 12px; color: #718096; margin-bottom: 10px;">
            ${profile.configs.length} configurações para testar
          </div>
          <div class="metric-bar">
            <div class="metric-fill" style="width: ${key === 'precisao' ? '90%' : key === 'estabilidade' ? '70%' : '80%'}; background: ${key === 'precisao' ? '#48BB78' : key === 'estabilidade' ? '#ED8936' : '#667eea'};"></div>
          </div>
          <div style="font-size: 11px; color: #718096; margin-top: 5px;">
            ${this.getProfileDescription(key)}
          </div>
        </div>
      `;
    }
    return html;
  },

  getProfileDescription(profileKey) {
    const descriptions = {
      precisao: "Foco em timing preciso (±25ms), maior consumo de CPU",
      estabilidade: "Foco em confiabilidade, tolerante a falhas de rede", 
      balanceado: "Equilíbrio entre precisão, estabilidade e performance"
    };
    return descriptions[profileKey] || "";
  },

  initializeEventListeners() {
    // Será implementado com a lógica de testes
  },

  switchTab(tabName) {
    // Oculta todas as abas
    document.querySelectorAll('.benchmark-tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.benchmark-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Mostra a aba selecionada
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelector(`.benchmark-tab[onclick="TWS_BenchmarkUI.switchTab('${tabName}')"]`).classList.add('active');
  },

  selectProfile(profileKey) {
    // Remove seleção anterior
    document.querySelectorAll('.config-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Adiciona seleção nova
    document.getElementById(`profile-${profileKey}`).classList.add('selected');
    this.selectedProfile = profileKey;
  },

  startSelectedProfile() {
    if (!this.selectedProfile) {
      alert('Selecione um perfil primeiro!');
      return;
    }
    
    const profile = this.testProfiles[this.selectedProfile];
    this.switchTab('live');
    this.startBenchmark(profile.configs, profile.name);
  },

  startCustomTest() {
    const config = {
      ATTACK_TIMEOUT: parseInt(document.getElementById('custom-timeout').value),
      retries: parseInt(document.getElementById('custom-retries').value),
      schedulerInterval: parseInt(document.getElementById('custom-interval').value),
      name: 'Personalizado'
    };
    
    const tests = parseInt(document.getElementById('custom-tests').value);
    const configs = Array(tests).fill(config);
    
    this.switchTab('live');
    this.startBenchmark(configs, 'Teste Personalizado');
  },

  updateCustomConfigForm() {
    // Atualiza valores iniciais baseados na configuração atual
    const currentConfig = window.TWS_Backend?.getGlobalConfig?.()?.behavior || {};
    if (currentConfig.schedulerCheckInterval) {
      document.getElementById('custom-interval').value = currentConfig.schedulerCheckInterval;
    }
  },

  startBenchmark(configs, profileName) {
    console.log(`🚀 Iniciando benchmark: ${profileName} com ${configs.length} configurações`);
    // Aqui integraria com a engine de testes
    this.updateTestStatus(`Iniciando ${profileName}...`, 0);
  },

  updateTestStatus(message, progress) {
    const statusEl = document.getElementById('test-status');
    const progressBar = document.getElementById('test-progress-bar');
    
    if (statusEl) statusEl.textContent = message;
    if (progressBar) progressBar.style.width = `${progress}%`;
  },

  stopAllTests() {
    console.log('⏹️ Parando todos os testes...');
    this.updateTestStatus('Testes interrompidos pelo usuário', 0);
  },

  applyBestConfig() {
    console.log('✅ Aplicando melhor configuração...');
    // Aqui aplicaria a configuração otimizada
  },

  closePanel() {
    const overlay = document.getElementById('tws-benchmark-overlay');
    if (overlay) {
      overlay.remove();
    }
    this.isOpen = false;
  }
};

// === INTEGRAÇÃO COM O SISTEMA ===
window.TWS_BenchmarkUI = TWS_BenchmarkUI;

// Adicionar botão na interface principal
function addBenchmarkButton() {
  const existingBtn = document.getElementById('tws-benchmark-btn');
  if (existingBtn) return;
  
  const btn = document.createElement('button');
  btn.id = 'tws-benchmark-btn';
  btn.innerHTML = '🧪 Otimizar';
  btn.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 9999;
    padding: 10px 15px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.3s;
  `;
  
  btn.onmouseover = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
  };
  
  btn.onmouseout = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  };
  
  btn.onclick = () => TWS_BenchmarkUI.showPanel();
  
  document.body.appendChild(btn);
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addBenchmarkButton);
} else {
  addBenchmarkButton();
}

console.log('🎯 Painel de Benchmark carregado! Use o botão 🧪 Otimizar para abrir.');
