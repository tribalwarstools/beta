javascript:
(function() {
    // Ler do localStorage
    const coordsSalvas = localStorage.getItem("coordsSalvas") || "500|500";
    const tropasSalvas = localStorage.getItem("tropasSalvas");

    // Inicializa units com todos 0, só spy com 5 como no original
    var units = {
        spear: [0, 0],
        sword: [0, 0],
        axe: [0, 0],
        archer: [0, 0],
        spy: [0, 0],
        light: [0, 0],
        marcher: [0, 0],
        heavy: [0, 0],
        ram: [0, 0],
        catapult: [0, 0],
        knight: [0, 0],
        snob: [0, 0]
    };

    // Se houver tropas salvas, atualizar os valores em units
    if (tropasSalvas) {
        try {
            const tropas = JSON.parse(tropasSalvas);
            Object.keys(tropas).forEach(unidade => {
                if (units.hasOwnProperty(unidade)) {
                    units[unidade][0] = tropas[unidade];  // quantidade disponível na posição [0]
                }
            });
        } catch(e) {
            alert("Erro ao ler tropas salvas: " + e);
        }
    }

    // Atualiza coords para as coordenadas salvas
    var options = {
        coords: coordsSalvas,
        protect: false,
        getCoords: true,
        villagePoints: {
            min: 0,
            max: 12350
        }
    };

    var win = window.frames.length > 0 ? window.main : window,
        data = win.game_data;

    var func = {
        insert: function(n, a) {
            win.$("[name=" + n + "]").val(a);
        },
        total: function(n) {
            return win.$("input[name=" + n + "]").next().text().match(/([0-9]+)/)[1];
        },
        redir: function(n) {
            location.search = "?village=" + data.village.id + "&screen=" + n;
        },
        check: function(n) {
            return win.$("input[name=" + n + "]").length > 0 ? 1 : 0;
        },
        getCoords: function() {
            var n = [];
            win.$("table[class=map] td:has(a[onmouseover*=Map.map_popup])").each(function(a, t) {
                if (e = t.innerHTML.match(/map_popup\((.?)\)\"/i)) {
                    var e = e[0].split(","),
                        i = parseInt(e[4], 10),
                        o = String(e[1].match(/\d+\|\d+/)),
                        r = (r = e[5].match(/\'(.+)\s\(/)) ? r[1] : null;
                    r || (
                        (!options.villagePoints.min || i >= options.villagePoints.min) &&
                        (!options.villagePoints.max || i <= options.villagePoints.max) &&
                        n.push(o)
                    );
                }
            });
            alert(n.length > 0 ? n.join(" ") : "Sem abandonadas para obter coordenadas!");
        }
    };

    if (data.screen == "place") {
        if (win.$("div[style=red]").length > 0) {
            win.$("div[style*=red]").remove();
            win.$("[name=x]").val("");
            win.$("[name=y]").val("");
        }

        if (options.protect && win.$("[width=300] [href*=player]").length > 0) {
            func.redir("place");
        } else {
            win.$("[name=submit]").click();
        }

        if ("" == win.$("[name=x]").val() && win.$("[name=support]").length > 0) {
            win.$.each(units, function(n, a) {
                if (func.check(n)) {
                    a[1] ? func.insert(n, func.total(n)) : (func.total(n), a[0], func.insert(n, a[0]));
                }
            });

            coords = options.coords.split(" ");
            nome = "FastFarm" + data.world;
            num = win.$.cookie(nome);
            if (null == num || num >= coords.length) {
                num = 0;
            }

            coord = coords[num].split("|");
            func.insert("x", coord[0]);
            func.insert("y", coord[1]);
            win.$.cookie(nome, parseInt(num) + 1, { expires: 10 });
            win.$("[name=attack]").click();
        }
    } else if (data.screen == "map" && options.getCoords) {
        func.getCoords();
    } else {
        func.redir("place");
    }
})();
