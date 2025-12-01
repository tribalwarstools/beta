// ═══════════════════════════════════════════════════════════════
// 🔗 TWS BENCHMARK - INTEGRAÇÃO COM BACKEND REAL
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const TWS_BenchmarkBackendAdapter = {
    
    isBackendAvailable: function() {
      return !!(window.TWS_Backend && 
                window.TWS_Backend.executeAttack && 
                window.TWS_Backend.getList);
    },
    
    createTestAttack: async function(config) {
      if (!this.isBackendAvailable()) {
        throw new Error('Backend TWS não disponível');
      }
      
      const backend = window.TWS_Backend;
      
      // DEBUG: Ver estrutura do backend
      console.log('[DEBUG] Backend._internal:', backend._internal);
      console.log('[DEBUG] Chaves disponíveis:', Object.keys(backend._internal || {}));
      
      // Tentar múltiplas formas de acessar aldeias
      let myVillages = [];
      
      // Método 1: _internal.myVillages
      if (backend._internal && backend._internal.myVillages) {
        myVillages = backend._internal.myVillages;
        console.log('[DEBUG] Aldeias via _internal.myVillages:', myVillages.length);
      }
      
      // Método 2: Chamar loadVillageTxt() se disponível
      if (myVillages.length === 0 && backend.loadVillageTxt) {
        console.log('[DEBUG] Tentando loadVillageTxt()...');
        try {
          const data = await backend.loadVillageTxt();
          myVillages = data.myVillages || [];
          console.log('[DEBUG] Aldeias via loadVillageTxt():', myVillages.length);
        } catch (e) {
          console.error('[DEBUG] Erro ao carregar aldeias:', e);
        }
      }
      
      // Método 3: Verificar se já foram carregadas
      if (myVillages.length === 0 && backend._internal) {
        const internal = backend._internal;
        if (typeof internal.myVillages === 'function') {
          myVillages = internal.myVillages();
          console.log('[DEBUG] Aldeias via função:', myVillages.length);
        }
      }
      
      if (myVillages.length === 0) {
        throw new Error('Nenhuma aldeia própria encontrada. Execute primeiro: TWS_Backend.loadVillageTxt()');
      }
      
      console.log('[DEBUG] Aldeias disponíveis:', myVillages.length);
      
      const sourceVillage = myVillages[0];
      const coords = sourceVillage.coord.split('|').map(Number);
      const x = coords[0];
      const y = coords[1];
      const testTarget = (x + 1) + '|' + (y + 1);
      
      const testAttack = {
        _id: backend.generateUniqueId(),
        origem: sourceVillage.coord,
        origemId: sourceVillage.id,
        alvo: testTarget,
        datetime: new Date(Date.now() + 2000).toLocaleString('pt-BR').replace(',', ''),
        done: false,
        locked: false,
        status: 'test',
        statusText: 'Teste de Benchmark',
        spear: 1,
        sword: 0,
        axe: 0,
        archer: 0,
        spy: 0,
        light: 0,
        marcher: 0,
        heavy: 0,
        ram: 0,
        catapult: 0,
        knight: 0,
        snob: 0
      };
      
      return testAttack;
    },
    
    applyTempConfig: function(config) {
      if (!window._TWS_OriginalConfig) {
        window._TWS_OriginalConfig = this.getCurrentConfig();
      }
      
      const globalConfig = this.getGlobalConfig();
      globalConfig.behavior.schedulerCheckInterval = config.schedulerInterval || 100;
      globalConfig.behavior.retryOnFail = config.retries > 0;
      globalConfig.behavior.maxRetries = config.retries || 1;
      
      localStorage.setItem('tws_global_config_v2', JSON.stringify(globalConfig));
      console.log('[Benchmark] Config temporária aplicada:', config);
    },
    
    restoreOriginalConfig: function() {
      if (window._TWS_OriginalConfig) {
        localStorage.setItem('tws_global_config_v2', JSON.stringify(window._TWS_OriginalConfig));
        delete window._TWS_OriginalConfig;
        console.log('[Benchmark] Config original restaurada');
      }
    },
    
    getCurrentConfig: function() {
      try {
        return JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
      } catch (e) {
        return {};
      }
    },
    
    getGlobalConfig: function() {
      try {
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        return {
          behavior: {
            schedulerCheckInterval: 100,
            retryOnFail: true,
            maxRetries: 2
          }
        };
      } catch (e) {
        return {
          behavior: {
            schedulerCheckInterval: 100,
            retryOnFail: true,
            maxRetries: 2
          }
        };
      }
    }
  };

  const TWS_RealBenchmarkEngine = {
    isTesting: false,
    currentTest: null,
    testQueue: [],
    results: [],
    
    startRealBenchmark: async function(configs, profileName) {
      if (this.isTesting) {
        alert('Já existe um teste em andamento!');
        return;
      }
      
      if (!TWS_BenchmarkBackendAdapter.isBackendAvailable()) {
        alert('Backend TWS não disponível!');
        return;
      }
      
      const confirmMsg = 'TESTE REAL\n\n' +
                        'Isso executará ' + configs.length + ' ataques REAIS!\n\n' +
                        '• Aldeias: Suas aldeias reais\n' +
                        '• Tropas: 1 lanceiro por teste\n' +
                        '• Alvos: Coordenadas próximas\n\n' +
                        'Continuar?';
      
      if (!window.confirm(confirmMsg)) return;
      
      this.isTesting = true;
      this.testQueue = configs.slice();
      this.results = [];
      
      console.log('[Benchmark] Iniciando ' + profileName + ' (REAL)...');
      
      let completed = 0;
      const total = configs.length;
      
      for (let i = 0; i < configs.length; i++) {
        if (!this.isTesting) break;
        
        const config = configs[i];
        console.log('[Benchmark] Testando: ' + config.name + ' (' + (completed + 1) + '/' + total + ')');
        
        const result = await this.runRealTest(config);
        this.results.push(result);
        completed++;
        
        await this.sleep(3000);
      }
      
      TWS_BenchmarkBackendAdapter.restoreOriginalConfig();
      this.isTesting = false;
      
      if (completed === total) {
        console.log('[Benchmark] Concluído!');
        this.showRealResults();
      } else {
        console.log('[Benchmark] Interrompido');
      }
    },
    
    runRealTest: async function(testConfig) {
      const backend = window.TWS_Backend;
      const startTime = Date.now();
      const testResults = [];
      
      TWS_BenchmarkBackendAdapter.applyTempConfig(testConfig);
      await this.sleep(500);
      
      for (let i = 0; i < 3; i++) {
        if (!this.isTesting) break;
        
        try {
          const testAttack = await TWS_BenchmarkBackendAdapter.createTestAttack(testConfig);
          const attackStartTime = Date.now();
          
          console.log('[Benchmark Real] Executando ataque ' + (i+1) + '/3');
          
          const success = await backend.executeAttack(testAttack);
          const responseTime = Date.now() - attackStartTime;
          
          testResults.push({
            success: success,
            responseTime: responseTime,
            executionTime: testAttack.executionDuration || responseTime,
            actualTime: testAttack.actualExecutionTime,
            error: success ? null : 'Falha na execução',
            config: testConfig
          });
          
          console.log('[Benchmark Real] Resultado: ' + (success ? 'OK' : 'FALHA') + ' (' + responseTime + 'ms)');
          
        } catch (err) {
          testResults.push({
            success: false,
            responseTime: Date.now() - startTime,
            error: err.message,
            config: testConfig
          });
          
          console.error('[Benchmark Real] Erro:', err);
        }
        
        await this.sleep(1000);
      }
      
      const successCount = testResults.filter(function(r) { return r.success; }).length;
      const totalTime = Date.now() - startTime;
      
      let totalResponseTime = 0;
      for (let i = 0; i < testResults.length; i++) {
        totalResponseTime += testResults[i].responseTime;
      }
      const avgResponseTime = totalResponseTime / testResults.length;
      
      const execTimes = testResults.filter(function(r) { return r.executionTime; });
      let totalExecTime = 0;
      for (let i = 0; i < execTimes.length; i++) {
        totalExecTime += execTimes[i].executionTime;
      }
      const avgExecutionTime = execTimes.length > 0 ? totalExecTime / execTimes.length : avgResponseTime;
      
      return {
        config: testConfig,
        metrics: {
          totalAttacks: testResults.length,
          successfulAttacks: successCount,
          failedAttacks: testResults.length - successCount,
          successRate: (successCount / testResults.length) * 100,
          avgResponseTime: Math.round(avgResponseTime),
          avgExecutionTime: Math.round(avgExecutionTime),
          totalTime: totalTime,
          performanceScore: this.calculatePerformanceScore(successCount, testResults.length, avgResponseTime),
          realData: true
        },
        individualResults: testResults
      };
    },
    
    calculatePerformanceScore: function(successCount, totalAttacks, avgResponseTime) {
      const successRate = (successCount / totalAttacks) * 100;
      const speedScore = Math.max(0, 100 - (avgResponseTime / 30));
      return Math.round((successRate * 0.7) + (speedScore * 0.3));
    },
    
    showRealResults: function() {
      console.log('\n========================================');
      console.log('RESULTADOS DO BENCHMARK REAL');
      console.log('========================================\n');
      
      const best = this.findBestResult();
      
      console.log('MELHOR CONFIGURAÇÃO:');
      console.log('Nome:', best.config.name);
      console.log('Interval:', best.config.schedulerInterval, 'ms');
      console.log('Retries:', best.config.retries);
      console.log('Timeout:', best.config.ATTACK_TIMEOUT, 'ms');
      console.log('Taxa de Sucesso:', best.metrics.successRate.toFixed(1) + '%');
      console.log('Tempo Médio:', best.metrics.avgResponseTime, 'ms');
      console.log('Exec. Média:', best.metrics.avgExecutionTime, 'ms');
      console.log('Score:', best.metrics.performanceScore, '/100\n');
      
      console.log('TODOS OS RESULTADOS:');
      console.table(this.results.map(function(r) {
        return {
          Nome: r.config.name,
          Interval: r.config.schedulerInterval + 'ms',
          Retries: r.config.retries,
          Sucesso: r.metrics.successRate.toFixed(1) + '%',
          Tempo: r.metrics.avgResponseTime + 'ms',
          Exec: r.metrics.avgExecutionTime + 'ms',
          Score: r.metrics.performanceScore
        };
      }));
      
      alert('BENCHMARK CONCLUÍDO!\n\n' +
            'Melhor: ' + best.config.name + '\n' +
            'Sucesso: ' + best.metrics.successRate.toFixed(1) + '%\n' +
            'Tempo: ' + best.metrics.avgResponseTime + 'ms\n' +
            'Score: ' + best.metrics.performanceScore + '/100\n\n' +
            'Ver console para detalhes.');
    },
    
    findBestResult: function() {
      let best = this.results[0];
      for (let i = 1; i < this.results.length; i++) {
        const current = this.results[i];
        const bestScore = best.metrics.successRate * 0.7 + best.metrics.performanceScore * 0.3;
        const currentScore = current.metrics.successRate * 0.7 + current.metrics.performanceScore * 0.3;
        if (currentScore > bestScore) {
          best = current;
        }
      }
      return best;
    },
    
    stopAllTests: function() {
      this.isTesting = false;
      TWS_BenchmarkBackendAdapter.restoreOriginalConfig();
      console.log('[Benchmark] Testes interrompidos');
    },
    
    sleep: function(ms) {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    }
  };

  window.TWS_BenchmarkBackendAdapter = TWS_BenchmarkBackendAdapter;
  window.TWS_RealBenchmarkEngine = TWS_RealBenchmarkEngine;
  
  console.log('Benchmark Real carregado!');
  
  if (TWS_BenchmarkBackendAdapter.isBackendAvailable()) {
    console.log('Backend TWS detectado!');
  } else {
    console.warn('Backend TWS não detectado');
  }

})();

