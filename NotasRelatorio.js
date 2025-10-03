(function() {
    'use strict';

    const STORAGE_KEY = 'myAutoNotesStatus';

    // === Estilo customizado ===
    const style = document.createElement('style');
    style.textContent = `
    #myAN-painel { 
      position: fixed; top: 150px; left: 0; background: #2b2b2b; border: 2px solid #654321; border-left: none; 
      border-radius: 0 10px 10px 0; box-shadow: 2px 2px 8px #000; font-family: Verdana, sans-serif; color: #f1e1c1; 
      z-index: 9997; transition: transform 0.3s ease-in-out; transform: translateX(-200px); 
    }
    #myAN-toggle { 
      position: absolute; top: 0; right: -28px; width: 28px; height: 40px; background: #5c4023; 
      border: 2px solid #654321; border-left: none; border-radius: 0 6px 6px 0; color: #f1e1c1; 
      display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; box-shadow: 2px 2px 6px #000; 
    }
    #myAN-conteudo { padding: 8px; width: 180px; }
    #myAN-conteudo h4 { margin: 0 0 6px 0; font-size: 13px; text-align: center; border-bottom: 1px solid #654321; padding-bottom: 4px; }
    .myAN-btn { display: block; width: 100%; margin: 5px 0; background: #5c4023; border: 1px solid #3c2f2f; border-radius: 6px; 
      color: #f1e1c1; padding: 6px; cursor: pointer; font-size: 12px; text-align: center; }
    .myAN-btn.on { background: #2e7d32 !important; }
    .myAN-btn.off { background: #8b0000 !important; }
    .myAN-btn:hover { filter: brightness(1.1); }
    #myAN-painel.ativo { transform: translateX(0); }
    .myAN-status { font-size: 12px; margin-top: 6px; text-align: center; }
    #myAN-contador { font-size: 11px; margin-top: 3px; text-align: center; color: #aaa; }
    `;
    document.head.appendChild(style);

    // --- Cria o painel ---
    const painel = document.createElement('div');
    painel.id = 'myAN-painel';
    painel.innerHTML = `
        <div id="myAN-toggle">&#x25B6;</div>
        <div id="myAN-conteudo">
            <h4>Auto Notes</h4>
            <button class="myAN-btn" id="myAN-btn">Carregando...</button>
            <div class="myAN-status" id="myAN-status"></div>
        </div>
    `;
    document.body.appendChild(painel);

    const toggle = document.getElementById('myAN-toggle');
    const botao = document.getElementById('myAN-btn');
    const statusText = document.getElementById('myAN-status');

    // --- Funções de persistência ---
    function salvarEstado(status) {
        localStorage.setItem(STORAGE_KEY, status ? 'on' : 'off');
        atualizarBotao();
    }

    function obterEstado() {
        return localStorage.getItem(STORAGE_KEY) === 'on';
    }

    function atualizarBotao() {
        const ativo = obterEstado();
        botao.textContent = ativo ? 'Desativar' : 'Ativar';
        botao.classList.toggle('on', ativo);
        botao.classList.toggle('off', !ativo);
        statusText.textContent = ativo ? 'Ativo' : 'Desativado';
    }

    botao.addEventListener('click', () => {
        const novoEstado = !obterEstado();
        salvarEstado(novoEstado);
        if (novoEstado) start();
    });

    // --- Toggle do painel ---
    let aberto = false;
    toggle.addEventListener('click', () => {
        aberto = !aberto;
        painel.classList.toggle('ativo', aberto);
        toggle.innerHTML = aberto ? '&#x25C0;' : '&#x25B6;';
    });

    atualizarBotao();

    // --- Funções originais de notas ---
    function verificarPagina() {
        const urlValida = window.location.href.match(/(screen\=report){1}|(view\=){1}\w+/g);
        if (!urlValida || urlValida.length != 2) {
            UI.ErrorMessage("Abra o script dentro de um relatório válido", 5000);
            return false;
        }
        return true;
    }

    // === NOVA FUNÇÃO DE NOTA ===
    function gerarTextoNota() {
        // --- Título do relatório (nome da aldeia alvo) ---
        const titulo = $("#content_value table:eq(1) tr:eq(1)").text().trim();

        const textoRelatorio = $("#report_export_code").text();

        // --- Data da batalha (busca célula certa) ---
        const dataBatalha = $("td:contains('Data da batalha')").next().text().trim() || "Data não encontrada";

        // --- Resultado principal da batalha ---
        let resultado = $("#attack_results h3").text().trim();
        if (!resultado) {
            // fallback: procura dentro do bloco inteiro
            resultado = $("#attack_results").text().match(/Explorado|Vitória total|Perdas|Derrotado.*|Explorado/g)?.[0] || "Resultado desconhecido";
        }

        // Montagem da nota
        let nota = "";
        nota += "[b][size=6]" + resultado + "[/size][/b]\n\n";
        nota += "[i]Data da batalha " + dataBatalha + "[/i]\n\n";
        nota += "[b]" + titulo + "[/b]\n\n";
        nota += textoRelatorio;

        return nota;
    }

    function escreverNota() {
        const pos = game_data.player.sitter != "0" ? 4 : 3;
        const idAldeia = $("#attack_info_def > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)")
            .attr('href')
            .split("=")[pos];

        const urlAPI = game_data.player.sitter == "0"
            ? `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&h=${game_data.csrf}&client_time=${Math.round(Timing.getCurrentServerTime()/1000)}`
            : `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&t=${game_data.player.id}`;

        $.post(urlAPI, { note: gerarTextoNota(), village_id: idAldeia, h: game_data.csrf }, function() {
            UI.SuccessMessage("Nota criada com sucesso!", 2000);
        });
    }

    function start() {
        if (obterEstado() && verificarPagina()) {
            escreverNota();
        }
    }

    // --- Executa automaticamente se já estiver ativo ---
    if (obterEstado()) start();

})();
