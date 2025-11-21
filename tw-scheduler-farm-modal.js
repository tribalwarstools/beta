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
    TROOP_LIST
  } = window.TWS_Backend;

  // ✅ Formata data para DD/MM/YYYY HH:MM:SS (CORRIGIDA)
  function formatDateTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('[Farm] Data inválida recebida:', date);
      // Retorna data atual + 1 minuto como fallback
      const fallback = new Date(Date.now() + 60000);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(fallback.getDate())}/${pad(fallback.getMonth() + 1)}/${fallback.getFullYear()} ${pad(fallback.getHours())}:${pad(fallback.getMinutes())}:${pad(fallback.getSeconds())}`;
    }
    
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // ✅ CALCULA TEMPO DE VIAGEM COM BASE NAS TROPAS REAIS (CORRIGIDA)
  // ✅ CALCULA TEMPO DE VIAGEM COM BASE NAS TROPAS REAIS (CORRIGIDA)
function calculateTravelTime(origem, destino, troops) {
    try {
        const coord1 = parseCoord(origem);
        const coord2 = parseCoord(destino);
        
        if (!coord1 || !coord2) {
            console.error('[Farm] Coordenadas inválidas:', { origem, destino });
            return 3600; // 1 hora como fallback
        }
        
        // Calcular distância euclidiana
        const deltaX = Math.abs(coord1.x - coord2.x);
        const deltaY = Math.abs(coord1.y - coord2.y);
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        console.log(`[Farm] Distância calculada: ${dist} campos entre ${origem} e ${destino}`);
        
        // Velocidades das unidades (minutos por campo) - VALORES REAIS DO TW
        const velocidades = {
            spear: 18,      // Lanceiro
            sword: 22,      // Espadachim  
            axe: 18,        // Machado
            archer: 18,     // Arqueiro
            spy: 9,         // Espião
            light: 10,      // Cavalaria Leve
            marcher: 10,    // Arqueiro a Cavalo
            heavy: 11,      // Cavalaria Pesada
            ram: 30,        // Ariete
            catapult: 30,   // Catapulta
            knight: 10,     // Paladino
            snob: 35        // Nobre
        };
        
        // Encontrar unidade mais lenta presente
        let unidadeMaisLenta = null;
        let velocidadeMaisLenta = 0;
        
        Object.entries(troops).forEach(([unidade, quantidade]) => {
            if (quantidade > 0 && velocidades[unidade]) {
                if (velocidades[unidade] > velocidadeMaisLenta) {
                    velocidadeMaisLenta = velocidades[unidade];
                    unidadeMaisLenta = unidade;
                }
            }
        });
        
        if (!unidadeMaisLenta) {
            console.warn('[Farm] Nenhuma unidade encontrada, usando padrão');
            return 3600; // 1 hora como fallback
        }
        
        // ✅ CÁLCULO CORRETO: Tempo = distância × velocidade (em segundos)
        // velocidadeMaisLenta está em minutos/campo, converter para segundos/campo
        const velocidadeSegundosPorCampo = velocidadeMaisLenta * 60;
        
        // Tempo total em segundos
        const tempoSegundos = dist * velocidadeSegundosPorCampo;
        
        console.log(`[Farm] Cálculo: ${dist} campos × ${velocidadeMaisLenta} min/campo (${unidadeMaisLenta}) = ${Math.round(tempoSegundos/60)} minutos`);
        
        // Garantir limites razoáveis (5 minutos a 4 horas)
        return Math.max(300, Math.min(tempoSegundos, 14400));
        
    } catch (error) {
        console.error('[Farm] Erro no cálculo de tempo:', error);
        return 3600; // 1 hora como fallback
    }
}

  // ✅ CALCULA TEMPO DE RETORNO DAS TROPAS
  function calculateReturnTime(origem, destino, troops) {
    return calculateTravelTime(destino, origem, troops); // Retorno usa mesma lógica mas direção inversa
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

  // ✅ CONVERTER agendamento normal em Farm Inteligente (CORRIGIDA)
  function convertToFarm(agendamentoIndex, intervalo = 5) {
    const lista = getList();
    
    if (agendamentoIndex < 0 || agendamentoIndex >= lista.length) {
        alert('❌ Agendamento não encontrado!');
        return false;
    }
    
    const agendamento = lista[agendamentoIndex];
    
    // Verificar se já é um farm
    const farms = getFarmList();
    const jaExiste = farms.find(f => f.agendamentoBaseId === agendamentoIndex);
    if (jaExiste) {
        alert('❌ Este agendamento já é um Farm Inteligente!');
        return false;
    }
    
    // ✅ CORREÇÃO: REINICIAR status se já foi executado
    if (agendamento.done) {
        console.log(`[Farm] Reiniciando agendamento marcado como "já processado": ${agendamento.origem} → ${agendamento.alvo}`);
        
        // Reiniciar status para permitir novo ciclo
        agendamento.done = false;
        agendamento.success = false;
        agendamento.executedAt = null;
        agendamento.error = null;
        
        // ✅ ATUALIZAR data para futuro próximo (CORRIGIDO)
        const now = new Date();
        const newDate = new Date(now.getTime() + 60000); // 1 minuto no futuro
        agendamento.datetime = formatDateTime(newDate);
        
        console.log(`[Farm] Novo horário definido: ${agendamento.datetime}`);
        
        // Salvar alterações
        setList(lista);
    }
    
    // Extrair tropas do agendamento
    const troops = {};
    TROOP_LIST.forEach(u => {
        troops[u] = agendamento[u] || 0;
    });
    
    // Criar farm baseado no agendamento
    const farm = {
        id: generateId(),
        agendamentoBaseId: agendamentoIndex,
        origem: agendamento.origem,
        alvo: agendamento.alvo,
        troops: troops,
        intervalo: parseInt(intervalo) || 5,
        paused: false,
        active: true,
        stats: { totalRuns: 0, successRuns: 0, lastRun: null },
        nextRun: agendamento.datetime,
        created: new Date().toISOString(),
        lastReturnTime: null
    };
    
    // Adicionar à lista de farms
    farms.push(farm);
    setFarmList(farms);
    
    console.log(`[Farm] Agendamento convertido: ${farm.origem} → ${farm.alvo}`);
    return true;
  }

  // ✅ MONITORAR execução de agendamentos para Farms (CORRIGIDA)
  function monitorAgendamentosParaFarm() {
    const lista = getList();
    const farms = getFarmList().filter(f => !f.paused && f.active !== false);
    
    farms.forEach(farm => {
      // Verificar se o agendamento base foi executado
      const agendamentoBase = lista[farm.agendamentoBaseId];
      
      if (agendamentoBase && agendamentoBase.done) {
        console.log(`[Farm] Agendamento processado: ${farm.origem} → ${farm.alvo} | Sucesso: ${agendamentoBase.success}`);
        
        // Atualizar estatísticas do farm
        farm.stats.totalRuns++;
        if (agendamentoBase.success) {
          farm.stats.successRuns++;
        }
        farm.stats.lastRun = new Date().toISOString();
        
        // ✅ CALCULAR PRÓXIMO ATAQUE CONSIDERANDO RETORNO DAS TROPAS (CORRIGIDO)
        const now = new Date();
        let nextRunTime;
        
        try {
          if (agendamentoBase.success) {
            // ✅ SUCESSO: Calcular baseado no tempo de retorno + intervalo
            const travelTimeToTarget = calculateTravelTime(farm.origem, farm.alvo, farm.troops);
            const returnTime = calculateReturnTime(farm.origem, farm.alvo, farm.troops);
            
            // Tempo total do ciclo = volta + intervalo
            const intervaloMs = (farm.intervalo || 5) * 60 * 1000;
            
            // Próximo ataque = agora + tempo de retorno + intervalo
            nextRunTime = new Date(now.getTime() + (returnTime * 1000) + intervaloMs);
            
            console.log(`[Farm] Ciclo calculado - Ida: ${Math.round(travelTimeToTarget/60)}min, Volta: ${Math.round(returnTime/60)}min, Intervalo: ${farm.intervalo}min`);
            
            farm.lastReturnTime = returnTime;
          } else {
            // ✅ FALHA: Reagendar mais rapidamente (apenas intervalo)
            const intervaloMs = (farm.intervalo || 5) * 60 * 1000;
            nextRunTime = new Date(now.getTime() + intervaloMs);
            
            console.log(`[Farm] Falha detectada - Reagendando em ${farm.intervalo}min`);
          }
          
          // ✅ GARANTIR que a data é válida
          if (isNaN(nextRunTime.getTime())) {
            console.error('[Farm] Data inválida gerada, usando fallback');
            nextRunTime = new Date(now.getTime() + 300000); // 5 minutos
          }
          
          // Recriar o agendamento para próximo ciclo
          const novoAgendamento = {
            ...agendamentoBase,
            datetime: formatDateTime(nextRunTime),
            done: false,
            success: false,
            executedAt: null,
            error: null
          };
          
          // Substituir na lista
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
          
        } catch (error) {
          console.error('[Farm] Erro ao processar ciclo:', error);
          // Fallback: reagendar em 5 minutos
          const fallbackTime = new Date(now.getTime() + 300000);
          const novoAgendamento = {
            ...agendamentoBase,
            datetime: formatDateTime(fallbackTime),
            done: false,
            success: false,
            executedAt: null,
            error: null
          };
          
          lista.splice(farm.agendamentoBaseId, 1, novoAgendamento);
          setList(lista);
        }
        
        // Disparar eventos de atualização
        window.dispatchEvent(new CustomEvent('tws-farm-updated'));
        window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
      }
    });
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

  // ✅ INICIAR monitor periódico
  function startFarmMonitor() {
    // Verificar agendamentos para farms a cada 10 segundos
    setInterval(monitorAgendamentosParaFarm, 10000);
    console.log('[Farm Inteligente] ✅ Monitor de agendamentos ativo!');
  }

  // === MODAL PRINCIPAL ===
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
          Sistema automático que recalcula retorno das tropas para novos ataques
        </div>
      </div>

      <!-- Conteúdo -->
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <div style="background: #FFF3CD; border: 1px solid #FFEEBA; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #856404;">
          <strong>🔄 SISTEMA CORRIGIDO</strong><br>
          • Cálculo de datas corrigido<br>
          • Fallback para datas inválidas<br>
          • Melhor tratamento de erros
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <button class="btn-convert" onclick="TWS_FarmInteligente._convertAgendamento()" style="
            padding: 12px 20px;
            border: none;
            border-radius: 6px;
            background: #9C27B0;
            color: white;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
          ">🔄 Converter Agendamento</button>
          
          <button class="btn-cancel" onclick="document.getElementById('tws-farm-modal').remove()" style="
            padding: 12px 20px;
            border: none;
            border-radius: 6px;
            background: #9E9E9E;
            color: white;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
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
      },

      _convertAgendamento() {
        const lista = getList();
        const pendentes = lista.filter(a => !a.done);
        
        if (pendentes.length === 0) {
          alert('❌ Nenhum agendamento pendente encontrado!\n\nCrie um agendamento normal primeiro usando:\n• ➕ Adicionar Agendamento\n• 📋 Importar BBCode\n• 📂 Importar JSON');
          return;
        }
        
        let mensagem = '📋 SELECIONE UM AGENDAMENTO PARA CONVERTER EM FARM:\n\n';
        pendentes.forEach((agend, idx) => {
          const listaIdx = lista.findIndex(a => a === agend);
          const tropas = TROOP_LIST.map(u => agend[u] ? `${u}:${agend[u]}` : '').filter(Boolean).join(', ');
          mensagem += `[${idx + 1}] ${agend.origem} → ${agend.alvo}\n`;
          mensagem += `   📅 ${agend.datetime} | 🪖 ${tropas}\n\n`;
        });
        
        mensagem += 'Digite o número do agendamento:';
        
        const escolha = prompt(mensagem);
        if (escolha === null) return;
        
        const idxEscolhido = parseInt(escolha) - 1;
        
        if (idxEscolhido >= 0 && idxEscolhido < pendentes.length) {
          const agendamentoEscolhido = pendentes[idxEscolhido];
          const listaIdx = lista.findIndex(a => a === agendamentoEscolhido);
          
          const intervalo = prompt('⏰ Intervalo entre ciclos (minutos):', '5');
          if (intervalo === null) return;
          
          const intervaloNum = parseInt(intervalo) || 5;
          
          if (convertToFarm(listaIdx, intervaloNum)) {
            alert(`✅ AGENDAMENTO CONVERTIDO!\n\nO sistema agora calculará automaticamente o retorno das tropas.`);
            document.getElementById('farm-list-container').innerHTML = renderFarmList();
          }
        } else {
          alert('❌ Número inválido!');
        }
      }
    };

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  // === INICIALIZAÇÃO ===
  function init() {
    window.TWS_FarmInteligente = window.TWS_FarmInteligente || {};
    window.TWS_FarmInteligente.show = showFarmModal;
    
    startFarmMonitor();
    
    console.log('[TW Farm Inteligente] ✅ Carregado - Sistema corrigido!');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
