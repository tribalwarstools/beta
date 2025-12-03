// ============================================
// MODAL ANTI-BOT + ANTI-LOGOFF - Integração TW Scheduler
// ============================================

(function() {
    'use strict';
    
    // Verificar se o backend está carregado
    if (!window.TWS_AntiBotBackend) {
        console.error('[AntiBot Modal] ❌ Backend TWBackend não encontrado!');
        alert('❌ ERRO: Backend AntiBot não carregado!\nCarregue tw-antibot.js primeiro.');
        return;
    }
    
    const Backend = window.TWS_AntiBotBackend;
    
    // ============================================
    // CSS DO MODAL
    // ============================================
    const style = document.createElement('style');
    style.textContent = `
        .antibot-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            animation: fadeIn 0.2s;
        }
        
        .antibot-modal.active {
            display: flex;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .antibot-modal-content {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 3px solid #654321;
            border-radius: 12px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.9);
            animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #f1e1c1;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        @keyframes slideIn {
            from { 
                transform: translateY(-50px);
                opacity: 0;
            }
            to { 
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .antibot-modal-header {
            font-size: 22px;
            font-weight: bold;
            color: #d4b35d;
            margin-bottom: 20px;
            text-align: center;
            border-bottom: 2px solid #654321;
            padding-bottom: 12px;
        }
        
        .antibot-section {
            background: rgba(0,0,0,0.3);
            border: 1px solid #654321;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .antibot-section-title {
            font-size: 16px;
            font-weight: bold;
            color: #d4b35d;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .antibot-status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding: 12px;
            background: rgba(0,0,0,0.2);
            border-radius: 6px;
        }
        
        .antibot-status-label {
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .antibot-status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .antibot-status-indicator.active {
            background: #2ecc71;
            box-shadow: 0 0 10px #2ecc71;
        }
        
        .antibot-status-indicator.inactive {
            background: #e74c3c;
            box-shadow: 0 0 10px #e74c3c;
        }
        
        .antibot-status-indicator.paused {
            background: #f39c12;
            box-shadow: 0 0 10px #f39c12;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .antibot-btn {
            padding: 10px 20px;
            border-radius: 6px;
            border: 2px solid;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
            min-width: 120px;
        }
        
        .antibot-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .antibot-btn:active {
            transform: translateY(0);
        }
        
        .antibot-btn.active {
            background: linear-gradient(135deg, #27ae60 0%, #1e8449 100%);
            border-color: #2ecc71;
            color: white;
        }
        
        .antibot-btn.inactive {
            background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
            border-color: #e74c3c;
            color: white;
        }
        
        .antibot-btn.paused {
            background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
            border-color: #f39c12;
            color: white;
        }
        
        .antibot-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .antibot-input-group {
            margin: 12px 0;
        }
        
        .antibot-input-label {
            display: block;
            font-size: 13px;
            margin-bottom: 6px;
            color: #d4b35d;
            font-weight: bold;
        }
        
        .antibot-input-field {
            width: 100%;
            padding: 10px;
            background: rgba(0,0,0,0.5);
            border: 1px solid #654321;
            border-radius: 6px;
            color: #f1e1c1;
            font-size: 13px;
            box-sizing: border-box;
        }
        
        .antibot-input-field:focus {
            outline: none;
            border-color: #d4b35d;
            box-shadow: 0 0 6px rgba(212, 179, 93, 0.5);
        }
        
        .antibot-input-hint {
            font-size: 11px;
            color: #95a5a6;
            margin-top: 4px;
            font-style: italic;
        }
        
        .antibot-timer {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            padding: 12px;
            background: rgba(0,0,0,0.4);
            border-radius: 6px;
            margin-top: 12px;
            font-family: 'Courier New', monospace;
            color: #2ecc71;
            border: 2px solid #654321;
        }
        
        .antibot-counter {
            font-size: 13px;
            color: #95a5a6;
            text-align: center;
            margin-top: 8px;
        }
        
        .antibot-alert {
            background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
            border: 2px solid #e74c3c;
            border-radius: 8px;
            padding: 16px;
            margin-top: 12px;
            display: none;
            animation: alertBlink 0.5s ease-in-out;
        }
        
        .antibot-alert.active {
            display: block;
        }
        
        @keyframes alertBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .antibot-alert-title {
            font-weight: bold;
            margin-bottom: 6px;
            font-size: 15px;
        }
        
        .antibot-alert-text {
            font-size: 12px;
            opacity: 0.9;
        }
        
        .antibot-telegram-status {
            font-size: 12px;
            text-align: center;
            margin-top: 8px;
            padding: 6px;
            border-radius: 6px;
            background: rgba(0,0,0,0.3);
            border: 2px solid;
        }
        
        .antibot-telegram-status.active {
            color: #2ecc71;
            border-color: #2ecc71;
        }
        
        .antibot-telegram-status.inactive {
            color: #e74c3c;
            border-color: #e74c3c;
        }
        
        .antibot-btn-group {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 16px;
        }
        
        .antibot-close-btn {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            border-color: #95a5a6;
            color: white;
            width: 100%;
            margin-top: 20px;
            padding: 12px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            border: 2px solid #95a5a6;
        }
        
        .antibot-close-btn:hover {
            background: linear-gradient(135deg, #a8b9ba 0%, #8d9a9b 100%);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(149, 165, 166, 0.4);
        }
        
        .antibot-save-btn {
            background: linear-gradient(135deg, #27ae60 0%, #1e8449 100%);
            border-color: #2ecc71;
            width: 100%;
            margin-top: 12px;
        }
        
        .antibot-save-btn:hover {
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
        }
        
        .antibot-test-btn {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            border-color: #3498db;
            width: 100%;
            margin-top: 8px;
        }
        
        .antibot-test-btn:hover {
            background: linear-gradient(135deg, #5dade2 0%, #3498db 100%);
        }
    `;
    document.head.appendChild(style);
    
    // ============================================
    // HTML DO MODAL
    // ============================================
    const modal = document.createElement('div');
    modal.className = 'antibot-modal';
    modal.id = 'antibot-protection-modal';
    modal.innerHTML = `
        <div class="antibot-modal-content">
            <div class="antibot-modal-header">
                🛡️ Sistema de Proteção TW
            </div>
            
            <!-- ANTI-BOT DETECTOR -->
            <div class="antibot-section">
                <div class="antibot-section-title">🤖 Anti-Bot Detector</div>
                
                <div class="antibot-status-row">
                    <div class="antibot-status-label">
                        <span class="antibot-status-indicator inactive" id="antibot-modal-indicator"></span>
                        <span id="antibot-modal-status-text">Inativo</span>
                    </div>
                    <button class="antibot-btn inactive" id="antibot-modal-toggle">Ativar Detector</button>
                </div>
                
                <div class="antibot-alert" id="antibot-modal-alert">
                    <div class="antibot-alert-title">⚠️ ANTI-BOT DETECTADO!</div>
                    <div class="antibot-alert-text">Fazendo logout automático em 2 segundos...</div>
                </div>
                
                <div style="font-size: 12px; color: #95a5a6; margin-top: 12px; line-height: 1.5;">
                    ℹ️ <strong>Funcionamento:</strong> Monitora proteções anti-bot do jogo e faz logout automático quando detectado, protegendo sua conta.
                </div>
            </div>
            
            <!-- ANTI-LOGOFF -->
            <div class="antibot-section">
                <div class="antibot-section-title">⏰ Anti-Logoff</div>
                
                <div class="antibot-status-row">
                    <div class="antibot-status-label">
                        <span class="antibot-status-indicator inactive" id="antilogoff-modal-indicator"></span>
                        <span id="antilogoff-modal-status-text">Inativo</span>
                    </div>
                    <button class="antibot-btn inactive" id="antilogoff-modal-toggle">Ativar Anti-Logoff</button>
                </div>
                
                <div class="antibot-timer" id="antilogoff-modal-timer">--:--</div>
                <div class="antibot-counter" id="antilogoff-modal-counter">Ações: 0</div>
                
                <div style="font-size: 12px; color: #95a5a6; margin-top: 12px; line-height: 1.5;">
                    ℹ️ <strong>Funcionamento:</strong> Mantém sua sessão ativa simulando atividade a cada 4 minutos, impedindo logout automático.
                </div>
            </div>
            
            <!-- CONFIGURAÇÃO TELEGRAM -->
            <div class="antibot-section">
                <div class="antibot-section-title">📡 Notificações Telegram</div>
                
                <div class="antibot-input-group">
                    <label class="antibot-input-label">Bot Token:</label>
                    <input type="text" class="antibot-input-field" id="antibot-telegram-token" placeholder="Ex: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz">
                    <div class="antibot-input-hint">Token do seu bot do Telegram</div>
                </div>
                
                <div class="antibot-input-group">
                    <label class="antibot-input-label">Chat ID:</label>
                    <input type="text" class="antibot-input-field" id="antibot-telegram-chatid" placeholder="Ex: 1234567890">
                    <div class="antibot-input-hint">Seu ID de chat do Telegram</div>
                </div>
                
                <button class="antibot-btn antibot-save-btn" id="antibot-telegram-save">💾 Salvar Configurações</button>
                <button class="antibot-btn antibot-test-btn" id="antibot-telegram-test">📨 Testar Conexão</button>
                
                <div class="antibot-telegram-status inactive" id="antibot-telegram-status">
                    ⚠️ Configuração não testada
                </div>
            </div>
            
            <!-- BOTÃO FECHAR -->
            <button class="antibot-close-btn" id="antibot-modal-close">Fechar</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    // ============================================
    // ELEMENTOS DO DOM
    // ============================================
    const UI = {
        modal: modal,
        antibot: {
            indicator: document.getElementById('antibot-modal-indicator'),
            statusText: document.getElementById('antibot-modal-status-text'),
            toggleBtn: document.getElementById('antibot-modal-toggle'),
            alert: document.getElementById('antibot-modal-alert')
        },
        antilogoff: {
            indicator: document.getElementById('antilogoff-modal-indicator'),
            statusText: document.getElementById('antilogoff-modal-status-text'),
            toggleBtn: document.getElementById('antilogoff-modal-toggle'),
            timer: document.getElementById('antilogoff-modal-timer'),
            counter: document.getElementById('antilogoff-modal-counter')
        },
        telegram: {
            token: document.getElementById('antibot-telegram-token'),
            chatId: document.getElementById('antibot-telegram-chatid'),
            saveBtn: document.getElementById('antibot-telegram-save'),
            testBtn: document.getElementById('antibot-telegram-test'),
            status: document.getElementById('antibot-telegram-status')
        },
        closeBtn: document.getElementById('antibot-modal-close')
    };
    
    // ============================================
    // FUNÇÕES DE ATUALIZAÇÃO DE UI
    // ============================================
    function updateUI() {
        const estado = Backend.getEstado();
        const config = Backend.getConfig();
        
        // Anti-Bot
        if (estado.antibot.pausado) {
            UI.antibot.indicator.className = 'antibot-status-indicator paused';
            UI.antibot.statusText.textContent = 'Fazendo Logout...';
            UI.antibot.toggleBtn.className = 'antibot-btn paused';
            UI.antibot.toggleBtn.textContent = '🚪 Desconectando...';
            UI.antibot.toggleBtn.disabled = true;
            UI.antibot.alert.classList.add('active');
        } else if (estado.antibot.ativo) {
            UI.antibot.indicator.className = 'antibot-status-indicator active';
            UI.antibot.statusText.textContent = 'Monitorando';
            UI.antibot.toggleBtn.className = 'antibot-btn active';
            UI.antibot.toggleBtn.textContent = '✓ Detector Ativo';
            UI.antibot.toggleBtn.disabled = false;
            UI.antibot.alert.classList.remove('active');
        } else {
            UI.antibot.indicator.className = 'antibot-status-indicator inactive';
            UI.antibot.statusText.textContent = 'Inativo';
            UI.antibot.toggleBtn.className = 'antibot-btn inactive';
            UI.antibot.toggleBtn.textContent = 'Ativar Detector';
            UI.antibot.toggleBtn.disabled = false;
            UI.antibot.alert.classList.remove('active');
        }
        
        // Anti-Logoff
        if (estado.antilogoff.ativo) {
            UI.antilogoff.indicator.className = 'antibot-status-indicator active';
            UI.antilogoff.statusText.textContent = 'Ativo';
            UI.antilogoff.toggleBtn.className = 'antibot-btn active';
            UI.antilogoff.toggleBtn.textContent = '✓ Anti-Logoff Ativo';
        } else {
            UI.antilogoff.indicator.className = 'antibot-status-indicator inactive';
            UI.antilogoff.statusText.textContent = 'Inativo';
            UI.antilogoff.toggleBtn.className = 'antibot-btn inactive';
            UI.antilogoff.toggleBtn.textContent = 'Ativar Anti-Logoff';
            UI.antilogoff.timer.textContent = '--:--';
            UI.antilogoff.counter.textContent = 'Ações: 0';
        }
        
        // Telegram
        UI.telegram.token.value = config.telegram.token;
        UI.telegram.chatId.value = config.telegram.chatId;
        
        const tokenPreenchido = UI.telegram.token.value.trim().length > 0;
        const chatIdPreenchido = UI.telegram.chatId.value.trim().length > 0;
        
        if (tokenPreenchido && chatIdPreenchido) {
            UI.telegram.status.textContent = '✅ Configurações salvas';
            UI.telegram.status.className = 'antibot-telegram-status active';
        } else {
            UI.telegram.status.textContent = '⚠️ Configure Token e Chat ID';
            UI.telegram.status.className = 'antibot-telegram-status inactive';
        }
    }
    
    function formatarTempo(ms) {
        const seg = Math.floor(ms / 1000);
        const min = Math.floor(seg / 60);
        const segRest = seg % 60;
        return `${min.toString().padStart(2, '0')}:${segRest.toString().padStart(2, '0')}`;
    }
    
    function updateTimer() {
        const estado = Backend.getEstado();
        if (!estado.antilogoff.ativo || estado.antilogoff.tempoRestante === null) {
            UI.antilogoff.timer.textContent = '--:--';
            return;
        }
        
        if (estado.antilogoff.tempoRestante <= 0) {
            UI.antilogoff.timer.textContent = 'Executando...';
        } else {
            UI.antilogoff.timer.textContent = formatarTempo(estado.antilogoff.tempoRestante);
        }
        
        UI.antilogoff.counter.textContent = `Ações: ${estado.antilogoff.contadorAcoes}`;
    }
    
    function mostrarNotificacao(mensagem, tipo = 'info') {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 9999999;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            border: 2px solid;
            text-align: center;
            max-width: 300px;
            animation: popIn 0.3s;
        `;
        
        switch(tipo) {
            case 'sucesso':
                notif.style.background = 'linear-gradient(135deg, #27ae60 0%, #1e8449 100%)';
                notif.style.borderColor = '#2ecc71';
                notif.style.color = 'white';
                break;
            case 'erro':
                notif.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
                notif.style.borderColor = '#e74c3c';
                notif.style.color = 'white';
                break;
            case 'aviso':
                notif.style.background = 'linear-gradient(135deg, #f39c12 0%, #d35400 100%)';
                notif.style.borderColor = '#f39c12';
                notif.style.color = 'white';
                break;
            default:
                notif.style.background = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
                notif.style.borderColor = '#3498db';
                notif.style.color = 'white';
        }
        
        notif.innerHTML = mensagem;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'fadeOut 0.3s';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
    
    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    // Anti-Bot Toggle
    UI.antibot.toggleBtn.addEventListener('click', () => {
        const estado = Backend.getEstado();
        if (estado.antibot.ativo) {
            Backend.antibot.desativar();
        } else {
            Backend.antibot.ativar();
        }
        updateUI();
    });
    
    // Anti-Logoff Toggle
    UI.antilogoff.toggleBtn.addEventListener('click', () => {
        const estado = Backend.getEstado();
        if (estado.antilogoff.ativo) {
            Backend.antilogoff.desativar();
        } else {
            Backend.antilogoff.ativar();
        }
        updateUI();
    });
    
    // Telegram - Salvar
    UI.telegram.saveBtn.addEventListener('click', () => {
        const token = UI.telegram.token.value.trim();
        const chatId = UI.telegram.chatId.value.trim();
        
        if (!token || !chatId) {
            mostrarNotificacao('⚠️ Preencha Token e Chat ID antes de salvar.', 'aviso');
            return;
        }
        
        const sucesso = Backend.telegram.salvarConfig(token, chatId);
        if (sucesso) {
            mostrarNotificacao('✅ Configurações Telegram salvas com sucesso!', 'sucesso');
            updateUI();
        } else {
            mostrarNotificacao('❌ Erro ao salvar configurações Telegram.', 'erro');
        }
    });
    
    // Telegram - Testar
    UI.telegram.testBtn.addEventListener('click', async () => {
        UI.telegram.status.textContent = '🔄 Testando conexão...';
        UI.telegram.status.className = 'antibot-telegram-status inactive';
        
        const sucesso = await Backend.telegram.testar();
        
        if (sucesso) {
            UI.telegram.status.textContent = '✅ Conexão funcionando!';
            UI.telegram.status.className = 'antibot-telegram-status active';
            mostrarNotificacao('✅ Conexão Telegram testada com sucesso!', 'sucesso');
        } else {
            UI.telegram.status.textContent = '❌ Falha na conexão';
            UI.telegram.status.className = 'antibot-telegram-status inactive';
            mostrarNotificacao('❌ Falha ao testar conexão Telegram. Verifique Token e Chat ID.', 'erro');
        }
    });
    
    // Fechar Modal
    UI.closeBtn.addEventListener('click', () => {
        hide();
    });
    
    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hide();
        }
    });
    
    // Atualizar timer a cada segundo
    setInterval(() => {
        const estado = Backend.getEstado();
        if (estado.antilogoff.ativo) {
            updateTimer();
        }
    }, 1000);
    
    // Escutar eventos do backend
    window.addEventListener('tw:antilogoff:update', updateTimer);
    window.addEventListener('tw:pausar', updateUI);
    window.addEventListener('tw:retomar', updateUI);
    window.addEventListener('tw:reset', updateUI);
    
    // ============================================
    // API PÚBLICA
    // ============================================
    function show() {
        updateUI();
        updateTimer();
        modal.classList.add('active');
        console.log('[AntiBot Modal] Modal aberto');
    }
    
    function hide() {
        modal.classList.remove('active');
        console.log('[AntiBot Modal] Modal fechado');
    }
    
    window.TWS_AntiBotModal = {
        show,
        hide,
        updateUI,
        updateTimer
    };
    
    // ============================================
    // ADICIONAR ANIMAÇÕES
    // ============================================
    const animations = document.createElement('style');
    animations.textContent = `
        @keyframes popIn {
            0% {
                transform: translate(-50%, -50%) scale(0.8);
                opacity: 0;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.05);
            }
            100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            to {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.9);
            }
        }
    `;
    document.head.appendChild(animations);
    
    console.log('[AntiBot Modal] ✅ Modal carregado e integrado!');
    console.log('[AntiBot Modal] API disponível: window.TWS_AntiBotModal.show()');
    
})();
