(async function () {
    if (!window.game_data) return alert("Execute este script dentro do Tribal Wars.");

    // Função para decodificar caracteres especiais (como %C3%A7 para ç)
    function decodeSpecialChars(str) {
        return decodeURIComponent(str.replace(/\+/g, " "));
    }

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
            name: decodeSpecialChars(name), 
            allyId: parseInt(allyId) 
        };
    });

    // --- Criar objeto de tribos ---
    const tribos = {};
    allyRaw.trim().split('\n').forEach(line => {
        const [id, name, , , tag] = line.split(',');
        tribos[id] = { 
            id: parseInt(id), 
            name: decodeSpecialChars(name),
            tag: decodeSpecialChars(tag || '')
        };
    });

    // --- Preparar dados para a datalist ---
    const todasOpcoes = [];
    
    // Adicionar jogadores
    Object.values(players).forEach(player => {
        todasOpcoes.push({
            id: player.id, 
            nome: player.name, 
            tipo: 'Jogador',
            display: `${player.name} (Jogador)`
        });
    });
    
    // Adicionar tribos
    Object.values(tribos).forEach(tribo => {
        todasOpcoes.push({
            id: tribo.id, 
            nome: tribo.name, 
            tipo: 'Tribo',
            display: `${tribo.name} [${tribo.tag}] (Tribo)`
        });
    });

    // --- Todas aldeias ---
    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, playerId, points, rank] = line.split(',');
        return { 
            id: parseInt(id), 
            name: decodeSpecialChars(name),
            coord: `${x}|${y}`, 
            x: parseInt(x), 
            y: parseInt(y), 
            playerId: parseInt(playerId),
            points: parseInt(points || 0),
            rank: parseInt(rank || 0)
        };
    });

    // --- Suas aldeias ---
    const minhasAldeias = villages.filter(v => v.playerId === game_data.player.id);

    // --- Função distância Euclidiana ---
    const distanciaCampos = (a, b) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);

    // --- HTML do painel ---
    const html = `
        <div style="font-family: Verdana; font-size: 12px;width: 500px;">
            <label><b>Selecione jogadores ou tribos:</b></label><br>
            <div id="tagsContainer" style="border: 1px solid #ccc; padding: 5px; min-height: 30px; margin-bottom: 6px; 
                 display: flex; flex-wrap: wrap; align-items: center; gap: 5px;">
                <input id="playerNameInput" type="text" list="opcoesList" 
                       placeholder="Digite e pressione Enter..." 
                       style="border: none; outline: none; flex-grow: 1; min-width: 100px;" />
            </div>
            <datalist id="opcoesList"></datalist>
            <button id="buscarAldeias" class="btn btn-confirm-yes">Buscar</button>
            <button id="limparTudo" class="btn btn-confirm-no" style="margin-left: 5px;">Limpar</button>
            <div id="resultado" style="margin-top: 10px; max-height: 400px; overflow-y: auto;"></div>
            <div id="paginacao" style="margin-top: 5px; text-align:center;"></div>
        </div>
    `;
    
    // Usando o Dialog do Tribal Wars se disponível
    if (typeof Dialog !== 'undefined') {
        Dialog.show("Distância entre aldeias (campos)", html);
    } else {
        // Fallback caso Dialog não esteja disponível
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
        document.body.appendChild(dialog);
    }

    // --- Preencher a datalist com opções ---
    const datalist = document.getElementById('opcoesList');
    todasOpcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.display || opcao.nome;
        option.setAttribute('data-tipo', opcao.tipo);
        option.setAttribute('data-id', opcao.id);
        datalist.appendChild(option);
    });

    const tagsContainer = document.getElementById('tagsContainer');
    const input = document.getElementById('playerNameInput');
    const selectedItems = new Set();

    // --- Função para adicionar tag ---
    function adicionarTag(nome, tipo, id) {
        const uniqueId = `${tipo}-${id}`;
        if (selectedItems.has(uniqueId)) return;
        
        selectedItems.add(uniqueId);
        
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
        tag.setAttribute('data-uniqueid', uniqueId);
        
        // Botão para remover a tag
        tag.querySelector('button').addEventListener('click', function() {
            tagsContainer.removeChild(tag);
            selectedItems.delete(uniqueId);
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
                o.display.toLowerCase().includes(this.value.trim().toLowerCase()) ||
                o.nome.toLowerCase().includes(this.value.trim().toLowerCase())
            );
            
            if (opcao) {
                adicionarTag(opcao.nome, opcao.tipo, opcao.id);
            }
        }
    });

    // --- Event listener para o datalist (quando seleciona com mouse) ---
    input.addEventListener('input', function() {
        const opcao = todasOpcoes.find(o => 
            o.display === this.value || o.nome === this.value
        );
        
        if (opcao) {
            const uniqueId = `${opcao.tipo}-${opcao.id}`;
            if (!selectedItems.has(uniqueId)) {
                adicionarTag(opcao.nome, opcao.tipo, opcao.id);
            }
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

    const pageSize = 50;
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

        if (aldeiasComDistancia.length === 0) {
            resultado.innerHTML = "<p>Nenhuma aldeia encontrada.</p>";
            paginacao.innerHTML = "";
            return;
        }

        const start = currentPage * pageSize;
        const end = Math.min(start + pageSize, aldeiasComDistancia.length);
        const subset = aldeiasComDistancia.slice(start, end);

        let tabela = `<table class="vis" style="width:100%; font-size:11px; border-collapse: collapse;">
            <thead><tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #ccc; padding: 4px;">Aldeia Inimiga</th>
                <th style="border: 1px solid #ccc; padding: 4px;">Sua Aldeia</th>
                <th style="border: 1px solid #ccc; padding: 4px;">Distância</th>
                <th style="border: 1px solid #ccc; padding: 4px;">Sugestão</th>
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
                <td style="border: 1px solid #ccc; padding: 4px;">
                    <a href="/game.php?village=${inimiga.id}&screen=info_village&id=${inimiga.id}" target="_blank">
                        ${inimiga.name} (${inimiga.coord})
                    </a>
                </td>
                <td style="border: 1px solid #ccc; padding: 4px;">
                    <a href="/game.php?village=${referencia.id}&screen=info_village&id=${referencia.id}" target="_blank">
                        ${referencia.name} (${referencia.coord})
                    </a>
                </td>
                <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${distInteiro}</td>
                <td style="border: 1px solid #ccc; padding: 4px;">${tropas}</td>
            </tr>`;
        });

        tabela += "</tbody></table>";
        resultado.innerHTML = `<p><b>${aldeiasComDistancia.length}</b> aldeias encontradas (mostrando ${start+1}-${end}):</p>` + tabela;

        const totalPages = Math.ceil(aldeiasComDistancia.length / pageSize);
        paginacao.innerHTML = `
            <button class="btn" id="prevPage" ${currentPage === 0 ? 'disabled' : ''}>&lt; Anterior</button>
            <span> Página ${currentPage + 1} de ${totalPages} </span>
            <button class="btn" id="nextPage" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Próxima &gt;</button>
        `;

        document.getElementById("prevPage")?.addEventListener("click", () => {
            if (currentPage > 0) { 
                currentPage--; 
                renderPage(); 
            }
        });
        
        document.getElementById("nextPage")?.addEventListener("click", () => {
            if (currentPage < totalPages - 1) { 
                currentPage++; 
                renderPage(); 
            }
        });
    }

    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const tags = tagsContainer.querySelectorAll('.tag');
        if (tags.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: red;">Selecione pelo menos um jogador ou tribo.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }
        
        let playerIds = [];

        tags.forEach(tag => {
            const tipo = tag.getAttribute('data-tipo');
            const id = tag.getAttribute('data-id');

            if (tipo === 'Jogador') {
                playerIds.push(parseInt(id));
            } else if (tipo === 'Tribo') {
                const idsTribo = Object.values(players)
                    .filter(p => p.allyId === parseInt(id))
                    .map(p => p.id);
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

        // Calcular distâncias
        aldeiasComDistancia = [];
        aldeiasInimigas.forEach(inimiga => {
            let menorDistancia = Infinity;
            let aldeiaMaisProxima = null;
            
            minhasAldeias.forEach(minha => {
                const dist = distanciaCampos(minha, inimiga);
                if (dist < menorDistancia) {
                    menorDistancia = dist;
                    aldeiaMaisProxima = minha;
                }
            });
            
            if (aldeiaMaisProxima) {
                aldeiasComDistancia.push({
                    inimiga,
                    referencia: aldeiaMaisProxima,
                    dist: menorDistancia
                });
            }
        });

        // Ordenar por distância
        aldeiasComDistancia.sort((a, b) => a.dist - b.dist);

        currentPage = 0;
        renderPage();
    });
})();
