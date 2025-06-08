(function () {
  UI.InfoMessage('Iniciando versão 2.0...');

  const unidades = [
    ["spear", "Lanceiro"], ["sword", "Espadachim"],
    ["axe", "Machado"], ["archer", "Arqueiro"],
    ["light", "Cav. Leve"], ["marcher", "Arq. Cav."],
    ["heavy", "Cav. Pesada"], ["spy", "Espião"],
    ["ram", "Ariete"], ["catapult", "Catapulta"],
    ["knight", "Paladino"], ["snob", "Nobre"]
  ];

  function gerarTabelaTropas() {
    return unidades.reduce((html, [id, nome], idx) => {
      if (idx % 2 === 0) html += "<tr>";
      html += `
          <td><img src="/graphic/unit/unit_${id}.png" title="${nome}" /> ${nome}</td>
          <td><input type="number" id="input_${id}" min="0" value="0" style="width: 60px;"></td>
      `;
      if (idx % 2 === 1) html += "</tr>";
      return html;
    }, "");
  }

  function coletarTropas() {
    const tropas = {};
    unidades.forEach(([id]) => {
      const el = document.getElementById(`input_${id}`);
      tropas[id] = el ? +el.value || 0 : 0;
    });
    return tropas;
  }

  function salvarDados() {
    const coords = document.getElementById("campoCoords").value;
    const tropas = coletarTropas();

    if (!coords.match(/\d{3}\|\d{3}/g)) {
      UI.ErrorMessage("Nenhuma coordenada válida encontrada.");
      return;
    }

    localStorage.setItem("coordsSalvas", coords);
    localStorage.setItem("tropasSalvas", JSON.stringify(tropas));
    UI.SuccessMessage("Coordenadas e tropas salvas com sucesso.");
  }

  function colarCoordenadas() {
    navigator.clipboard.readText().then(texto => {
      document.getElementById("campoCoords").value = texto;
      UI.SuccessMessage("Coordenadas coladas.");
    }).catch(() => {
      UI.ErrorMessage("Falha ao acessar a área de transferência.");
    });
  }

  function limparCampos() {
    document.getElementById("campoCoords").value = "";
    unidades.forEach(([id]) => {
      const el = document.getElementById(`input_${id}`);
      if (el) el.value = "0";
    });
    document.getElementById("previewContainer").innerHTML = "";
    document.getElementById("inputPlayer").value = "";
    document.getElementById("inputTribe").value = "";
    localStorage.removeItem("tropasSalvas");
    localStorage.removeItem("coordsSalvas");
    UI.SuccessMessage("Todos os campos foram limpos.");
  }

  function carregarDados() {
    const coords = localStorage.getItem("coordsSalvas");
    const tropas = JSON.parse(localStorage.getItem("tropasSalvas") || "{}");

    if (coords) document.getElementById("campoCoords").value = coords;
    unidades.forEach(([id]) => {
      const el = document.getElementById(`input_${id}`);
      if (el && tropas[id]) el.value = tropas[id];
    });
  }

  function mostrarPreview() {
    const coords = document.getElementById("campoCoords").value.match(/\d{3}\|\d{3}/g) || [];
    const tropas = coletarTropas();

    const nomesUnidades = Object.fromEntries(unidades);
    let html = `<b>Pré-visualização:</b><br>Coordenadas (${coords.length}):<br>${coords.join(", ")}<br><br>Tropas configuradas:<br>`;
    html += Object.entries(tropas).filter(([, qtd]) => qtd > 0).map(([u, qtd]) => `${nomesUnidades[u]}: ${qtd}`).join(", ");
    document.getElementById("previewContainer").innerHTML = html || "<i>Nenhuma coordenada válida para mostrar.</i>";
  }

  function decodeName(str) {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  }

  async function fetchWorldData(type) {
    const url = `https://${location.host}/map/${type}.txt`;
    const res = await fetch(url);
    return (await res.text()).trim().split('\n').map(l => l.split(','));
  }

  function getVillagesByEntity(villages, players, tribes, name, type) {
    if (type === 'Players') {
      const player = players.find(p => decodeName(p[1]) === name);
      if (!player) return [];
      const id = player[0];
      return villages.filter(v => v[4] === id).map(v => `${v[2]}|${v[3]}`);
    }
    if (type === 'Tribes') {
      const tribe = tribes.find(t => decodeName(t[2]) === name);
      if (!tribe) return [];
      const tribeId = tribe[0];
      const playerIds = players.filter(p => p[2] === tribeId).map(p => p[0]);
      return villages.filter(v => playerIds.includes(v[4])).map(v => `${v[2]}|${v[3]}`);
    }
    return [];
  }

  async function abrirPainel() {
    const [villages, players, tribes] = await Promise.all([
      fetchWorldData('village'),
      fetchWorldData('player'),
      fetchWorldData('ally')
    ]);

    const html = `
      <div class="vis" style="padding:10px; max-width: 700px;">
          <h2>Gerenciador de Envio de Tropas</h2>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
              <div style="flex:1 1 300px;">
                  <label><b>Jogador:</b></label><br>
                  <input list="listPlayers" id="inputPlayer" style="width:50%;" placeholder="Digite ou escolha...">
                  <datalist id="listPlayers">${players.map(p => `<option value="${decodeName(p[1])}">`).join('')}</datalist>
              </div>
              <div style="flex:1 1 300px;">
                  <label><b>Tribo:</b></label><br>
                  <input list="listTribes" id="inputTribe" style="width:50%;" placeholder="Digite ou escolha...">
                  <datalist id="listTribes">${tribes.map(t => `<option value="${decodeName(t[2])}">`).join('')}</datalist>
              </div>
          </div>

          <label><b>Coordenadas:</b></label>
          <textarea id="campoCoords" style="width:98%;height:80px;"></textarea>

          <div style="margin:8px 0;display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn" id="btnColar" style="flex:1 1 120px;">Colar</button>
              <button class="btn" id="btnSalvar" style="flex:1 1 120px;">Salvar</button>
              <button class="btn" id="btnLimpar" style="flex:1 1 120px;">Limpar</button>
              <button class="btn" id="btnPreview" style="flex:1 1 120px;">Mostrar resultado</button>
              <button class="btn" id="btnAtalho" style="flex:1 1 120px;">Criar Atalho</button>
          </div>

          <h3>Quantidade de Tropas</h3>
          <table class="vis" style="width:100%;text-align:left;margin-bottom:8px;">${gerarTabelaTropas()}</table>

          <div id="previewContainer" style="max-height:140px;overflow-y:auto;background:#f0f0f0;padding:5px;border:1px solid #ccc;"></div>
      </div>
    `;

    Dialog.show("painel_envio_tropas", html);

    const campoCoords = document.getElementById("campoCoords");
    const inputPlayer = document.getElementById("inputPlayer");
    const inputTribe = document.getElementById("inputTribe");

    inputPlayer.addEventListener("change", () => {
      campoCoords.value = getVillagesByEntity(villages, players, tribes, inputPlayer.value, 'Players').join(' ');
      inputTribe.value = "";
    });

    inputTribe.addEventListener("change", () => {
      campoCoords.value = getVillagesByEntity(villages, players, tribes, inputTribe.value, 'Tribes').join(' ');
      inputPlayer.value = "";
    });

    document.getElementById("btnColar").onclick = colarCoordenadas;
    document.getElementById("btnSalvar").onclick = salvarDados;
    document.getElementById("btnLimpar").onclick = limparCampos;
    document.getElementById("btnPreview").onclick = mostrarPreview;

    document.getElementById("btnAtalho").onclick = () => {
      (async function adicionarAtalhoQuickbar(nome, href) {
        try {
          const token = window.csrf_token || (typeof twSDK !== 'undefined' && await twSDK.getCSRFToken()) || null;
          if (!token) {
            UI.ErrorMessage('Token CSRF não encontrado.');
            return;
          }

          const data = `hotkey=&name=${encodeURIComponent(nome)}&href=${encodeURIComponent(href)}&h=${token}`;
          await $.ajax({
            url: '/game.php?screen=settings&mode=quickbar_edit&action=quickbar_edit&',
            method: 'POST',
            data,
          });

          UI.SuccessMessage(`Atalho '${nome}' adicionado com sucesso!`);

          Dialog.close();

          window.location.href = '/game.php?screen=place';

        } catch (e) {
          UI.ErrorMessage('Erro ao adicionar atalho: ' + e.message);
        }
      })(
        'Script de Ataque',
        "javascript:$.getScript('https://tribalwarstools.github.io/twscripts/ataque.js');"
      );
    };

    carregarDados();
  }

  abrirPainel();
})();
