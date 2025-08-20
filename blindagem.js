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
        players[id] = { 
            id: parseInt(id), 
            name: name.replace(/\+/g, " "), 
            allyId: parseInt(allyId) 
        };
    });

    // --- Criar objeto de tribos ---
    const tribos = {};
    allyRaw.trim().split('\n').forEach(line => {
        const [id, name] = line.split(',');
        tribos[id] = { 
            id: parseInt(id), 
            name: name.replace(/\+/g, " ") 
        };
    });

    // --- Preparar dados para a datalist ---
    const todasOpcoes = [];
    
    // Adicionar jogadores
    Object.values(players).forEach(player => {
        todasOpcoes.push({id: player.id, nome: player.name, tipo: 'Jogador'});
    });
    
    // Adicionar tribos
    Object.values(tribos).forEach(tribo => {
        todasOpcoes.push({id: tribo.id, nome: tribo.name, tipo: 'Tribo'});
    });

    // --- Todas aldeias ---
    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, playerId, points] = line.split(',');
        return { id: parseInt(id), coord: `${x}|${y}`, x: parseInt(x), y: parseInt(y), playerId: parseInt(playerId) };
    });

    // --- Suas aldeias ---
    const minhasAldeias = villages.filter(v => v.playerId === game_data.player.id);

    // --- Função distância Euclidiana ---
    const distanciaCampos = (a, b) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);

    // --- HTML do painel ---
    const html = `
        <div style="font-family: Verdana; font-size: 12px;width: 400px;">
            <label><b>Selecione jogadores ou tribos:</b></label><br>
            <div id="tagsContainer" style="border: 1px solid #ccc; padding: 5px; min-height: 30px; margin-bottom: 6px; 
                 display: flex; flex-wrap: wrap; align-items: center; gap: 5px;">
                <input id="playerNameInput" type="text" list="opcoesList" 
                       placeholder="Digite e pressione Enter..." 
                       style="border: none; outline: none; flex-grow: 1; min-width: 100px;" />
            </div>
            <datalist id="opcoesList"></datalist>
            <button id="buscarAldeias" class="btn">Buscar</button>
            <button id="limparTudo" class="btn" style="margin-left: 5px;">Limpar</button>
            <div id="resultado" style="margin-top: 10px;"></div>
            <div id="paginacao" style="margin-top: 5px; text-align:center;"></div>
        </div>
    `;
    Dialog.show("Distância entre aldeias (campos)", html);

    // --- Preencher a datalist com opções ---
    const datalist = document.getElementById('opcoesList');
    todasOpcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.nome;
        option.setAttribute('data-tipo', opcao.tipo);
        option.setAttribute('data-id', opcao.id);
        datalist.appendChild(option);
    });

    const tagsContainer = document.getElementById('tagsContainer');
    const input = document.getElementById('playerNameInput');
    const selectedItems = new Set();

    // --- Função para adicionar tag ---
    function adicionarTag(nome, tipo, id) {
        if (selectedItems.has(nome)) return;
        
        selectedItems.add(nome);
        
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.style = 'background: #e0e0e0; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center;';
        tag.innerHTML = `
            <span style="margin-right: 5px;">${nome}</span>
            <button type="button" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #666;">×</button>
        `;
        
        tag.setAttribute('data-nome', nome);
        tag.setAttribute('data-tipo', tipo);
        tag.setAttribute('data-id', id);
        
        // Botão para remover a tag
        tag.querySelector('button').addEventListener('click', function() {
            tagsContainer.removeChild(tag);
            selectedItems.delete(nome);
        });
        
        tagsContainer.insertBefore(tag, input);
        input.value = '';
        input.focus();
    }

    // --- Event listener para o input ---
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
            e.preventDefault();
            
            // Encontrar a opção correspondente
            const opcao = todasOpcoes.find(o => 
                o.nome.toLowerCase() === this.value.trim().toLowerCase()
            );
            
            if (opcao) {
                adicionarTag(opcao.nome, opcao.tipo, opcao.id);
            }
        }
    });

    // --- Event listener para o datalist (quando seleciona com mouse) ---
    input.addEventListener('input', function() {
        const opcao = todasOpcoes.find(o => 
            o.nome.toLowerCase() === this.value.trim().toLowerCase()
        );
        
        if (opcao && !selectedItems.has(opcao.nome)) {
            adicionarTag(opcao.nome, opcao.tipo, opcao.id);
        }
    });

    // --- Botão Limpar Tudo ---
    document.getElementById('limparTudo').addEventListener('click', function() {
        const tags = tagsContainer.querySelectorAll('.tag');
        tags.forEach(tag => tagsContainer.removeChild(tag));
        selectedItems.clear();
        input.value = '';
        input.focus();
    });

    const pageSize = 100;
    let aldeiasComDistancia = [];
    let currentPage = 0;

    function calcularMultiplicador(vezes, dist) {
        if (dist > 5) return 1;
        if (vezes === 1) return 1;
        if (vezes === 2) return dist <= 3 ? 1.5 : 1.2;
        return dist <= 3 ? 2 : 1.5;
    }

    function sugestaoTropas(dist, vezes) {
        const lance = '<img src="/graphic/unit/unit_spear.png" title="Lanceiro" style="height:16px; vertical-align:middle; margin-right:2px;">';
        const espada = '<img src="/graphic/unit/unit_sword.png" title="Espadachim" style="height:16px; vertical-align:middle; margin-right:2px;">';
        let baseLance = 5000, baseEspada = 5000;

        if (dist <= 1) baseLance = baseEspada = 20000;
        else if (dist <= 3) baseLance = baseEspada = 15000;
        else if (dist <= 5) baseLance = baseEspada = 10000;

        const mult = calcularMultiplicador(vezes, dist);
        const lanceFinal = Math.ceil(baseLance * mult);
        const espadaFinal = Math.ceil(baseEspada * mult);
        return `${lanceFinal.toLocaleString()} ${lance} ${espadaFinal.toLocaleString()} ${espada}`;
    }

    function renderPage() {
        const resultado = document.getElementById("resultado");
        const paginacao = document.getElementById("paginacao");
        resultado.innerHTML = "";

        if (aldeiasComDistancia.length === 0) return;

        const start = currentPage * pageSize;
        const end = start + pageSize;
        const subset = aldeiasComDistancia.slice(start, end);

        let tabela = `<table class="vis" style="width:100%; font-size:12px;">
            <thead><tr>
                <th>Aldeia Inimiga (Coord)</th>
                <th>Sua Aldeia (Coord)</th>
                <th>Distância (campos)</th>
                <th>Sugestão de apoio</th>
            </tr></thead><tbody>`;

        const contagem = {};
        subset.forEach(({referencia}) => {
            contagem[referencia.coord] = (contagem[referencia.coord] || 0) + 1;
        });

        subset.forEach(({inimiga, referencia, dist}) => {
            const vezes = contagem[referencia.coord] || 1;
            const tropas = sugestaoTropas(dist, vezes);
            const distInteiro = Math.round(dist);

            tabela += `<tr>
                <td><a href="/game.php?village=${inimiga.id}&screen=info_village&id=${inimiga.id}" target="_blank">${inimiga.coord}</a></td>
                <td><a href="/game.php?village=${referencia.id}&screen=info_village&id=${referencia.id}" target="_blank">${referencia.coord}</a></td>
                <td>${distInteiro}</td>
                <td>${tropas}</td>
            </tr>`;
        });

        tabela += "</tbody></table>";
        resultado.innerHTML = `<p><b>${aldeiasComDistancia.length}</b> aldeias encontradas:</p>` + tabela;

        paginacao.innerHTML = `
            <button class="btn" id="prevPage" ${currentPage === 0 ? 'disabled' : ''}>&lt; Anterior</button>
            <span> Página ${currentPage + 1} de ${Math.ceil(aldeiasComDistancia.length / pageSize)} </span>
            <button class="btn" id="nextPage" ${(currentPage+1)*pageSize >= aldeiasComDistancia.length ? 'disabled' : ''}>Próxima &gt;</button>
        `;

        document.getElementById("prevPage").addEventListener("click", () => {
            if (currentPage > 0) { currentPage--; renderPage(); }
        });
        document.getElementById("nextPage").addEventListener("click", () => {
            if ((currentPage+1)*pageSize < aldeiasComDistancia.length) { currentPage++; renderPage(); }
        });
    }

    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const tags = tagsContainer.querySelectorAll('.tag');
        if (tags.length === 0) return;
        
        let playerIds = [];

        tags.forEach(tag => {
            const tipo = tag.getAttribute('data-tipo');
            const id = tag.getAttribute('data-id');

            if (tipo === 'Jogador') {
                playerIds.push(parseInt(id));
            } else if (tipo === 'Tribo') {
                const idsTribo = Object.values(players).filter(p => p.allyId === parseInt(id)).map(p => p.id);
                playerIds.push(...idsTribo);
            }
        });

        playerIds = [...new Set(playerIds)];

        if (playerIds.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: red;">Nenhum jogador ou tribo selecionado.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }

        const aldeiasInimigas = villages.filter(v => playerIds.includes(v.playerId));
        if (aldeiasInimigas.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: orange;">Nenhuma aldeia encontrada para os selecionados.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }

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
