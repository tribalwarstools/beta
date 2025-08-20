(async function () {
    // --- Buscar arquivos do mapa ---
    const villRaw = await fetch('/map/village.txt').then(r => r.text());
    const playerRaw = await fetch('/map/player.txt').then(r => r.text());

    // --- Criar objeto de players ---
    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        players[name] = parseInt(id);
    });

    // --- Todas aldeias ---
    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, player, points] = line.split(',');
        return {
            id: parseInt(id),
            coord: `${x}|${y}`,
            x: parseInt(x),
            y: parseInt(y),
            playerId: parseInt(player)
        };
    });

    // --- Suas aldeias ---
    const minhasAldeias = villages.filter(v => v.playerId === game_data.player.id);

    // --- HTML do painel ---
    const html = `
        <div style="font-family: Verdana; font-size: 12px;">
            <label><b>Nome do jogador ou tribo:</b></label><br>
            <input id="playerNameInput" type="text" style="width: 200px; margin-bottom: 6px;" />
            <button id="buscarAldeias" class="btn" style="margin-left: 5px;">Buscar</button>
            <div id="resultado" style="margin-top: 10px;"></div>
        </div>
    `;
    Dialog.show("Distância entre aldeias (campos)", html);

    // --- Função distância Euclidiana ---
    function distanciaCampos(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    // --- Evento do botão ---
    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const nomeAlvo = document.getElementById("playerNameInput").value.trim().toLowerCase();
        const resultado = document.getElementById("resultado");
        resultado.innerHTML = "";

        // Encontrar player
        const playerId = Object.entries(players).find(([name,id]) => name.toLowerCase() === nomeAlvo)?.[1];
        if(!playerId){
            resultado.innerHTML = `<span style="color: red;">Jogador/Tribo não encontrado.</span>`;
            return;
        }

        // Filtrar aldeias inimigas
        const aldeiasInimigas = villages.filter(v => v.playerId === playerId);
        if(aldeiasInimigas.length === 0){
            resultado.innerHTML = `<span style="color: orange;">Nenhuma aldeia encontrada para este jogador/tribo.</span>`;
            return;
        }

        // Montar tabela com coordenadas e distância
        let tabela = `
            <table class="vis" style="width:100%; font-size:12px;">
                <thead>
                    <tr>
                        <th>Aldeia Inimiga (Coord)</th>
                        <th>Sua Aldeia (Coord)</th>
                        <th>Distância (campos)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        aldeiasInimigas.forEach(inimiga => {
            // encontrar sua aldeia mais próxima
            const referencia = minhasAldeias.reduce((prev, atual) =>
                distanciaCampos(atual, inimiga) < distanciaCampos(prev, inimiga) ? atual : prev
            );
            const dist = distanciaCampos(referencia, inimiga);

            // Links clicáveis
            tabela += `<tr>
                <td><a href="/game.php?village=${inimiga.id}&screen=info_village&id=${inimiga.id}" target="_blank">${inimiga.coord}</a></td>
                <td><a href="/game.php?village=${referencia.id}&screen=info_village&id=${referencia.id}" target="_blank">${referencia.coord}</a></td>
                <td>${dist.toFixed(1)}</td>
            </tr>`;
        });

        tabela += "</tbody></table>";
        resultado.innerHTML = `<p><b>${aldeiasInimigas.length}</b> aldeias encontradas:</p>` + tabela;
    });
})();
