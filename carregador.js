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
        timeout: 15000,
        retries: 2
    };

    // ═══════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════

    const loadedScripts = new Set();

    function loadScript(url) {
        if (loadedScripts.has(url)) {
            console.log(`[Cache] Script já carregado: ${url}`);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // Tentar jQuery se disponível
            if (window.$ && typeof $.getScript === 'function') {
                $.getScript(url)
                    .done(() => {
                        loadedScripts.add(url);
                        resolve();
                    })
                    .fail(reject);
            } else {
                // Fallback nativo
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    loadedScripts.add(url);
                    script.onload = null;
                    script.onerror = null;
                    resolve();
                };
                script.onerror = () => {
                    // Limpar script falhado
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                    reject(new Error(`Falha ao carregar: ${url}`));
                };
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

    // ✅ CORRIGIDO: Agora realmente tenta todos os mirrors
    async function loadScriptWithValidation(scriptInfo) {
        let lastError;
        
        for (const baseUrl of CONFIG.baseUrls) {
            try {
                const url = baseUrl + scriptInfo.file;
                console.log(`[Carregador] Tentando: ${url}`);
                
                await loadScript(url);
                await waitForGlobal(scriptInfo.check, 8000);
                
                console.log(`✅ ${scriptInfo.file} carregado e validado de ${baseUrl}`);
                return true;
                
            } catch (error) {
                lastError = error;
                console.warn(`❌ Falha em ${baseUrl}:`, error.message);
                // Continue para próximo mirror
            }
        }
        
        // Se chegou aqui, todos os mirrors falharam
        throw lastError || new Error(`Todos os mirrors falharam para ${scriptInfo.file}`);
    }

    // ✅ NOVO: Retry logic
    async function loadScriptWithRetry(scriptInfo) {
        for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
            try {
                return await loadScriptWithValidation(scriptInfo);
            } catch (error) {
                if (attempt === CONFIG.retries) throw error;
                
                const delay = 1000 * attempt;
                console.warn(`Tentativa ${attempt} falhou, retry em ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
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
            cursor: pointer;
            transition: opacity 0.3s;
        `;
        div.textContent = msg;
        div.title = 'Clique para fechar';
        document.body.appendChild(div);
        
        const timeoutId = setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => {
                if (div.parentNode) {
                    div.parentNode.removeChild(div);
                }
            }, 300);
        }, 4000);

        // Permitir fechar manualmente
        div.onclick = () => {
            clearTimeout(timeoutId);
            div.style.opacity = '0';
            setTimeout(() => {
                if (div.parentNode) {
                    div.parentNode.removeChild(div);
                }
            }, 300);
        };
    }

    // ═══════════════════════════════════════════════════════
    // LOADING STRATEGY
    // ═══════════════════════════════════════════════════════

    async function carregarSequencial() {
        console.log('[Carregador] 🔄 Iniciando carregamento sequencial');
        showNotification('🔄 Carregando TW Scheduler...', 'info');
        
        const startTime = Date.now();
        
        try {
            for (let i = 0; i < CONFIG.scripts.length; i++) {
                const script = CONFIG.scripts[i];
                const progress = Math.round(((i + 1) / CONFIG.scripts.length) * 100);
                
                console.log(`[Carregador] [${i + 1}/${CONFIG.scripts.length}] Carregando: ${script.file}`);
                showNotification(`Carregando... ${progress}% (${script.file})`, 'info');
                
                await loadScriptWithRetry(script);
            }
            
            const loadTime = Date.now() - startTime;
            console.log(`🎉 TW Scheduler carregado em ${loadTime}ms!`);
            showNotification(`✅ TW Scheduler carregado! (${(loadTime/1000).toFixed(1)}s)`, 'success');
            
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
                })),
                error: error.stack
            });
        }
    }

    // ✅ CORRIGIDO: Timeout global aplicado
    async function carregarComTimeout() {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: carregamento excedeu ${CONFIG.timeout}ms`)), 
            CONFIG.timeout)
        );
        
        return Promise.race([
            carregarSequencial(),
            timeoutPromise
        ]);
    }

    // ═══════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════

    function iniciar() {
        // Pequeno delay para estabilidade
        setTimeout(carregarComTimeout, 200);
    }

    // ✅ MELHORADO: Inicialização otimizada
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else if (document.readyState === 'interactive') {
        // DOM pronto mas recursos ainda carregando
        window.addEventListener('load', iniciar);
    } else {
        // Tudo pronto
        iniciar();
    }

    console.log('[Carregador] Inicializado e aguardando DOM...');
})();
