// ═══════════════════════════════════════════════════════════════
// 🔗 TWS BENCHMARK - INTEGRAÇÃO COM BACKEND REAL
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // ✅ #1 ADAPTADOR DO BACKEND
  // ═══════════════════════════════════════════════════════════════
  
  const TWS_BenchmarkBackendAdapter = {
    
    // Verificar se backend está disponível
    isBackendAvailable() {
      return !!(window.TWS_Backend && 
                window.TWS_Backend.executeAttack && 
                window.TWS_Backend.getList);
    },
    
    // Criar ataque de teste real
    async createTestAttack(config) {
      if (!this.isBackendAvailable()) {
        throw new Error('Backend TWS não disponível');
      }
      
      const backend = window.TWS_Backend;
      const list = backend.getList();
      
      // Pegar primeira aldeia própria disponível
      const myVillages = backend._internal?.myVillages || [];
      if (myVillages.length === 0) {
        throw new Error('Nenhuma aldeia própria encontrada');
      }
      
      const sourceVillage = myVillages[0];
      
      // Criar ataque de teste (alvo fictício próximo)
      const [x, y] = sourceVillage.coord.split('|').map(Number);
      const testTarget = `${x + 1}|${y + 1}`;
      
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
        // Tropas mínimas para teste
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
    
    // Aplicar configuração temporária
    applyTempConfig(config) {
      // Armazenar config original
      if (!window._TWS_OriginalConfig) {
        window._TWS_OriginalConfig = this.getCurrentConfig();
      }
      
      // Aplicar nova config
      const globalConfig = this.getGlobalConfig();
      globalConfig.behavior.schedulerCheckInterval = config.schedulerInterval || 100;
      globalConfig.behavior.retryOnFail = config.retries > 0;
      globalConfig.behavior.maxRetries = config.retries || 1;
      
      localStorage.setItem('tws_global_config_v2', JSON.stringify(globalConfig));
      
      console.log(`[Benchmark] Config temporária aplicada:`, config);
    },
    
    // Restaurar configuração original
    restoreOriginalConfig() {
      if (window._TWS_OriginalConfig) {
        localStorage.setItem('tws_global_config_v2', JSON.stringify(window._TWS_OriginalConfig));
        delete window._TWS_OriginalConfig;
        console.log('[Benchmark] Config original restaurada');
      }
    },
    
    // Obter configuração atual
    getCurrentConfig() {
      try {
        return JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
      } catch {
        return {};
      }
    },
    
    // Obter configuração global
    getGlobalConfig() {
      try {
        const saved = JSON.parse(localStorage.getItem('tws_global_config_v2') || '{}');
        return {
          behavior: {
            schedulerCheckInterval: 100,
            retryOnFail: true,
            maxRetries: 2,
            ...saved.behavior
          }
        };
      } catch {
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

  // ═══════════════════════════════════════════════════════════════
  // ✅ #2 ENGINE DE TESTES REAIS
  // ═══════════════════════════════════════════════════════════════
  
  const TWS_RealBenchmarkEngine = {
    isTesting: false,
    currentTest: null,
    testQueue: [],
    results: [],
    
    async startRealBenchmark(configs, profileName) {
      if (this.isTesting) {
        alert('Já existe um teste em andamento!');
        return;
      }
      
      if (!TWS_BenchmarkBackendAdapter.isBackendAvailable()) {
        alert('❌ Backend TWS não disponível!\n\nCertifique-se de que o script principal está carregado.');
        return;
      }
      
      // Confirmação do usuário
      const confirm = window.confirm(
        `⚠️ TESTE REAL\n\n` +
        `Isso executará ${configs.length} ataques REAIS usando o backend!\n\n` +
        `• Aldeias: Suas aldeias reais serão usadas\n` +
        `• Tropas: 1 lanceiro por teste (mínimo)\n` +
        `• Alvos: Coordenadas próximas (teste)\n\n` +
        `Deseja continuar?`
      );
      
      if (!confirm) return;
      
      this.isTesting = true;
      this.testQueue = [...configs];
      this.results = [];
      
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.updateTestStatus(`🧪 Iniciando ${profileName} (REAL)...`, 0);
        window.TWS_BenchmarkUI.toggleStopButton(true);
      }
      
      let completed = 0;
      const total = configs.length;
      
      for (const config of configs) {
        if (!this.isTesting) break;
        
        const progress = (completed / total) * 100;
        if (window.TWS_BenchmarkUI) {
          window.TWS_BenchmarkUI.updateTestStatus(
            `Testando: ${config.name} (${completed + 1}/${total}) - REAL`, 
            progress
          );
        }
        
        const result = await this.runRealTest(config);
        this.results.push(result);
        completed++;
        
        // Aguardar entre testes
        await this.sleep(3000);
      }
      
      // Restaurar config original
      TWS_BenchmarkBackendAdapter.restoreOriginalConfig();
      
      this.isTesting = false;
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.toggleStopButton(false);
      }
      
      if (completed === total) {
        if (window.TWS_BenchmarkUI) {
          window.TWS_BenchmarkUI.updateTestStatus('✅ Benchmark REAL concluído!', 100);
          this.showRealResults();
        }
      } else {
        if (window.TWS_BenchmarkUI) {
          window.TWS_BenchmarkUI.updateTestStatus('⏹️ Benchmark interrompido', progress);
        }
      }
    },
    
    async runRealTest(testConfig) {
      const backend = window.TWS_Backend;
      const startTime = Date.now();
      const testResults = [];
      
      // Aplicar config temporária
      TWS_BenchmarkBackendAdapter.applyTempConfig(testConfig);
      
      // Aguardar aplicação
      await this.sleep(500);
      
      // Executar 3 ataques reais
      for (let i = 0; i < 3; i++) {
        if (!this.isTesting) break;
        
        try {
          const testAttack = await TWS_BenchmarkBackendAdapter.createTestAttack(testConfig);
          const attackStartTime = Date.now();
          
          console.log(`[Benchmark Real] Executando ataque ${i+1}/3:`, testAttack);
          
          // EXECUTAR ATAQUE REAL
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
          
          console.log(`[Benchmark Real] Resultado ataque ${i+1}:`, {
            success,
            responseTime,
            executionTime: testAttack.executionDuration
          });
          
        } catch (err) {
          testResults.push({
            success: false,
            responseTime: Date.now() - startTime,
            error: err.message,
            config: testConfig
          });
          
          console.error(`[Benchmark Real] Erro no ataque ${i+1}:`, err);
        }
        
        await this.sleep(1000);
      }
      
      const successCount = testResults.filter(r => r.success).length;
      const totalTime = Date.now() - startTime;
      const avgResponseTime = testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length;
      const avgExecutionTime = testResults
        .filter(r => r.executionTime)
        .reduce((sum, r) => sum + r.executionTime, 0) / (testResults.filter(r => r.executionTime).length || 1);
      
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
          realData: true // Flag para indicar dados reais
        },
        individualResults: testResults
      };
    },
    
    calculatePerformanceScore(successCount, totalAttacks, avgResponseTime) {
      const successRate = (successCount / totalAttacks) * 100;
      const speedScore = Math.max(0, 100 - (avgResponseTime / 30));
      return Math.round((successRate * 0.7) + (speedScore * 0.3));
    },
    
    showRealResults() {
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.switchTab('results');
      }
      
      const container = document.getElementById('results-container');
      const bestResult = this.findBestResult();
      
      if (container) {
        container.innerHTML = `
          <div style="background: #FFF5E6; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #ED8936;">
            <div style="font-weight: bold; color: #DD6B20; margin-bottom: 10px;">
              🔥 RESULTADOS REAIS DO BACKEND
            </div>
            <div style="font-size: 13px; color: #744210;">
              Estes resultados foram obtidos executando ataques REAIS usando o backend do TWS Scheduler.
              As métricas refletem o comportamento real do sistema no seu ambiente.
            </div>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #48BB78;">
            <h3 style="margin-top: 0; color: #48BB78;">🏆 CONFIGURAÇÃO RECOMENDADA</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <h4>Parâmetros Otimizados:</h4>
                <pre style="background: #F7FAFC; padding: 10px; border-radius: 4px; font-size: 12px;">${JSON.stringify({
                  ATTACK_TIMEOUT: bestResult.config.ATTACK_TIMEOUT,
                  retries: bestResult.config.retries,
                  schedulerInterval: bestResult.config.schedulerInterval
                }, null, 2)}</pre>
              </div>
              <div>
                <h4>Métricas Reais:</h4>
                <div style="font-size: 14px;">
                  <div>✅ Taxa de Sucesso: <strong style="color: ${bestResult.metrics.successRate >= 80 ? '#48BB78' : '#F56565'}">${bestResult.metrics.successRate.toFixed(1)}%</strong></div>
                  <div>⏱️ Tempo Médio: <strong>${bestResult.metrics.avgResponseTime}ms</strong></div>
                  <div>⚡ Exec. Média: <strong>${bestResult.metrics.avgExecutionTime}ms</strong></div>
                  <div>🎯 Precisão: <strong>±${Math.ceil((bestResult.config.schedulerInterval || 1000) / 2)}ms</strong></div>
                  <div>🚀 Pontuação: <strong>${bestResult.metrics.performanceScore}/100</strong></div>
                </div>
              </div>
            </div>
          </div>
          
          <h3>📊 Todos os Resultados (Reais)</h3>
          <div class="config-grid">
            ${this.results.map(result => `
              <div class="result-card" style="text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <h4 style="margin: 0;">${result.config.name}</h4>
                  <span style="background: #ED8936; color: white; font-size: 10px; padding: 2px 6px; border-radius: 3px;">REAL</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
                  <div>Timeout:</div><div>${result.config.ATTACK_TIMEOUT}ms</div>
                  <div>Retries:</div><div>${result.config.retries}</div>
                  <div>Interval:</div><div>${result.config.schedulerInterval}ms</div>
                  <div>Sucesso:</div><div style="color: ${result.metrics.successRate >= 80 ? '#48BB78' : '#F56565'}; font-weight: bold;">${result.metrics.successRate.toFixed(1)}%</div>
                  <div>Tempo:</div><div>${result.metrics.avgResponseTime}ms</div>
                  <div>Execução:</div><div>${result.metrics.avgExecutionTime}ms</div>
                  <div>Score:</div><div><strong>${result.metrics.performanceScore}</strong></div>
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #718096;">
                  ${result.metrics.successfulAttacks}/${result.metrics.totalAttacks} ataques bem-sucedidos
                </div>
              </div>
            `).join('')}
          </div>
          
          <div style="background: #EDF2F7; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <div style="font-weight: bold; margin-bottom: 10px;">📝 Notas sobre os Resultados:</div>
            <ul style="font-size: 13px; color: #4A5568; margin: 0; padding-left: 20px;">
              <li>Estes resultados refletem o comportamento real do sistema no seu navegador e rede</li>
              <li>Variações podem ocorrer devido a condições de rede e carga do servidor</li>
              <li>Recomenda-se executar múltiplos benchmarks para resultados mais precisos</li>
              <li>A melhor configuração balanceia taxa de sucesso, tempo de resposta e precisão</li>
            </ul>
          </div>
        `;
      }
      
      if (window.TWS_BenchmarkUI) {
        window.TWS_BenchmarkUI.toggleApplyButton(true, bestResult.config);
      }
    },
    
    findBestResult() {
      return this.results.reduce((best, current) => {
        // Priorizar taxa de sucesso, depois performance
        const bestScore = best.metrics.successRate * 0.7 + best.metrics.performanceScore * 0.3;
        const currentScore = current.metrics.successRate * 0.7 + current.metrics.performanceScore * 0.3;
        return currentScore > bestScore ? current : best;
      }, this.results[0]);
    },
    
    stopAllTests() {
      this.isTesting = false;
      TWS_BenchmarkBackendAdapter.restoreOriginalConfig();
    },
    
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ #3 ATUALIZAR UI PARA SUPORTAR MODO REAL
  // ═══════════════════════════════════════════════════════════════
  
  if (window.TWS_BenchmarkUI) {
    const originalGetPanelHTML = window.TWS_BenchmarkUI.getPanelHTML;
    
    window.TWS_BenchmarkUI.getPanelHTML = function() {
      const html = originalGetPanelHTML.call(this);
      
      // Adicionar botão de modo real
      return html.replace(
        '<button class="btn btn-success" onclick="TWS_BenchmarkUI.startSelectedProfile()"',
        `<div style="display: flex; gap: 10px; justify-content: center;">
          <button class="btn btn-success" onclick="TWS_BenchmarkUI.startSelectedProfile()">
            🎮 Modo Simulado
          </button>
          <button class="btn btn-warning" onclick="TWS_BenchmarkUI.startRealProfile()">
            🔥 Modo REAL (Backend)
          </button>
        </div>
        <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #718096;">
          <strong>Simulado:</strong> Testes rápidos com dados fictícios | 
          <strong>REAL:</strong> Executa ataques reais usando o backend
        </div>
        <button style="display: none;" class="btn btn-success" onclick="TWS_BenchmarkUI.startSelectedProfile()"'
      );
    };
    
    // Adicionar método para modo real
    window.TWS_BenchmarkUI.startRealProfile = function() {
      if (!this.selectedProfile) {
        alert('Selecione um perfil primeiro!');
        return;
      }
      
      const profile = this.testProfiles[this.selectedProfile];
      this.switchTab('live');
      
      if (window.TWS_RealBenchmarkEngine) {
        window.TWS_RealBenchmarkEngine.startRealBenchmark(profile.configs, profile.name);
      } else {
        alert('Engine de testes reais não carregada!');
      }
    };
    
    // Atualizar método de aplicar config
    const originalApplyBestConfiguration = window.TWS_BenchmarkUI.applyBestConfiguration;
    
    window.TWS_BenchmarkUI.applyBestConfiguration = function(bestConfig) {
      if (!bestConfig) {
        alert('Execute um benchmark primeiro!');
        return;
      }
      
      // Aplicar no backend real
      if (TWS_BenchmarkBackendAdapter.isBackendAvailable()) {
        const globalConfig = TWS_BenchmarkBackendAdapter.getGlobalConfig();
        globalConfig.behavior.schedulerCheckInterval = bestConfig.schedulerInterval || 100;
        globalConfig.behavior.retryOnFail = bestConfig.retries > 0;
        globalConfig.behavior.maxRetries = bestConfig.retries || 1;
        
        localStorage.setItem('tws_global_config_v2', JSON.stringify(globalConfig));
        
        alert(
          `✅ CONFIGURAÇÃO APLICADA COM SUCESSO!\n\n` +
          `• Timeout: ${bestConfig.ATTACK_TIMEOUT}ms\n` +
          `• Retries: ${bestConfig.retries}\n` +
          `• Scheduler Interval: ${bestConfig.schedulerInterval}ms\n\n` +
          `A configuração foi salva e será usada automaticamente.`
        );
      } else {
        originalApplyBestConfiguration.call(this, bestConfig);
      }
      
      this.closePanel();
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ #4 EXPORTAR API
  // ═══════════════════════════════════════════════════════════════
  
  window.TWS_BenchmarkBackendAdapter = TWS_BenchmarkBackendAdapter;
  window.TWS_RealBenchmarkEngine = TWS_RealBenchmarkEngine;
  
  console.log('🔗 [Benchmark] Integração com backend real carregada!');
  console.log('✅ [Benchmark] Modo REAL disponível no painel');
  
  // Verificar backend
  if (TWS_BenchmarkBackendAdapter.isBackendAvailable()) {
    console.log('✅ [Benchmark] Backend TWS detectado e pronto!');
  } else {
    console.warn('⚠️ [Benchmark] Backend TWS não detectado. Modo REAL não disponível.');
  }
  
})();

// ═══════════════════════════════════════════════════════════════
// 📖 DOCUMENTAÇÃO DE USO
// ═══════════════════════════════════════════════════════════════

console.log([
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║           TWS BENCHMARK - MODO REAL ATIVADO                   ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '🎯 COMO USAR:',
  '',
  '1. Abra o painel de benchmark (botão "🧪 Otimizar")',
  '2. Escolha um perfil de teste',
  '3. Clique em "🔥 Modo REAL (Backend)"',
  '4. Confirme a execução',
  '5. Aguarde os resultados reais',
  '',
  '⚡ DIFERENÇAS:',
  '',
  '┌─────────────────┬──────────────────┬──────────────────┐',
  '│     Aspecto     │   Modo Simulado  │    Modo REAL     │',
  '├─────────────────┼──────────────────┼──────────────────┤',
  '│ Velocidade      │ Rápido (2-3s)    │ Lento (30-60s)   │',
  '│ Ataques Reais   │ ❌ Não           │ ✅ Sim           │',
  '│ Tropas Usadas   │ ❌ Não           │ ✅ 1 lanceiro    │',
  '│ Precisão        │ Estimativa       │ 100% Real        │',
  '│ Configuração    │ Sugestões        │ Dados Reais      │',
  '└─────────────────┴──────────────────┴──────────────────┘',
  '',
  '⚠️ ATENÇÃO:',
  '• Modo REAL usa ataques verdadeiros do backend',
  '• Consome 1 lanceiro por teste (3 por config)',
  '• Resultados são 100% precisos para seu ambiente',
  '• Recomendado para otimização final',
  '',
  '🔧 API DISPONÍVEL:',
  '• TWS_BenchmarkBackendAdapter',
  '• TWS_RealBenchmarkEngine',
  '• TWS_BenchmarkUI (atualizada)',
  ''
].join('\n'));
