// tws_carregador_stealth.js - VERSÃO 2.3 COM NOTIFICAÇÕES
(function() {
    'use strict';

    if (window.__TWS_STEALTH_CARREGADOR_V2) {
        console.log('[Stealth] Já carregado, ignorando...');
        return;
    }
    window.__TWS_STEALTH_CARREGADOR_V2 = Date.now();

    // Informações de versão
    const VERSAO_CARREGADOR = '2.3';
    console.log(`[Stealth] Inicializado - Versão ${VERSAO_CARREGADOR} (com notificações) - ${new Date().toLocaleString()}`);

    // ============================================
    // SISTEMA DE NOTIFICAÇÕES VISUAIS
    // ============================================
    class ProgressNotifier {
        constructor() {
            this.notification = null;
            this.progressBar = null;
            this.stepText = null;
            this.counter = null;
            this.currentStep = 0;
            this.totalSteps = 11; // Corrigido: Total de scripts
            this.isMinimized = false;
            
            this.scriptNames = {
                'telegram-bot.js': 'Telegram Bot',
                'tw-scheduler-backend.js': 'Backend do Scheduler',
                'tw-scheduler-multitab-lock.js': 'Proteção MultiTab',
                'tw-scheduler-config-modal.js': 'Configurações',
                'tw-scheduler-modal.js': 'Modal Principal',
                'tw-scheduler-bbcode-modal.js': 'Editor BBCode',
                'tw-scheduler-test-modal.js': 'Modo de Testes',
                'tw-scheduler-farm-modal.js': 'Farm Inteligente',
                'tw-scheduler-frontend.js': 'Interface Gráfica'
            };
            
            this.createNotification();
        }
        
        createNotification() {
            // Remover notificação anterior se existir
            const oldNotif = document.getElementById('tws-progress-notification');
            if (oldNotif && oldNotif.parentNode) {
                oldNotif.parentNode.removeChild(oldNotif);
            }
            
            // Criar container da notificação
            this.notification = document.createElement('div');
            this.notification.id = 'tws-progress-notification';
            this.notification.style.cssText = `
                position: fixed;
                top: 80px;
                right: 10px;
                width: 320px;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                border: 2px solid #654321;
                border-radius: 8px;
                padding: 16px;
                z-index: 999998;
                font-family: Arial, sans-serif;
                color: #f1e1c1;
                box-shadow: 0 4px 20px rgba(0,0,0,0.7);
                animation: twsSlideInRight 0.3s ease-out;
            `;
            
            // Título
            const title = document.createElement('div');
            title.style.cssText = `
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 12px;
                color: #d4b35d;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            title.innerHTML = '🔄 <span>TW Scheduler Carregando...</span>';
            
            // Barra de progresso
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                height: 6px;
                background: rgba(0,0,0,0.3);
                border-radius: 3px;
                margin: 10px 0;
                overflow: hidden;
            `;
            
            this.progressBar = document.createElement('div');
            this.progressBar.style.cssText = `
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #27ae60 0%, #2ecc71 100%);
                border-radius: 3px;
                transition: width 0.5s ease;
            `;
            
            progressContainer.appendChild(this.progressBar);
            
            // Texto do passo atual
            this.stepText = document.createElement('div');
            this.stepText.style.cssText = `
                font-size: 12px;
                margin: 8px 0;
                min-height: 16px;
                color: #95a5a6;
                font-style: italic;
            `;
            this.stepText.textContent = 'Preparando carregamento...';
            
            // Contador
            this.counter = document.createElement('div');
            this.counter.style.cssText = `
                font-size: 11px;
                text-align: right;
                color: #7f8c8d;
                margin-top: 8px;
            `;
            this.counter.textContent = 'Aguardando início...';
            
            // Botão de minimizar
            const minimizeBtn = document.createElement('div');
            minimizeBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                width: 20px;
                height: 20px;
                background: rgba(0,0,0,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 12px;
                color: #95a5a6;
                transition: all 0.2s;
            `;
            minimizeBtn.textContent = '−';
            minimizeBtn.title = 'Minimizar notificação';
            minimizeBtn.onclick = () => this.toggleMinimize();
            minimizeBtn.onmouseover = () => minimizeBtn.style.background = 'rgba(0,0,0,0.3)';
            minimizeBtn.onmouseout = () => minimizeBtn.style.background = 'rgba(0,0,0,0.2)';
            
            // Montar notificação
            this.notification.appendChild(minimizeBtn);
            this.notification.appendChild(title);
            this.notification.appendChild(progressContainer);
            this.notification.appendChild(this.stepText);
            this.notification.appendChild(this.counter);
            
            document.body.appendChild(this.notification);
            
            // Adicionar animações CSS
            this.addNotificationStyles();
        }
        
        addNotificationStyles() {
            if (document.getElementById('tws-notification-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'tws-notification-styles';
            style.textContent = `
                @keyframes twsSlideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes twsSlideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                @keyframes twsPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                #tws-progress-notification.minimized {
                    width: 40px !important;
                    height: 40px !important;
                    padding: 0 !important;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                #tws-progress-notification.minimized:hover {
                    background: linear-gradient(135deg, #2d2d2d 0%, #3d3d3d 100%) !important;
                }
                #tws-progress-notification.minimized > *:not(:first-child) {
                    display: none !important;
                }
                #tws-progress-notification.minimized > div:first-child {
                    position: static !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: none !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        toggleMinimize() {
            if (this.isMinimized) {
                this.expand();
            } else {
                this.minimize();
            }
        }
        
        minimize() {
            if (this.notification && !this.isMinimized) {
                this.notification.classList.add('minimized');
                this.isMinimized = true;
                this.notification.title = `TW Scheduler: ${this.currentStep}/${this.totalSteps}`;
                // Trocar ícone para +
                const btn = this.notification.querySelector('div:first-child');
                if (btn) btn.textContent = '+';
            }
        }
        
        expand() {
            if (this.notification && this.isMinimized) {
                this.notification.classList.remove('minimized');
                this.isMinimized = false;
                this.notification.title = '';
                // Restaurar ícone para -
                const btn = this.notification.querySelector('div:first-child');
                if (btn) btn.textContent = '−';
                this.update(this.currentStep, this.stepText.textContent);
            }
        }
        
        show() {
            if (this.notification) {
                this.notification.style.display = 'block';
                // Auto-minimizar após 8 segundos
                setTimeout(() => {
                    if (this.notification && !this.isMinimized && this.currentStep < this.totalSteps) {
                        this.minimize();
                    }
                }, 8000);
            }
        }
        
        update(step, scriptFile) {
            this.currentStep = step;
            const progress = (step / this.totalSteps) * 100;
            const scriptName = this.scriptNames[scriptFile] || scriptFile;
            
            // Atualizar barra de progresso
            if (this.progressBar) {
                this.progressBar.style.width = `${progress}%`;
                
                // Mudar cor conforme progresso
                if (progress < 30) {
                    this.progressBar.style.background = 'linear-gradient(90deg, #e74c3c 0%, #f39c12 100%)';
                } else if (progress < 70) {
                    this.progressBar.style.background = 'linear-gradient(90deg, #f39c12 0%, #f1c40f 100%)';
                } else {
                    this.progressBar.style.background = 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)';
                }
            }
            
            // Atualizar texto
            if (this.stepText) {
                this.stepText.textContent = scriptName ? `Carregando: ${scriptName}` : 'Processando...';
                this.stepText.style.animation = 'twsPulse 0.5s';
                setTimeout(() => {
                    if (this.stepText) this.stepText.style.animation = '';
                }, 500);
            }
            
            // Atualizar contador
            if (this.counter) {
                this.counter.textContent = `Progresso: ${step}/${this.totalSteps} (${Math.round(progress)}%)`;
            }
            
            // Mostrar notificação no primeiro update
            if (step === 1) {
                setTimeout(() => this.show(), 300);
            }
            
            // Se completou, mostrar sucesso
            if (step >= this.totalSteps) {
                setTimeout(() => this.showSuccess(), 1000);
            }
        }
        
        showSuccess() {
            if (!this.notification) return;
            
            // Expandir se minimizado
            if (this.isMinimized) {
                this.expand();
            }
            
            // Mudar para estilo de sucesso
            this.notification.style.background = 'linear-gradient(135deg, #27ae60 0%, #1e8449 100%)';
            this.notification.style.borderColor = '#2ecc71';
            
            // Atualizar conteúdo
            const title = this.notification.children[1]; // Segundo filho é o título
            if (title && title.tagName === 'DIV') {
                title.innerHTML = '✅ <span>TW Scheduler Pronto!</span>';
                title.style.color = 'white';
            }
            
            if (this.stepText) {
                this.stepText.textContent = 'Todos os módulos carregados com sucesso!';
                this.stepText.style.color = 'rgba(255,255,255,0.9)';
                this.stepText.style.fontStyle = 'normal';
            }
            
            if (this.progressBar) {
                this.progressBar.style.width = '100%';
            }
            
            if (this.counter) {
                this.counter.textContent = 'Sistema totalmente operacional';
                this.counter.style.color = 'rgba(255,255,255,0.8)';
            }
            
            // Remover botão de minimizar
            const minimizeBtn = this.notification.children[0];
            if (minimizeBtn) {
                minimizeBtn.style.display = 'none';
            }
            
            // Auto-fechar após 5 segundos
            setTimeout(() => {
                if (this.notification && this.notification.style.display !== 'none') {
                    this.hide();
                }
            }, 5000);
        }
        
        error(message) {
            if (!this.notification) return;
            
            // Expandir se minimizado
            if (this.isMinimized) {
                this.expand();
            }
            
            this.notification.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
            this.notification.style.borderColor = '#e74c3c';
            
            const title = this.notification.children[1];
            if (title && title.tagName === 'DIV') {
                title.innerHTML = '❌ <span>Erro no Carregamento</span>';
                title.style.color = 'white';
            }
            
            if (this.stepText) {
                this.stepText.textContent = message;
                this.stepText.style.color = 'white';
            }
            
            if (this.counter) {
                this.counter.textContent = 'Clique para fechar';
                this.counter.style.color = 'rgba(255,255,255,0.8)';
                this.counter.style.cursor = 'pointer';
                this.counter.onclick = () => this.hide();
            }
        }
        
        hide() {
            if (this.notification) {
                this.notification.style.animation = 'twsSlideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (this.notification && this.notification.parentNode) {
                        this.notification.parentNode.removeChild(this.notification);
                        this.notification = null;
                    }
                }, 300);
            }
        }
    }

    // Criar instância global
    const progressNotifier = new ProgressNotifier();
    window.twsProgress = progressNotifier;

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

    // ⭐ FUNÇÃO PRINCIPAL STEALTH COM TIMEOUT ⭐
    async function carregarScriptStealth(scriptInfo, isEssential) {
        const url = CONFIG.baseUrl + scriptInfo.file;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
        
        try {
            // Fetch com timeout
            const response = await fetch(url, { 
                signal: controller.signal 
            });
            
            if (!response.ok) {
                console.warn(`[Stealth] HTTP ${response.status} em ${scriptInfo.file}`);
                progressNotifier.error(`Falha ao carregar: ${scriptInfo.file}`);
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
                                progressNotifier.error(`${scriptInfo.check} não inicializou`);
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
                progressNotifier.error(`Erro em: ${scriptInfo.file}`);
                return !isEssential; // Se não é essencial, continua
            }
            
        } catch (fetchError) {
            console.warn(`[Stealth] Fetch ${scriptInfo.file}:`, fetchError.message);
            progressNotifier.error(`Falha de rede: ${scriptInfo.file}`);
            return !isEssential; // Se não é essencial, continua
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // ⭐ CARREGAMENTO INTELIGENTE COM NOTIFICAÇÕES ⭐
    async function carregarTudoInteligente() {
        console.log('[Stealth] 🚀 Iniciando carregamento (frontend no final)...');
        
        // Atualizar notificação inicial
        progressNotifier.update(0, 'Preparando sistema...');
        
        // SEPARAÇÃO CORRIGIDA: backend é o ÚNICO essencial na fase 1
        const essentialScripts = CONFIG.scripts.filter(s => s.essential && s.file === 'tw-scheduler-backend.js');
        const nonEssentialScripts = CONFIG.scripts.filter(s => !s.essential || s.file !== 'tw-scheduler-backend.js');
        
        console.log(`[Stealth] Estratégia: 1 essencial + ${nonEssentialScripts.length} não-essenciais`);
        
        // === FASE 1: APENAS BACKEND ===
        console.log('[Stealth] 📦 Fase 1: Backend (base do sistema)');
        progressNotifier.update(1, 'tw-scheduler-backend.js');
        
        if (essentialScripts.length > 0) {
            const backend = essentialScripts[0];
            const delay = CONFIG.delays.essential[0] || 0;
            
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${delay/1000}s...`);
                progressNotifier.stepText.textContent = `Aguardando ${delay/1000}s antes do Backend...`;
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
            const stepNumber = i + 2; // +2 porque Fase 1 foi step 1
            
            // Atualizar progresso
            progressNotifier.update(stepNumber, script.file);
            
            // Aplica delay
            if (delay > 0) {
                console.log(`[Stealth] ⏳ Aguardando ${Math.round(delay/1000)}s...`);
                progressNotifier.stepText.textContent = `Aguardando ${Math.round(delay/1000)}s... (modo stealth)`;
                await new Promise(r => setTimeout(r, delay));
            }
            
            console.log(`[Stealth] [${i+1}/${nonEssentialScripts.length}] ${script.file}${isFrontend ? ' (FRONTEND - ÚLTIMO!)' : ''}`);
            
            // Para o frontend, verificamos se os modais já carregaram
            if (isFrontend) {
                console.log('[Stealth] 🔍 Verificando se modais estão prontos...');
                progressNotifier.stepText.textContent = 'Verificando se todos os módulos estão prontos...';
                
                const modaisNecessarios = ['TWS_ConfigModal', 'TWS_Modal', 'TWS_BBCodeModal', 'TWS_TestModal', 'TWS_FarmInteligente'];
                const modaisCarregados = modaisNecessarios.filter(m => window[m]).length;
                
                if (modaisCarregados < 3) {
                    console.warn(`[Stealth] ⚠️ Apenas ${modaisCarregados}/5 modais carregados, frontend pode ter warnings`);
                    progressNotifier.stepText.textContent = `⚠️ Apenas ${modaisCarregados}/5 módulos principais carregados`;
                } else {
                    console.log(`[Stealth] ✅ ${modaisCarregados}/5 modais carregados, frontend deve funcionar bem`);
                    progressNotifier.stepText.textContent = `✅ ${modaisCarregados}/5 módulos principais prontos`;
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
        progressNotifier.update(11, 'Finalizando verificação...');
        
        const componentes = [
            { nome: 'Backend', var: 'TWS_Backend', critico: true },
            { nome: 'Config Modal', var: 'TWS_ConfigModal', critico: false },
            { nome: 'Modal Principal', var: 'TWS_Modal', critico: false },
            { nome: 'BBCode Modal', var: 'TWS_BBCodeModal', critico: false },
            { nome: 'Test Modal', var: 'TWS_TestModal', critico: false },
            { nome: 'Farm Modal', var: 'TWS_FarmInteligente', critico: false },
            { nome: 'MultiTab Lock', var: 'TWS_MultiTabLock', critico: false },
            { nome: 'Telegram Bot', var: 'TelegramBotReal', critico: false },
            { nome: 'Frontend/Panel', var: 'TWS_Panel', critico: true }
        ];
        
        const total = componentes.length;
        const carregados = componentes.filter(c => window[c.var]).length;
        const criticosCarregados = componentes.filter(c => c.critico && window[c.var]).length;
        
        console.log(`[Stealth] 📊 ${carregados}/${total} componentes carregados`);
        console.log(`[Stealth] ✅ ${criticosCarregados}/2 componentes críticos (backend + frontend)`);
        
        if (criticosCarregados === 2) {
            console.log('[Stealth] 🎉 TW Scheduler funcionando!');
            
            // Mostrar sucesso na notificação
            setTimeout(() => {
                progressNotifier.showSuccess();
            }, 500);
            
            // Indicador stealth mínimo permanente
            setTimeout(() => {
                if (document.querySelector('#tws-stealth-indicator')) return;
                
                const indicator = document.createElement('div');
                indicator.id = 'tws-stealth-indicator';
                indicator.textContent = 'TW✓';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 2px;
                    right: 2px;
                    font-size: 9px;
                    color: #4CAF50;
                    opacity: 0.4;
                    z-index: 999997;
                    font-family: Arial, sans-serif;
                    cursor: default;
                    user-select: none;
                `;
                indicator.title = `TW Scheduler Stealth v${VERSAO_CARREGADOR}\n${carregados}/${total} módulos carregados\n${new Date().toLocaleTimeString()}`;
                
                // Adicionar botão para reabrir notificação
                indicator.onclick = () => {
                    if (!document.getElementById('tws-progress-notification')) {
                        progressNotifier.createNotification();
                        progressNotifier.update(carregados, 'Sistema Operacional');
                        progressNotifier.showSuccess();
                    }
                };
                
                document.body.appendChild(indicator);
            }, 3000);
        } else {
            console.warn('[Stealth] ⚠️ Carregamento incompleto');
            progressNotifier.error(`Apenas ${criticosCarregados}/2 componentes críticos carregados`);
        }
    }

    // ⭐ DETECTOR DE PÁGINA DE JOGO MELHORADO ⭐
    function verificarPaginaJogo() {
        const url = window.location.href;
        
        // Verificar se é Tribal Wars
        if (!window.location.hostname.includes('tribalwars')) {
            console.log('[Stealth] ❌ Não é domínio do Tribal Wars');
            return false;
        }
        
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
            '#menu_row',
            '#village_ress',
            '.quickbar'
        ];
        
        for (const selector of gameSelectors) {
            if (document.querySelector(selector)) {
                console.log(`[Stealth] ✅ Selector de jogo encontrado: ${selector}`);
                return true;
            }
        }
        
        return false;
    }

    // ⭐ INICIALIZAÇÃO PRINCIPAL COM NOTIFICAÇÃO ⭐
    function iniciarStealth() {
        if (!verificarPaginaJogo()) {
            console.log('[Stealth] ⏳ Não é página de jogo, aguardando...');
            progressNotifier.error('Não está na página do jogo. Aguardando...');
            setTimeout(iniciarStealth, 5000);
            return;
        }
        
        console.log('[Stealth] ✅ Página de jogo detectada!');
        progressNotifier.update(0, 'Página do jogo detectada!');
        
        // Espera aleatória importante para stealth
        const esperaInicial = Math.random() * 8000 + 4000;
        console.log(`[Stealth] ⏳ Iniciando carregamento em ${Math.round(esperaInicial/1000)}s...`);
        progressNotifier.stepText.textContent = `Modo stealth ativo: Aguardando ${Math.round(esperaInicial/1000)}s...`;
        
        setTimeout(() => {
            progressNotifier.stepText.textContent = 'Iniciando carregamento dos módulos...';
            carregarTudoInteligente().catch(err => {
                console.error('[Stealth] Erro no processo principal:', err);
                progressNotifier.error(`Erro: ${err.message}`);
            });
        }, esperaInicial);
    }

    // ⭐ PONTO DE ENTRADA PRINCIPAL COM TRY-CATCH ⭐
    function iniciar() {
        console.log('[Stealth] 🌟 Inicializando carregador stealth...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('[Stealth] 📄 DOM carregado');
                progressNotifier.update(0, 'DOM carregado, preparando...');
                setTimeout(iniciarStealth, 2000);
            });
        } else {
            console.log('[Stealth] 📄 DOM já pronto');
            progressNotifier.update(0, 'DOM pronto, inicializando...');
            setTimeout(iniciarStealth, 3000);
        }
    }

    // ⭐ TRATAMENTO DE ERROS GLOBAL ⭐
    try {
        // Delay inicial para não interferir com carregamento da página
        setTimeout(() => {
            try {
                iniciar();
            } catch (initError) {
                console.error('[Stealth] Erro na inicialização:', initError);
                if (progressNotifier) {
                    progressNotifier.error(`Erro de inicialização: ${initError.message}`);
                }
            }
        }, 1000);
        
        // Capturar erros não tratados
        window.addEventListener('error', function(e) {
            console.error('[Stealth] Erro global capturado:', e.error);
            if (progressNotifier) {
                progressNotifier.error(`Erro JavaScript: ${e.message}`);
            }
        });
        
    } catch (globalError) {
        console.error('[Stealth] Erro fatal no carregador:', globalError);
        // Tentar mostrar erro mesmo sem notificação
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #e74c3c;
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 12px;
        `;
        errorDiv.textContent = `TW Scheduler Erro: ${globalError.message}`;
        document.body.appendChild(errorDiv);
    }

})();
