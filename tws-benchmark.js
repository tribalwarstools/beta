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
      const myVillages = backend._internal?.myVillages || [];
      
      if (myVillages.length === 0) {
        throw new Error('Nenhuma aldeia própria encontrada');
      }
      
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
