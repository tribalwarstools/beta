(async function () {
  const groups = [];
  const coordToId = {};
  const coordToPoints = {};
  const STORAGE_KEY = "tw_last_selected_group";

 UI.InfoMessage('Iniciando...');

  // Mapeia coordenadas para ID
  const mapData = await $.get("map/village.txt");
  mapData.trim().split("\n").forEach(line => {
    const [id, , x, y] = line.split(",");
    coordToId[`${x}|${y}`] = id;
  });

  // Função para criar a barra de progresso verde
  function criarBarraProgresso(pontos) {
    const max = 13000;
    const perc = Math.min(pontos / max, 1) * 100;
    return `
      <div style="background:#fff; border:1px solid #ccc; width: 90px; height: 18px; border-radius: 5px; overflow: hidden; position: relative;">
        <div style="background: linear-gradient(to right, #b7f2b7, #2c8f2c); width: ${perc}%; height: 100%;"></div>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; line-height: 18px; text-align: center; font-weight: bold; font-size: 12px; color: #000; user-select:none;">
          ${pontos.toLocaleString()}
        </div>
      </div>
    `;
  }

  // Mapeia coordenadas para pontos (na terceira coluna da tabela)
  const prodHtml = await $.get("/game.php?screen=overview_villages&mode=prod");
  const prodDoc = new DOMParser().parseFromString(prodHtml, "text/html");
  const rows = prodDoc.querySelectorAll("table#production_table tbody tr");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    const coordMatch = row.innerText.match(/\d+\|\d+/);
    if (coordMatch && cells.length > 2) {
      const coord = coordMatch[0];
      const pontosTd = cells[2]; // terceira coluna tem a pontuação
      const rawText = pontosTd.textContent.replace(/\./g, "").replace(/,/g, "").trim();
      const points = parseInt(rawText, 10);
      if (!isNaN(points)) {
        coordToPoints[coord] = points;
      }
    }
  });

  // Carrega grupos
  const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
  groupData.result.forEach(g => groups.push({ group_id: g.group_id, group_name: g.name }));

  // Monta painel
  const html = `
    <div class="vis" style="padding: 10px;">
      <h2>Painel de Scripts</h2>
      <button id="abrirRenamer" class="btn btn-confirm-yes" style="margin-bottom:10px;">Renomear aldeias</button>
      <button id="abrirTotalTropas" class="btn btn-confirm-yes" style="margin-bottom:10px;">Contador de tropas</button>
      <button id="abrirGrupo" class="btn btn-confirm-yes" style="margin-bottom:10px;">Importar grupos</button>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <label for="groupSelect"><b>Visualizador de grupo:</b></label>
        <select id="groupSelect" style="padding:4px; background:#f4e4bc; color:#000; border:1px solid #603000; font-weight:bold;"></select>
        <span id="villageCount" style="font-weight: bold;"></span>
        <button id="refreshPoints" class="btn" style="margin-left: auto;">Atualizar pontuação</button>
      </div>
      <hr>
      <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
    </div>
  `;
  Dialog.show("tw_group_viewer", html);
  $("#popup_box_tw_group_viewer").css({ width: "750px", maxWidth: "95vw" });

  const select = document.getElementById("groupSelect");
  const savedGroupId = localStorage.getItem(STORAGE_KEY);
  const placeholder = new Option("Selecione um grupo", "", true, true);
  placeholder.disabled = true;
  select.appendChild(placeholder);

  groups.forEach(g => {
    const opt = new Option(g.group_name, g.group_id, false, g.group_id == savedGroupId);
    if (!g.group_name) opt.disabled = true;
    select.appendChild(opt);
  });

  $("#abrirRenamer").on("click", () => {
    $.getScript("https://tribalwarstools.github.io/twscripts/PainelRenomearAld.js")
      .done(() => setTimeout(() => {
        if (typeof abrirPainelRenomear === "function") abrirPainelRenomear();
        else UI.ErrorMessage("Função abrirPainelRenomear não encontrada.");
      }, 100))
      .fail(() => UI.ErrorMessage("Erro ao carregar o script de renomeação."));
  });

  $("#abrirTotalTropas").on("click", () => {
    $.getScript("https://tribalwarstools.github.io/twscripts/PainelTotalTropas.js")
      .done(() => setTimeout(() => {
        if (typeof abrirJanelaContador === "function") abrirJanelaContador();
        else UI.ErrorMessage("Função abrirJanelaContador não encontrada.");
      }, 100))
      .fail(() => UI.ErrorMessage("Erro ao carregar o script Total de Tropas."));
  });

  $("#abrirGrupo").on("click", () => {
    $.getScript("https://tribalwarstools.github.io/twscripts/PainelAddGrupo.js")
      .done(() => {
        setTimeout(() => {
          if (typeof abrirJanelaGrupo === "function") {
            abrirJanelaGrupo();
          } else {
            UI.ErrorMessage("Função abrirJanelaGrupo não encontrada.");
          }
        }, 100);
      })
      .fail(() => UI.ErrorMessage("Erro ao carregar o script abrirJanelaGrupo."));
  });

  async function carregarVillagesPorGrupo(groupId) {
    $("#groupVillages").html("<i>Carregando aldeias...</i>");
    $("#villageCount").text("");
    const response = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", { group_id: groupId });
    const doc = new DOMParser().parseFromString(response.html, "text/html");
    const rows = doc.querySelectorAll("#group_table tbody tr");

    if (!rows.length) {
      $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
      $("#villageCount").text("0 aldeias");
      return;
    }

    let output = `<table class="vis" width="100%">
      <thead><tr><th>Nome</th><th style="width:90px;">Coord</th><th style="width:110px;">Pontos</th><th>Ações</th></tr></thead><tbody>`;
    let total = 0;

    rows.forEach(row => {
      const tds = row.querySelectorAll("td");
      if (tds.length >= 2) {
        const name = tds[0].textContent.trim();
        const coords = tds[1].textContent.trim();
        const id = coordToId[coords];
        const points = coordToPoints[coords] || 0;
        const link = id ? `<a href="/game.php?village=${id}&screen=overview" target="_blank">${name}</a>` : name;
        const barra = criarBarraProgresso(points);
        output += `<tr>
          <td>${link}</td>
          <td><span class="coord-val">${coords}</span></td>
          <td style="padding: 4px 8px;">${barra}</td>
          <td><button class="btn copy-coord" data-coord="${coords}">📋</button></td>
        </tr>`;
        total++;
      }
    });

    output += "</tbody></table>";
    $("#groupVillages").html(`<button id="copyAllCoords" class="btn" style="margin-bottom:5px;">📋 Copiar todas as coordenadas</button>${output}`);
    $("#villageCount").text(`${total} aldeias`);

    $(".copy-coord").on("click", function () {
      const coord = $(this).data("coord");
      navigator.clipboard.writeText(coord);
      UI.SuccessMessage(`Coordenada ${coord} copiada!`);
    });

    $("#copyAllCoords").on("click", function () {
      const coords = [...document.querySelectorAll(".coord-val")].map(el => el.textContent.trim()).join(" ");
      navigator.clipboard.writeText(coords);
      UI.SuccessMessage("Todas as coordenadas copiadas!");
    });
  }

  select.addEventListener("change", async function () {
    const groupId = this.value;
    if (!groupId) return;
    localStorage.setItem(STORAGE_KEY, groupId);
    await carregarVillagesPorGrupo(groupId);
  });

  $("#refreshPoints").on("click", async () => {
    // Atualiza os pontos do overview novamente
    const prodHtmlAtual = await $.get("/game.php?screen=overview_villages&mode=prod");
    const prodDocAtual = new DOMParser().parseFromString(prodHtmlAtual, "text/html");
    const rowsAtual = prodDocAtual.querySelectorAll("table#production_table tbody tr");

    rowsAtual.forEach(row => {
      const cells = row.querySelectorAll("td");
      const coordMatch = row.innerText.match(/\d+\|\d+/);
      if (coordMatch && cells.length > 2) {
        const coord = coordMatch[0];
        const pontosTd = cells[2];
        const rawText = pontosTd.textContent.replace(/\./g, "").replace(/,/g, "").trim();
        const points = parseInt(rawText, 10);
        if (!isNaN(points)) {
          coordToPoints[coord] = points;
        }
      }
    });

    // Atualiza a tabela exibida, se houver
    $("#groupVillages table tbody tr").each(function () {
      const linha = $(this);
      const coord = linha.find(".coord-val").text().trim();
      if (coordToPoints[coord] !== undefined) {
        const barraAtualizada = criarBarraProgresso(coordToPoints[coord]);
        linha.find("td").eq(2).html(barraAtualizada);
      }
    });

    UI.SuccessMessage("Pontuação atualizada!");
  });

  if (savedGroupId) {
    select.value = savedGroupId;
    select.dispatchEvent(new Event("change"));
  }
})();
