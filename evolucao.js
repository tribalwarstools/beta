(async function () {
    const PAGE_SIZE = 50;
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms
    let currentPage = 0;
    let cache = {}; // cache somente em memória

    const [villRaw, playerRaw] = await Promise.all([
        fetch('/map/village.txt').then(r => r.text()),
        fetch('/map/player.txt').then(r => r.text()),
    ]);

    // === Estruturas de dados ===
    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        if (name.trim()) {
            players[parseInt(id)] = decodeURIComponent(name.replace(/\+/g, " "));
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

    // === Criação da lista de jogadores com status ===
    let hoje = Date.now();
    let jogadores = Object.keys(players).map(pid => {
        const id = parseInt(pid);
        const nome = players[id];
        const pontosAtuais = playerPoints[id] || 0;

        let status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/blue.webp"> Novo`;
        let variacao = 0;
        let tempoEstavel = "-";
        cache[id] = { points: pontosAtuais, lastUpdate: hoje };

        return { id, nome, pontos: pontosAtuais, status, variacao, tempoEstavel };
    });

    // === Funções Export / Import ===
    function exportCache() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cache, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "tw_players_cache.json");
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    function importCache() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const importedCache = JSON.parse(evt.target.result);

                    // Atualiza cache, status, variação e tempo estável
                    jogadores = Object.keys(players).map(pid => {
                        const id = parseInt(pid);
                        const nome = players[id];
                        const pontosAtuais = playerPoints[id] || 0;

                        let status, variacao, tempoEstavel;
                        if (importedCache[id]) {
                            const oldPoints = importedCache[id].points;
                            const lastUpdate = importedCache[id].lastUpdate || Date.now();
                            variacao = pontosAtuais - oldPoints;

                            if (variacao > 0) {
                                status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/green.webp"> Cresceu`;
                                cache[id] = { points: pontosAtuais, lastUpdate: Date.now() };
                                tempoEstavel = "0d";
                            } else if (variacao < 0) {
                                status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/red.webp"> Perdeu`;
                                cache[id] = { points: pontosAtuais, lastUpdate: Date.now() };
                                tempoEstavel = "0d";
                            } else {
                                const diff = Date.now() - lastUpdate;
                                const dias = Math.floor(diff / (1000*60*60*24));
                                if (diff > ONE_WEEK) {
                                    status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/gray.webp"> Inativo`;
                                } else {
                                    status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/yellow.webp"> Estável`;
                                }
                                cache[id] = { points: pontosAtuais, lastUpdate: lastUpdate };
                                tempoEstavel = dias + "d";
                            }
                        } else {
                            status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/blue.webp"> Novo`;
                            variacao = 0;
                            tempoEstavel = "-";
                            cache[id] = { points: pontosAtuais, lastUpdate: Date.now() };
                        }

                        return { id, nome, pontos: pontosAtuais, status, variacao, tempoEstavel };
                    });

                    currentPage = 0;
                    renderPage();
                    alert("Cache importado e status atualizado com evolução!");
                } catch(err) {
                    alert("Erro ao importar o arquivo: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // === Criação do painel ===
    let painel = document.createElement("div");
    painel.id = "atividade_jogadores_painel";
    painel.style.position = "fixed";
    painel.style.top = "50px";
    painel.style.right = "20px";
    painel.style.width = "950px";
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
                <option value="Cresceu">Cresceu</option>
                <option value="Perdeu">Perdeu</option>
                <option value="Estável">Estável</option>
                <option value="Novo">Novo</option>
                <option value="Inativo">Inativo</option>
            </select>
            <button id="btnFiltrar" style="padding:2px 6px;">Filtrar</button>
        </div>
        <div style="margin-top:5px; display:flex; gap:5px;">
            <button id="btnExportar" style="padding:2px 6px;">Exportar Cache</button>
            <button id="btnImportar" style="padding:2px 6px;">Importar Cache</button>
        </div>
        <div id="resultado" style="margin-top: 10px;"></div>
    `;
    document.body.appendChild(painel);

    document.getElementById("fecharPainel").addEventListener("click", () => painel.remove());
    document.getElementById("btnExportar").addEventListener("click", exportCache);
    document.getElementById("btnImportar").addEventListener("click", importCache);

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
                    <tr><th>#</th><th>Jogador</th><th>Pontos</th><th>Status</th><th>Variação</th><th>Tempo</th></tr>
                </thead>
                <tbody>
                    ${slice.map((j, i) => `
                        <tr>
                            <td>${start + i + 1}</td>
                            <td><a href="/game.php?screen=info_player&id=${j.id}" target="_blank">${j.nome}</a></td>
                            <td>${j.pontos.toLocaleString()}</td>
                            <td>${j.status}</td>
                            <td>${j.variacao > 0 ? '+' + j.variacao.toLocaleString() : j.variacao.toLocaleString()}</td>
                            <td>${j.tempoEstavel}</td>
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
