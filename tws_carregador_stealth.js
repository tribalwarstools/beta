// tws_carregador_stealth.js - VERSÃO 2.2 FINAL
(function() {
    'use strict';

    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    console.log('[Stealth] Inicializado - Versão 2.2 (frontend por último)');

    // ⭐ CONFIGURAÇÃO FINAL ⭐
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // ORDEM: TUDO antes do frontend
        scripts: [
            { file: 'tw-scheduler-backend.js', check: 'TWS_Backend', essential: true },
            { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal', essential: false },
            { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock', essential: false },
            { file: 'tw-scheduler-modal.js', check: 'TWS_Modal', essential: false },
            { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal', essential: false },
            { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal', essential: false },
            { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente', essential: false },
            { file: 'telegram-bot.js', check: 'TelegramBotReal', essential: false },
            { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel', essential: true } // ÚLTIMO!
        ],
        
        // Delays: frontend só depois de 35+ segundos
        delays: [0, 5000, 0, 10000, 15000, 20000, 25000, 30000, 35000]
    };

    // ⭐ FUNÇÃO DE CARREGAMENTO SIMPLIFICADA ⭐
    async function carregarScriptStealth(scriptInfo, index) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        
        try {
            // Aplica delay específico para este script
            const delay = CONFIG.delays[index] || 0;
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [${index+1}/${CONFIG.scripts.length}] ${scriptInfo.file}`);
            
            // Fetch discreto
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[Stealth] HTTP ${response.status} em ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            // Pequeno delay aleatório antes de executar
            await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
            
            // Executa
            try {
                new Function(code)();
                
                // Verificação flexível
                return await new Promise((resolve) => {
                    let tentativas = 0;
                    const maxTentativas = scriptInfo.essential ? 10 : 6;
                    
                    const verificar = () => {
                        tentativas++;
                        
                        if (window[scriptInfo.check]) {
                            console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                            resolve(true);
                        } else if (tentativas >= maxTentativas) {
                            // Para o frontend, é crítico que verifique
                            if (scriptInfo.file.includes('frontend')) {
                                console.warn(`[Stealth] ⚠️ Frontend não verificou ${scriptInfo.check}`);
                                resolve(false);
                            } else {
                                console.log(`[Stealth] → ${scriptInfo.file} (assumindo OK)`);
                                resolve(true);
                            }
                        } else {
                            setTimeout(verificar, 500);
                        }
                    };
                    
                    verificar();
                });
                
            } catch (err) {
                console.warn(`[Stealth] Execução ${scriptInfo.file}:`, err.message);
                return scriptInfo.file.includes('frontend') ? false : true;
            }
            
        } catch (error) {
            console.warn(`[Stealth] Fetch ${scriptInfo.file}:`, error.message);
            return scriptInfo.file.includes('frontend') ? false : true;
        }
    }

    // ⭐ CARREGAMENTO SEQUENCIAL SIMPLES ⭐
    async function carregarTudo() {
        console.log('[Stealth] 🚀 Iniciando (frontend por último)...');
        
        let sucessos = 0;
        const total = CONFIG.scripts.length;
        
        for (let i = 0; i < total; i++) {
            const script = CONFIG.scripts[i];
            const sucesso = await carregarScriptStealth(script, i);
            if (sucesso) sucessos++;
            
            // Pequena pausa entre scripts (exceto após o último)
            if (i < total - 1) {
                const pausa = Math.random() * 2000 + 1000;
                await new Promise(r => setTimeout(r, pausa));
            }
        }
        
        // VERIFICAÇÃO FINAL
        console.log(`[Stealth] 📊 ${sucessos}/${total} scripts carregados`);
        
        const componentesCriticos = ['TWS_Backend', 'TWS_Panel', 'TWS_ConfigModal'];
        const criticosCarregados = componentesCriticos.filter(c => window[c]).length;
        
        if (criticosCarregados >= 2) {
            console.log('[Stealth] ✅ Scheduler funcional!');
            
            // Indicador mínimo
            setTimeout(() => {
                const badge = document.createElement('div');
                badge.textContent = 'TW✓';
                badge.style.cssText = `
                    position: fixed;
                    bottom: 2px;
                    right: 2px;
                    font-size: 9px;
                    color: #4CAF50;
                    opacity: 0.4;
                    z-index: 999997;
                    font-family: Arial;
                    cursor: default;
                `;
                badge.title = `TW Scheduler Stealth\n${sucessos}/${total} scripts`;
                document.body.appendChild(badge);
            }, 3000);
        }
    }

    // ⭐ INICIALIZAÇÃO ⭐
    function iniciar() {
        // Verifica se está em game.php
        const isGamePage = window.location.href.includes('/game.php') && 
                          !window.location.href.includes('login') &&
                          (document.querySelector('#game_header') || 
                           document.querySelector('.menu-row'));
        
        if (!isGamePage) {
            console.log('[Stealth] ⏳ Não é página de jogo, tentando em 10s...');
            setTimeout(iniciar, 10000);
            return;
        }
        
        console.log('[Stealth] ✅ Jogo detectado!');
        
        // Espera inicial aleatória (importante para stealth)
        const esperaInicial = Math.random() * 10000 + 5000;
        console.log(`[Stealth] ⏳ Iniciando em ${Math.round(esperaInicial/1000)}s...`);
        
        setTimeout(() => {
            carregarTudo().catch(err => {
                console.log('[Stealth] Finalizado:', err.message);
            });
        }, esperaInicial);
    }

    // ⭐ PONTO DE ENTRADA ⭐
    setTimeout(() => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(iniciar, 3000);
            });
        } else {
            setTimeout(iniciar, 5000);
        }
    }, 1000);

})();
