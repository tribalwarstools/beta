// === SISTEMA COMPLETO DE BENCHMARK - DADOS FICTÍCIOS ===

// 1. PRIMEIRO: Engine de Testes
const TWS_BenchmarkEngine = {
  isTesting: false,
  currentTest: null,
  testQueue: [],
  results: [],
  
  async startBenchmark(configs, profileName) {
    if (this.isTesting) {
      alert('Já existe um teste em andamento!');
      return;
    }
    
    this.isTesting = true;
    this.testQueue = [...configs];
    this.results = [];
    
    // Usar a UI se estiver disponível
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.updateTestStatus(`🧪 Iniciando ${profileName}...`, 0);
      window.TWS_BenchmarkUI.toggleStopButton(true);
    }
    
    let completed = 0;
    const total = configs.length;
    
    for (const config of configs) {
      if (!this.isTesting) break;
      
      const progress = (completed / total) * 100;
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.updateTestStatus(
          `Testando: ${config.name} (${completed + 1}/${total})`, 
          progress
        );
        this.updateLiveStats(config);
        this.updateLiveResults();
      }
      
      const result = await this.runSingleTest(config);
      this.results.push(result);
      completed++;
      
      await this.sleep(1000);
    }
    
    this.isTesting = false;
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.toggleStopButton(false);
    }
    
    if (completed === total) {
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.updateTestStatus('✅ Benchmark concluído!', 100);
        this.showFinalResults();
      }
    } else {
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.updateTestStatus('⏹️ Benchmark interrompido', progress);
      }
    }
  },
  
  async runSingleTest(testConfig) {
    const startTime = Date.now();
    const testResults = [];
    
    for (let i = 0; i < 5; i++) {
      if (!this.isTesting) break;
      const attackResult = await this.simulateAttack(testConfig);
      testResults.push(attackResult);
      await this.sleep(200);
    }
    
    const successCount = testResults.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;
    const avgResponseTime = testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length;
    
    return {
      config: testConfig,
      metrics: {
        totalAttacks: testResults.length,
        successfulAttacks: successCount,
        failedAttacks: testResults.length - successCount,
        successRate: (successCount / testResults.length) * 100,
        avgResponseTime: avgResponseTime,
        totalTime: totalTime,
        performanceScore: this.calculatePerformanceScore(successCount, testResults.length, avgResponseTime)
      },
      individualResults: testResults
    };
  },
  
  async simulateAttack(testConfig) {
    const startTime = Date.now();
    const successProbability = this.calculateSuccessProbability(testConfig);
    const expectedLatency = this.calculateExpectedLatency(testConfig);
    const latencyVariation = Math.random() * 1000;
    const totalLatency = expectedLatency + latencyVariation;
    
    await this.sleep(totalLatency);
    
    const random = Math.random();
    const success = random < successProbability;
    const responseTime = Date.now() - startTime;
    
    if (!success) {
      const errorTypes = [
        'Timeout: signal is aborted without reason',
        'Network error: Failed to fetch',
        'Server error: HTTP 500',
        'Troops not available'
      ];
      const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      return {
        success: false,
        responseTime: responseTime,
        error: randomError,
        config: testConfig
      };
    }
    
    return {
      success: true,
      responseTime: responseTime,
      error: null,
      config: testConfig
    };
  },
  
  calculateSuccessProbability(testConfig) {
    let baseProbability = 0.8;
    if (testConfig.ATTACK_TIMEOUT >= 8000) baseProbability += 0.15;
    if (testConfig.retries >= 2) baseProbability += 0.10;
    if (testConfig.schedulerInterval >= 500) baseProbability += 0.05;
    return Math.min(baseProbability, 0.95);
  },
  
  calculateExpectedLatency(testConfig) {
    let baseLatency = 1000;
    if (testConfig.schedulerInterval <= 100) baseLatency -= 300;
    if (testConfig.ATTACK_TIMEOUT <= 3000) baseLatency -= 200;
    return Math.max(baseLatency, 300);
  },
  
  calculatePerformanceScore(successCount, totalAttacks, avgResponseTime) {
    const successRate = (successCount / totalAttacks) * 100;
    const speedScore = Math.max(0, 100 - (avgResponseTime / 20));
    return Math.round((successRate * 0.6) + (speedScore * 0.4));
  },
  
  updateLiveStats(currentConfig) {
    const successEl = document.getElementById('live-success');
    const responseEl = document.getElementById('live-response');
    const precisionEl = document.getElementById('live-precision');
    const scoreEl = document.getElementById('live-score');
    
    if (successEl) {
      const successRate = this.calculateSuccessProbability(currentConfig) * 100;
      successEl.textContent = `${successRate.toFixed(0)}%`;
    }
    
    if (responseEl) {
      const responseTime = this.calculateExpectedLatency(currentConfig);
      responseEl.textContent = `${responseTime}ms`;
    }
    
    if (precisionEl) {
      const precision = Math.ceil((currentConfig.schedulerInterval || 1000) / 2);
      precisionEl.textContent = `±${precision}ms`;
    }
    
    if (scoreEl) {
      const estimatedScore = this.calculatePerformanceScore(4, 5, this.calculateExpectedLatency(currentConfig));
      scoreEl.textContent = estimatedScore;
    }
  },
  
  updateLiveResults() {
    const container = document.getElementById('live-results');
    if (!container) return;
    
    if (this.results.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #718096;">
          Executando testes... Resultados aparecerão aqui em tempo real.
        </div>
      `;
      return;
    }
    
    const latestResults = this.results.slice(-3);
    container.innerHTML = latestResults.map(result => `
      <div class="result-card">
        <div style="font-weight: bold; margin-bottom: 5px;">${result.config.name}</div>
        <div style="color: ${result.metrics.successRate >= 80 ? '#48BB78' : '#F56565'}; font-size: 18px;">
          ${result.metrics.successRate.toFixed(0)}%
        </div>
        <div style="font-size: 12px; color: #718096;">
          ${result.metrics.avgResponseTime.toFixed(0)}ms
        </div>
      </div>
    `).join('');
  },
  
  showFinalResults() {
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.switchTab('results');
    }
    
    const container = document.getElementById('results-container');
    const bestResult = this.findBestResult();
    
    if (container) {
      container.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #48BB78;">
          <h3 style="margin-top: 0; color: #48BB78;">🏆 CONFIGURAÇÃO RECOMENDADA</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <h4>Parâmetros Otimizados:</h4>
              <pre style="background: #F7FAFC; padding: 10px; border-radius: 4px; font-size: 12px;">${JSON.stringify(bestResult.config, null, 2)}</pre>
            </div>
            <div>
              <h4>Métricas:</h4>
              <div style="font-size: 14px;">
                <div>✅ Taxa de Sucesso: <strong>${bestResult.metrics.successRate.toFixed(1)}%</strong></div>
                <div>⏱️ Tempo Médio: <strong>${bestResult.metrics.avgResponseTime.toFixed(0)}ms</strong></div>
                <div>🎯 Precisão: <strong>±${Math.ceil((bestResult.config.schedulerInterval || 1000) / 2)}ms</strong></div>
                <div>🚀 Pontuação: <strong>${bestResult.metrics.performanceScore}/100</strong></div>
              </div>
            </div>
          </div>
        </div>
        
        <h3>📊 Todos os Resultados</h3>
        <div class="config-grid">
          ${this.results.map(result => `
            <div class="result-card" style="text-align: left;">
              <h4 style="margin: 0 0 10px 0;">${result.config.name}</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
                <div>Timeout:</div><div>${result.config.ATTACK_TIMEOUT}ms</div>
                <div>Retries:</div><div>${result.config.retries}</div>
                <div>Interval:</div><div>${result.config.schedulerInterval}ms</div>
                <div>Sucesso:</div><div style="color: ${result.metrics.successRate >= 80 ? '#48BB78' : '#F56565'}">${result.metrics.successRate.toFixed(1)}%</div>
                <div>Tempo:</div><div>${result.metrics.avgResponseTime.toFixed(0)}ms</div>
                <div>Score:</div><div><strong>${result.metrics.performanceScore}</strong></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.toggleApplyButton(true, bestResult.config);
    }
  },
  
  findBestResult() {
    return this.results.reduce((best, current) => {
      return current.metrics.performanceScore > best.metrics.performanceScore ? current : best;
    }, this.results[0]);
  },
  
  stopAllTests() {
    this.isTesting = false;
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.updateTestStatus('⏹️ Parando testes...', 0);
    }
  },
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// 2. SEGUNDO: Interface Visual
const TWS_BenchmarkUI = {
  isOpen: false,
  panel: null,
  selectedProfile: null,
  
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
    // Event listeners serão adicionados aqui se necessário
  },

  switchTab(tabName) {
    document.querySelectorAll('.benchmark-tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.benchmark-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelector(`.benchmark-tab[onclick="TWS_BenchmarkUI.switchTab('${tabName}')"]`).classList.add('active');
  },

  selectProfile(profileKey) {
    document.querySelectorAll('.config-card').forEach(card => {
      card.classList.remove('selected');
    });
    
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
    
    // Usar a engine para executar o benchmark
    if (window.TWS_BenchmarkEngine) {
      window.TWS_BenchmarkEngine.startBenchmark(profile.configs, profile.name);
    } else {
      alert('Engine de testes não carregada!');
    }
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
    
    if (window.TWS_BenchmarkEngine) {
      window.TWS_BenchmarkEngine.startBenchmark(configs, 'Teste Personalizado');
    } else {
      alert('Engine de testes não carregada!');
    }
  },

  updateCustomConfigForm() {
    // Pode ser usado para preencher com configurações atuais
  },

  updateTestStatus(message, progress) {
    const statusEl = document.getElementById('test-status');
    const progressBar = document.getElementById('test-progress-bar');
    
    if (statusEl) statusEl.textContent = message;
    if (progressBar) progressBar.style.width = `${progress}%`;
  },

  toggleStopButton(enabled) {
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.disabled = !enabled;
    }
  },

  toggleApplyButton(enabled, bestConfig) {
    const applyBtn = document.getElementById('apply-btn');
    if (applyBtn) {
      applyBtn.disabled = !enabled;
      if (enabled) {
        applyBtn.onclick = () => this.applyBestConfiguration(bestConfig);
      }
    }
  },

  stopAllTests() {
    if (window.TWS_BenchmarkEngine) {
      window.TWS_BenchmarkEngine.stopAllTests();
    }
  },

  applyBestConfiguration(bestConfig) {
    if (bestConfig) {
      console.log('✅ Aplicando configuração otimizada:', bestConfig);
      alert(`🎯 Configuração otimizada aplicada!\n\n• Timeout: ${bestConfig.ATTACK_TIMEOUT}ms\n• Retries: ${bestConfig.retries}\n• Interval: ${bestConfig.schedulerInterval}ms`);
      this.closePanel();
    }
  },

  applyBestConfig() {
    // Método para o botão genérico
    alert('Execute um benchmark primeiro para encontrar a melhor configuração!');
  },

  closePanel() {
    const overlay = document.getElementById('tws-benchmark-overlay');
    if (overlay) {
      overlay.remove();
    }
    this.isOpen = false;
  }
};

// 3. TERCEIRO: Integração e Inicialização
window.TWS_BenchmarkEngine = TWS_BenchmarkEngine;
window.TWS_BenchmarkUI = TWS_BenchmarkUI;

// Função para adicionar o botão na interface
function addBenchmarkButton() {
  if (document.getElementById('tws-benchmark-btn')) return;
  
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
  
  btn.onclick = () => {
    if (window.TWS_BenchmarkUI) {
      window.TWS_BenchmarkUI.showPanel();
    } else {
      alert('Sistema de benchmark não carregado!');
    }
  };
  
  document.body.appendChild(btn);
  console.log('✅ Botão de Benchmark adicionado!');
}

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addBenchmarkButton);
} else {
  addBenchmarkButton();
}

console.log('🚀 Sistema de Benchmark carregado com sucesso!');
console.log('🎯 Use o botão "🧪 Otimizar" para abrir o painel.');
