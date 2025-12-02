// ==UserScript==
// @name         TW Scheduler Stealth v2.1
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Agendador avançado - Modo Stealth
// @match        https://*.tribalwars.com.br/game.php*
// @grant        none
// @author       TribalWarsTools
// @updateURL    https://tribalwarstools.github.io/beta/tw_scheduler_stealth.user.js
// @downloadURL  https://tribalwarstools.github.io/beta/tw_scheduler_stealth.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ⭐ VERIFICAÇÃO DE DUPLICIDADE ⭐
    if (window.__TWS_STEALTH_LOADER_V2) {
        console.log('[Loader] Já carregado');
        return;
    }
    window.__TWS_STEALTH_LOADER_V2 = true;

    // ⭐ CARREGADOR STEALTH SEM jQuery ⭐
    function carregarStealth() {
        // Verifica se o carregador stealth já está rodando
        if (window.__TWS_STEALTH_CARREGADOR) {
            console.log('[Loader] Carregador stealth já ativo');
            return;
        }

        console.log('[Loader] Iniciando carregador stealth...');

        // Cria script DINAMICAMENTE mas de forma discreta
        const script = document.createElement('script');

        // Adiciona atributos normais
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;

        // Usa o NOVO carregador stealth
        script.src = 'https://tribalwarstools.github.io/beta/tws_carregador_stealth.js';

        // Adiciona discretamente
        setTimeout(() => {
            document.head.appendChild(script);

            // Remove após um tempo (limpeza)
            setTimeout(() => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            }, 30000);
        }, 1000);
    }

    // ⭐ ESPERA O JOGO ⭐
    function esperarJogo() {
        return new Promise((resolve) => {
            // Verifica se já está pronto
            if (document.querySelector('#game_header, .menu-row, #village_map')) {
                resolve();
                return;
            }

            // Observer para detectar quando o jogo carrega
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && (
                                node.matches('#game_header') ||
                                node.matches('.menu-row') ||
                                node.matches('#village_map') ||
                                node.querySelector('#game_header, .menu-row, #village_map')
                            )) {
                                observer.disconnect();
                                resolve();
                                return;
                            }
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Timeout de segurança
            setTimeout(() => {
                observer.disconnect();
                resolve(); // Tenta mesmo assim
            }, 45000);
        });
    }

    // ⭐ INICIALIZAÇÃO PRINCIPAL ⭐
    async function iniciarLoader() {
        console.log('[Loader] Aguardando ambiente seguro...');

        // 1. Espera o jogo carregar
        await esperarJogo();

        // 2. Espera adicional ALEATÓRIA (importante!)
        const waitExtra = Math.random() * 15000 + 8000;
        console.log(`[Loader] Espera extra: ${Math.round(waitExtra/1000)}s`);

        await new Promise(r => setTimeout(r, waitExtra));

        // 3. Inicia carregamento stealth
        carregarStealth();

        console.log('[Loader] Carregador stealth iniciado');
    }

    // ⭐ INICIA QUANDO SEGURO ⭐
    function iniciarQuandoPronto() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(iniciarLoader, 3000);
            });
        } else {
            setTimeout(iniciarLoader, 5000);
        }
    }

    // INICIA
    iniciarQuandoPronto();

})();
