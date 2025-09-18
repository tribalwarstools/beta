(async function () {
    const PAGE_SIZE = 50;
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    let currentPage = 0;
    let cache = {};

    const [villRaw, playerRaw] = await Promise.all([
        fetch('/map/village.txt').then(r => r.text()),
        fetch('/map/player.txt').then(r => r.text()),
    ]);

    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        if (name.trim()) players[parseInt(id)] = decodeURIComponent(name.replace(/\+/g, " "));
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

    let hoje = Date.now();
    let jogadores = Object.keys(players).map(pid => {
        const id = parseInt(pid);
        const nome = players[id];
        const pontosAtuais = playerPoints[id] || 0;
        let status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/blue.webp">`;
        let variacao = 0;
        let tempoEstavel = "-";
        cache[id] = { points: pontosAtuais, lastUpdate: hoje };
        return { id, nome, pontos: pontosAtuais, status, variacao, tempoEstavel, lastUpdate: hoje };
    });

    function exportCache() {
        const exportData = jogadores.map(j => ({
            id: j.id,
            nome: j.nome,
            pontos: j.pontos,
            status: j.status,
            variacao: j.variacao,
            tempoEstavel: j.tempoEstavel,
            lastUpdate: j.lastUpdate || Date.now()
        }));

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "tw_players_cache_full.json");
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
                    const importedData = JSON.parse(evt.target.result);
                    const agora = Date.now();
                    const cacheMap = {};
                    jogadores.forEach(j => cacheMap[j.id] = j);

                    importedData.forEach(j => {
                        const pontosAtuais = playerPoints[j.id] || j.pontos;
                        const pontosAntigos = j.pontos || 0;
                        const variacao = pontosAtuais - pontosAntigos;

                        let status, tempoEstavel, lastUpdate;

                        if (variacao > 0) {
                            status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/green.webp">`;
                            lastUpdate = agora;
                            tempoEstavel = "0d";
                        } else if (variacao < 0) {
                            status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/red.webp">`;
                            lastUpdate = agora;
                            tempoEstavel = "0d";
                        } else {
                            lastUpdate = j.lastUpdate || agora;
                            const diff = agora - lastUpdate;
                            const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
                            if (diff > ONE_WEEK) status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/grey.webp">`;
                            else status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/yellow.webp">`;
                            tempoEstavel = dias + "d";
                        }

                        cache[j.id] = { points: pontosAtuais, lastUpdate };
                        cacheMap[j.id] = {
                            id: j.id,
                            nome: j.nome,
                            pontos: pontosAtuais,
                            status,
                            variacao,
                            tempoEstavel,
                            lastUpdate
                        };
                    });

                    jogadores = Object.values(cacheMap);
                    currentPage = 0;
                    renderPage();
                    alert("Cache importado e mesclado com sucesso!");
                } catch(err) {
                    alert("Erro ao importar o arquivo: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    const html = `
        <div style="font-family: Verdana; font-size: 12px; width: 1050px; height: 600px; overflow-y:auto;">
            <style>
                #resultado table {
                    table-layout: fixed;
                    width: 100%;
                    border-collapse: collapse;
                }
                #resultado th, #resultado td {
                    text-align: left;
                    padding: 3px;
                    word-break: break-word;
                    white-space: normal;
                }
                #resultado th:nth-child(1), #resultado td:nth-child(1) { width: 30px; } /* Status */
                #resultado th:nth-child(2), #resultado td:nth-child(2) { width: 250px; } /* Nome */
                #resultado th:nth-child(3), #resultado td:nth-child(3) { width: 90px; } /* Pontos */
                #resultado th:nth-child(4), #resultado td:nth-child(4) { width: 90px; } /* Variação */
                #resultado th:nth-child(5), #resultado td:nth-child(5) { width: 70px; } /* Tempo */
                #resultado th:nth-child(6), #resultado td:nth-child(6) { width: 200px; } /* Última Atualização */
            </style>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>📊 Atividade dos Jogadores</h3>
            </div>
            <div style="margin-top:5px; display:flex; gap:5px; align-items:center;">
                <input type="text" id="filtroNome" placeholder="Filtrar por nome" style="flex:1; padding:2px;">
                <select id="filtroStatus" style="padding:2px;">
                    <option value="">Todos os status</option>
                    <option value="green">Cresceu</option>
                    <option value="red">Perdeu</option>
                    <option value="yellow">Estável</option>
                    <option value="blue">Novo</option>
                    <option value="grey">Inativo</option>
                </select>
                <button id="btnFiltrar" style="padding:2px 6px;">Filtrar</button>
            </div>
            <div style="margin-top:5px; display:flex; gap:5px;">
                <button id="btnExportar" style="padding:2px 6px;">Exportar Cache</button>
                <button id="btnImportar" style="padding:2px 6px;">Importar Cache</button>
            </div>
            <div id="resultado" style="margin-top: 10px;"></div>
        </div>
    `;

    if (typeof Dialog !== 'undefined') Dialog.show("atividade_jogadores", html);
    else {
        const dialog = document.createElement('div');
        dialog.innerHTML = html;
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.padding = '15px';
        dialog.style.border = '2px solid #ccc';
        dialog.style.zIndex = '10000';
        dialog.style.width = '1050px';
        dialog.style.height = '600px';
        dialog.style.overflowY = 'auto';
        document.body.appendChild(dialog);
    }

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
            <table class="vis">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Jogador</th>
                        <th>Pontos</th>
                        <th>Variação</th>
                        <th>Tempo</th>
                        <th>Última Atualização</th>
                    </tr>
                </thead>
                <tbody>
                    ${slice.map(j => `
                        <tr>
                            <td>${j.status}</td>
                            <td><a href="/game.php?screen=info_player&id=${j.id}" target="_blank">${j.nome}</a></td>
                            <td>${j.pontos.toLocaleString()}</td>
                            <td>${j.variacao > 0 ? '+' + j.variacao.toLocaleString() : j.variacao.toLocaleString()}</td>
                            <td>${j.tempoEstavel}</td>
                            <td>${new Date(j.lastUpdate).toLocaleString()}</td>
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

    document.getElementById("btnExportar").addEventListener("click", exportCache);
    document.getElementById("btnImportar").addEventListener("click", importCache);
    document.getElementById("btnFiltrar").addEventListener("click", () => {
        currentPage = 0;
        renderPage({
            nome: document.getElementById("filtroNome").value,
            status: document.getElementById("filtroStatus").value
        });
    });

    renderPage();
})();
