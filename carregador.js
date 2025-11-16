(function() {
    'use strict';

    if (window.TWS_CARREGADOR_LOADED) return;
    window.TWS_CARREGADOR_LOADED = true;

    const CONFIG = {
        baseUrls: [
            'https://tribalwarstools.github.io/beta/',
            'https://cdn.jsdelivr.net/gh/tribalwarstools/beta@latest/'
        ],
        scripts: [
            { file: 'agendador_backend.js', check: 'TWS_Backend' },
            { file: 'agendador_frontend.js', check: 'TWS_Panel' }
        ],
        timeout: 15000 // 15 segundos total
    };

    // ═══════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            // Tentar jQuery se disponível
            if (window.$ && typeof $.getScript === 'function') {
                $.getScript(url).done(resolve).fail(reject);
            } else {
                // Fallback nativo
                const script = document.createElement('script');
                script.src = url;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Falha ao carregar: ${url}`));
                document.head.appendChild(script);
            }
        });
    }

    function waitForGlobal(globalName, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (window[globalName]) {
                return resolve();
            }

            const startTime = Date.now();
            let delay = 100;
            
            function check() {
                if (window[globalName]) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout: ${globalName} não disponível após ${timeout}ms`));
                } else {
                    delay = Math.min(delay * 1.5, 1000);
                    setTimeout(check, delay);
                }
            }
            
            setTimeout(check, delay);
        });
    }

    function loadScriptWithValidation(scriptInfo) {
        let lastError;
        
        for (const baseUrl of CONFIG.baseUrls) {
            try {
                const url = baseUrl + scriptInfo.file;
                console.log(`[Carregador] Tentando: ${url}`);
                
                return loadScript(url)
                    .then(() => waitForGlobal(scriptInfo.check, 8000))
                    .then(() => {
                        console.log(`✅ ${scriptInfo.file} carregado e validado`);
                        return true;
                    });
            } catch (error) {
                lastError = error;
                console.warn(`❌ Falha em ${baseUrl}:`, error.message);
                continue;
            }
        }
        
        throw lastError || new Error(`Todos os mirrors falharam para ${scriptInfo.file}`);
    }

    function showNotification(msg, type = 'info') {
        const colors = { 
            success: '#4CAF50', 
            error: '#F44336',
            info: '#2196F3'
        };
        
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000000;
            font-size: 14px;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;
        div.textContent = msg;
        document.body.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.parentNode.removeChild(div);
            }
        }, 4000);
    }

    // ═══════════════════════════════════════════════════════
    // LOADING STRATEGIES
    // ═══════════════════════════════════════════════════════

    async function carregarSequencial() {
        console.log('[Carregador] 🔄 Iniciando carregamento sequencial');
        showNotification('🔄 Carregando TW Scheduler...', 'info');
        
        const startTime = Date.now();
        
        try {
            for (const script of CONFIG.scripts) {
                console.log(`[Carregador] Carregando: ${script.file}`);
                await loadScriptWithValidation(script);
            }
            
            const loadTime = Date.now() - startTime;
            console.log(`🎉 TW Scheduler carregado em ${loadTime}ms!`);
            showNotification(`✅ TW Scheduler carregado! (${loadTime}ms)`, 'success');
            
        } catch (error) {
            console.error('❌ Erro no carregamento:', error);
            showNotification(`❌ Falha: ${error.message}`, 'error');
            
            // Log detalhado para debugging
            console.error('[Carregador] Debug info:', {
                userAgent: navigator.userAgent,
                jQueryAvailable: !!(window.$ && $.getScript),
                scriptsLoaded: CONFIG.scripts.map(s => ({
                    script: s.file,
                    global: s.check,
                    loaded: !!window[s.check]
                }))
            });
        }
    }

    async function carregarParalelo() {
        console.log('[Carregador] ⚡ Iniciando carregamento paralelo');
        showNotification('⚡ Carregando TW Scheduler (paralelo)...', 'info');
        
        const startTime = Date.now();
        
        try {
            const promises = CONFIG.scripts.map(script => 
                loadScriptWithValidation(script)
            );
            
            await Promise.all(promises);
            
            const loadTime = Date.now() - startTime;
            console.log(`🎉 TW Scheduler carregado em ${loadTime}ms (paralelo)!`);
            showNotification(`✅ TW Scheduler carregado! (${loadTime}ms)`, 'success');
            
        } catch (error) {
            console.error('❌ Erro no carregamento paralelo:', error);
            showNotification(`❌ Falha: ${error.message}`, 'error');
        }
    }

    // ═══════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════

    // Esperar DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(carregarSequencial, 1000); // Dar tempo para a página carregar
        });
    } else {
        setTimeout(carregarSequencial, 1000);
    }

})();
