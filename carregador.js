(function() {
    'use strict';

    // Previne carregamento duplicado
    if (window.TWS_CARREGADOR_LOADED) {
        console.log('[Carregador] Já executado, ignorando...');
        return;
    }
    window.TWS_CARREGADOR_LOADED = true;

    console.log('[Carregador] 🚀 Iniciando TW Scheduler Multi v2.0...');

    // Configurações
    const CONFIG = {
        baseUrl: 'https://tribalwarstools.github.io/beta/',
        scripts: [
            { name: 'Backend', file: 'agendador_backend.js', check: 'TWS_Backend' },
            { name: 'Frontend', file: 'agendador_frontend.js', check: 'TWS_Panel' }
        ],
        timeout: 5000, // 5 segundos por script
        retryDelay: 100 // Verifica a cada 100ms
    };

    // Função para carregar um script
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            console.log(`[Carregador] 📥 Carregando: ${url}`);

            if (typeof $ !== 'undefined' && $.getScript) {
                // Usa jQuery
                $.getScript(url)
                    .done(() => {
                        console.log(`[Carregador] ✅ Carregado: ${url}`);
                        resolve();
                    })
                    .fail((jqxhr, settings, exception) => {
                        console.error(`[Carregador] ❌ Erro: ${url}`, exception);
                        reject(new Error(`Falha ao carregar ${url}: ${exception}`));
                    });
            } else {
                // Fallback: script tag nativo
                const script = document.createElement('script');
                script.src = url;
                script.async = true;

                script.onload = () => {
                    console.log(`[Carregador] ✅ Carregado: ${url}`);
                    resolve();
                };

                script.onerror = (error) => {
                    console.error(`[Carregador] ❌ Erro: ${url}`, error);
                    reject(new Error(`Falha ao carregar ${url}`));
                };

                document.head.appendChild(script);
            }
        });
    }

    // Função para aguardar objeto global estar disponível
    function waitForGlobal(globalName, timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (window[globalName]) {
                    clearInterval(checkInterval);
                    console.log(`[Carregador] ✅ ${globalName} disponível`);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout: ${globalName} não ficou disponível em ${timeout}ms`));
                }
            }, CONFIG.retryDelay);
        });
    }

    // Função para mostrar notificação visual
    function showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336',
            info: '#2196F3'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${colors[type]};
            color: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            text-align: center;
            min-width: 300px;
        `;
        notification.innerHTML = message;

        // Adiciona animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes twsNotification {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                10% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                15% { transform: translate(-50%, -50%) scale(1); }
                85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        notification.style.animation = `twsNotification ${duration}ms ease-in-out`;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
            style.remove();
        }, duration);
    }

    // Função principal de carregamento sequencial
    async function carregarScripts() {
        try {
            showNotification('⏳ Carregando TW Scheduler...', 'info', 2000);

            for (const script of CONFIG.scripts) {
                const url = CONFIG.baseUrl + script.file;

                // Carrega o script
                await loadScript(url);

                // Aguarda o objeto global estar disponível
                console.log(`[Carregador] ⏳ Aguardando ${script.check}...`);
                await waitForGlobal(script.check, CONFIG.timeout);

                console.log(`[Carregador] ✅ ${script.name} inicializado!`);
            }

            // Sucesso total
            console.log('[Carregador] 🎉 TW Scheduler carregado com sucesso!');
            showNotification('✅ TW Scheduler<br>carregado com sucesso!', 'success', 3000);

            // Log de informações úteis
            console.log('[Carregador] Comandos disponíveis:');
            console.log('  - TWS_Backend: funções de backend');
            console.log('  - TWS_Panel: funções de interface');
            console.log('  - Clique no botão 📅 no canto superior direito para abrir o painel');

        } catch (error) {
            console.error('[Carregador] ❌ Erro fatal:', error);
            showNotification(
                `❌ Erro ao carregar<br>TW Scheduler<br><small>${error.message}</small>`,
                'error',
                5000
            );
            alert(`[TW Scheduler] Erro ao carregar:\n\n${error.message}\n\nVerifique o console (F12) para mais detalhes.`);
        }
    }

    // Aguarda jQuery estar disponível
    function aguardarJQuery() {
        if (typeof $ !== 'undefined') {
            console.log('[Carregador] jQuery detectado');
            carregarScripts();
        } else {
            console.log('[Carregador] Aguardando jQuery...');
            setTimeout(aguardarJQuery, 100);
        }
    }

    // Inicia quando a página estiver pronta
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', aguardarJQuery);
    } else {
        aguardarJQuery();
    }

    console.log('[Carregador] Inicializado');
})();
