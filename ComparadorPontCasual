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

    // --- Painel ---
    function abrirPainel() {
        const alcance = calcularAlcance(minhaPontuacao, limitePercentual);

        const html = `
            <h2>Comparador de Pontuação (Casual)</h2>
            <p>Sua pontuação: <b>${minhaPontuacao.toLocaleString()}</b></p>

            <label>Limite atual (%):
                <input id="limiteInput" type="number" value="${limitePercentual}" min="0" max="1000" style="width:90px">
            </label>
            <button id="salvarBtn">Salvar</button>
            <label style="margin-left:12px;">
                <input id="chkLiberados" type="checkbox" ${onlyLiberados ? "checked" : ""}>
                Mostrar só liberados
            </label>

            <div style="margin-top:8px;">
                <small><b>Alcance atual</b>: ${alcance.min.toString()} – ${alcance.max.toString()} pontos</small>
            </div>

            <div style="margin-top:10px;">
                <label>🔍 Buscar jogador: 
                    <input id="filtroInput" type="text" placeholder="Digite o nome..." style="width:220px">
                </label>
            </div>

            <hr>
            <div id="resultado" style="max-height:440px; overflow:auto;"></div>
            <style>
                .tw-ok { background: rgba(60, 179, 113, 0.18); }
                .tw-no { background: rgba(220, 20, 60, 0.12); }
                .tw-table th, .tw-table td { padding: 4px 6px; }
            </style>
        `;
        Dialog.show("painel_casual", html);

        document.getElementById("salvarBtn").onclick = () => {
            limitePercentual = parseFloat(document.getElementById("limiteInput").value) || 0;
            localStorage.setItem("casualLimitePercentual", String(limitePercentual));
            analisar();
        };

        document.getElementById("chkLiberados").onchange = (e) => {
            onlyLiberados = e.target.checked;
            localStorage.setItem("casualOnlyLiberados", onlyLiberados ? "1" : "0");
            analisar();
        };

        document.getElementById("filtroInput").oninput = () => analisar();

        analisar(); // primeira renderização
    }

    // --- Renderizar tabela ---
    function analisar() {
        const res = document.getElementById("resultado");
        const filtro = (document.getElementById("filtroInput")?.value || "").toLowerCase();
        const alcance = calcularAlcance(minhaPontuacao, limitePercentual);

        const alcHtml = `<p style="margin:6px 0 10px;">
            <small><b>Alcance recalculado</b>: ${alcance.min} – ${alcance.max}</small>
        </p>`;

        let saida = `${alcHtml}
            <p style="margin:0 0 6px;"><small>Limite atual: <b>${limitePercentual}%</b> (regra de <i>diferença</i> baseada no menor)</small></p>
            <table class="vis tw-table" width="100%">
                <tr><th>Jogador</th><th>Pontos</th><th>Status</th></tr>`;

        const ordenados = jogadores.slice().sort((a, b) => Math.abs(a.pontos - minhaPontuacao) - Math.abs(b.pontos - minhaPontuacao));

        ordenados.forEach(j => {
            if (filtro && !j.nome.toLowerCase().includes(filtro)) return;

            const liberado = podeAtacar(minhaPontuacao, j.pontos, limitePercentual);
            if (onlyLiberados && !liberado) return;

            const cls = liberado ? "tw-ok" : "tw-no";
            const status = liberado ? "✅ Ataque Liberado" : "❌ Bloqueado";
            const link = `game.php?screen=info_player&id=${j.id}`;

            saida += `<tr class="${cls}">
                        <td><a href="${link}">${j.nome}</a></td>
                        <td>${j.pontos.toLocaleString()}</td>
                        <td>${status}</td>
                      </tr>`;
        });

        saida += `</table>`;
        res.innerHTML = saida;
    }

    abrirPainel();
})();
