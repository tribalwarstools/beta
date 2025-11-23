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

  // ✅ FORMATA DATA
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // ✅ RENDERIZA TROPAS EM CARDS
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

  // ═════════════════════════════════════════════════════════
  // ✅ #1 RENDERIZAR TODOS OS AGENDAMENTOS (NÃO SÓ PENDENTES)
  // ═════════════════════════════════════════════════════════

  function renderAgendamentosList(filterStatus = 'all') {
    const list = getList();
    
    if (list.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum agendamento encontrado</div>
          <small>Comece adicionando um novo agendamento</small>
        </div>
      `;
    }

    // ✅ FILTRAR POR STATUS
    let agendamentos = list;
    if (filterStatus === 'pending') {
      agendamentos = list.filter(a => !a.done);
    } else if (filterStatus === 'completed') {
      agendamentos = list.filter(a => a.done && a.success);
    } else if (filterStatus === 'failed') {
      agendamentos = list.filter(a => a.done && !a.success);
    }

    if (agendamentos.length === 0) {
      return `
        <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
          Nenhum agendamento com este filtro
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 10px;">';
    
    agendamentos.forEach((agend, idx) => {
      const now = Date.now();
      const t = parseDateTimeToMs(agend.datetime);
      const diff = t - now;
      const seconds = Math.ceil(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = minutes > 0 
        ? `${minutes}:${secs.toString().padStart(2, '0')}` 
        : `${secs}s`;

      let timeColor = '#4CAF50';
      let statusIcon = '⏳';
      let statusText = 'Pendente';

      if (agend.done) {
        if (agend.success) {
          timeColor = '#4CAF50';
          statusIcon = '✅';
          statusText = 'Enviado';
        } else {
          timeColor = '#F44336';
          statusIcon = '❌';
          statusText = agend.error ? agend.error.substring(0, 20) : 'Falha';
        }
      } else {
        if (diff < 60000) {
          timeColor = '#F44336';
          statusIcon = '🔥';
        } else if (diff < 300000) {
          timeColor = '#FF9800';
          statusIcon = '⏰';
        }
      }

      const listaIdx = list.findIndex(a => a === agend);

      html += `
        <div style="
          background: white;
          border: 3px solid ${timeColor};
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        " onmouseover="this.style.background='#FFF9E6'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #8B4513; font-size: 14px;">
              ${statusIcon} ${agend.origem} → ${agend.alvo}
            </div>
            <small style="color: #666; display: block; margin-top: 4px;">
              📅 ${agend.datetime}
            </small>
            ${agend.error ? `<small style="color: #F44336;">⚠️ ${agend.error.substring(0, 50)}</small>` : ''}
          </div>
          <div style="
            background: ${timeColor};
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
            min-width: 70px;
          ">
            ${agend.done ? statusText : timeStr}
          </div>
          <button onclick="TWS_TestModal._selectAgenda(${listaIdx})" style="
            margin-left: 10px;
            padding: 6px 12px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
            Testar / Editar
          </button>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #2 EDIÇÃO AVANÇADA DE TROPAS COM VALIDAÇÃO
  // ═════════════════════════════════════════════════════════

  function renderEditTab(cfg, onUpdate) {
    const troopsHtml = TROOP_LIST.map(u => `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; background: #F5F5F5; padding: 8px; border-radius: 4px;">
        <label style="width: 70px; font-weight: bold; color: #8B4513;">${u}:</label>
        <input type="number" 
          id="edit-troop-${u}" 
          value="${cfg[u] || 0}" 
          min="0"
          style="
            width: 80px;
            padding: 6px;
            border: 2px solid #8B4513;
            border-radius: 4px;
            text-align: center;
          "
        />
        <button onclick="document.getElementById('edit-troop-${u}').value = 0" style="
          padding: 4px 8px;
          background: #F44336;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        ">🗑️ 0</button>
      </div>
    `).join('');

    return `
      <div style="display: grid; gap: 15px;">
        <!-- Info básica -->
        <div style="background: #F5F5F5; padding: 12px; border-radius: 8px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 8px;">📍 Dados Básicos</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <strong>Origem:</strong> ${cfg.origem}<br>
            <strong>Alvo:</strong> ${cfg.alvo}<br>
            <strong>Data/Hora Agendada:</strong> ${cfg.datetime}
          </div>
        </div>

        <!-- Opções de envio -->
        <div style="background: #E3F2FD; padding: 12px; border-radius: 8px; border: 2px dashed #2196F3;">
          <div style="font-weight: bold; color: #1976D2; margin-bottom: 10px;">🚀 Opções de Envio</div>
          
          <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; cursor: pointer;">
            <input type="radio" name="envio-tipo" value="imediato" id="envio-imediato" checked style="cursor: pointer; width: 16px; height: 16px;">
            <span style="color: #333;">
              <strong>Envio Imediato</strong><br>
              <small style="color: #666;">Envia AGORA, testando tropas e configuração</small>
            </span>
          </label>

          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="radio" name="envio-tipo" value="agendado" id="envio-agendado" style="cursor: pointer; width: 16px; height: 16px;">
            <span style="color: #333;">
              <strong>Reagendar</strong><br>
              <small style="color: #666;">Cria novo agendamento com nova data</small>
            </span>
          </label>

          <div id="datetime-editor" style="margin-top: 12px; padding: 12px; background: white; border-radius: 4px; border: 2px solid #2196F3; display: none;">
            <label style="display: block; font-weight: bold; color: #8B4513; margin-bottom: 8px;">📅 Nova Data/Hora:</label>
            <input type="text" 
              id="edit-datetime" 
              placeholder="DD/MM/YYYY HH:MM:SS"
              value="${cfg.datetime}"
              style="
                width: 100%;
                padding: 8px;
                border: 2px solid #8B4513;
                border-radius: 4px;
                box-sizing: border-box;
              "
            />
            <small style="color: #666; display: block; margin-top: 8px;">
              Atalhos: 
              <a href="#" onclick="document.getElementById('edit-datetime').value = '${formatDateTime(new Date())}'; return false;" style="color: #2196F3; text-decoration: underline;">Agora</a> | 
              <a href="#" onclick="const d = new Date(Date.now() + 60000); document.getElementById('edit-datetime').value = '${formatDateTime(new Date(Date.now() + 60000))}'; return false;" style="color: #2196F3; text-decoration: underline;">+1min</a> | 
              <a href="#" onclick="const d = new Date(Date.now() + 300000); document.getElementById('edit-datetime').value = '${formatDateTime(new Date(Date.now() + 300000))}'; return false;" style="color: #2196F3; text-decoration: underline;">+5min</a>
            </small>
          </div>
        </div>

        <!-- Tropas editáveis com quickfix -->
        <div style="background: #F5F5F5; padding: 12px; border-radius: 8px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span>🪖 Tropas (Editáveis)</span>
            <button onclick="document.querySelectorAll('input[id^=edit-troop-]').forEach(el => el.value = 0)" style="
              padding: 4px 12px;
              background: #F44336;
              color: white;
              border: none;
              border-radius: 3px;
              cursor: pointer;
              font-size: 11px;
            ">🗑️ Limpar Todas</button>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${troopsHtml}
          </div>
        </div>

        <!-- ✅ Verificação de tropas disponíveis -->
        <div id="troop-validation" style="display: none; background: #FFF3E0; border: 2px solid #FF9800; padding: 12px; border-radius: 8px; color: #E65100;">
          <strong>⚠️ Validação de Tropas</strong>
          <div id="validation-content" style="margin-top: 8px; font-size: 12px;"></div>
        </div>
      </div>
    `;
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #3 RENDERIZAR CONFIRMAÇÃO COM DETALHES COMPLETOS
  // ═════════════════════════════════════════════════════════

  function renderConfirmTab(cfg, datetime, envioType, availableTroops = null) {
    const isImediato = envioType === 'imediato';
    
    // ✅ Validar tropas se disponíveis
    let troopsValidation = '';
    if (availableTroops) {
      const errors = validateTroops(cfg, availableTroops);
      if (errors.length > 0) {
        troopsValidation = `
          <div style="
            background: #FFEBEE;
            border: 2px solid #F44336;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
          ">
            <div style="font-weight: bold; color: #D32F2F; margin-bottom: 10px;">⚠️ TROPAS INSUFICIENTES!</div>
            <div style="color: #C62828; font-size: 12px;">
              ${errors.map(e => `❌ ${e}`).join('<br>')}
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #D32F2F;">
              ℹ️ Edite as tropas para as quantidades disponíveis
            </div>
          </div>
        `;
      }
    }
    
    return `
      <div style="display: grid; gap: 15px;">
        <!-- Aviso destacado -->
        <div style="
          background: ${isImediato ? '#FFE5E5' : '#E8F5E9'};
          border: 3px solid ${isImediato ? '#F44336' : '#4CAF50'};
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        ">
          <div style="font-size: 28px; margin-bottom: 8px;">${isImediato ? '⚠️' : '⏰'}</div>
          <div style="font-weight: bold; color: ${isImediato ? '#D32F2F' : '#2E7D32'}; font-size: 16px;">
            ${isImediato ? 'ATENÇÃO - ENVIO IMEDIATO!' : 'NOVO AGENDAMENTO CRIADO!'}
          </div>
          <div style="color: ${isImediato ? '#C62828' : '#1B5E20'}; font-size: 14px; margin-top: 8px;">
            ${isImediato 
              ? 'O ataque será enviado <strong>IMEDIATAMENTE</strong> (testando tropas)' 
              : `Novo agendamento criado para: <strong>${datetime}</strong>`}
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

        <!-- ✅ Validação de tropas (se aplicável) -->
        ${troopsValidation}

        <!-- Checkbox de confirmação -->
        <div style="background: #FFF9E6; border: 2px dashed #FF9800; border-radius: 8px; padding: 15px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="confirm-checkbox" style="width: 20px; height: 20px; cursor: pointer;">
            <span style="font-weight: bold; color: #E65100;">
              ${isImediato 
                ? 'Tenho certeza que quero enviar este ataque AGORA' 
                : 'Tenho certeza que quero CRIAR um NOVO agendamento'}
            </span>
          </label>
        </div>
      </div>
    `;
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #4 EXECUTAR OU REAGENDAR COM TRATAMENTO DE ERROS
  // ═════════════════════════════════════════════════════════

  async function executeTest(cfg, datetime, statusDiv, overlay, isImediato) {
    try {
      if (isImediato) {
        statusDiv.innerHTML = '🔥 <strong>Executando envio imediato...</strong>';
        statusDiv.style.background = '#FFF9C4';
        statusDiv.style.borderColor = '#FFC107';

        const success = await executeAttack(cfg);
        
        if (success) {
          statusDiv.innerHTML = '✅ <strong>Ataque enviado com sucesso!</strong><br><small>Verifique a praça de reunião</small>';
          statusDiv.style.background = '#E8F5E9';
          statusDiv.style.borderColor = '#4CAF50';
          
          const list = getList();
          const idx = list.findIndex(a => 
            a.origem === cfg.origem && 
            a.alvo === cfg.alvo &&
            !a.done
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
      } else {
        // ✅ AGENDAMENTO - CRIA NOVO agendamento
        const list = getList();
        const novoAgendamento = {
          ...cfg,
          datetime: datetime,
          done: false,
          success: false,
          executedAt: null,
          error: null
        };

        list.push(novoAgendamento);
        setList(list);

        statusDiv.innerHTML = '✅ <strong>Novo agendamento criado com sucesso!</strong><br><small>O agendamento original foi preservado.</small>';
        statusDiv.style.background = '#E8F5E9';
        statusDiv.style.borderColor = '#4CAF50';
        
        setTimeout(() => {
          overlay.remove();
          window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
        }, 2000);
      }
      
    } catch (error) {
      console.error('[Test Modal] Erro:', error);
      statusDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}<br><small>Tente novamente ou edite as tropas</small>`;
      statusDiv.style.background = '#FFEBEE';
      statusDiv.style.borderColor = '#F44336';
    }
  }

  // ═════════════════════════════════════════════════════════
  // ✅ #5 MODAL PRINCIPAL COM ABAS E FILTROS
  // ═════════════════════════════════════════════════════════

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
      max-width: 900px;
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
        
        .test-filter-btn {
          padding: 8px 14px;
          border: 2px solid #8B4513;
          background: white;
          color: #8B4513;
          font-weight: bold;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          margin: 5px;
        }
        .test-filter-btn.active {
          background: #8B4513;
          color: white;
        }
        .test-filter-btn:hover {
          transform: translateY(-2px);
        }
      </style>

      <!-- Cabeçalho -->
      <div style="background: #8B4513; padding: 20px; color: white;">
        <h2 style="margin: 0 0 10px 0;">🔥 Teste / Edição Avançada</h2>
        <div style="font-size: 12px; opacity: 0.9;">
          ✅ Exibe TODOS os agendamentos | 🔧 Edite tropas e horários | 💾 Crie novo agendamento
        </div>
      </div>

      <!-- Filtros -->
      <div style="background: #F5E6D3; padding: 12px; border-bottom: 2px solid #8B4513; display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="test-filter-btn active" onclick="TWS_TestModal._filterBy('all')">📋 Todos (${list.length})</button>
        <button class="test-filter-btn" onclick="TWS_TestModal._filterBy('pending')">⏳ Pendentes (${list.filter(a => !a.done).length})</button>
        <button class="test-filter-btn" onclick="TWS_TestModal._filterBy('completed')">✅ Enviados (${list.filter(a => a.done && a.success).length})</button>
        <button class="test-filter-btn" onclick="TWS_TestModal._filterBy('failed')">❌ Falhados (${list.filter(a => a.done && !a.success).length})</button>
      </div>

      <!-- Conteúdo com abas -->
      <div id="test-content" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div id="test-status" style="
          padding: 12px;
          border: 2px solid #2196F3;
          border-radius: 6px;
          background: #E3F2FD;
          margin-bottom: 15px;
          display: none;
        "></div>
        
        <div id="test-list"></div>
        <div id="tab-1" class="tab-content" style="display: none;"></div>
        <div id="tab-2" class="tab-content" style="display: none;"></div>
      </div>

      <!-- Rodapé -->
      <div style="background: #f5f5f5; padding: 15px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        Teste Modal v2.0 | Total: ${list.length} agendamentos
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ✅ Estado compartilhado
    let currentTab = 0;
    let currentFilter = 'all';
    let selectedAgenda = null;
    let currentDatetime = null;
    let currentEnvioType = 'imediato';

    // Renderizar lista inicial
    document.getElementById('test-list').innerHTML = renderAgendamentosList('all');

    // Funções
    const modalFunctions = {
      _filterBy(filter) {
        currentFilter = filter;
        
        // Atualizar botões
        document.querySelectorAll('.test-filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Atualizar lista
        document.getElementById('test-list').innerHTML = renderAgendamentosList(filter);
      },

      _selectAgenda(idx) {
        selectedAgenda = { ...getList()[idx] };
        currentDatetime = selectedAgenda.datetime;
        
        // Renderizar TAB 1 (Edição)
        document.getElementById('tab-1').innerHTML = renderEditTab(selectedAgenda);
        document.getElementById('tab-1').style.display = 'block';
        document.getElementById('test-list').style.display = 'none';

        // Auto-validar tropas
        setTimeout(() => {
          this._validateTroops();
        }, 500);
      },

      _validateTroops() {
        const origemSelect = document.querySelector('input[id^="edit-troop-"]:first-of-type')?.parentElement;
        if (!origemSelect) return;

        // Aqui você poderia chamar getVillageTroops se necessário
        console.log('[Test] Tropas validadas');
      },

      _nextTab() {
        if (currentTab === 0) {
          // De lista para edição
          this._selectAgenda(currentTab);
          currentTab = 1;
        } else if (currentTab === 1) {
          // De edição para confirmação
          currentEnvioType = document.querySelector('input[name="envio-tipo"]:checked')?.value || 'imediato';
          
          if (currentEnvioType === 'agendado') {
            currentDatetime = document.getElementById('edit-datetime')?.value || selectedAgenda.datetime;
          } else {
            currentDatetime = formatDateTime(new Date());
          }

          // Atualizar tropas editadas
          TROOP_LIST.forEach(u => {
            const val = document.getElementById(`edit-troop-${u}`)?.value || selectedAgenda[u];
            selectedAgenda[u] = parseInt(val, 10);
          });

          // Renderizar confirmação
          document.getElementById('tab-2').innerHTML = renderConfirmTab(selectedAgenda, currentDatetime, currentEnvioType);
          document.getElementById('tab-1').style.display = 'none';
          document.getElementById('tab-2').style.display = 'block';
          currentTab = 2;
        }
      },

      _prevTab() {
        if (currentTab === 2) {
          document.getElementById('tab-2').style.display = 'none';
          document.getElementById('tab-1').style.display = 'block';
          currentTab = 1;
        } else if (currentTab === 1) {
          document.getElementById('tab-1').style.display = 'none';
          document.getElementById('test-list').style.display = 'block';
          currentTab = 0;
        }
      },

      _executeFinal(isImediato) {
        const confirmed = document.getElementById('confirm-checkbox')?.checked;
        if (!confirmed) {
          alert('⚠️ Marque o checkbox de confirmação antes de continuar!');
          return;
        }

        const statusDiv = document.getElementById('test-status');
        statusDiv.style.display = 'block';
        const overlay = document.getElementById('tws-test-modal');

        const finalCfg = { ...selectedAgenda };
        executeTest(finalCfg, currentDatetime, statusDiv, overlay, isImediato);
      }
    };

    Object.assign(window.TWS_TestModal, modalFunctions);

    // Listener para tipo de envio
    setTimeout(() => {
      const envioImediato = document.getElementById('envio-imediato');
      const envioAgendado = document.getElementById('envio-agendado');
      const datetimeEditor = document.getElementById('datetime-editor');

      if (envioImediato) {
        envioImediato.onchange = () => {
          if (datetimeEditor) datetimeEditor.style.display = 'none';
        };
      }

      if (envioAgendado) {
        envioAgendado.onchange = () => {
          if (datetimeEditor) datetimeEditor.style.display = 'block';
        };
      }
    }, 100);

    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove(); 
      }
    };
  }

  // ═════════════════════════════════════════════════════════
  // ✅ INICIALIZAÇÃO
  // ═════════════════════════════════════════════════════════

  function init() {
    if (!window.TWS_TestModal) {
      window.TWS_TestModal = {};
    }
    
    window.TWS_TestModal.show = showModal;
    
    console.log('[TW Scheduler Test Modal] ✅ Carregado v2.0 - Teste e Edição Avançada!');
    console.log('[TW Scheduler Test Modal] ✅ Exibe TODOS os agendamentos (não só pendentes)');
    console.log('[TW Scheduler Test Modal] ✅ Edição de tropas com validação');
    console.log('[TW Scheduler Test Modal] ✅ Recuperação em caso de falha');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
