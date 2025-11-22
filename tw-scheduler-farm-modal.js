// === SISTEMA APRIMORADO DE CONVERSÃO DE AGENDAMENTOS ===

/**
 * MELHORIAS IMPLEMENTADAS:
 * 1. Conversão individual simplificada com modal visual
 * 2. Conversão em massa com seleção por checkbox
 * 3. Pré-visualização de agendamentos
 * 4. Filtros por origem/destino
 * 5. Configurações padrão reutilizáveis
 */

// ✅ NOVO: Configurações padrão de conversão
const FARM_CONFIG = {
  defaultInterval: 5,
  presets: {
    'rápido': { interval: 3, label: '⚡ Rápido (3 min)' },
    'normal': { interval: 5, label: '⏰ Normal (5 min)' },
    'seguro': { interval: 10, label: '🛡️ Seguro (10 min)' },
    'lento': { interval: 15, label: '🐢 Lento (15 min)' }
  },
  savedIntervals: JSON.parse(localStorage.getItem('tws_farm_intervals') || '{}')
};

// ✅ Salvar intervalo preferido
function saveFarmInterval(chave, intervalo) {
  FARM_CONFIG.savedIntervals[chave] = intervalo;
  localStorage.setItem('tws_farm_intervals', JSON.stringify(FARM_CONFIG.savedIntervals));
}

