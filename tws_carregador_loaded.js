(function() {
    'use strict';

    if (window.TWS_CARREGADOR_LOADED) return;
    window.TWS_CARREGADOR_LOADED = true;

    // ⭐ CONFIGURAÇÃO STEALTH ⭐
    const CONFIG = {
        // Use apenas uma URL e disfarce
        baseUrls: ['https://tribalwarstools.github.io/beta/'],
        
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
        
        delays: [0, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000]
    };

    // ⭐ FUNÇÃO STEALTH PARA CARREGAR ⭐
    async function carregarStealth(scriptInfo) {
        const url = CONFIG.baseUrls[0] + scriptInfo.file;
        
        try {
            // 1. Baixa o código com headers "normais"
            const response = await fetch(url, {
                headers: {
                    'Accept': '*/*',
                    'Cache-Control': 'no-cache'
                },
                cache: 'no-store'
            });
            
            if (!response.ok) {
                console.warn(`[Stealth] Falha HTTP ${response.status} em ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            // 2. Adiciona comentário aleatório para disfarçar
            const randomComment = `/* ${Math.random().toString(36).substr(2)} */\n`;
            const disguisedCode = randomComment + code;
            
            // 3. Executa com setTimeout aleatório
            return new Promise((resolve) => {
                const delay = Math.random() * 2000 + 1000;
                setTimeout(() => {
                    try {
                        // ⭐ EVAL DIRETO - não cria elemento <script> ⭐
                        (0, eval)(disguisedCode);
                        
                        // Verifica se carregou
                        setTimeout(() => {
                            if (window[scriptInfo.check]) {
                                console.log(`[✓] ${scriptInfo.file} (stealth)`);
                                resolve(true);
                            } else {
                                console.warn(`[?] ${scriptInfo.check} não encontrado`);
                                resolve(false);
                            }
                        }, 500);
                        
                    } catch (err) {
                        console.warn(`[Stealth] Erro em ${scriptInfo.file}:`, err.message);
                        resolve(false);
                    }
                }, delay);
            });
            
        } catch (error) {
            console.warn(`[Stealth] Falha em ${scriptInfo.file}:`, error.message);
            return false;
        }
    }

    // ⭐ CARREGAMENTO SEQUENCIAL COM PROTEÇÃO ⭐
    async function carregarTudo() {
        console.log('[Stealth] Iniciando carregamento disfarçado...');
        
        // Espera inicial aleatória
        await new Promise(r => setTimeout(r, Math.random() * 5000 + 3000));
        
        let carregados = 0;
        const total = CONFIG.scripts.length;
        
        for (let i = 0; i < total; i++) {
            const script = CONFIG.scripts[i];
            
            // Delay entre scripts (variável)
            if (i > 0) {
                const delay = CONFIG.delays[i] + Math.random() * 2000;
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[${i+1}/${total}] ${script.file}`);
            
            const sucesso = await carregarStealth(script);
            if (sucesso) carregados++;
            
            // Pausa aleatória adicional
            await new Promise(r => setTimeout(r, Math.random() * 1000 + 500));
        }
        
        console.log(`[Stealth] Finalizado: ${carregados}/${total} scripts`);
        
        // Mostra notificação discreta
        if (carregados >= total - 1) {
            setTimeout(() => {
                const notif = document.createElement('div');
                notif.textContent = '✓ Scheduler OK';
                notif.style.cssText = `
                    position:fixed; bottom:10px; right:10px;
                    background:#4CAF50; color:white; padding:6px 12px;
                    border-radius:3px; font-size:12px; z-index:99999;
                    opacity:0.9; cursor:pointer;
                `;
                notif.onclick = () => notif.remove();
                document.body.appendChild(notif);
                setTimeout(() => notif.remove(), 3000);
            }, 1000);
        }
    }

    // ⭐ INICIALIZAÇÃO SEGURA ⭐
    function iniciar() {
        // Espera o jogo ficar completamente estável
        const checkGame = setInterval(() => {
            const gameReady = document.querySelector('#game_header') || 
                             document.querySelector('.menu-row');
            
            if (gameReady) {
                clearInterval(checkGame);
                
                // Espera mais um pouco aleatório
                setTimeout(() => {
                    carregarTudo().catch(() => {
                        console.log('[Stealth] Carregamento finalizado');
                    });
                }, Math.random() * 4000 + 2000);
            }
        }, 1000);
        
        // Timeout de segurança
        setTimeout(() => clearInterval(checkGame), 30000);
    }

    // ⭐ ANTI-DETECÇÃO: Restaura métodos originais temporariamente ⭐
    const originalApis = {
        fetch: window.fetch,
        createElement: document.createElement,
        setAttribute: Element.prototype.setAttribute
    };
    
    // Inicia quando seguro
    if (document.readyState === 'complete') {
        setTimeout(iniciar, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(iniciar, 3000);
        });
    }

})();
