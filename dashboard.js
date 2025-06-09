(async function() {
  const minhaAldeiaCoord = game_data.village.coord; // Ex: "499|498"
  const [minX, minY] = minhaAldeiaCoord.split('|').map(Number);

  const villRaw = await fetch('/map/village.txt').then(r => r.text());
  const villages = villRaw.trim().split('\n').map(line => {
    const [id, name, x, y, player, points] = line.split(',');
    return {
      id,
      name,
      x: Number(x),
      y: Number(y),
      coord: `${x}|${y}`,
      points: Number(points),
      player
    };
  });

  const groups = [];
  const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
  groupData.result.forEach(g => groups.push({ group_id: g.group_id, group_name: g.name }));

  const html = `
    <style>
      body, html {
        margin: 0; padding: 0; font-family: Arial, sans-serif;
        background: #f5f3ec; color: #333;
      }
      #dashboard {
        display: flex; height: 600px; width: 830px; border: 1px solid #603000;
        box-sizing: border-box;
      }
      #sidebar {
        width: 220px; background: #f4e4bc; border-right: 2px solid #603000;
        display: flex; flex-direction: column;
      }
      #sidebar h2 {
        margin: 10px; font-size: 18px; color: #603000;
      }
      #groupList {
        flex-grow: 1; overflow-y: auto; margin: 0 10px 10px 10px;
        padding-right: 4px;
      }
      #groupList button {
        display: block; width: 100%; margin-bottom: 4px;
        padding: 6px 8px; border: none; background: #f7d56f; color: #603000;
        font-weight: bold; cursor: pointer; text-align: left;
        border-radius: 3px;
        transition: background-color 0.2s;
      }
      #groupList button:hover, #groupList button.active {
        background: #c19b35; color: #fff;
      }
      #main {
        flex-grow: 1; padding: 12px; display: flex; flex-direction: column;
      }
      #cards {
        display: flex; gap: 20px; margin-bottom: 10px;
      }
      .card {
        flex: 1; background: #fff8e1; border: 1px solid #c19b35;
        border-radius: 6px; padding: 10px; text-align: center;
        box-shadow: 1px 1px 4px rgba(0,0,0,0.1);
      }
      .card h3 {
        margin: 0 0 4px 0; font-size: 14px; color: #603000;
      }
      .card p {
        font-size: 20px; font-weight: bold; margin: 0;
      }
      #filters {
        margin-bottom: 10px;
        display: flex; align-items: center; gap: 10px;
      }
      #filters label {
        font-weight: bold; color: #603000;
      }
      #filters select {
        padding: 4px; border: 1px solid #603000; background: #f4e4bc;
        font-weight: bold;
      }
      #villagesTable {
        flex-grow: 1; overflow-y: auto;
      }
      table {
        width: 100%; border-collapse: collapse; font-size: 13px;
      }
      th, td {
        padding: 6px; border: 1px solid #c19b35; text-align: center;
      }
      th {
        background: #f4e4bc; color: #603000;
      }
      td a {
        color: #603000; font-weight: bold;
        text-decoration: none;
      }
      td a:hover {
        text-decoration: underline;
      }
      .progress-bar {
        background: #ddd;
        border-radius: 4px;
        height: 14px;
        position: relative;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 4px 0 0 4px;
        text-align: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        line-height: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background-color: #4caf50;
        transition: width 0.3s ease;
      }
      #actions {
        margin-top: 10px; text-align: right;
      }
      #actions button {
        background: #c19b35; color: white; border: none;
        padding: 6px 12px; border-radius: 4px; cursor: pointer;
        font-weight: bold;
        margin-left: 10px;
        transition: background-color 0.3s;
      }
      #actions button:hover {
        background: #a17d21;
      }
    </style>

    <div id="dashboard">
      <div id="sidebar">
        <h2>Grupos</h2>
        <div id="groupList">
          ${groups.map(g => `<button data-group-id="${g.group_id}">${g.group_name}</button>`).join('')}
        </div>
      </div>

      <div id="main">
        <div id="cards">
          <div class="card"><h3>Total Aldeias</h3><p id="totalVillages">0</p></div>
          <div class="card"><h3>Média de Pontos</h3><p id="avgPoints">0</p></div>
          <div class="card"><h3>Aldeia Mais Próxima</h3><p id="closestVillage">-</p></div>
        </div>

        <div id="filters">
          <label for="orderSelect">Ordenar por:</label>
          <select id="orderSelect">
            <option value="points_desc">Pontos (Maior → Menor)</option>
            <option value="points_asc">Pontos (Menor → Maior)</option>
            <option value="dist_asc">Distância (Mais perto → Longe)</option>
            <option value="dist_desc">Distância (Mais longe → Perto)</option>
          </select>
        </div>

        <div id="villagesTable">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Coordenadas</th>
                <th>Pontos</th>
                <th>Distância</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="villagesBody">
              <tr><td colspan="5">Selecione um grupo na esquerda</td></tr>
            </tbody>
          </table>
        </div>

        <div id="actions">
          <button id="copyCoordsBtn" disabled>📋 Copiar todas as coordenadas</button>
          <button id="goGroupBtn" disabled>➡️ Ir para grupo no mapa</button>
        </div>
      </div>
    </div>
  `;

  Dialog.show("tw_group_dashboard", html);

  const groupListButtons = document.querySelectorAll("#groupList button");
  const villagesBody = document.getElementById("villagesBody");
  const totalVillagesElem = document.getElementById("totalVillages");
  const avgPointsElem = document.getElementById("avgPoints");
  const closestVillageElem = document.getElementById("closestVillage");
  const orderSelect = document.getElementById("orderSelect");
  const copyCoordsBtn = document.getElementById("copyCoordsBtn");
  const goGroupBtn = document.getElementById("goGroupBtn");

  let currentGroupId = null;
  let currentVillages = [];

  function calcDist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
  }

  function renderVillages() {
    if (!currentVillages.length) {
      villagesBody.innerHTML = `<tr><td colspan="5"><i>Nenhuma aldeia no grupo.</i></td></tr>`;
      totalVillagesElem.textContent = '0';
      avgPointsElem.textContent = '0';
      closestVillageElem.textContent = '-';
      copyCoordsBtn.disabled = true;
      goGroupBtn.disabled = true;
      return;
    }

    const order = orderSelect.value;
    const sorted = [...currentVillages];
    if (order === 'points_desc') sorted.sort((a,b) => b.points - a.points);
    else if (order === 'points_asc') sorted.sort((a,b) => a.points - b.points);
    else if (order === 'dist_asc') sorted.sort((a,b) => a.dist - b.dist);
    else if (order === 'dist_desc') sorted.sort((a,b) => b.dist - a.dist);

    totalVillagesElem.textContent = sorted.length;
    const avgPoints = Math.round(sorted.reduce((sum,v) => sum + v.points, 0) / sorted.length);
    avgPointsElem.textContent = avgPoints;

    const closest = sorted.reduce((minV, v) => v.dist < minV.dist ? v : minV, sorted[0]);
    closestVillageElem.textContent = `${closest.name} (${closest.coord})`;

    const maxPoints = Math.max(...sorted.map(v => v.points));
    villagesBody.innerHTML = sorted.map(v => {
      const pct = maxPoints ? Math.round((v.points / maxPoints) * 100) : 0;
      return `<tr>
        <td><a href="/game.php?village=${v.id}&screen=overview">${v.name}</a></td>
        <td>${v.coord}</td>
        <td>
          <div class="progress-bar" title="${v.points} pontos">
            <div class="progress-fill" style="width:${pct}%; background-color:#4caf50;">
              ${v.points}
            </div>
          </div>
        </td>
        <td>${v.dist.toFixed(2)}</td>
        <td>
          <button class="copyCoordBtn" data-coord="${v.coord}">📋</button>
        </td>
      </tr>`;
    }).join('');

    // Ativar botões
    copyCoordsBtn.disabled = false;
    goGroupBtn.disabled = false;

    // Bind copiar coordenada individual
    document.querySelectorAll('.copyCoordBtn').forEach(btn => {
      btn.onclick = () => {
        navigator.clipboard.writeText(btn.dataset.coord).then(() => {
          UI.InfoMessage(`Coordenada ${btn.dataset.coord} copiada!`, 2000, 'success');
        });
      };
    });
  }

  function loadGroup(groupId) {
    currentGroupId = groupId;
    const groupVillages = villages.filter(v => v.player === groupId || v.player == groupId); // Ajuste pode ser necessário se 'player' é ID ou nome
    // Como não temos os grupos diretos vinculados no village.txt, vou pegar aldeias no grupo via AJAX:

    // Ajuste: Vamos carregar as aldeias do grupo via ajax:
    $.get(`/game.php?screen=overview_villages&mode=prod&group=${groupId}&ajax=fetch_villages`, data => {
      if (data.result && data.result.villages) {
        currentVillages = data.result.villages.map(v => ({
          id: v.id,
          name: v.name,
          coord: v.coord,
          points: v.points,
          x: Number(v.coord.split('|')[0]),
          y: Number(v.coord.split('|')[1]),
          dist: calcDist(minX, minY, Number(v.coord.split('|')[0]), Number(v.coord.split('|')[1]))
        }));
        renderVillages();
      } else {
        villagesBody.innerHTML = `<tr><td colspan="5"><i>Erro ao carregar aldeias do grupo.</i></td></tr>`;
      }
    });
  }

  groupListButtons.forEach(btn => {
    btn.onclick = () => {
      groupListButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadGroup(btn.dataset.groupId);
    };
  });

  orderSelect.onchange = () => {
    if (currentVillages.length) renderVillages();
  };

  copyCoordsBtn.onclick = () => {
    const coords = currentVillages.map(v => v.coord).join('\n');
    navigator.clipboard.writeText(coords).then(() => {
      UI.InfoMessage('Coordenadas copiadas para a área de transferência!', 2500, 'success');
    });
  };

  goGroupBtn.onclick = () => {
    if (!currentGroupId) return;
    // Ativando grupo no jogo
    $.post('/game.php?screen=groups&mode=overview&ajax=select_group', { group_id: currentGroupId }, () => {
      UI.InfoMessage('Grupo selecionado no jogo!');
    });
  };

})();
