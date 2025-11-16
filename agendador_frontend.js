(function () {
  'use strict';

  if (!window.TWS_Backend) {
    alert('[TW Scheduler] Backend não carregado! Carregue o backend primeiro.');
    return;
  }

  const {
    loadVillageTxt,
    parseDateTimeToMs,
    parseCoord,
    getList,
    setList,
    startScheduler,
    importarDeBBCode,
    executeAttack,
    getVillageTroops,
    validateTroops,
    TROOP_LIST,
    STORAGE_KEY,
    PANEL_STATE_KEY,
    _internal
  } = window.TWS_Backend;

  let panelOpen = false;

  // === Renderiza tabela de agendamentos ===
  function renderTable() {
    const tbody = document.getElementById('tws-tbody');
    if (!tbody) return;

    const list = getList();
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">Nenhum agendamento</td></tr>';
      return;
    }

    const now = Date.now();

    list.forEach((cfg, idx) => {
      const tr = document.createElement('tr');
      
      // Status visual
      let statusIcon = '⏳';
      let statusColor = '#fff';
      let statusText = 'Agendado';
      
      if (cfg.done) {
        if (cfg.success) {
          statusIcon = '✅';
          statusColor = '#90EE90';
          statusText = 'Enviado';
        } else {
          statusIcon = '❌';
          statusColor = '#FFB6C1';
          statusText = cfg.error || 'Erro';
        }
      } else {
        const t = parseDateTimeToMs(cfg.datetime);
        if (t && !isNaN(t)) {
          const diff = t - now;
          if (diff > 0) {
            const seconds = Math.ceil(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            statusText = `${minutes}:${secs.toString().padStart(2, '0')}`;
            statusIcon = '🕒';
          } else if (diff > -10000) {
            statusIcon = '🔥';
            statusColor = '#FFD700';
            statusText = 'Executando...';
          }
        }
      }

      tr.style.backgroundColor = statusColor;
      tr.innerHTML = `
        <td style="text-align:center;">${statusIcon}</td>
        <td>${cfg.origem || cfg.origemId || '?'}</td>
        <td>${cfg.alvo || '?'}</td>
        <td style="font-size:11px;">${cfg.datetime || '?'}</td>
        <td style="font-size:11px;">${TROOP_LIST.map(u => `${u}:${cfg[u] || 0}`).join(' ')}</td>
        <td style="text-align:center;font-size:11px;">${statusText}</td>
        <td style="text-align:center;">
          ${cfg.done ? 
            `<button onclick="TWS_Panel.viewDetails(${idx})" style="font-size:10px;padding:2px 6px;">📋</button>` :
            `<button onclick="TWS_Panel.removeItem(${idx})" style="font-size:10px;padding:2px 6px;">🗑️</button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // === View detalhes de um agendamento executado ===
  function viewDetails(idx) {
    const list = getList();
    const cfg = list[idx];
    if (!cfg) return;

    let details = `
═══════════════════════════════
📋 DETALHES DO AGENDAMENTO #${idx + 1}
═══════════════════════════════

${cfg.success ? '✅ STATUS: ENVIADO COM SUCESSO' : '❌ STATUS: FALHOU'}

📍 Origem: ${cfg.origem || cfg.origemId}
🎯 Alvo: ${cfg.alvo}
🕐 Horário Agendado: ${cfg.datetime}
${cfg.executedAt ? `⏰ Executado em: ${new Date(cfg.executedAt).toLocaleString('pt-BR')}` : ''}

🪖 TROPAS ENVIADAS:
${TROOP_LIST.map(u => `  ${u}: ${cfg[u] || 0}`).join('\n')}

${cfg.error ? `\n⚠️ ERRO:\n${cfg.error}` : ''}
═══════════════════════════════
    `.trim();

    alert(details);
  }

  // === Remove item ===
  function removeItem(idx) {
    if (!confirm('Remover este agendamento?')) return;
    const list = getList();
    list.splice(idx, 1);
    setList(list);
  }

  // === Limpa agendamentos concluídos ===
  function clearCompleted() {
    const list = getList();
    const filtered = list.filter(a => !a.done);
    if (filtered.length === list.length) {
      alert('Nenhum agendamento concluído para limpar.');
      return;
    }
    if (confirm(`Remover ${list.length - filtered.length} agendamento(s) concluído(s)?`)) {
      setList(filtered);
    }
  }

  // === Limpa TODOS os agendamentos ===
  function clearAll() {
    const list = getList();
    if (list.length === 0) {
      alert('Nenhum agendamento para limpar.');
      return;
    }
    if (confirm(`⚠️ ATENÇÃO!\n\nRemover TODOS os ${list.length} agendamento(s)?\n\nEsta ação não pode ser desfeita!`)) {
      setList([]);
      alert('✅ Todos os agendamentos foram removidos.');
    }
  }

  // === Limpa agendamentos pendentes ===
  function clearPending() {
    const list = getList();
    const filtered = list.filter(a => a.done);
    if (filtered.length === list.length) {
      alert('Nenhum agendamento pendente para limpar.');
      return;
    }
    if (confirm(`Remover ${list.length - filtered.length} agendamento(s) pendente(s)?`)) {
      setList(filtered);
    }
  }

  // === MODAL: Adiciona agendamento manual ===
  function addManual() {
    showModal();
  }

  // === Cria e exibe o modal ===
  function showModal() {
    // Remove modal existente se houver
    const existing = document.getElementById('tws-modal');
    if (existing) existing.remove();

    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = 'tws-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.2s ease;
    `;

    // Criar modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #F4E4C1;
      border: 3px solid #8B4513;
      border-radius: 8px;
      padding: 20px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .tws-form-group {
          margin-bottom: 15px;
        }
        .tws-form-label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
          color: #8B4513;
        }
        .tws-form-input, .tws-form-select {
          width: 100%;
          padding: 8px;
          border: 2px solid #8B4513;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .tws-form-input:focus, .tws-form-select:focus {
          outline: none;
          border-color: #654321;
          box-shadow: 0 0 5px rgba(139, 69, 19, 0.3);
        }
        .tws-troops-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        .tws-troop-input {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .tws-troop-input label {
          font-size: 11px;
          margin-bottom: 3px;
          color: #654321;
        }
        .tws-troop-input input {
          width: 60px;
          padding: 5px;
          border: 2px solid #8B4513;
          border-radius: 4px;
          text-align: center;
        }
        .tws-btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .tws-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tws-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .tws-btn-primary {
          background: #4CAF50;
          color: white;
        }
        .tws-btn-secondary {
          background: #9E9E9E;
          color: white;
        }
        .tws-validation-msg {
          padding: 10px;
          margin-top: 10px;
          border-radius: 4px;
          font-size: 13px;
          display: none;
        }
        .tws-validation-error {
          background: #FFE5E5;
          border: 1px solid #FF0000;
          color: #CC0000;
        }
        .tws-validation-success {
          background: #E5FFE5;
          border: 1px solid #00CC00;
          color: #008800;
        }
      </style>

      <h2 style="margin: 0 0 20px 0; color: #8B4513;">➕ Adicionar Agendamento</h2>

      <form id="tws-add-form">
        <!-- Origem -->
        <div class="tws-form-group">
          <label class="tws-form-label">📍 Aldeia de Origem:</label>
          <select id="tws-origem" class="tws-form-select">
            <option value="">Carregando aldeias...</option>
          </select>
        </div>

        <!-- Alvo -->
        <div class="tws-form-group">
          <label class="tws-form-label">🎯 Alvo (Coordenada XXX|YYY):</label>
          <input type="text" id="tws-alvo" class="tws-form-input" placeholder="529|431" pattern="\\d{3}\\|\\d{3}">
        </div>

        <!-- Data/Hora -->
        <div class="tws-form-group">
          <label class="tws-form-label">🕐 Data e Hora (DD/MM/YYYY HH:MM:SS):</label>
          <input type="text" id="tws-datetime" class="tws-form-input" placeholder="16/11/2024 10:30:00">
          <small style="color: #666;">Ou use: <a href="#" id="tws-set-now" style="color: #2196F3;">Agora</a> | <a href="#" id="tws-set-1min" style="color: #2196F3;">+1min</a> | <a href="#" id="tws-set-5min" style="color: #2196F3;">+5min</a></small>
        </div>

        <!-- Tropas -->
        <div class="tws-form-group">
          <label class="tws-form-label">🪖 Tropas:</label>
          <div class="tws-troops-grid">
            ${TROOP_LIST.map(u => `
              <div class="tws-troop-input">
                <label>${u}</label>
                <input type="number" id="tws-troop-${u}" min="0" value="0">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Mensagem de validação -->
        <div id="tws-validation-msg" class="tws-validation-msg"></div>

        <!-- Botões -->
        <div class="tws-btn-group">
          <button type="button" id="tws-btn-cancel" class="tws-btn tws-btn-secondary">❌ Cancelar</button>
          <button type="submit" class="tws-btn tws-btn-primary">✅ Adicionar</button>
        </div>
      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Carregar aldeias
    loadVillageSelect();

    // Event listeners
    document.getElementById('tws-btn-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    // Atalhos de data/hora
    document.getElementById('tws-set-now').onclick = (e) => {
      e.preventDefault();
      const now = new Date();
      document.getElementById('tws-datetime').value = formatDateTime(now);
    };
    document.getElementById('tws-set-1min').onclick = (e) => {
      e.preventDefault();
      const date = new Date(Date.now() + 60000);
      document.getElementById('tws-datetime').value = formatDateTime(date);
    };
    document.getElementById('tws-set-5min').onclick = (e) => {
      e.preventDefault();
      const date = new Date(Date.now() + 300000);
      document.getElementById('tws-datetime').value = formatDateTime(date);
    };

    // Submit form
    document.getElementById('tws-add-form').onsubmit = async (e) => {
      e.preventDefault();
      await handleFormSubmit(overlay);
    };
  }

  // === Formata data para DD/MM/YYYY HH:MM:SS ===
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // === Carrega aldeias no select ===
  async function loadVillageSelect() {
    const select = document.getElementById('tws-origem');
    if (!select) return;

    const { myVillages } = _internal;
    
    if (myVillages.length === 0) {
      select.innerHTML = '<option value="">⚠️ Carregue as aldeias primeiro</option>';
      return;
    }

    select.innerHTML = '<option value="">Selecione uma aldeia...</option>' + 
      myVillages.map(v => `<option value="${v.id}" data-coord="${v.coord}">${v.name} (${v.coord})</option>`).join('');
  }

  // === Processa submit do formulário ===
  async function handleFormSubmit(overlay) {
    const msgEl = document.getElementById('tws-validation-msg');
    const showMsg = (msg, type) => {
      msgEl.textContent = msg;
      msgEl.className = `tws-validation-msg tws-validation-${type}`;
      msgEl.style.display = 'block';
    };

    // Pegar valores
    const origemSelect = document.getElementById('tws-origem');
    const origemId = origemSelect.value;
    const origemCoord = origemSelect.options[origemSelect.selectedIndex]?.dataset?.coord;
    const alvo = document.getElementById('tws-alvo').value.trim();
    const datetime = document.getElementById('tws-datetime').value.trim();

    // Validações
    if (!origemId) {
      showMsg('❌ Selecione uma aldeia de origem!', 'error');
      return;
    }

    const alvoParsed = parseCoord(alvo);
    if (!alvoParsed) {
      showMsg('❌ Coordenada de alvo inválida! Use formato: XXX|YYY', 'error');
      return;
    }

    const t = parseDateTimeToMs(datetime);
    if (!t || isNaN(t)) {
      showMsg('❌ Data/hora inválida! Use formato: DD/MM/YYYY HH:MM:SS', 'error');
      return;
    }

    // Coletar tropas
    const troops = {};
    let hasTroops = false;
    TROOP_LIST.forEach(u => {
      const val = document.getElementById(`tws-troop-${u}`).value;
      const num = parseInt(val, 10);
      troops[u] = isNaN(num) ? 0 : num;
      if (troops[u] > 0) hasTroops = true;
    });

    if (!hasTroops) {
      showMsg('❌ Adicione pelo menos uma tropa!', 'error');
      return;
    }

    // Validar tropas disponíveis
    showMsg('🔍 Verificando tropas disponíveis...', 'success');
    const available = await getVillageTroops(origemId);
    
    if (available) {
      const errors = validateTroops(troops, available);
      if (errors.length > 0) {
        showMsg(`❌ Tropas insuficientes:\n${errors.join('\n')}`, 'error');
        return;
      }
    }

    // Criar agendamento
    const cfg = {
      origem: origemCoord,
      origemId,
      alvo: alvoParsed,
      datetime,
      done: false,
      ...troops
    };

    const list = getList();
    list.push(cfg);
    setList(list);

    showMsg('✅ Agendamento adicionado com sucesso!', 'success');
    setTimeout(() => overlay.remove(), 1500);
  }

  // === Importar BBCode ===
  function importBBCode() {
    const bb = prompt('Cole o BBCode aqui:');
    if (!bb) return;

    const agendamentos = importarDeBBCode(bb);
    if (agendamentos.length === 0) {
      alert('Nenhum agendamento encontrado no BBCode.');
      return;
    }

    const list = getList();
    list.push(...agendamentos);
    setList(list);
    alert(`✅ ${agendamentos.length} agendamento(s) importado(s)!`);
  }

  // === Carregar aldeias ===
  async function loadVillages() {
    const statusDiv = document.getElementById('tws-status');
    if (statusDiv) statusDiv.innerHTML = '⏳ Carregando aldeias...';

    await loadVillageTxt();
    const { myVillages } = _internal;

    if (statusDiv) {
      statusDiv.innerHTML = `✅ ${myVillages.length} aldeia(s) carregada(s)`;
    }
    alert(`Carregadas ${myVillages.length} aldeias próprias.`);
  }

  // === Testar envio imediato ===
  async function testSend() {
    if (!confirm('⚠️ TESTE: Vai enviar um ataque AGORA.\n\nTem certeza?')) return;

    const list = getList();
    if (list.length === 0) {
      alert('Nenhum agendamento na lista!');
      return;
    }

    const choice = prompt(`Escolha um agendamento para testar (1-${list.length}):`);
    const idx = parseInt(choice, 10) - 1;

    if (idx < 0 || idx >= list.length) {
      alert('Índice inválido');
      return;
    }

    const cfg = list[idx];
    const statusDiv = document.getElementById('tws-status');
    if (statusDiv) statusDiv.innerHTML = '🔥 Executando teste...';

    try {
      const success = await executeAttack(cfg);
      cfg.done = true;
      cfg.success = success;
      cfg.executedAt = new Date().toISOString();
      setList(list);
      
      if (success) {
        alert('✅ Teste concluído! Verifique se o ataque foi enviado.');
      } else {
        alert('⚠️ Teste finalizado, mas não foi possível confirmar envio. Verifique manualmente.');
      }
    } catch (err) {
      cfg.done = true;
      cfg.success = false;
      cfg.error = err.message;
      setList(list);
      alert(`❌ Erro no teste:\n${err.message}`);
    }
  }

  // === Exportar lista ===
  function exportList() {
    const list = getList();
    if (list.length === 0) {
      alert('Lista vazia!');
      return;
    }

    const json = JSON.stringify(list, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tw_scheduler_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // === Importar lista ===
  function importList() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (!Array.isArray(imported)) {
            alert('Arquivo inválido!');
            return;
          }

          const list = getList();
          list.push(...imported);
          setList(list);
          alert(`✅ ${imported.length} agendamento(s) importado(s)!`);
        } catch (err) {
          alert('Erro ao importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  // === Toggle painel ===
  function togglePanel() {
    const panel = document.getElementById('tws-panel');
    if (!panel) return;

    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? 'block' : 'none';
    localStorage.setItem(PANEL_STATE_KEY, panelOpen ? '1' : '0');
  }

  // === Criar interface ===
  function createUI() {
    // Remover se já existe
    let existing = document.getElementById('tws-panel');
    if (existing) existing.remove();

    existing = document.getElementById('tws-toggle-btn');
    if (existing) existing.remove();

    // Botão toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'tws-toggle-btn';
    toggleBtn.innerHTML = '📅';
    toggleBtn.title = 'TW Scheduler';
    toggleBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
      padding: 8px 12px;
      background: #8B4513;
      color: white;
      border: 2px solid #654321;
      border-radius: 6px;
      cursor: pointer;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    toggleBtn.onclick = togglePanel;
    document.body.appendChild(toggleBtn);

    // Painel principal
    const panel = document.createElement('div');
    panel.id = 'tws-panel';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      width: 90%;
      max-width: 1000px;
      max-height: 80vh;
      background: #F4E4C1;
      border: 3px solid #8B4513;
      border-radius: 8px;
      padding: 15px;
      z-index: 99998;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      font-family: Arial, sans-serif;
      display: none;
    `;

    panel.innerHTML = `
      <div style="margin-bottom: 15px;">
        <h2 style="margin: 0 0 10px 0; color: #8B4513;">⚔️ TW Scheduler Multi v2.0</h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
          <button onclick="TWS_Panel.addManual()" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">➕ Adicionar</button>
          <button onclick="TWS_Panel.importBBCode()" style="padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 BBCode</button>
          <button onclick="TWS_Panel.loadVillages()" style="padding: 6px 12px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">🏰 Carregar Aldeias</button>
          <button onclick="TWS_Panel.testSend()" style="padding: 6px 12px; background: #F44336; color: white; border: none; border-radius: 4px; cursor: pointer;">🔥 Testar Envio</button>
          <button onclick="TWS_Panel.clearCompleted()" style="padding: 6px 12px; background: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Limpar Concluídos</button>
          <button onclick="TWS_Panel.clearPending()" style="padding: 6px 12px; background: #FF6F00; color: white; border: none; border-radius: 4px; cursor: pointer;">⏳ Limpar Pendentes</button>
          <button onclick="TWS_Panel.clearAll()" style="padding: 6px 12px; background: #D32F2F; color: white; border: none; border-radius: 4px; cursor: pointer;">🚫 Limpar Tudo</button>
          <button onclick="TWS_Panel.exportList()" style="padding: 6px 12px; background: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer;">💾 Exportar</button>
          <button onclick="TWS_Panel.importList()" style="padding: 6px 12px; background: #795548; color: white; border: none; border-radius: 4px; cursor: pointer;">📂 Importar</button>
        </div>
        <div id="tws-status" style="padding: 8px; background: #E8D4A8; border: 1px solid #8B4513; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
          Pronto. Use os botões acima.
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
          <thead>
            <tr style="background: #8B4513; color: white;">
              <th style="padding: 8px; border: 1px solid #654321;">Status</th>
              <th style="padding: 8px; border: 1px solid #654321;">Origem</th>
              <th style="padding: 8px; border: 1px solid #654321;">Alvo</th>
              <th style="padding: 8px; border: 1px solid #654321;">Data/Hora</th>
              <th style="padding: 8px; border: 1px solid #654321;">Tropas</th>
              <th style="padding: 8px; border: 1px solid #654321;">Info</th>
              <th style="padding: 8px; border: 1px solid #654321;">Ações</th>
            </tr>
          </thead>
          <tbody id="tws-tbody"></tbody>
        </table>
      </div>
    `;

    document.body.appendChild(panel);

    // Restaurar estado
    const savedState = localStorage.getItem(PANEL_STATE_KEY);
    panelOpen = savedState === '1';
    panel.style.display = panelOpen ? 'block' : 'none';

    // Iniciar scheduler e renderizar
    startScheduler();
    renderTable();

    // Atualizar tabela a cada segundo
    setInterval(renderTable, 1000);
  }

  // === Expor API global ===
  window.TWS_Panel = {
    createUI,
    renderTable,
    addManual,
    importBBCode,
    loadVillages,
    testSend,
    clearCompleted,
    clearPending,
    clearAll,
    removeItem,
    viewDetails,
    exportList,
    importList,
    togglePanel
  };

  // === Inicializar ===
  createUI();
  console.log('[TW Scheduler] Frontend carregado com sucesso!');
})();
