(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Farm Inteligente] Backend não carregado!');
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

  // ✅ Calcula tempo de viagem (simulação - usado como fallback)
  function calculateTravelTime(origem, destino, troops) {
    const dist = Math.sqrt(
      Math.pow(origem.x - destino.x, 2) + 
      Math.pow(origem.y - destino.y, 2)
    );
    
    const baseTime = dist * 30;
    return Math.max(60, Math.min(baseTime, 3600));
  }

  // ✅ Gerar ID único
  function generateId() {
    return 'farm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ✅ Armazenamento para farms inteligentes
  function getFarmList() {
    return JSON.parse(localStorage.getItem('tws_farm_inteligente') || '[]');
  }

  function setFarmList(list) {
    localStorage.setItem('tws_farm_inteligente', JSON.stringify(list));
  }

  // ✅ NOVA FUNÇÃO: Converte agendamento normal em Farm Inteligente
  function convertToFarm(agendamentoIndex, intervalo = 5) {
    const lista = getList();
    
    if (agendamentoIndex < 0 || agendamentoIndex >= lista.length) {
      alert('❌ Agendamento não encontrado!');
      return false;
    }
    
    const agendamento = lista[agendamentoIndex];
    
    // Extrair tropas do agendamento
    const troops = {};
    TROOP_LIST.forEach(u => {
      troops[u] = agendamento[u] || 0;
    });
    
    // Criar farm baseado no agendamento
    const farm = {
      id: generateId(),
      agendamentoBaseId: agendamentoIndex, // Referência ao agendamento original
      origem: agendamento.origem,
      alvo: agendamento.alvo,
      troops: troops,
      intervalo: intervalo,
      paused: false,
      active: true,
      stats: { totalRuns: 0, successRuns: 0 },
      nextRun: agendamento.datetime, // Usar a data do agendamento original
      created: new Date().toISOString()
    };
    
    // Adicionar à lista de farms
    const farms = getFarmList();
    farms.push(farm);
    setFarmList(farms);
    
    console.log(`[Farm] Agendamento convertido: ${farm.origem} → ${farm.alvo}`);
    return true;
  }

  // ✅ NOVA FUNÇÃO: Monitora execução de agendamentos para Farms
  function monitorAgendamentosParaFarm() {
    const lista = getList();
    const farms = getFarmList().filter(f => !f.paused && f.active !== false);
    
    farms.forEach(farm => {
      // Verificar se o agendamento base foi executado
      const agendamentoBase = lista[farm.agendamentoBaseId];
      
      if (agendamentoBase && agendamentoBase.done && agendamentoBase.success) {
        // ✅ Agendamento foi executado com sucesso!
        console.log(`[Farm] Agendamento executado: ${farm.origem} → ${farm.alvo}`);
        
        // Atualizar estatísticas do farm
        farm.stats.totalRuns++;
        farm.stats.successRuns++;
        
        // Calcular próximo horário baseado no tempo real de execução
        const now = new Date();
        const travelTime = calculateTravelTime(
          parseCoord(farm.origem), 
          parseCoord(farm.alvo), 
          farm.troops
        );
        
        // Próximo envio = agora + (tempo_viagem * 2) + intervalo
        const intervaloMs = (farm.intervalo || 5) * 60 * 1000;
        const nextRun = new Date(now.getTime() + (travelTime * 2 * 1000) + intervaloMs);
        
        // Recriar o agendamento para próximo ciclo
        const novoAgendamento = {
          ...agendamentoBase,
          datetime: formatDateTime(nextRun),
          done: false,
          success: false,
          executedAt: null,
          error: null
        };
        
        // Substituir na lista (remove o concluído, adiciona novo)
        lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
        setList(lista);
        
        // Atualizar farm com nova data
        farm.nextRun = novoAgendamento.datetime;
        
        // Salvar farm atualizado
        const updatedFarms = getFarmList();
        const farmIdx = updatedFarms.findIndex(f => f.id === farm.id);
        if (farmIdx !== -1) {
          updatedFarms[farmIdx] = farm;
          setFarmList(updatedFarms);
        }
        
        console.log(`[Farm] Novo ciclo agendado: ${novoAgendamento.datetime}`);
        
        // Disparar evento de atualização
        window.dispatchEvent(new CustomEvent('tws-farm-updated'));
        window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
      }
    });
  }

  // ✅ Renderiza lista de farms ativos ATUALIZADA
  function renderFarmList() {
    const farms = getFarmList().filter(f => f.active !== false);
    const listaAgendamentos = getList();
    
    if (farms.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">🌾</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum farm inteligente ativo</div>
          <small>Use "Converter Agendamento" ou "Novo Farm" para começar</small>
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 10px;">';
    
    farms.forEach((farm, idx) => {
      const now = Date.now();
      const nextRun = farm.nextRun ? parseDateTimeToMs(farm.nextRun) : null;
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
        '❓ Não encontrado';
      
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
                📋 Agendamento base: ${baseStatus}
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
            </div>
            <div>
              <strong>Estatísticas:</strong><br>
              ${stats.totalRuns} ciclos (${stats.successRuns} sucessos)
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
            
            <button onclick="TWS_FarmInteligente._editFarm('${farm.id}')" style="
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              background: #2196F3;
              color: white;
              font-size: 11px;
              cursor: pointer;
            ">✏️ Editar</button>
            
            <button onclick="TWS_FarmInteligente._deleteFarm('${farm.id}')" style="
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              background: #F44336;
              color: white;
              font-size: 11px;
              cursor: pointer;
            ">🗑️ Excluir</button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // ✅ Renderiza formulário de novo farm
  function renderNewFarmForm() {
    const troopsHtml = TROOP_LIST.map(u => `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <label style="width: 80px; font-weight: bold; color: #8B4513;">${u}:</label>
        <input type="number" 
          id="farm-troop-${u}" 
          value="0" 
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
        <!-- Coordenadas -->
        <div style="background: #F5F5F5; padding: 15px; border-radius: 8px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 12px;">📍 Coordenadas</div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="display: block; font-weight: bold; color: #666; margin-bottom: 8px;">🏠 Vila de Origem:</label>
              <input type="text" 
                id="farm-origem" 
                placeholder="123|456"
                style="
                  width: 100%;
                  padding: 10px;
                  border: 2px solid #8B4513;
                  border-radius: 4px;
                  box-sizing: border-box;
                "
              />
            </div>
            
            <div>
              <label style="display: block; font-weight: bold; color: #666; margin-bottom: 8px;">🎯 Alvo (Farm):</label>
              <input type="text" 
                id="farm-alvo" 
                placeholder="123|457" 
                style="
                  width: 100%;
                  padding: 10px;
                  border: 2px solid #8B4513;
                  border-radius: 4px;
                  box-sizing: border-box;
                "
              />
            </div>
          </div>
        </div>

        <!-- Tropas -->
        <div style="background: #F5F5F5; padding: 15px; border-radius: 8px;">
          <div style="font-weight: bold; color: #8B4513; margin-bottom: 12px;">🪖 Composição das Tropas</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${troopsHtml}
          </div>
        </div>

        <!-- Configurações -->
        <div style="background: #E3F2FD; padding: 15px; border-radius: 8px; border: 2px dashed #2196F3;">
          <div style="font-weight: bold; color: #1976D2; margin-bottom: 12px;">⚙️ Configurações do Farm</div>
          
          <div style="display: grid; gap: 10px;">
            <div>
              <label style="display: block; font-weight: bold; color: #666; margin-bottom: 8px;">⏰ Intervalo entre ciclos (minutos):</label>
              <input type="number" 
                id="farm-intervalo" 
                value="5" 
                min="1"
                style="
                  width: 100px;
                  padding: 8px;
                  border: 2px solid #2196F3;
                  border-radius: 4px;
                "
              />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ✅ Inicia verificação periódica
  function startFarmMonitor() {
    // Verificar agendamentos para farms a cada 10 segundos
    setInterval(monitorAgendamentosParaFarm, 10000);
    console.log('[Farm Inteligente] ✅ Monitor de agendamentos ativo!');
  }

  // === Modal principal ATUALIZADO ===
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
        
        .tab-header {
          display: flex;
          gap: 0;
          background: #4CAF50;
          border-bottom: 3px solid #388E3C;
        }
        .tab-btn {
          flex: 1;
          padding: 15px;
          border: none;
          background: #66BB6A;
          color: white;
          font-weight: bold;
          cursor: pointer;
          border-bottom: 4px solid transparent;
          transition: all 0.3s;
          font-size: 14px;
        }
        .tab-btn:hover {
          background: #4CAF50;
        }
        .tab-btn.active {
          background: #4CAF50;
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
          background: #C8E6C9;
          border-top: 2px solid #4CAF50;
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
        .btn-save { background: #4CAF50; color: white; }
        .btn-new { background: #2196F3; color: white; }
        .btn-convert { background: #9C27B0; color: white; }
      </style>

      <!-- Cabeçalho -->
      <div style="background: #4CAF50; padding: 20px; text-align: center; border-bottom: 3px solid #388E3C;">
        <div style="font-size: 24px; font-weight: bold; color: white;">🌾 FARM INTELIGENTE</div>
        <div style="color: #E8F5E8; font-size: 14px; margin-top: 5px;">
          Converte agendamentos normais em ciclos automáticos infinitos
        </div>
      </div>

      <!-- Abas -->
      <div class="tab-header">
        <button class="tab-btn active" onclick="TWS_FarmInteligente._switchTab(0)">📋 Farms Ativos</button>
        <button class="tab-btn" onclick="TWS_FarmInteligente._switchTab(1)">➕ Novo Farm</button>
        <button class="tab-btn" onclick="TWS_FarmInteligente._convertAgendamento()">🔄 Converter Agendamento</button>
      </div>

      <!-- Conteúdo das abas -->
      <div id="farm-content" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div id="tab-0" class="tab-content active"></div>
        <div id="tab-1" class="tab-content"></div>
      </div>

      <!-- Rodapé -->
      <div class="tab-footer">
        <button class="btn btn-cancel" onclick="document.getElementById('tws-farm-modal').remove()">❌ Fechar</button>
        <button class="btn btn-convert" id="btn-convert-agendamento" onclick="TWS_FarmInteligente._convertAgendamento()" style="display: none;">🔄 Converter Agendamento</button>
        <button class="btn btn-new" id="btn-new-farm" onclick="TWS_FarmInteligente._switchTab(1)" style="display: none;">➕ Novo Farm</button>
        <button class="btn btn-save" id="btn-save-farm" onclick="TWS_FarmInteligente._saveFarm()" style="display: none;">💾 Salvar Farm</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Estado
    let currentTab = 0;
    let editingFarmId = null;

    // Renderizar conteúdo inicial
    document.getElementById('tab-0').innerHTML = renderFarmList();

    // Funções expostas
    window.TWS_FarmInteligente = {
      _switchTab(tab) {
        currentTab = tab;
        
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`tab-${tab}`).classList.add('active');
        document.querySelectorAll('.tab-btn')[tab].classList.add('active');
        
        // Atualizar botões
        document.getElementById('btn-convert-agendamento').style.display = tab === 0 ? 'block' : 'none';
        document.getElementById('btn-new-farm').style.display = tab === 0 ? 'block' : 'none';
        document.getElementById('btn-save-farm').style.display = tab === 1 ? 'block' : 'none';
        
        if (tab === 0) {
          document.getElementById('tab-0').innerHTML = renderFarmList();
        } else if (tab === 1) {
          document.getElementById('tab-1').innerHTML = renderNewFarmForm();
          editingFarmId = null;
        }
      },

      _toggleFarm(id) {
        const farms = getFarmList();
        const farm = farms.find(f => f.id === id);
        if (farm) {
          farm.paused = !farm.paused;
          setFarmList(farms);
          document.getElementById('tab-0').innerHTML = renderFarmList();
        }
      },

      _editFarm(id) {
        const farms = getFarmList();
        const farm = farms.find(f => f.id === id);
        if (farm) {
          editingFarmId = id;
          
          // Preencher formulário
          document.getElementById('farm-origem').value = farm.origem;
          document.getElementById('farm-alvo').value = farm.alvo;
          TROOP_LIST.forEach(u => {
            document.getElementById(`farm-troop-${u}`).value = farm.troops[u] || 0;
          });
          document.getElementById('farm-intervalo').value = farm.intervalo || 5;
          
          this._switchTab(1);
        }
      },

      _deleteFarm(id) {
        if (confirm('Tem certeza que deseja excluir este farm inteligente?')) {
          const farms = getFarmList();
          const updatedFarms = farms.filter(f => f.id !== id);
          setFarmList(updatedFarms);
          document.getElementById('tab-0').innerHTML = renderFarmList();
        }
      },

      // ✅ NOVA FUNÇÃO: Converter Agendamento em Farm
      _convertAgendamento() {
        const lista = getList();
        const pendentes = lista.filter(a => !a.done);
        
        if (pendentes.length === 0) {
          alert('❌ Nenhum agendamento pendente para converter!\n\nCrie um agendamento normal primeiro.');
          return;
        }
        
        // Criar mensagem com lista de agendamentos
        let mensagem = '📋 SELECIONE UM AGENDAMENTO PARA CONVERTER EM FARM:\n\n';
        pendentes.forEach((agend, idx) => {
          const listaIdx = lista.findIndex(a => a === agend);
          const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
          mensagem += `${idx + 1}. ${agend.origem} → ${agend.alvo}\n`;
          mensagem += `   📅 ${agend.datetime} | 🪖 ${tropas}\n\n`;
        });
        
        mensagem += 'Digite o número do agendamento:';
        
        const escolha = prompt(mensagem);
        const idxEscolhido = parseInt(escolha) - 1;
        
        if (idxEscolhido >= 0 && idxEscolhido < pendentes.length) {
          const agendamentoEscolhido = pendentes[idxEscolhido];
          const listaIdx = lista.findIndex(a => a === agendamentoEscolhido);
          
          const intervalo = prompt('⏰ Intervalo entre ciclos (minutos):', '5');
          const intervaloNum = parseInt(intervalo) || 5;
          
          if (convertToFarm(listaIdx, intervaloNum)) {
            alert(`✅ Agendamento convertido em Farm Inteligente!\n\n${agendamentoEscolhido.origem} → ${agendamentoEscolhido.alvo}\n⏰ Ciclos a cada ${intervaloNum} minutos`);
            this._switchTab(0); // Voltar para lista de farms
          }
        } else if (escolha !== null) {
          alert('❌ Número inválido!');
        }
      },

      _saveFarm() {
        // Coletar dados
        const origem = document.getElementById('farm-origem').value.trim();
        const alvo = document.getElementById('farm-alvo').value.trim();
        const intervalo = parseInt(document.getElementById('farm-intervalo').value) || 5;
        
        // Validar
        if (!origem || !alvo) {
          alert('❌ Preencha as coordenadas de origem e alvo!');
          return;
        }

        // Coletar tropas
        const troops = {};
        TROOP_LIST.forEach(u => {
          troops[u] = parseInt(document.getElementById(`farm-troop-${u}`).value) || 0;
        });

        // Verificar se há tropas
        const hasTroops = Object.values(troops).some(v => v > 0);
        if (!hasTroops) {
          alert('❌ Selecione pelo menos um tipo de tropa!');
          return;
        }

        // Criar/atualizar farm
        const farms = getFarmList();
        
        if (editingFarmId) {
          // Editar existente
          const idx = farms.findIndex(f => f.id === editingFarmId);
          if (idx !== -1) {
            farms[idx].origem = origem;
            farms[idx].alvo = alvo;
            farms[idx].troops = troops;
            farms[idx].intervalo = intervalo;
          }
        } else {
          // Criar agendamento base para o farm
          const agora = new Date();
          const primeiroHorario = new Date(agora.getTime() + 30000); // 30 segundos
          
          const agendamentoBase = {
            origem: origem,
            alvo: alvo,
            datetime: formatDateTime(primeiroHorario),
            ...troops
          };
          
          // Adicionar à lista principal
          const lista = getList();
          lista.push(agendamentoBase);
          setList(lista);
          
          const agendamentoIndex = lista.length - 1;
          
          // Novo farm
          const newFarm = {
            id: generateId(),
            agendamentoBaseId: agendamentoIndex,
            origem,
            alvo,
            troops,
            intervalo,
            paused: false,
            active: true,
            stats: { totalRuns: 0, successRuns: 0 },
            nextRun: agendamentoBase.datetime,
            created: new Date().toISOString()
          };

          farms.push(newFarm);
        }

        setFarmList(farms);
        alert('✅ Farm inteligente salvo com sucesso!');
        this._switchTab(0);
      }
    };

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  // === Inicialização ===
  function init() {
    // Expor API global
    window.TWS_FarmInteligente = window.TWS_FarmInteligente || {};
    window.TWS_FarmInteligente.show = showFarmModal;
    
    // Iniciar monitor
    startFarmMonitor();
    
    console.log('[TW Farm Inteligente] ✅ Carregado - Sistema de conversão ativo!');
  }

  // Aguardar carregamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
