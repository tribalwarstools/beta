// tws_carregador_stealth.js - VERSÃO 3.3 (Farm + Config + Velocity)
(function() {
    'use strict';

    if (window.__TWS_STEALTH_V3) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_V3 = Date.now();

    console.log('[Stealth] Inicializado - Versão 3.3 (Farm + Config + Velocity)');

    // ============================================
    // NOTIFICAÇÃO ULTRA MINIMALISTA
    // ============================================
    class TurboNotifier {
        constructor() {
            this.step = 0;
            this.maxSteps = 4; // Aumentado para 4 fases
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
                const colors = ['#e74c3c', '#f39c12', '#3498db', '#27ae60'];
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

    // ⭐ CONFIGURAÇÃO TURBO OTIMIZADA ⭐
    const TURBO_CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        
        // ORDEM CRÍTICA OTIMIZADA: Dependências respeitadas
        scripts: {
            // FASE 1: CORE ESSENCIAL (dependência de todos)
            phase1: [
                { 
                    file: 'tw-scheduler-backend.js', 
                    check: 'TWS_Backend',
                    priority: 'critical',
                    description: 'Backend Core'
                }
            ],
            
            // FASE 2: VELOCITY MANAGER (deve vir ANTES do Farm Core)
            phase2: [
                { 
                    file: 'farm-inteligente/velocity-manager.js', // ⭐ NOVO
                    check: 'TWS_FarmInteligente.VelocityManager',
                    priority: 'high',
                    description: 'Velocity Manager'
                },
                { 
                    file: 'tw-scheduler-config-modal.js', // Config antes do Farm
                    check: 'TWS_ConfigModal',
                    priority: 'high',
                    description: 'Config Modal'
                }
            ],
            
            // FASE 3: FARM CORE + UI (depende do Velocity Manager)
            phase3: [
                { 
                    file: 'farm-inteligente/farm-core.js', 
                    check: 'TWS_FarmInteligente.Core',
                    priority: 'high',
                    description: 'Farm Core'
                },
                { 
                    file: 'tw-scheduler-modal.js', 
                    check: 'TWS_Modal',
                    priority: 'high',
                    description: 'Scheduler Modal'
                },
                { 
                    file: 'tw-scheduler-frontend.js', 
                    check: 'TWS_Panel',
                    priority: 'high',
                    description: 'Frontend Panel'
                },
                { 
                    file: 'farm-inteligente/farm-ui.js', 
                    check: 'TWS_FarmInteligente.UI',
                    priority: 'high',
                    description: 'Farm UI'
                }
            ],
            
            // FASE 4: MÓDULOS EXTRAS (background)
            phase4: [
                { 
                    file: 'farm-inteligente/farm-init.js', 
                    check: 'TWS_FarmInteligente.show',
                    priority: 'medium',
                    description: 'Farm Init'
                },
                { 
                    file: 'tw-scheduler-bbcode-modal.js', 
                    check: 'TWS_BBCodeModal',
                    priority: 'low',
                    description: 'BBCode Modal'
                },
                { 
                    file: 'tw-scheduler-test-modal.js', 
                    check: 'TWS_TestModal',
                    priority: 'low',
                    description: 'Test Modal'
                },
                { 
                    file: 'tw-scheduler-multitab-lock.js', 
                    check: 'TWS_MultiTabLock',
                    priority: 'medium',
                    description: 'MultiTab Lock'
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
        const url = window.location.href;
        
        // Check rápido de URL
        if (!url.includes('game.php') && !url.includes('screen=')) {
            return false;
        }
        
        // Check rápido de elementos
        const quickCheck = document.querySelector('#game_header, .menu-row, #village_map, .vis');
        if (quickCheck) return true;
        
        // Fallback
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

    // ⭐ LOADER TURBO COM VERIFICAÇÃO DE DEPENDÊNCIAS ⭐
    async function carregarScriptTurbo(scriptInfo) {
        const url = TURBO_CONFIG.baseUrl + scriptInfo.file;
        const cacheKey = `tws_cache_${scriptInfo.file.replace(/\//g, '_')}`;
        
        try {
            // Verificar pré-requisitos específicos
            if (scriptInfo.requires) {
                const missing = scriptInfo.requires.filter(req => !checkObjectExists(req));
                if (missing.length > 0) {
                    console.log(`[Turbo] ⏳ Aguardando dependências: ${scriptInfo.file} (${missing.join(', ')})`);
                    return false;
                }
            }
            
            // Tentar cache primeiro
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                console.log(`[Turbo] ♻️ Cache: ${scriptInfo.description || scriptInfo.file}`);
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
                        const time = Date.now() - start;
                        console.log(`[Turbo] ✓ ${scriptInfo.description || scriptInfo.file} (${time}ms)`);
                        resolve(true);
                    } else if (Date.now() - start > 3000) {
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
                console.log(`[Turbo] ⏱️ Timeout: ${scriptInfo.description || scriptInfo.file}`);
            } else {
                console.log(`[Turbo] ❌ ${scriptInfo.description || scriptInfo.file}: ${error.message}`);
            }
            return false;
        }
    }

    // ⭐ CARREGAMENTO SEQUENCIAL COM DEPENDÊNCIAS ⭐
    async function carregarSequencial(scripts, phaseName) {
        console.log(`[Turbo] 🚀 ${phaseName}: ${scripts.length} scripts`);
        
        const results = [];
        
        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];
            const result = await carregarScriptTurbo(script);
            results.push(result);
            
            // Pequena pausa entre scripts da mesma fase
            if (i < scripts.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
        
        const successCount = results.filter(r => r).length;
        console.log(`[Turbo] ✅ ${phaseName}: ${successCount}/${scripts.length} carregados`);
        
        return successCount;
    }

    // ⭐ PROCESSO TURBO PRINCIPAL COM ORDEM CRÍTICA ⭐
    async function iniciarTurbo() {
        if (!detectarPaginaTurbo()) {
            console.log('[Turbo] ⏳ Aguardando página do jogo...');
            setTimeout(iniciarTurbo, 2000);
            return;
        }
        
        console.log('[Turbo] ✅ Página Tribal Wars detectada!');
        console.log('[Turbo] 📊 Mundo atual:', window.location.hostname);
        
        // Delay stealth
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        
        // === FASE 1: CORE ESSENCIAL ===
        notifier.update(1, 'Carregando backend');
        await carregarSequencial(TURBO_CONFIG.scripts.phase1, 'Fase 1 - Core Essencial');
        
        // === FASE 2: VELOCITY MANAGER + CONFIG ===
        notifier.update(2, 'Carregando gerenciador de velocidades');
        await carregarSequencial(TURBO_CONFIG.scripts.phase2, 'Fase 2 - Velocity + Config');
        
        // Verificação crítica: Velocity Manager carregou?
        if (!checkObjectExists('TWS_FarmInteligente.VelocityManager')) {
            console.warn('[Turbo] ⚠️ Velocity Manager não carregado! Farm usará velocidades padrão.');
        } else {
            console.log('[Turbo] ✅ Velocity Manager carregado - Buscando velocidades reais...');
        }
        
        // === FASE 3: FARM CORE + INTERFACE ===
        notifier.update(3, 'Carregando sistema de farm');
        await carregarSequencial(TURBO_CONFIG.scripts.phase3, 'Fase 3 - Farm + Interface');
        
        // === FASE 4: EXTRAS (background) ===
        notifier.update(4, 'Finalizando módulos');
        carregarSequencial(TURBO_CONFIG.scripts.phase4, 'Fase 4 - Extras')
            .then((successCount) => {
                console.log(`[Turbo] ✅ Carregamento concluído: ${successCount}/${TURBO_CONFIG.scripts.phase4.length} extras`);
                
                // ⭐ RELATÓRIO DE CARREGAMENTO DETALHADO ⭐
                console.log('[Turbo] 📊 ===== RELATÓRIO DE CARREGAMENTO =====');
                
                // Módulos principais
                console.log('  📦 MÓDULOS PRINCIPAIS:');
                console.log('    ✅ Backend:', !!window.TWS_Backend);
                console.log('    ✅ Frontend:', !!window.TWS_Panel);
                console.log('    ✅ Modal:', !!window.TWS_Modal);
                console.log('    ✅ Config:', !!window.TWS_ConfigModal);
                
                // Sistema Farm Inteligente
                console.log('  🌾 SISTEMA FARM INTELIGENTE:');
                console.log('    ✅ Velocity Manager:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.VelocityManager));
                console.log('    ✅ Farm Core:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core));
                console.log('    ✅ Farm UI:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.UI));
                console.log('    ✅ Farm Show:', !!(window.TWS_FarmInteligente && window.TWS_FarmInteligente.show));
                
                // Módulos extras
                console.log('  🔧 MÓDULOS EXTRAS:');
                console.log('    ✅ BBCode:', !!window.TWS_BBCodeModal);
                console.log('    ✅ Test:', !!window.TWS_TestModal);
                console.log('    ✅ MultiTab:', !!window.TWS_MultiTabLock);
                
                // Verificar se Velocity Manager está funcionando
                if (window.TWS_FarmInteligente && window.TWS_FarmInteligente.VelocityManager) {
                    setTimeout(() => {
                        const worldInfo = window.TWS_FarmInteligente.VelocityManager.getWorldInfo();
                        if (worldInfo && worldInfo.world) {
                            console.log(`[Turbo] 🌐 Velocity Manager ativo no mundo: ${worldInfo.world}`);
                            if (worldInfo.speeds) {
                                console.log(`[Turbo] 📏 Velocidades reais carregadas: ${Object.keys(worldInfo.speeds).length} unidades`);
                            }
                        }
                    }, 2000);
                }
                
                console.log('[Turbo] =====================================');
                
            })
            .catch(e => console.log('[Turbo] ⚠️ Erro nos extras:', e));
        
        // Verificação final do sistema
        setTimeout(() => {
            const essentialsLoaded = window.TWS_Backend && window.TWS_Panel;
            const farmCoreLoaded = window.TWS_FarmInteligente && window.TWS_FarmInteligente.Core;
            const velocityLoaded = window.TWS_FarmInteligente && window.TWS_FarmInteligente.VelocityManager;
            const configLoaded = window.TWS_ConfigModal;
            
            if (essentialsLoaded) {
                notifier.success();
                
                // Criar badge indicador permanente
                if (!document.querySelector('#tws-active-badge')) {
                    const badge = document.createElement('div');
                    badge.id = 'tws-active-badge';
                    
                    // Determinar texto e cor baseado nos módulos carregados
                    let badgeText = '✓';
                    let badgeTitle = 'TW Scheduler';
                    let badgeColor = '#3498db'; // Azul padrão
                    
                    if (farmCoreLoaded && velocityLoaded && configLoaded) {
                        badgeText = '🌾⚡⚙️✓';
                        badgeTitle = 'TW Scheduler + Farm + Velocity + Config';
                        badgeColor = '#9b59b6'; // Roxo - completo
                    } else if (farmCoreLoaded && velocityLoaded) {
                        badgeText = '🌾⚡✓';
                        badgeTitle = 'TW Scheduler + Farm + Velocity';
                        badgeColor = '#27ae60'; // Verde - farm com velocidades reais
                    } else if (farmCoreLoaded) {
                        badgeText = '🌾✓';
                        badgeTitle = 'TW Scheduler + Farm';
                        badgeColor = '#f39c12'; // Laranja - farm sem velocidades
                    } else if (configLoaded) {
                        badgeText = '⚙️✓';
                        badgeTitle = 'TW Scheduler + Config';
                        badgeColor = '#3498db'; // Azul
                    }
                    
                    badge.textContent = badgeText;
                    badge.title = badgeTitle;
                    badge.style.cssText = `
                        position: fixed;
                        bottom: 2px;
                        right: 2px;
                        font-size: 8px;
                        color: ${badgeColor};
                        opacity: 0.3;
                        z-index: 999997;
                        font-family: monospace;
                        pointer-events: none;
                        user-select: none;
                        transition: opacity 0.3s;
                        background: rgba(0,0,0,0.2);
                        padding: 1px 3px;
                        border-radius: 2px;
                    `;
                    badge.onmouseenter = () => badge.style.opacity = '0.7';
                    badge.onmouseleave = () => badge.style.opacity = '0.3';
                    document.body.appendChild(badge);
                }
                
                // Adicionar menu rápido se o Farm estiver carregado
                if (farmCoreLoaded && !document.querySelector('#tws-quick-menu')) {
                    setTimeout(() => {
                        const quickMenu = document.createElement('div');
                        quickMenu.id = 'tws-quick-menu';
                        quickMenu.style.cssText = `
                            position: fixed;
                            bottom: 20px;
                            right: 20px;
                            z-index: 999996;
                            opacity: 0;
                            transition: opacity 0.3s;
                            pointer-events: none;
                        `;
                        
                        const menuBtn = document.createElement('button');
                        menuBtn.innerHTML = '⚡';
                        menuBtn.title = 'Farm Inteligente - Menu Rápido';
                        menuBtn.style.cssText = `
                            background: #2c3e50;
                            border: none;
                            color: white;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                        `;
                        
                        menuBtn.onmouseenter = () => {
                            quickMenu.style.opacity = '1';
                            quickMenu.style.pointerEvents = 'all';
                        };
                        
                        menuBtn.onmouseleave = () => {
                            quickMenu.style.opacity = '0';
                            quickMenu.style.pointerEvents = 'none';
                        };
                        
                        // Adicionar funcionalidades ao menu
                        const menuContent = document.createElement('div');
                        menuContent.style.cssText = `
                            position: absolute;
                            bottom: 30px;
                            right: 0;
                            background: #34495e;
                            border-radius: 4px;
                            padding: 5px;
                            min-width: 150px;
                            display: none;
                            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                        `;
                        
                        if (velocityLoaded) {
                            const velocityBtn = document.createElement('button');
                            velocityBtn.textContent = '🔄 Velocidades';
                            velocityBtn.style.cssText = `
                                width: 100%;
                                padding: 5px;
                                margin: 2px 0;
                                background: #3498db;
                                border: none;
                                color: white;
                                border-radius: 2px;
                                cursor: pointer;
                                font-size: 10px;
                            `;
                            velocityBtn.onclick = () => {
                                if (window.TWS_FarmInteligente.Core) {
                                    window.TWS_FarmInteligente.Core.updateVelocitiesFromRealWorld();
                                }
                            };
                            menuContent.appendChild(velocityBtn);
                        }
                        
                        menuBtn.onclick = () => {
                            menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
                        };
                        
                        quickMenu.appendChild(menuContent);
                        quickMenu.appendChild(menuBtn);
                        document.body.appendChild(quickMenu);
                    }, 5000);
                }
                
            } else {
                console.log('[Turbo] ⚠️ Sistema parcialmente carregado');
            }
        }, 6000);
    }

    // ⭐ INICIALIZAÇÃO TURBO ⭐
    function init() {
        console.log('[Turbo] 🌟 Inicializando v3.3 (Farm + Config + Velocity)...');
        console.log('[Turbo] 🕐 Hora:', new Date().toLocaleTimeString());
        
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

    // Inicia com delay aleatório para stealth
    setTimeout(init, 800 + Math.random() * 1200);

})();
