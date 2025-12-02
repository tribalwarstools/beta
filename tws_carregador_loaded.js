(function() {
    'use strict';

    if (window.TWS_CARREGADOR_LOADED) return;
    window.TWS_CARREGADOR_LOADED = true;

    const CONFIG = {
        baseUrls: [
            'https://tribalwarstools.github.io/beta/'
            // Usar só um mirror para evitar muitas requisições
        ],

        scripts: [
            { file: 'telegram-bot.js', check: 'TelegramBotReal' },
            { file: 'tw-scheduler-backend.js', check: 'TWS_Backend' },
            { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock' },
            { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal' },
            { file: 'tw-scheduler-modal.js', check: 'TWS_Modal' },
            { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal' },
            { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal' },
            { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente' },
            { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel' }
        ],
        
        // Delays crescentes entre scripts (em milissegundos)
        delays: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000],
        timeout: 40000, // Timeout aumentado
        retries: 1 // Menos tentativas para menos requisições
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
                
                // Adicionar atributos "inocentes"
                script.setAttribute('type', 'text/javascript');
                script.setAttribute('async', 'true');
                script.setAttribute('defer', 'true');
                
                script.onload = () => {
                    loadedScripts.add(url);
                    script.onload = null;
                    script.onerror = null;
                    resolve();
                };
                
                script.onerror = (error) => {
                    // Limpar script falhado
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                    
                    // Não rejeitar imediatamente para erros 429
                    if (error && error.message && error.message.includes('429')) {
                        console.warn('[Stealth] Rate limit detectado, continuando...');
                        resolve(); // Continua mesmo com erro
                    } else {
                        reject(new Error(`Falha ao carregar: ${url}`));
                    }
                };
                
                // Inserir discretamente
                setTimeout(() => {
                    document.head.appendChild(script);
                }, 100);
            }
        });
    }

    function waitForGlobal(globalName, timeout = 15000) {
        return new Promise((resolve, reject) => {
            if (window[globalName]) {
                return resolve();
            }

            const startTime = Date.now();
            let delay = 200; // Aumentado
            
            function check() {
                if (window[globalName]) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    // Não rejeitar, apenas avisar
                    console.warn(`[Aviso] ${globalName} não disponível após ${timeout}ms, continuando...`);
                    resolve();
                } else {
                    delay = Math.min(delay * 1.3, 1500); // Mais lento
                    setTimeout(check, delay);
                }
            }
            
            setTimeout(check, delay);
        });
    }

    async function loadScriptWithValidation(scriptInfo) {
        let lastError;
        
        for (const baseUrl of CONFIG.baseUrls) {
            try {
                const url = baseUrl + scriptInfo.file;
                console.log(`[Carregador] Tentando: ${url}`);
                
                await loadScript(url);
                await waitForGlobal(scriptInfo.check, 10000);
                
                console.log(`✅ ${scriptInfo.file} carregado`);
                return true;
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Falha em ${baseUrl}:`, error.message);
            }
        }
        
        // Não lançar erro, apenas registrar
        console.warn(`[Contornado] Script ${scriptInfo.file} não carregado completamente`);
        return false;
    }

    async function loadScriptWithRetry(scriptInfo) {
        for (let attempt = 1; attempt <= CONFIG.retries; attempt++) {
            try {
                return await loadScriptWithValidation(scriptInfo);
            } catch (error) {
                if (attempt === CONFIG.retries) {
                    console.warn(`[Ignorado] ${scriptInfo.file} após ${attempt} tentativas`);
                    return false; // Não propagar erro
                }
                
                const delay = 2000 * attempt;
                console.warn(`Tentativa ${attempt} falhou, aguardando ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false;
    }

    let currentNotification = null;
    let notificationCount = 0;

    function showNotification(msg, type = 'info') {
        // Limitar notificações para não chamar atenção
        notificationCount++;
        if (notificationCount > 3 && type !== 'success') {
            return; // Mostrar só as primeiras notificações
        }
        
        const colors = { 
            success: '#4CAF50', 
            error: '#F44336',
            info: '#2196F3',
            warning: '#FF9800'
        };
        
        if (currentNotification && currentNotification.parentNode) {
            currentNotification.style.opacity = '0';
            setTimeout(() => {
                if (currentNotification.parentNode) {
                    currentNotification.parentNode.removeChild(currentNotification);
                }
            }, 200);
        }
        
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 10px 16px;
            border-radius: 4px;
            z-index: 999998; // Menor z-index
            font-size: 13px;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            max-width: 250px;
            word-wrap: break-word;
            cursor: pointer;
            transition: opacity 0.3s;
            opacity: 0;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        div.textContent = msg;
        div.title = 'Clique para fechar';
        document.body.appendChild(div);
        
        setTimeout(() => div.style.opacity = '1', 10);
        
        currentNotification = div;
        
        const timeoutId = setTimeout(() => {
            if (div === currentNotification) {
                div.style.opacity = '0';
                setTimeout(() => {
                    if (div.parentNode) {
                        div.parentNode.removeChild(div);
                    }
                    if (div === currentNotification) {
                        currentNotification = null;
                    }
                }, 300);
            }
        }, 2500); // Tempo mais curto

        div.onclick = () => {
            clearTimeout(timeoutId);
            div.style.opacity = '0';
            setTimeout(() => {
                if (div.parentNode) {
                    div.parentNode.removeChild(div);
                }
                if (div === currentNotification) {
                    currentNotification = null;
                }
            }, 300);
        };
    }

    // ═══════════════════════════════════════════════════════
    // LOADING STRATEGY - MODO STEALTH
    // ═══════════════════════════════════════════════════════

    async function carregarSequencial() {
        console.log('[Carregador] 🕵️ Iniciando carregamento (modo stealth)');
        
        const startTime = Date.now();
        let successCount = 0;
        
        try {
            // ESPERA INICIAL IMPORTANTE
            showNotification('⏳ Aguardando antes de carregar...', 'info');
            await new Promise(resolve => setTimeout(resolve, 7000));
            
            for (let i = 0; i < CONFIG.scripts.length; i++) {
                const script = CONFIG.scripts[i];
                
                // APLICAR DELAY PERSONALIZADO
                if (CONFIG.delays[i] > 0) {
                    const waitSec = CONFIG.delays[i] / 1000;
                    console.log(`[Stealth] Aguardando ${waitSec}s...`);
                    await new Promise(resolve => setTimeout(resolve, CONFIG.delays[i]));
                }
                
                console.log(`[${i + 1}/${CONFIG.scripts.length}] ${script.file}`);
                
                // MOSTRAR POUCAS NOTIFICAÇÕES
                if (i === 0 || i === 4 || i === CONFIG.scripts.length - 1) {
                    showNotification(`📦 ${script.file.split('-').pop()}...`, 'info');
                }
                
                const loaded = await loadScriptWithRetry(script);
                if (loaded) successCount++;
                
                // Pequena pausa adicional aleatória
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));
            }
            
            const loadTime = Date.now() - startTime;
            const totalWait = CONFIG.delays.reduce((a, b) => a + b, 0);
            const actualLoadTime = loadTime - totalWait;
            
            console.log(`🎉 Carregamento concluído em ${loadTime}ms (${actualLoadTime}ms ativos)`);
            console.log(`✅ ${successCount}/${CONFIG.scripts.length} scripts carregados`);
            
            if (successCount >= CONFIG.scripts.length - 2) { // Permite até 2 falhas
                showNotification(`✅ Scheduler pronto!`, 'success');
            } else {
                showNotification(`⚠️ Carregamento parcial (${successCount}/${CONFIG.scripts.length})`, 'warning');
            }
            
        } catch (error) {
            console.warn('⚠️ Carregamento parcial:', error.message);
            showNotification(`⚠️ Carregamento parcial, mas funcional`, 'warning');
        }
    }

    async function carregarComTimeout() {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                console.warn('[Timeout] Carregamento muito lento, continuando...');
                resolve();
            }, CONFIG.timeout);
            
            carregarSequencial().then(() => {
                clearTimeout(timeoutId);
                resolve();
            }).catch(() => {
                clearTimeout(timeoutId);
                resolve(); // Sempre resolve, nunca rejeita
            });
        });
    }

    // ═══════════════════════════════════════════════════════
    // INICIALIZAÇÃO COM DELAY
    // ═══════════════════════════════════════════════════════

    function iniciar() {
        console.log('[Carregador] Iniciando em modo stealth...');
        
        // DELAY LONGO antes de começar (5-8 segundos aleatório)
        const initialDelay = Math.random() * 3000 + 5000;
        console.log(`[Stealth] Aguardando ${Math.round(initialDelay/1000)}s inicial...`);
        
        setTimeout(() => {
            carregarComTimeout().catch(() => {
                console.log('[Carregador] Finalizado (com ou sem erros)');
            });
        }, initialDelay);
    }

    // ═══════════════════════════════════════════════════════
    // PROTEÇÕES CONTRA DETECÇÃO
    // ═══════════════════════════════════════════════════════

    // 1. Silenciar erros 429
    const originalErrorHandler = window.onerror;
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        if (msg && typeof msg === 'string') {
            if (msg.includes('429') || msg.includes('rate limit') || msg.includes('st/')) {
                console.log('[Stealth] Erro de rate limit ignorado');
                return true; // Suprime o erro
            }
        }
        if (originalErrorHandler) {
            return originalErrorHandler(msg, url, lineNo, columnNo, error);
        }
        return false;
    };

    // 2. Filtrar logs do console
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = function(...args) {
        const msg = args[0];
        if (typeof msg === 'string' && (msg.includes('st/') || msg.includes('429') || msg.includes('rate limit'))) {
            return; // Não mostrar
        }
        originalLog.apply(console, args);
    };
    
    console.warn = function(...args) {
        const msg = args[0];
        if (typeof msg === 'string' && (msg.includes('st/') || msg.includes('429'))) {
            return; // Não mostrar
        }
        originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
        const msg = args[0];
        if (typeof msg === 'string' && (msg.includes('st/') || msg.includes('429'))) {
            return; // Não mostrar
        }
        originalError.apply(console, args);
    };

    // 3. Esperar a página carregar completamente
    function waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                setTimeout(resolve, 1000);
            } else if (document.readyState === 'interactive') {
                window.addEventListener('load', () => {
                    setTimeout(resolve, 2000);
                });
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(resolve, 3000);
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // INICIAR COM SEGURANÇA
    // ═══════════════════════════════════════════════════════

    async function startSafe() {
        await waitForPageReady();
        
        // Verificar se o jogo já está estável
        const gameLoaded = document.querySelector('#game_header') || 
                          document.querySelector('.menu-row') ||
                          document.querySelector('#village_map');
        
        if (!gameLoaded) {
            console.log('[Stealth] Jogo não completamente carregado, aguardando...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        iniciar();
    }

    // Iniciar de forma segura
    setTimeout(startSafe, 1000);
    
    console.log('[Carregador] Modo stealth ativado. Iniciando em breve...');

})();
