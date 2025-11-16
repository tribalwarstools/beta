(function() {
    'use strict';

    if (window.TWS_CARREGADOR_LOADED) return;
    window.TWS_CARREGADOR_LOADED = true;

    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        scripts: [
            { file: 'agendador_backend.js', check: 'TWS_Backend' },
            { file: 'agendador_frontend.js', check: 'TWS_Panel' }
        ]
    };

    // ═══════════════════════════════════════════════════════
    // MODO 1: PARALELO (MAIS RÁPIDO) - Carrega tudo junto
    // ═══════════════════════════════════════════════════════
    function carregarParalelo() {
        console.log('[Carregador] ⚡ Modo paralelo ativado');
        
        const promises = CONFIG.scripts.map(script => {
            return new Promise((resolve, reject) => {
                const url = CONFIG.baseUrl + script.file;
                $.getScript(url)
                    .done(() => {
                        console.log(`✅ ${script.file}`);
                        // Aguarda global estar disponível
                        const check = setInterval(() => {
                            if (window[script.check]) {
                                clearInterval(check);
                                resolve();
                            }
                        }, 50);
                        setTimeout(() => clearInterval(check) || reject(), 5000);
                    })
                    .fail(reject);
            });
        });

        Promise.all(promises)
            .then(() => {
                console.log('🎉 TW Scheduler carregado (paralelo)!');
                showNotification('✅ TW Scheduler carregado!', 'success');
            })
            .catch(err => {
                console.error('❌ Erro:', err);
                showNotification('❌ Erro ao carregar', 'error');
            });
    }

    // ═══════════════════════════════════════════════════════
    // MODO 2: SEQUENCIAL (MAIS SEGURO) - Um por vez
    // ═══════════════════════════════════════════════════════
    async function carregarSequencial() {
        console.log('[Carregador] 🔄 Modo sequencial ativado');
        
        try {
            for (const script of CONFIG.scripts) {
                const url = CONFIG.baseUrl + script.file;
                await new Promise((resolve, reject) => {
                    $.getScript(url)
                        .done(() => {
                            console.log(`✅ ${script.file}`);
                            const check = setInterval(() => {
                                if (window[script.check]) {
                                    clearInterval(check);
                                    resolve();
                                }
                            }, 50);
                            setTimeout(() => clearInterval(check) || reject(), 5000);
                        })
                        .fail(reject);
                });
            }
            console.log('🎉 TW Scheduler carregado (sequencial)!');
            showNotification('✅ TW Scheduler carregado!', 'success');
        } catch (err) {
            console.error('❌ Erro:', err);
            showNotification('❌ Erro ao carregar', 'error');
        }
    }

    // ═══════════════════════════════════════════════════════
    // MODO 3: BUNDLE ÚNICO (MAIS RÁPIDO POSSÍVEL)
    // ═══════════════════════════════════════════════════════
    function carregarBundle() {
        console.log('[Carregador] 🚀 Modo bundle ativado');
        // Carrega um único arquivo que contém backend + frontend concatenados
        $.getScript(CONFIG.baseUrl + 'tw_scheduler_bundle.js')
            .done(() => {
                console.log('🎉 TW Scheduler carregado (bundle)!');
                showNotification('✅ TW Scheduler carregado!', 'success');
            })
            .fail(err => {
                console.error('❌ Erro:', err);
                showNotification('❌ Erro ao carregar', 'error');
            });
    }

    // Notificação simples e leve
    function showNotification(msg, type) {
        const colors = { success: '#4CAF50', error: '#F44336' };
        const div = document.createElement('div');
        div.style.cssText = `position:fixed;top:10px;right:10px;background:${colors[type]};color:#fff;padding:15px 25px;border-radius:6px;z-index:999999;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.3);`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // ═══════════════════════════════════════════════════════
    // ESCOLHA O MODO AQUI:
    // ═══════════════════════════════════════════════════════
    
    // OPÇÃO A: Mais rápido (mas pode ter race conditions)
    // carregarParalelo();
    
    // OPÇÃO B: Mais seguro (recomendado)
    carregarSequencial();
    
    // OPÇÃO C: Mais rápido de todos (requer criar bundle)
    // carregarBundle();

})();
