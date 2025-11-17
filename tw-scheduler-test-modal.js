(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler Test Modal] Backend não carregado!');
    return;
  }

  const {
    parseCoord,
    getList,
    setList,
    executeAttack,
    getVillageTroops,
    validateTroops,
    TROOP_LIST,
    _internal
  } = window.TWS_Backend;

  // === Renderiza preview das tropas ===
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

  // === Executa o teste com os dados do modal ===
  async function executeTest(cfg, statusDiv, overlay) {
    try {
      statusDiv.innerHTML = '🔥 <strong>Executando teste...</strong>';
      statusDiv.style.background = '#FFF9C4';
      statusDiv.style.borderColor = '#FFC107';

      const success = await executeAttack(cfg);
      
      if (success) {
        statusDiv.innerHTML = '✅ <strong>Ataque enviado com sucesso!</strong><br><small>Verifique a praça de reunião</small>';
        statusDiv.style.background = '#E8F5E9';
        statusDiv.style.borderColor = '#4CAF50';
        
        // Marcar como concluído na lista
        const list = getList();
        const idx = list.findIndex(a => 
          a.origem === cfg.origem && 
          a.alvo === cfg.alvo && 
          a.datetime === cfg.datetime
        );
        
        if (idx !== -1) {
          list[idx].done = true;
          list[idx].success = true;
          list[idx].executedAt = new Date().toISOString();
          setList(list);
        }
        
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
      console.error('[Test Modal] Erro ao executar:', error);
      statusDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
      statusDiv.style.background = '#FFEBEE';
      statusDiv.style.borderColor = '#F44336';
      
      // Marcar como erro na lista
      const list = getList();
      const idx = list.findIndex(a => 
        a.origem === cfg.origem && 
        a.alvo === cfg.alvo && 
        a.datetime === cfg.datetime
      );
      
      if (idx !== -1) {
        list[idx].done = true;
        list[idx].success = false;
        list[idx].error = error.message;
        setList(list);
      }
    }
  }

  // === Valida e executa ===
  async function handleExecute(overlay) {
    const statusDiv = document.getElementById('test-status');
    const executeBtn = document.getElementById('test-btn-execute');
    
    // Prevenir múltiplos submits
    if (executeBtn.disabled) {
      console.warn('[Test Modal] Execução já em andamento...');
      return;
    }
    
    executeBtn.disabled = true;
    executeBtn.textContent = '⏳ Executando...';

    try {
      // Coletar dados do formulário
      const origemSelect = document.getElementById('test-origem');
      const origemId = origemSelect.value;
      const origemCoord = origemSelect.options[origemSelect.selectedIndex]?.dataset?.coord;
      const alvo = document.getElementById('test-alvo').value.trim();

      // Validar origem
      if (!origemId || !origemCoord) {
        statusDiv.innerHTML = '❌ Selecione uma aldeia de origem válida!';
        statusDiv.style.background = '#FFEBEE';
        statusDiv.style.borderColor = '#F44336';
        executeBtn.disabled = false;
        executeBtn.textContent = '🚀 Executar Teste';
        return;
      }

      // Validar alvo
      const alvoParsed = parseCoord(alvo);
      if (!alvoParsed) {
        statusDiv.innerHTML = '❌ Coordenada de alvo inválida! Use formato: XXX|YYY';
        statusDiv.style.background = '#FFEBEE';
        statusDiv.style.borderColor = '#F44336';
        executeBtn.disabled = false;
        executeBtn.textContent = '🚀 Executar Teste';
        return;
      }

      // Coletar tropas
      const troops = {};
      let hasTroops = false;
      TROOP_LIST.forEach(u => {
        const val = document.getElementById(`test-troop-${u}`).value;
        const num = parseInt(val, 10);
        troops[u] = isNaN(num) ? 0 : num;
        if (troops[u] > 0) hasTroops = true;
      });

      if (!hasTroops) {
        statusDiv.innerHTML = '❌ Adicione pelo menos uma tropa!';
        statusDiv.style.background = '#FFEBEE';
        statusDiv.style.borderColor = '#F44336';
        executeBtn.disabled = false;
        executeBtn.textContent = '🚀 Executar Teste';
        return;
      }

      // Validar tropas disponíveis
      statusDiv.innerHTML = '🔍 Verificando tropas disponíveis...';
      statusDiv.style.background = '#E3F2FD';
      statusDiv.style.borderColor = '#2196F3';
      
      const available = await getVillageTroops(origemId);
      
      if (available) {
        const errors = validateTroops(troops, available);
        if (errors.length > 0) {
          statusDiv.innerHTML = `❌ <strong>Tropas insuficientes:</strong><br>${errors.map(e => `<small>${e}</small>`).join('<br>')}`;
          statusDiv.style.background = '#FFEBEE';
          statusDiv.style.borderColor = '#F44336';
          executeBtn.disabled = false;
          executeBtn.textContent = '🚀 Executar Teste';
          return;
        }
      }

      // Criar config de ataque
      const cfg = {
        origem: origemCoord,
        origemId,
        alvo: alvoParsed,
        datetime: new Date().toLocaleString('pt-BR').replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/, '$1/$2/$3 $4:$5:$6'),
        done: false,
        ...troops
      };

      // Executar
      await executeTest(cfg, statusDiv, overlay);
      
    } catch (error) {
      console.error('[Test Modal] Erro:', error);
      statusDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
      statusDiv.style.background = '#FFEBEE';
      statusDiv.style.borderColor = '#F44336';
      executeBtn.disabled = false;
      executeBtn.textContent = '🚀 Executar Teste';
    }
  }

  // === Preenche os selects de origem ===
  function loadOriginSelects(currentOrigemId) {
    const select = document.getElementById('test-origem');
    if (!select) return;

    const { myVillages } = _internal;
    
    if (myVillages.length === 0) {
      select.innerHTML = '<option value="">❌ Carregue as aldeias primeiro</option>';
      return;
    }

    select.innerHTML = '<option value="">Selecione uma aldeia...</option>' + 
      myVillages.map(v => {
        const selected = v.id === currentOrigemId ? 'selected' : '';
        return `<option value="${v.id}" data-coord="${v.coord}" ${selected}>${v.name} (${v.coord})</option>`;
      }).join('');
  }

  // === Cria e exibe o modal ===
  function showModal(agendamento = null) {
    // Se não foi passado um agendamento, pegar da lista
    if (!agendamento) {
      const list = getList();
      const pendentes = list.filter(a => !a.done);
      
      if (pendentes.length === 0) {
        alert('❌ Nenhum agendamento pendente encontrado!\n\nAdicione um agendamento primeiro.');
        return;
      }

      // Se há múltiplos, mostrar seletor
      if (pendentes.length > 1) {
        const choices = pendentes.map((a, i) => 
          `${i + 1}. ${a.origem} → ${a.alvo} (${a.datetime})`
        ).join('\n');
        
        const choice = prompt(
          `📋 Selecione um agendamento para testar:\n\n${choices}\n\nDigite o número (1-${pendentes.length}):`
        );
        
        const idx = parseInt(choice, 10) - 1;
        
        if (idx < 0 || idx >= pendentes.length) {
          alert('❌ Seleção inválida!');
          return;
        }
        
        agendamento = pendentes[idx];
      } else {
        agendamento = pendentes[0];
      }
    }

    // Remove modal existente
    const existing = document.getElementById('tws-test-modal');
    if (existing) existing.remove();

    // Criar overlay
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

    // Criar modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #F4E4C1 0%, #E8D4A8 100%);
      border: 3px solid #8B4513;
      border-radius: 12px;
      padding: 25px;
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: scale(0.9) translateY(-20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .test-section {
          background: white;
          border: 2px solid #8B4513;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .test-section-title {
          font-size: 16px;
          font-weight: bold;
          color: #8B4513;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .test-input, .test-select {
          width: 100%;
          padding: 10px;
          border: 2px solid #8B4513;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.2s;
        }
        .test-input:focus, .test-select:focus {
          outline: none;
          border-color: #654321;
          box-shadow: 0 0 8px rgba(139, 69, 19, 0.3);
        }
        .test-troops-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        .test-troop-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #F5F5F5;
          border: 2px solid #E0E0E0;
          border-radius: 6px;
          padding: 8px;
          transition: all 0.2s;
        }
        .test-troop-input:hover {
          border-color: #8B4513;
          transform: translateY(-2px);
        }
        .test-troop-input label {
          font-size: 11px;
          margin-bottom: 5px;
          color: #654321;
          font-weight: bold;
        }
        .test-troop-input input {
          width: 70px;
          padding: 6px;
          border: 2px solid #8B4513;
          border-radius: 4px;
          text-align: center;
          font-weight: bold;
          font-size: 14px;
        }
        .test-btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .test-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .test-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .test-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        .test-btn-execute {
          background: linear-gradient(135deg, #F44336 0%, #D32F2F 100%);
          color: white;
        }
        .test-btn-cancel {
          background: linear-gradient(135deg, #9E9E9E 0%, #757575 100%);
          color: white;
        }
        #test-status {
          padding: 12px;
          border: 2px solid #2196F3;
          border-radius: 6px;
          background: #E3F2FD;
          margin-bottom: 15px;
          font-size: 13px;
          line-height: 1.6;
          transition: all 0.3s;
        }
        .test-warning {
          background: #FFF3E0;
          border: 2px solid #FF9800;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 15px;
          font-size: 13px;
          color: #E65100;
        }
      </style>

      <h2 style="margin: 0 0 20px 0; color: #8B4513; font-size: 24px; display: flex; align-items: center; gap: 10px;">
        🔥 Teste de Envio
      </h2>

      <div class="test-warning">
        <strong>⚠️ ATENÇÃO:</strong> Este teste vai enviar o ataque <strong>IMEDIATAMENTE</strong>, ignorando o horário agendado. Verifique todos os dados antes de confirmar!
      </div>

      <div id="test-status">
        ℹ️ Revise os dados abaixo e clique em <strong>"Executar Teste"</strong> quando estiver pronto.
      </div>

      <!-- ORIGEM -->
      <div class="test-section">
        <div class="test-section-title">
          📍 Aldeia de Origem
        </div>
        <select id="test-origem" class="test-select"></select>
      </div>

      <!-- ALVO -->
      <div class="test-section">
        <div class="test-section-title">
          🎯 Alvo
        </div>
        <input type="text" id="test-alvo" class="test-input" placeholder="XXX|YYY" value="${agendamento.alvo || ''}">
      </div>

      <!-- TROPAS -->
      <div class="test-section">
        <div class="test-section-title">
          🪖 Tropas a Enviar
        </div>
        <div class="test-troops-grid">
          ${TROOP_LIST.map(u => `
            <div class="test-troop-input">
              <label>${u}</label>
              <input type="number" id="test-troop-${u}" min="0" value="${agendamento[u] || 0}">
            </div>
          `).join('')}
        </div>
      </div>

      <!-- PREVIEW -->
      <div class="test-section">
        <div class="test-section-title">
          📊 Preview
        </div>
        <div style="font-size: 13px; color: #666;">
          <strong>Origem:</strong> ${agendamento.origem || agendamento.origemId}<br>
          <strong>Destino:</strong> ${agendamento.alvo}<br>
          <strong>Horário Original:</strong> <span style="color: #F44336;">${agendamento.datetime} (SERÁ IGNORADO)</span>
        </div>
        ${renderTroopsPreview(agendamento)}
      </div>

      <!-- BOTÕES -->
      <div class="test-btn-group">
        <button id="test-btn-cancel" class="test-btn test-btn-cancel">❌ Cancelar</button>
        <button id="test-btn-execute" class="test-btn test-btn-execute">🚀 Executar Teste</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Carregar selects de origem
    loadOriginSelects(agendamento.origemId);

    // Event listeners
    const btnCancel = document.getElementById('test-btn-cancel');
    const btnExecute = document.getElementById('test-btn-execute');

    btnCancel.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    btnExecute.onclick = async () => {
      if (confirm('⚠️ CONFIRMAR TESTE\n\nO ataque será enviado AGORA.\n\nTem certeza?')) {
        await handleExecute(overlay);
      }
    };
  }

  // === Expor API global ===
  window.TWS_TestModal = {
    show: showModal
  };

  console.log('[TW Scheduler Test Modal] Módulo carregado com sucesso!');
})();