// ✅ NOVO: Modal de seleção individual com pré-visualização
function showConvertSingleModal() {
  const lista = getList();
  const pendentes = lista.filter(a => !a.done);

  if (pendentes.length === 0) {
    alert('❌ Nenhum agendamento pendente!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 0;
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  `;

  let selectedIdx = null;
  let selectedPreset = 'normal';

  const renderPreview = (idx) => {
    if (idx === null) return '';
    const agend = pendentes[idx];
    const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
    const distancia = calcularDistancia(agend.origem, agend.alvo);
    const unidadeMaisLenta = getUnidadeMaisLenta(agend);
    const velocidade = velocidadesUnidades[unidadeMaisLenta] || 0;
    const tempoIda = Math.round(distancia * velocidade);
    const tempoVolta = tempoIda;
    const tempoTotal = tempoIda + tempoVolta;

    return `
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <div style="font-weight: bold; color: #333; margin-bottom: 10px; font-size: 14px;">
          📋 PRÉ-VISUALIZAÇÃO
        </div>
        <div style="background: white; padding: 12px; border-left: 4px solid #4CAF50; border-radius: 4px;">
          <div style="color: #8B4513; font-weight: bold; margin-bottom: 8px;">
            ${agend.origem} → ${agend.alvo}
          </div>
          <div style="color: #666; font-size: 12px; line-height: 1.6;">
            <div>📅 <strong>Data:</strong> ${agend.datetime}</div>
            <div>🪖 <strong>Tropas:</strong> ${tropas || 'Nenhuma'}</div>
            <div>📏 <strong>Distância:</strong> ${distancia.toFixed(1)} campos</div>
            <div>🐌 <strong>Unidade lenta:</strong> ${unidadeMaisLenta} (${velocidade}min/campo)</div>
            <div style="margin-top: 8px; padding: 8px; background: #e8f5e9; border-radius: 4px;">
              ⏱️ <strong>Ciclo:</strong> ${tempoIda}min (ida) + ${tempoVolta}min (volta) = <strong>${tempoTotal}min</strong> total
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderList = () => {
    return pendentes.map((agend, idx) => {
      const isSelected = selectedIdx === idx;
      const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).slice(0, 3).join(', ');
      return `
        <div
          onclick="this.parentElement.dispatchEvent(new CustomEvent('select-item', {detail: {idx: ${idx}}}))"
          style="
            padding: 12px;
            margin: 8px 0;
            background: ${isSelected ? '#E8F5E8' : '#fff'};
            border: 2px solid ${isSelected ? '#4CAF50' : '#ddd'};
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#f9f9f9'"
          onmouseout="this.style.background='${isSelected ? '#E8F5E8' : '#fff'}'"
        >
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 4px;">
            ${agend.origem} → ${agend.alvo}
          </div>
          <div style="font-size: 12px; color: #666;">
            📅 ${agend.datetime} | 🪖 ${tropas || 'N/A'}
          </div>
        </div>
      `;
    }).join('');
  };

  const updateUI = () => {
    listContainer.innerHTML = renderList();
    previewContainer.innerHTML = renderPreview(selectedIdx);
  };

  const listContainer = document.createElement('div');
  const previewContainer = document.createElement('div');

  modal.innerHTML = `
    <div style="background: #4CAF50; padding: 18px; border-bottom: 2px solid #388E3C; color: white;">
      <div style="font-size: 18px; font-weight: bold;">🔄 Converter Agendamento</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Selecione um agendamento para converter em Farm Inteligente</div>
    </div>

    <div style="flex: 1; overflow-y: auto; padding: 15px; display: flex; gap: 15px;">
      <!-- Lista -->
      <div style="flex: 0 0 45%; border-right: 1px solid #ddd; padding-right: 15px;">
        <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 10px;">
          AGENDAMENTOS DISPONÍVEIS (${pendentes.length})
        </div>
        <div id="list-container"></div>
      </div>

      <!-- Pré-visualização e Opções -->
      <div style="flex: 1; overflow-y: auto;">
        <div id="preview-container"></div>

        <!-- Opções de Intervalo -->
        <div style="margin-top: 15px;">
          <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 8px;">
            ⏰ INTERVALO ENTRE CICLOS
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${Object.entries(FARM_CONFIG.presets).map(([key, preset]) => `
              <button onclick="document.body.dispatchEvent(new CustomEvent('select-preset', {detail: {preset: '${key}'}}))"
                style="
                  padding: 8px;
                  border: 2px solid ${selectedPreset === key ? '#4CAF50' : '#ddd'};
                  background: ${selectedPreset === key ? '#E8F5E8' : '#fff'};
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 11px;
                  text-align: left;
                  transition: all 0.2s;
                "
              >
                ${preset.label}
              </button>
            `).join('')}
            <input id="custom-interval" type="number" min="1" max="60" value="5"
              style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
              placeholder="Ou digite um valor personalizado"
            />
          </div>
        </div>
      </div>
    </div>

    <div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end;">
      <button onclick="this.closest('div').parentElement.parentElement.remove()"
        style="padding: 10px 20px; border: none; background: #9E9E9E; color: white; border-radius: 4px; cursor: pointer;">
        ❌ Cancelar
      </button>
      <button onclick="document.body.dispatchEvent(new CustomEvent('confirm-convert'))"
        style="padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;"
        ${selectedIdx === null ? 'disabled' : ''}
      >
        ✅ Converter
      </button>
    </div>
  `;

  // Atualizar referencias dos containers
  const listContainerDiv = modal.querySelector('#list-container');
  const previewContainerDiv = modal.querySelector('#preview-container');
  const customIntervalInput = modal.querySelector('#custom-interval');

  // Event listeners
  listContainerDiv.parentElement.addEventListener('select-item', (e) => {
    selectedIdx = e.detail.idx;
    updateUI();
  });

  document.body.addEventListener('select-preset', (e) => {
    selectedPreset = e.detail.preset;
    customIntervalInput.value = FARM_CONFIG.presets[selectedPreset].interval;
  });

  document.body.addEventListener('confirm-convert', () => {
    if (selectedIdx === null) return;
    const agendamentoEscolhido = pendentes[selectedIdx];
    const listaIdx = lista.findIndex(a => a === agendamentoEscolhido);
    const intervaloNum = parseInt(customIntervalInput.value) || 5;

    if (convertToFarm(listaIdx, intervaloNum)) {
      saveFarmInterval(`${agendamentoEscolhido.origem}-${agendamentoEscolhido.alvo}`, intervaloNum);
      alert(`✅ FARM CRIADO!\n\n${agendamentoEscolhido.origem} → ${agendamentoEscolhido.alvo}\nCiclos a cada ${intervaloNum} minutos`);
      overlay.remove();
      document.body.dispatchEvent(new CustomEvent('tws-farm-updated'));
    }
  }, { once: true });

  // Render inicial
  updateUI();
  listContainerDiv.innerHTML = renderList();
  previewContainerDiv.innerHTML = renderPreview(selectedIdx);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ✅ NOVO: Modal de conversão em massa
function showConvertBatchModal() {
  const lista = getList();
  const pendentes = lista.filter(a => !a.done);

  if (pendentes.length === 0) {
    alert('❌ Nenhum agendamento pendente!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 0;
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  `;

  const selected = new Set();
  let filterOrigem = '';
  let filterDestino = '';
  let selectedPreset = 'normal';

  const renderCheckboxList = () => {
    let filtered = pendentes;

    if (filterOrigem) filtered = filtered.filter(a => a.origem.includes(filterOrigem));
    if (filterDestino) filtered = filtered.filter(a => a.alvo.includes(filterDestino));

    return filtered.map((agend, realIdx) => {
      const actualIdx = pendentes.indexOf(agend);
      const isChecked = selected.has(actualIdx);
      const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).slice(0, 2).join(', ');
      const distancia = calcularDistancia(agend.origem, agend.alvo).toFixed(1);

      return `
        <label style="
          display: flex;
          align-items: center;
          padding: 12px;
          margin: 6px 0;
          background: ${isChecked ? '#E8F5E8' : '#fff'};
          border: 2px solid ${isChecked ? '#4CAF50' : '#ddd'};
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='${isChecked ? '#E8F5E8' : '#fff'}'">
          <input type="checkbox" ${isChecked ? 'checked' : ''} 
            onchange="this.closest('label').dispatchEvent(new CustomEvent('toggle-item', {detail: {idx: ${actualIdx}}}));"
            style="margin-right: 12px; cursor: pointer; width: 18px; height: 18px;"
          />
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #8B4513;">
              ${agend.origem} → ${agend.alvo}
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 3px;">
              📅 ${agend.datetime} | 📏 ${distancia} campos | 🪖 ${tropas || 'N/A'}
            </div>
          </div>
        </label>
      `;
    }).join('');
  };

  const listContainer = document.createElement('div');
  listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 15px;';

  modal.innerHTML = `
    <div style="background: #4CAF50; padding: 18px; border-bottom: 2px solid #388E3C; color: white;">
      <div style="font-size: 18px; font-weight: bold;">📦 Converter em Massa</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Selecione múltiplos agendamentos para converter de uma vez</div>
    </div>

    <!-- Filtros -->
    <div style="padding: 15px; background: #f5f5f5; border-bottom: 1px solid #ddd;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <input id="filter-origem" type="text" placeholder="Filtrar origem..." 
          style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
        />
        <input id="filter-destino" type="text" placeholder="Filtrar destino..."
          style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
        />
      </div>
      <button onclick="this.dispatchEvent(new CustomEvent('select-all'))"
        style="padding: 6px 12px; border: none; background: #2196F3; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">
        ✅ Selecionar Todos
      </button>
      <button onclick="this.dispatchEvent(new CustomEvent('clear-all'))"
        style="padding: 6px 12px; border: none; background: #FF9800; color: white; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: 5px;">
        ⬜ Limpar Seleção
      </button>
      <div style="font-size: 11px; color: #666; margin-top: 8px; font-weight: bold;">
        Selecionados: <span id="selected-count">0</span>/<span id="total-count">${pendentes.length}</span>
      </div>
    </div>

    <!-- Lista -->
    <div id="list-container"></div>

    <!-- Intervalo -->
    <div style="padding: 15px; background: #f9f9f9; border-top: 1px solid #ddd;">
      <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 8px;">
        ⏰ INTERVALO PARA TODOS
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${Object.entries(FARM_CONFIG.presets).map(([key, preset]) => `
          <button onclick="this.parentElement.dispatchEvent(new CustomEvent('select-preset', {detail: {preset: '${key}'}}))"
            style="
              padding: 8px;
              border: 2px solid ${selectedPreset === key ? '#4CAF50' : '#ddd'};
              background: ${selectedPreset === key ? '#E8F5E8' : '#fff'};
              border-radius: 4px;
              cursor: pointer;
              font-size: 10px;
              font-weight: bold;
              transition: all 0.2s;
            "
          >
            ${preset.label.split('(')[0].trim()}
          </button>
        `).join('')}
      </div>
      <input id="custom-interval" type="number" min="1" max="60" value="5"
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; margin-top: 8px;"
        placeholder="Ou digite valor personalizado (minutos)"
      />
    </div>

    <!-- Botões -->
    <div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end;">
      <button onclick="this.closest('div').parentElement.parentElement.remove()"
        style="padding: 10px 20px; border: none; background: #9E9E9E; color: white; border-radius: 4px; cursor: pointer;">
        ❌ Cancelar
      </button>
      <button onclick="document.body.dispatchEvent(new CustomEvent('confirm-batch'))"
        style="padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;"
      >
        ✅ Converter ${selected.size > 0 ? `(${selected.size})` : ''}
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const updateList = () => {
    listContainer.innerHTML = renderCheckboxList();
    document.getElementById('selected-count').textContent = selected.size;
    modal.querySelector('button:last-of-type').textContent = 
      `✅ Converter ${selected.size > 0 ? `(${selected.size})` : ''}`;
  };

  const filterOrigemInput = modal.querySelector('#filter-origem');
  const filterDestinoInput = modal.querySelector('#filter-destino');
  const customIntervalInput = modal.querySelector('#custom-interval');

  modal.appendChild(listContainer);

  filterOrigemInput.addEventListener('input', (e) => {
    filterOrigem = e.target.value;
    updateList();
  });

  filterDestinoInput.addEventListener('input', (e) => {
    filterDestino = e.target.value;
    updateList();
  });

  listContainer.addEventListener('toggle-item', (e) => {
    if (selected.has(e.detail.idx)) selected.delete(e.detail.idx);
    else selected.add(e.detail.idx);
    updateList();
  });

  modal.querySelector('.grid').addEventListener('select-preset', (e) => {
    selectedPreset = e.detail.preset;
    customIntervalInput.value = FARM_CONFIG.presets[selectedPreset].interval;
  });

  const filterDiv = modal.querySelector('div:nth-child(3)');
  filterDiv.querySelector('button:first-of-type').addEventListener('click', () => {
    pendentes.forEach((_, idx) => selected.add(idx));
    updateList();
  });

  filterDiv.querySelector('button:nth-of-type(2)').addEventListener('click', () => {
    selected.clear();
    updateList();
  });

  document.body.addEventListener('confirm-batch', () => {
    if (selected.size === 0) {
      alert('❌ Selecione pelo menos um agendamento!');
      return;
    }

    const intervaloNum = parseInt(customIntervalInput.value) || 5;
    let successCount = 0;
    let failCount = 0;

    selected.forEach(idx => {
      const listaIdx = lista.indexOf(pendentes[idx]);
      if (convertToFarm(listaIdx, intervaloNum)) {
        successCount++;
        const agend = pendentes[idx];
        saveFarmInterval(`${agend.origem}-${agend.alvo}`, intervaloNum);
      } else {
        failCount++;
      }
    });

    alert(`✅ CONVERSÃO CONCLUÍDA!\n\n✅ ${successCount} farms criados\n${failCount > 0 ? `⚠️ ${failCount} falharam` : ''}\n\nCiclos configurados para ${intervaloNum} minutos`);
    overlay.remove();
    document.body.dispatchEvent(new CustomEvent('tws-farm-updated'));
  }, { once: true });

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  updateList();
}

// ✅ Atualizar os botões no modal principal
function updateFarmModalButtons() {
  const btnConvert = document.querySelector('.btn-convert');
  if (!btnConvert) return;

  btnConvert.parentElement.innerHTML = `
    <button onclick="TWS_FarmInteligente._convertAgendamentoUnico()" style="
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      background: #9C27B0;
      color: white;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
      flex: 1;
    ">🔄 Converter Um</button>
    
    <button onclick="TWS_FarmInteligente._convertAgendamentoBatch()" style="
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      background: #FF6B00;
      color: white;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
      flex: 1;
    ">📦 Converter em Massa</button>
    
    <button onclick="document.getElementById('tws-farm-modal').remove()" style="
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      background: #9E9E9E;
      color: white;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
      flex: 1;
    ">❌ Fechar</button>
  `;
}

// ✅ Expor funções globais
window.TWS_FarmInteligente = window.TWS_FarmInteligente || {};
window.TWS_FarmInteligente._convertAgendamentoUnico = showConvertSingleModal;
window.TWS_FarmInteligente._convertAgendamentoBatch = showConvertBatchModal;
