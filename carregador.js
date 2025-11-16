// ==UserScript==
// @name         TW Scheduler Multi v2.0
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Agendador avançado de ataques para Tribal Wars - carrega backend e frontend do GitHub
// @match        https://*.tribalwars.com.br/game.php*
// @grant        none
// @author       TribalWarsTools
// @updateURL    https://tribalwarstools.github.io/twscripts/tw_scheduler.user.js
// @downloadURL  https://tribalwarstools.github.io/twscripts/tw_scheduler.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Previne carregamento duplicado
    if (window.TWS_USERSCRIPT_LOADED) {
        console.log('[TW Scheduler] Já carregado, ignorando...');
        return;
    }
    window.TWS_USERSCRIPT_LOADED = true;

    // URLs dos scripts no GitHub
    const BACKEND_URL = 'https://tribalwarstools.github.io/beta/backend.js';
    const FRONTEND_URL = 'https://tribalwarstools.github.io/beta/frontend.js';

    // Status de carregamento
    let backendLoaded = false;
    let frontendLoaded = false;

    // Função para carregar scripts sequencialmente
    function loadScript(url, callback) {
        console.log(`[TW Scheduler] Carregando: ${url}`);

        if (typeof $ !== 'undefined' && $.getScript) {
            // Usa jQuery se disponível
            $.getScript(url)
                .done(function() {
                    console.log(`[TW Scheduler] ✅ Carregado: ${url}`);
                    if (callback) callback(null);
                })
                .fail(function(jqxhr, settings, exception) {
                    console.error(`[TW Scheduler] ❌ Erro ao carregar ${url}:`, exception);
                    if (callback) callback(exception);
                });
        } else {
            // Fallback: usa script tag nativo
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            script.onload = function() {
                console.log(`[TW Scheduler] ✅ Carregado: ${url}`);
                if (callback) callback(null);
            };

            script.onerror = function(error) {
                console.error(`[TW Scheduler] ❌ Erro ao carregar ${url}:`, error);
                if (callback) callback(error);
            };

            document.head.appendChild(script);
        }
    }

    // Função para inicializar carregamento
    function initialize() {
        console.log('[TW Scheduler] 🚀 Iniciando carregamento...');

        // 1. Carrega backend primeiro
        loadScript(BACKEND_URL, function(err) {
            if (err) {
                alert('[TW Scheduler] Erro ao carregar backend! Verifique o console.');
                return;
            }

            backendLoaded = true;
            console.log('[TW Scheduler] Backend carregado, verificando...');

            // Aguarda backend estar disponível
            let attempts = 0;
            const checkBackend = setInterval(function() {
                attempts++;

                if (window.TWS_Backend) {
                    clearInterval(checkBackend);
                    console.log('[TW Scheduler] ✅ Backend confirmado!');

                    // 2. Carrega frontend
                    loadScript(FRONTEND_URL, function(err) {
                        if (err) {
                            alert('[TW Scheduler] Erro ao carregar frontend! Verifique o console.');
                            return;
                        }

                        frontendLoaded = true;
                        console.log('[TW Scheduler] Frontend carregado, verificando...');

                        // Aguarda frontend estar disponível
                        let frontendAttempts = 0;
                        const checkFrontend = setInterval(function() {
                            frontendAttempts++;

                            if (window.TWS_Panel) {
                                clearInterval(checkFrontend);
                                console.log('[TW Scheduler] ✅ Frontend confirmado!');
                                console.log('[TW Scheduler] 🎉 Tudo carregado com sucesso!');

                                // Notificação visual
                                showNotification('✅ TW Scheduler carregado!', 'success');
                            } else if (frontendAttempts > 50) {
                                clearInterval(checkFrontend);
                                console.error('[TW Scheduler] Frontend não inicializou após 5 segundos');
                                showNotification('⚠️ Frontend não inicializou', 'warning');
                            }
                        }, 100);
                    });
                } else if (attempts > 50) {
                    clearInterval(checkBackend);
                    console.error('[TW Scheduler] Backend não inicializou após 5 segundos');
                    alert('[TW Scheduler] Backend não inicializou! Tente recarregar a página.');
                }
            }, 100);
        });
    }

    // Função para mostrar notificações visuais
    function showNotification(message, type) {
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
            background: ${colors[type] || colors.info};
            color: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            animation: fadeInOut 3s ease-in-out;
        `;
        notification.textContent = message;

        // Adiciona animação CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove após animação
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 3000);
    }

    // Aguarda jQuery estar disponível antes de inicializar
    function waitForJQuery() {
        if (typeof $ !== 'undefined') {
            console.log('[TW Scheduler] jQuery detectado, iniciando...');
            initialize();
        } else {
            console.log('[TW Scheduler] Aguardando jQuery...');
            setTimeout(waitForJQuery, 100);
        }
    }

    // Inicia quando página carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForJQuery);
    } else {
        waitForJQuery();
    }

    console.log('[TW Scheduler] UserScript inicializado');
})();
