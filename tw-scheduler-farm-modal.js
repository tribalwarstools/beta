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

  // ✅ FUNÇÃO REAL: Captura tempo de viagem com IFRAME
  function captureRealTravelTimeWithIframe(commandUrl) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = commandUrl;
      
      iframe.onload = function() {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // Extrair duração do comando do iframe
          let durationText = '';
          const durationElements = iframeDoc.querySelectorAll('*');
          
          for (let el of durationElements) {
            if (el.textContent.includes('Duração:')) {
              const text = el.textContent;
              const match = text.match(/Duração:\s*([\d:]+)/);
              if (match) {
                durationText = match[1];
                break;
              }
            }
          }
          
          document.body.removeChild(iframe);
          
          if (!durationText) {
            reject(new Error('Não foi possível encontrar o tempo de duração'));
            return;
          }
          
          // Converter para segundos
          const seconds = convertDurationToSeconds(durationText);
          console.log(`[Farm] Tempo de viagem detectado (iframe): ${durationText} (${seconds} segundos)`);
          resolve(seconds);
          
        } catch (error) {
          document.body.removeChild(iframe);
          reject(new Error('Erro ao acessar iframe: ' + error.message));
        }
      };
      
      iframe.onerror = function() {
        document.body.removeChild(iframe);
        reject(new Error('Erro ao carregar iframe'));
      };
      
      document.body.appendChild(iframe);
    });
  }

  // ✅ Converter duração para segundos
  function convertDurationToSeconds(durationText) {
    const parts = durationText.split(':').map(Number);
    let seconds = 0;
    
    if (parts.length === 3) { // HH:MM:SS
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
      seconds = parts[0] * 60 + parts[1];
    } else { // SS
      seconds = parts[0];
    }
    
    return seconds;
  }

  // ✅ Obter ID da vila atual da URL
  function getCurrentVillageId() {
    const match = window.location.href.match(/village=(\d+)/);
    return match ? match[1] : null;
  }

  // ✅ Tentar obter ID do último comando (aproximação)
  function getLastCommandId() {
    // Esta é uma aproximação - na prática precisaria monitorar a praça de reunião
    // Por enquanto, vamos usar um timestamp como ID aproximado
    return Promise.resolve('cmd_' + Date.now());
  }

  // ✅ Usar tempo estimado se não conseguir capturar real
  function useEstimatedTime(farm, now) {
    const origemCoord = parseCoord(farm.origem);
    const alvoCoord = parseCoord(farm.alvo);
    const travelTime = calculateTravelTime(origemCoord, alvoCoord, farm.troops);
    
    const intervaloMin = (farm.intervalo || 5) * 60 * 1000;
    const nextRun = new Date(now + (travelTime * 2 * 1000) + intervaloMin);
    farm.nextRun = formatDateTime(nextRun);
    
    console.log(`[Farm] Usando tempo estimado: ${farm.nextRun}`);
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

  // ✅ Renderiza lista de farms ativos
  function renderFarmList() {
    const farms = getFarmList().filter(f => f.active !== false);
    
    if (farms.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 10px;">🌾</div>
          <div style="font-size: 16px; font-weight: bold;">Nenhum farm inteligente ativo</div>
          <small>Clique em "Novo Farm" para começar</small>
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
      
      html += `
        <div style="
          background: white;
          border: 3px solid ${statusColor};
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.3s;
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
          <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #8B4513; font-size: 16px;">
                ${farm.origem} → ${farm.alvo}
              </div>
              <div style="color: #666; font-size: 12px; margin-top: 4px;">
                🪖 ${Object.entries(farm.troops).filter(([_, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}
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
              ${stats.totalRuns} envios (${stats.successRuns} sucessos)
            </div>
          </div>
          
          <div style="margin-top: 10px; display: flex; gap: 8px;">
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
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="farm-iniciar-imediatamente" checked style="cursor: pointer;">
              <span style="color: #333;">
                <strong>Iniciar imediatamente</strong><br>
                <small style="color: #666;">Começar o ciclo de farm assim que salvar</small>
              </span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="farm-manter-tempo-viagem" checked style="cursor: pointer;">
              <span style="color: #333;">
                <strong>Ajustar automaticamente tempo de viagem</strong><br>
                <small style="color: #666;">Recalcular horários baseado no tempo real de retorno</small>
              </span>
            </label>

            <div>
              <label style="display: block; font-weight: bold; color: #666; margin-bottom: 8px;">⏰ Intervalo mínimo entre envios (minutos):</label>
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

  // ✅ Processa farm inteligente COM DETECÇÃO REAL
  async function processFarmInteligente() {
    const farms = getFarmList().filter(f => !f.paused && f.active !== false);
    const now = Date.now();
    
    for (const farm of farms) {
      try {
        // Verificar se é hora de executar
        const nextRunMs = farm.nextRun ? parseDateTimeToMs(farm.nextRun) : 0;
        
        if (farm.nextRun && nextRunMs <= now) {
          console.log(`[Farm Inteligente] Executando farm: ${farm.origem} → ${farm.alvo}`);
          
          // Criar configuração de ataque
          const attackConfig = {
            origem: farm.origem,
            alvo: farm.alvo,
            datetime: formatDateTime(new Date()),
            ...farm.troops
          };
          
          // Executar ataque
          const success = await executeAttack(attackConfig);
          
          // Atualizar estatísticas
          farm.stats = farm.stats || { totalRuns: 0, successRuns: 0 };
          farm.stats.totalRuns++;
          if (success) farm.stats.successRuns++;
          
          if (success) {
            // ✅ TENTAR CAPTURAR TEMPO DE VIAGEM REAL
            const villageId = getCurrentVillageId();
            if (villageId) {
              setTimeout(async () => {
                try {
                  // Construir URL aproximada do comando
                  const commandUrl = `https://${window.location.host}/game.php?village=${villageId}&screen=info_command&type=own`;
                  
                  console.log(`[Farm] Tentando capturar tempo real: ${commandUrl}`);
                  
                  // Capturar tempo real de viagem
                  const realTravelTime = await captureRealTravelTimeWithIframe(commandUrl);
                  
                  // Calcular horário de retorno (ida + volta)
                  const returnTime = realTravelTime * 2;
                  
                  // Calcular próximo envio: agora + tempo_retorno + intervalo
                  const intervaloMin = (farm.intervalo || 5) * 60 * 1000;
                  const nextRun = new Date(now + (returnTime * 1000) + intervaloMin);
                  farm.nextRun = formatDateTime(nextRun);
                  
                  console.log(`[Farm] Próximo envio baseado em tempo REAL: ${farm.nextRun}`);
                  
                } catch (error) {
                  console.warn('[Farm] Não foi possível capturar tempo real, usando estimativa:', error.message);
                  useEstimatedTime(farm, now);
                }
                
                // Salvar alterações após tentativa de captura
                const allFarms = getFarmList();
                const idx = allFarms.findIndex(f => f.id === farm.id);
                if (idx !== -1) {
                  allFarms[idx] = farm;
                  setFarmList(allFarms);
                }
                
              }, 5000); // Aguardar 5 segundos para comando aparecer
            } else {
              useEstimatedTime(farm, now);
            }
          } else {
            // Se falhou, tentar novamente em 2 minutos
            const nextRun = new Date(now + 120000);
            farm.nextRun = formatDateTime(nextRun);
          }
          
          // Salvar estatísticas imediatamente
          const allFarms = getFarmList();
          const idx = allFarms.findIndex(f => f.id === farm.id);
          if (idx !== -1) {
            allFarms[idx] = farm;
            setFarmList(allFarms);
          }
          
          // Disparar evento de atualização
          window.dispatchEvent(new CustomEvent('tws-farm-updated'));
        }
      } catch (error) {
        console.error(`[Farm Inteligente] Erro no farm ${farm.id}:`, error);
      }
    }
  }

  // ✅ Inicia verificação periódica
  function startFarmMonitor() {
    // Verificar a cada 30 segundos
    setInterval(processFarmInteligente, 30000);
    console.log('[Farm Inteligente] Monitor iniciado - verificando a cada 30 segundos');
  }

  // === Modal principal ===
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
      </style>

      <!-- Cabeçalho -->
      <div style="background: #4CAF50; padding: 20px; text-align: center; border-bottom: 3px solid #388E3C;">
        <div style="font-size: 24px; font-weight: bold; color: white;">🌾 FARM INTELIGENTE</div>
        <div style="color: #E8F5E8; font-size: 14px; margin-top: 5px;">
          Automatize seus farms - o sistema gerencia os horários automaticamente
        </div>
      </div>

      <!-- Abas -->
      <div class="tab-header">
        <button class="tab-btn active" onclick="TWS_FarmInteligente._switchTab(0)">📋 Farms Ativos</button>
        <button class="tab-btn" onclick="TWS_FarmInteligente._switchTab(1)">➕ Novo Farm</button>
      </div>

      <!-- Conteúdo das abas -->
      <div id="farm-content" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div id="tab-0" class="tab-content active"></div>
        <div id="tab-1" class="tab-content"></div>
      </div>

      <!-- Rodapé -->
      <div class="tab-footer">
        <button class="btn btn-cancel" onclick="document.getElementById('tws-farm-modal').remove()">❌ Fechar</button>
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

      _saveFarm() {
        // Coletar dados
        const origem = document.getElementById('farm-origem').value.trim();
        const alvo = document.getElementById('farm-alvo').value.trim();
        const intervalo = parseInt(document.getElementById('farm-intervalo').value) || 5;
        const iniciarImediatamente = document.getElementById('farm-iniciar-imediatamente').checked;
        
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
          // Novo farm
          const newFarm = {
            id: generateId(),
            origem,
            alvo,
            troops,
            intervalo,
            paused: !iniciarImediatamente,
            active: true,
            stats: { totalRuns: 0, successRuns: 0 },
            created: new Date().toISOString()
          };

          // Calcular primeiro horário
          if (iniciarImediatamente) {
            const nextRun = new Date(Date.now() + 10000); // 10 segundos
            newFarm.nextRun = formatDateTime(nextRun);
          }

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
    
    console.log('[TW Farm Inteligente] ✅ Carregado e monitor ativo!');
  }

  // Aguardar carregamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
