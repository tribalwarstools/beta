(function () {
  'use strict';

  if (!window.TWS_Backend) {
    console.error('[TW Scheduler BBCode Modal] Backend não carregado!');
    return;
  }

  const {
    getList,
    setList,
    parseDateTimeToMs,
    generateUniqueId
  } = window.TWS_Backend;

  // ============================================
  // ⚙️ MÓDULO DE CÁLCULOS
  // ============================================
  const CalculosUtilitarios = {
    velocidadesUnidades: {
      spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
      light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
      knight: 10, snob: 35
    },

    unidadesPorVelocidade: [
      'snob', 'catapult', 'ram', 'sword', 'spear', 'archer', 'axe',
      'heavy', 'light', 'marcher', 'knight', 'spy'
    ],

    getUnidadeMaisLenta(tropas) {
      for (const unidade of this.unidadesPorVelocidade) {
        if (tropas[unidade] > 0) return unidade;
      }
      return null;
    },

    validarCoordenada(coord) {
      const coordSanitizada = coord.replace(/\s+/g, '');
      return /^\d{1,4}\|\d{1,4}$/.test(coordSanitizada);
    },

    sanitizarCoordenada(coord) {
      const coordSanitizada = coord.replace(/\s+/g, '');
      if (!this.validarCoordenada(coordSanitizada)) {
        throw new Error(`Coordenada inválida: ${coord}`);
      }
      const [x, y] = coordSanitizada.split('|').map(Number);
      if (x < 0 || x > 499 || y < 0 || y > 499) {
        throw new Error(`Coordenada fora do mapa: ${coordSanitizada}`);
      }
      return coordSanitizada;
    },

    validarDataHora(dataHoraStr) {
      return /^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2}$/.test(dataHoraStr);
    },

    parseDataHora(dataHoraStr) {
      if (!this.validarDataHora(dataHoraStr)) {
        throw new Error(`Formato de data inválido: ${dataHoraStr}`);
      }
      const [data, tempo] = dataHoraStr.split(' ');
      const [dia, mes, ano] = data.split('/').map(Number);
      const [hora, minuto, segundo] = tempo.split(':').map(Number);
      const date = new Date(ano, mes - 1, dia, hora, minuto, segundo);
      if (isNaN(date.getTime())) {
        throw new Error(`Data inválida: ${dataHoraStr}`);
      }
      return date;
    },

    formatarDataHora(date) {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const hora = String(date.getHours()).padStart(2, '0');
      const minuto = String(date.getMinutes()).padStart(2, '0');
      const segundo = String(date.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    },

    calcularDistancia(coord1, coord2) {
      const [x1, y1] = coord1.split('|').map(Number);
      const [x2, y2] = coord2.split('|').map(Number);
      const deltaX = Math.abs(x1 - x2);
      const deltaY = Math.abs(y1 - y2);
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    },

    calcularTempoViagem(origem, destino, unidadeMaisLenta, bonusSinal = 0) {
      const distancia = this.calcularDistancia(origem, destino);
      const velocidadeBase = this.velocidadesUnidades[unidadeMaisLenta];
      const fatorBonus = 1 + (bonusSinal / 100);
      const tempoMinutos = (distancia * velocidadeBase) / fatorBonus;
      return tempoMinutos * 60000;
    },

    calcularHorarioLancamento(origem, destino, horaChegada, tropas, bonusSinal = 0) {
      const unidadeMaisLenta = this.getUnidadeMaisLenta(tropas);
      const tempoViagem = this.calcularTempoViagem(origem, destino, unidadeMaisLenta, bonusSinal);
      const chegadaDate = this.parseDataHora(horaChegada);
      const lancamentoDate = new Date(chegadaDate.getTime() - tempoViagem);
      return this.formatarDataHora(lancamentoDate);
    },

    calcularHorarioChegada(origem, destino, horaLancamento, tropas, bonusSinal = 0) {
      const unidadeMaisLenta = this.getUnidadeMaisLenta(tropas);
      const tempoViagem = this.calcularTempoViagem(origem, destino, unidadeMaisLenta, bonusSinal);
      const lancamentoDate = this.parseDataHora(horaLancamento);
      const chegadaDate = new Date(lancamentoDate.getTime() + tempoViagem);
      return this.formatarDataHora(chegadaDate);
    }
  };

  function parseCoordValidate(s) {
    if (!s) return null;
    try {
      return CalculosUtilitarios.sanitizarCoordenada(s);
    } catch {
      return null;
    }
  }

  function extractCoordinatesFromLine(text) {
    if (!text) return [];
    const coordPattern = /\b(\d{1,4})\|(\d{1,4})\b/g;
    const coords = [];
    let match;
    while ((match = coordPattern.exec(text)) !== null) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      if (x >= 0 && x <= 499 && y >= 0 && y <= 499) {
        coords.push(`${x}|${y}`);
      }
    }
    return coords;
  }

  function parseBBCodeRobust(bbcode) {
    if (!bbcode || typeof bbcode !== 'string') {
      return [];
    }
    const agendamentos = [];
    const linhas = bbcode.split('[*]').filter(l => l.trim() !== '');
    
    for (const linha of linhas) {
      try {
        const coords = extractCoordinatesFromLine(linha);
        if (coords.length < 2) continue;
        
        const origem = coords[0];
        const destino = coords[1];
        
        const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/;
        const dateMatch = linha.match(datePattern);
        if (!dateMatch) continue;
        
        const dataHora = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]} ${dateMatch[4].padStart(2, '0')}:${dateMatch[5].padStart(2, '0')}:${dateMatch[6].padStart(2, '0')}`;
        
        if (!CalculosUtilitarios.validarDataHora(dataHora)) continue;
        
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
                } catch (e) {}
              }
            });
          }
        }
        
        const cfg = {
          _id: generateUniqueId(),
          origem,
          origemId: params.village || null,
          alvo: destino,
          datetime: dataHora,
          done: false,
          locked: false
        };
        
        const troopTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
        troopTypes.forEach(unit => {
          const key = `att_${unit}`;
          const value = params[key] ? parseInt(params[key], 10) : 0;
          cfg[unit] = isNaN(value) ? 0 : value;
        });
        
        agendamentos.push(cfg);
        console.log(`[BBCode] ✅ Parseado: ${origem} → ${destino}`);
        
      } catch (error) {
        console.error(`[BBCode] ❌ Erro: ${error.message}`);
        continue;
      }
    }
    
    return agendamentos;
  }

  function renderPreview(agendamentos) {
    if (agendamentos.length === 0) {
      return '<p style="text-align:center;color:#888;padding:20px;">Nenhum agendamento detectado</p>';
    }

    const now = Date.now();
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    html += '<table style="width:100%; border-collapse: collapse; font-size:12px;">';
    html += `<thead style="position: sticky; top: 0; background: #8B4513; color: white;">
      <tr>
        <th style="padding:8px; border:1px solid #654321;">#</th>
        <th style="padding:8px; border:1px solid #654321;">Origem</th>
        <th style="padding:8px; border:1px solid #654321;">Destino</th>
        <th style="padding:8px; border:1px solid #654321;">Data/Hora</th>
        <th style="padding:8px; border:1px solid #654321;">Status</th>
      </tr>
    </thead><tbody>`;

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

      const origemValida = parseCoordValidate(cfg.origem) !== null;
      const destValida = parseCoordValidate(cfg.alvo) !== null;
      
      if (!origemValida || !destValida) {
        status = '❌ Coord Inválida';
        statusColor = '#FFEBEE';
      }

      html += `<tr style="background: ${statusColor};">
        <td style="padding:6px; border:1px solid #ddd; text-align:center;">${idx + 1}</td>
        <td style="padding:6px; border:1px solid #ddd;">${cfg.origem || '❌'}</td>
        <td style="padding:6px; border:1px solid #ddd;">${cfg.alvo || '❌'}</td>
        <td style="padding:6px; border:1px solid #ddd; font-size:11px;">${cfg.datetime || '❌'}</td>
        <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:11px;">${status}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    return html;
  }

  function handleImport(agendamentos, replaceAll) {
    const list = getList();
    
    if (replaceAll) {
      setList(agendamentos);
      console.log('[BBCode Modal] ✅ Lista substituída');
      window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
      return { novos: agendamentos.length, duplicados: 0 };
    } else {
      const existingKeys = new Set(
        list.map(a => `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`)
      );
      
      const novos = agendamentos.filter(a => {
        const key = `${a.origemId || a.origem}_${a.alvo}_${a.datetime}`;
        return !existingKeys.has(key);
      });
      
      const duplicados = agendamentos.length - novos.length;
      list.push(...novos);
      setList(list);
      
      window.dispatchEvent(new CustomEvent('tws-schedule-updated'));
      return { novos: novos.length, duplicados };
    }
  }

  // Carrega village.txt
  let villageMap = {};
  fetch('/map/village.txt')
    .then(res => res.text())
    .then(text => {
      const lines = text.trim().split('\n');
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 6) {
          const x = parts[2], y = parts[3], id = parts[0];
          villageMap[`${x}|${y}`] = id;
        }
      }
      console.log(`[TW Scheduler] ${Object.keys(villageMap).length} aldeias carregadas`);
    })
    .catch(err => console.error('[TW Scheduler] Erro ao carregar villages:', err));

  const unitImages = {
    spear: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_spear.webp',
    sword: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_sword.webp',
    axe: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_axe.webp',
    archer: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_archer.webp',
    spy: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_spy.webp',
    light: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_light.webp',
    marcher: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_marcher.webp',
    heavy: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_heavy.webp',
    ram: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_ram.webp',
    catapult: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_catapult.webp',
    knight: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_knight.webp',
    snob: 'https://dsbr.innogamescdn.com/asset/4aba6bcf/graphic/unit/unit_snob.webp'
  };

  // === Cria modal com abas ===
  function showModal() {
    const existing = document.getElementById('tws-bbcode-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tws-bbcode-modal';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 999999; display: flex; justify-content: center; align-items: center;`;

    const modal = document.createElement('div');
    modal.style.cssText = `background: #F4E4C1; border: 3px solid #8B4513; border-radius: 8px; padding: 20px; width: 90%; max-width: 900px; max-height: 85vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);`;

    modal.innerHTML = `
      <style>
        .tws-tabs { display: flex; gap: 5px; margin-bottom: 15px; border-bottom: 2px solid #8B4513; }
        .tws-tab-btn { padding: 8px 15px; background: #DEB887; border: none; cursor: pointer; font-weight: bold; color: #333; border-radius: 4px 4px 0 0; transition: 0.2s; }
        .tws-tab-btn.active { background: #8B4513; color: white; }
        .tws-tab-btn:hover:not(.active) { background: #CD853F; }
        .tws-tab-content { display: none; }
        .tws-tab-content.active { display: block; }
        .bbcode-textarea, .tws-input { width: 100%; padding: 8px; border: 2px solid #8B4513; border-radius: 4px; font-size: 12px; background: white; color: #333; box-sizing: border-box; }
        .bbcode-textarea { min-height: 120px; font-family: monospace; resize: vertical; }
        .tws-input { margin-bottom: 8px; }
        .tws-btn-group { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
        .tws-btn { flex: 1; min-width: 80px; padding: 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .tws-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .tws-btn-primary { background: #27ae60; color: white; }
        .tws-btn-secondary { background: #2196F3; color: white; }
        .tws-btn-danger { background: #e74c3c; color: white; }
        .tws-btn-warning { background: #FF9800; color: white; }
        .tws-btn-neutral { background: #95a5a6; color: white; }
        .tws-tropas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
        .tws-tropa-item { display: flex; align-items: center; gap: 6px; }
        .tws-tropa-item img { width: 20px; height: 20px; flex-shrink: 0; }
        .tws-tropa-item label { min-width: 70px; font-size: 11px; }
        .tws-tropa-item input { width: 60px; padding: 4px; font-size: 11px; }
        .tws-info { background: #E3F2FD; border: 1px solid #2196F3; border-radius: 4px; padding: 10px; margin-bottom: 12px; font-size: 12px; line-height: 1.5; }
        .tws-preview { background: white; border: 2px solid #8B4513; border-radius: 4px; padding: 12px; max-height: 350px; overflow-y: auto; }
      </style>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #8B4513;">🎯 Coordenador de Ataques</h2>
        <button id="tws-fechar" style="background: #e74c3c; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer;">✕</button>
      </div>

      <div class="tws-tabs">
        <button class="tws-tab-btn active" data-tab="plano">📋 Plano de Envio</button>
        <button class="tws-tab-btn" data-tab="bbcode">🔄 Importar BBCode</button>
      </div>

      <!-- ABA 1: PLANO DE ENVIO -->
      <div id="plano" class="tws-tab-content active">
        <div class="tws-info">
          <strong>📝 Como usar:</strong><br>1️⃣ Destino(s) e origem(ns) | 2️⃣ Configure tropas | 3️⃣ Horário | 4️⃣ Gerar BBCode
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div><label>🎯 Destino(s):</label><input id="tws-destinos" class="tws-input" placeholder="559|452 560|453"></div>
          <div><label>🏠 Origem(ns):</label><input id="tws-origens" class="tws-input" placeholder="542|433 544|432"></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div><label>🎯 Tipo de Cálculo:</label><select id="tws-tipoCalculo" class="tws-input"><option value="chegada">Por Hora de Chegada</option><option value="lancamento">Por Hora de Lançamento</option></select></div>
          <div><label>📈 Sinal (%):</label><input id="tws-bonusSinal" type="number" class="tws-input" value="0" min="0" max="100"></div>
        </div>

        <div style="margin-bottom: 12px;">
          <label>🔀 Ordenação:</label>
          <select id="tws-tipoOrdenacao" class="tws-input">
            <option value="digitacao">Por Ordem de Digitação</option>
            <option value="lancamento">Por Horário de Lançamento</option>
            <option value="chegada">Por Horário de Chegada</option>
            <option value="distancia">Por Distância</option>
          </select>
        </div>

        <div style="margin-bottom: 12px;">
          <label><input type="checkbox" id="tws-incrementarSegundos"> ⏱️ Incrementar <input type="number" id="tws-incrementoValor" value="5" min="1" max="60" style="width: 50px; margin: 0 6px; padding: 2px;"> segundos por ataque</label>
        </div>

        <div id="tws-campoHoraChegada" style="margin-bottom: 12px;">
          <label>⏰ Hora de Chegada:</label>
          <input id="tws-horaChegada" class="tws-input" placeholder="15/11/2025 18:30:00">
        </div>
        <div id="tws-campoHoraLancamento" style="display: none; margin-bottom: 12px;">
          <label>🚀 Hora de Lançamento:</label>
          <input id="tws-horaLancamento" class="tws-input" placeholder="15/11/2025 17:45:00">
        </div>

        <label style="font-weight: bold; display: block; margin-bottom: 8px;">⚔️ Tropas:</label>
        <div class="tws-tropas-grid">
          <div class="tws-tropa-item"><img src="${unitImages.spear}" onerror="this.style.display='none'"><label>Lança:</label><input type="number" id="tws-spear" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.sword}" onerror="this.style.display='none'"><label>Espada:</label><input type="number" id="tws-sword" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.axe}" onerror="this.style.display='none'"><label>Machado:</label><input type="number" id="tws-axe" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.archer}" onerror="this.style.display='none'"><label>Arqueiro:</label><input type="number" id="tws-archer" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.spy}" onerror="this.style.display='none'"><label>Espião:</label><input type="number" id="tws-spy" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.light}" onerror="this.style.display='none'"><label>Cav. Leve:</label><input type="number" id="tws-light" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.marcher}" onerror="this.style.display='none'"><label>Arq. Cav.:</label><input type="number" id="tws-marcher" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.heavy}" onerror="this.style.display='none'"><label>Cav. Pes.:</label><input type="number" id="tws-heavy" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.ram}" onerror="this.style.display='none'"><label>Ariete:</label><input type="number" id="tws-ram" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.catapult}" onerror="this.style.display='none'"><label>Catapulta:</label><input type="number" id="tws-catapult" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.knight}" onerror="this.style.display='none'"><label>Paladino:</label><input type="number" id="tws-knight" value="0" min="0"></div>
          <div class="tws-tropa-item"><img src="${unitImages.snob}" onerror="this.style.display='none'"><label>Nobre:</label><input type="number" id="tws-snob" value="0" min="0"></div>
        </div>

        <div class="tws-btn-group">
          <button id="tws-limparTropas" class="tws-btn tws-btn-neutral">🗑️ Limpar</button>
          <button id="tws-ataque" class="tws-btn tws-btn-danger">⚔️ Ataque</button>
          <button id="tws-defesa" class="tws-btn tws-btn-secondary">🛡️ Defesa</button>
          <button id="tws-nobre" class="tws-btn tws-btn-warning">👑 Nobre</button>
        </div>

        <div class="tws-btn-group">
          <button id="tws-gerar" class="tws-btn tws-btn-primary" style="flex: 2;">📋 Gerar BBCode</button>
          <button id="tws-copiarResult" class="tws-btn tws-btn-secondary">📄 Copiar</button>
          <button id="tws-salvarConfig" class="tws-btn tws-btn-warning">💾 Salvar</button>
        </div>

        <label style="font-weight: bold; display: block; margin-bottom: 8px;">📊 Resultado:</label>
        <textarea id="tws-resultado" class="bbcode-textarea" style="height: 120px;"></textarea>
      </div>

      <!-- ABA 2: IMPORTAR BBCODE -->
      <div id="bbcode" class="tws-tab-content">
        <div class="tws-info">
          <strong>📝 Como usar:</strong><br>1️⃣ Cole o BBCode | 2️⃣ Analisar | 3️⃣ Adicionar ou Substituir
        </div>

        <textarea id="tws-bbcode-input" class="bbcode-textarea" placeholder="Cole seu BBCode aqui..."></textarea>

        <div class="tws-btn-group">
          <button id="tws-btn-parse" class="tws-btn tws-btn-secondary">🔍 Analisar BBCode</button>
          <button id="tws-btn-cancelar" class="tws-btn tws-btn-neutral">❌ Cancelar</button>
        </div>

        <div id="tws-preview" class="tws-preview" style="display: none;">
          <h4 style="margin: 0 0 12px 0; color: #8B4513;">📊 Preview dos Agendamentos</h4>
          <div id="tws-stats"></div>
          <div id="tws-preview-content"></div>

          <div class="tws-btn-group" style="margin-top: 12px;">
            <button id="tws-btn-import" class="tws-btn tws-btn-primary">✅ Adicionar à Lista</button>
            <button id="tws-btn-replace" class="tws-btn tws-btn-warning">🔄 Substituir Tudo</button>
          </div>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // === SISTEMA DE ABAS ===
    const tabs = document.querySelectorAll('.tws-tab-btn');
    const tabContents = document.querySelectorAll('.tws-tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });

    // === FECHAR MODAL ===
    document.getElementById('tws-fechar').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // === FUNÇÕES AUXILIARES ===
    function getTropas() {
      return {
        spear: parseInt(document.getElementById('tws-spear').value) || 0,
        sword: parseInt(document.getElementById('tws-sword').value) || 0,
        axe: parseInt(document.getElementById('tws-axe').value) || 0,
        archer: parseInt(document.getElementById('tws-archer').value) || 0,
        spy: parseInt(document.getElementById('tws-spy').value) || 0,
        light: parseInt(document.getElementById('tws-light').value) || 0,
        marcher: parseInt(document.getElementById('tws-marcher').value) || 0,
        heavy: parseInt(document.getElementById('tws-heavy').value) || 0,
        ram: parseInt(document.getElementById('tws-ram').value) || 0,
        catapult: parseInt(document.getElementById('tws-catapult').value) || 0,
        knight: parseInt(document.getElementById('tws-knight').value) || 0,
        snob: parseInt(document.getElementById('tws-snob').value) || 0
      };
    }

    function mostrarMensagem(mensagem, cor) {
      const alertDiv = document.createElement('div');
      alertDiv.innerHTML = mensagem;
      Object.assign(alertDiv.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: cor,
        color: 'white',
        padding: '12px 20px',
        borderRadius: '6px',
        fontWeight: '600',
        zIndex: 1000000,
        fontSize: '13px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      });
      document.body.appendChild(alertDiv);
      setTimeout(() => alertDiv.remove(), 1500);
    }

    function carregarConfiguracoes() {
      try {
        const configSalva = localStorage.getItem('twPanelConfig');
        if (configSalva) {
          const config = JSON.parse(configSalva);
          if (config.destinos) document.getElementById('tws-destinos').value = config.destinos;
          if (config.origens) document.getElementById('tws-origens').value = config.origens;
          if (config.tipoCalculo) document.getElementById('tws-tipoCalculo').value = config.tipoCalculo;
          if (config.bonusSinal) document.getElementById('tws-bonusSinal').value = config.bonusSinal;
          if (config.tipoOrdenacao) document.getElementById('tws-tipoOrdenacao').value = config.tipoOrdenacao;
          if (config.horaChegada) document.getElementById('tws-horaChegada').value = config.horaChegada;
          if (config.horaLancamento) document.getElementById('tws-horaLancamento').value = config.horaLancamento;
          if (config.incrementarSegundos !== undefined) document.getElementById('tws-incrementarSegundos').checked = config.incrementarSegundos;
          if (config.incrementoValor) document.getElementById('tws-incrementoValor').value = config.incrementoValor;
          if (config.tropas) {
            for (const [unidade, quantidade] of Object.entries(config.tropas)) {
              const input = document.getElementById(`tws-${unidade}`);
              if (input) input.value = quantidade;
            }
          }
          document.getElementById('tws-tipoCalculo').dispatchEvent(new Event('change'));
        }
      } catch (error) {
        console.error('Erro ao carregar config:', error);
      }
    }

    // === ALTERNAR TIPO DE CÁLCULO ===
    document.getElementById('tws-tipoCalculo').onchange = function() {
      const tipo = this.value;
      const campoChegada = document.getElementById('tws-campoHoraChegada');
      const campoLancamento = document.getElementById('tws-campoHoraLancamento');
      if (tipo === 'chegada') {
        campoChegada.style.display = 'block';
        campoLancamento.style.display = 'none';
      } else {
        campoChegada.style.display = 'none';
        campoLancamento.style.display = 'block';
      }
    };

    // === BOTÕES DE TROPAS PRÉ-CONFIGURADAS ===
    document.getElementById('tws-limparTropas').onclick = () => {
      document.querySelectorAll('input[id^="tws-"][type="number"]').forEach(input => input.value = '0');
    };

    document.getElementById('tws-ataque').onclick = () => {
      document.getElementById('tws-spy').value = '5';
      document.getElementById('tws-light').value = '3000';
      document.getElementById('tws-marcher').value = '6000';
      document.getElementById('tws-ram').value = '300';
    };

    document.getElementById('tws-defesa').onclick = () => {
      document.getElementById('tws-spear').value = '1000';
      document.getElementById('tws-sword').value = '1000';
    };

    document.getElementById('tws-nobre').onclick = () => {
      document.getElementById('tws-spy').value = '5';
      document.getElementById('tws-light').value = '25';
      document.getElementById('tws-snob').value = '1';
    };

    // === GERAR BBCODE ===
    document.getElementById('tws-gerar').onclick = () => {
      try {
        const destinosRaw = document.getElementById('tws-destinos').value.trim();
        if (!destinosRaw) {
          mostrarMensagem('❌ Informe pelo menos um destino!', '#e74c3c');
          return;
        }

        const destinos = destinosRaw.split(/\s+/).map(coord => {
          try {
            return CalculosUtilitarios.sanitizarCoordenada(coord);
          } catch (e) {
            return null;
          }
        }).filter(c => c !== null);

        const origensRaw = document.getElementById('tws-origens').value.trim();
        if (!origensRaw) {
          mostrarMensagem('❌ Informe pelo menos uma origem!', '#e74c3c');
          return;
        }

        const origens = origensRaw.split(/\s+/).map(coord => {
          try {
            return CalculosUtilitarios.sanitizarCoordenada(coord);
          } catch (e) {
            return null;
          }
        }).filter(c => c !== null);

        const tipoCalculo = document.getElementById('tws-tipoCalculo').value;
        const tipoOrdenacao = document.getElementById('tws-tipoOrdenacao').value;
        const bonusSinal = parseInt(document.getElementById('tws-bonusSinal').value) || 0;
        const incrementarSegundos = document.getElementById('tws-incrementarSegundos').checked;
        const tropas = getTropas();

        const unidadeMaisLenta = CalculosUtilitarios.getUnidadeMaisLenta(tropas);
        if (!unidadeMaisLenta) {
          mostrarMensagem('❌ Selecione pelo menos uma tropa!', '#e74c3c');
          return;
        }

        let horaBase;
        if (tipoCalculo === 'chegada') {
          horaBase = document.getElementById('tws-horaChegada').value.trim();
          if (!horaBase) {
            mostrarMensagem('❌ Informe a hora de chegada!', '#e74c3c');
            return;
          }
        } else {
          horaBase = document.getElementById('tws-horaLancamento').value.trim();
          if (!horaBase) {
            mostrarMensagem('❌ Informe a hora de lançamento!', '#e74c3c');
            return;
          }
        }

        if (!CalculosUtilitarios.validarDataHora(horaBase)) {
          mostrarMensagem('❌ Formato inválido! Use: DD/MM/AAAA HH:MM:SS', '#e74c3c');
          return;
        }

        const combinacoes = [];
        const coordenadasNaoEncontradas = [];

        for (const o of origens) {
          const vid = villageMap[o];
          if (!vid) {
            coordenadasNaoEncontradas.push(o);
            continue;
          }

          for (const d of destinos) {
            const [x, y] = d.split('|');

            let horaLancamento, horaChegada;

            if (tipoCalculo === 'chegada') {
              horaLancamento = CalculosUtilitarios.calcularHorarioLancamento(o, d, horaBase, tropas, bonusSinal);
              horaChegada = horaBase;
            } else {
              horaLancamento = horaBase;
              horaChegada = CalculosUtilitarios.calcularHorarioChegada(o, d, horaBase, tropas, bonusSinal);
            }

            const distancia = CalculosUtilitarios.calcularDistancia(o, d);

            combinacoes.push({
              origem: o,
              destino: d,
              horaLancamento: horaLancamento,
              horaChegada: horaChegada,
              distancia: distancia,
              timestampLancamento: CalculosUtilitarios.parseDataHora(horaLancamento).getTime(),
              timestampChegada: CalculosUtilitarios.parseDataHora(horaChegada).getTime(),
              vid: vid,
              x: x,
              y: y
            });
          }
        }

        if (coordenadasNaoEncontradas.length > 0) {
          console.warn('Coordenadas não encontradas:', coordenadasNaoEncontradas.join(', '));
          mostrarMensagem(`⚠️ ${coordenadasNaoEncontradas.length} coordenada(s) não encontrada(s)`, '#f39c12');
        }

        if (combinacoes.length === 0) {
          mostrarMensagem('❌ Nenhuma combinação válida!', '#e74c3c');
          return;
        }

        // Ordenar
        switch(tipoOrdenacao) {
          case 'lancamento':
            combinacoes.sort((a, b) => a.timestampLancamento - b.timestampLancamento);
            break;
          case 'chegada':
            combinacoes.sort((a, b) => a.timestampChegada - b.timestampChegada);
            break;
          case 'distancia':
            combinacoes.sort((a, b) => a.distancia - b.distancia);
            break;
        }

        // Incrementar segundos
        if (incrementarSegundos) {
          const incrementoValor = parseInt(document.getElementById('tws-incrementoValor').value) || 5;
          let segundoIncremento = 0;
          combinacoes.forEach((comb, index) => {
            if (index > 0) {
              segundoIncremento += incrementoValor;
              const lancamentoDate = CalculosUtilitarios.parseDataHora(comb.horaLancamento);
              const chegadaDate = CalculosUtilitarios.parseDataHora(comb.horaChegada);
              lancamentoDate.setSeconds(lancamentoDate.getSeconds() + segundoIncremento);
              chegadaDate.setSeconds(chegadaDate.getSeconds() + segundoIncremento);
              comb.horaLancamento = CalculosUtilitarios.formatarDataHora(lancamentoDate);
              comb.horaChegada = CalculosUtilitarios.formatarDataHora(chegadaDate);
            }
          });
        }

        let out = `[table][**]Unidade[||]Origem[||]Destino[||]Lançamento[||]Chegada[||]Enviar[/**]\n`;

        combinacoes.forEach((comb) => {
          let qs = Object.entries(tropas).map(([k,v])=>`att_${k}=${v}`).join('&');
          const link = `https://${location.host}/game.php?village=${comb.vid}&screen=place&x=${comb.x}&y=${comb.y}&from=simulator&${qs}`;
          out += `[*][unit]${unidadeMaisLenta}[/unit] [|] ${comb.origem} [|] ${comb.destino} [|] ${comb.horaLancamento} [|] ${comb.horaChegada} [|] [url=${link}]ENVIAR[/url]\n`;
        });

        out += `[/table]`;
        document.getElementById('tws-resultado').value = out;
        mostrarMensagem(`✅ ${combinacoes.length} ataque(s) gerado(s)!`, '#27ae60');

      } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem(`❌ Erro: ${error.message}`, '#e74c3c');
      }
    };

    // === COPIAR RESULTADO ===
    document.getElementById('tws-copiarResult').onclick = () => {
      const resultado = document.getElementById('tws-resultado');
      if (resultado.value.trim() === '') {
        mostrarMensagem('❌ Nenhum BBCode para copiar!', '#e74c3c');
        return;
      }
      resultado.select();
      navigator.clipboard.writeText(resultado.value).then(() => {
        mostrarMensagem('✅ BBCode copiado!', '#27ae60');
      }).catch(() => {
        document.execCommand('copy');
        mostrarMensagem('✅ BBCode copiado!', '#27ae60');
      });
    };

    // === SALVAR CONFIGURAÇÃO ===
    document.getElementById('tws-salvarConfig').onclick = () => {
      const config = {
        destinos: document.getElementById('tws-destinos').value,
        origens: document.getElementById('tws-origens').value,
        tipoCalculo: document.getElementById('tws-tipoCalculo').value,
        bonusSinal: document.getElementById('tws-bonusSinal').value,
        tipoOrdenacao: document.getElementById('tws-tipoOrdenacao').value,
        horaChegada: document.getElementById('tws-horaChegada').value,
        horaLancamento: document.getElementById('tws-horaLancamento').value,
        incrementarSegundos: document.getElementById('tws-incrementarSegundos').checked,
        incrementoValor: document.getElementById('tws-incrementoValor').value,
        tropas: getTropas()
      };
      try {
        localStorage.setItem('twPanelConfig', JSON.stringify(config));
        mostrarMensagem('✅ Configurações salvas!', '#8e44ad');
      } catch (error) {
        mostrarMensagem('❌ Erro ao salvar!', '#e74c3c');
      }
    };

    // === BBCODE IMPORT ===
    let parsedAgendamentos = [];
    const btnParse = document.getElementById('tws-btn-parse');
    const btnImport = document.getElementById('tws-btn-import');
    const btnReplace = document.getElementById('tws-btn-replace');
    const btnCancelar = document.getElementById('tws-btn-cancelar');
    const inputBBCode = document.getElementById('tws-bbcode-input');
    const preview = document.getElementById('tws-preview');
    const previewContent = document.getElementById('tws-preview-content');
    const statsDiv = document.getElementById('tws-stats');

    btnCancelar.onclick = () => overlay.remove();

    btnParse.onclick = () => {
      const bbcode = inputBBCode.value.trim();
      if (!bbcode) {
        alert('❌ Cole o BBCode primeiro!');
        return;
      }

      try {
        parsedAgendamentos = parseBBCodeRobust(bbcode);

        if (parsedAgendamentos.length === 0) {
          alert('⚠️ Nenhum agendamento válido encontrado.');
          return;
        }

        const now = Date.now();
        const validDates = parsedAgendamentos.filter(a => {
          const t = parseDateTimeToMs(a.datetime);
          return !isNaN(t) && t > now;
        }).length;

        statsDiv.innerHTML = `
          <div style="display: flex; gap: 20px; margin-bottom: 10px;">
            <div>📦 Total: <strong>${parsedAgendamentos.length}</strong></div>
            <div>✅ Válidos: <strong style="color: #4CAF50;">${validDates}</strong></div>
          </div>
        `;

        previewContent.innerHTML = renderPreview(parsedAgendamentos);
        preview.style.display = 'block';
      } catch (error) {
        alert('❌ Erro ao analisar BBCode:\n' + error.message);
      }
    };

    btnImport.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      if (confirm(`Adicionar ${parsedAgendamentos.length} agendamentos?`)) {
        const result = handleImport(parsedAgendamentos, false);
        alert(`✅ ${result.novos} importado(s)!`);
        overlay.remove();
      }
    };

    btnReplace.onclick = () => {
      if (parsedAgendamentos.length === 0) {
        alert('❌ Analise o BBCode primeiro!');
        return;
      }

      if (confirm(`Substituir tudo por ${parsedAgendamentos.length} agendamentos?`)) {
        handleImport(parsedAgendamentos, true);
        alert(`✅ ${parsedAgendamentos.length} importado(s)!`);
        overlay.remove();
      }
    };

    carregarConfiguracoes();
    setTimeout(() => document.getElementById('tws-destinos').focus(), 100);
  }

  window.TWS_BBCodeModal = {
    show: showModal,
    CalculosUtilitarios: CalculosUtilitarios
  };

  console.log('[TW Scheduler BBCode Modal] ✅ Carregado!');
})();
