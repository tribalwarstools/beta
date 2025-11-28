(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler BBCode Modal] Backend não carregado!');
    return;
  }

  const {
    getList,
    setList,
    importarDeBBCode,
    parseDateTimeToMs,
    generateUniqueId
  } = window.TWS_Backend;

  // ✅ VALIDADOR MELHORADO DE COORDENADAS - VERSÃO CORRIGIDA
  function parseCoordValidate(s) {
    if (!s) return null;
    
    const t = s.trim();
    const match = t.match(/^(\d{1,4})\|(\d{1,4})$/);
    
    if (!match) return null;
    
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    
    // Corrigido: máximo 9999 (4 dígitos) para compatibilidade com a regex
    if (x < 0 || x > 9999 || y < 0 || y > 9999) {
      return null;
    }
    
    return `${x}|${y}`;
  }

  // ✅ EXTRATOR ROBUSTO DE COORDENADAS
  function extractCoordinatesFromLine(text) {
    if (!text) return [];
    
    const coordPattern = /\b(\d{1,4})\|(\d{1,4})\b/g;
    const coords = [];
    let match;
    
    while ((match = coordPattern.exec(text)) !== null) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      
      if (x >= 0 && x <= 9999 && y >= 0 && y <= 9999) {
        coords.push(`${x}|${y}`);
      }
    }
    
    return coords;
  }

  // ✅ VALIDADOR DE DATA/HORA
  function validateDateTimeFormat(dateString) {
    const pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
    const match = dateString.match(pattern);
    
    if (!match) return false;
    
    const [, day, month, year, hour, minute, second] = match.map(x => parseInt(x, 10));
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (hour < 0 || hour > 23) return false;
    if (minute < 0 || minute > 59) return false;
    if (second < 0 || second > 59) return false;
    
    try {
      const date = new Date(year, month - 1, day, hour, minute, second);
      return date.getFullYear() === year && 
             date.getMonth() === month - 1 && 
             date.getDate() === day;
    } catch {
      return false;
    }
  }

  // ✅ ALGORITMO "1 ALDEIA ATACA 1 SEM REPETIR"
  function distribuirAtaquesOneToOne(agendamentos) {
    if (!agendamentos || agendamentos.length === 0) return agendamentos;
    
    console.log('[One-to-One] 🔄 Aplicando distribuição 1:1...');
    
    // Agrupar por origem e destino
    const origens = [...new Set(agendamentos.map(a => a.origem))];
    const destinos = [...new Set(agendamentos.map(a => a.alvo))];
    
    console.log(`[One-to-One] 🎯 ${origens.length} origens, ${destinos.length} destinos`);
    
    // Se não há destinos suficientes, retornar original
    if (destinos.length === 0) return agendamentos;
    
    const resultado = [];
    const destinosUsados = new Set();
    const origensUsadas = new Set();
    
    // Para cada origem, encontrar um destino único
    origens.forEach(origem => {
      // Encontrar todos os agendamentos desta origem
      const agendamentosOrigem = agendamentos.filter(a => a.origem === origem);
      
      // Encontrar um destino não usado para esta origem
      for (const agendamento of agendamentosOrigem) {
        const destino = agendamento.alvo;
        
        // Se este destino ainda não foi usado E esta origem ainda não foi usada
        if (!destinosUsados.has(destino) && !origensUsadas.has(origem)) {
          resultado.push(agendamento);
          destinosUsados.add(destino);
          origensUsadas.add(origem);
          console.log(`[One-to-One] ✅ ${origem} → ${destino}`);
          break;
        }
      }
    });
    
    // Adicionar agendamentos restantes que não violam a regra
    agendamentos.forEach(agendamento => {
      const { origem, alvo: destino } = agendamento;
      
      // Se nem a origem nem o destino foram usados, adicionar
      if (!origensUsadas.has(origem) && !destinosUsados.has(destino)) {
        resultado.push(agendamento);
        origensUsadas.add(origem);
        destinosUsados.add(destino);
        console.log(`[One-to-One] ➕ ${origem} → ${destino} (restante)`);
      }
    });
    
    console.log(`[One-to-One] ✅ Distribuição concluída: ${agendamentos.length} → ${resultado.length}`);
    return resultado;
  }

  // ✅ PARSER BBCODE MELHORADO
  function parseBBCodeRobust(bbcode) {
    if (!bbcode || typeof bbcode !== 'string') {
      return [];
    }
    
    const agendamentos = [];
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    
    for (const linha of linhas) {
      try {
        // 1️⃣ Extrair coordenadas
        const coords = extractCoordinatesFromLine(linha);
        
        if (coords.length < 2) {
          console.warn(`[BBCode] ⚠️ Linha pulada (coordenadas insuficientes): ${linha.substring(0, 50)}`);
          continue;
        }
        
        const origem = coords[0];
        const destino = coords[1];
        
        // 2️⃣ Extrair data/hora
        const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/;
        const dateMatch = linha.match(datePattern);
        
        if (!dateMatch) {
          console.warn(`[BBCode] ⚠️ Linha pulada (data/hora inválida): ${linha.substring(0, 50)}`);
          continue;
        }
        
        const dataHora = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]} ${dateMatch[4].padStart(2, '0')}:${dateMatch[5].padStart(2, '0')}:${dateMatch[6].padStart(2, '0')}`;
        
        if (!validateDateTimeFormat(dataHora)) {
          console.warn(`[BBCode] ⚠️ Data/hora fora dos limites: ${dataHora}`);
          continue;
        }
        
        // 3️⃣ Extrair URL e parâmetros
        const urlMatch = linha.match(/\[url=(.*?)\]/i);
        const params = {};
        
        if (urlMatch) {
          const url = urlMatch[1];
          const queryString = url.split('?')[1];
          
          if (queryString) {
            queryString.split('&').forEach(param => {
              const [key, value] = param.split('=');
              if (key && value) {
                try {
                  params[decodeURIComponent(key)] = decodeURIComponent(value);
                } catch (e) {
                  // Ignorar erro de decodificação
                }
              }
            });
          }
        }
        
        // 4️⃣ Construir configuração
        const cfg = {
          _id: generateUniqueId(),
          origem,
          origemId: params.village || null,
          alvo: destino,
          datetime: dataHora,
          done: false,
          locked: false
        };
        
        // 5️⃣ Adicionar tropas
        const troopTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
        
        troopTypes.forEach(unit => {
          const key = `att_${unit}`;
          const value = params[key] ? parseInt(params[key], 10) : 0;
          cfg[unit] = isNaN(value) ? 0 : value;
        });
        
        agendamentos.push(cfg);
        console.log(`[BBCode] ✅ Parseado: ${origem} → ${destino} em ${dataHora}`);
        
      } catch (error) {
        console.error(`[BBCode] ❌ Erro ao processar: ${error.message}`);
        continue;
      }
    }
    
    return agendamentos;
  }

  // === Preview dos agendamentos importados ===
  function renderPreview(agendamentos, oneToOneEnabled = false) {
    if (agendamentos.length === 0) {
      return '<p style="text-align:center;color:#888;padding:20px;">Nenhum agendamento detectado no BBCode</p>';
    }

    const now = Date.now();
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    html += '<table style="width:100%; border-collapse: collapse; font-size:12px;">';
    html += `
      <thead style="position: sticky; top: 0; background: #8B4513; color: white;">
        <tr>
          <th style="padding:8px; border:1px solid #654321;">#</th>
          <th style="padding:8px; border:1px solid #654321;">Origem</th>
          <th style="padding:8px; border:1px solid #654321;">Destino</th>
          <th style="padding:8px; border:1px solid #654321;">Data/Hora</th>
          <th style="padding:8px; border:1px solid #654321;">Status</th>
        </tr>
      </thead>
      <tbody>
    `;

    // Análise para destacar duplicatas
    const origemCount = {};
    const destinoCount = {};
    agendamentos.forEach(cfg => {
      origemCount[cfg.origem] = (origemCount[cfg.origem] || 0) + 1;
      destinoCount[cfg.alvo] = (destinoCount[cfg.alvo] || 0) + 1;
    });

    agendamentos.forEach((cfg, idx) => {
      const t = parseDateTimeToMs(cfg.datetime);
      const diff = t - now;
      let status = '✅ OK';
      let statusColor = '#E8F5E9';
      let isDuplicata = false;

      if (isNaN(t)) {
        status = '⚠️ Data Inválida';
        statusColor = '#FFF3E0';
      } else if (diff < 0) {
        status = '⏰ Horário Passado';
        statusColor = '#FFEBEE';
      } else if (diff < 60000) {
        status = '🔥 < 1 minuto';
        statusColor = '#FFF9C4';
      }

      // Validar coordenadas
      const origemValida = parseCoordValidate(cfg.origem) !== null;
      const destValida = parseCoordValidate(cfg.alvo) !== null;
      
      if (!origemValida || !destValida) {
        status = '❌ Coord Inválida';
        statusColor = '#FFEBEE';
      }

      // Destacar duplicatas se o modo one-to-one estiver desativado
      if (!oneToOneEnabled) {
        if (origemCount[cfg.origem] > 1) {
          status += ' 🔄 Origem';
          statusColor = '#FFF9C4';
          isDuplicata = true;
        }
        if (destinoCount[cfg.alvo] > 1) {
          status += ' 🎯 Destino';
          statusColor = '#FFF9C4';
          isDuplicata = true;
        }
      }

      html += `
        <tr style="background: ${statusColor};">
          <td style="padding:6px; border:1px solid #ddd; text-align:center;">${idx + 1}</td>
          <td style="padding:6px; border:1px solid #ddd; ${isDuplicata && origemCount[cfg.origem] > 1 ? 'font-weight:bold;color:#E65100;' : ''}">${cfg.origem || '❌'}</td>
          <td style="padding:6px; border:1px solid #ddd; ${isDuplicata && destinoCount[cfg.alvo] > 1 ? 'font-weight:bold;color:#E65100;' : ''}">${cfg.alvo || '❌'}</td>
          <td style="padding:6px; border:1px solid #ddd; font-size:11px;">${cfg.datetime || '❌'}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:11px;">${status}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    return html;
  }

  // === Processa a importação ===
  function handleImport(agendamentos, replaceAll, oneToOneEnabled = false) {
    const list = getList();
    
    // Aplicar distribuição one-to-one se habilitado
    let agendamentosProcessados = oneToOneEnabled 
      ? distribuirAtaquesOneToOne(agendamentos) 
      : agendamentos;
    
    if (replaceAll) {
      setList(agendamentosProcessados);
      console.log('[BBCode Modal] ✅ Lista substituída completamente' + (oneToOneEnabled ? ' (modo 1:1 ativo)' : ''));
    } else {
      // ✅ PROTEÇÃO: Verificar duplicatas
      const existingKeys = new Set(
        list.map(a => `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`)
      );
      
      const novos = agendamentosProcessados.filter(a => {
        const key = `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
        return !existingKeys.has(key);
      });
      
      const duplicados = agendamentosProcessados.length - novos.length;
      
      list.push(...novos);
      setList(list);
      
      console.log(`[BBCode Modal] ✅ ${novos.length} agendamentos adicionados` + (oneToOneEnabled ? ' (modo 1:1 ativo)' : ''));
      if (duplicados > 0) {
        console.warn(`[BBCode Modal] ⚠️ ${duplicados} duplicados ignorados`);
      }
      
      return { 
        novos: novos.length, 
        duplicados,
        oneToOne: oneToOneEnabled,
        originalCount: agendamentos.length,
        processedCount: agendamentosProcessados.length
      };
    }

    window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
  }

  // === Cria e exibe o modal ===
  function showModal() {
    const existing = document.getElementById('tws-bbcode-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tws-bbcode-modal';
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
      max-width: 800px;
      max-height: 85vh;
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
        .bbcode-textarea {
          width: 100%;
          min-height: 150px;
          padding: 12px;
          border: 2px solid #8B4513;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
          box-sizing: border-box;
          background: white;
        }
        .bbcode-textarea:focus {
          outline: none;
          border-color: #654321;
          box-shadow: 0 0 5px rgba(139, 69, 19, 0.3);
        }
        .bbcode-btn-group {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .bbcode-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bbcode-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .bbcode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .bbcode-btn-parse {
          background: #2196F3;
          color: white;
        }
        .bbcode-btn-import {
          background: #4CAF50;
          color: white;
        }
        .bbcode-btn-replace {
          background: #FF9800;
          color: white;
        }
        .bbcode-btn-cancel {
          background: #9E9E9E;
          color: white;
        }
        .bbcode-info {
          background: #E3F2FD;
          border: 1px solid #2196F3;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 15px;
          font-size: 13px;
          line-height: 1.6;
        }
        .bbcode-preview {
          background: white;
          border: 2px solid #8B4513;
          border-radius: 4px;
          padding: 15px;
          margin-top: 15px;
          display: none;
        }
        .bbcode-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          padding: 10px;
          background: #FFF9C4;
          border-radius: 4px;
          font-weight: bold;
        }
        .bbcode-stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
          margin: 0 10px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: #4CAF50;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }
        .toggle-label {
          display: flex;
          align-items: center;
          margin: 10px 0;
          font-weight: bold;
          color: #8B4513;
        }
        .toggle-description {
          font-size: 12px;
          color: #666;
          margin-left: 60px;
          margin-top: -5px;
          margin-bottom: 10px;
        }
        .one-to-one-active {
          background: #E8F5E9 !important;
          border-left: 4px solid #4CAF50 !important;
        }
      </style>

      <h2 style="margin: 0 0 15px 0; color: #8B4513;">📋 Importar BBCode</h2>

      <div class="bbcode-info">
        <strong>📝 Como usar:</strong><br>
        1️⃣ Cole o BBCode no campo abaixo<br>
        2️⃣ Clique em <strong>"Analisar BBCode"</strong> para visualizar preview<br>
        3️⃣ Escolha <strong>"Adicionar"</strong> ou <strong>"Substituir Tudo"</strong><br><br>
        <strong>🔍 Coordenadas suportadas:</strong> X|Y, XX|YY, XXX|YYY, XXXX|YYYY<br>
        <strong>📅 Data/Hora:</strong> DD/MM/YYYY HH:MM:SS
      </div>

      <div class="toggle-label">
        <span>🎯 Modo "1 Aldeia = 1 Alvo":</span>
        <label class="toggle-switch">
          <input type="checkbox" id="one-to-one-toggle">
          <span class="toggle-slider"></span>
        </label>
        <span id="toggle-status" style="margin-left: 10px; color: #666;">Desativado</span>
      </div>
      <div class="toggle-description" id="toggle-description">
        ❌ Cada aldeia pode atacar múltiplos alvos (padrão)
      </div>

      <textarea 
        id="bbcode-input" 
        class="bbcode-textarea" 
        placeholder="Cole seu BBCode aqui...&#10;&#10;Exemplos:&#10;[*]5|4 → 52|43 em 16/11/2024 14:30:00 [url=https://...]&#10;[*]544|436 → 529|431 em 16/11/2024 14:35:00 [url=https://...]"
      ></textarea>

      <div class="bbcode-btn-group">
        <button id="bbcode-btn-parse" class="bbcode-btn bbcode-btn-parse">🔍 Analisar BBCode</button>
        <button id="bbcode-btn-cancel" class="bbcode-btn bbcode-btn-cancel">❌ Cancelar</button>
      </div>

      <div id="bbcode-preview" class="bbcode-preview">
        <h3 style="margin: 0 0 15px 0; color: #8B4513;">📊 Preview dos Agendamentos</h3>
        
        <div id="bbcode-stats" class="bbcode-stats"></div>
        
        <div id="bbcode-preview-content"></div>

        <div class="bbcode-btn-group" style="margin-top: 15px;">
          <button id="bbcode-btn-import" class="bbcode-btn bbcode-btn-import">✅ Adicionar à Lista</button>
          <button id="bbcode-btn-replace" class="bbcode-btn bbcode-btn-replace">🔄 Substituir Tudo</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let parsedAgendamentos = [];
    let oneToOneEnabled = false;

    const inputTextarea = document.getElementById('bbcode-input');
    const previewDiv = document.getElementById('bbcode-preview');
    const previewContent = document.getElementById('bbcode-preview-content');
    const statsDiv = document.getElementById('bbcode-stats');
    const toggleSwitch = document.getElementById('one-to-one-toggle');
    const toggleStatus = document.getElementById('toggle-status');
    const toggleDescription = document.getElementById('toggle-description');
    
    const btnParse = document.getElementById('bbcode-btn-parse');
    const btnImport = document.getElementById('bbcode-btn-import');
    const btnReplace = document.getElementById('bbcode-btn-replace');
    const btnCancel = document.getElementById('bbcode-btn-cancel');

    // Configurar o interruptor
    toggleSwitch.addEventListener('change', function() {
      oneToOneEnabled = this.checked;
      toggleStatus.textContent = oneToOneEnabled ? 'Ativado' : 'Desativado';
      toggleStatus.style.color = oneToOneEnabled ? '#4CAF50' : '#666';
      toggleDescription.textContent = oneToOneEnabled 
        ? '✅ Cada aldeia ataca apenas UM alvo único (distribuição inteligente)'
        : '❌ Cada aldeia pode atacar múltiplos alvos (padrão)';
      
      toggleDescription.parentElement.classList.toggle('one-to-one-active', oneToOneEnabled);
      
      // Se já temos agendamentos parseados, atualizar o preview
      if (parsedAgendamentos.length > 0) {
        updatePreview();
      }
    });

    function updatePreview() {
      const agendamentosParaPreview = oneToOneEnabled 
        ? distribuirAtaquesOneToOne(parsedAgendamentos) 
        : parsedAgendamentos;
      
      const now = Date.now();
      const validDates = agendamentosParaPreview.filter(a => {
        const t = parseDateTimeToMs(a.datetime);
        return !isNaN(t) && t > now;
      }).length;
      const pastDates = agendamentosParaPreview.filter(a => {
        const t = parseDateTimeToMs(a.datetime);
        return !isNaN(t) && t <= now;
      }).length;
      const invalidDates = agendamentosParaPreview.filter(a => {
        const t = parseDateTimeToMs(a.datetime);
        return isNaN(t);
      }).length;

      statsDiv.innerHTML = `
        <div class="bbcode-stat-item">
          <span>📦 Total:</span>
          <span style="color: #2196F3;">${agendamentosParaPreview.length}</span>
          ${oneToOneEnabled ? `<span style="color: #999; font-size: 11px;">(${parsedAgendamentos.length} original)</span>` : ''}
        </div>
        <div class="bbcode-stat-item">
          <span>✅ Válidos:</span>
          <span style="color: #4CAF50;">${validDates}</span>
        </div>
        ${pastDates > 0 ? `
          <div class="bbcode-stat-item">
            <span>⏰ Passados:</span>
            <span style="color: #F44336;">${pastDates}</span>
          </div>
        ` : ''}
        ${invalidDates > 0 ? `
          <div class="bbcode-stat-item">
            <span>⚠️ Inválidos:</span>
            <span style="color: #FF9800;">${invalidDates}</span>
          </div>
        ` : ''}
        ${oneToOneEnabled ? `
          <div class="bbcode-stat-item">
            <span>🎯 Modo 1:1:</span>
            <span style="color: #4CAF50;">ATIVO</span>
          </div>
        ` : ''}
      `;

      previewContent.innerHTML = renderPreview(agendamentosParaPreview, oneToOneEnabled);
      previewDiv.style.display = 'block';
    }

    btnCancel.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    btnParse.onclick = () => {
      const bbcode = inputTextarea.value.trim();
      
      if (!bbcode) {
        alert('❌ Cole o BBCode primeiro!');
        return;
      }

      try {
        parsedAgendamentos = parseBBCodeRobust(bbcode);
        
        if (parsedAgendamentos.length === 0) {
          alert('⚠️ Nenhum agendamento válido encontrado.\n\nVerifique o formato:\n[*]X|Y → XX|YY em DD/MM/YYYY HH:MM:SS [url=...]');
          return;
        }

        updatePreview();
        console.log('[BBCode Modal] ✅ Analisados', parsedAgendamentos.length, 'agendamentos');

      } catch (error) {
        console.error('[BBCode Modal] Erro:', error);
        alert('❌ Erro ao analisar BBCode:\n' + error.message);
      }
    };

    btnImport.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      const existingList = getList();
      const msg = existingList.length > 0 
        ? `Adicionar ${oneToOneEnabled ? distribuirAtaquesOneToOne(parsedAgendamentos).length : parsedAgendamentos.length} agendamentos?\n\nTotal após: ${existingList.length + (oneToOneEnabled ? distribuirAtaquesOneToOne(parsedAgendamentos).length : parsedAgendamentos.length)}${oneToOneEnabled ? '\n\n🎯 Modo "1 Aldeia = 1 Alvo" ATIVO' : ''}`
        : `Importar ${oneToOneEnabled ? distribuirAtaquesOneToOne(parsedAgendamentos).length : parsedAgendamentos.length} agendamentos?${oneToOneEnabled ? '\n\n🎯 Modo "1 Aldeia = 1 Alvo" ATIVO' : ''}`;

      if (confirm(msg)) {
        const result = handleImport(parsedAgendamentos, false, oneToOneEnabled);
        
        let alertMsg = `✅ ${result.novos} importado(s)!`;
        if (result.duplicados > 0) {
          alertMsg += `\n⚠️ ${result.duplicados} duplicado(s) ignorado(s).`;
        }
        if (oneToOneEnabled) {
          alertMsg += `\n🎯 Modo 1:1: ${result.originalCount} → ${result.processedCount} agendamentos`;
        }
        
        alert(alertMsg);
        overlay.remove();
      }
    };

    btnReplace.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      const existingList = getList();
      const processedCount = oneToOneEnabled ? distribuirAtaquesOneToOne(parsedAgendamentos).length : parsedAgendamentos.length;
      
      const msg = existingList.length > 0
        ? `⚠️ Remover ${existingList.length} e substituir por ${processedCount}?\n\nContinuar?${oneToOneEnabled ? '\n\n🎯 Modo "1 Aldeia = 1 Alvo" ATIVO' : ''}`
        : `Importar ${processedCount} agendamentos?${oneToOneEnabled ? '\n\n🎯 Modo "1 Aldeia = 1 Alvo" ATIVO' : ''}`;

      if (confirm(msg)) {
        handleImport(parsedAgendamentos, true, oneToOneEnabled);
        
        let alertMsg = `✅ ${processedCount} agendamento(s) importado(s)!`;
        if (oneToOneEnabled) {
          alertMsg += `\n🎯 Modo 1:1: ${parsedAgendamentos.length} → ${processedCount} agendamentos`;
        }
        
        alert(alertMsg);
        overlay.remove();
      }
    };

    setTimeout(() => inputTextarea.focus(), 100);
  }

  window.TWS_BBCodeModal = {
    show: showModal
  };

  console.log('[TW Scheduler BBCode Modal] ✅ Carregado com suporte robusto a coordenadas e modo 1:1!');
})();
