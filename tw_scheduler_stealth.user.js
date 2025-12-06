// ==UserScript==
// @name         TW Scheduler Stealth v2.1
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Agendador avançado - Modo Stealth (Apenas uma aba)
// @match        https://*.tribalwars.com.br/game.php*
// @grant        none
// @author       TribalWarsTools
// ==/UserScript==

(function() {
    'use strict';

    // ⭐ BLOQUEIO SIMPLES COM localStorage ⭐
    const LOCK_KEY = 'TWS_ACTIVE_TAB';
    const LOCK_TIMEOUT = 15000; // 15 segundos

    function verificarBloqueio() {
        try {
            const bloqueioStr = localStorage.getItem(LOCK_KEY);
            if (bloqueioStr) {
                const bloqueio = JSON.parse(bloqueioStr);
                const agora = Date.now();

                // Se o bloqueio é recente (< 15 segundos), outra aba está ativa
                if ((agora - bloqueio.timestamp) < LOCK_TIMEOUT) {
                    // VERIFICAR SE É A MESMA ABA (pelo sessionStorage)
                    const minhaTabId = sessionStorage.getItem('TWS_TAB_ID');
                    if (minhaTabId && minhaTabId === bloqueio.tabId) {
                        // É a mesma aba, permitir
                        return true;
                    }
                    return false; // Outra aba ativa
                }
            }
            return true; // Nenhum bloqueio ativo
        } catch (e) {
            return true; // Em caso de erro, permitir
        }
    }

    function adquirirBloqueio() {
        const tabId = Math.random().toString(36).substr(2, 9);
        const bloqueio = {
            tabId: tabId,
            timestamp: Date.now(),
            url: window.location.href
        };

        localStorage.setItem(LOCK_KEY, JSON.stringify(bloqueio));
        sessionStorage.setItem('TWS_TAB_ID', tabId);

        return tabId;
    }

    // Verificar se pode carregar
    if (!verificarBloqueio()) {
        console.log('[TWS] ⏸️ Já está rodando em outra aba. Recarregue (F5) para tomar controle.');

        // Mostrar aviso
        setTimeout(() => {
            if (document.querySelector('#tws-aviso-multitab')) return;

            const aviso = document.createElement('div');
            aviso.id = 'tws-aviso-multitab';
            aviso.style.cssText = `
                position: fixed;
                top: 50px;
                right: 10px;
                background: linear-gradient(135deg, #ff9800, #ff5722);
                color: white;
                padding: 12px 15px;
                border-radius: 8px;
                z-index: 999998;
                font-size: 13px;
                max-width: 280px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                border-left: 4px solid #ffeb3b;
                animation: pulse 2s infinite;
            `;

            // Adicionar animação CSS
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3); }
                    50% { box-shadow: 0 4px 20px rgba(255, 152, 0, 0.6); }
                    100% { box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3); }
                }
            `;
            document.head.appendChild(style);

            aviso.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 20px;">⚠️</div>
                    <div>
                        <strong>TW Scheduler</strong><br>
                        <small>Controle em outra aba</small>
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 11px; opacity: 0.9;">
                    Recarregue (F5) para transferir para esta aba
                </div>
            `;

            // Botão para recarregar
            const btn = document.createElement('button');
            btn.textContent = 'Recarregar Agora';
            btn.style.cssText = `
                margin-top: 8px;
                background: #ffeb3b;
                color: #333;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                font-weight: bold;
                width: 100%;
            `;
            btn.onclick = () => {
                localStorage.removeItem(LOCK_KEY);
                location.reload();
            };

            aviso.appendChild(btn);
            document.body.appendChild(aviso);
        }, 3000);

        return; // Parar execução - NÃO CARREGA O SCRIPT
    }

    // Adquirir bloqueio para esta aba
    const tabId = adquirirBloqueio();
    console.log(`[TWS] 🎯 Controle adquirido pela aba: ${tabId}`);

    // Manter bloqueio ativo
    const intervaloBloqueio = setInterval(() => {
        try {
            const bloqueioStr = localStorage.getItem(LOCK_KEY);
            if (bloqueioStr) {
                const bloqueio = JSON.parse(bloqueioStr);
                if (bloqueio.tabId === tabId) {
                    bloqueio.timestamp = Date.now();
                    localStorage.setItem(LOCK_KEY, JSON.stringify(bloqueio));
                }
            }
        } catch (e) {
            // Ignorar erros
        }
    }, 5000);

    // Limpar quando aba fechar
    window.addEventListener('beforeunload', () => {
        clearInterval(intervaloBloqueio);
        try {
            const bloqueioStr = localStorage.getItem(LOCK_KEY);
            if (bloqueioStr) {
                const bloqueio = JSON.parse(bloqueioStr);
                if (bloqueio.tabId === tabId) {
                    localStorage.removeItem(LOCK_KEY);
                    sessionStorage.removeItem('TWS_TAB_ID');
                    console.log(`[TWS] 🔓 Bloqueio liberado`);
                }
            }
        } catch (e) {
            // Ignorar
        }
    });

    // ============================================
    // ⭐ CÓDIGO ORIGINAL DO SCRIPT (começa aqui) ⭐
    // ============================================

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

})(); // ←  AQUI FECHA A ÚNICA IIFE
