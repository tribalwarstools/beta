// tws_carregador_stealth.js - CARREGADOR STEALTH
(function() {
    'use strict';

    // ⭐ VERIFICAÇÃO DE DUPLICIDADE MELHORADA ⭐
    if (window.__TWS_STEALTH_CARREGADOR) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR = true;

    // ⭐ CONFIGURAÇÃO SIMPLIFICADA ⭐
    const CONFIG = {
        // URL base - mantenha igual para compatibilidade
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // Ordem de carregamento OTIMIZADA
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
        
        // Delays mais inteligentes (foco nos essenciais primeiro)
        delays: {
            essential: [0, 5000],           // Backend e Frontend rápido
            nonEssential: [10000, 15000, 20000, 25000, 30000, 35000, 40000]
        }
    };

    // ⭐ FUNÇÃO PRINCIPAL STEALTH ⭐
    async function carregarScriptStealth(scriptInfo, isEssential) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        
        try {
            // 1. Baixa sem headers suspeitos
            const response = await fetch(url);
            if (!response.ok) {
                if (isEssential) {
                    console.warn(`[Stealth] Falha essencial: ${scriptInfo.file}`);
                }
                return false;
            }
            
            const code = await response.text();
            
            // 2. Delay aleatório baseado na importância
            const delay = isEssential ? 
                Math.random() * 1000 + 500 :  // 0.5-1.5s para essenciais
                Math.random() * 3000 + 2000;  // 2-5s para não essenciais
            
            await new Promise(r => setTimeout(r, delay));
            
            // 3. Executa com new Function (mais discreto que eval)
            try {
                const executor = new Function(code);
                executor();
                
                // 4. Verificação flexível
                return await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (window[scriptInfo.check]) {
                            clearInterval(checkInterval);
                            console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                            resolve(true);
                        }
                    }, 500);
                    
                    // Timeout baseado na importância
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (!isEssential) {
                            console.log(`[Stealth] ? ${scriptInfo.check} não verificado (continuando)`);
                            resolve(true); // Continua mesmo sem verificação para não-essenciais
                        } else {
                            resolve(false);
                        }
                    }, isEssential ? 5000 : 3000);
                });
                
            } catch (execError) {
                console.warn(`[Stealth] Execução ${scriptInfo.file}:`, execError.message);
                return !isEssential; // Se não é essencial, continua
            }
            
        } catch (fetchError) {
            console.warn(`[Stealth] Fetch ${scriptInfo.file}:`, fetchError.message);
            return !isEssential; // Continua se não for essencial
        }
    }

    // ⭐ CARREGAMENTO INTELIGENTE ⭐
    async function carregarTudoInteligente() {
        console.log('[Stealth] Iniciando carregamento inteligente...');
        
        // Separa scripts essenciais e não essenciais
        const essentialScripts = CONFIG.scripts.filter(s => s.essential);
        const nonEssentialScripts = CONFIG.scripts.filter(s => !s.essential);
        
        let loadedCount = 0;
        
        // === FASE 1: ESSENCIAIS (rápido) ===
        console.log('[Stealth] Fase 1: Carregando essenciais...');
        for (let i = 0; i < essentialScripts.length; i++) {
            const script = essentialScripts[i];
            const delay = CONFIG.delays.essential[i] || 0;
            
            if (delay > 0) {
                console.log(`[Stealth] Aguardando ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [Essencial ${i+1}/${essentialScripts.length}] ${script.file}`);
            const success = await carregarScriptStealth(script, true);
            if (success) loadedCount++;
        }
        
        // Verifica se os essenciais carregaram
        if (window.TWS_Backend && window.TWS_Panel) {
            console.log('[Stealth] ✅ Essenciais carregados, scheduler básico funcionando!');
            
            // Já pode mostrar interface básica
            setTimeout(() => {
                if (window.TWS_Panel && typeof window.TWS_Panel.init === 'function') {
                    window.TWS_Panel.init();
                }
            }, 1000);
        } else {
            console.warn('[Stealth] ⚠️ Essenciais incompletos, tentando continuar...');
        }
        
        // === FASE 2: NÃO ESSENCIAIS (lento, stealth) ===
        console.log('[Stealth] Fase 2: Carregando extras (modo stealth)...');
        for (let i = 0; i < nonEssentialScripts.length; i++) {
            const script = nonEssentialScripts[i];
            const delay = CONFIG.delays.nonEssential[i] || 15000;
            
            console.log(`[Stealth] Aguardando ${Math.round(delay/1000)}s antes do próximo...`);
            await new Promise(r => setTimeout(r, delay));
            
            console.log(`[Stealth] [Extra ${i+1}/${nonEssentialScripts.length}] ${script.file}`);
            await carregarScriptStealth(script, false);
        }
        
        console.log(`[Stealth] 🎯 Concluído! ${loadedCount}/${CONFIG.scripts.length} scripts`);
        
        // Notificação MUITO discreta
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
                font-family: Arial, sans-serif;
                cursor: pointer;
                pointer-events: auto;
            `;
            indicator.title = 'TW Scheduler Stealth Active\nClick to hide';
            indicator.onclick = () => indicator.remove();
            document.body.appendChild(indicator);
        }, 5000);
    }

    // ⭐ INICIALIZAÇÃO SEGURA ⭐
    function iniciarStealth() {
        // Verifica se está em página de jogo
        const isGamePage = window.location.href.includes('/game.php') && 
                          (document.querySelector('#game_header') || 
                           document.querySelector('.menu-row') ||
                           document.querySelector('#village_map'));
        
        if (!isGamePage) {
            console.log('[Stealth] Não é página de jogo, aguardando...');
            // Tenta novamente em 10 segundos
            setTimeout(iniciarStealth, 10000);
            return;
        }
        
        console.log('[Stealth] Jogo detectado, iniciando em modo stealth...');
        
        // Espera inicial ALEATÓRIA (5-15 segundos)
        const initialWait = Math.random() * 10000 + 5000;
        console.log(`[Stealth] Aguardando ${Math.round(initialWait/1000)}s inicial...`);
        
        setTimeout(() => {
            carregarTudoInteligente().catch(error => {
                console.log('[Stealth] Carregamento finalizado:', error.message);
            });
        }, initialWait);
    }

    // ⭐ DETECÇÃO DE AMBIENTE SEGURO ⭐
    function ambienteSeguro() {
        // Espera o DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => iniciarStealth(), 3000);
            });
        } else {
            // Já carregado, espera um pouco mais
            setTimeout(() => iniciarStealth(), 5000);
        }
    }

    // ⭐ INICIA TUDO ⭐
    ambienteSeguro();

})();
