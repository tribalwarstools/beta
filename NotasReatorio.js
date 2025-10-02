// ==UserScript==
// @name         Notas Automáticas de Relatórios TW
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Cria notas automáticas de relatórios, detectando tipo de aldeia
// @author       Giovani Guedes
// @match        *://*.tribalwars.com.br/game.php*screen=report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var LS_prefix = "xd";

    // Traduções
    var translations = {
        pt_BR: {
            unknown: "Desconhecido",
            verifyReportPage: "O script deve ser utilizado dentro de um relatório",
            offensive: "Ofensiva",
            defensive: "Defensiva",
            probOffensive: "Provavelmente Ofensiva",
            probDefensive: "Provavelmente Defensiva",
            noSurvivors: "Nenhuma tropa sobreviveu",
            watchtower: "Torre de Vigia",
            wall: "Muralha",
            firstChurch: "Igreja Principal",
            church: "Igreja",
            defensiveNukes: "Fulls de Defesa",
            noteCreated: "Nota criada"
        }
    };

    var _t = chave => translations.pt_BR[chave];

    // Script principal
    var CriarNotasRelatorio = {
        dados: {
            player: {
                nomePlayer: game_data.player.name,
                playerEstaAtacar: false,
                playerEstaDefender: false,
                playerQuerInfoAtacante: false,
                playerQuerInfoDefensor: false
            },
            aldeia: {
                ofensiva: { idAldeia: "-1", tipoAldeia: _t("unknown"), tropas: { totais: [], ofensivas: 0, defensivas: 0 } },
                defensiva: {
                    idAldeia: "-1",
                    tipoAldeia: _t("unknown"),
                    tropas: {
                        visiveis: false,
                        totais: [],
                        fora: { visiveis: false, ofensivas: 0, defensivas: 0, totais: [] },
                        dentro: { ofensivas: 0, defensivas: 0, totais: [] },
                        apoios: 0
                    },
                    edificios: { visiveis: false, torre: [false,0], igrejaPrincipal: [false,0], igreja: [false,0], muralha: [false,0] }
                }
            },
            mundo: { fazendaPorTropa: [], arqueirosAtivos: false }
        },

        verificarPagina: function() {
            var urlValida = window.location.href.match(/(screen\=report){1}|(view\=){1}\w+/g);
            if (!urlValida || urlValida.length != 2) {
                UI.ErrorMessage(_t("verifyReportPage"), 5000);
                return false;
            }
            return true;
        },

        initDadosScript: function() {
            var self = this;
            this.dados.mundo.arqueirosAtivos = game_data.units.includes("archer");
            var len = this.dados.mundo.arqueirosAtivos ? 10 : 8;

            this.dados.aldeia.ofensiva.tropas.totais = new Array(len).fill(0);
            this.dados.aldeia.defensiva.tropas.totais = new Array(len).fill(0);
            this.dados.aldeia.defensiva.tropas.fora.totais = new Array(len).fill(0);
            this.dados.aldeia.defensiva.tropas.dentro.totais = new Array(len).fill(0);

            this.dados.mundo.fazendaPorTropa = this.dados.mundo.arqueirosAtivos
                ? [1,1,1,1,2,4,5,6,5,8]
                : [1,1,1,2,4,6,5,8];

            // Detecta atacante e defensor
            var atacante = $("#attack_info_att > tbody > tr:nth-child(1) > th:nth-child(2) > a").text(),
                defensor = $("#attack_info_def > tbody > tr:nth-child(1) > th:nth-child(2) > a").text(),
                pos = game_data.player.sitter != "0" ? 4 : 3;

            self.dados.aldeia.ofensiva.idAldeia = $("#attack_info_att > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)").url().split("=")[pos];
            self.dados.aldeia.defensiva.idAldeia = $("#attack_info_def > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)").url().split("=")[pos];

            if (defensor == this.dados.player.nomePlayer) this.dados.player.playerEstaDefender = true;
            if (atacante == this.dados.player.nomePlayer) this.dados.player.playerEstaAtacar = true;

            // Verifica tropas visíveis defensivas
            if($("#attack_info_def_units > tbody > tr:nth-child(2) > td").length) this.dados.aldeia.defensiva.tropas.visiveis = true;
        },

        getTipoAldeia: function() {
            var def = this.dados.aldeia.defensiva.tropas;
            var ofs = this.dados.aldeia.ofensiva.tropas;

            // Defensiva
            if(def.visiveis){
                if(def.dentro.ofensivas > 3000) this.dados.aldeia.defensiva.tipoAldeia = _t("offensive");
                else if(def.dentro.ofensivas > 500) this.dados.aldeia.defensiva.tipoAldeia = _t("probOffensive");
                else if(def.dentro.defensivas > 1000) this.dados.aldeia.defensiva.tipoAldeia = _t("defensive");
                else if(def.dentro.defensivas > 500) this.dados.aldeia.defensiva.tipoAldeia = _t("probDefensive");
                else this.dados.aldeia.defensiva.tipoAldeia = _t("noSurvivors");
            } else {
                this.dados.aldeia.defensiva.tipoAldeia = _t("noSurvivors");
            }

            // Ofensiva
            if(ofs.ofensivas > ofs.defensivas) this.dados.aldeia.ofensiva.tipoAldeia = _t("offensive");
            else if(ofs.ofensivas < ofs.defensivas) this.dados.aldeia.ofensiva.tipoAldeia = _t("defensive");
        },

        gerarTextoNota: function() {
            var nota = "";
            var textoRelatorio = $("#report_export_code").text();
            var titulo = $("#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2)").text()
                .replace(/\s+/g, " ")
                .replace(/.{5}$/g, "");

            var tipoAldeia = this.dados.player.playerEstaAtacar || this.dados.player.playerQuerInfoDefensor
                ? this.dados.aldeia.defensiva.tipoAldeia
                : this.dados.aldeia.ofensiva.tipoAldeia;

            nota += " | [color=#" + (tipoAldeia == _t("offensive") || tipoAldeia == _t("probOffensive") ? "ff0000" : "0eae0e") + "][b]" + tipoAldeia + "[/b][/color] | ";
            
            var agora = new Date();
            nota += "[b][size=6]" + agora.toLocaleString() + "[/size][/b]\n\n[b]" + titulo + "[/b]";

            nota += textoRelatorio;

            return nota;
        },

        escreverNota: function() {
            var idAldeia = this.dados.player.playerEstaAtacar || this.dados.player.playerQuerInfoDefensor
                ? parseInt(this.dados.aldeia.defensiva.idAldeia)
                : parseInt(this.dados.aldeia.ofensiva.idAldeia);

            var urlAPI = game_data.player.sitter == "0"
                ? `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&h=${game_data.csrf}&client_time=${Math.round(Timing.getCurrentServerTime()/1000)}`
                : `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&t=${game_data.player.id}`;

            $.post(urlAPI, { note: this.gerarTextoNota(), village_id: idAldeia, h: game_data.csrf }, function() {
                UI.SuccessMessage(_t("noteCreated"), 2000);
            });
        },

        start: function() {
            if(this.verificarPagina()){
                this.initDadosScript();
                this.getTipoAldeia();
                this.escreverNota();
            }
        }
    };

    // Executa automaticamente
    CriarNotasRelatorio.start();

})();
