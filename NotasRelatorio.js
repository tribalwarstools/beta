(function() {
    'use strict';

    function verificarPagina() {
        const urlValida = window.location.href.match(/(screen\=report){1}|(view\=){1}\w+/g);
        if (!urlValida || urlValida.length != 2) {
            UI.ErrorMessage("Abra o script dentro de um relatório válido", 5000);
            return false;
        }
        return true;
    }

    function gerarTextoNota() {
        const titulo = $("#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2)")
            .text()
            .replace(/\s+/g, " ")
            .replace(/.{5}$/g, "");

        const textoRelatorio = $("#report_export_code").text();
        const agora = new Date();

        let nota = "";
        nota += "[b][size=6]" + agora.toLocaleString() + "[/size][/b]\n\n";
        nota += "[b]" + titulo + "[/b]\n\n";
        nota += textoRelatorio;

        return nota;
    }

    function escreverNota() {
        // pega aldeia do defensor (id está no relatório)
        const pos = game_data.player.sitter != "0" ? 4 : 3;
        const idAldeia = $("#attack_info_def > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)")
            .url()
            .split("=")[pos];

        const urlAPI = game_data.player.sitter == "0"
            ? `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&h=${game_data.csrf}&client_time=${Math.round(Timing.getCurrentServerTime()/1000)}`
            : `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&t=${game_data.player.id}`;

        $.post(urlAPI, { note: gerarTextoNota(), village_id: idAldeia, h: game_data.csrf }, function() {
            UI.SuccessMessage("Nota criada com sucesso!", 2000);
        });
    }

    function start() {
        if (verificarPagina()) {
            escreverNota();
        }
    }

    // Executa automaticamente ao abrir relatório
    start();

})();
