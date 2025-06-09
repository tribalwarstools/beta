(async function () {
    const villRaw = await fetch('/map/village.txt').then(r => r.text());
    const villages = villRaw.trim().split('\n').map(line => {
        const [id, name, x, y, player, points] = line.split(',');
        return {
            id,
            coord: `${x}|${y}`,
            points: parseInt(points)
        };
    });

    const groups = [];
    const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
    groupData.result.forEach(group => {
        groups.push({ group_id: group.group_id, group_name: group.name });
    });

    const html = `
        <div class="vis" style="padding: 10px; width: 800px;">
            <h2>Grupos de Aldeias versão 1.3</h2>
            <label for="groupSelect"><b>Selecione um grupo:</b></label><br>
            <select id="groupSelect" style="
                margin-top: 5px;
                padding: 4px;
                background: #f4e4bc;
                color: #000;
                border: 1px solid #603000;
                font-weight: bold;
            ">
                <option disabled selected>Selecione...</option>
            </select>
            <span id="villageCount" style="margin-left: 10px; font-weight: bold;">0 aldeias</span>
            <hr>
            <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
    `;
    Dialog.show("tw_group_viewer", html);

    const select = document.getElementById("groupSelect");
    const villageCountSpan = document.getElementById("villageCount");

    // Desabilitar o placeholder "Selecione..."
    select.options[0].disabled = true;

    // Adicionar manualmente a opção "Todas as aldeias"
    const allOpt = document.createElement("option");
    allOpt.value = 0;
    allOpt.textContent = "Todas as aldeias";
    select.appendChild(allOpt);

    // Adicionar os demais grupos, desabilitando os vazios
    groups.forEach(g => {
        if (g.group_id != 0) {
            const opt = document.createElement("option");
            opt.value = g.group_id;
            opt.textContent = g.group_name;

            // Se texto vazio ou só espaços, desabilitar opção
            if (!opt.textContent.trim()) {
                opt.disabled = true;
                opt.textContent = "";
                opt.style.color = "#999";
            }

            select.appendChild(opt);
        }
    });

    select.addEventListener("change", async function () {
        const groupId = this.value;
        $("#groupVillages").html("<i>Carregando aldeias...</i>");
        villageCountSpan.textContent = "Carregando...";

        const response = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", {
            group_id: groupId
        });

        const doc = new DOMParser().parseFromString(response.html, "text/html");
        const rows = doc.querySelectorAll("#group_table tbody tr");

        if (!rows.length) {
            $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
            villageCountSpan.textContent = "0 aldeias";
            return;
        }

        let output = `<table class="vis" width="100%" style="font-size: 13px;">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th style="width: 110px;">Coordenadas</th>
                    <th>Pontos</th>
                </tr>
            </thead>
            <tbody>`;

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (tds.length >= 2) {
                const name = tds[0].textContent.trim();
                const coords = tds[1].textContent.trim();

                const village = villages.find(v => v.coord === coords);
                const points = village ? village.points : 0;
                const villageId = village ? village.id : null;

                const maxPoints = 10000;
                const pct = Math.min(points, maxPoints) / maxPoints * 100;

                const progressBar = `
                    <div style="background: #ddd; border-radius: 4px; width: 100px; height: 12px; position: relative;">
                        <div style="
                            background: #4caf50;
                            width: ${pct}%;
                            height: 100%;
                            border-radius: 4px;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            text-align: center;
                            font-size: 10px;
                            line-height: 12px;
                            color: #000;
                            font-weight: bold;
                            user-select: none;
                        ">
                            ${points}
                        </div>
                    </div>
                `;

                const nameLink = villageId
                    ? `<a href="/game.php?village=${game_data.village.id}&screen=overview&intro&target=${villageId}" target="_blank">${name}</a>`
                    : name;

                const coordLink = villageId
                    ? `<a href="/game.php?village=${game_data.village.id}&screen=info_village&id=${villageId}" target="_blank" style="font-size: 13px;"><b>${coords}</b></a>`
                    : `<b style="font-size: 13px;">${coords}</b>`;

                output += `<tr><td>${nameLink}</td><td>${coordLink}</td><td>${progressBar}</td></tr>`;
            }
        });
        output += `</tbody></table>`;

        $("#groupVillages").html(output);
        villageCountSpan.textContent = `${rows.length} aldeia${rows.length > 1 ? 's' : ''}`;
    });
})();
