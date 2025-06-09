(async function () {
    const [villRaw, playerRaw] = await Promise.all([
        fetch('/map/village.txt').then(r => r.text()),
        fetch('/map/player.txt').then(r => r.text()),
    ]);

    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        players[name] = parseInt(id);
    });

    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, player, points] = line.split(',');
        return {
            coord: `${x}|${y}`,
            playerId: parseInt(player),
            points: parseInt(points)
        };
    });

    const html = `
        <div style="font-family: Verdana; font-size: 12px;">
            <label><b>Nome do jogador:</b></label><br>
            <input id="playerNameInput" type="text" style="width: 200px; margin-bottom: 6px;" />
            <button id="buscarAldeias" class="btn" style="margin-left: 5px;">Buscar</button>
            <div id="resultado" style="margin-top: 10px;"></div>
        </div>
    `;

    Dialog.show("Buscar Aldeias do Jogador", html);

    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const nome = document.getElementById("playerNameInput").value.trim();
        const resultado = document.getElementById("resultado");
        resultado.innerHTML = "";

        if (!players.hasOwnProperty(nome)) {
            resultado.innerHTML = `<span style="color: red;">Jogador não encontrado.</span>`;
            return;
        }

        const playerId = players[nome];
        const aldeias = villages.filter(v => v.playerId === playerId);

        if (aldeias.length === 0) {
            resultado.innerHTML = `<span style="color: orange;">Nenhuma aldeia encontrada para este jogador.</span>`;
            return;
        }

        let tabela = `
            <table class="vis">
                <thead>
                    <tr><th>Coordenada</th><th>Pontos</th></tr>
                </thead>
                <tbody>
                    ${aldeias.map(a => `
                        <tr><td>${a.coord}</td><td>${a.points}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        resultado.innerHTML = `<p><b>${aldeias.length}</b> aldeias encontradas:</p>` + tabela;
    });
})();
