// tws_carregador_stealth.js - VERSÃO 2.2
(function() {
    'use strict';

    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    console.log('[Stealth] Inicializado - Versão 2.1 (ordem corrigida)');

    // ⭐ CONFIGURAÇÃO COM ORDEM CORRIGIDA ⭐
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
// NOVA ORDEM DEFINITIVA:
scripts: [
    // 1. Backend (base de tudo)
    { file: 'tw-scheduler-backend.js', check: 'TWS_Backend', essential: true },
    
    // 2. Config modal (necessário para farm)
    { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal', essential: false },
    
    // 3. MultiTab Lock
    { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock', essential: false },
    
    // 4. Todos os modais ANTES do frontend
    { file: 'tw-scheduler-modal.js', check: 'TWS_Modal', essential: false },
    { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal', essential: false },
    { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal', essential: false },
    { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente', essential: false },
    
    // 5. Telegram bot
    { file: 'telegram-bot.js', check: 'TelegramBotReal', essential: false },
    
    // 6. Frontend POR ÚLTIMO (depois de TUDO)
    { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel', essential: true }
],

delays: {
    essential: [0], // só o backend é realmente essencial
    nonEssential: [5000, 0, 10000, 15000, 20000, 25000, 30000, 35000, 0] // 9 scripts não-essenciais
}
    };

    // ⭐ FUNÇÃO PRINCIPAL STEALTH ⭐
    async function carregarScriptStealth(scriptInfo, isEssential) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        
        try {
            // Fetch normal (sem headers suspeitos)
            const response = await fetch(url);
            if (!response.ok) {
                if (isEssential) console.warn(`[Stealth] Falha essencial: ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            // Delay baseado na importância
            const delay = isEssential ? 
                Math.random() * 1000 + 500 :
                Math.random() * 3000 + 2000;
            
            await new Promise(r => setTimeout(r, delay));
            
            try {
                // Executa com new Function
                new Function(code)();
                
                // Verificação mais inteligente
                return await new Promise((resolve) => {
                    let verificacoes = 0;
                    const maxVerificacoes = isEssential ? 10 : 6; // 5s ou 3s
                    
                    const verificar = () => {
                        verificacoes++;
                        
                        if (window[scriptInfo.check]) {
                            console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                            resolve(true);
                        } else if (verificacoes >= maxVerificacoes) {
                            if (!isEssential) {
                                console.log(`[Stealth] → ${scriptInfo.file} (sem verificação)`);
                                resolve(true); // Continua mesmo sem verificação para não-essenciais
                            } else {
                                console.warn(`[Stealth] ? ${scriptInfo.check} não encontrado`);
                                resolve(false);
                            }
                        } else {
                            setTimeout(verificar, 500);
                        }
                    };
                    
                    verificar();
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

    // ⭐ CARREGAMENTO INTELIGENTE ⭐
    async function carregarTudoInteligente() {
        console.log('[Stealth] 🚀 Iniciando carregamento (ordem corrigida)...');
        
        const essentialScripts = CONFIG.scripts.filter(s => s.essential);
        const nonEssentialScripts = CONFIG.scripts.filter(s => !s.essential);
        
        let carregadosComSucesso = 0;
        
        // === FASE 1: SCRIPTS ESSENCIAIS ===
        console.log('[Stealth] 📦 Fase 1: Essenciais (3 scripts)');
        for (let i = 0; i < essentialScripts.length; i++) {
            const script = essentialScripts[i];
            const delay = CONFIG.delays.essential[i] || 0;
            
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [Essencial ${i+1}/${essentialScripts.length}] ${script.file}`);
            const sucesso = await carregarScriptStealth(script, true);
            if (sucesso) carregadosComSucesso++;
        }
        
        // Verificação rápida dos essenciais
        if (window.TWS_Backend && window.TWS_ConfigModal) {
            console.log('[Stealth] ✅ Backend e Config carregados!');
        }
        
        // === FASE 2: SCRIPTS NÃO-ESSENCIAIS ===
        console.log('[Stealth] 🕵️ Fase 2: Extras (6 scripts)');
        for (let i = 0; i < nonEssentialScripts.length; i++) {
            const script = nonEssentialScripts[i];
            const delay = CONFIG.delays.nonEssential[i] || 10000;
            
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${Math.round(delay/1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [Extra ${i+1}/${nonEssentialScripts.length}] ${script.file}`);
            await carregarScriptStealth(script, false);
            
            // Pequena pausa aleatória entre scripts extras
            await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
        }
        
        // === VERIFICAÇÃO FINAL ===
        console.log('[Stealth] 🔍 Verificando carregamento...');
        
        const componentes = [
            { nome: 'Backend', var: 'TWS_Backend' },
            { nome: 'Config Modal', var: 'TWS_ConfigModal' },
            { nome: 'Frontend/Panel', var: 'TWS_Panel' },
            { nome: 'Modal Principal', var: 'TWS_Modal' },
            { nome: 'BBCode Modal', var: 'TWS_BBCodeModal' },
            { nome: 'Test Modal', var: 'TWS_TestModal' },
            { nome: 'Farm Modal', var: 'TWS_FarmInteligente' },
            { nome: 'MultiTab Lock', var: 'TWS_MultiTabLock' },
            { nome: 'Telegram Bot', var: 'TelegramBotReal' }
        ];
        
        const carregados = componentes.filter(c => window[c.var]).length;
        console.log(`[Stealth] 🎯 ${carregados}/${componentes.length} componentes carregados`);
        
        if (carregados >= 7) { // Pelo menos os principais
            console.log('[Stealth] ✅ TW Scheduler funcionando!');
            
            // Indicador stealth mínimo
            setTimeout(() => {
                if (document.querySelector('#tws-stealth-badge')) return;
                
                const badge = document.createElement('div');
                badge.id = 'tws-stealth-badge';
                badge.textContent = 'TW';
                badge.style.cssText = `
                    position: fixed;
                    bottom: 3px;
                    right: 3px;
                    font-size: 9px;
                    color: #4CAF50;
                    opacity: 0.5;
                    z-index: 999998;
                    font-family: monospace;
                    cursor: default;
                    user-select: none;
                `;
                badge.title = `TW Scheduler Stealth\nCarregado: ${carregados}/${componentes.length}`;
                document.body.appendChild(badge);
            }, 2000);
        } else {
            console.warn('[Stealth] ⚠️ Carregamento parcial');
        }
    }

    // ⭐ DETECTOR DE PÁGINA DE JOGO (mantido) ⭐
    function verificarPaginaJogo() {
        const url = window.location.href;
        const isGameURL = url.includes('/game.php') && 
                         !url.includes('login') && 
                         !url.includes('logout') &&
                         !url.includes('authenticate');
        
        if (!isGameURL) return false;
        
        const gameSelectors = [
            '#game_header',
            '.menu-row',
            '#village_map',
            '#content_value',
            '.building_buttons',
            '#sidebar_box'
        ];
        
        for (const selector of gameSelectors) {
            if (document.querySelector(selector)) return true;
        }
        
        return false;
    }

    // ⭐ INICIALIZAÇÃO PRINCIPAL ⭐
    function iniciarStealth() {
        if (!verificarPaginaJogo()) {
            console.log('[Stealth] ⏳ Não é jogo ainda, aguardando...');
            setTimeout(iniciarStealth, 5000);
            return;
        }
        
        console.log('[Stealth] ✅ Jogo detectado!');
        
        // Espera aleatória antes de começar (3-8 segundos)
        const waitTime = Math.random() * 5000 + 3000;
        console.log(`[Stealth] ⏳ Iniciando em ${Math.round(waitTime/1000)}s...`);
        
        setTimeout(() => {
            carregarTudoInteligente().catch(err => {
                console.log('[Stealth] Finalizado:', err.message);
            });
        }, waitTime);
    }

    // ⭐ PONTO DE ENTRADA ⭐
    function iniciar() {
        console.log('[Stealth] 🌟 Iniciando sistema stealth...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(iniciarStealth, 2000);
            });
        } else {
            setTimeout(iniciarStealth, 3000);
        }
    }

    // Pequeno delay inicial
    setTimeout(iniciar, 1000);

})();
