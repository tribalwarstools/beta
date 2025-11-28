(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler Test Modal] Backend não carregado!');
    return;
  }

  const {
    parseCoord,
    parseDateTimeToMs,
    getList,
    setList,
    executeAttack,
    getVillageTroops,
    validateTroops,
    TROOP_LIST,
    _internal
  } = window.TWS_Backend;

  // ✅ Formata data para DD/MM/YYYY HH:MM:SS
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // ✅ Renderiza tropas em cards visuais
  function renderTroopsPreview(cfg) {
    let html = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;">';
    
    TROOP_LIST.forEach(unit => {
      const count = cfg[unit] || 0;
      const hasUnits = count > 0;
      
      html += `
        <div style="
          background: ${hasUnits ? '#E8F5E9' : '#F5F5F5'};
          border: 2px solid ${hasUnits ? '#4CAF50' : '#E0E0E0'};
          border-radius: 4px;
          padding: 8px;
          text-align: center;
        ">
          <div style="font-size: 11px; color: #666; font-weight: bold;">${unit}</div>
          <div style="font-size: 16px; color: ${hasUnits ? '#2E7D32' : '#999'}; font-weight: bold;">${count}</div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  // ✅ Renderiza lista de TODOS os agendamentos
  function renderAgendamentosList() {
    const list = getList();
    
    if (list.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum agendamento encontrado</div>
          <small>Não há agendamentos na lista</small>
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 10px;">';
    
    list.forEach((agend, idx) => {
      const now = Date.now();
      const t = parseDateTimeToMs(agend.datetime);
      const diff = t - now;
      const seconds = Math.ceil(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = minutes > 0 
        ? `${minutes}:${secs.toString().padStart(2, '0')}` 
        : `${secs}s`;

      // ✅ Cores diferentes para status
      let statusColor, statusText, timeColor;
      
      if (agend.done) {
        statusColor = agend.success ? '#4CAF50' : '#F44336';
        statusText = agend.success ? '✅ CONCLUÍDO' : '❌ FALHOU';
        timeColor = '#9E9E9E';
      } else {
        statusColor = '#FF9800';
        statusText = '⏰ PENDENTE';
        timeColor = '#4CAF50';
        if (diff < 300000) timeColor = '#FF9800'; // < 5 min = laranja
        if (diff < 60000) timeColor = '#F44336';  // < 1 min = vermelho
      }

      // ✅ Exibir informações de execução se disponível
      const execInfo = agend.executedAt ? 
        `<br><small style="color: #666;">Executado: ${formatDateTime(new Date(agend.executedAt))}</small>` : '';

      html += `
        <div onclick="TWS_TestModal._selectAgenda(${idx})" style="
          background: ${agend.done ? (agend.success ? '#F1F8E9' : '#FFEBEE') : 'white'};
          border: 3px solid ${statusColor};
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          opacity: ${agend.done ? 0.8 : 1};
        " onmouseover="this.style.background='${agend.done ? (agend.success ? '#E8F5E9' : '#FFE5E5') : '#FFF9E6'}'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='${agend.done ? (agend.success ? '#F1F8E9' : '#FFEBEE') : 'white'}'; this.style.transform='scale(1)'">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #8B4513;">
              #${idx + 1}: ${agend.origem} → ${agend.alvo}
              <span style="font-size: 12px; background: ${statusColor}; color: white; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">
                ${statusText}
              </span>
            </div>
            <small style="color: #666;">
              📅 ${agend.datetime}
              ${execInfo}
            </small>
          </div>
          ${!agend.done ? `
            <div style="
              background: ${timeColor};
              color: white;
              padding: 8px 12px;
              border-radius: 4px;
              font-weight: bold;
              text-align: center;
              min-width: 60px;
            ">
              ${timeStr}
            </div>
          ` : `
            <div style="
              background: #9E9E9E;
              color: white;
              padding: 8px 12px;
              border-radius: 4px;
              font-weight: bold;
              text-align: center;
              min-width: 60px;
              font-size: 12px;
            ">
              FINALIZADO
            </div>
          `}
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // ✅ Renderiza confirmação de envio (SIMPLIFICADA)
  function renderConfirmTab(cfg) {
    return `
      <div style="display: grid; gap: 15px;">
        <!-- Aviso destacado -->
        <div style="
          background: #FFE5E5;
          border: 3px solid #F44336;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        ">
          <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: bold; color: #D32F2F; font-size: 16px;">
            ENVIO IMEDIATO!
          </div>
          <div style="color: #C62828; font-size: 14px; margin-top: 8px;">
            O ataque será enviado <strong>AGORA</strong>
          </div>
        </div>

        <!-- Info do ataque -->
        <div style="background: white; border: 2px solid #8B4513; border-radius: 8px; padding: 15px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 12px; font-size: 16px;">📋 RESUMO DO ATAQUE</div>
          
          <div style="display: grid; gap: 10px;">
            <div style="background: #E3F2FD; padding: 12px; border-radius: 4px;">
              <div style="font-size: 11px; color: #1976D2; font-weight: bold;">ORIGEM</div>
              <div style="font-size: 18px; font-weight: bold; color: #8B4513;">${cfg.origem}</div>
            </div>

            <div style="text-align: center; font-size: 24px; color: #8B4513;">→</div>

            <div style="background: #FFF3E0; padding: 12px; border-radius: 4px;">
              <div style="font-size: 11px; color: #E65100; font-weight: bold;">DESTINO</div>
              <div style="font-size: 18px; font-weight: bold; color: #8B4513;">${cfg.alvo}</div>
            </div>
          </div>

          <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #E0E0E0;">
            <div style="font-weight: bold; color: #8B4513; margin-bottom: 10px;">🪖 TROPAS</div>
            ${renderTroopsPreview(cfg)}
          </div>
        </div>

        <!-- Checkbox de confirmação -->
        <div style="background: #FFF9E6; border: 2px dashed #FF9800; border-radius: 8px; padding: 15px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="confirm-checkbox" style="width: 20px; height: 20px; cursor: pointer;">
            <span style="font-weight: bold; color: #E65100;">
              Confirmar envio imediato deste ataque
            </span>
          </label>
        </div>
      </div>
    `;
  }

  // ✅ Executa o ataque imediatamente SEM ALTERAR O AGENDAMENTO ORIGINAL
  async function executeTest(cfg, statusDiv, overlay) {
    try {
      statusDiv.innerHTML = '🔥 <strong>Executando envio imediato...</strong>';
      statusDiv.style.background = '#FFF9C4';
      statusDiv.style.borderColor = '#FFC107';

      const success = await executeAttack(cfg);
      
      if (success) {
        statusDiv.innerHTML = '✅ <strong>Ataque enviado com sucesso!</strong><br><small>Verifique a praça de reunião</small>';
        statusDiv.style.background = '#E8F5E9';
        statusDiv.style.borderColor = '#4CAF50';
        
        // ✅ IMPORTANTE: NÃO ALTERA O AGENDAMENTO ORIGINAL
        // O agendamento permanece exatamente como estava na lista
        // (não marca como done, não modifica nada)
        
        setTimeout(() => {
          overlay.remove();
          window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
        }, 2000);
        
      } else {
        statusDiv.innerHTML = '⚠️ <strong>Teste concluído</strong><br><small>Não foi possível confirmar o envio. Verifique manualmente.</small>';
        statusDiv.style.background = '#FFF3E0';
        statusDiv.style.borderColor = '#FF9800';
      }
      
    } catch (error) {
      console.error('[Test Modal] Erro:', error);
      statusDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
      statusDiv.style.background = '#FFEBEE';
      statusDiv.style.borderColor = '#F44336';
    }
  }

  // === Cria e exibe o modal simplificado ===
  function showModal() {
    const list = getList();
    
    if (list.length === 0) {
      alert('❌ Nenhum agendamento encontrado!');
      return;
    }

    const existing = document.getElementById('tws-test-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tws-test-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #F4E4C1 0%, #E8D4A8 100%);
      border: 3px solid #8B4513;
      border-radius: 12px;
      padding: 0;
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease;
      display: flex;
      flex-direction: column;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: scale(0.9) translateY(-20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        
        .modal-header {
          background: #8B4513;
          color: white;
          padding: 20px;
          text-align: center;
          border-bottom: 3px solid #654321;
        }
        .modal-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          max-height: 60vh;
        }
        .modal-footer {
          padding: 15px 20px;
          background: #E8D4A8;
          border-top: 2px solid #8B4513;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-cancel { background: #9E9E9E; color: white; }
        .btn-send { background: #F44336; color: white; }
        #test-status {
          padding: 12px;
          border: 2px solid #2196F3;
          border-radius: 6px;
          background: #E3F2FD;
          margin-bottom: 15px;
          font-size: 13px;
          line-height: 1.6;
        }
      </style>

      <!-- Cabeçalho -->
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 20px;">🚀 Envio Imediato de Ataques</h2>
        <small>Selecione um agendamento para enviar agora</small>
      </div>

      <!-- Conteúdo -->
      <div class="modal-content">
        <div id="test-status"></div>
        <div id="agendamentos-list"></div>
        <div id="confirm-section" style="display: none;"></div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button class="btn btn-cancel" onclick="document.getElementById('tws-test-modal').remove()">❌ Fechar</button>
        <button class="btn btn-send" id="btn-send" onclick="TWS_TestModal._executeFinal()" style="display: none;">🚀 Enviar Agora</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Estado compartilhado
    let selectedAgenda = null;

    // Renderizar lista de agendamentos
    document.getElementById('agendamentos-list').innerHTML = renderAgendamentosList();

    // ✅ Funções do modal
    const modalFunctions = {
      _selectAgenda(idx) {
        const list = getList();
        selectedAgenda = { ...list[idx] }; // Cria cópia
        
        // Mostrar confirmação
        document.getElementById('agendamentos-list').style.display = 'none';
        document.getElementById('confirm-section').style.display = 'block';
        document.getElementById('confirm-section').innerHTML = renderConfirmTab(selectedAgenda);
        document.getElementById('btn-send').style.display = 'block';
        
        console.log('[Test Modal] Agendamento selecionado:', selectedAgenda);
      },

      _executeFinal() {
        const confirmed = document.getElementById('confirm-checkbox')?.checked;
        if (!confirmed) {
          alert('⚠️ Marque o checkbox de confirmação antes de continuar!');
          return;
        }

        const statusDiv = document.getElementById('test-status');
        const overlay = document.getElementById('tws-test-modal');

        // ✅ EXECUTA O ATAQUE SEM MODIFICAR O AGENDAMENTO ORIGINAL
        // A lista de agendamentos permanece intacta
        executeTest(selectedAgenda, statusDiv, overlay);
      }
    };

    // ✅ Adicionar funções ao objeto global
    Object.assign(window.TWS_TestModal, modalFunctions);

    // ✅ Fechar seguro
    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove();
      }
    };
  }

  // === INICIALIZAÇÃO ===
  function init() {
    if (!window.TWS_TestModal) {
      window.TWS_TestModal = {};
    }
    
    window.TWS_TestModal.show = showModal;
    
    console.log('[TW Scheduler Test Modal] ✅ Carregado - VERSÃO SIMPLIFICADA!');
    console.log('[TW Scheduler Test Modal] ✅ Função show disponível:', typeof window.TWS_TestModal.show);
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
