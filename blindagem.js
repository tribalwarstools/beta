(async function () {
    if (!window.game_data) return alert("Execute este script dentro do Tribal Wars.");

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

    // --- Criar mapa de coordenadas para aldeias ---
    const coordMap = {};
    villages.forEach(village => {
        coordMap[village.coord] = village;
    });

    const minhasAldeias = villages.filter(v => v.playerId === game_data.player.id);
    const distanciaCampos = (a, b) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);

    // --- Preparar opções para datalist ---
    const todasOpcoes = [];
    Object.values(players).forEach(player => {
        todasOpcoes.push({ id: player.id, nome: player.name, tipo: 'Jogador', display: `${player.name} (Jogador)` });
    });
    Object.values(tribos).forEach(tribo => {
        todasOpcoes.push({ id: tribo.id, nome: tribo.name, tipo: 'Tribo', display: `${tribo.name} [${tribo.tag}] (Tribo)` });
    });

    // --- HTML ---
    const html = `
        <div style="font-family: Verdana; font-size: 12px;width: 500px;">
            <label><b>Selecione jogadores, tribos ou digite coordenadas (ex: 500|500):</b></label><br>
            <div id="tagsContainer" style="border: 1px solid #ccc; padding: 5px; min-height: 30px; margin-bottom: 6px; 
                 display: flex; flex-wrap: wrap; align-items: center; gap: 5px;">
                <input id="playerNameInput" type="text" list="opcoesList" 
                       placeholder="Digite nome, tag ou coordenadas..." 
                       style="border: none; outline: none; flex-grow: 1; min-width: 100px;" />
            </div>
            <datalist id="opcoesList"></datalist>

            <button id="buscarAldeias" class="btn btn-confirm-yes">Buscar</button>
            <button id="limparTudo" class="btn btn-confirm-no" style="margin-left: 5px;">Limpar</button>
            <div id="contadores" style="margin-top: 10px; padding: 5px; background-color: #f5f5f5; border-radius: 3px;"></div>
            <div id="resultado" style="margin-top: 10px; max-height: 400px; overflow-y: auto;"></div>
            <div id="paginacao" style="margin-top: 5px; text-align:center;"></div>
        </div>
    `;
    
    if (typeof Dialog !== 'undefined') {
        Dialog.show("Distância entre aldeias", html);
    } else {
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

    // --- Preencher datalist ---
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

    function adicionarTag(nome, tipo, id, coord = null) {
        const uniqueId = coord ? `coord-${coord}` : `${tipo}-${id}`;
        if (selectedItems.has(uniqueId)) return;
        selectedItems.add(uniqueId);
        
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.style = 'background: #e0e0e0; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center;';
        tag.innerHTML = `<span style="margin-right: 5px;">${nome}</span>
                         <button type="button" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #666;">×</button>`;
        
        tag.setAttribute('data-nome', nome);
        tag.setAttribute('data-tipo', tipo);
        tag.setAttribute('data-id', id);
        if (coord) tag.setAttribute('data-coord', coord);
        tag.setAttribute('data-uniqueid', uniqueId);
        
        tag.querySelector('button').addEventListener('click', function() {
            tagsContainer.removeChild(tag);
            selectedItems.delete(uniqueId);
        });
        
        tagsContainer.insertBefore(tag, input);
        input.value = '';
        input.focus();
    }

    function isValidCoord(coord) {
        const coordRegex = /^\d{1,3}\|\d{1,3}$/;
        if (!coordRegex.test(coord)) return false;
        
        const [x, y] = coord.split('|').map(Number);
        return x >= 0 && x <= 1000 && y >= 0 && y <= 1000;
    }

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
            e.preventDefault();
            const value = this.value.trim();
            
            // Verificar se é uma coordenada completa
            if (isValidCoord(value)) {
                adicionarTag(value, 'Coordenada', null, value);
                return;
            }
            
            // Se não for coordenada completa, verificar se é um jogador ou tribo
            const opcao = todasOpcoes.find(o => 
                o.display.toLowerCase() === value.toLowerCase() ||
                o.nome.toLowerCase() === value.toLowerCase()
            );
            
            if (opcao) {
                adicionarTag(opcao.nome, opcao.tipo, opcao.id);
            }
        }
    });

    // Remover o evento input que estava causando o problema
    // e substituir por um evento de blur (quando perde o foco)
    input.addEventListener('blur', function() {
        if (this.value.trim()) {
            const value = this.value.trim();
            
            // Verificar se é uma coordenada completa
            if (isValidCoord(value)) {
                const uniqueId = `coord-${value}`;
                if (!selectedItems.has(uniqueId)) {
                    adicionarTag(value, 'Coordenada', null, value);
                }
                return;
            }
            
            // Verificar se é um jogador ou tribo exato
            const opcao = todasOpcoes.find(o => 
                o.display === value || o.nome === value
            );
            
            if (opcao) {
                const uniqueId = `${opcao.tipo}-${opcao.id}`;
                if (!selectedItems.has(uniqueId)) {
                    adicionarTag(opcao.nome, opcao.tipo, opcao.id);
                }
            }
        }
    });

    document.getElementById('limparTudo').addEventListener('click', function() {
        tagsContainer.querySelectorAll('.tag').forEach(tag => tagsContainer.removeChild(tag));
        selectedItems.clear();
        input.value = '';
        input.focus();
    });

    const pageSize = 50;
    let aldeiasComDistancia = [];
    let currentPage = 0;

    function atualizarContadores(aldeiasInimigas) {
        const contadoresDiv = document.getElementById("contadores");
        const totalAldeiasInimigas = aldeiasInimigas.length;
        const totalMinhasAldeias = minhasAldeias.length;
        
        contadoresDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <span><b>Suas Aldeias:</b> ${totalMinhasAldeias}</span>
                <span><b>Aldeias Alvo:</b> ${totalAldeiasInimigas}</span>
                <span><b>Total de Pares:</b> ${totalMinhasAldeias * totalAldeiasInimigas}</span>
            </div>
        `;
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
                <th style="border: 1px solid #ccc; padding: 4px;">Aldeia Alvo</th>
                <th style="border: 1px solid #ccc; padding: 4px;">Sua Aldeia</th>
                <th style="border: 1px solid #ccc; padding: 4px;">Distância</th>
            </tr></thead><tbody>`;

        subset.forEach(({inimiga, referencia, dist}) => {
            tabela += `<tr>
                <td style="border: 1px solid #ccc; padding: 4px;">
                    <a href="/game.php?village=${inimiga.id}&screen=info_village&id=${inimiga.id}" target="_blank">${inimiga.name} (${inimiga.coord})</a>
                </td>
                <td style="border: 1px solid #ccc; padding: 4px;">
                    <a href="/game.php?village=${referencia.id}&screen=info_village&id=${referencia.id}" target="_blank">${referencia.name} (${referencia.coord})</a>
                </td>
                <td style="border: 1px solid #ccc; text-align: center;">${Math.round(dist)}</td>
            </tr>`;
        });

        tabela += "</tbody></table>";
        resultado.innerHTML = `<p>Mostrando ${start+1}-${end} de ${aldeiasComDistancia.length} pares:</p>` + tabela;

        const totalPages = Math.ceil(aldeiasComDistancia.length / pageSize);
        paginacao.innerHTML = `
            <button class="btn" id="prevPage" ${currentPage === 0 ? 'disabled' : ''}>&lt; Anterior</button>
            <span> Página ${currentPage + 1} de ${totalPages} </span>
            <button class="btn" id="nextPage" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Próxima &gt;</button>
        `;

        document.getElementById("prevPage")?.addEventListener("click", () => { if (currentPage > 0) { currentPage--; renderPage(); }});
        document.getElementById("nextPage")?.addEventListener("click", () => { if (currentPage < totalPages - 1) { currentPage++; renderPage(); }});
    }

    document.getElementById("buscarAldeias").addEventListener("click", () => {
        const tags = tagsContainer.querySelectorAll('.tag');
        if (tags.length === 0) {
            document.getElementById("resultado").innerHTML = `<span style="color: red;">Selecione pelo menos um jogador, tribo ou coordenada.</span>`;
            document.getElementById("paginacao").innerHTML = "";
            document.getElementById("contadores").innerHTML = "";
            aldeiasComDistancia = [];
            return;
        }

        let aldeiasInimigas = [];
        
        tags.forEach(tag => {
            const tipo = tag.getAttribute('data-tipo');
            const id = tag.getAttribute('data-id');
            const coord = tag.getAttribute('data-coord');
            
            if (tipo === 'Jogador') {
                // Adicionar todas aldeias do jogador
                aldeiasInimigas.push(...villages.filter(v => v.playerId === parseInt(id)));
            } 
            else if (tipo === 'Tribo') {
                // Adicionar todas aldeias da tribo
                const playerIds = Object.values(players).filter(p => p.allyId === parseInt(id)).map(p => p.id);
                aldeiasInimigas.push(...villages.filter(v => playerIds.includes(v.playerId)));
            }
            else if (tipo === 'Coordenada' && coord) {
                // Adicionar aldeia específica pela coordenada
                const aldeia = coordMap[coord];
                if (aldeia) {
                    aldeiasInimigas.push(aldeia);
                }
            }
        });

        // Remover duplicatas
        aldeiasInimigas = aldeiasInimigas.filter((v, i, a) => 
            a.findIndex(t => t.id === v.id) === i
        );

        // Atualizar contadores
        atualizarContadores(aldeiasInimigas);

        aldeiasComDistancia = [];

        // Calcular distâncias para todas combinações
        minhasAldeias.forEach(minha => {
            aldeiasInimigas.forEach(inimiga => {
                const dist = distanciaCampos(minha, inimiga);
                aldeiasComDistancia.push({ inimiga, referencia: minha, dist });
            });
        });

        aldeiasComDistancia.sort((a, b) => a.dist - b.dist);
        currentPage = 0;
        renderPage();
    });
})();
