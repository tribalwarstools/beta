(async function () {
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

  // Carrega aldeias
  const { myVillages } = await loadVillageTxt();

  // === Criação do painel ===
  const panel = document.createElement('div');
  panel.id = 'tws-panel';
  panel.className = 'tws-container';
  panel.innerHTML = `
    <style>
      .tws-container {
        position: fixed;
        right: 0;
        bottom: 10px;
        width: 520px;
        z-index: 99999;
        font-family: Verdana, sans-serif !important;
        background: #2b1b0f !important;
        color: #f5deb3 !important;
        border: 2px solid #654321 !important;
        border-right: none !important;
        border-radius: 8px 0 0 8px !important;
        box-shadow: 0 4px 18px rgba(0,0,0,0.7) !important;
        padding: 12px !important;
        transition: transform 0.4s ease !important;
      }
      .tws-toggle-tab {
        position: absolute;
        left: -30px;
        top: 40%;
        background: #5c3a1e;
        border: 2px solid #654321;
        border-right: none;
        border-radius: 6px 0 0 6px;
        padding: 8px 5px;
        font-size: 13px;
        color: #ffd700;
        cursor: pointer;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        user-select: none;
        box-shadow: -2px 0 6px rgba(0,0,0,0.5);
        font-weight: bold;
      }
      .tws-toggle-tab:hover { background: #7b5124; }
      .tws-hidden { transform: translateX(100%); }
      .tws-container h3 {
        margin: 0 0 8px;
        text-align: center;
        color: #ffd700;
        text-shadow: 1px 1px 2px #000;
        font-size: 16px;
      }
      .tws-container input,
      .tws-container select,
      .tws-container button,
      .tws-container textarea {
        border-radius: 5px;
        border: 1px solid #5c3a1e;
        background: #1e1408;
        color: #fff;
        padding: 6px;
        font-size: 12px;
        box-sizing: border-box;
      }
      .tws-container button {
        cursor: pointer;
        background: #6b4c2a;
        color: #f8e6c2;
        transition: 0.2s;
        font-weight: bold;
      }
      .tws-container button:hover { background: #8b652e; }
      .tws-form-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .tws-form-row > div {
        flex: 1;
      }
      .tws-form-row label {
        display: block;
        font-size: 11px;
        margin-bottom: 3px;
        color: #ffd700;
        font-weight: bold;
      }
      .tws-troops-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 6px;
        margin-top: 6px;
        padding: 8px;
        background: rgba(0,0,0,0.3);
        border-radius: 5px;
      }
      .tws-troop-cell {
        text-align: center;
      }
      .tws-troop-cell img {
        height: 20px;
        display: block;
        margin: 0 auto 3px;
      }
      .tws-troop-cell input {
        width: 50px;
        text-align: center;
        padding: 3px;
      }
      .tws-btn-group {
        display: flex;
        gap: 8px;
        margin: 10px 0;
      }
      .tws-btn-group button {
        flex: 1;
        padding: 8px;
      }
      .tws-schedule-wrapper {
        max-height: 280px;
        overflow-y: auto;
        border: 1px solid #3d2a12;
        border-radius: 6px;
        margin-top: 8px;
        background: rgba(0,0,0,0.2);
      }
      .tws-schedule-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .tws-schedule-table th,
      .tws-schedule-table td {
        border: none;
        padding: 5px;
        text-align: center;
      }
      .tws-schedule-table th {
        background: #3d2a12;
        color: #ffd700;
        position: sticky;
        top: 0;
        z-index: 1;
        font-weight: bold;
      }
      .tws-schedule-table td button {
        background: #b33;
        border: none;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }
      .tws-schedule-table td button:hover { background: #e44; }
      .tws-container details summary {
        cursor: pointer;
        color: #ffd700;
        margin: 8px 0 4px;
        font-weight: bold;
        font-size: 12px;
      }
      .tws-status {
        font-size: 11px;
        margin-top: 8px;
        padding: 6px;
        background: rgba(0,0,0,0.4);
        border-radius: 5px;
        max-height: 120px;
        overflow-y: auto;
        color: #fff;
      }
      .tws-bbcode-area {
        width: 100%;
        height: 90px;
        margin-top: 6px;
        font-family: monospace;
        font-size: 11px;
      }
      .tws-tooltip {
        position: relative;
        display: inline-block;
      }
      .tws-tooltip .tws-tooltip-content {
        visibility: hidden;
        min-width: 180px;
        background: #2b1b0f;
        color: #f5deb3;
        text-align: left;
        border: 1px solid #7b5b2a;
        border-radius: 5px;
        padding: 6px 10px;
        position: absolute;
        z-index: 999999;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: 0 0 10px rgba(0,0,0,0.7);
        font-size: 11px;
        white-space: nowrap;
      }
      .tws-tooltip:hover .tws-tooltip-content {
        visibility: visible;
        opacity: 1;
      }
      .tws-tooltip-content img {
        height: 16px;
        vertical-align: middle;
        margin-right: 4px;
      }
      .tws-quick-time {
        font-size: 10px;
        color: #2196F3;
        cursor: pointer;
        text-decoration: underline;
        margin-left: 5px;
      }
      .tws-quick-time:hover {
        color: #64B5F6;
      }
    </style>

    <div class="tws-toggle-tab" id="tws-toggle-tab">Painel</div>
    <h3>⚔️ Agendador Multi v2.0</h3>

    <div style="margin-bottom: 8px;">
      <label style="display:block;font-size:11px;margin-bottom:3px;color:#ffd700;font-weight:bold;">📍 Aldeia de Origem:</label>
      <select id="tws-select-origem" style="width:100%">
        <option value="">Selecione sua aldeia...</option>
      </select>
    </div>

    <details>
      <summary>🪖 Selecionar Tropas</summary>
      <div class="tws-troops-grid">
        ${TROOP_LIST.map(u => `
          <div class="tws-troop-cell">
            <img src="https://dsbr.innogamescdn.com/asset/6507ea2b/graphic/unit/unit_${u}.png" title="${u}">
            <input type="number" id="tws-${u}" min="0" value="0">
          </div>
        `).join('')}
      </div>
    </details>

    <div class="tws-form-row" style="margin-top:10px;">
      <div>
        <label>🎯 Destino:</label>
        <input id="tws-alvo" placeholder="XXX|YYY" style="width:100%"/>
      </div>
      <div>
        <label>🕐 Data/Hora:
          <span class="tws-quick-time" id="tws-now">Agora</span>
          <span class="tws-quick-time" id="tws-1min">+1min</span>
          <span class="tws-quick-time" id="tws-5min">+5min</span>
        </label>
        <input id="tws-datetime" placeholder="DD/MM/YYYY HH:MM:SS" style="width:100%"/>
      </div>
    </div>

    <div class="tws-btn-group">
      <button id="tws-add">➕ Adicionar</button>
      <button id="tws-test">🔥 Testar</button>
    </div>

    <div class="tws-btn-group">
      <button id="tws-clear-completed" style="background:#9C27B0;">🗑️ Limpar Concluídos</button>
      <button id="tws-clear-pending" style="background:#FF6F00;">⏳ Limpar Pendentes</button>
      <button id="tws-clear-all" style="background:#D32F2F;">🚫 Limpar Tudo</button>
    </div>

    <details>
      <summary>📥 Importar BBCode</summary>
      <textarea class="tws-bbcode-area" id="tws-bbcode-area" placeholder="Cole o código BBCode [table]...[/table]"></textarea>
      <button id="tws-import" style="width:100%;margin-top:6px;">📤 Importar</button>
    </details>

    <div class="tws-schedule-wrapper">
      <table class="tws-schedule-table">
        <thead>
          <tr>
            <th>Origem</th>
            <th>Destino</th>
            <th>Data/Hora</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="tws-tbody"></tbody>
      </table>
    </div>

    <div class="tws-status" id="tws-status">✅ Pronto. Adicione agendamentos acima.</div>
  `;

  document.body.appendChild(panel);

  // === Toggle panel ===
  const toggle = panel.querySelector('#tws-toggle-tab');
  function updatePanelState() {
    const hidden = panel.classList.contains('tws-hidden');
    localStorage.setItem(PANEL_STATE_KEY, hidden ? 'hidden' : 'visible');
    toggle.textContent = hidden ? '📅 Abrir' : '✖ Fechar';
  }
  toggle.onclick = () => {
    panel.classList.toggle('tws-hidden');
    updatePanelState();
  };
  const savedState = localStorage.getItem(PANEL_STATE_KEY);
  if (savedState === 'hidden') {
    panel.classList.add('tws-hidden');
    toggle.textContent = '📅 Abrir';
  } else {
    toggle.textContent = '✖ Fechar';
  }

  // === Elementos ===
  const el = id => panel.querySelector(id.startsWith('#') ? id : '#' + id);
  const sel = el('tws-select-origem');

  // === Preencher select de aldeias ===
  myVillages.forEach(v => {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = `${v.name} (${v.coord})`;
    sel.appendChild(o);
  });

  // === Auto-preencher tropas ao selecionar aldeia ===
  sel.addEventListener('change', async () => {
    const villageId = sel.value;
    if (!villageId) return;

    try {
      el('tws-status').innerHTML = '🔍 Carregando tropas...';
      const troops = await getVillageTroops(villageId);
      
      if (troops) {
        TROOP_LIST.forEach(u => {
          const input = el('tws-' + u);
          if (input) input.value = troops[u] || 0;
        });
        el('tws-status').innerHTML = '✅ Tropas carregadas automaticamente!';
      } else {
        el('tws-status').innerHTML = '⚠️ Não foi possível carregar tropas.';
      }
    } catch (e) {
      console.error('[TWS] Erro ao carregar tropas:', e);
      el('tws-status').innerHTML = '❌ Erro ao carregar tropas.';
    }
  });

  // === Atalhos de data/hora ===
  const formatDateTime = (date) => {
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  el('tws-now').onclick = () => {
    el('tws-datetime').value = formatDateTime(new Date());
  };
  el('tws-1min').onclick = () => {
    el('tws-datetime').value = formatDateTime(new Date(Date.now() + 60000));
  };
  el('tws-5min').onclick = () => {
    el('tws-datetime').value = formatDateTime(new Date(Date.now() + 300000));
  };

  // === Renderiza tabela ===
  window.renderTable = function renderTable() {
    const list = getList();
    const tbody = el('tws-tbody');
    
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="opacity:0.6;"><i>Nenhum agendamento</i></td></tr>';
      return;
    }

    const now = Date.now();
    tbody.innerHTML = list.map((a, i) => {
      const troops = TROOP_LIST
        .filter(t => a[t] > 0)
        .map(t => `<img src="https://dsbr.innogamescdn.com/asset/6507ea2b/graphic/unit/unit_${t}.png"> ${a[t]}`)
        .join(' ') || 'Sem tropas';

      let status = '⏳ Agendado';
      let statusColor = '#fff';

      if (a.done) {
        if (a.success) {
          status = '✅ Enviado';
          statusColor = '#90EE90';
        } else {
          status = '❌ Erro';
          statusColor = '#FFB6C1';
        }
      } else {
        const t = parseDateTimeToMs(a.datetime);
        if (t && !isNaN(t)) {
          const diff = t - now;
          if (diff > 0) {
            const seconds = Math.ceil(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            status = `🕒 ${minutes}:${secs.toString().padStart(2, '0')}`;
          } else if (diff > -10000) {
            status = '🔥 Enviando...';
            statusColor = '#FFD700';
          }
        }
      }

      return `<tr style="background:${statusColor}">
        <td class="tws-tooltip">
          ${a.origem || a.origemId}
          <div class="tws-tooltip-content">${troops}</div>
        </td>
        <td>${a.alvo}</td>
        <td style="font-size:10px;">${a.datetime}</td>
        <td>${status}</td>
        <td>
          ${a.done 
            ? `<button data-idx="${i}" class="tws-view-btn" style="background:#2196F3;">📋</button>`
            : `<button data-idx="${i}" class="tws-del-btn">❌</button>`
          }
        </td>
      </tr>`;
    }).join('');

    // Event listeners para botões
    tbody.querySelectorAll('.tws-del-btn').forEach(btn => {
      btn.onclick = () => {
        if (confirm('Remover este agendamento?')) {
          const i = +btn.dataset.idx;
          const l = getList();
          l.splice(i, 1);
          setList(l);
        }
      };
    });

    tbody.querySelectorAll('.tws-view-btn').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        const a = getList()[i];
        if (!a) return;

        const details = `
═══════════════════════════════
📋 DETALHES - Agendamento #${i + 1}
═══════════════════════════════

${a.success ? '✅ STATUS: ENVIADO' : '❌ STATUS: FALHOU'}

📍 Origem: ${a.origem || a.origemId}
🎯 Alvo: ${a.alvo}
🕐 Agendado: ${a.datetime}
${a.executedAt ? `⏰ Executado: ${new Date(a.executedAt).toLocaleString('pt-BR')}` : ''}

🪖 TROPAS:
${TROOP_LIST.map(u => `  ${u}: ${a[u] || 0}`).join('\n')}

${a.error ? `\n⚠️ ERRO: ${a.error}` : ''}
═══════════════════════════════
        `.trim();
        alert(details);
      };
    });
  };

  // === Adicionar agendamento ===
  el('tws-add').onclick = async () => {
    const selVal = sel.value;
    const alvo = parseCoord(el('tws-alvo').value);
    const dt = el('tws-datetime').value.trim();

    if (!selVal) {
      el('tws-status').innerHTML = '❌ Selecione uma aldeia de origem!';
      return;
    }
    if (!alvo) {
      el('tws-status').innerHTML = '❌ Coordenada de destino inválida!';
      return;
    }
    if (isNaN(parseDateTimeToMs(dt))) {
      el('tws-status').innerHTML = '❌ Data/hora inválida!';
      return;
    }

    const origem = myVillages.find(v => v.id === selVal)?.coord || '';
    const cfg = { origem, origemId: selVal, alvo, datetime: dt, done: false };
    
    // Coletar tropas
    let hasTroops = false;
    TROOP_LIST.forEach(u => {
      const val = parseInt(el('tws-' + u).value, 10) || 0;
      cfg[u] = val;
      if (val > 0) hasTroops = true;
    });

    if (!hasTroops) {
      el('tws-status').innerHTML = '❌ Adicione pelo menos uma tropa!';
      return;
    }

    // Validar tropas
    el('tws-status').innerHTML = '🔍 Validando tropas...';
    const available = await getVillageTroops(selVal);
    if (available) {
      const errors = validateTroops(cfg, available);
      if (errors.length > 0) {
        el('tws-status').innerHTML = `❌ Tropas insuficientes: ${errors[0]}`;
        return;
      }
    }

    const list = getList();
    list.push(cfg);
    setList(list);
    el('tws-status').innerHTML = '✅ Agendamento adicionado!';
  };

  // === Testar envio ===
  el('tws-test').onclick = async () => {
    if (!confirm('⚠️ Isso vai ENVIAR UM ATAQUE AGORA!\n\nConfirma?')) return;

    const list = getList();
    if (!list.length) {
      alert('Nenhum agendamento na lista!');
      return;
    }

    const choice = prompt(`Escolha um agendamento (1-${list.length}):`);
    const idx = parseInt(choice, 10) - 1;

    if (idx < 0 || idx >= list.length) {
      alert('Índice inválido!');
      return;
    }

    const cfg = list[idx];
    el('tws-status').innerHTML = '🔥 Executando teste...';

    try {
      const success = await executeAttack(cfg);
      cfg.done = true;
      cfg.success = success;
      cfg.executedAt = new Date().toISOString();
      setList(list);

      if (success) {
        alert('✅ Ataque enviado com sucesso!');
      } else {
        alert('⚠️ Verifique manualmente se o ataque foi enfileirado.');
      }
    } catch (err) {
      cfg.done = true;
      cfg.success = false;
      cfg.error = err.message;
      setList(list);
      alert(`❌ Erro: ${err.message}`);
    }
  };

  // === Limpar concluídos ===
  el('tws-clear-completed').onclick = () => {
    const list = getList();
    const filtered = list.filter(a => !a.done);
    
    if (filtered.length === list.length) {
      alert('Nenhum agendamento concluído!');
      return;
    }

    if (confirm(`Remover ${list.length - filtered.length} concluído(s)?`)) {
      setList(filtered);
      el('tws-status').innerHTML = '✅ Concluídos removidos!';
    }
  };

  // === Limpar pendentes ===
  el('tws-clear-pending').onclick = () => {
    const list = getList();
    const filtered = list.filter(a => a.done);
    
    if (filtered.length === list.length) {
      alert('Nenhum agendamento pendente!');
      return;
    }

    if (confirm(`Remover ${list.length - filtered.length} pendente(s)?`)) {
      setList(filtered);
      el('tws-status').innerHTML = '✅ Pendentes removidos!';
    }
  };

  // === Limpar tudo ===
  el('tws-clear-all').onclick = () => {
    const list = getList();
    if (!list.length) {
      alert('Lista já está vazia!');
      return;
    }

    if (confirm(`⚠️ ATENÇÃO!\n\nRemover TODOS os ${list.length} agendamentos?`)) {
      localStorage.removeItem(STORAGE_KEY);
      renderTable();
      el('tws-status').innerHTML = '✅ Todos removidos!';
    }
  };

  // === Importar BBCode ===
  el('tws-import').onclick = () => {
    const bb = el('tws-bbcode-area').value.trim();
    if (!bb) {
      alert('Cole o BBCode primeiro!');
      return;
    }

    const ag = importarDeBBCode(bb);
    if (!ag.length) {
      alert('Nenhum agendamento encontrado!');
      return;
    }

    const list = getList();
    list.push(...ag);
    setList(list);
    alert(`✅ ${ag.length} agendamento(s) importado(s)!`);
    el('tws-bbcode-area').value = '';
  };

  // === Inicializar ===
  startScheduler();
  renderTable();
  setInterval(renderTable, 1000);

  console.log('[TWS_Frontend] Painel carregado com sucesso!');
})();
