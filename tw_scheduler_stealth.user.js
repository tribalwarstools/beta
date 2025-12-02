// ==UserScript==
// @name         TW Scheduler Stealth v2.2
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Agendador avançado - Interface minimalista e eficiente
// @match        https://*.tribalwars.com.br/game.php*
// @grant        none
// @author       TribalWarsTools
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // ⭐ SISTEMA MINIMALISTA DE BLOQUEIO MULTITAB
    // ============================================
    const LOCK_KEY = 'TWS_ACTIVE_TAB';
    const LOCK_TIMEOUT = 10000; // Reduzido para 10s

    function verificarBloqueio() {
        try {
            const minhaTabId = sessionStorage.getItem('TWS_TAB_ID');
            const bloqueioStr = localStorage.getItem(LOCK_KEY);

            if (!bloqueioStr) return true;

            const bloqueio = JSON.parse(bloqueioStr);
            const agora = Date.now();

            // Bloqueio expirado? Liberar
            if ((agora - bloqueio.timestamp) > LOCK_TIMEOUT) {
                localStorage.removeItem(LOCK_KEY);
                return true;
            }

            // É a mesma aba? Permitir
            if (minhaTabId === bloqueio.tabId) return true;

            // Outra aba ativa - mostrar aviso discreto
            mostrarAvisoMultitab();
            return false;

        } catch (e) {
            return true; // Erro = permitir
        }
    }

    function adquirirBloqueio() {
        const tabId = Math.random().toString(36).substr(2, 6);
        const bloqueio = {
            tabId: tabId,
            timestamp: Date.now()
        };

        localStorage.setItem(LOCK_KEY, JSON.stringify(bloqueio));
        sessionStorage.setItem('TWS_TAB_ID', tabId);

        console.log(`[TWS] 🔒 Controle: ${tabId}`);
        return tabId;
    }

    // ============================================
    // ⭐ AVISO MINIMALISTA MULTITAB
    // ============================================
    function mostrarAvisoMultitab() {
        if (document.querySelector('#tws-mini-aviso')) return;

        const aviso = document.createElement('div');
        aviso.id = 'tws-mini-aviso';
        aviso.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #ff6b35, #ffa500);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            z-index: 999997;
            font-size: 11px;
            max-width: 180px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border-left: 3px solid #ffd700;
            cursor: pointer;
            opacity: 0.9;
            transition: all 0.2s;
            user-select: none;
        `;

        aviso.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="font-size: 14px;">⚠️</div>
                <div>
                    <div style="font-weight: bold;">TW Scheduler</div>
                    <div style="font-size: 9px; opacity: 0.8;">Outra aba ativa</div>
                </div>
            </div>
        `;

        // Tooltip
        aviso.title = 'Clique para recarregar e tomar controle desta aba';

        // Ação ao clicar
        aviso.onclick = () => {
            localStorage.removeItem(LOCK_KEY);
            location.reload();
        };

        // Efeitos hover
        aviso.onmouseover = () => {
            aviso.style.opacity = '1';
            aviso.style.transform = 'translateY(-1px)';
            aviso.style.boxShadow = '0 3px 10px rgba(0,0,0,0.4)';
        };

        aviso.onmouseout = () => {
            aviso.style.opacity = '0.9';
            aviso.style.transform = 'translateY(0)';
            aviso.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        };

        document.body.appendChild(aviso);

        // Auto-remover após 15 segundos
        setTimeout(() => {
            if (aviso.parentNode) {
                aviso.style.opacity = '0';
                aviso.style.transform = 'translateX(20px)';
                setTimeout(() => aviso.remove(), 300);
            }
        }, 15000);
    }

    // ============================================
    // ⭐ VERIFICAÇÃO INICIAL DE BLOQUEIO
    // ============================================
    if (!verificarBloqueio()) {
        console.log('[TWS] ⏸️ Controle em outra aba');
        return; // Não executa mais nada
    }

    const tabId = adquirirBloqueio();

    // ============================================
    // ⭐ MANTER BLOQUEIO ATIVO (SIMPLIFICADO)
    // ============================================
    const manterBloqueio = () => {
        try {
            const bloqueioStr = localStorage.getItem(LOCK_KEY);
            if (bloqueioStr) {
                const bloqueio = JSON.parse(bloqueioStr);
                if (bloqueio.tabId === tabId) {
                    bloqueio.timestamp = Date.now();
                    localStorage.setItem(LOCK_KEY, JSON.stringify(bloqueio));
                }
            }
        } catch (e) { /* Ignorar */ }
    };

    // Atualizar a cada 3 segundos (mais eficiente)
    const intervaloBloqueio = setInterval(manterBloqueio, 3000);

    // ============================================
    // ⭐ LIMPEZA AO SAIR
    // ============================================
    const limparAoFechar = () => {
        clearInterval(intervaloBloqueio);
        try {
            const bloqueioStr = localStorage.getItem(LOCK_KEY);
            if (bloqueioStr) {
                const bloqueio = JSON.parse(bloqueioStr);
                if (bloqueio.tabId === tabId) {
                    localStorage.removeItem(LOCK_KEY);
                    sessionStorage.removeItem('TWS_TAB_ID');
                    console.log('[TWS] 🔓 Controle liberado');
                }
            }
        } catch (e) { /* Ignorar */ }
    };

    // Eventos de limpeza
    window.addEventListener('beforeunload', limparAoFechar);
    window.addEventListener('pagehide', limparAoFechar);

    // ============================================
    // ⭐ BADGE MINIMALISTA DE STATUS
    // ============================================
    function criarBadgeStatus() {
        const badge = document.createElement('div');
        badge.id = 'tws-status-badge';
        badge.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
            color: #d4b35d;
            padding: 4px 8px;
            border-radius: 4px;
            z-index: 999996;
            font-size: 10px;
            font-family: monospace;
            border: 1px solid #654321;
            opacity: 0.7;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
            display: none;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        `;

        badge.textContent = 'TW⏳';
        badge.title = 'TW Scheduler Carregando...\nClique para mostrar/esconder';

        // Interatividade
        badge.onclick = () => {
            const notif = document.querySelector('#tws-progress-notification');
            if (notif) {
                notif.style.display = notif.style.display === 'none' ? 'block' : 'none';
            }
        };

        badge.onmouseover = () => {
            badge.style.opacity = '1';
            badge.style.transform = 'scale(1.05)';
        };

        badge.onmouseout = () => {
            badge.style.opacity = '0.7';
            badge.style.transform = 'scale(1)';
        };

        document.body.appendChild(badge);

        // Monitorar notificação do carregador
        const observer = new MutationObserver(() => {
            const notif = document.querySelector('#tws-progress-notification');
            if (notif) {
                badge.style.display = 'block';

                // Atualizar badge conforme progresso
                const updateBadge = () => {
                    const progressBar = document.querySelector('#tws-progress-notification .progress-bar');
                    if (progressBar) {
                        const width = parseInt(progressBar.style.width) || 0;
                        if (width < 30) badge.textContent = 'TW🔴';
                        else if (width < 70) badge.textContent = 'TW🟡';
                        else if (width < 100) badge.textContent = 'TW🟢';
                        else badge.textContent = 'TW✅';
                    }
                };

                setInterval(updateBadge, 1000);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Auto-esconder após 30 segundos se não houver notificação
        setTimeout(() => {
            if (!document.querySelector('#tws-progress-notification')) {
                badge.style.display = 'none';
            }
        }, 30000);
    }

    // ============================================
    // ⭐ CARREGADOR STEALTH OTIMIZADO
    // ============================================
    if (window.__TWS_STEALTH_LOADER_V2) {
        console.log('[Loader] Já carregado');
        return;
    }
    window.__TWS_STEALTH_LOADER_V2 = true;

    function carregarStealth() {
        if (window.__TWS_STEALTH_CARREGADOR) {
            console.log('[Loader] Carregador já ativo');
            return;
        }

        console.log('[Loader] Iniciando carregador...');

        // Criar badge de status
        criarBadgeStatus();

        // Carregar discretamente
        setTimeout(() => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = 'https://tribalwarstools.github.io/beta/tws_carregador_stealth.js';

            // Limpar após carga (opcional)
            script.onload = () => {
                setTimeout(() => {
                    if (script.parentNode) script.parentNode.removeChild(script);
                }, 10000);
            };

            document.head.appendChild(script);
        }, 500);
    }

    // ============================================
    // ⭐ DETECÇÃO RÁPIDA DO JOGO
    // ============================================
    function jogoPronto() {
        return new Promise((resolve) => {
            // Verificação rápida
            const elementosChave = [
                '#game_header',
                '.menu-row',
                '#village_map',
                '#content_value',
                '.building_buttons'
            ];

            for (const seletor of elementosChave) {
                if (document.querySelector(seletor)) {
                    resolve();
                    return;
                }
            }

            // Observer leve
            const observer = new MutationObserver(() => {
                for (const seletor of elementosChave) {
                    if (document.querySelector(seletor)) {
                        observer.disconnect();
                        resolve();
                        return;
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Timeout curto
            setTimeout(() => {
                observer.disconnect();
                resolve(); // Tenta mesmo assim
            }, 15000);
        });
    }

    // ============================================
    // ⭐ INICIALIZAÇÃO OTIMIZADA
    // ============================================
    async function iniciar() {
        console.log('[Loader] Aguardando jogo...');

        await jogoPronto();

        // Delay aleatório reduzido (3-8s)
        const delay = Math.random() * 5000 + 3000;
        console.log(`[Loader] Delay: ${Math.round(delay/1000)}s`);

        await new Promise(r => setTimeout(r, delay));

        carregarStealth();
        console.log('[Loader] Carregador iniciado');
    }

    // ============================================
    // ⭐ INICIALIZAÇÃO FINAL
    // ============================================
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(iniciar, 2000);
            });
        } else {
            setTimeout(iniciar, 1000);
        }
    }

    // Iniciar com pequeno delay
    setTimeout(init, 500);

})();
