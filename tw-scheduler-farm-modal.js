// === SISTEMA APRIMORADO DE CONVERSÃO DE AGENDAMENTOS ===
// SUBSTITUI A FUNÇÃO showFarmModal ORIGINAL

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
    if (idx === null) return '<div style="text-align: center; color: #999; padding: 40px; font-size: 12px;">Selecione um agendamento para ver a pré-visualização</div>';
    const agend = pendentes[idx];
    const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
    const distancia = calcularDistancia(agend.origem, agend.alvo);
    const unidadeMaisLenta = getUnidadeMaisLenta(agend);
    const velocidade = velocidadesUnidades[unidadeMaisLenta] || 0;
    const tempoIda = Math.round(distancia * velocidade);
    const tempoVolta = tempoIda;
    const tempoTotal = tempoIda + tempoVolta;

    return `
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
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
          data-idx="${idx}"
          style="
            padding: 12px;
            margin: 8px 0;
            background: ${isSelected ? '#E8F5E8' : '#fff'};
            border: 2px solid ${isSelected ? '#4CAF50' : '#ddd'};
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#f9f9f9'; this.style.borderColor='#4CAF50';"
          onmouseout="this.style.background='${isSelected ? '#E8F5E8' : '#fff'}'; this.style.borderColor='${isSelected ? '#4CAF50' : '#ddd'}';"
          onclick="selectSingleItem(${idx}, this)"
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
    const listContainer = modal.querySelector('#list-container');
    const previewContainer = modal.querySelector('#preview-container');
    const convertBtn = modal.querySelector('#convert-btn');
    
    listContainer.innerHTML = renderList();
    previewContainer.innerHTML = renderPreview(selectedIdx);
    if (convertBtn) convertBtn.disabled = selectedIdx === null;
  };

  modal.innerHTML = `
    <div style="background: #4CAF50; padding: 18px; border-bottom: 2px solid #388E3C; color: white;">
      <div style="font-size: 18px; font-weight: bold;">🔄 Converter Agendamento</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Selecione um agendamento para converter em Farm Inteligente</div>
    </div>

    <div style="flex: 1; overflow-y: auto; padding: 15px; display: flex; gap: 15px;">
      <!-- Lista -->
      <div style="flex: 0 0 45%; border-right: 1px solid #ddd; padding-right: 15px; overflow-y: auto;">
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
            <button data-preset="rápido" class="preset-btn" onclick="selectPreset('rápido', this)" style="
              padding: 8px;
              border: 2px solid #ddd;
              background: #fff;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              text-align: left;
              transition: all 0.2s;
            ">⚡ Rápido (3 min)</button>
            
            <button data-preset="normal" class="preset-btn" onclick="selectPreset('normal', this)" style="
              padding: 8px;
              border: 2px solid #4CAF50;
              background: #E8F5E8;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              text-align: left;
              transition: all 0.2s;
            ">⏰ Normal (5 min)</button>
            
            <button data-preset="seguro" class="preset-btn" onclick="selectPreset('seguro', this)" style="
              padding: 8px;
              border: 2px solid #ddd;
              background: #fff;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              text-align: left;
              transition: all 0.2s;
            ">🛡️ Seguro (10 min)</button>
            
            <button data-preset="lento" class="preset-btn" onclick="selectPreset('lento', this)" style="
              padding: 8px;
              border: 2px solid #ddd;
              background: #fff;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              text-align: left;
              transition: all 0.2s;
            ">🐢 Lento (15 min)</button>
            
            <input id="custom-interval" type="number" min="1" max="60" value="5"
              style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
              placeholder="Ou digite um valor personalizado"
              onchange="selectPreset('custom', null)"
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
      <button id="convert-btn" onclick="confirmSingleConvert()" disabled
        style="padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; opacity: ${selectedIdx === null ? '0.5' : '1'};"
      >
        ✅ Converter
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Funções globais
  window.selectSingleItem = function(idx, el) {
    selectedIdx = idx;
    updateUI();
  };

  window.selectPreset = function(preset, el) {
    selectedPreset = preset;
    const customInput = modal.querySelector('#custom-interval');
    
    if (preset === 'custom') return;
    
    if (FARM_CONFIG.presets[preset]) {
      customInput.value = FARM_CONFIG.presets[preset].interval;
    }
    
    // Atualizar botões
    const buttons = modal.querySelectorAll('.preset-btn');
    buttons.forEach(btn => {
      const isActive = btn.dataset.preset === preset;
      btn.style.borderColor = isActive ? '#4CAF50' : '#ddd';
      btn.style.background = isActive ? '#E8F5E8' : '#fff';
    });
  };

  window.confirmSingleConvert = function() {
    if (selectedIdx === null) return;
    const agendamentoEscolhido = pendentes[selectedIdx];
    const listaIdx = lista.findIndex(a => a === agendamentoEscolhido);
    const customInput = modal.querySelector('#custom-interval');
    const intervaloNum = parseInt(customInput.value) || 5;

    if (convertToFarm(listaIdx, intervaloNum)) {
      saveFarmInterval(`${agendamentoEscolhido.origem}-${agendamentoEscolhido.alvo}`, intervaloNum);
      alert(`✅ FARM CRIADO!\n\n${agendamentoEscolhido.origem} → ${agendamentoEscolhido.alvo}\nCiclos a cada ${intervaloNum} minutos`);
      overlay.remove();
      document.body.dispatchEvent(new CustomEvent('tws-farm-updated'));
    }
  };

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  updateUI();
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

    return filtered.map((agend) => {
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
        " onmouseover="this.style.background='#f9f9f9'; this.style.borderColor='#4CAF50';" onmouseout="this.style.background='${isChecked ? '#E8F5E8' : '#fff'}'; this.style.borderColor='${isChecked ? '#4CAF50' : '#ddd'}';">
          <input type="checkbox" ${isChecked ? 'checked' : ''} 
            onchange="toggleBatchItem(${actualIdx}, this.checked)"
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
          onkeyup="updateBatchList()"
        />
        <input id="filter-destino" type="text" placeholder="Filtrar destino..."
          style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
          onkeyup="updateBatchList()"
        />
      </div>
      <button id="select-all-btn" onclick="selectAllBatch()"
        style="padding: 6px 12px; border: none; background: #2196F3; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">
        ✅ Selecionar Todos
      </button>
      <button id="clear-all-btn" onclick="clearAllBatch()"
        style="padding: 6px 12px; border: none; background: #FF9800; color: white; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: 5px;">
        ⬜ Limpar Seleção
      </button>
      <div style="font-size: 11px; color: #666; margin-top: 8px; font-weight: bold;">
        Selecionados: <span id="selected-count">0</span>/<span id="total-count">${pendentes.length}</span>
      </div>
    </div>

    <!-- Lista -->
    <div id="list-container" style="flex: 1; overflow-y: auto; padding: 15px;"></div>

    <!-- Intervalo -->
    <div style="padding: 15px; background: #f9f9f9; border-top: 1px solid #ddd;">
      <div style="font-size: 12px; font-weight: bold; color: #666; margin-bottom: 8px;">
        ⏰ INTERVALO PARA TODOS
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px;">
        <button class="batch-preset" onclick="selectBatchPreset('rápido')" style="padding: 8px; border: 2px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">⚡ Rápido</button>
        <button class="batch-preset" onclick="selectBatchPreset('normal')" style="padding: 8px; border: 2px solid #4CAF50; background: #E8F5E8; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">⏰ Normal</button>
        <button class="batch-preset" onclick="selectBatchPreset('seguro')" style="padding: 8px; border: 2px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">🛡️ Seguro</button>
        <button class="batch-preset" onclick="selectBatchPreset('lento')" style="padding: 8px; border: 2px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">🐢 Lento</button>
      </div>
      <input id="batch-custom-interval" type="number" min="1" max="60" value="5"
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"
        placeholder="Ou digite valor personalizado (minutos)"
      />
    </div>

    <!-- Botões -->
    <div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end;">
      <button onclick="this.closest('div').parentElement.parentElement.remove()"
        style="padding: 10px 20px; border: none; background: #9E9E9E; color: white; border-radius: 4px; cursor: pointer;">
        ❌ Cancelar
      </button>
      <button id="convert-batch-btn" onclick="confirmBatchConvert()"
        style="padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;"
      >
        ✅ Converter (0)
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const updateBatchList = () => {
    filterOrigem = modal.querySelector('#filter-origem').value;
    filterDestino = modal.querySelector('#filter-destino').value;
    
    modal.querySelector('#list-container').innerHTML = renderCheckboxList();
    modal.querySelector('#selected-count').textContent = selected.size;
    modal.querySelector('#convert-batch-btn').textContent = `✅ Converter (${selected.size})`;
  };

  // Funções globais
  window.toggleBatchItem = function(idx, checked) {
    if (checked) selected.add(idx);
    else selected.delete(idx);
    updateBatchList();
  };

  window.selectAllBatch = function() {
    pendentes.forEach((_, idx) => selected.add(idx));
    updateBatchList();
  };

  window.clearAllBatch = function() {
    selected.clear();
    updateBatchList();
  };

  window.selectBatchPreset = function(preset) {
    selectedPreset = preset;
    const customInput = modal.querySelector('#batch-custom-interval');
    
    if (FARM_CONFIG.presets[preset]) {
      customInput.value = FARM_CONFIG.presets[preset].interval;
    }
    
    const buttons = modal.querySelectorAll('.batch-preset');
    buttons.forEach(btn => {
      const isActive = btn.textContent.includes(FARM_CONFIG.presets[preset].label.split('(')[0].trim());
      btn.style.borderColor = isActive ? '#4CAF50' : '#ddd';
      btn.style.background = isActive ? '#E8F5E8' : '#fff';
    });
  };

  window.confirmBatchConvert = function() {
    if (selected.size === 0) {
      alert('❌ Selecione pelo menos um agendamento!');
      return;
    }

    const intervaloNum = parseInt(modal.querySelector('#batch-custom-interval').value) || 5;
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
  };

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  updateBatchList();
}

// ✅ MODAL PRINCIPAL SUBSTITUÍDO
function showFarmModal() {
  const existing = document.getElementById('tws-farm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tws-farm-modal';
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
    background: linear-gradient(135deg, #E8F5E8 0%, #C8E6C9 100%);
    border: 3px solid #4CAF50;
    border-radius: 12px;
    padding: 0;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
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
    </style>

    <!-- Cabeçalho -->
    <div style="background: #4CAF50; padding: 20px; text-align: center; border-bottom: 3px solid #388E3C;">
      <div style="font-size: 24px; font-weight: bold; color: white;">🌾 FARM INTELIGENTE</div>
      <div style="color: #E8F5E8; font-size: 14px; margin-top: 5px;">
        Sistema automático com cálculo CORRETO de ida + volta
      </div>
    </div>

    <!-- Conteúdo -->
    <div style="flex: 1; overflow-y: auto; padding: 20px;">
      <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #155724;">
        <strong>✅ CÁLCULO CORRIGIDO - IDA + VOLTA</strong><br>
        • Agora calcula: Chegada + Tempo de Volta + Intervalo<br>
        • Garante que tropas retornem antes do próximo ataque<br>
        • Evita sobreposição de ciclos
      </div>

      <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
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
          min-width: 150px;
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
          min-width: 150px;
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
          min-width: 150px;
        ">❌ Fechar</button>
      </div>

      <div id="farm-list-container">
        ${renderFarmList()}
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Funções expostas
  window.TWS_FarmInteligente = {
    show: showFarmModal,
    _convertAgendamentoUnico: showConvertSingleModal,
    _convertAgendamentoBatch: showConvertBatchModal,

    _toggleFarm(id) {
      const farms = getFarmList();
      const farm = farms.find(f => f.id === id);
      if (farm) {
        farm.paused = !farm.paused;
        setFarmList(farms);
        document.getElementById('farm-list-container').innerHTML = renderFarmList();
      }
    },

    _deleteFarm(id) {
      if (confirm('Tem certeza que deseja excluir este farm inteligente?\n\nO agendamento original será mantido.')) {
        const farms = getFarmList();
        const updatedFarms = farms.filter(f => f.id !== id);
        setFarmList(updatedFarms);
        document.getElementById('farm-list-container').innerHTML = renderFarmList();
      }
    }
  };

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ✅ RENDERIZAR lista de farms ativos
function renderFarmList() {
  const farms = getFarmList().filter(f => f.active !== false);
  const listaAgendamentos = getList();
  
  if (farms.length === 0) {
    return `
      <div style="text-align: center; padding: 40px; color: #999;">
        <div style="font-size: 48px; margin-bottom: 10px;">🌾</div>
        <div style="font-size: 16px; font-weight: bold;">Nenhum farm inteligente ativo</div>
        <small>Use "Converter Agendamento" para transformar agendamentos normais em farms automáticos</small>
      </div>
    `;
  }

  let html = '<div style="display: grid; gap: 10px;">';
  
  farms.forEach((farm) => {
    const now = Date.now();
    let nextRun = null;
    
    try {
      nextRun = farm.nextRun ? parseDateTimeToMs(farm.nextRun) : null;
    } catch (e) {
      console.error('[Farm] Erro ao parsear data:', farm.nextRun);
    }
    
    const status = farm.paused ? 'pausado' : (nextRun && nextRun > now ? 'agendado' : 'ativo');
    
    let statusColor = '#4CAF50';
    let statusText = '🟢 Ativo';
    
    if (farm.paused) {
      statusColor = '#FF9800';
      statusText = '⏸️ Pausado';
    } else if (nextRun && nextRun > now) {
      statusColor = '#2196F3';
      statusText = '⏰ Agendado';
    }

    const stats = farm.stats || { totalRuns: 0, successRuns: 0 };
    
    // Verificar status do agendamento base
    const agendamentoBase = listaAgendamentos[farm.agendamentoBaseId];
    const baseStatus = agendamentoBase ? 
      (agendamentoBase.done ? 
        (agendamentoBase.success ? '✅ Concluído' : '❌ Falhou') : 
        '⏳ Pendente') : 
      '❓ Agendamento não encontrado';
    
    // Calcular tempo até próximo ataque
    let tempoRestante = '';
    if (nextRun && nextRun > now) {
      const diffMs = nextRun - now;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const remainingMins = diffMins % 60;
      
      if (diffHours > 0) {
        tempoRestante = `${diffHours}h ${remainingMins}m`;
      } else {
        tempoRestante = `${diffMins}m`;
      }
    }
    
    // Calcular distância para exibição
    const distancia = calcularDistancia(farm.origem, farm.alvo);
    const unidadeMaisLenta = getUnidadeMaisLenta(farm.troops);
    const velocidade = unidadeMaisLenta ? velocidadesUnidades[unidadeMaisLenta] : 0;
    const tempoIda = distancia * velocidade;
    const tempoVolta = tempoIda;
    const tempoTotalCiclo = tempoIda + tempoVolta;
    
    html += `
      <div style="
        background: white;
        border: 3px solid ${statusColor};
        border-radius: 8px;
        padding: 15px;
        transition: all 0.3s;
      " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #8B4513; font-size: 16px;">
              ${farm.origem} → ${farm.alvo}
            </div>
            <div style="color: #666; font-size: 12px; margin-top: 4px;">
              🪖 ${Object.entries(farm.troops).filter(([_, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}
            </div>
            <div style="color: #888; font-size: 11px; margin-top: 2px;">
              📋 ${baseStatus} | ⏰ Ciclo: ${farm.intervalo} min
              ${farm.lastReturnTime ? `| 🔄 Retorno: ${Math.round(farm.lastReturnTime/60)}min` : ''}
            </div>
            <div style="color: #666; font-size: 10px; margin-top: 2px;">
              📏 Dist: ${distancia.toFixed(1)} | 🐌 ${unidadeMaisLenta}: ${velocidade}min/campo 
            </div>
            <div style="color: #888; font-size: 10px; margin-top: 1px;">
              ⏱️ Ida: ${Math.round(tempoIda)}min | Volta: ${Math.round(tempoVolta)}min | Total: ${Math.round(tempoTotalCiclo)}min
            </div>
          </div>
          <div style="
            background: ${statusColor};
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
          ">
            ${statusText}
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; color: #666;">
          <div>
            <strong>Próximo envio:</strong><br>
            ${farm.nextRun || 'Calculando...'}
            ${tempoRestante ? `<br><small>⏱️ ${tempoRestante}</small>` : ''}
          </div>
          <div>
            <strong>Estatísticas:</strong><br>
            ${stats.totalRuns} ciclos (${stats.successRuns} sucessos)
            ${stats.lastRun ? `<br><small>Último: ${new Date(stats.lastRun).toLocaleTimeString()}</small>` : ''}
          </div>
        </div>
        
        <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="TWS_FarmInteligente._toggleFarm('${farm.id}')" style="
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: ${farm.paused ? '#4CAF50' : '#FF9800'};
            color: white;
            font-size: 11px;
            cursor: pointer;
          ">${farm.paused ? '▶️ Retomar' : '⏸️ Pausar'}</button>
          
          <button onclick="TWS_FarmInteligente._deleteFarm('${farm.id}')" style="
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: #F44336;
            color: white;
            font-size: 11px;
            cursor: pointer;
          ">🗑️ Excluir Farm</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// === INICIALIZAÇÃO ===
function initFarmModal() {
  window.TWS_FarmInteligente = window.TWS_FarmInteligente || {};
  window.TWS_FarmInteligente.show = showFarmModal;
  window.TWS_FarmInteligente._convertAgendamentoUnico = showConvertSingleModal;
  window.TWS_FarmInteligente._convertAgendamentoBatch = showConvertBatchModal;
  
  console.log('[TW Farm Inteligente] ✅ Carregado - Sistema APRIMORADO com conversão simples!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFarmModal);
} else {
  initFarmModal();
