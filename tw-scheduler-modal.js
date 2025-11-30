(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler Modal] Backend não carregado!');
    return;
  }

  const {
    parseDateTimeToMs,
    getList,
    setList,
    getVillageTroops,
    validateTroops,
    loadVillageTxt,
    generateUniqueId,
    TROOP_LIST,
    _internal
  } = window.TWS_Backend;

  // ✅ VALIDADOR PRÓPRIO DE COORDENADAS (NÃO usa parseCoord do backend)
  function validateCoordinate(s) {
    if (!s) return null;
    
    const t = s.trim();
    
    // Padrão: 1-4 dígitos | 1-4 dígitos
    const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
    
    if (!match) {
      console.warn(`[Modal] ❌ Coordenada inválida: "${s}"`);
      return null;
    }
    
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    
    // Validar limites (0-999)
    if (x < 0 || x > 999 || y < 0 || y > 999) {
      console.warn(`[Modal] ❌ Coordenada fora do mapa: ${x}|${y}`);
      return null;
    }
    
    return `${x}|${y}`;
  }

  // === Formata data para DD/MM/YYYY HH:MM:SS ===
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // === ✅ Auto-preencher tropas ao selecionar aldeia ===
  async function autoFillTroops(villageId) {
    const msgEl = document.getElementById('tws-validation-msg');
    
    if (!villageId) {
      clearTroops();
      return;
    }

    try {
      msgEl.textContent = '🔍 Buscando tropas disponíveis...';
      msgEl.className = 'tws-validation-msg tws-validation-success';
      msgEl.style.display = 'block';

      const troops = await getVillageTroops(villageId);
      
      if (!troops) {
        msgEl.textContent = '⚠️ Não foi possível obter as tropas disponíveis';
        msgEl.className = 'tws-validation-msg tws-validation-error';
        return;
      }

      TROOP_LIST.forEach(u => {
        const input = document.getElementById(`tws-troop-${u}`);
        if (input) {
          input.value = troops[u] || '0';
        }
      });

      msgEl.textContent = `✅ Tropas carregadas! Total de ${Object.values(troops).reduce((a, b) => a + b, 0)} unidades`;
      msgEl.className = 'tws-validation-msg tws-validation-success';
      
      setTimeout(() => {
        msgEl.style.display = 'none';
      }, 3000);

      console.log('[Modal] ✅ Tropas preenchidas:', troops);
    } catch (error) {
      console.error('[Modal] ❌ Erro ao carregar tropas:', error);
      msgEl.textContent = `❌ Erro ao carregar tropas: ${error.message}`;
      msgEl.className = 'tws-validation-msg tws-validation-error';
    }
  }

  // === ✅ Limpar todas as tropas ===
  function clearTroops() {
    TROOP_LIST.forEach(u => {
      const input = document.getElementById(`tws-troop-${u}`);
      if (input) input.value = '0';
    });
    
    const msgEl = document.getElementById('tws-validation-msg');
    msgEl.textContent = '✅ Tropas limpas!';
    msgEl.className = 'tws-validation-msg tws-validation-success';
    msgEl.style.display = 'block';
    
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 2000);
    
    console.log('[Modal] ✅ Tropas limpas');
  }

  // === Carrega aldeias no select (ORDENADAS ALFABETICAMENTE) ===
  async function loadVillageSelect() {
    const select = document.getElementById('tws-origem');
    if (!select) {
      console.error('[Modal] ❌ Select #tws-origem não encontrado!');
      return;
    }

    const { myVillages } = _internal;
    
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
        
        console.log(`[Modal] ✅ ${updated.length} aldeias carregadas`);
        
        // ✅ ORDENAR ALDEIAS ALFABETICAMENTE
        const sortedVillages = updated.sort((a, b) => a.name.localeCompare(b.name));
        
        select.innerHTML = '<option value="">Selecione uma aldeia...</option>' + 
          sortedVillages.map(v => `<option value="${v.id}" data-coord="${v.coord}">${v.name} (${v.coord})</option>`).join('');
      } catch (error) {
        console.error('[Modal] ❌ Erro ao carregar aldeias:', error);
        select.innerHTML = '<option value="">❌ Erro ao carregar aldeias</option>';
      }
      return;
    }

    // ✅ ORDENAR ALDEIAS ALFABETICAMENTE
    const sortedVillages = myVillages.sort((a, b) => a.name.localeCompare(b.name));
    
    select.innerHTML = '<option value="">Selecione uma aldeia...</option>' + 
      sortedVillages.map(v => `<option value="${v.id}" data-coord="${v.coord}">${v.name} (${v.coord})</option>`).join('');
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
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
        return;
      }

      // ✅ CORREÇÃO: Usar validador próprio para coordenadas
      const alvoParsed = validateCoordinate(alvo);
      if (!alvoParsed) {
        showMsg(`❌ Coordenada de alvo inválida!\nUse formato: X|Y (ex: 5|4, 52|43, 529|431, 5294|4312)\n\nVocê digitou: "${alvo}"`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
        return;
      }

      const t = parseDateTimeToMs(datetime);
      if (!t || isNaN(t)) {
        showMsg('❌ Data/hora inválida! Use formato: DD/MM/YYYY HH:MM:SS', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
        return;
      }

      // ✅ Validação de horário muito próximo
      const diff = t - Date.now();
      if (diff < 3000 && diff > 0) {
        showMsg('⚠️ Horário muito próximo! Mínimo recomendado: 3 segundos', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
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
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
        return;
      }

      // Validar tropas disponíveis
      showMsg('🔍 Verificando tropas disponíveis...', 'success');
      const available = await getVillageTroops(origemId);
      
      if (available) {
        const errors = validateTroops(troops, available);
        if (errors.length > 0) {
          showMsg(`❌ Tropas insuficientes:\n${errors.join('\n')}`, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = '✅ Adicionar';
          return;
        }
      }

      // Criar agendamento
      const list = getList();
      
      // ✅ REMOVIDO: verificação de duplicatas — agora permitimos agendamentos idênticos

      const uniqueId = generateUniqueId();
      
      const cfg = {
        _id: uniqueId,
        origem: origemCoord,
        origemId,
        alvo: alvoParsed,
        datetime,
        done: false,
        locked: false,
        ...troops
      };
      
      list.push(cfg);
      setList(list);
      
      console.log('[Modal] ✅ Agendamento adicionado:', {
        id: uniqueId,
        origem: origemCoord,
        alvo: alvoParsed,
        datetime
      });

      showMsg('✅ Agendamento adicionado com sucesso!', 'success');
      
      // Notificar atualizações para o resto da aplicação
      window.dispatchEvent(new CustomEvent('tws-schedule-updated'));

      // IMPORTANT: NÃO remover o overlay automaticamente — o usuário pediu que o modal só feche ao clicar em CANCELAR
      // Apenas reabilitamos o botão para permitir novos agendamentos sem fechar o modal
      submitBtn.disabled = false;
      submitBtn.textContent = '✅ Adicionar';

    } catch (error) {
      console.error('[Modal] Erro ao adicionar agendamento:', error);
      showMsg(`❌ Erro: ${error.message}`, 'error');
      const submitBtn = document.querySelector('#tws-add-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '✅ Adicionar';
      }
    }
  }

  // === Cria e exibe o modal ===
  function showModal() {
    const existing = document.getElementById('tws-modal');
    if (existing) existing.remove();

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
        .tws-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .tws-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .tws-btn-primary {
          background: #4CAF50;
          color: white;
        }
        .tws-btn-secondary {
          background: #9E9E9E;
          color: white;
        }
        .tws-btn-warning {
          background: #ff9800;
          color: white;
        }
        .tws-validation-msg {
          padding: 10px;
          margin-top: 10px;
          border-radius: 4px;
          font-size: 13px;
          display: none;
          white-space: pre-wrap;
          line-height: 1.5;
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
        .tws-troops-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
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
          <small style="color: #666; font-size: 11px;">⚡ Selecione para auto-preencher as tropas disponíveis</small>
        </div>

        <!-- Alvo -->
        <div class="tws-form-group">
          <label class="tws-form-label">🎯 Alvo (Coordenada):</label>
          <input type="text" id="tws-alvo" class="tws-form-input" placeholder="529|431 ou 52|43 ou 5|4">
          <small style="color: #666; font-size: 11px;">✅ Formatos válidos: X|Y, XX|YY, XXX|YYY, XXXX|YYYY</small>
        </div>

        <!-- Data/Hora -->
        <div class="tws-form-group">
          <label class="tws-form-label">🕐 Data e Hora (DD/MM/YYYY HH:MM:SS):</label>
          <input type="text" id="tws-datetime" class="tws-form-input" placeholder="16/11/2024 10:30:00">
          <small style="color: #666;">Ou use: <a href="#" id="tws-set-now" style="color: #2196F3;">Agora</a> | <a href="#" id="tws-set-1min" style="color: #2196F3;">+1min</a> | <a href="#" id="tws-set-5min" style="color: #2196F3;">+5min</a></small>
        </div>

        <!-- Tropas -->
        <div class="tws-form-group">
          <div class="tws-troops-header">
            <label class="tws-form-label">🪖 Tropas:</label>
            <button type="button" id="tws-clear-troops" class="tws-btn tws-btn-warning" style="padding: 5px 10px; font-size: 12px;">
              🗑️ Limpar Tropas
            </button>
          </div>
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

    loadVillageSelect();

    // Somente botão cancelar fecha o modal (pedido do usuário)
    document.getElementById('tws-btn-cancel').onclick = () => overlay.remove();

    // ✅ Botão para limpar tropas
    document.getElementById('tws-clear-troops').onclick = clearTroops;
    
    // ✅ Auto-preencher tropas ao mudar aldeia
    document.getElementById('tws-origem').onchange = (e) => {
      const villageId = e.target.value;
      autoFillTroops(villageId);
    };
    
    // Atalhos de data/hora
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

  console.log('[TW Scheduler Modal] ✅ Carregado com aldeias ordenadas e botão limpar tropas!');
})();
