// tws_carregador_stealth.js - VERSÃO 2.0 CORRIGIDA
(function() {
    'use strict';

    // ⭐ VERIFICAÇÃO DE DUPLICIDADE MELHORADA ⭐
    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    console.log('[Stealth] Inicializado - Versão 2.0');

    // ⭐ CONFIGURAÇÃO SIMPLIFICADA ⭐
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        scripts: [
            { file: 'tw-scheduler-backend.js', check: 'TWS_Backend', essential: true },
            { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel', essential: true },
            { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal', essential: false },
            { file: 'tw-scheduler-modal.js', check: 'TWS_Modal', essential: false },
            { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal', essential: false },
            { file: 'telegram-bot.js', check: 'TelegramBotReal', essential: false },
            { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock', essential: false },
            { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal', essential: false },
            { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente', essential: false }
        ],
        
        delays: {
            essential: [0, 5000],
            nonEssential: [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000]
        }
    };

    // ⭐ FUNÇÃO PRINCIPAL STEALTH (MANTIDA) ⭐
    async function carregarScriptStealth(scriptInfo, isEssential) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (isEssential) console.warn(`[Stealth] Falha essencial: ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            const delay = isEssential ? 
                Math.random() * 1000 + 500 :
                Math.random() * 3000 + 2000;
            
            await new Promise(r => setTimeout(r, delay));
            
            try {
                new Function(code)();
                
                return await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (window[scriptInfo.check]) {
                            clearInterval(checkInterval);
                            console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                            resolve(true);
                        }
                    }, 500);
                    
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (!isEssential) {
                            console.log(`[Stealth] ? ${scriptInfo.check} não verificado (continuando)`);
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }, isEssential ? 5000 : 3000);
                });
                
            } catch (execError) {
                console.warn(`[Stealth] Execução ${scriptInfo.file}:`, execError.message);
                return !isEssential;
            }
            
        } catch (fetchError) {
            console.warn(`[Stealth] Fetch ${scriptInfo.file}:`, fetchError.message);
            return !isEssential;
        }
    }

    // ⭐ CARREGAMENTO INTELIGENTE (MANTIDA) ⭐
    async function carregarTudoInteligente() {
        console.log('[Stealth] 🚀 Iniciando carregamento inteligente...');
        
        const essentialScripts = CONFIG.scripts.filter(s => s.essential);
        const nonEssentialScripts = CONFIG.scripts.filter(s => !s.essential);
        
        let loadedCount = 0;
        
        // FASE 1: ESSENCIAIS
        console.log('[Stealth] 📦 Fase 1: Essenciais');
        for (let i = 0; i < essentialScripts.length; i++) {
            const script = essentialScripts[i];
            const delay = CONFIG.delays.essential[i] || 0;
            
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [Essencial ${i+1}/${essentialScripts.length}] ${script.file}`);
            const success = await carregarScriptStealth(script, true);
            if (success) loadedCount++;
        }
        
        // Verificação básica
        if (window.TWS_Backend && window.TWS_Panel) {
            console.log('[Stealth] ✅ Essenciais OK! Scheduler básico funcionando.');
            
            setTimeout(() => {
                if (window.TWS_Panel && typeof window.TWS_Panel.init === 'function') {
                    window.TWS_Panel.init();
                }
            }, 1000);
        }
        
        // FASE 2: EXTRAS
        console.log('[Stealth] 🕵️ Fase 2: Extras (stealth mode)');
        for (let i = 0; i < nonEssentialScripts.length; i++) {
            const script = nonEssentialScripts[i];
            const delay = CONFIG.delays.nonEssential[i] || 15000;
            
            console.log(`[Stealth] ⏳ Aguardando ${Math.round(delay/1000)}s...`);
            await new Promise(r => setTimeout(r, delay));
            
            console.log(`[Stealth] [Extra ${i+1}/${nonEssentialScripts.length}] ${script.file}`);
            await carregarScriptStealth(script, false);
        }
        
        console.log(`[Stealth] 🎉 Concluído!`);
        
        // Indicador stealth
        setTimeout(() => {
            if (document.querySelector('#tws-stealth-indicator')) return;
            
            const indicator = document.createElement('div');
            indicator.id = 'tws-stealth-indicator';
            indicator.innerHTML = 'TW✓';
            indicator.style.cssText = `
                position: fixed;
                bottom: 2px;
                right: 2px;
                font-size: 10px;
                color: #4CAF50;
                opacity: 0.6;
                z-index: 999999;
                font-family: Arial;
                cursor: pointer;
                user-select: none;
            `;
            indicator.title = 'TW Scheduler Stealth';
            indicator.onclick = () => indicator.remove();
            document.body.appendChild(indicator);
        }, 3000);
    }

    // ⭐ NOVA: DETECTOR DE PÁGINA DE JOGO ⭐
    function verificarPaginaJogo() {
        // 1. Verificação por URL (primária)
        const url = window.location.href;
        const isGameURL = url.includes('/game.php') && 
                         !url.includes('login') && 
                         !url.includes('logout') &&
                         !url.includes('authenticate');
        
        if (!isGameURL) return false;
        
        // 2. Verificação por elementos (secundária)
        const gameSelectors = [
            '#game_header',
            '.menu-row',
            '#village_map',
            '#content_value',
            '.building_buttons',
            '#sidebar_box',
            '#menu_row'
        ];
        
        for (const selector of gameSelectors) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        
        // 3. Verificação por classes
        const bodyClass = document.body.className.toLowerCase();
        if (bodyClass.includes('page-game') || 
            bodyClass.includes('screen-') ||
            bodyClass.includes('village_')) {
            return true;
        }
        
        // 4. Verificação por scripts carregados
        const scripts = Array.from(document.scripts);
        const hasGameScripts = scripts.some(s => 
            s.src && (s.src.includes('game.') || s.src.includes('tw_'))
        );
        
        return hasGameScripts;
    }

    // ⭐ NOVA: INICIALIZAÇÃO INTELIGENTE ⭐
    function iniciarStealthInteligente() {
        console.log('[Stealth] 🔍 Verificando página...');
        
        // Verificação imediata
        if (verificarPaginaJogo()) {
            console.log('[Stealth] ✅ Página de jogo confirmada!');
            iniciarProcesso();
            return;
        }
        
        console.log('[Stealth] ⏳ Página não reconhecida, monitorando...');
        
        // Se não reconheceu, monitora mudanças
        let tentativas = 0;
        const maxTentativas = 30; // ~30 segundos
        
        const interval = setInterval(() => {
            tentativas++;
            
            if (verificarPaginaJogo()) {
                clearInterval(interval);
                console.log(`[Stealth] ✅ Detectado na tentativa ${tentativas}!`);
                iniciarProcesso();
            } else if (tentativas >= maxTentativas) {
                clearInterval(interval);
                console.log('[Stealth] ❌ Timeout - Não é página de jogo válida.');
            } else if (tentativas % 5 === 0) {
                console.log(`[Stealth] ⏳ Tentativa ${tentativas}/${maxTentativas}...`);
            }
        }, 1000);
    }

    // ⭐ PROCESSO DE CARREGAMENTO ⭐
    function iniciarProcesso() {
        console.log('[Stealth] 🚀 Iniciando processo stealth...');
        
        // Espera aleatória inicial
        const waitTime = Math.random() * 12000 + 8000;
        console.log(`[Stealth] ⏳ Esperando ${Math.round(waitTime/1000)}s...`);
        
        setTimeout(() => {
            carregarTudoInteligente().catch(err => {
                console.log('[Stealth] Processo finalizado:', err.message);
            });
        }, waitTime);
    }

    // ⭐ INICIALIZAÇÃO PRINCIPAL ⭐
    function iniciar() {
        console.log('[Stealth] 🌟 Inicializando...');
        
        // Espera o DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('[Stealth] 📄 DOM carregado');
                setTimeout(iniciarStealthInteligente, 1000);
            });
        } else {
            console.log('[Stealth] 📄 DOM já pronto');
            setTimeout(iniciarStealthInteligente, 2000);
        }
    }

    // ⭐ PONTO DE ENTRADA ⭐
    // Pequeno delay para não interferir com carregamento da página
    setTimeout(iniciar, 500);

})();
