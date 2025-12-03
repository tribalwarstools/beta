// ============================================
// BACKEND - Sistema TW Unificado
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURAÇÕES
    // ============================================
    const CONFIG = {
        telegram: {
            token: localStorage.getItem('tw_telegram_token') || "",
            chatId: localStorage.getItem('tw_telegram_chatid') || ""
        },
        antiLogoff: {
            intervalo: 4 * 60 * 1000, // 4 minutos
            reloadAoDetectar: false
        },
        storage: {
            antibot: 'tw_antibot_enabled',
            antilogoff: 'tw_antilogoff_enabled',
            botPausado: 'tw_bot_pausado',
            reloadFinal: 'tw_reload_final',
            telegramToken: 'tw_telegram_token',
            telegramChatId: 'tw_telegram_chatid'
        }
    };
    
    // ============================================
    // ESTADO GLOBAL
    // ============================================
    const Estado = {
        antibot: {
            ativo: false,
            pausado: false
        },
        antilogoff: {
            ativo: false,
            tempoRestante: null,
            contadorAcoes: 0,
            intervalo: null
        },
        wakelock: {
            lock: null,
            audioCtx: null,
            oscillator: null
        }
    };
    
    // ============================================
    // CONTROLE DE BOTS (Para outros scripts)
    // ============================================
    window.TWBotControl = {
        pausado: false,
        
        pausar: function() {
            this.pausado = true;
            Estado.antibot.pausado = true;
            localStorage.setItem(CONFIG.storage.botPausado, '1');
            window.dispatchEvent(new CustomEvent('tw:pausar', {
                detail: { timestamp: Date.now() }
            }));
            console.log('🛑 Sistema pausado - Bots externos foram pausados');
        },
        
        retomar: function() {
            this.pausado = false;
            Estado.antibot.pausado = false;
            localStorage.setItem(CONFIG.storage.botPausado, '0');
            window.dispatchEvent(new CustomEvent('tw:retomar', {
                detail: { timestamp: Date.now() }
            }));
            console.log('✅ Sistema retomado - Bots externos foram retomados');
        },
        
        podeExecutar: function() {
            return !this.pausado && localStorage.getItem(CONFIG.storage.botPausado) !== '1';
        }
    };
    
    // ============================================
    // TELEGRAM
    // ============================================
    async function enviarTelegram(msg) {
        const token = CONFIG.telegram.token;
        const chatId = CONFIG.telegram.chatId;
        
        if (!token || !chatId) {
            console.error('❌ Token ou Chat ID não configurados');
            return false;
        }
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: msg,
                    parse_mode: 'Markdown'
                })
            });
            
            const data = await response.json();
            
            if (data.ok) {
                console.log('📨 Telegram enviado:', msg);
                return true;
            } else {
                console.error('❌ Erro ao enviar telegram:', data.description);
                return false;
            }
        } catch (e) {
            console.error('❌ Erro de conexão:', e);
            return false;
        }
    }
    
    async function testarTelegram() {
        const sucesso = await enviarTelegram('🧪 *Teste de Conexão*\n\n✅ Sistema TW Unificado\n📡 Conexão Telegram funcionando perfeitamente!');
        return sucesso;
    }
    
    function salvarConfigTelegram(token, chatId) {
        if (!token || !chatId) {
            console.error('⚠️ Token ou Chat ID não fornecidos');
            return false;
        }
        
        localStorage.setItem(CONFIG.storage.telegramToken, token);
        localStorage.setItem(CONFIG.storage.telegramChatId, chatId);
        
        CONFIG.telegram.token = token;
        CONFIG.telegram.chatId = chatId;
        
        console.log('💾 Configurações Telegram salvas');
        return true;
    }
    
    // ============================================
    // WAKELOCK / WEBAUDIO
    // ============================================
    async function ativarWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                Estado.wakelock.lock = await navigator.wakeLock.request('screen');
                Estado.wakelock.lock.addEventListener('release', () => {
                    console.log('🔓 Wake Lock liberado');
                });
                console.log('💡 Wake Lock ativado');
            } else {
                ativarWebAudioFallback();
            }
        } catch (e) {
            console.warn('⚠️ Falha no WakeLock, usando WebAudio', e);
            ativarWebAudioFallback();
        }
    }
    
    function ativarWebAudioFallback() {
        if (!Estado.wakelock.audioCtx) {
            Estado.wakelock.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            Estado.wakelock.oscillator = Estado.wakelock.audioCtx.createOscillator();
            const gainNode = Estado.wakelock.audioCtx.createGain();
            gainNode.gain.value = 0;
            Estado.wakelock.oscillator.connect(gainNode).connect(Estado.wakelock.audioCtx.destination);
            Estado.wakelock.oscillator.start();
            console.log('🎵 WebAudio fallback ativado');
        }
    }
    
    function desativarWakeLock() {
        if (Estado.wakelock.lock) {
            Estado.wakelock.lock.release().catch(() => {});
            Estado.wakelock.lock = null;
        }
        if (Estado.wakelock.oscillator) {
            Estado.wakelock.oscillator.stop();
            Estado.wakelock.oscillator.disconnect();
            Estado.wakelock.oscillator = null;
        }
        if (Estado.wakelock.audioCtx) {
            Estado.wakelock.audioCtx.close().catch(() => {});
            Estado.wakelock.audioCtx = null;
        }
        console.log('🔴 WakeLock/WebAudio desativado');
    }
    
    // ============================================
    // ANTI-BOT
    // ============================================
    function ativarAntiBot() {
        Estado.antibot.ativo = true;
        Estado.antibot.pausado = false;
        localStorage.setItem(CONFIG.storage.antibot, '1');
        console.log('🤖 Anti-Bot Detector ATIVADO');
        enviarTelegram('🤖 *Anti-Bot Detector ATIVADO*\nMonitorando proteções do jogo...');
        
        // Iniciar observação
        observerAntiBot.observe(document.body, { childList: true, subtree: true });
    }
    
    function desativarAntiBot() {
        Estado.antibot.ativo = false;
        Estado.antibot.pausado = false;
        localStorage.setItem(CONFIG.storage.antibot, '0');
        localStorage.setItem(CONFIG.storage.botPausado, '0');
        window.TWBotControl.pausado = false;
        
        // Parar observação
        observerAntiBot.disconnect();
        
        console.log('🤖 Anti-Bot Detector DESATIVADO');
    }
    
    function pausarSistema() {
        window.TWBotControl.pausar();
        Estado.antibot.pausado = true;
        
        const timestamp = new Date().toLocaleString('pt-BR');
        const msg = `⚠️ *ANTI-BOT DETECTADO!*\n\n` +
                   `🕒 ${timestamp}\n` +
                   `🚪 Realizando logout automático...\n` +
                   `🔴 Todos os bots foram desativados\n\n` +
                   `👋 Você foi desconectado por segurança`;
        
        enviarTelegram(msg);
        
        // Som de alerta
        try {
            new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS99+aqVRILTKXh8sBvIA==').play();
        } catch (e) {}
        
        // Desativar anti-logoff antes do logout
        if (Estado.antilogoff.ativo) {
            desativarAntiLogoff();
        }
        
        // Aguarda 2 segundos e faz logout (com reset)
        console.log('🚪 Fazendo logout em 2 segundos...');
        setTimeout(() => {
            fazerLogout();
        }, 2000);
    }
    
    function fazerLogout() {
        console.log('🚪 Executando logout...');
        
        // 1. Resetar estado ANTES do logout
        Estado.antibot.pausado = false;
        Estado.antibot.ativo = false;
        localStorage.setItem(CONFIG.storage.antibot, '0');
        localStorage.setItem(CONFIG.storage.botPausado, '0');
        
        // 2. Parar observer
        observerAntiBot.disconnect();
        
        // 3. Executar logout
        const logoutLink = document.querySelector("a[href*='logout']");
        if (logoutLink) {
            console.log('🚪 Logout via link encontrado');
            logoutLink.click();
        } else {
            console.log('🚪 Logout via redirecionamento');
            window.location.href = "/game.php?village=0&screen=logout";
        }
    }
    
    function retomarSistema() {
        window.TWBotControl.retomar();
        Estado.antibot.pausado = false;
        enviarTelegram('✅ *Sistema Retomado*\nUsuário resolveu o anti-bot manualmente.\nTodos os bots externos foram retomados.');
    }
    
    // Detector de Anti-Bot
    const observerAntiBot = new MutationObserver(() => {
        if (!Estado.antibot.ativo || Estado.antibot.pausado) return;
        
        // Novos - Tribal Wars atual
        const botprotectionQuest = document.getElementById('botprotection_quest');
        
        // Antigos - métodos anteriores
        const selectors = [
            '.bot-protection-row',
            '#bot_check',
            '.bot_check',
            "img[src*='popup-script']",
            "[class*='captcha']",
            "[id*='captcha']"
        ];
        
        const antiBotAntigo = document.querySelector(selectors.join(', '));
        
        if (botprotectionQuest || antiBotAntigo) {
            console.log('🚨 ANTI-BOT DETECTADO!');
            pausarSistema();
        }
    });
    
    // ============================================
    // ANTI-LOGOFF
    // ============================================
    function ativarAntiLogoff() {
        if (Estado.antilogoff.ativo) return;
        
        Estado.antilogoff.ativo = true;
        Estado.antilogoff.contadorAcoes = 0;
        Estado.antilogoff.tempoRestante = CONFIG.antiLogoff.intervalo;
        localStorage.setItem(CONFIG.storage.antilogoff, '1');
        
        ativarWakeLock();
        
        const acoes = [
            () => {
                document.title = document.title;
                console.log('📝 Ação: atualizar título');
            },
            () => {
                document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
                console.log('🖱️ Ação: mousemove');
            },
            () => {
                const evt = new KeyboardEvent('keypress', { bubbles: true });
                document.dispatchEvent(evt);
                console.log('⌨️ Ação: keypress');
            },
            () => {
                fetch('/game.php').catch(() => {});
                console.log('🌐 Ação: fetch keepalive');
            }
        ];
        
        Estado.antilogoff.intervalo = setInterval(() => {
            try {
                const acao = acoes[Estado.antilogoff.contadorAcoes % acoes.length];
                acao();
                Estado.antilogoff.contadorAcoes++;
                Estado.antilogoff.tempoRestante = CONFIG.antiLogoff.intervalo;
                
                // Dispatch evento para UI atualizar
                window.dispatchEvent(new CustomEvent('tw:antilogoff:tick', {
                    detail: {
                        contadorAcoes: Estado.antilogoff.contadorAcoes,
                        tempoRestante: Estado.antilogoff.tempoRestante
                    }
                }));
            } catch (e) {
                console.error('❌ Erro na ação anti-logoff:', e);
            }
        }, CONFIG.antiLogoff.intervalo);
        
        console.log('⏰ Anti-Logoff ATIVADO');
        enviarTelegram('⏰ *Anti-Logoff ATIVADO*\nSistema mantendo sessão ativa...');
    }
    
    function desativarAntiLogoff() {
        clearInterval(Estado.antilogoff.intervalo);
        Estado.antilogoff.ativo = false;
        Estado.antilogoff.intervalo = null;
        Estado.antilogoff.tempoRestante = null;
        Estado.antilogoff.contadorAcoes = 0;
        localStorage.setItem(CONFIG.storage.antilogoff, '0');
        
        desativarWakeLock();
        
        console.log('⏰ Anti-Logoff DESATIVADO');
    }
    
    // Atualizar contador a cada segundo
    setInterval(() => {
        if (Estado.antilogoff.ativo && Estado.antilogoff.tempoRestante !== null) {
            Estado.antilogoff.tempoRestante -= 1000;
            if (Estado.antilogoff.tempoRestante < 0) {
                Estado.antilogoff.tempoRestante = 0;
            }
            
            // Dispatch evento para UI atualizar
            window.dispatchEvent(new CustomEvent('tw:antilogoff:update', {
                detail: {
                    tempoRestante: Estado.antilogoff.tempoRestante
                }
            }));
        }
    }, 1000);
    
    // ============================================
    // RESET COMPLETO
    // ============================================
    function resetCompleto() {
        console.log('🔄 Iniciando Reset Completo do Sistema...');
        
        // 1. Desativar todos os sistemas
        if (Estado.antibot.ativo) {
            desativarAntiBot();
        }
        
        if (Estado.antilogoff.ativo) {
            desativarAntiLogoff();
        }
        
        // 2. Parar observer
        observerAntiBot.disconnect();
        
        // 3. Limpar todos os intervalos
        if (Estado.antilogoff.intervalo) {
            clearInterval(Estado.antilogoff.intervalo);
        }
        
        // 4. Desativar WakeLock
        desativarWakeLock();
        
        // 5. Limpar localStorage
        Object.values(CONFIG.storage).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // 6. Resetar estados
        Estado.antibot.ativo = false;
        Estado.antibot.pausado = false;
        Estado.antilogoff.ativo = false;
        Estado.antilogoff.tempoRestante = null;
        Estado.antilogoff.contadorAcoes = 0;
        Estado.antilogoff.intervalo = null;
        Estado.wakelock.lock = null;
        Estado.wakelock.audioCtx = null;
        Estado.wakelock.oscillator = null;
        
        // 7. Resetar controle de bots
        window.TWBotControl.pausado = false;
        
        // 8. Resetar configurações Telegram
        CONFIG.telegram.token = '';
        CONFIG.telegram.chatId = '';
        
        console.log('✅ Reset Completo finalizado!');
        console.log('📊 Sistema retornado ao estado inicial');
        
        // 9. Dispatch evento
        window.dispatchEvent(new CustomEvent('tw:reset'));
    }
    
    // ============================================
    // RESTAURAR ESTADO
    // ============================================
    function restaurarEstado() {
        // Restaurar AntiBot
        if (localStorage.getItem(CONFIG.storage.antibot) === '1') {
            ativarAntiBot();
        }
        
        // Restaurar pausado
        if (localStorage.getItem(CONFIG.storage.botPausado) === '1') {
            Estado.antibot.pausado = true;
            window.TWBotControl.pausado = true;
        }
        
        // Restaurar AntiLogoff
        if (localStorage.getItem(CONFIG.storage.antilogoff) === '1') {
            ativarAntiLogoff();
        }
    }
    
    // ============================================
    // API PÚBLICA
    // ============================================
    window.TWBackend = {
        // Estado
        getEstado: () => Estado,
        getConfig: () => CONFIG,
        
        // AntiBot
        antibot: {
            ativar: ativarAntiBot,
            desativar: desativarAntiBot,
            pausar: pausarSistema,
            retomar: retomarSistema
        },
        
        // AntiLogoff
        antilogoff: {
            ativar: ativarAntiLogoff,
            desativar: desativarAntiLogoff
        },
        
        // Telegram
        telegram: {
            enviar: enviarTelegram,
            testar: testarTelegram,
            salvarConfig: salvarConfigTelegram
        },
        
        // Sistema
        resetCompleto: resetCompleto,
        restaurarEstado: restaurarEstado
    };
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    console.log('🎮 Backend Sistema TW Unificado carregado!');
    console.log('📡 API disponível em window.TWBackend');
    console.log('📡 Controle de Bots em window.TWBotControl');
    
    restaurarEstado();
    
})();
