// tws_carregador_stealth.js - VERSÃO 3.2 (Farm + Config Modular)
(function() {
    'use strict';

    if (window.__TWS_STEALTH_V3) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_V3 = Date.now();

    console.log('[Stealth] Inicializado - Versão 3.2 (Farm + Config Modular)');

    // ============================================
    // NOTIFICAÇÃO ULTRA MINIMALISTA
    // ============================================
    class TurboNotifier {
        constructor() {
            this.step = 0;
            this.maxSteps = 3; // Reduzido para 3 fases
            this.createIndicator();
        }
        
        createIndicator() {
            // Remove previous
            const old = document.getElementById('tws-turbo-indicator');
            if (old) old.remove();
            
            this.indicator = document.createElement('div');
            this.indicator.id = 'tws-turbo-indicator';
            this.indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(26, 26, 26, 0.9);
                border-left: 3px solid #654321;
                padding: 8px 12px;
                z-index: 999998;
                font-family: Arial, sans-serif;
                font-size: 11px;
                color: #d4b35d;
                border-radius: 3px;
                display: none;
                backdrop-filter: blur(2px);
            `;
            this.indicator.textContent = '🔄 TW Scheduler';
            document.body.appendChild(this.indicator);
        }
        
        update(phase, message) {
            this.step = phase;
            const percent = Math.round((phase / this.maxSteps) * 100);
            
            if (this.indicator) {
                const colors = ['#e74c3c', '#f39c12', '#27ae60'];
                this.indicator.style.borderLeftColor = colors[phase - 1] || colors[0];
                this.indicator.textContent = `🔄 TW: ${percent}%`;
                this.indicator.style.display = 'block';
                
                // Auto-hide after 2 seconds if not complete
                if (phase < this.maxSteps) {
                    setTimeout(() => {
                        if (this.indicator) this.indicator.style.display = 'none';
                    }, 2000);
                }
            }
            
            console.log(`[Stealth] ${message} (${percent}%)`);
        }
        
        success() {
            if (this.indicator) {
                this.indicator.style.borderLeftColor = '#27ae60';
                this.indicator.textContent = '✅ TW Pronto';
                setTimeout(() => {
                    if (this.indicator) this.indicator.style.display = 'none';
                }, 2000);
            }
            console.log('[Stealth] ✅ Sistema pronto!');
        }
    }

    const notifier = new TurboNotifier();

    // ⭐ CONFIGURAÇÃO TURBO ⭐
    const TURBO_CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // ORDEM OTIMIZADA: Paralelismo inteligente
        scripts: {
            // FASE 1: CORE (carrega imediatamente)
            phase1: [
                { 
                    file: 'tw-scheduler-backend.js', 
                    check: 'TWS_Backend',
                    priority: 'critical'
                }
            ],
            
            // FASE 2: ESSENCIAIS (carregam em paralelo após core)
            phase2: [
                { 
                    file: 'tw-scheduler-modal.js', 
                    check: 'TWS_Modal',
                    priority: 'high'
                },
                { 
                    file: 'tw-scheduler-frontend.js', 
                    check: 'TWS_Panel',
                    priority: 'high'
                },
                // 🆕 ADICIONADO: Módulos do Farm Inteligente
                { 
                    file: 'farm-inteligente/farm-core.js', 
                    check: 'TWS_FarmInteligente.Core',
                    priority: 'high'
                },
                { 
                    file: 'farm-inteligente/farm-ui.js', 
                    check: 'TWS_FarmInteligente.UI',
                    priority: 'high'
                }
            ],
            
            // FASE 3: EXTRAS (carregam em background)
            phase3: [
                // 🆕 ADICIONADO: Modal de Configurações (antes do farm-init)
                { 
                    file: 'tw-scheduler-config-modal.js', 
                    check: 'TWS_ConfigModal',
                    priority: 'high' // ⬅️ Aumentei para high para garantir carregamento
                },
                
                // 🆕 ADICIONADO: Inicialização do Farm (depende dos outros módulos)
                { 
                    file: 'farm-inteligente/farm-init.js', 
                    check: 'TWS_FarmInteligente.show',
                    priority: 'medium'
                },
                
                { 
                    file: 'tw-scheduler-bbcode-modal.js', 
                    check: 'TWS_BBCodeModal',
                    priority: 'low'
                },
                { 
                    file: 'tw-scheduler-test-modal.js', 
                    check: 'TWS_TestModal',
                    priority: 'low'
                },
                { 
                    file: 'tw-scheduler-multitab-lock.js', 
                    check: 'TWS_MultiTabLock',
                    priority: 'medium'
                }
            ]
        },
        
        // Timeouts otimizados
        timeouts: {
            critical: 10000,  // 10s para core
            high: 8000,       // 8s para essenciais
            medium: 6000,     // 6s para médios
            low: 4000         // 4s para baixos
        }
    };

    // ⭐ DETECTOR DE PÁGINA TURBO ⭐
    function detectarPaginaTurbo() {
        // Verificação ULTRA rápida
        const url = window.location.href;
        
        // 1. Check URL (fastest)
        if (!url.includes('game.php') && !url.includes('screen=')) {
            return false;
        }
        
        // 2. Check for ANY tribalwars element (single query for speed)
        const quickCheck = document.querySelector('#game_header, .menu-row, #village_map, .vis');
        if (quickCheck) return true;
        
        // 3. Check for game header text (fallback)
        const headers = document.querySelectorAll('h1, h2, h3, .header');
        for (const header of headers) {
            if (header.textContent.includes('Tribal Wars') || 
                header.textContent.includes('Village') ||
                header.textContent.includes('World')) {
                return true;
            }
        }
        
        return false;
    }
    
    // ⭐ HELPER: Verificar objetos aninhados ⭐
    function checkObjectExists(path) {
        try {
            return path.split('.').reduce((obj, key) => obj && obj[key], window) !== undefined;
        } catch (e) {
            return false;
        }
    }

    // ⭐ LOADER TURBO (com cache e paralelismo) ⭐
    async function carregarScriptTurbo(scriptInfo) {
        const url = TURBO_CONFIG.baseUrl + scriptInfo.file;
        const cacheKey = `tws_cache_${scriptInfo.file.replace(/\//g, '_')}`;
        
        try {
            // Tentar cache primeiro
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                console.log(`[Turbo] ♻️ Cache: ${scriptInfo.file}`);
                try {
                    new Function(cached)();
                    if (checkObjectExists(scriptInfo.check)) return true;
                } catch (e) {
                    console.log(`[Turbo] Cache inválido: ${scriptInfo.file}`);
                    localStorage.removeItem(cacheKey);
                }
            }
            
            // Fetch com timeout otimizado
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TURBO_CONFIG.timeouts[scriptInfo.priority]);
            
            const response = await fetch(url, {
                signal: controller.signal,
                cache: 'default'
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const code = await response.text();
            
            // Salvar no cache
            try {
                localStorage.setItem(cacheKey, code);
                localStorage.setItem(cacheKey + '_time', Date.now());
            } catch (e) {
                // Ignora erros de quota
            }
            
            // Executar
            new Function(code)();
            
            // Verificação com suporte para nested objects
            return await new Promise(resolve => {
                const start = Date.now();
                const check = () => {
                    if (checkObjectExists(scriptInfo.check)) {
                        console.log(`[Turbo] ✓ ${scriptInfo.file} (${Date.now() - start}ms)`);
                        resolve(true);
                    } else if (Date.now() - start > 3000) { // Max 3s wait
                        console.log(`[Turbo] ⏱️ ${scriptInfo.check} não verificado (timeout)`);
                        resolve(false);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`[Turbo] ⏱️ Timeout: ${scriptInfo.file}`);
            } else {
                console.log(`[Turbo] ❌ ${scriptInfo.file}: ${error.message}`);
            }
            return false;
        }
    }

    // ⭐ CARREGAMENTO PARALELO INTELIGENTE ⭐
    async function carregarParalelo(scripts, phaseName) {
        console.log(`[Turbo] 🚀 ${phaseName}: ${scripts.length} scripts`);
        
        // Limitar paralelismo para evitar overload
        const BATCH_SIZE = 2;
        const results = [];
        
        for (let i = 0; i < scripts.length; i += BATCH_SIZE) {
            const batch = scripts.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (script, idx) => {
                // Pequeno stagger entre scripts do mesmo batch
                if (idx > 0) await new Promise(r => setTimeout(r, 500));
                return await carregarScriptTurbo(script);
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);
            
            // Pequena pausa entre batches
            if (i + BATCH_SIZE < scripts.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        return results.filter(r => r.status === 'fulfilled' && r.value).length;
    }

    // ⭐ PROCESSO TURBO PRINCIPAL ⭐
    async function iniciarTurbo() {
        if (!detectarPaginaTurbo()) {
            console.log('[Turbo] ⏳ Aguardando página do jogo...');
            // Tenta novamente em 2 segundos
            setTimeout(iniciarTurbo, 2000);
            return;
        }
        
        console.log('[Turbo] ✅ Página detectada! Iniciando...');
        
        // Delay stealth mínimo
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        
        // === FASE 1: CORE ===
        notifier.update(1, 'Carregando sistema base');
        await carregarParalelo(TURBO_CONFIG.scripts.phase1, 'Fase 1 - Core');
        
        // === FASE 2: ESSENCIAIS ===
        notifier.update(2, 'Carregando interface');
        await carregarParalelo(TURBO_CONFIG.scripts.phase2, 'Fase 2 - Essenciais');
        
        // === FASE 3: EXTRAS (background) ===
        notifier.update(3, 'Finalizando módulos');
        carregarParalelo(TURBO_CONFIG.scripts.phase3, 'Fase 3 - Extras')
            .then((successCount) => {
                console.log(`[Turbo] ✅ ${successCount}/${TURBO_CONFIG.scripts.phase3.length} módulos carregados`);
                
                // Log específico do Farm Inteligente
                if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core) {
                    console.log('[Turbo] 🌾 Farm Inteligente modular carregado!');
                    console.log('[Turbo]   ✅ Core:', !!window.TWS_FarmInteligente.Core);
                    console.log('[Turbo]   ✅ UI:', !!window.TWS_FarmInteligente.UI);
                    console.log('[Turbo]   ✅ Show:', !!window.TWS_FarmInteligente.show);
                }
                
                // ⭐ NOVO: Verificar Modal de Configurações
                if (window.TWS_ConfigModal) {
                    console.log('[Turbo] ⚙️ Modal de Configurações carregado!');
                } else {
                    console.warn('[Turbo] ⚠️ Modal de Configurações NÃO carregado!');
                }
                
            })
            .catch(e => console.log('[Turbo] ⚠️ Extras:', e));
        
        // Verificação rápida do sistema
        setTimeout(() => {
            const essentialsLoaded = window.TWS_Backend && window.TWS_Panel;
            const farmLoaded = window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core;
            const configLoaded = window.TWS_ConfigModal; // ⭐ NOVO: Verificar config modal
            
            if (essentialsLoaded) {
                notifier.success();
                
                // Adicionar indicador permanente minimalista
                if (!document.querySelector('#tws-active-badge')) {
                    const badge = document.createElement('div');
                    badge.id = 'tws-active-badge';
                    let badgeText = '✓';
                    let badgeTitle = 'TW Scheduler';
                    
                    // ⭐ ATUALIZADO: Mostrar se config modal está carregado
                    if (farmLoaded && configLoaded) {
                        badgeText = '🌾⚙️✓';
                        badgeTitle = 'TW Scheduler + Farm + Config';
                    } else if (farmLoaded) {
                        badgeText = '🌾✓';
                        badgeTitle = 'TW Scheduler + Farm';
                    } else if (configLoaded) {
                        badgeText = '⚙️✓';
                        badgeTitle = 'TW Scheduler + Config';
                    }
                    
                    badge.textContent = badgeText;
                    badge.title = badgeTitle;
                    badge.style.cssText = `
                        position: fixed;
                        bottom: 2px;
                        right: 2px;
                        font-size: 8px;
                        color: ${farmLoaded && configLoaded ? '#9b59b6' : farmLoaded ? '#27ae60' : configLoaded ? '#3498db' : '#3498db'};
                        opacity: 0.3;
                        z-index: 999997;
                        font-family: monospace;
                        pointer-events: none;
                        user-select: none;
                        transition: opacity 0.3s;
                    `;
                    badge.onmouseenter = () => badge.style.opacity = '0.7';
                    badge.onmouseleave = () => badge.style.opacity = '0.3';
                    document.body.appendChild(badge);
                }
                
                // ⭐ NOVO: Log de status completo
                console.log('[Turbo] 📊 Status Final:');
                console.log('  ✅ Backend:', !!window.TWS_Backend);
                console.log('  ✅ Frontend:', !!window.TWS_Panel);
                console.log('  ✅ Modal:', !!window.TWS_Modal);
                console.log('  ✅ BBCode:', !!window.TWS_BBCodeModal);
                console.log('  ✅ Test:', !!window.TWS_TestModal);
                console.log('  ✅ Farm Core:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core));
                console.log('  ✅ Farm UI:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.UI));
                console.log('  ✅ Config:', !!window.TWS_ConfigModal);
                console.log('  ✅ MultiTab:', !!window.TWS_MultiTabLock);
                
            } else {
                console.log('[Turbo] ⚠️ Sistema parcialmente carregado');
            }
        }, 5000);
    }

    // ⭐ INICIALIZAÇÃO TURBO ⭐
    function init() {
        console.log('[Turbo] 🌟 Inicializando v3.2...');
        
        // Inicia imediatamente se a página já estiver pronta
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('[Turbo] 📄 DOM pronto');
                setTimeout(iniciarTurbo, 500);
            }, { once: true });
        } else {
            console.log('[Turbo] 📄 DOM já carregado');
            setTimeout(iniciarTurbo, 500);
        }
    }

    // Inicia com pequeno delay
    setTimeout(init, 800);

})();
