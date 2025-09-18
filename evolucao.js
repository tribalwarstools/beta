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
        return {
            playerId: parseInt(player),
            points: parseInt(points)
        };
    });

    // === Agrupa pontos por jogador ===
    const playerPoints = {};
    for (let v of villages) {
        if (!playerPoints[v.playerId]) playerPoints[v.playerId] = 0;
        playerPoints[v.playerId] += v.points;
    }

    // === Carrega cache anterior ===
    let cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    // === Monta lista final de jogadores ===
    let jogadores = Object.keys(players).map(pid => {
        const id = parseInt(pid);
        const nome = players[id];
        const pontosAtuais = playerPoints[id] || 0;
        const hoje = Date.now();

        let status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/red.webp"> Inativo`;
        if (cache[id]) {
            const diff = pontosAtuais - cache[id].points;
            const dias = Math.floor((hoje - cache[id].lastUpdate) / (1000 * 60 * 60 * 24));

            if (diff > 0) {
                status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/green.webp"> Ativo (+${diff})`;
            } else if (dias <= 7) {
                status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/yellow.webp"> Inativo ${dias}d`;
            } else {
                status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/red.webp"> Inativo ${dias}d`;
            }
        } else {
            status = `<img src="https://dsbr.innogamescdn.com/asset/afa3a1fb/graphic/dots/yellow.webp"> Novo`;
        }

        // Atualiza cache
        cache[id] = { points: pontosAtuais, lastUpdate: hoje };

        return { id, nome, pontos: pontosAtuais, status };
    });

    // Salva cache atualizado
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

    // === Renderização ===
    function renderPage() {
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const slice = jogadores.slice(start, end);

        let tabela = `
            <p>Mostrando jogadores ${start + 1} a ${Math.min(end, jogadores.length)} de ${jogadores.length}</p>
            <table class="vis" width="100%">
                <thead>
                    <tr><th>#</th><th>Jogador</th><th>Pontos</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${slice.map((j, i) => `
                        <tr>
                            <td>${start + i + 1}</td>
                            <td>${j.nome}</td>
                            <td>${j.pontos.toLocaleString()}</td>
                            <td>${j.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top:8px; text-align:center;">
                <button id="btnPrev" class="btn" ${currentPage === 0 ? "disabled" : ""}>⬅ Voltar</button>
                <button id="btnNext" class="btn" ${end >= jogadores.length ? "disabled" : ""}>Próximo ➡</button>
            </div>
        `;

        document.getElementById("resultado").innerHTML = tabela;

        document.getElementById("btnPrev").addEventListener("click", () => {
            if (currentPage > 0) {
                currentPage--;
                renderPage();
            }
        });

        document.getElementById("btnNext").addEventListener("click", () => {
            if (end < jogadores.length) {
                currentPage++;
                renderPage();
            }
        });
    }

    // === Interface ===
    const html = `
        <div style="font-family: Verdana; font-size: 12px;">
            <h3>📊 Atividade dos Jogadores</h3>
            <div id="resultado" style="margin-top: 10px;"></div>
        </div>
    `;
    
    // AUMENTAR A LARGURA DO DIALOG SHOW
    Dialog.show("atividade_jogadores", html, { width: 600 });
    
    renderPage();
})();
