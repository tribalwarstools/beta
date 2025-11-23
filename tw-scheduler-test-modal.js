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

  // ✅ Formata data para DD/MM/YYYY HH:MM:SS
  function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // ✅ Renderiza tropas em cards visuais
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

  // ✅ Renderiza lista de agendamentos (TAB 1)
  function renderAgendamentosList(onSelect) {
    const list = getList();
    const pendentes = list.filter(a => !a.done);
    
    if (pendentes.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum agendamento pendente</div>
          <small>Todos os agendamentos já foram processados</small>
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 10px;">';
    
    pendentes.forEach((agend, idx) => {
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
      if (diff < 300000) timeColor = '#FF9800'; // < 5 min = laranja
      if (diff < 60000) timeColor = '#F44336';  // < 1 min = vermelho

      html += `
        <div onclick="TWS_TestModal._selectAgenda(${idx})" style="
          background: white;
          border: 3px solid #8B4513;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        " onmouseover="this.style.background='#FFF9E6'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
          <div>
            <div style="font-weight: bold; color: #8B4513;">
              #${idx + 1}: ${agend.origem} → ${agend.alvo}
            </div>
            <small style="color: #666;">
              📅 ${agend.datetime}
            </small>
          </div>
          <div style="
            background: ${timeColor};
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
            min-width: 60px;
          ">
            ${timeStr}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // ✅ Renderiza edição de dados (TAB 2)
  function renderEditTab(cfg, onUpdate) {
    const troopsHtml = TROOP_LIST.map(u => `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <label style="width: 60px; font-weight: bold; color: #8B4513;">${u}:</label>
        <input type="number" 
          id="edit-troop-${u}" 
          value="${cfg[u] || 0}" 
          min="0"
          style="
            width: 80px;
            padding: 6px;
            border: 2px solid #8B4513;
            border-radius: 4px;
          "
        />
      </div>
    `).join('');

    return `
      <div style="display: grid; gap: 15px;">
        <!-- Info básica (leitura) -->
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
            <input type="radio" name="envio-tipo" value="imediato" id="envio-imediato" checked style="cursor: pointer;">
            <span style="color: #333;">
              <strong>Envio Imediato</strong><br>
              <small style="color: #666;">Envia o ataque AGORA, ignorando o horário</small>
            </span>
          </label>

          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="radio" name="envio-tipo" value="agendado" id="envio-agendado" style="cursor: pointer;">
            <span style="color: #333;">
              <strong>Data/Hora Customizada</strong><br>
              <small style="color: #666;">Define um novo horário de envio</small>
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
              <a href="#" onclick="document.getElementById('edit-datetime').value = '${formatDateTime(new Date())}'; return false;" style="color: #2196F3;">Agora</a> | 
              <a href="#" onclick="const d = new Date(Date.now() + 60000); document.getElementById('edit-datetime').value = '${formatDateTime(new Date(Date.now() + 60000))}'; return false;" style="color: #2196F3;">+1min</a> | 
              <a href="#" onclick="const d = new Date(Date.now() + 300000); document.getElementById('edit-datetime').value = '${formatDateTime(new Date(Date.now() + 300000))}'; return false;" style="color: #2196F3;">+5min</a>
            </small>
          </div>
        </div>

        <!-- Tropas editáveis -->
        <div style="background: #F5F5F5; padding: 12px; border-radius: 8px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 10px;">🪖 Tropas (Editáveis)</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${troopsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // ✅ Renderiza confirmação final (TAB 3)
  function renderConfirmTab(cfg, datetime, envioType) {
    const isImediato = envioType === 'imediato';
    const isAgendado = envioType === 'agendado';
    
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
              ? 'O ataque será enviado <strong>IMEDIATAMENTE</strong>' 
              : `Novo agendamento criado para: <strong>${datetime}</strong>`}
          </div>
          ${!isImediato ? `
            <div style="margin-top: 8px; padding: 8px; background: #D4EDDA; border-radius: 4px; font-size: 12px;">
              ✅ <strong>Agendamento original preservado</strong><br>
              <small>Foi criado um NOVO agendamento com suas alterações</small>
            </div>
          ` : ''}
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

  // ✅ Executa o ataque ou cria novo agendamento
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
          
          // ✅ Para envio imediato, marca o original como feito
          const list = getList();
          const idx = list.findIndex(a => 
            a.origem === cfg.origem && 
            a.alvo === cfg.alvo &&
            !a.done // Apenas se ainda não foi executado
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
      statusDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
      statusDiv.style.background = '#FFEBEE';
      statusDiv.style.borderColor = '#F44336';
    }
  }

  // === Cria e exibe o modal com abas ===
  function showModal() {
    const list = getList();
    const pendentes = list.filter(a => !a.done);
    
    if (pendentes.length === 0) {
      alert('❌ Nenhum agendamento pendente encontrado!');
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
      max-width: 800px;
      max-height: 85vh;
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
        
        .tab-header {
          display: flex;
          gap: 0;
          background: #8B4513;
          border-bottom: 3px solid #654321;
        }
        .tab-btn {
          flex: 1;
          padding: 15px;
          border: none;
          background: #A0522D;
          color: white;
          font-weight: bold;
          cursor: pointer;
          border-bottom: 4px solid transparent;
          transition: all 0.3s;
          font-size: 14px;
        }
        .tab-btn:hover {
          background: #8B4513;
        }
        .tab-btn.active {
          background: #8B4513;
          border-bottom-color: #FFD700;
          box-shadow: inset 0 -2px 0 #FFD700;
        }
        .tab-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .tab-footer {
          padding: 15px 20px;
          background: #E8D4A8;
          border-top: 2px solid #8B4513;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-cancel { background: #9E9E9E; color: white; }
        .btn-next { background: #2196F3; color: white; }
        .btn-prev { background: #9C27B0; color: white; }
        .btn-send { background: #F44336; color: white; }
        .btn-schedule { background: #4CAF50; color: white; }
        #test-status {
          padding: 12px;
          border: 2px solid #2196F3;
          border-radius: 6px;
          background: #E3F2FD;
          margin-bottom: 15px;
          font-size: 13px;
          line-height: 1.6;
        }
      </style>

      <!-- Abas -->
      <div class="tab-header">
        <button class="tab-btn active" onclick="TWS_TestModal._switchTab(0)">1️⃣ Selecionar</button>
        <button class="tab-btn" onclick="TWS_TestModal._switchTab(1)">2️⃣ Editar</button>
        <button class="tab-btn" onclick="TWS_TestModal._switchTab(2)">3️⃣ Confirmar</button>
      </div>

      <!-- Conteúdo das abas -->
      <div id="test-content" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div id="test-status"></div>
        <div id="tab-0" class="tab-content active"></div>
        <div id="tab-1" class="tab-content"></div>
        <div id="tab-2" class="tab-content"></div>
      </div>

      <!-- Rodapé com botões -->
      <div class="tab-footer">
        <button class="btn btn-cancel" onclick="document.getElementById('tws-test-modal').remove()">❌ Cancelar</button>
        <button class="btn btn-prev" id="btn-prev" onclick="TWS_TestModal._prevTab()" style="display: none;">⬅️ Voltar</button>
        <button class="btn btn-next" id="btn-next" onclick="TWS_TestModal._nextTab()">Próximo ➡️</button>
        <button class="btn btn-send" id="btn-send-imediato" onclick="TWS_TestModal._executeFinal(true)" style="display: none;">🚀 Enviar Agora</button>
        <button class="btn btn-schedule" id="btn-send-agendado" onclick="TWS_TestModal._executeFinal(false)" style="display: none;">💾 Criar Novo Agendamento</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Estado compartilhado
    let currentTab = 0;
    let selectedAgenda = pendentes[0];
    let currentDatetime = selectedAgenda.datetime;
    let currentEnvioType = 'imediato';

    // Renderizar TAB 1 (Seleção)
    document.getElementById('tab-0').innerHTML = renderAgendamentosList();

    // ✅ CORREÇÃO CRÍTICA: Reatribuir funções SEMPRE que o modal abrir
    const modalFunctions = {
      _selectAgenda(idx) {
        selectedAgenda = { ...pendentes[idx] }; // ✅ Cria cópia para não modificar o original
        currentDatetime = selectedAgenda.datetime;
        
        // Renderizar TAB 2
        document.getElementById('tab-1').innerHTML = renderEditTab(selectedAgenda);
        
        // Ir para TAB 2
        TWS_TestModal._switchTab(1);
        
        console.log('[Test Modal] Agendamento selecionado (cópia):', selectedAgenda);
      },

      _switchTab(tab) {
        currentTab = tab;
        
        // Ocultar todas as abas
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        // Mostrar aba atual
        document.getElementById(`tab-${tab}`).classList.add('active');
        document.querySelectorAll('.tab-btn')[tab].classList.add('active');
        
        // Atualizar botões
        document.getElementById('btn-prev').style.display = tab === 0 ? 'none' : 'block';
        document.getElementById('btn-next').style.display = tab === 2 ? 'none' : 'block';
        
        // Se tab 2, renderizar confirmação
        if (tab === 2) {
          // Capturar dados editados
          currentEnvioType = document.querySelector('input[name="envio-tipo"]:checked')?.value || 'imediato';
          
          if (currentEnvioType === 'agendado') {
            currentDatetime = document.getElementById('edit-datetime')?.value || selectedAgenda.datetime;
          } else {
            currentDatetime = formatDateTime(new Date());
          }

          // Atualizar tropas se editadas
          TROOP_LIST.forEach(u => {
            const val = document.getElementById(`edit-troop-${u}`)?.value || selectedAgenda[u];
            selectedAgenda[u] = parseInt(val, 10);
          });

          // Mostrar botão correto
          document.getElementById('btn-send-imediato').style.display = currentEnvioType === 'imediato' ? 'block' : 'none';
          document.getElementById('btn-send-agendado').style.display = currentEnvioType === 'agendado' ? 'block' : 'none';

          document.getElementById('tab-2').innerHTML = renderConfirmTab(selectedAgenda, currentDatetime, currentEnvioType);
        } else {
          document.getElementById('btn-send-imediato').style.display = 'none';
          document.getElementById('btn-send-agendado').style.display = 'none';
        }

        // Listener para tipo de envio
        if (tab === 1) {
          document.getElementById('envio-imediato').onchange = () => {
            document.getElementById('datetime-editor').style.display = 'none';
          };
          document.getElementById('envio-agendado').onchange = () => {
            document.getElementById('datetime-editor').style.display = 'block';
          };
        }
      },

      _nextTab() {
        if (currentTab < 2) TWS_TestModal._switchTab(currentTab + 1);
      },

      _prevTab() {
        if (currentTab > 0) TWS_TestModal._switchTab(currentTab - 1);
      },

      _executeFinal(isImediato) {
        const confirmed = document.getElementById('confirm-checkbox')?.checked;
        if (!confirmed) {
          alert('⚠️ Marque o checkbox de confirmação antes de continuar!');
          return;
        }

        const statusDiv = document.getElementById('test-status');
        const overlay = document.getElementById('tws-test-modal');

        // ✅ NOVO COMPORTAMENTO: CRIAR NOVO AGENDAMENTO
        const list = getList();
        
        if (isImediato) {
          // ✅ ENVIO IMEDIATO: Marca original como feito
          const idx = list.findIndex(a => 
            a.origem === selectedAgenda.origem && 
            a.alvo === selectedAgenda.alvo &&
            !a.done // Apenas se ainda não foi executado
          );

          if (idx !== -1) {
            list[idx].done = true;
            list[idx].success = true;
            list[idx].executedAt = new Date().toISOString();
          }
        } else {
          // ✅ AGENDAMENTO: CRIA NOVO agendamento
          const novoAgendamento = {
            ...selectedAgenda,
            datetime: currentDatetime,
            done: false,
            success: false,
            executedAt: null,
            error: null
          };

          list.push(novoAgendamento);
          console.log('[Test Modal] ✅ NOVO agendamento criado:', novoAgendamento);
        }

        setList(list);

        // Preparar config final
        const finalCfg = { ...selectedAgenda };
        
        // Executar com o tipo correto
        executeTest(finalCfg, currentDatetime, statusDiv, overlay, isImediato);
      }
    };

    // ✅ CORREÇÃO: Usar Object.assign para adicionar funções sem sobrescrever
    Object.assign(window.TWS_TestModal, modalFunctions);

    // ✅ CORREÇÃO: Fechar seguro - só remove elementos DOM
    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove(); // ⚠️ Só remove DOM, não as funções
      }
    };
  }

  // === INICIALIZAÇÃO CORRIGIDA ===
  function init() {
    // ✅ CORREÇÃO: Garantir que TWS_TestModal existe
    if (!window.TWS_TestModal) {
      window.TWS_TestModal = {};
    }
    
    // ✅ CORREÇÃO: Manter a função show SEMPRE disponível
    window.TWS_TestModal.show = showModal;
    
    console.log('[TW Scheduler Test Modal] ✅ Carregado - CRIA NOVOS AGENDAMENTOS!');
    console.log('[TW Scheduler Test Modal] ✅ Função show disponível:', typeof window.TWS_TestModal.show);
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
