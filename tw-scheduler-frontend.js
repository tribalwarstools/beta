(function () {
  'use strict';

  if (!window.TWS_Backend) {
    alert('[TW Scheduler] Backend não carregado! Carregue o backend primeiro.');
    return;
  }

  const {
    loadVillageTxt,
    parseDateTimeToMs,
    getList,
    setList,
    startScheduler,
    importarDeBBCode,
    executeAttack,
    TROOP_LIST,
    PANEL_STATE_KEY,
    _internal
  } = window.TWS_Backend;

  let panelOpen = false;
  let updateInterval = null; // ✅ Controlar o interval

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
          } else if (diff > -300000) {
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
    renderTable();
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
      renderTable();
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
      renderTable();
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
      renderTable();
    }
  }

  // === MODAL: Adiciona agendamento manual (chama o módulo externo) ===
  function addManual() {
    if (!window.TWS_Modal) {
      alert(
        '❌ ERRO: Módulo do Modal não está disponível!\n\n' +
        '📋 Certifique-se de que você carregou os arquivos na ordem:\n\n' +
        '   <script src="tw-scheduler-backend.js"></script>\n' +
        '   <script src="tw-scheduler-frontend.js"></script>\n' +
        '   <script src="tw-scheduler-modal.js"></script>\n\n' +
        '⚠️ Verifique:\n' +
        '   • O arquivo "tw-scheduler-modal.js" existe?\n' +
        '   • Está no mesmo diretório dos outros arquivos?\n' +
        '   • Abra o Console (F12) e veja se há erros de carregamento\n\n' +
        '💡 Dica: Verifique se o console mostra a mensagem:\n' +
        '   "[TW Scheduler Modal] Módulo carregado com sucesso!"'
      );
      console.error('[TW Scheduler] window.TWS_Modal não encontrado. Verifique se tw-scheduler-modal.js foi carregado.');
      return;
    }
    window.TWS_Modal.show();
  }

  // === Importar BBCode ===
  function importBBCode() {
    if (!window.TWS_BBCodeModal) {
      alert(
        '❌ ERRO: Módulo do BBCode Modal não está disponível!\n\n' +
        '📋 Certifique-se de que você carregou os arquivos na ordem:\n\n' +
        '   <script src="tw-scheduler-backend.js"></script>\n' +
        '   <script src="tw-scheduler-frontend.js"></script>\n' +
        '   <script src="tw-scheduler-modal.js"></script>\n' +
        '   <script src="tw-scheduler-bbcode-modal.js"></script> ⚠️ FALTANDO\n\n' +
        '💡 Carregue o modal de BBCode e recarregue a página.'
      );
      console.error('[TW Scheduler] window.TWS_BBCodeModal não encontrado. Verifique se tw-scheduler-bbcode-modal.js foi carregado.');
      return;
    }
    window.TWS_BBCodeModal.show();
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
function testSend() {
  if (!window.TWS_TestModal) {
    alert(
      '❌ ERRO: Módulo do Test Modal não está disponível!\n\n' +
      '📋 Certifique-se de que você carregou:\n' +
      '   <script src="tw-scheduler-test-modal.js"></script>\n\n' +
      '💡 Recarregue a página após adicionar o arquivo.'
    );
    console.error('[TW Scheduler] window.TWS_TestModal não encontrado.');
    return;
  }
  window.TWS_TestModal.show();
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
          renderTable();
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
        <h2 style="margin: 0 0 10px 0; color: #8B4513;">⚔️ Agendador TW v4.4</h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
          <button onclick="TWS_Panel.addManual()" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">➕ Adicionar</button>
          <button onclick="TWS_Panel.importBBCode()" style="padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 BBCode</button>
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

    // ✅ CORREÇÃO: Limpar interval anterior antes de criar novo
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    // Atualizar tabela a cada segundo
    updateInterval = setInterval(renderTable, 1000);

    // ✅ CORREÇÃO: Remover listeners antigos antes de adicionar novo
    window.removeEventListener('tws-schedule-updated', renderTable);
    window.addEventListener('tws-schedule-updated', renderTable);
  }

  // === Expor API global ===
  window.TWS_Panel = {
    createUI,
    renderTable,
    addManual,
    importBBCode,
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
  console.log('[TW Scheduler Frontend] Carregado com sucesso! (versão modular)');
  
// Verificar se os modais estão carregados
setTimeout(() => {
  if (!window.TWS_Modal) {
    console.warn('[TW Scheduler] ⚠️ Modal de Adicionar não detectado.');
  } else {
    console.log('[TW Scheduler] ✅ Modal de Adicionar pronto!');
  }
  
  if (!window.TWS_BBCodeModal) {
    console.warn('[TW Scheduler] ⚠️ Modal de BBCode não detectado.');
  } else {
    console.log('[TW Scheduler] ✅ Modal de BBCode pronto!');
  }
  
  if (!window.TWS_TestModal) {
    console.warn('[TW Scheduler] ⚠️ Modal de Teste não detectado.');
  } else {
    console.log('[TW Scheduler] ✅ Modal de Teste pronto!');
  }
}, 100);
})();


























