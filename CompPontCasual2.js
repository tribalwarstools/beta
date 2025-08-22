(async function () {
    if (!window.game_data) return alert("Execute este script dentro do Tribal Wars.");

    // --- Configurações persistentes ---
    let limitePercentual = parseFloat(localStorage.getItem("casualLimitePercentual")) || 300; 
    let onlyLiberados = localStorage.getItem("casualOnlyLiberados") === "1";

    // --- Sua pontuação ---
    const minhaPontuacao = parseInt(game_data.player.points, 10);

    // --- Buscar jogadores (/map/player.txt) ---
    const playerRaw = await fetch('/map/player.txt').then(r => r.text());
    const jogadores = playerRaw.trim().split("\n").map(linha => {
        const [id, nome, tribo, aldeias, pontos, rank] = linha.split(",");
        return {
            id: +id,
            nome: decodeURIComponent((nome || "").replace(/\+/g, " ")), 
            tribo: +tribo,
            aldeias: +aldeias,
            pontos: +pontos,
            rank: +rank
        };
    });

    // --- Buscar tribos (/map/tribe.txt) ---
    const tribeRaw = await fetch('/map/tribe.txt').then(r => r.text());
    const tribosMap = {};
    tribeRaw.trim().split("\n").forEach(linha => {
        const [id, nome, , , , , ,] = linha.split(",");
        tribosMap[id] = decodeURIComponent((nome || "").replace(/\+/g, " "));
    });

    // --- Função para verificar ataque ---
    function estaBloqueado(pontosMeus, pontosOutro, limitePct) {
        if (limitePct <= 0) return false; // limite 0 = ninguém bloqueado
        const menor = Math.min(pontosMeus, pontosOutro);
        const maxPermitido = menor * (limitePct / 100);
        return Math.abs(pontosMeus - pontosOutro) > maxPermitido;
    }

    function podeAtacar(p1, p2, limitePct) {
        return !estaBloqueado(p1, p2, limitePct);
    }

    // --- Calcula alcance permitido ---
    function calcularAlcance(pontos, limitePct) {
        if (limitePct <= 0) return { min: "Todos", max: "Todos" }; // todos liberados
        const L = limitePct / 100;
        const min = Math.floor(pontos / (1 + L));
        const max = Math.floor(pontos * (1 + L));
        return { min, max };
    }

    // --- Criar interface melhorada ---
    function criarInterface() {
        // Remover painel existente se houver
        const existingPanel = document.getElementById('painelCasualTw');
        if (existingPanel) existingPanel.remove();
        
        const alcance = calcularAlcance(minhaPontuacao, limitePercentual);
        
        const panelHTML = `
            <div id="painelCasualTw" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
            ">
                <div style="
                    background: #2c3e50;
                    color: white;
                    padding: 15px;
                    border-radius: 10px 10px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h2 style="margin: 0; font-size: 1.2rem;">Comparador de Pontuação (Casual)</h2>
                    <button id="fecharPainel" style="
                        background: none;
                        border: none;
                        color: white;
                        font-size: 1.5rem;
                        cursor: pointer;
                    ">×</button>
                </div>
                
                <div style="padding: 15px; overflow-y: auto;">
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 15px;
                        margin-bottom: 15px;
                    ">
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                            <h3 style="margin: 0 0 8px 0; color: #2c3e50;">Seus Dados</h3>
                            <p style="margin: 4px 0;">Pontuação: <b>${minhaPontuacao.toLocaleString()}</b></p>
                            <p style="margin: 4px 0;">Alcance: <b>${alcance.min.toLocaleString()} - ${alcance.max.toLocaleString()}</b></p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                            <h3 style="margin: 0 0 8px 0; color: #2c3e50;">Configurações</h3>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                <div>
                                    <label>Limite (%):
                                        <input id="limiteInput" type="number" value="${limitePercentual}" min="0" max="1000" style="width: 70px; padding: 5px;">
                                    </label>
                                </div>
                                <div>
                                    <label style="display: flex; align-items: center; gap: 5px;">
                                        <input id="chkLiberados" type="checkbox" ${onlyLiberados ? "checked" : ""}>
                                        Apenas liberados
                                    </label>
                                </div>
                                <button id="salvarBtn" style="padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Aplicar</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <input id="filtroInput" type="text" placeholder="Filtrar por nome..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                        <select id="triboFilter" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Todas as tribos</option>
                        </select>
                        <select id="statusFilter" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Todos</option>
                            <option value="liberado">Liberados</option>
                            <option value="bloqueado">Bloqueados</option>
                        </select>
                    </div>
                    
                    <div id="estatisticas" style="background: #e8f4fc; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 0.9rem;">
                        Carregando estatísticas...
                    </div>
                    
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f2f2f2;">
                                    <th style="padding: 10px; text-align: left; cursor: pointer;" data-sort="nome">Jogador ↕</th>
                                    <th style="padding: 10px; text-align: right; cursor: pointer;" data-sort="pontos">Pontos ↕</th>
                                    <th style="padding: 10px; text-align: center; cursor: pointer;" data-sort="aldeias">Aldeias ↕</th>
                                    <th style="padding: 10px; text-align: center; cursor: pointer;" data-sort="tribo">Tribo ↕</th>
                                    <th style="padding: 10px; text-align: center; cursor: pointer;" data-sort="rank">Rank ↕</th>
                                    <th style="padding: 10px; text-align: center; cursor: pointer;" data-sort="status">Status ↕</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaJogadores">
                                <tr><td colspan="6" style="text-align: center; padding: 20px;">Carregando jogadores...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div id="paginacao" style="display: flex; justify-content: center; margin-top: 15px; gap: 5px;"></div>
                </div>
            </div>
            <div id="overlayCasualTw" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
            "></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        
        // Preencher filtro de tribos com nomes
        const tribosUnicas = [...new Set(jogadores.map(j => j.tribo))].filter(t => t !== 0).sort();
        const triboFilter = document.getElementById('triboFilter');
        
        tribosUnicas.forEach(triboId => {
            const option = document.createElement('option');
            option.value = triboId;
            option.textContent = tribosMap[triboId] || `Tribo ${triboId}`;
            triboFilter.appendChild(option);
        });
        
        // Event listeners
        document.getElementById('fecharPainel').addEventListener('click', fecharPainel);
        document.getElementById('overlayCasualTw').addEventListener('click', fecharPainel);
        document.getElementById('salvarBtn').addEventListener('click', salvarConfiguracoes);
        document.getElementById('filtroInput').addEventListener('input', filtrarJogadores);
        document.getElementById('triboFilter').addEventListener('change', filtrarJogadores);
        document.getElementById('statusFilter').addEventListener('change', filtrarJogadores);
        document.getElementById('chkLiberados').addEventListener('change', () => {
            onlyLiberados = document.getElementById('chkLiberados').checked;
            filtrarJogadores();
        });
        
        // Ordenação
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const campo = th.getAttribute('data-sort');
                ordenarJogadores(campo);
            });
        });
        
        // Inicializar
        filtrarJogadores();
    }
    
    function fecharPainel() {
        const panel = document.getElementById('painelCasualTw');
        const overlay = document.getElementById('overlayCasualTw');
        if (panel) panel.remove();
        if (overlay) overlay.remove();
    }
    
    function salvarConfiguracoes() {
        limitePercentual = parseFloat(document.getElementById('limiteInput').value) || 0;
        onlyLiberados = document.getElementById('chkLiberados').checked;
        
        localStorage.setItem('casualLimitePercentual', String(limitePercentual));
        localStorage.setItem('casualOnlyLiberados', onlyLiberados ? '1' : '0');
        
        filtrarJogadores();
    }
    
    let jogadoresFiltrados = [];
    let ordenacaoCampo = 'rank';
    let ordenacaoDirecao = 'asc';
    const itensPorPagina = 20;
    let paginaAtual = 1;
    
    function filtrarJogadores() {
        const filtroTexto = document.getElementById('filtroInput').value.toLowerCase();
        const filtroTribo = document.getElementById('triboFilter').value;
        const filtroStatus = document.getElementById('statusFilter').value;
        
        jogadoresFiltrados = jogadores.filter(j => {
            // Filtro por texto
            if (filtroTexto && !j.nome.toLowerCase().includes(filtroTexto)) return false;
            
            // Filtro por tribo
            if (filtroTribo && j.tribo != filtroTribo) return false;
            
            // Verificar status
            const liberado = podeAtacar(minhaPontuacao, j.pontos, limitePercentual);
            
            // Filtro por status
            if (filtroStatus === 'liberado' && !liberado) return false;
            if (filtroStatus === 'bloqueado' && liberado) return false;
            
            // Filtro "apenas liberados"
            if (onlyLiberados && !liberado) return false;
            
            return true;
        });
        
        // Atualizar estatísticas
        const total = jogadoresFiltrados.length;
        const liberados = jogadoresFiltrados.filter(j => 
            podeAtacar(minhaPontuacao, j.pontos, limitePercentual)).length;
        
        document.getElementById('estatisticas').innerHTML = `
            Total: <b>${total}</b> jogadores | 
            Liberados: <b style="color: #27ae60;">${liberados}</b> | 
            Bloqueados: <b style="color: #e74c3c;">${total - liberados}</b>
        `;
        
        // Ordenar e paginar
        ordenarJogadores(ordenacaoCampo, true);
    }
    
    function ordenarJogadores(campo, manterDirecao = false) {
        if (!manterDirecao) {
            if (ordenacaoCampo === campo) {
                ordenacaoDirecao = ordenacaoDirecao === 'asc' ? 'desc' : 'asc';
            } else {
                ordenacaoCampo = campo;
                ordenacaoDirecao = 'asc';
            }
        }
        
        jogadoresFiltrados.sort((a, b) => {
            let valorA, valorB;
            
            if (campo === 'nome') {
                valorA = a.nome.toLowerCase();
                valorB = b.nome.toLowerCase();
            } else if (campo === 'status') {
                valorA = podeAtacar(minhaPontuacao, a.pontos, limitePercentual) ? 1 : 0;
                valorB = podeAtacar(minhaPontuacao, b.pontos, limitePercentual) ? 1 : 0;
            } else if (campo === 'tribo') {
                // Ordenar por nome da tribo em vez do ID
                valorA = tribosMap[a.tribo] || `Tribo ${a.tribo}`;
                valorB = tribosMap[b.tribo] || `Tribo ${b.tribo}`;
            } else {
                valorA = a[campo];
                valorB = b[campo];
            }
            
            if (valorA < valorB) return ordenacaoDirecao === 'asc' ? -1 : 1;
            if (valorA > valorB) return ordenacaoDirecao === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Atualizar indicadores de ordenação
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.textContent = th.textContent.replace(/ [↕↟↡]$/, '');
            if (th.getAttribute('data-sort') === campo) {
                th.textContent += ordenacaoDirecao === 'asc' ? ' ↟' : ' ↡';
            } else {
                th.textContent += ' ↕';
            }
        });
        
        paginaAtual = 1;
        renderizarTabela();
    }
    
    function renderizarTabela() {
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = Math.min(inicio + itensPorPagina, jogadoresFiltrados.length);
        const tbody = document.getElementById('tabelaJogadores');
        
        tbody.innerHTML = '';
        
        if (jogadoresFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhum jogador encontrado</td></tr>';
            document.getElementById('paginacao').innerHTML = '';
            return;
        }
        
        for (let i = inicio; i < fim; i++) {
            const j = jogadoresFiltrados[i];
            const liberado = podeAtacar(minhaPontuacao, j.pontos, limitePercentual);
            const statusClass = liberado ? 'style="color: #27ae60;"' : 'style="color: #e74c3c;"';
            const statusText = liberado ? 'Liberado' : 'Bloqueado';
            const link = `game.php?screen=info_player&id=${j.id}`;
            const nomeTribo = tribosMap[j.tribo] || (j.tribo ? `Tribo ${j.tribo}` : '-');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    <a href="${link}" target="_blank" style="color: #3498db; text-decoration: none;">${j.nome}</a>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${j.pontos.toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${j.aldeias}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${nomeTribo}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${j.rank}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;" ${statusClass}>${statusText}</td>
            `;
            tbody.appendChild(row);
        }
        
        renderizarPaginacao();
    }
    
    function renderizarPaginacao() {
        const totalPaginas = Math.ceil(jogadoresFiltrados.length / itensPorPagina);
        const paginacao = document.getElementById('paginacao');
        
        if (totalPaginas <= 1) {
            paginacao.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Botão anterior
        if (paginaAtual > 1) {
            html += `<button class="pagina-btn" data-pagina="${paginaAtual - 1}" style="padding: 5px 10px; border: 1px solid #ddd; background: #f8f9fa; cursor: pointer;">‹</button>`;
        }
        
        // Páginas
        const inicioPagina = Math.max(1, paginaAtual - 2);
        const fimPagina = Math.min(totalPaginas, inicioPagina + 4);
        
        for (let i = inicioPagina; i <= fimPagina; i++) {
            if (i === paginaAtual) {
                html += `<button class="pagina-btn" data-pagina="${i}" style="padding: 5px 10px; border: 1px solid #3498db; background: #3498db; color: white; cursor: pointer;">${i}</button>`;
            } else {
                html += `<button class="pagina-btn" data-pagina="${i}" style="padding: 5px 10px; border: 1px solid #ddd; background: #f8f9fa; cursor: pointer;">${i}</button>`;
            }
        }
        
        // Próximo botão
        if (paginaAtual < totalPaginas) {
            html += `<button class="pagina-btn" data-pagina="${paginaAtual + 1}" style="padding: 5px 10px; border: 1px solid #ddd; background: #f8f9fa; cursor: pointer;">›</button>`;
        }
        
        paginacao.innerHTML = html;
        
        // Adicionar event listeners aos botões de paginação
        paginacao.querySelectorAll('.pagina-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                paginaAtual = parseInt(btn.getAttribute('data-pagina'));
                renderizarTabela();
            });
        });
    }
    
    // Iniciar a interface
    criarInterface();
})();
