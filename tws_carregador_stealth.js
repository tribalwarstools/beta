// tws_carregador_stealth.js - VERSÃO 2.4 OTIMIZADA
(function() {
    'use strict';

    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    console.log('[Stealth] Inicializado - Versão 2.4 (Otimizada)');

    // ============================================
    // SISTEMA DE NOTIFICAÇÕES OTIMIZADO
    // ============================================
    class ProgressNotifier {
        constructor() {
            this.notification = null;
            this.progressBar = null;
            this.stepText = null;
            this.currentStep = 0;
            this.totalSteps = 3; // Reduzido para 3 fases
            this.createNotification();
        }
        
        createNotification() {
            // Remover notificação anterior se existir
            const oldNotif = document.getElementById('tws-progress-notification');
            if (oldNotif && oldNotif.parentNode) {
                oldNotif.parentNode.removeChild(oldNotif);
            }
            
            this.notification = document.createElement('div');
            this.notification.id = 'tws-progress-notification';
            this.notification.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 300px;
                background: rgba(26, 26, 26, 0.95);
                border-left: 4px solid #654321;
                border-radius: 4px;
                padding: 12px;
                z-index: 999998;
                font-family: Arial, sans-serif;
                color: #f1e1c1;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
                display: none;
            `;
            
            const title = document.createElement('div');
            title.style.cssText = `
                font-size: 13px;
                font-weight: bold;
                margin-bottom: 8px;
                color: #d4b35d;
                display: flex;
                align-items: center;
                gap: 6px;
            `;
            title.innerHTML = '⏳ <span>TW Scheduler</span>';
            
            this.stepText = document.createElement('div');
            this.stepText.style.cssText = `
                font-size: 11px;
                margin: 6px 0;
                color: #95a5a6;
            `;
            this.stepText.textContent = 'Inicializando...';
            
            this.progressBar = document.createElement('div');
            this.progressBar.style.cssText = `
                height: 3px;
                background: linear-gradient(90deg, #27ae60 0%, #2ecc71 100%);
                width: 0%;
                border-radius: 2px;
                margin-top: 8px;
                transition: width 0.3s ease;
            `;
            
            this.notification.appendChild(title);
            this.notification.appendChild(this.stepText);
            this.notification.appendChild(this.progressBar);
            document.body.appendChild(this.notification);
        }
        
        show() {
            if (this.notification) {
                this.notification.style.display = 'block';
                setTimeout(() => {
                    if (this.notification && this.currentStep < this.totalSteps) {
                        this.notification.style.display = 'none';
                    }
                }, 4000);
            }
        }
        
        update(step, message) {
            this.currentStep = step;
            const progress = (step / this.totalSteps) * 100;
            
            if (this.progressBar) {
                this.progressBar.style.width = `${progress}%`;
            }
            
            if (this.stepText) {
                this.stepText.textContent = message;
            }
            
            if (step === 1) {
                this.show();
            }
            
            if (step >= this.totalSteps) {
                setTimeout(() => this.showSuccess(), 500);
            }
        }
        
        showSuccess() {
            if (!this.notification) return;
            
            this.notification.style.borderLeftColor = '#27ae60';
            this.stepText.textContent = '✅ Carregamento completo';
            this.stepText.style.color = '#27ae60';
            this.progressBar.style.width = '100%';
            
            setTimeout(() => {
                if (this.notification && this.notification.parentNode) {
                    this.notification.parentNode.removeChild(this.notification);
                }
            }, 2000);
        }
        
        hide() {
            if (this.notification && this.notification.parentNode) {
                this.notification.parentNode.removeChild(this.notification);
            }
        }
    }

    const progressNotifier = new ProgressNotifier();

    // ⭐ CONFIGURAÇÃO OTIMIZADA ⭐
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // ORDEM OTIMIZADA: Paralelismo inteligente
        scripts: [
            // FASE 1: Core essencial (carrega primeiro)
            { 
                file: 'tw-scheduler-backend.js', 
                check: 'TWS_Backend', 
                phase: 1,
                timeout: 10000
            },
            
            // FASE 2: Modais principais (carregam em paralelo)
            { 
                file: 'tw-scheduler-modal.js', 
                check: 'TWS_Modal', 
                phase: 2,
                timeout: 8000
            },
            { 
                file: 'tw-scheduler-farm-modal.js', 
                check: 'TWS_FarmInteligente', 
                phase: 2,
                timeout: 8000
            },
            { 
                file: 'tw-scheduler-config-modal.js', 
                check: 'TWS_ConfigModal', 
                phase: 2,
                timeout: 8000
            },
            
            // FASE 3: Frontend e extras (últimos)
            { 
                file: 'tw-scheduler-frontend.js', 
                check: 'TWS_Panel', 
                phase: 3,
                timeout: 15000
            },
            { 
                file: 'tw-scheduler-bbcode-modal.js', 
                check: 'TWS_BBCodeModal', 
                phase: 3,
                timeout: 5000
            },
            { 
                file: 'tw-scheduler-test-modal.js', 
                check: 'TWS_TestModal', 
                phase: 3,
                timeout: 5000
            },
            { 
                file: 'tw-scheduler-multitab-lock.js', 
                check: 'TWS_MultiTabLock', 
                phase: 3,
                timeout: 5000
            },
            { 
                file: 'telegram-bot.js', 
                check: 'TelegramBotReal', 
                phase: 3,
                timeout: 5000
            }
        ]
    };

    // ⭐ FUNÇÃO DE CARREGAMENTO PARALELO ⭐
    async function loadScriptParallel(scriptInfo) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), scriptInfo.timeout);
        
        try {
            // Fetch com timeout
            const response = await fetch(url, { 
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.warn(`[Stealth] HTTP ${response.status}: ${scriptInfo.file}`);
                return false;
            }
            
            const code = await response.text();
            
            // Execute imediatamente
            new Function(code)();
            
            // Verificação rápida
            return await new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 5;
                const checkInterval = 300;
                
                const check = () => {
                    attempts++;
                    
                    if (window[scriptInfo.check]) {
                        console.log(`[Stealth] ✓ ${scriptInfo.file}`);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        console.log(`[Stealth] → ${scriptInfo.file} (timeout check)`);
                        resolve(false);
                    } else {
                        setTimeout(check, checkInterval);
                    }
                };
                
                check();
            });
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn(`[Stealth] Timeout: ${scriptInfo.file}`);
            } else {
                console.warn(`[Stealth] Erro: ${scriptInfo.file}`, error.message);
            }
            return false;
        }
    }

    // ⭐ CARREGAMENTO POR FASES COM PARALELISMO ⭐
    async function carregarPorFases() {
        console.log('[Stealth] 🚀 Iniciando carregamento otimizado...');
        progressNotifier.update(1, 'Carregando sistema base...');
        
        // FASE 1: Sistema base (crítico)
        const fase1Scripts = CONFIG.scripts.filter(s => s.phase === 1);
        console.log(`[Stealth] Fase 1: ${fase1Scripts.length} script(s) base`);
        
        for (const script of fase1Scripts) {
            await loadScriptParallel(script);
        }
        
        // Pequena pausa para estabilização
        await new Promise(r => setTimeout(r, 1000));
        progressNotifier.update(2, 'Carregando módulos principais...');
        
        // FASE 2: Módulos principais (em paralelo)
        const fase2Scripts = CONFIG.scripts.filter(s => s.phase === 2);
        console.log(`[Stealth] Fase 2: ${fase2Scripts.length} módulos (paralelo)`);
        
        // Carrega em paralelo com limite de concorrência
        const parallelLimit = 2;
        for (let i = 0; i < fase2Scripts.length; i += parallelLimit) {
            const batch = fase2Scripts.slice(i, i + parallelLimit);
            await Promise.allSettled(batch.map(script => loadScriptParallel(script)));
            await new Promise(r => setTimeout(r, 500)); // Pequeno delay entre batches
        }
        
        progressNotifier.update(3, 'Finalizando interface...');
        
        // FASE 3: Interface e extras (paralelo com prioridade no frontend)
        const fase3Scripts = CONFIG.scripts.filter(s => s.phase === 3);
        console.log(`[Stealth] Fase 3: ${fase3Scripts.length} módulos finais`);
        
        // Frontend primeiro
        const frontend = fase3Scripts.find(s => s.file === 'tw-scheduler-frontend.js');
        if (frontend) {
            await loadScriptParallel(frontend);
        }
        
        // Resto em paralelo
        const outros = fase3Scripts.filter(s => s.file !== 'tw-scheduler-frontend.js');
        await Promise.allSettled(outros.map(script => loadScriptParallel(script)));
        
        // Verificação final rápida
        await new Promise(r => setTimeout(r, 2000));
        console.log('[Stealth] ✅ Carregamento completo');
        progressNotifier.update(3, 'Sistema pronto!');
        
        // Indicador minimalista
        setTimeout(() => {
            if (!document.querySelector('#tws-minimal-indicator')) {
                const indicator = document.createElement('div');
                indicator.id = 'tws-minimal-indicator';
                indicator.textContent = 'TW✓';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 2px;
                    right: 2px;
                    font-size: 9px;
                    color: #4CAF50;
                    opacity: 0.3;
                    z-index: 999997;
                    font-family: Arial, sans-serif;
                    cursor: default;
                    user-select: none;
                    pointer-events: none;
                `;
                document.body.appendChild(indicator);
            }
        }, 1000);
    }

    // ⭐ DETECÇÃO INTELIGENTE DE PÁGINA ⭐
    function detectarPaginaJogo() {
        // Verificação rápida por URL
        if (!window.location.href.includes('/game.php')) return false;
        
        // Verificação por elementos com timeout
        const elementosChave = [
            '#game_header',
            '.menu-row',
            '#village_map'
        ];
        
        for (const selector of elementosChave) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        
        return false;
    }

    // ⭐ INICIALIZAÇÃO RÁPIDA ⭐
    async function iniciarCarregamentoRapido() {
        if (!detectarPaginaJogo()) {
            console.log('[Stealth] ⏳ Aguardando página do jogo...');
            
            // Tenta detectar novamente após 3 segundos
            setTimeout(() => {
                if (detectarPaginaJogo()) {
                    console.log('[Stealth] ✅ Página detectada (tentativa 2)');
                    carregarPorFases().catch(console.error);
                }
            }, 3000);
            
            return;
        }
        
        console.log('[Stealth] ✅ Página do jogo detectada');
        
        // Delay inicial aleatório reduzido
        const delayInicial = Math.random() * 3000 + 1000;
        console.log(`[Stealth] ⏳ Iniciando em ${Math.round(delayInicial/1000)}s...`);
        
        setTimeout(() => {
            carregarPorFases().catch(err => {
                console.error('[Stealth] Erro no carregamento:', err);
                progressNotifier.hide();
            });
        }, delayInicial);
    }

    // ⭐ PONTO DE ENTRADA OTIMIZADO ⭐
    function iniciar() {
        console.log('[Stealth] 🌟 Iniciando carregador otimizado...');
        
        // Verifica se já está pronto
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(iniciarCarregamentoRapido, 500);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(iniciarCarregamentoRapido, 500);
            }, { once: true });
        }
    }

    // Inicia com pequeno delay
    setTimeout(iniciar, 800);

})();
