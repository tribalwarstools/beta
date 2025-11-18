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
    parseDateTimeToMs
  } = window.TWS_Backend;

  // === Preview dos agendamentos importados ===
  function renderPreview(agendamentos) {
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

    agendamentos.forEach((cfg, idx) => {
      const t = parseDateTimeToMs(cfg.datetime);
      const diff = t - now;
      let status = '✅ OK';
      let statusColor = '#E8F5E9';

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

      html += `
        <tr style="background: ${statusColor};">
          <td style="padding:6px; border:1px solid #ddd; text-align:center;">${idx + 1}</td>
          <td style="padding:6px; border:1px solid #ddd;">${cfg.origem || '?'}</td>
          <td style="padding:6px; border:1px solid #ddd;">${cfg.alvo || '?'}</td>
          <td style="padding:6px; border:1px solid #ddd; font-size:11px;">${cfg.datetime || '?'}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:11px;">${status}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    return html;
  }

  // === Processa a importação ===
  function handleImport(agendamentos, replaceAll) {
    const list = getList();
    
    if (replaceAll) {
      // Substituir todos os agendamentos
      setList(agendamentos);
      console.log('[BBCode Modal] ✅ Lista substituída completamente');
    } else {
      // ✅ PROTEÇÃO: Verificar duplicatas antes de adicionar
      const existingKeys = new Set(
        list.map(a => `${a.origemId}_${a.alvo}_${a.datetime}`)
      );
      
      const novos = agendamentos.filter(a => {
        const key = `${a.origemId}_${a.alvo}_${a.datetime}`;
        return !existingKeys.has(key);
      });
      
      const duplicados = agendamentos.length - novos.length;
      
      list.push(...novos);
      setList(list);
      
      console.log(`[BBCode Modal] ✅ ${novos.length} agendamentos adicionados`);
      if (duplicados > 0) {
        console.warn(`[BBCode Modal] ⚠️ ${duplicados} duplicados ignorados`);
      }
      
      return { novos: novos.length, duplicados };
    }

    // Disparar evento de atualização
    window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
  }

  // === Função para normalizar coordenadas ===
  function normalizarCoordenadas(coord) {
    if (!coord) return coord;
    
    // Limpar espaços
    coord = coord.trim();
    
    // Verificar se já está no formato XXX|XXX
    if (/^\d{3}\|\d{3}$/.test(coord)) {
      return coord;
    }
    
    // Converter de XXX|XX para XXX|XXX (adicionar zero à esquerda)
    const match = coord.match(/^(\d{3})\|(\d{2})$/);
    if (match) {
      const x = match[1];
      const y = match[2].padStart(3, '0');
      return `${x}|${y}`;
    }
    
    return coord;
  }

  // === Função para processar BBCode em formato de tabela ===
  function importarDeBBCodeTabela(bbcode) {
    const agendamentos = [];
    
    // Padrão para formato de tabela: [*][unit]...[/unit] [|] ORIGEM [|] DESTINO [|] DATA_LANCAMENTO [|] DATA_CHEGADA [|] [url=...]
    const padraoTabela = /\[\*\](?:\[unit\][^[]*\[\/unit\])?\s*\[\|\]\s*([\d|]+)\s*\[\|\]\s*([\d|]+)\s*\[\|\]\s*([\d\/]+\s+[\d:]+)\s*\[\|\]\s*([\d\/]+\s+[\d:]+)\s*\[\|\]\s*\[url=([^\]]+)\]/gi;
    
    let match;
    while ((match = padraoTabela.exec(bbcode)) !== null) {
      const origem = normalizarCoordenadas(match[1].trim());
      const alvo = normalizarCoordenadas(match[2].trim());
      const dataLancamento = match[3].trim();
      const dataChegada = match[4].trim();
      const url = match[5].trim();
      
      // Usar a data de lançamento como horário do agendamento
      agendamentos.push({
        origem: origem,
        alvo: alvo,
        datetime: dataLancamento,
        origemId: origem,
        url: url
      });
    }
    
    return agendamentos;
  }

  // === Função principal de importação que detecta automaticamente o formato ===
  function importarDeBBCodeUniversal(bbcode) {
    // Verificar se é formato de tabela (contém [table] e [|])
    if (bbcode.includes('[table]') && bbcode.includes('[|]')) {
      console.log('[BBCode Modal] 📊 Detectado formato de TABELA');
      return importarDeBBCodeTabela(bbcode);
    } else {
      console.log('[BBCode Modal] 📝 Detectado formato de LISTA tradicional');
      const agendamentos = importarDeBBCode(bbcode);
      
      // Normalizar coordenadas para o formato XXX|XXX
      return agendamentos.map(agendamento => {
        return {
          ...agendamento,
          origem: normalizarCoordenadas(agendamento.origem),
          alvo: normalizarCoordenadas(agendamento.alvo),
          origemId: normalizarCoordenadas(agendamento.origemId)
        };
      });
    }
  }

  // === Cria e exibe o modal ===
  function showModal() {
    // Remove modal existente se houver
    const existing = document.getElementById('tws-bbcode-modal');
    if (existing) existing.remove();

    // Criar overlay
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

    // Criar modal
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
        .bbcode-format-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          margin-left: 8px;
        }
        .badge-table {
          background: #FF9800;
          color: white;
        }
        .badge-list {
          background: #4CAF50;
          color: white;
        }
      </style>

      <h2 style="margin: 0 0 15px 0; color: #8B4513;">📋 Importar BBCode</h2>

      <div class="bbcode-info">
        <strong>📝 Formatos aceitos:</strong><br>
        
        <strong>📊 Formato TABELA</strong> <span class="bbcode-format-badge badge-table">NOVO</span><br>
        <code style="background: white; padding: 2px 6px; border-radius: 3px; display: block; margin: 5px 0; font-size: 11px;">
          [*][unit]spear[/unit] [|] 314|79 [|] 313|82 [|] 18/11/2025 05:00:00 [|] 18/11/2025 05:56:55 [|] [url=...]
        </code>
        
        <strong>📝 Formato LISTA tradicional</strong> <span class="bbcode-format-badge badge-list">ORIGINAL</span><br>
        <code style="background: white; padding: 2px 6px; border-radius: 3px; display: block; margin: 5px 0; font-size: 11px;">
          [*]544|436 → 529|431 em 16/11/2024 14:30:00 [url=...]
        </code>
        
        <br><strong>✅ Coordenadas aceitas:</strong> XXX|XXX e XXX|XX (converte automaticamente)<br>
        <em>O sistema detecta automaticamente o formato do BBCode!</em>
      </div>

      <textarea 
        id="bbcode-input" 
        class="bbcode-textarea" 
        placeholder="Cole seu BBCode aqui...&#10;&#10;Exemplo formato TABELA:&#10;[*][unit]spear[/unit] [|] 314|79 [|] 313|82 [|] 18/11/2025 05:00:00 [|] 18/11/2025 05:56:55 [|] [url=...]&#10;&#10;Exemplo formato LISTA:&#10;[*]544|436 → 529|431 em 16/11/2024 14:30:00 [url=...]"
      ></textarea>

      <div class="bbcode-btn-group">
        <button id="bbcode-btn-parse" class="bbcode-btn bbcode-btn-parse">🔍 Analisar BBCode</button>
        <button id="bbcode-btn-cancel" class="bbcode-btn bbcode-btn-cancel">❌ Cancelar</button>
      </div>

      <div id="bbcode-preview" class="bbcode-preview">
        <h3 style="margin: 0 0 15px 0; color: #8B4513;">
          📊 Preview dos Agendamentos 
          <span id="format-badge" class="bbcode-format-badge" style="display: none;"></span>
        </h3>
        
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

    // Estado
    let parsedAgendamentos = [];
    let detectedFormat = '';

    // Event listeners
    const inputTextarea = document.getElementById('bbcode-input');
    const previewDiv = document.getElementById('bbcode-preview');
    const previewContent = document.getElementById('bbcode-preview-content');
    const statsDiv = document.getElementById('bbcode-stats');
    const formatBadge = document.getElementById('format-badge');
    
    const btnParse = document.getElementById('bbcode-btn-parse');
    const btnImport = document.getElementById('bbcode-btn-import');
    const btnReplace = document.getElementById('bbcode-btn-replace');
    const btnCancel = document.getElementById('bbcode-btn-cancel');

    // Cancelar
    btnCancel.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Analisar BBCode
    btnParse.onclick = () => {
      const bbcode = inputTextarea.value.trim();
      
      if (!bbcode) {
        alert('❌ Cole o BBCode primeiro!');
        return;
      }

      try {
        parsedAgendamentos = importarDeBBCodeUniversal(bbcode);
        
        // Detectar formato para exibir badge
        if (bbcode.includes('[table]') && bbcode.includes('[|]')) {
          detectedFormat = 'table';
          formatBadge.textContent = 'FORMATO TABELA';
          formatBadge.className = 'bbcode-format-badge badge-table';
        } else {
          detectedFormat = 'list';
          formatBadge.textContent = 'FORMATO LISTA';
          formatBadge.className = 'bbcode-format-badge badge-list';
        }
        formatBadge.style.display = 'inline-block';
        
        if (parsedAgendamentos.length === 0) {
          alert('⚠️ Nenhum agendamento válido encontrado no BBCode.\n\nVerifique se o formato está correto.');
          return;
        }

        // Calcular estatísticas
        const now = Date.now();
        const validDates = parsedAgendamentos.filter(a => {
          const t = parseDateTimeToMs(a.datetime);
          return !isNaN(t) && t > now;
        }).length;
        const pastDates = parsedAgendamentos.filter(a => {
          const t = parseDateTimeToMs(a.datetime);
          return !isNaN(t) && t <= now;
        }).length;
        const invalidDates = parsedAgendamentos.filter(a => {
          const t = parseDateTimeToMs(a.datetime);
          return isNaN(t);
        }).length;

        // Mostrar estatísticas
        statsDiv.innerHTML = `
          <div class="bbcode-stat-item">
            <span>📦 Total:</span>
            <span style="color: #2196F3;">${parsedAgendamentos.length}</span>
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
          <div class="bbcode-stat-item">
            <span>📋 Formato:</span>
            <span style="color: #8B4513;">${detectedFormat === 'table' ? 'Tabela' : 'Lista'}</span>
          </div>
        `;

        // Renderizar preview
        previewContent.innerHTML = renderPreview(parsedAgendamentos);
        previewDiv.style.display = 'block';

        console.log('[BBCode Modal] ✅ Analisados', parsedAgendamentos.length, 'agendamentos no formato', detectedFormat);
      } catch (error) {
        console.error('[BBCode Modal] Erro ao analisar:', error);
        alert('❌ Erro ao analisar BBCode:\n' + error.message);
      }
    };

    // Adicionar à lista
    btnImport.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      const existingList = getList();
      const msg = existingList.length > 0 
        ? `Adicionar ${parsedAgendamentos.length} agendamentos à lista existente?\n\nTotal após importação: ${existingList.length + parsedAgendamentos.length}`
        : `Importar ${parsedAgendamentos.length} agendamentos?`;

      if (confirm(msg)) {
        const result = handleImport(parsedAgendamentos, false);
        
        if (result.duplicados > 0) {
          alert(`✅ ${result.novos} agendamento(s) importado(s)!\n⚠️ ${result.duplicados} duplicado(s) ignorado(s).`);
        } else {
          alert(`✅ ${result.novos} agendamento(s) importado(s) com sucesso!`);
        }
        overlay.remove();
      }
    };

    // Substituir tudo
    btnReplace.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      const existingList = getList();
      const msg = existingList.length > 0
        ? `⚠️ ATENÇÃO!\n\nIsso vai REMOVER os ${existingList.length} agendamento(s) existente(s) e substituir por ${parsedAgendamentos.length} novo(s).\n\nContinuar?`
        : `Importar ${parsedAgendamentos.length} agendamentos?`;

      if (confirm(msg)) {
        handleImport(parsedAgendamentos, true);
        alert(`✅ Lista substituída! ${parsedAgendamentos.length} agendamento(s) importado(s).`);
        overlay.remove();
      }
    };

    // Auto-focus no textarea
    setTimeout(() => inputTextarea.focus(), 100);
  }

  // === Expor API global ===
  window.TWS_BBCodeModal = {
    show: showModal
  };

  console.log('[TW Scheduler BBCode Modal] Módulo carregado com sucesso! (v2.4 - Suporte Universal)');
})();