// ═══════════════════════════════════════════════════════════════
// 🎨 TWS BENCHMARK - INTERFACE GRÁFICA COMPLETA
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const TWS_BenchmarkUI = {
    isOpen: false,
    selectedProfile: null,
    
    // Perfis de teste predefinidos
    testProfiles: {
      rapido: {
        name: "⚡ Máxima Velocidade",
        description: "Foco em timing preciso (±25-50ms)",
        configs: [
          { name: "Ultra Rápido", schedulerInterval: 50, retries: 1, ATTACK_TIMEOUT: 3000 },
          { name: "Muito Rápido", schedulerInterval: 100, retries: 1, ATTACK_TIMEOUT: 3000 },
          { name: "Rápido", schedulerInterval: 100, retries: 2, ATTACK_TIMEOUT: 4000 }
        ]
      },
      balanceado: {
        name: "⭐ Balanceado",
        description: "Equilíbrio entre velocidade e confiabilidade",
        configs: [
          { name: "Balanceado 1", schedulerInterval: 100, retries: 2, ATTACK_TIMEOUT: 5000 },
          { name: "Balanceado 2", schedulerInterval: 250, retries: 2, ATTACK_TIMEOUT: 5000 },
          { name: "Balanceado 3", schedulerInterval: 250, retries: 1, ATTACK_TIMEOUT: 4000 }
        ]
      },
      estavel: {
        name: "🛡️ Máxima Estabilidade",
        description: "Foco em confiabilidade e tolerância a falhas",
        configs: [
          { name: "Estável 1", schedulerInterval: 500, retries: 2, ATTACK_TIMEOUT: 5000 },
          { name: "Estável 2", schedulerInterval: 500, retries: 3, ATTACK_TIMEOUT: 8000 },
          { name: "Estável 3", schedulerInterval: 1000, retries: 2, ATTACK_TIMEOUT: 5000 }
        ]
      }
    },

    // Criar e mostrar painel
    showPanel: function() {
      if (this.isOpen) return;
      
      const overlay = document.createElement('div');
      overlay.id = 'tws-benchmark-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;justify-content:center;align-items:center;';
      
      const panel = document.createElement('div');
      panel.id = 'tws-benchmark-panel';
      panel.style.cssText = 'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;width:90%;max-width:1000px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
      
      panel.innerHTML = this.getPanelHTML();
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      
      this.isOpen = true;
      this.attachEventListeners();
      
      // Fechar ao clicar fora
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          TWS_BenchmarkUI.closePanel();
        }
      });
    },

    // HTML do painel
    getPanelHTML: function() {
      return `
        <style>
          #tws-benchmark-panel * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .bench-header { background: rgba(0,0,0,0.3); padding: 25px; text-align: center; border-radius: 16px 16px 0 0; }
          .bench-title { font-size: 28px; font-weight: bold; color: white; margin: 0 0 8px 0; }
          .bench-subtitle { color: rgba(255,255,255,0.8); font-size: 14px; }
          .bench-content { padding: 30px; background: #f7fafc; border-radius: 0 0 16px 16px; }
          .bench-tabs { display: flex; gap: 10px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; }
          .bench-tab { padding: 12px 24px; background: none; border: none; color: #4a5568; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; }
          .bench-tab:hover { background: rgba(102,126,234,0.1); }
          .bench-tab.active { color: #667eea; border-bottom-color: #667eea; }
          .bench-tab-content { display: none; }
          .bench-tab-content.active { display: block; }
          .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 20px 0; }
          .profile-card { background: white; border-radius: 12px; padding: 20px; cursor: pointer; border: 3px solid transparent; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .profile-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
          .profile-card.selected { border-color: #48bb78; background: #f0fff4; }
          .profile-card h3 { margin: 0 0 8px 0; font-size: 18px; color: #2d3748; }
          .profile-card p { margin: 0; font-size: 13px; color: #718096; line-height: 1.5; }
          .profile-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-top: 10px; }
          .badge-fast { background: #fed7d7; color: #c53030; }
          .badge-balanced { background: #bee3f8; color: #2c5282; }
          .badge-stable { background: #c6f6d5; color: #22543d; }
          .bench-actions { display: flex; gap: 15px; justify-content: center; margin-top: 25px; }
          .bench-btn { padding: 14px 28px; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; transition: all 0.3s; }
          .bench-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
          .btn-primary { background: #667eea; color: white; }
          .btn-success { background: #48bb78; color: white; }
          .btn-danger { background: #f56565; color: white; }
          .btn-secondary { background: #718096; color: white; }
          .btn-warning { background: #ed8936; color: white; }
          .bench-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .progress-section { margin: 25px 0; }
          .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 10px 0; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #48bb78, #38a169); transition: width 0.5s; }
          .status-text { text-align: center; color: #4a5568; font-size: 14px; margin: 10px 0; }
          .results-container { margin-top: 20px; }
          .result-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .result-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; }
          .badge-real { background: #ed8936; color: white; }
          .result-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
          .metric-item { text-align: center; }
          .metric-label { font-size: 12px; color: #718096; margin-bottom: 4px; }
          .metric-value { font-size: 20px; font-weight: bold; color: #2d3748; }
          .metric-success { color: #48bb78; }
          .metric-warning { color: #ed8936; }
          .metric-danger { color: #f56565; }
          .custom-form { background: white; border-radius: 12px; padding: 25px; margin-top: 20px; }
          .form-group { margin-bottom: 20px; }
          .form-label { display: block; font-weight: 600; color: #2d3748; margin-bottom: 8px; font-size: 14px; }
          .form-input { width: 100%; padding: 10px 15px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; transition: all 0.3s; }
          .form-input:focus { outline: none; border-color: #667eea; }
          .form-help { font-size: 12px; color: #718096; margin-top: 5px; }
          .info-box { background: #edf2f7; border-left: 4px solid #667eea; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .info-box strong { color: #2d3748; }
        </style>

        <div class="bench-header">
          <div class="bench-title">🧪 Otimizador de Performance</div>
          <div class="bench-subtitle">Encontre a configuração perfeita para seu ambiente</div>
        </div>

        <div class="bench-content">
          
          <!-- ABAS -->
          <div class="bench-tabs">
            <button class="bench-tab active" data-tab="profiles">📊 Perfis</button>
            <button class="bench-tab" data-tab="custom">🎛️ Personalizado</button>
            <button class="bench-tab" data-tab="results">📈 Resultados</button>
          </div>

          <!-- ABA: PERFIS -->
          <div class="bench-tab-content active" data-content="profiles">
            <div class="info-box">
              <strong>💡 Como funciona:</strong> Escolha um perfil abaixo e execute o teste. 
              O sistema testará 3 configurações diferentes e recomendará a melhor para você.
            </div>

            <div class="profile-grid">
              <div class="profile-card" data-profile="rapido">
                <h3>⚡ Máxima Velocidade</h3>
                <p>Ideal para ataques que exigem timing preciso. Checa o scheduler a cada 50-100ms para máxima precisão.</p>
                <span class="profile-badge badge-fast">Precisão: ±25-50ms</span>
              </div>

              <div class="profile-card" data-profile="balanceado">
                <h3>⭐ Balanceado</h3>
                <p>Equilíbrio perfeito entre velocidade e confiabilidade. Recomendado para a maioria dos casos.</p>
                <span class="profile-badge badge-balanced">Precisão: ±50-125ms</span>
              </div>

              <div class="profile-card" data-profile="estavel">
                <h3>🛡️ Máxima Estabilidade</h3>
                <p>Foco em confiabilidade máxima. Ideal para conexões instáveis ou quando segurança é prioridade.</p>
                <span class="profile-badge badge-stable">Precisão: ±250-500ms</span>
              </div>
            </div>

            <div class="bench-actions">
              <button class="bench-btn btn-success" id="start-real-btn" disabled>
                🔥 Executar Benchmark REAL
              </button>
            </div>

            <div class="info-box" style="margin-top: 20px;">
              <strong>⚠️ Atenção:</strong> O benchmark REAL executará ataques verdadeiros usando 1 lanceiro por teste (3 por configuração). 
              Os resultados refletem o comportamento real do sistema no seu ambiente.
            </div>
          </div>

          <!-- ABA: PERSONALIZADO -->
          <div class="bench-tab-content" data-content="custom">
            <div class="custom-form">
              <h3 style="margin-top: 0;">🎛️ Criar Teste Personalizado</h3>
              
              <div class="form-group">
                <label class="form-label">Intervalo do Scheduler (ms)</label>
                <input type="number" class="form-input" id="custom-interval" value="100" min="50" max="5000">
                <div class="form-help">Frequência de checagem. Menor = mais preciso, maior = menos CPU</div>
              </div>

              <div class="form-group">
                <label class="form-label">Número de Retries</label>
                <input type="number" class="form-input" id="custom-retries" value="2" min="0" max="5">
                <div class="form-help">Quantas vezes tentar novamente em caso de falha</div>
              </div>

              <div class="form-group">
                <label class="form-label">Timeout do Ataque (ms)</label>
                <input type="number" class="form-input" id="custom-timeout" value="5000" min="1000" max="15000">
                <div class="form-help">Tempo máximo para aguardar resposta do servidor</div>
              </div>

              <div class="form-group">
                <label class="form-label">Número de Ataques de Teste</label>
                <input type="number" class="form-input" id="custom-tests" value="3" min="1" max="5">
                <div class="form-help">Quantos ataques executar para coletar métricas</div>
              </div>

              <div class="bench-actions">
                <button class="bench-btn btn-warning" id="start-custom-btn">
                  🔬 Executar Teste Personalizado
                </button>
              </div>
            </div>
          </div>

          <!-- ABA: RESULTADOS -->
          <div class="bench-tab-content" data-content="results">
            <div id="results-display">
              <div style="text-align: center; padding: 60px 20px; color: #718096;">
                <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                <div style="font-size: 16px; font-weight: 600;">Nenhum teste executado ainda</div>
                <div style="font-size: 14px; margin-top: 8px;">Execute um benchmark para ver os resultados aqui</div>
              </div>
            </div>

            <div class="progress-section" id="progress-section" style="display: none;">
              <div class="status-text" id="status-text">Preparando teste...</div>
              <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
              </div>
            </div>
          </div>

          <!-- RODAPÉ -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <button class="bench-btn btn-secondary" id="close-btn">❌ Fechar</button>
            <div style="display: flex; gap: 10px;">
              <button class="bench-btn btn-danger" id="stop-btn" style="display: none;">⏹️ Parar Testes</button>
              <button class="bench-btn btn-primary" id="apply-btn" style="display: none;">✅ Aplicar Configuração</button>
            </div>
          </div>

        </div>
      `;
    },

    // Anexar event listeners
    attachEventListeners: function() {
      const self = this;
      
      // Abas
      document.querySelectorAll('.bench-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          const tabName = this.getAttribute('data-tab');
          self.switchTab(tabName);
        });
      });

      // Seleção de perfil
      document.querySelectorAll('.profile-card').forEach(function(card) {
        card.addEventListener('click', function() {
          const profile = this.getAttribute('data-profile');
          self.selectProfile(profile);
        });
      });

      // Botões
      document.getElementById('start-real-btn').addEventListener('click', function() {
        self.startRealBenchmark();
      });

      document.getElementById('start-custom-btn').addEventListener('click', function() {
        self.startCustomBenchmark();
      });

      document.getElementById('close-btn').addEventListener('click', function() {
        self.closePanel();
      });

      document.getElementById('stop-btn').addEventListener('click', function() {
        self.stopBenchmark();
      });

      document.getElementById('apply-btn').addEventListener('click', function() {
        self.applyBestConfig();
      });
    },

    // Trocar aba
    switchTab: function(tabName) {
      document.querySelectorAll('.bench-tab').forEach(function(tab) {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.bench-tab-content').forEach(function(content) {
        content.classList.remove('active');
      });

      document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
      document.querySelector('[data-content="' + tabName + '"]').classList.add('active');
    },

    // Selecionar perfil
    selectProfile: function(profileKey) {
      document.querySelectorAll('.profile-card').forEach(function(card) {
        card.classList.remove('selected');
      });

      document.querySelector('[data-profile="' + profileKey + '"]').classList.add('selected');
      this.selectedProfile = profileKey;

      document.getElementById('start-real-btn').disabled = false;
    },

    // Iniciar benchmark real
    startRealBenchmark: async function() {
      if (!this.selectedProfile) {
        alert('Selecione um perfil primeiro!');
        return;
      }

      const profile = this.testProfiles[this.selectedProfile];
      this.switchTab('results');
      
      const progressSection = document.getElementById('progress-section');
      const statusText = document.getElementById('status-text');
      const progressFill = document.getElementById('progress-fill');
      const resultsDisplay = document.getElementById('results-display');
      const stopBtn = document.getElementById('stop-btn');
      const applyBtn = document.getElementById('apply-btn');
      
      // Mostrar progress
      progressSection.style.display = 'block';
      stopBtn.style.display = 'block';
      resultsDisplay.innerHTML = '';
      
      if (!window.TWS_RealBenchmarkEngine) {
        alert('Engine de benchmark não carregada!');
        return;
      }

      if (!window.TWS_Backend) {
        alert('Backend TWS não carregado!');
        return;
      }

      // Carregar aldeias
      statusText.textContent = 'Carregando aldeias...';
      progressFill.style.width = '10%';
      
      try {
        await window.TWS_Backend.loadVillageTxt();
        
        statusText.textContent = 'Iniciando benchmark...';
        progressFill.style.width = '20%';
        
        // Iniciar benchmark
        const totalConfigs = profile.configs.length;
        let currentConfig = 0;
        
        // Monitorar progresso
        const progressInterval = setInterval(function() {
          if (window.TWS_RealBenchmarkEngine.isTesting) {
            const completed = window.TWS_RealBenchmarkEngine.results.length;
            const progress = 20 + (completed / totalConfigs) * 70;
            progressFill.style.width = progress + '%';
            statusText.textContent = 'Testando configuração ' + (completed + 1) + ' de ' + totalConfigs + '...';
          }
        }, 500);
        
        // Executar benchmark
        await window.TWS_RealBenchmarkEngine.startRealBenchmark(profile.configs, profile.name);
        
        // Limpar interval
        clearInterval(progressInterval);
        
        // Aguardar um pouco para garantir que finalizou
        setTimeout(function() {
          statusText.textContent = 'Processando resultados...';
          progressFill.style.width = '95%';
          
          setTimeout(function() {
            progressFill.style.width = '100%';
            statusText.textContent = 'Concluído!';
            
            // Exibir resultados
            TWS_BenchmarkUI.displayResults(window.TWS_RealBenchmarkEngine.results);
            
            // Esconder progress após 1s
            setTimeout(function() {
              progressSection.style.display = 'none';
              stopBtn.style.display = 'none';
              applyBtn.style.display = 'block';
            }, 1000);
          }, 500);
        }, 500);
        
      } catch (error) {
        console.error('Erro no benchmark:', error);
        statusText.textContent = 'Erro: ' + error.message;
        progressFill.style.width = '0%';
        alert('Erro ao executar benchmark: ' + error.message);
        stopBtn.style.display = 'none';
      }
    },

    // Iniciar benchmark personalizado
    startCustomBenchmark: async function() {
      const config = {
        name: 'Personalizado',
        schedulerInterval: parseInt(document.getElementById('custom-interval').value),
        retries: parseInt(document.getElementById('custom-retries').value),
        ATTACK_TIMEOUT: parseInt(document.getElementById('custom-timeout').value)
      };

      const testCount = parseInt(document.getElementById('custom-tests').value);
      const configs = [];
      for (let i = 0; i < testCount; i++) {
        configs.push(Object.assign({}, config, { name: 'Personalizado ' + (i+1) }));
      }

      this.switchTab('results');
      
      const progressSection = document.getElementById('progress-section');
      const statusText = document.getElementById('status-text');
      const progressFill = document.getElementById('progress-fill');
      const resultsDisplay = document.getElementById('results-display');
      const stopBtn = document.getElementById('stop-btn');
      const applyBtn = document.getElementById('apply-btn');
      
      progressSection.style.display = 'block';
      stopBtn.style.display = 'block';
      resultsDisplay.innerHTML = '';

      if (!window.TWS_RealBenchmarkEngine || !window.TWS_Backend) {
        alert('Sistema não carregado corretamente!');
        return;
      }

      statusText.textContent = 'Carregando aldeias...';
      progressFill.style.width = '10%';

      try {
        await window.TWS_Backend.loadVillageTxt();
        
        statusText.textContent = 'Iniciando teste personalizado...';
        progressFill.style.width = '20%';
        
        const totalConfigs = testCount;
        
        const progressInterval = setInterval(function() {
          if (window.TWS_RealBenchmarkEngine.isTesting) {
            const completed = window.TWS_RealBenchmarkEngine.results.length;
            const progress = 20 + (completed / totalConfigs) * 70;
            progressFill.style.width = progress + '%';
            statusText.textContent = 'Teste ' + (completed + 1) + ' de ' + totalConfigs + '...';
          }
        }, 500);

        await window.TWS_RealBenchmarkEngine.startRealBenchmark(configs, 'Teste Personalizado');
        
        clearInterval(progressInterval);
        
        setTimeout(function() {
          statusText.textContent = 'Processando resultados...';
          progressFill.style.width = '95%';
          
          setTimeout(function() {
            progressFill.style.width = '100%';
            statusText.textContent = 'Concluído!';
            
            TWS_BenchmarkUI.displayResults(window.TWS_RealBenchmarkEngine.results);
            
            setTimeout(function() {
              progressSection.style.display = 'none';
              stopBtn.style.display = 'none';
              applyBtn.style.display = 'block';
            }, 1000);
          }, 500);
        }, 500);
        
      } catch (error) {
        console.error('Erro:', error);
        statusText.textContent = 'Erro: ' + error.message;
        alert('Erro: ' + error.message);
        stopBtn.style.display = 'none';
      }
    },

    // Exibir resultados
    displayResults: function(results) {
      if (!results || results.length === 0) return;

      const best = results.reduce(function(best, curr) {
        const bestScore = best.metrics.successRate * 0.7 + best.metrics.performanceScore * 0.3;
        const currScore = curr.metrics.successRate * 0.7 + curr.metrics.performanceScore * 0.3;
        return currScore > bestScore ? curr : best;
      }, results[0]);

      let html = '<div class="result-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">';
      html += '<h3 style="margin: 0 0 15px 0; color: white;">🏆 CONFIGURAÇÃO RECOMENDADA</h3>';
      html += '<div class="result-metrics">';
      html += '<div class="metric-item"><div class="metric-label" style="color: rgba(255,255,255,0.8);">Taxa de Sucesso</div><div class="metric-value" style="color: white;">' + best.metrics.successRate.toFixed(1) + '%</div></div>';
      html += '<div class="metric-item"><div class="metric-label" style="color: rgba(255,255,255,0.8);">Tempo Médio</div><div class="metric-value" style="color: white;">' + best.metrics.avgResponseTime + 'ms</div></div>';
      html += '<div class="metric-item"><div class="metric-label" style="color: rgba(255,255,255,0.8);">Interval</div><div class="metric-value" style="color: white;">' + best.config.schedulerInterval + 'ms</div></div>';
      html += '<div class="metric-item"><div class="metric-label" style="color: rgba(255,255,255,0.8);">Score</div><div class="metric-value" style="color: white;">' + best.metrics.performanceScore + '/100</div></div>';
      html += '</div></div>';

      html += '<h3 style="margin-top: 30px; color: #2d3748;">📊 Todos os Resultados</h3>';

      results.forEach(function(result) {
        html += '<div class="result-card">';
        html += '<div class="result-header">';
        html += '<h4 style="margin: 0;">' + result.config.name + '</h4>';
        html += '<span class="result-badge badge-real">REAL</span>';
        html += '</div>';
        html += '<div class="result-metrics">';
        html += '<div class="metric-item"><div class="metric-label">Sucesso</div><div class="metric-value ' + (result.metrics.successRate >= 80 ? 'metric-success' : 'metric-warning') + '">' + result.metrics.successRate.toFixed(1) + '%</div></div>';
        html += '<div class="metric-item"><div class="metric-label">Tempo</div><div class="metric-value">' + result.metrics.avgResponseTime + 'ms</div></div>';
        html += '<div class="metric-item"><div class="metric-label">Interval</div><div class="metric-value">' + result.config.schedulerInterval + 'ms</div></div>';
        html += '<div class="metric-item"><div class="metric-label">Score</div><div class="metric-value">' + result.metrics.performanceScore + '</div></div>';
        html += '</div></div>';
      });

      document.getElementById('results-display').innerHTML = html;
      document.getElementById('progress-section').style.display = 'none';

      this.bestConfig = best.config;
    },

    // Aplicar melhor configuração
    applyBestConfig: function() {
      if (!this.bestConfig) {
        alert('Nenhuma configuração para aplicar!');
        return;
      }

      if (window.TWS_BenchmarkBackendAdapter) {
        TWS_BenchmarkBackendAdapter.applyTempConfig(this.bestConfig);
        
        const globalConfig = TWS_BenchmarkBackendAdapter.getGlobalConfig();
        localStorage.setItem('tws_global_config_v2', JSON.stringify(globalConfig));

        alert('CONFIGURAÇÃO APLICADA!\n\n' +
              'Interval: ' + this.bestConfig.schedulerInterval + 'ms\n' +
              'Retries: ' + this.bestConfig.retries + '\n' +
              'Timeout: ' + this.bestConfig.ATTACK_TIMEOUT + 'ms\n\n' +
              'A configuração foi salva permanentemente.');

        this.closePanel();
      }
    },

    // Parar benchmark
    stopBenchmark: function() {
      if (window.TWS_RealBenchmarkEngine) {
        window.TWS_RealBenchmarkEngine.stopAllTests();
        document.getElementById('stop-btn').style.display = 'none';
      }
    },

    // Fechar painel
    closePanel: function() {
      const overlay = document.getElementById('tws-benchmark-overlay');
      if (overlay) {
        overlay.remove();
      }
      this.isOpen = false;
    }
  };

  // Criar botão flutuante
  function createFloatingButton() {
    if (document.getElementById('tws-benchmark-float-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'tws-benchmark-float-btn';
    btn.innerHTML = '🧪';
    btn.title = 'Otimizador de Performance';
    btn.style.cssText = 'position:fixed;top:80px;right:20px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;transition:all 0.3s;';

    btn.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    });

    btn.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });

    btn.addEventListener('click', function() {
      TWS_BenchmarkUI.showPanel();
    });

    document.body.appendChild(btn);
  }

  // Inicializar
  window.TWS_BenchmarkUI = TWS_BenchmarkUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

  console.log('Interface do Benchmark carregada!');
  console.log('Clique no botão 🧪 para abrir o painel.');

})();
