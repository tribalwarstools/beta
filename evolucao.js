(async function () {
const PAGE_SIZE = 50;
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
let currentPage = 1;
let cache = {};

// === Baixar arquivos ===
const [villRaw, playerRaw, allyRaw] = await Promise.all([
    fetch('/map/village.txt').then(r => r.text()),
    fetch('/map/player.txt').then(r => r.text()),
    fetch('/map/ally.txt').then(r => r.text())
]);

// === Tribos (usar TAG correta) ===
const tribes = {};
allyRaw.trim().split('\n').forEach(line => {
    const [id, name, tag] = line.split(',');
    if (tag) tribes[+id] = decodeURIComponent(tag.replace(/\+/g, " "));
});

// === Jogadores ===
const players = {};
playerRaw.trim().split('\n').forEach(line => {
    const [id, name, tribeId] = line.split(',');
    if (name.trim()) {
        players[+id] = {
            nome: decodeURIComponent(name.replace(/\+/g, " ")),
            tribo: tribes[+tribeId] || ""
        };
    }
});

// === Aldeias ===
const villages = villRaw.trim().split('\n').map(line => {
    const [id, name, x, y, player, points] = line.split(',');
    return { playerId: +player, points: +points };
});

// === Pontos e aldeias por jogador ===
const playerPoints = {};
const playerVillages = {};
for (let v of villages) {
    if (!playerPoints[v.playerId]) playerPoints[v.playerId] = 0;
    if (!playerVillages[v.playerId]) playerVillages[v.playerId] = 0;
    playerPoints[v.playerId] += v.points;
    playerVillages[v.playerId]++;
}

// === Estrutura inicial ===
let hoje = Date.now();
let jogadores = Object.keys(players).map(pid => {
    const id = +pid;
    const nome = players[id].nome;
    const tribo = players[id].tribo || "";
    const pontosAtuais = playerPoints[id] || 0;
    const aldeias = playerVillages[id] || 0;

    let status;
    if (aldeias === 0) status = `<img src="/graphic/dots/grey.png">`;
    else status = `<img src="/graphic/dots/blue.png">`;

    cache[id] = { points: pontosAtuais, lastUpdate: hoje };
    return { id, nome, tribo, pontos: pontosAtuais, aldeias, status, variacao: 0, tempoEstavel: "-", lastUpdate: hoje };
});

// === Layout ===
const html = `
    <div style="font-family: Verdana; font-size:12px; width:850px; height:600px;
                display:flex; flex-direction:column;">

        <style>
            #painelAtividade { display:flex; flex-direction:column; height:100%; }
            #painelHeader { flex:0 0 auto; border-bottom:1px solid #999; padding:5px; background:#f4f4f4; }
            #painelBody   { flex:1 1 auto; overflow-y:auto; padding:5px; }
            #painelFooter { flex:0 0 auto; border-top:1px solid #999; padding:5px; background:#f4f4f4; text-align:center; }

            #resultado table { table-layout: fixed; width: 100%; border-collapse: collapse; }
            #resultado th, #resultado td { text-align:left; padding:2px; word-break:break-word; }
            #resultado th:nth-child(1), #resultado td:nth-child(1) { width:25px; }
            #resultado th:nth-child(2), #resultado td:nth-child(2) { width:120px; }
            #resultado th:nth-child(3), #resultado td:nth-child(3) { width:60px; }
            #resultado th:nth-child(4), #resultado td:nth-child(4) { width:60px; }
            #resultado th:nth-child(5), #resultado td:nth-child(5) { width:60px; }
            #resultado th:nth-child(6), #resultado td:nth-child(6) { width:70px; }
            #resultado th:nth-child(7), #resultado td:nth-child(7) { width:60px; }
            #resultado th:nth-child(8), #resultado td:nth-child(8) { width:60px; }
        </style>

        <div id="painelAtividade">

            <!-- Cabeçalho fixo -->
            <div id="painelHeader">
                <h3 style="margin-top:0;">📊 Atividade dos Jogadores</h3>
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <input type="text" id="filtroNome" placeholder="Nome" style="width:100px; padding:2px;">
                    <input type="text" id="filtroTribo" placeholder="Tribo (TAG)" style="width:70px; padding:2px;">
                    <select id="filtroStatus" style="padding:2px;">
                        <option value="">Status</option>
                        <option value="green">Cresceu</option>
                        <option value="red">Perdeu</option>
                        <option value="yellow">Estável</option>
                        <option value="blue">Novo</option>
                        <option value="grey">Inativo</option>
                    </select>
                    <button id="btnExportar">💾</button>
                    <button id="btnImportar">📂</button>
                </div>
                <div id="statsLegenda"></div>
            </div>

            <!-- Conteúdo rolável -->
            <div id="painelBody">
                <div id="resultado"></div>
            </div>

            <!-- Rodapé fixo -->
            <div id="painelFooter">
                <div id="paginacao"></div>
            </div>

        </div>
    </div>
`;

if (typeof Dialog !== 'undefined') Dialog.show("atividade_jogadores", html);
else document.body.insertAdjacentHTML("beforeend", html);

// === Utils ===
function formatarData(ts) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// === Render ===
function renderPage(filtros = {}) {
    const { nome = "", status = "", tribo = "" } = filtros;
    let filtrados = jogadores.filter(j =>
        (j.nome || "").toLowerCase().includes(nome.toLowerCase()) &&
        (j.tribo || "").toLowerCase().includes(tribo.toLowerCase()) &&
        (status === "" || j.status.includes(status))
    );

    const stats = { blue:0, yellow:0, green:0, red:0, grey:0 };
    filtrados.forEach(j => {
        if(j.status.includes('blue')) stats.blue++;
        else if(j.status.includes('yellow')) stats.yellow++;
        else if(j.status.includes('green')) stats.green++;
        else if(j.status.includes('red')) stats.red++;
        else if(j.status.includes('grey')) stats.grey++;
    });

    const statsHtml = `
        <div style="display:flex; gap:15px;">
            <div><img src="/graphic/dots/blue.png"> Novo: ${stats.blue}</div>
            <div><img src="/graphic/dots/yellow.png"> Estável: ${stats.yellow}</div>
            <div><img src="/graphic/dots/green.png"> Cresceu: ${stats.green}</div>
            <div><img src="/graphic/dots/red.png"> Perdeu: ${stats.red}</div>
            <div><img src="/graphic/dots/grey.png"> Inativo: ${stats.grey}</div>
        </div>
    `;
    document.getElementById("statsLegenda").innerHTML = statsHtml;

    const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE);
    if (currentPage > totalPaginas) currentPage = totalPaginas || 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const slice = filtrados.slice(start, end);

    let tabela = `
        <p>Mostrando ${start+1} a ${Math.min(end, filtrados.length)} de ${filtrados.length}</p>
        <table class="vis">
            <thead><tr>
                <th></th><th>Jogador</th><th>Pontos</th><th>Aldeias</th><th>Var</th><th>Tempo</th><th>Atualizado</th><th>Tribo</th>
            </tr></thead>
            <tbody>
                ${slice.map(j => `
                    <tr>
                        <td>${j.status}</td>
                        <td><a href="/game.php?screen=info_player&id=${j.id}" target="_blank">${j.nome}</a></td>
                        <td>${j.pontos.toLocaleString()}</td>
                        <td>${j.aldeias}</td>
                        <td>${j.variacao>0?`+${j.variacao.toLocaleString()}`:j.variacao.toLocaleString()}</td>
                        <td>${j.tempoEstavel}</td>
                        <td>${formatarData(j.lastUpdate)}</td>
                        <td>${j.tribo}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
    document.getElementById("resultado").innerHTML = tabela;

    const paginacaoHtml = `
        <button class="btn" id="btnPrev" ${currentPage <= 1 ? "disabled" : ""}>Anterior</button>
        <span style="margin:0 8px;">Página ${currentPage} / ${totalPaginas||1}</span>
        <button class="btn" id="btnNext" ${currentPage >= totalPaginas ? "disabled" : ""}>Próxima</button>
    `;
    document.getElementById("paginacao").innerHTML = paginacaoHtml;

    document.getElementById("btnPrev")?.addEventListener("click",()=>{
        if(currentPage>1){currentPage--;renderPage(filtros);}
    });
    document.getElementById("btnNext")?.addEventListener("click",()=>{
        if(currentPage<totalPaginas){currentPage++;renderPage(filtros);}
    });
}

document.getElementById("btnExportar").addEventListener("click", exportCache);
document.getElementById("btnImportar").addEventListener("click", importCache);

["filtroNome","filtroTribo","filtroStatus"].forEach(id=>{
    document.getElementById(id).addEventListener("input",()=>{
        currentPage=1;
        renderPage({
            nome:document.getElementById("filtroNome").value,
            tribo:document.getElementById("filtroTribo").value,
            status:document.getElementById("filtroStatus").value
        });
    });
});

renderPage();

// === Exportar / Importar ===
function exportCache() {
    const dataStr = "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(jogadores, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.href = dataStr;
    dlAnchor.download = "tw_players_cache.json";
    dlAnchor.click();
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
                const imported = JSON.parse(evt.target.result);
                const agora = Date.now();
                const map = {};
                jogadores.forEach(j => map[j.id] = j);

                imported.forEach(j => {
                    const pontosAtuais = playerPoints[j.id] || j.pontos;
                    const aldeiasAtuais = playerVillages[j.id] || 0;
                    const variacao = pontosAtuais - (j.pontos || 0);

                    let status, tempoEstavel, lastUpdate;
                    if (aldeiasAtuais === 0) {
                        status = `<img src="/graphic/dots/grey.png">`;
                        tempoEstavel = "-";
                        lastUpdate = agora;
                    } else if (variacao > 0) {
                        status = `<img src="/graphic/dots/green.png">`; lastUpdate = agora; tempoEstavel = "0d";
                    } else if (variacao < 0) {
                        status = `<img src="/graphic/dots/red.png">`; lastUpdate = agora; tempoEstavel = "0d";
                    } else {
                        lastUpdate = j.lastUpdate || agora;
                        const diff = agora - lastUpdate;
                        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
                        status = diff > ONE_WEEK ? `<img src="/graphic/dots/grey.png">` : `<img src="/graphic/dots/yellow.png">`;
                        tempoEstavel = dias + "d";
                    }

                    cache[j.id] = { points: pontosAtuais, lastUpdate };
                    map[j.id] = {
                        id: j.id,
                        nome: j.nome,
                        tribo: j.tribo || "",
                        pontos: pontosAtuais,
                        aldeias: aldeiasAtuais,
                        status,
                        variacao,
                        tempoEstavel,
                        lastUpdate
                    };
                });

                jogadores = Object.values(map);
                currentPage = 1;
                renderPage();
            } catch (err) {
                alert("Erro ao importar: " + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
})();
