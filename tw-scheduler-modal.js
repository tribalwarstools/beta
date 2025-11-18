(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler Modal] Backend não carregado!');
    return;
  }

  const {
    parseDateTimeToMs,
    parseCoord,
    getList,
    setList,
    getVillageTroops,
    validateTroops,
    loadVillageTxt,
    generateUniqueId, // ✅ NOVO
    TROOP_LIST,
    _internal
  } = window.TWS_Backend;

  // === Formata data para DD/MM/YYYY HH:MM:SS ===
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // === Carrega aldeias no select ===
  async function loadVillageSelect() {
    const select = document.getElementById('tws-origem');
    if (!select) {
      console.error('[Modal] ❌ Select #tws-origem não encontrado!');
      return;
    }

    const { myVillages } = _internal;
    
    // ✅ Se não há aldeias carregadas, carregar agora
    if (myVillages.length === 0) {
      console.log('[Modal] 🏰 Carregando aldeias automaticamente...');
      select.innerHTML = '<option value="">⏳ Carregando aldeias...</option>';
      
      try {
        await loadVillageTxt();
        const { myVillages: updated } = _internal;
        
        if (updated.length === 0) {
          select.innerHTML = '<option value="">❌ Nenhuma aldeia encontrada</option>';
          console.error('[Modal] ❌ Nenhuma aldeia foi encontrada');
          return;
        }
        
        console.log(`[Modal] ✅ ${updated.length} aldeias carregadas automaticamente`);
        select.innerHTML = '<option value="">Selecione uma aldeia...</option>' + 
          updated.map(v => `<option value="${v.id}" data-coord="${v.coord}">${v.name} (${v.coord})</option>`).join('');
      } catch (error) {
        console.error('[Modal] ❌ Erro ao carregar aldeias:', error);
        select.innerHTML = '<option value="">❌ Erro ao carregar aldeias</option>';
      }
      return;
    }

    // Aldeias já carregadas
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

    // ✅ PROTEÇÃO: Prevenir múltiplos submits
    const submitBtn = document.querySelector('#tws-add-form button[type="submit"]');
    if (submitBtn.disabled) {
      console.warn('[Modal] Submit já em andamento, ignorando...');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processando...';

    try {
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

      // ✅ NOVO: Validação de horário muito próximo
      const diff = t - Date.now();
      if (diff < 3000 && diff > 0) {
        showMsg('⚠️ Horário muito próximo! Mínimo recomendado: 3 segundos', 'error');
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
      const list = getList();
      
      // ✅ PROTEÇÃO: Verificar duplicatas mais rigorosa
      const isDuplicate = list.some(item => 
        item.origemId === origemId && 
        item.alvo === alvoParsed && 
        item.datetime === datetime &&
        !item.done &&
        !item.locked
      );
      
      if (isDuplicate) {
        console.warn('[Modal] ⚠️ Agendamento duplicado detectado! Bloqueado.');
        showMsg('⚠️ Já existe um agendamento idêntico pendente!', 'error');
        return;
      }
      
      // ✅ NOVO: Usar gerador de ID único do backend
      const uniqueId = generateUniqueId();
      
      const cfg = {
        _id: uniqueId, // ✅ ID único PRIMEIRO
        origem: origemCoord,
        origemId,
        alvo: alvoParsed,
        datetime,
        done: false,
        locked: false, // ✅ NOVO
        ...troops
      };
      
      list.push(cfg);
      setList(list);
      
      console.log('[Modal] ✅ Agendamento adicionado com ID:', uniqueId);
      console.log('[Modal] 📋 Total de agendamentos na lista:', list.length);

      showMsg('✅ Agendamento adicionado com sucesso!', 'success');
      
      // Disparar evento customizado para atualizar a tabela
      window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
      
      setTimeout(() => overlay.remove(), 1500);
      
    } catch (error) {
      console.error('[Modal] Erro ao adicionar agendamento:', error);
      showMsg(`❌ Erro: ${error.message}`, 'error');
    } finally {
      // ✅ Reabilitar botão
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
      }
    }
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
    
    // Atalhos de data/hora com incremento acumulativo
    document.getElementById('tws-set-now').onclick = (e) => {
      e.preventDefault();
      const now = new Date();
      document.getElementById('tws-datetime').value = formatDateTime(now);
    };
    
    document.getElementById('tws-set-1min').onclick = (e) => {
      e.preventDefault();
      const input = document.getElementById('tws-datetime');
      const currentValue = input.value.trim();
      
      let baseTime;
      if (currentValue) {
        const parsed = parseDateTimeToMs(currentValue);
        baseTime = isNaN(parsed) ? Date.now() : parsed;
      } else {
        baseTime = Date.now();
      }
      
      const newDate = new Date(baseTime + 60000);
      input.value = formatDateTime(newDate);
    };
    
    document.getElementById('tws-set-5min').onclick = (e) => {
      e.preventDefault();
      const input = document.getElementById('tws-datetime');
      const currentValue = input.value.trim();
      
      let baseTime;
      if (currentValue) {
        const parsed = parseDateTimeToMs(currentValue);
        baseTime = isNaN(parsed) ? Date.now() : parsed;
      } else {
        baseTime = Date.now();
      }
      
      const newDate = new Date(baseTime + 300000);
      input.value = formatDateTime(newDate);
    };

    // Submit form
    document.getElementById('tws-add-form').onsubmit = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleFormSubmit(overlay);
    };
  }

  // === Expor API global ===
  window.TWS_Modal = {
    show: showModal
  };

  console.log('[TW Scheduler Modal] Módulo carregado com sucesso! (v2.2)');
})();
