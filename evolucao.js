(async function () {
    const STORAGE_KEY = "tw_activity_players";
    const PAGE_SIZE = 50;
    let currentPage = 0;

    const [villRaw, playerRaw] = await Promise.all([
        fetch('/map/village.txt').then(r => r.text()),
        fetch('/map/player.txt').then(r => r.text()),
    ]);

    // === Estruturas de dados ===
    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        if (name.trim()) {
            const decodedName = decodeURIComponent(name.replace(/\+/g, " "));
            players[parseInt(id)] = decodedName;
        }
    });

    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, player, points] = line.split(',');
        return { playerId: parseInt(player), points: parseInt(points) };
    });

    const playerPoints = {};
    for (let v of villages) {
        if (!playerPoints[v.playerId]) playerPoints[v.playerId] = 0;
        playerPoints[v.playerId] += v.points;
    }

    let cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    let jogadores = Object.keys(players).map(pid => {
        const id = parseInt(pid);
        const nome = players[id];
        const pontosAtuais = playerPoints[id] || 0;
        const hoje = Date.now();

        let status = "";
        if (cache[id]) {
            const diff = pontosAtuais - cache[id].points;
            const dias = Math.floor((hoje - cache[id].lastUpdate) / (1000 * 60 * 60 * 24));

            if (diff > 0) status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/green.webp"> Ativo (+${diff})`;
            else if (dias <= 7) status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/yellow.webp"> Inativo ${dias}d`;
            else status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/red.webp"> Inativo ${dias}d`;
        } else {
            // Novo jogador: azul
            status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/blue.webp"> Novo`;
        }

        // Atualiza cache após definir status
        cache[id] = { points: pontosAtuais, lastUpdate: hoje };

        return { id, nome, pontos: pontosAtuais, status };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

    // === Criação do painel flutuante ===
    let painel = document.createElement("div");
    painel.id = "atividade_jogadores_painel";
    painel.style.position = "fixed";
    painel.style.top = "50px";
    painel.style.right = "20px";
    painel.style.width = "700px";
    painel.style.maxHeight = "80vh";
    painel.style.overflowY = "auto";
    painel.style.backgroundColor = "#f4f4f4";
    painel.style.border = "2px solid #888";
    painel.style.borderRadius = "8px";
    painel.style.padding = "10px";
    painel.style.zIndex = 9999;
    painel.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    painel.style.fontFamily = "Verdana, sans-serif";
    painel.style.fontSize = "12px";

    painel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>📊 Atividade dos Jogadores</h3>
            <button id="fecharPainel" style="cursor:pointer;">✖</button>
        </div>
        <div style="margin-top:5px; display:flex; gap:5px; align-items:center;">
            <input type="text" id="filtroNome" placeholder="Filtrar por nome" style="flex:1; padding:2px;">
            <select id="filtroStatus" style="padding:2px;">
                <option value="">Todos os status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Novo">Novo</option>
            </select>
            <button id="btnFiltrar" style="padding:2px 6px;">Filtrar</button>
        </div>
        <div id="resultado" style="margin-top: 10px;"></div>
    `;
    document.body.appendChild(painel);

    document.getElementById("fecharPainel").addEventListener("click", () => painel.remove());

    function renderPage(filtros = {}) {
        const { nome = "", status = "" } = filtros;

        let filtrados = jogadores.filter(j =>
            j.nome.toLowerCase().includes(nome.toLowerCase()) &&
            (status === "" || j.status.includes(status))
        );

        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const slice = filtrados.slice(start, end);

        let tabela = `
            <p>Mostrando jogadores ${start + 1} a ${Math.min(end, filtrados.length)} de ${filtrados.length}</p>
            <table class="vis" width="100%">
                <thead>
                    <tr><th>#</th><th>Jogador</th><th>Pontos</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${slice.map((j, i) => `
                        <tr>
                            <td>${start + i + 1}</td>
                            <td><a href="/game.php?screen=info_player&id=${j.id}" target="_blank">${j.nome}</a></td>
                            <td>${j.pontos.toLocaleString()}</td>
                            <td>${j.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top:8px; text-align:center;">
                <button id="btnPrev" class="btn" ${currentPage === 0 ? "disabled" : ""}>⬅ Voltar</button>
                <button id="btnNext" class="btn" ${end >= filtrados.length ? "disabled" : ""}>Próximo ➡</button>
            </div>
        `;

        document.getElementById("resultado").innerHTML = tabela;

        document.getElementById("btnPrev")?.addEventListener("click", () => {
            if (currentPage > 0) { currentPage--; renderPage(filtros); }
        });
        document.getElementById("btnNext")?.addEventListener("click", () => {
            if (end < filtrados.length) { currentPage++; renderPage(filtros); }
        });
    }

    document.getElementById("btnFiltrar").addEventListener("click", () => {
        currentPage = 0;
        renderPage({
            nome: document.getElementById("filtroNome").value,
            status: document.getElementById("filtroStatus").value
        });
    });

    renderPage();
})();
