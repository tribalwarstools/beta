(async function () {
    if (!window.game_data) return alert("Execute este script dentro do Tribal Wars.");

    // --- Buscar arquivos do mapa ---
    const [villRaw, playerRaw, allyRaw] = await Promise.all([
        fetch('/map/village.txt').then(r => r.text()),
        fetch('/map/player.txt').then(r => r.text()),
        fetch('/map/ally.txt').then(r => r.text())
    ]);

    // --- Criar objeto de players ---
    const players = {};
    playerRaw.trim().split('\n').forEach(line => {
        const [id, name, allyId] = line.split(',');
        players[id] = { id: parseInt(id), name: name, allyId: parseInt(allyId) };
    });

    // --- Criar objeto de tribos ---
    const tribos = {};
    allyRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        tribos[id] = { id: parseInt(id), name: name };
    });

    // --- Todas aldeias ---
    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, playerId, points] = line.split(',');
        return {
            id: parseInt(id),
            coord: `${x}|${y}`,
            x: parseInt(x),
            y: parseInt(y),
            playerId: parseInt(playerId)
        };
    });

    // --- Suas aldeias ---
    const minhasAldeias = villages.filter(v => v.playerId === game_data.player.id);

    // --- Função distância Euclidiana ---
    const distanciaCampos = (a, b) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);

    // --- Função sugestão de tropas ---
    const sugestaoTropas = (dist) => {
        const lance = '<img src="/graphic/unit/unit_spear.png" title="Lanceiro" style="height:16px; vertical-align:middle; margin-right:2px;">';
        const espada = '<img src="/graphic/unit/unit_sword.png" title="Espadachim" style="height:16px; vertical-align:middle; margin-right:2px;">';
        if (dist <= 1) return `20k ${lance}20k ${espada}`;
        if (dist <= 3) return `15k ${lance}15k ${espada}`;
        if (dist <= 5) return `10k ${lance}10k ${espada}`;
        return `5k ${lance}5k ${espada}`;
    };

    // --- HTML do painel ---
    const html = `
        <div style="font-family: Verdana; font-size: 12px;">
            <label><b>Nome do jogador ou tribo:</b></label><br>
            <input id="playerNameInput" type="text" style="width: 400px; margin-bottom: 6px;" />
            <button id="buscarAldeias" class="btn" style="margin-left: 5px;">Buscar</button>
            <div id="resultado" style="margin-top: 10px;"></div>
            <div id="paginacao" style="margin-top: 5px; text-align:center;"></div>
        </div>
    `;
    Dialog.show("Distância entre aldeias (campos)", html);

    const pageSize = 100;
    let aldeiasComDistancia = [];
    let currentPage = 0;

    function renderPage() {
        const resultado = document.getElementById("resultado");
        const paginacao = document.getElementById("paginacao");
        resultado.innerHTML = "";

        if (aldeiasComDistancia.length === 0) return;

        const start = currentPage * pageSize;
        const end = start + pageSize;
        const subset = aldeiasComDistancia.slice(start, end);

        // Montar tabela
        let tabela = `
            <table class="vis" style="width:100%; font-size:12px;">
                <thead>
                    <tr>
                        <th>Aldeia Inimiga (Coord)</th>
                        <th>Sua Aldeia (Coord)</th>
                        <th>Distância (campos)</th>
                        <th>Sugestão de apoio</th>
                    </tr>
                </thead>
                <tbody>
        `;

        subset.forEach(({inimiga, referencia, dist}) => {
            const tropas = sugestaoTropas(dist);
            tabela += `<tr>
                <td><a href="/game.php?village=${inimiga.id}&screen=info_village&id=${inimiga.id}" target="_blank">${inimiga.coord}</a></td>
                <td><a href="/game.php?village=${referencia.id}&screen=info_village&id=${referencia.id}" target="_blank">${referencia.coord}</a></td>
                <td>${dist.toFixed(1)}</td>
                <td>${tropas}</td>
            </tr>`;
        });

        tabela += "</tbody></table>";
        resultado.innerHTML = `<p><b>${aldeiasComDistancia.length}</b> aldeias encontradas:</p>` + tabela;

        // Montar botões de paginação
        paginacao.innerHTML = `
            <button id="prevPage" ${currentPage === 0 ? 'disabled' : ''}>&lt; Anterior</button>
            <span> Página ${currentPage + 1} de ${Math.ceil(aldeiasComDistancia.length / pageSize)} </span>
            <button id="nextPage" ${(currentPage+1)*pageSize >= aldeiasComDistancia.length ? 'disabled' : ''}>Próxima &gt;</button>
        `;

        document.getElementById("prevPage").addEventListener("click", () => {
            if (currentPage > 0) {
                currentPage--;
                renderPage();
            }
        });
        document.getElementById("nextPage").addEventListener("click", () => {
            if ((currentPage+1)*pageSize < aldeiasComDistancia.length) {
                currentPage++;
                renderPage();
            }
        });
    }

    // --- Evento do botão de busca ---
    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const nomeAlvo = document.getElementById("playerNameInput").value.trim().toLowerCase();
        if (!nomeAlvo) return;

        // Buscar jogadores
        const jogadoresEncontrados = Object.values(players).filter(p => p.name.toLowerCase().includes(nomeAlvo));

        // Buscar tribos
        const tribosEncontradas = Object.values(tribos).filter(t => t.name.toLowerCase().includes(nomeAlvo));

        let playerIds = [];

        if (jogadoresEncontrados.length > 0) playerIds.push(...jogadoresEncontrados.map(p => p.id));
        tribosEncontradas.forEach(t => {
            const idsTribo = Object.values(players).filter(p => p.allyId === t.id).map(p => p.id);
            playerIds.push(...idsTribo);
        });

        playerIds = [...new Set(playerIds)];

        if (playerIds.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: red;">Nenhum jogador ou tribo encontrado.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }

        const aldeiasInimigas = villages.filter(v => playerIds.includes(v.playerId));
        if (aldeiasInimigas.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: orange;">Nenhuma aldeia encontrada para este jogador/tribo.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }

        // Calcular distância
        aldeiasComDistancia = aldeiasInimigas.map(inimiga => {
            const referencia = minhasAldeias.reduce((prev, atual) =>
                distanciaCampos(atual, inimiga) < distanciaCampos(prev, inimiga) ? atual : prev
            );
            const dist = distanciaCampos(referencia, inimiga);
            return { inimiga, referencia, dist };
        }).sort((a, b) => a.dist - b.dist);

        currentPage = 0;
        renderPage();
    });
})();
