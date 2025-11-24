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

  // --- Estado interno ---
  let panelOpen = false;
  let updateInterval = null;
  let panelEl = null;
  let toggleBtn = null;

  // --- Util helpers ---
  function safeGetList() {
    try { return getList(); } catch { return []; }
  }
  function saveList(list) { try { setList(list); } catch (e) { console.error(e); } }

  function formatTimeRemaining(ms) {
    if (!isFinite(ms)) return '?';
    if (ms <= 0) return '0s';
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  }

  // --- Stats & Dashboard ---
  function calculateStats() {
    const list = safeGetList();
    const now = Date.now();
    const stats = {
      total: list.length,
      concluidos: list.filter(a => a.done).length,
      pendentes: list.filter(a => !a.done).length,
      sucesso: list.filter(a => a.done && a.success).length,
      erros: list.filter(a => a.done && !a.success).length,
      proximos: []
    };

    const proximosExec = list
      .filter(a => !a.done && !a.locked)
      .map(a => ({ ...a, timeToExec: parseDateTimeToMs(a.datetime) - now }))
      .filter(a => a.timeToExec > 0)
      .sort((a, b) => a.timeToExec - b.timeToExec)
      .slice(0, 3);

    stats.proximos = proximosExec;
    return stats;
  }

  function renderDashboard() {
    const dash = panelEl.querySelector('#tws-dashboard');
    if (!dash) return;
    const s = calculateStats();

    let html = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px">
        ${cardHTML('TOTAL', s.total, 'agendamentos', '#2196F3')}
        ${cardHTML('⏳ PENDENTES', s.pendentes, 'aguardando', '#FF9800')}
        ${cardHTML('✅ SUCESSO', s.sucesso, 'concluídos', '#4CAF50')}
        ${cardHTML('❌ ERROS', s.erros, 'falhados', '#F44336')}
      </div>
    `;

    if (s.proximos.length) {
      html += `<div style="background:white;border:2px solid #8B4513;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-weight:bold;color:#8B4513;margin-bottom:8px">🚀 PRÓXIMOS A EXECUTAR</div>
        <div style="display:grid;gap:8px">`;
      s.proximos.forEach((p, i) => {
        html += `
          <div style="background:#FFF9C4;border-left:4px solid #FFC107;padding:10px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px;">
            <span><strong>#${i+1}</strong> ${p.origem} → ${p.alvo}</span>
            <span style="background:#FF9800;color:white;padding:4px 8px;border-radius:4px;font-weight:bold">${formatTimeRemaining(p.timeToExec)}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    } else if (s.total === 0) {
      html += `<div style="background:#E3F2FD;border:2px dashed #2196F3;border-radius:8px;padding:16px;text-align:center;color:#1976D2">📭 Nenhum agendamento cadastrado<br><small>Use os botões acima para adicionar</small></div>`;
    } else if (s.pendentes === 0) {
      html += `<div style="background:#E8F5E9;border:2px dashed #4CAF50;border-radius:8px;padding:16px;text-align:center;color:#2E7D32">✅ Todos os agendamentos foram processados!<br><small>Nada programado</small></div>`;
    }

    dash.innerHTML = html;
  }

  function cardHTML(title, value, subtitle, color) {
    return `
      <div style="background:linear-gradient(135deg, ${color} 0%, ${shadeColor(color,-12)} 100%);color:white;padding:12px;border-radius:8px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="font-size:11px;opacity:0.9">${title}</div>
        <div style="font-size:26px;font-weight:700">${value}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px">${subtitle}</div>
      </div>
    `;
  }

  // small color shim
  function shadeColor(hex, percent) {
    // hex like #RRGGBB
    try {
      const h = hex.replace('#','');
      const num = parseInt(h,16);
      const r = Math.max(Math.min(((num >> 16) + percent),255),0);
      const g = Math.max(Math.min((((num >> 8) & 0x00FF) + percent),255),0);
      const b = Math.max(Math.min(((num & 0x0000FF) + percent),255),0);
      return `rgb(${r},${g},${b})`;
    } catch { return hex; }
  }

  // --- Table rendering ---
  function renderTable() {
    const tbody = panelEl.querySelector('#tws-tbody');
    if (!tbody) return;
    const list = safeGetList();
    tbody.innerHTML = '';

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:14px">Nenhum agendamento</td></tr>';
      renderDashboard();
      return;
    }

    const now = Date.now();
    list.forEach((cfg, idx) => {
      const tr = document.createElement('tr');
      tr.style.background = cfg.done ? (cfg.success ? '#E8F5E9' : '#FFEBEE') : '';
      tr.innerHTML = `
        <td style="text-align:center;padding:8px;border:1px solid #e0d6c6;">${statusIcon(cfg, now)}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;">${cfg.origem || cfg.origemId || '?'}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;">${cfg.alvo || '?'}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;font-size:12px">${cfg.datetime || '?'}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${TROOP_LIST.map(u=>`${u}:${cfg[u]||0}`).join(' ')}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;text-align:center;font-size:12px">${statusText(cfg, now)}</td>
        <td style="padding:8px;border:1px solid #e0d6c6;text-align:center">
          <button data-action="view" data-idx="${idx}" style="margin-right:6px;font-size:12px">📋</button>
          ${cfg.done ? '' : `<button data-action="remove" data-idx="${idx}" style="font-size:12px">🗑️</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderDashboard();
  }

  function statusIcon(cfg, now) {
    if (cfg.done) return cfg.success ? '✅' : '❌';
    const t = parseDateTimeToMs(cfg.datetime);
    if (!t || isNaN(t)) return '⏳';
    const diff = t - now;
    if (diff > 0) return '🕒';
    if (diff > -10000) return '🔥';
    return '⏳';
  }

  function statusText(cfg, now) {
    if (cfg.done) return cfg.success ? 'Enviado' : (cfg.error || 'Erro');
    const t = parseDateTimeToMs(cfg.datetime);
    if (!t || isNaN(t)) return 'Agendado';
    const diff = t - now;
    if (diff > 0) return formatTimeRemaining(diff);
    if (diff > -10000) return 'Executando...';
    return 'Atrasado';
  }

  // --- Actions ---
  function viewDetails(idx) {
    const list = safeGetList();
    const cfg = list[idx];
    if (!cfg) return;
    let msg = `═══════════════════════════════\n📋 DETALHES DO AGENDAMENTO #${idx+1}\n═══════════════════════════════\n\n`;
    msg += `${cfg.success ? '✅ STATUS: ENVIADO COM SUCESSO' : cfg.done ? '❌ STATUS: FALHOU' : '⏳ STATUS: AGENDADO'}\n\n`;
    msg += `📍 Origem: ${cfg.origem || cfg.origemId}\n🎯 Alvo: ${cfg.alvo}\n🕐 Horário Agendado: ${cfg.datetime}\n`;
    if (cfg.executedAt) msg += `⏰ Executado em: ${new Date(cfg.executedAt).toLocaleString('pt-BR')}\n`;
    msg += `\n🪖 TROPAS ENVIADAS:\n${TROOP_LIST.map(u=>`  ${u}: ${cfg[u]||0}`).join('\n')}\n`;
    if (cfg.error) msg += `\n⚠️ ERRO:\n${cfg.error}\n`;
    msg += `═══════════════════════════════`;
    alert(msg);
  }

  function removeItem(idx) {
    if (!confirm('Remover este agendamento?')) return;
    const list = safeGetList();
    list.splice(idx,1);
    saveList(list);
    renderTable();
  }

  function clearCompleted() {
    const list = safeGetList();
    const filtered = list.filter(a => !a.done);
    if (filtered.length === list.length) { alert('Nenhum agendamento concluído para limpar.'); return; }
    if (!confirm(`Remover ${list.length - filtered.length} agendamento(s) concluído(s)?`)) return;
    saveList(filtered);
    renderTable();
  }

  function clearAll() {
    const list = safeGetList();
    if (!list.length) { alert('Nenhum agendamento para limpar.'); return; }
    if (!confirm(`⚠️ Remover TODOS os ${list.length} agendamento(s)? Esta ação não pode ser desfeita!`)) return;
    saveList([]);
    renderTable();
    alert('✅ Todos os agendamentos foram removidos.');
  }

  function clearPending() {
    const list = safeGetList();
    const filtered = list.filter(a => a.done);
    if (filtered.length === list.length) { alert('Nenhum agendamento pendente para limpar.'); return; }
    if (!confirm(`Remover ${list.length - filtered.length} agendamento(s) pendente(s)?`)) return;
    saveList(filtered);
    renderTable();
  }

  // --- Import / Export ---
  function exportList() {
    const list = safeGetList();
    if (!list.length) { alert('Lista vazia!'); return; }
    const blob = new Blob([JSON.stringify(list,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tw_scheduler_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importList() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (!Array.isArray(imported)) { alert('Arquivo inválido!'); return; }
          const list = safeGetList();
          list.push(...imported);
          saveList(list);
          renderTable();
          alert(`✅ ${imported.length} agendamento(s) importado(s)!`);
        } catch (err) {
          alert('Erro ao importar: ' + (err.message || err));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // --- Add manual (opens external modal if available) ---
  function addManual() {
    if (window.TWS_Modal && typeof window.TWS_Modal.show === 'function') {
      window.TWS_Modal.show();
      return;
    }
    // fallback minimal prompt
    try {
      const origem = prompt('Origem (coord ou id):');
      if (!origem) return;
      const alvo = prompt('Alvo (X|Y):');
      if (!alvo) return;
      const datetime = prompt('Data/Hora (DD/MM/YYYY HH:MM:SS):');
      if (!datetime) return;
      const cfg = { origem, alvo, datetime, done:false, locked:false };
      TROOP_LIST.forEach(u => cfg[u] = 0);
      const list = safeGetList();
      list.push(cfg);
      saveList(list);
      renderTable();
      alert('Agendamento adicionado (modo simples).');
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar manualmente.');
    }
  }

  function importBB() {
    if (window.TWS_BBCodeModal && typeof window.TWS_BBCodeModal.show === 'function') {
      window.TWS_BBCodeModal.show();
      return;
    }
    // fallback simple prompt to paste bbcode
    const bb = prompt('Cole o BBCode aqui:');
    if (!bb) return;
    try {
      const imported = importarDeBBCode(bb);
      if (Array.isArray(imported) && imported.length) {
        const list = safeGetList();
        list.push(...imported);
        saveList(list);
        renderTable();
        alert(`✅ ${imported.length} agendamento(s) importado(s) do BBCode.`);
      } else {
        alert('Nenhum agendamento detectado no BBCode.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao importar BBCode.');
    }
  }

  function testSend() {
    if (window.TWS_TestModal && typeof window.TWS_TestModal.show === 'function') {
      window.TWS_TestModal.show();
    } else {
      alert('Módulo de Teste não encontrado. (TWS_TestModal)');
    }
  }

  function openFarm() {
    if (window.TWS_FarmInteligente && typeof window.TWS_FarmInteligente.show === 'function') {
      window.TWS_FarmInteligente.show();
    } else {
      alert('Módulo de Farm não encontrado. (TWS_FarmInteligente)');
    }
  }

  // --- UI creation ---
  function createUI() {
    // remove existing
    const prev = document.getElementById('tws-panel');
    if (prev) prev.remove();
    const prevBtn = document.getElementById('tws-toggle-btn');
    if (prevBtn) prevBtn.remove();

    // toggle button
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'tws-toggle-btn';
    toggleBtn.title = 'TW Scheduler';
    toggleBtn.innerText = '📅';
    toggleBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:8px 12px;background:#8B4513;color:white;border:2px solid #654321;border-radius:6px;cursor:pointer;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
    document.body.appendChild(toggleBtn);

    // panel
    panelEl = document.createElement('div');
    panelEl.id = 'tws-panel';
    panelEl.style.cssText = 'position:fixed;top:60px;right:10px;width:90%;max-width:1000px;max-height:80vh;background:#F4E4C1;border:3px solid #8B4513;border-radius:8px;padding:12px;z-index:99998;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.4);font-family:Arial,sans-serif;display:none';

    panelEl.innerHTML = `
      <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 style="margin:0;color:#8B4513">⚔️ Agendador TW (5.1)</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-action="add" style="padding:6px 10px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer">➕ Adicionar</button>
          <button data-action="bb" style="padding:6px 10px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer">📋 BBCode</button>
          <button data-action="test" style="padding:6px 10px;background:#F44336;color:white;border:none;border-radius:4px;cursor:pointer">🔥 Testar Envio</button>
          <button data-action="farm" style="padding:6px 10px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer">🌾 Farm</button>
          <button data-action="clearCompleted" style="padding:6px 10px;background:#9C27B0;color:white;border:none;border-radius:4px;cursor:pointer">🗑️ Limpar Concluídos</button>
          <button data-action="clearPending" style="padding:6px 10px;background:#FF6F00;color:white;border:none;border-radius:4px;cursor:pointer">⏳ Limpar Pendentes</button>
          <button data-action="clearAll" style="padding:6px 10px;background:#D32F2F;color:white;border:none;border-radius:4px;cursor:pointer">🚫 Limpar Tudo</button>
          <button data-action="export" style="padding:6px 10px;background:#607D8B;color:white;border:none;border-radius:4px;cursor:pointer">💾 Exportar</button>
          <button data-action="import" style="padding:6px 10px;background:#795548;color:white;border:none;border-radius:4px;cursor:pointer">📂 Importar</button>
        </div>
      </div>

      <div id="tws-dashboard" style="margin-bottom:12px"></div>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;background:white;font-size:12px">
          <thead><tr style="background:#8B4513;color:white">
            <th style="padding:8px;border:1px solid #654321">Status</th>
            <th style="padding:8px;border:1px solid #654321">Origem</th>
            <th style="padding:8px;border:1px solid #654321">Alvo</th>
            <th style="padding:8px;border:1px solid #654321">Data/Hora</th>
            <th style="padding:8px;border:1px solid #654321">Tropas</th>
            <th style="padding:8px;border:1px solid #654321">Info</th>
            <th style="padding:8px;border:1px solid #654321">Ações</th>
          </tr></thead>
          <tbody id="tws-tbody"></tbody>
        </table>
      </div>
    `;

    document.body.appendChild(panelEl);

    // restore panel state
    const saved = localStorage.getItem(PANEL_STATE_KEY);
    panelOpen = saved === '1';
    panelEl.style.display = panelOpen ? 'block' : 'none';

    // wire events
    toggleBtn.addEventListener('click', togglePanel);

    panelEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action], button[data-idx]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const idx = btn.getAttribute('data-idx');
      switch (action) {
        case 'add': addManual(); break;
        case 'bb': importBB(); break;
        case 'test': testSend(); break;
        case 'farm': openFarm(); break;
        case 'clearCompleted': clearCompleted(); break;
        case 'clearAll': clearAll(); break;
        case 'clearPending': clearPending(); break;
        case 'export': exportList(); break;
        case 'import': importList(); break;
      }
      if (!action && idx) {
        // from table (view/remove)
        const act = btn.getAttribute('data-action') || btn.innerText;
      }
    });

    // delegate table buttons (view/remove)
    panelEl.querySelector('#tws-tbody').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      const a = b.getAttribute('data-action');
      const i = parseInt(b.getAttribute('data-idx'),10);
      if (a === 'view') viewDetails(i);
      else if (a === 'remove') removeItem(i);
    });

    // start scheduler and auto-updates
    try { startScheduler(); } catch (e) { console.warn('startScheduler error', e); }
    renderTable();
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(renderTable, 1000);
    window.removeEventListener('tws-schedule-updated', renderTable);
    window.addEventListener('tws-schedule-updated', renderTable);
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    if (panelEl) panelEl.style.display = panelOpen ? 'block' : 'none';
    localStorage.setItem(PANEL_STATE_KEY, panelOpen ? '1' : '0');
  }

  // expose API
  window.TWS_Panel = {
    createUI,
    renderTable,
    addManual,
    importBBCode: importBB,
    testSend,
    Farm: openFarm,
    clearCompleted,
    clearPending,
    clearAll,
    removeItem,
    viewDetails,
    exportList,
    importList,
    togglePanel
  };

  // initialize UI immediately
  createUI();
  console.log('[TW Scheduler Frontend] ✅ Carregado (versão otimizada)');

  // quick detection logs for optional modules
  setTimeout(() => {
    if (!window.TWS_Modal) console.warn('[TW Scheduler] ⚠️ Modal de Adicionar não detectado (TWS_Modal).');
    if (!window.TWS_BBCodeModal) console.warn('[TW Scheduler] ⚠️ BBCode Modal não detectado (TWS_BBCodeModal).');
    if (!window.TWS_TestModal) console.warn('[TW Scheduler] ⚠️ Test Modal não detectado (TWS_TestModal).');
    if (!window.TWS_FarmInteligente) console.warn('[TW Scheduler] ⚠️ Farm Modal não detectado (TWS_FarmInteligente).');
  }, 150);

})();
