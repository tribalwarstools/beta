var DadosScript = {
    nome: "Notas automáticas de relatórios",
    versao: "",
    ultimaAtualizacao: "",
    autor: "",
    contatoAutor: ""
};

var PREFIXO_LS = "";

// Traduções apenas em português brasileiro
var traducoes = {
    pt_BR: {
        desconhecido: "Desconhecido",
        verificarPagina: "O script deve ser utilizado dentro de um relatório",
        ofensiva: "Ofensiva",
        defensiva: "Defensiva",
        provavelmenteOfensiva: "Provavelmente Ofensiva",
        provavelmenteDefensiva: "Provavelmente Defensiva",
        nenhumaSobreviveu: "Nenhuma tropa sobreviveu",
        torre: "Torre de Vigia",
        muralha: "Muralha",
        igrejaPrincipal: "Igreja Principal",
        igreja: "Igreja",
        fullsDefesa: "Fulls de Defesa",
        notaCriada: "Nota criada",
        adicionarRelatorio: "Adicionar relatório na:"
    }
};

// Função de tradução
var _t = chave => traducoes.pt_BR[chave];

// Inicialização de tradução
var inicializarTraducoes = () => {
    if (!localStorage.getItem(`${PREFIXO_LS}_avisoIdioma`)) {
        localStorage.setItem(`${PREFIXO_LS}_avisoIdioma`, 1);
    }
};

// Script principal
var CriarNotasRelatorio = {
    dados: {
        jogador: { nome: game_data.player.name, estaAtacando: false, estaDefendendo: false, querInfoAtacante: false, querInfoDefensor: false },
        aldeia: {
            ofensiva: { id: "-1", tipo: _t("desconhecido"), tropas: { totais: [], ofensivas: 0, defensivas: 0 } },
            defensiva: { 
                id: "-1", 
                tipo: _t("desconhecido"), 
                tropas: { visiveis: false, totais: [], fora: { visiveis: false, ofensivas: 0, defensivas: 0, totais: [] }, dentro: { ofensivas: 0, defensivas: 0, totais: [] }, apoios: 0 },
                edificios: { visiveis: false, torre: [false,0], igrejaPrincipal: [false,0], igreja: [false,0], muralha: [false,0] }
            }
        },
        mundo: { fazendaPorTropa: [], arqueirosAtivos: false }
    },
    configs: { esconderTropas: false },

    verificarPagina: function() {
        var urlValida = window.location.href.match(/(screen\=report){1}|(view\=){1}\w+/g);
        if (!urlValida || urlValida.length != 2) {
            UI.ErrorMessage(_t("verificarPagina"), 5000);
            return false;
        }
        return true;
    },

    initConfigs: function() {
        this.configs.esconderTropas = this.loadConfigLS("esconderTropas", false);
    },

    loadConfigLS: (chave, valorPadrao) => localStorage.getItem(`${PREFIXO_LS}_${chave}`) ?? valorPadrao,

    iniciarDadosScript: function() {
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

        self.dados.aldeia.ofensiva.id = $("#attack_info_att > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)").url().split("=")[pos];
        self.dados.aldeia.defensiva.id = $("#attack_info_def > tbody > tr:nth-child(2) > td:nth-child(2) > span > a:nth-child(1)").url().split("=")[pos];

        if (defensor == this.dados.jogador.nome) this.dados.jogador.estaDefendendo = true;
        if (atacante == this.dados.jogador.nome) this.dados.jogador.estaAtacando = true;
    },

    gerarTextoNota: function() {
        var nota = "",
            textoRelatorio = $("#report_export_code").text(),
            titulo = $("#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2)").text().replace(/\s+/g, " ").replace(/.{5}$/g, "");

        var tipoAldeia = this.dados.jogador.estaAtacando || this.dados.jogador.querInfoDefensor
            ? this.dados.aldeia.defensiva.tipo
            : this.dados.aldeia.ofensiva.tipo;

        nota += " | [color=#" + (tipoAldeia == _t("ofensiva") || tipoAldeia == _t("provavelmenteOfensiva") ? "ff0000" : "0eae0e") + "][b]" + tipoAldeia + "[/b][/color] | ";
        nota += "[b][size=6]xD[/size][/b]\n\n[b]" + titulo + "[/b]";
        nota += textoRelatorio;

        return nota;
    },

    escreverNota: function() {
        var idAldeia = this.dados.jogador.estaAtacando || this.dados.jogador.querInfoDefensor
            ? parseInt(this.dados.aldeia.defensiva.id)
            : parseInt(this.dados.aldeia.ofensiva.id);

        var urlAPI = game_data.player.sitter == "0"
            ? `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&h=${game_data.csrf}&client_time=${Math.round(Timing.getCurrentServerTime()/1000)}`
            : `https://${location.hostname}/game.php?village=${game_data.village.id}&screen=api&ajaxaction=village_note_edit&t=${game_data.player.id}`;

        $.post(urlAPI, { note: this.gerarTextoNota(), village_id: idAldeia, h: game_data.csrf }, function() {
            UI.SuccessMessage(_t("notaCriada"), 2000);
        });
    },

    start: function() {
        if (this.verificarPagina()) {
            this.iniciarDadosScript();
            this.escreverNota();
        }
    }
};

// Inicializa e executa
inicializarTraducoes();
CriarNotasRelatorio.start();
