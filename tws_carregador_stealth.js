// tws_carregador_stealth.js - VERSÃO 2.2 FINAL
(function() {
    'use strict';

    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    console.log('[Stealth] Inicializado - Versão 2.2 (frontend no final)');

    // ⭐ CONFIGURAÇÃO FINAL - FRONTEND É O ÚLTIMO ⭐
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // ORDEM CRÍTICA: TUDO antes do frontend
        scripts: [
            // 1. Backend (base de tudo) - ESSENCIAL
            { file: 'tw-scheduler-backend.js', check: 'TWS_Backend', essential: true },
            
            // 2. Config modal (para farm) - NÃO ESSENCIAL (vai para fase 2)
            { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal', essential: false },
            
            // 3. MultiTab Lock - NÃO ESSENCIAL
            { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock', essential: false },
            
            // 4. Todos os modais - NÃO ESSENCIAIS
            { file: 'tw-scheduler-modal.js', check: 'TWS_Modal', essential: false },
            { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal', essential: false },
            { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal', essential: false },
            { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente', essential: false },
            
            // 5. Telegram bot - NÃO ESSENCIAL
            { file: 'telegram-bot.js', check: 'TelegramBotReal', essential: false },
            
            // 6. Frontend - ESSENCIAL mas ÚLTIMO!
            { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel', essential: true }
        ],
        
        // Delays: backend imediato, outros com delay, frontend no final
        delays: {
            essential: [0], // só backend é essencial na fase 1
            nonEssential: [5000, 0, 10000, 15000, 20000, 25000, 30000, 35000, 0] // frontend tem delay 0 na fase 2
        }
    };

    // ⭐ FUNÇÃO PRINCIPAL STEALTH ⭐
    async function carregarScriptStealth(scriptInfo, isEssential) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        
        try {
            // Fetch normal (sem headers suspeitos)
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[Stealth] HTTP ${response.status} em ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            // Pequeno delay aleatório antes de executar
            await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
            
            try {
                // Executa com new Function
                new Function(code)();
                
                // Verificação inteligente
                return await new Promise((resolve) => {
                    let tentativas = 0;
                    const maxTentativas = isEssential ? 10 : 8;
                    
                    const verificar = () => {
                        tentativas++;
                        
                        if (window[scriptInfo.check]) {
                            console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                            resolve(true);
                        } else if (tentativas >= maxTentativas) {
                            if (!isEssential) {
                                console.log(`[Stealth] → ${scriptInfo.file} (assumindo OK)`);
                                resolve(true);
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
                return !isEssential; // Se não é essencial, continua
            }
            
        } catch (fetchError) {
            console.warn(`[Stealth] Fetch ${scriptInfo.file}:`, fetchError.message);
            return !isEssential; // Se não é essencial, continua
        }
    }

    // ⭐ CARREGAMENTO INTELIGENTE - VERSÃO CORRIGIDA ⭐
    async function carregarTudoInteligente() {
        console.log('[Stealth] 🚀 Iniciando carregamento (frontend no final)...');
        
        // SEPARAÇÃO CORRIGIDA: backend é o ÚNICO essencial na fase 1
        const essentialScripts = CONFIG.scripts.filter(s => s.essential && s.file === 'tw-scheduler-backend.js');
        const nonEssentialScripts = CONFIG.scripts.filter(s => !s.essential || s.file !== 'tw-scheduler-backend.js');
        
        console.log(`[Stealth] Estratégia: 1 essencial + ${nonEssentialScripts.length} não-essenciais`);
        
        // === FASE 1: APENAS BACKEND ===
        console.log('[Stealth] 📦 Fase 1: Backend (base do sistema)');
        if (essentialScripts.length > 0) {
            const backend = essentialScripts[0];
            const delay = CONFIG.delays.essential[0] || 0;
            
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [1/1] ${backend.file}`);
            await carregarScriptStealth(backend, true);
        }
        
        // === FASE 2: TODOS OS OUTROS (INCLUINDO FRONTEND) ===
        console.log(`[Stealth] 🕵️ Fase 2: ${nonEssentialScripts.length} scripts (frontend é o último)`);
        
        for (let i = 0; i < nonEssentialScripts.length; i++) {
            const script = nonEssentialScripts[i];
            const delay = CONFIG.delays.nonEssential[i] || 10000;
            const isFrontend = script.file === 'tw-scheduler-frontend.js';
            
            // Aplica delay
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${Math.round(delay/1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [${i+1}/${nonEssentialScripts.length}] ${script.file}${isFrontend ? ' (FRONTEND - ÚLTIMO!)' : ''}`);
            
            // Para o frontend, verificamos se os modais já carregaram
            if (isFrontend) {
                console.log('[Stealth] 🔍 Verificando se modais estão prontos...');
                const modaisNecessarios = ['TWS_ConfigModal', 'TWS_Modal', 'TWS_BBCodeModal', 'TWS_TestModal', 'TWS_FarmInteligente'];
                const modaisCarregados = modaisNecessarios.filter(m => window[m]).length;
                
                if (modaisCarregados < 3) {
                    console.warn(`[Stealth] ⚠️ Apenas ${modaisCarregados}/5 modais carregados, frontend pode ter warnings`);
                } else {
                    console.log(`[Stealth] ✅ ${modaisCarregados}/5 modais carregados, frontend deve funcionar bem`);
                }
            }
            
            await carregarScriptStealth(script, isFrontend); // Frontend é tratado como essencial
            
            // Pausa entre scripts (exceto após o último)
            if (i < nonEssentialScripts.length - 1) {
                const pausa = Math.random() * 2000 + 1000;
                await new Promise(r => setTimeout(r, pausa));
            }
        }
        
        // === VERIFICAÇÃO FINAL ===
        console.log('[Stealth] 🔍 Verificação final...');
        
        const componentes = [
            { nome: 'Backend', var: 'TWS_Backend', crítico: true },
            { nome: 'Config Modal', var: 'TWS_ConfigModal', crítico: false },
            { nome: 'Modal Principal', var: 'TWS_Modal', crítico: false },
            { nome: 'BBCode Modal', var: 'TWS_BBCodeModal', crítico: false },
            { nome: 'Test Modal', var: 'TWS_TestModal', crítico: false },
            { nome: 'Farm Modal', var: 'TWS_FarmInteligente', crítico: false },
            { nome: 'MultiTab Lock', var: 'TWS_MultiTabLock', crítico: false },
            { nome: 'Telegram Bot', var: 'TelegramBotReal', crítico: false },
            { nome: 'Frontend/Panel', var: 'TWS_Panel', crítico: true }
        ];
        
        const total = componentes.length;
        const carregados = componentes.filter(c => window[c.var]).length;
        const criticosCarregados = componentes.filter(c => c.crítico && window[c.var]).length;
        
        console.log(`[Stealth] 📊 ${carregados}/${total} componentes carregados`);
        console.log(`[Stealth] ✅ ${criticosCarregados}/2 componentes críticos (backend + frontend)`);
        
        if (criticosCarregados === 2) {
            console.log('[Stealth] 🎉 TW Scheduler funcionando!');
            
            // Indicador stealth mínimo
            setTimeout(() => {
                if (document.querySelector('#tws-stealth-indicator')) return;
                
                const indicator = document.createElement('div');
                indicator.id = 'tws-stealth-indicator';
                indicator.textContent = 'TW✓';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 2px;
                    right: 2px;
                    font-size: 10px;
                    color: #4CAF50;
                    opacity: 0.4;
                    z-index: 999997;
                    font-family: Arial, sans-serif;
                    cursor: default;
                    user-select: none;
                `;
                indicator.title = `TW Scheduler Stealth\n${carregados}/${total} componentes`;
                document.body.appendChild(indicator);
            }, 2000);
        } else {
            console.warn('[Stealth] ⚠️ Carregamento incompleto');
        }
    }

    // ⭐ DETECTOR DE PÁGINA DE JOGO ⭐
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
            '#sidebar_box',
            '#menu_row'
        ];
        
        for (const selector of gameSelectors) {
            if (document.querySelector(selector)) return true;
        }
        
        return false;
    }

    // ⭐ INICIALIZAÇÃO PRINCIPAL ⭐
    function iniciarStealth() {
        if (!verificarPaginaJogo()) {
            console.log('[Stealth] ⏳ Não é página de jogo, aguardando...');
            setTimeout(iniciarStealth, 5000);
            return;
        }
        
        console.log('[Stealth] ✅ Página de jogo detectada!');
        
        // Espera aleatória importante para stealth
        const esperaInicial = Math.random() * 8000 + 4000;
        console.log(`[Stealth] ⏳ Iniciando carregamento em ${Math.round(esperaInicial/1000)}s...`);
        
        setTimeout(() => {
            carregarTudoInteligente().catch(err => {
                console.log('[Stealth] Processo finalizado:', err.message);
            });
        }, esperaInicial);
    }

    // ⭐ PONTO DE ENTRADA PRINCIPAL ⭐
    function iniciar() {
        console.log('[Stealth] 🌟 Inicializando carregador stealth...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('[Stealth] 📄 DOM carregado');
                setTimeout(iniciarStealth, 2000);
            });
        } else {
            console.log('[Stealth] 📄 DOM já pronto');
            setTimeout(iniciarStealth, 3000);
        }
    }

    // Delay inicial para não interferir com carregamento da página
    setTimeout(iniciar, 1000);

})();
