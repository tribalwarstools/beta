(async function () {
    const savedGroupId = localStorage.getItem("tw_group_selected");

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
        <style>
            #tw_group_viewer, 
            #tw_group_viewer .vis {
                max-width: 800px !important;
                overflow-x: hidden !important;
                box-sizing: border-box;
            }
            #groupVillages table.vis {
                width: 100%;
                table-layout: fixed;
                font-size: 13px;
                border-collapse: collapse;
            }
            #groupVillages table.vis th, 
            #groupVillages table.vis td {
                padding: 4px 6px;
                border: 1px solid #aaa;
                overflow-wrap: break-word;
                word-wrap: break-word;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            #groupVillages table.vis th:nth-child(1) { width: 38%; }
            #groupVillages table.vis th:nth-child(2) { width: 22%; }
            #groupVillages table.vis th:nth-child(3) { width: 18%; white-space: normal; }
            #groupVillages table.vis th:nth-child(4) { width: 22%; white-space: nowrap; }
            #groupVillages td > button.btn {
                min-width: 30px;
                margin-right: 4px;
                padding: 2px 6px;
                font-size: 12px;
            }
        </style>
        <div class="vis" style="padding: 10px; width: 800px;">
            <h2>Grupos de Aldeias versão 3.3</h2>
            <label for="groupSelect"><b>Selecione um grupo:</b></label><br>
            <select id="groupSelect" style="
                margin-top: 5px;
                padding: 4px;
                background: #f4e4bc;
                color: #000;
                border: 1px solid #603000;
                font-weight: bold;
                max-width: 100%;
                box-sizing: border-box;
            ">
                <option disabled selected>Selecione...</option>
            </select>
            <span id="villageCount" style="margin-left: 10px; font-weight: bold;">0 aldeias</span>
            <hr>
            <div id="groupVillages" style="max-height: 300px; overflow-y: auto; overflow-x: hidden;"></div>
            <button id="copyAllCoords" class="btn btn-default" style="margin-top: 10px; display: none;">
                📋 Copiar todas as coordenadas
            </button>
            <button id="closeAndGo" class="btn btn-confirm" style="margin-top: 10px; float: right;">
                Fechar e ir para o grupo
            </button>
        </div>
    `;
    Dialog.show("tw_group_viewer", html);

    const select = document.getElementById("groupSelect");
    const villageCountSpan = document.getElementById("villageCount");
    const copyAllButton = document.getElementById("copyAllCoords");
    const closeAndGoButton = document.getElementById("closeAndGo");

    select.options[0].disabled = true;

    const allOpt = document.createElement("option");
    allOpt.value = 0;
    allOpt.textContent = "Todas as aldeias";
    select.appendChild(allOpt);

    groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.group_id;
        opt.textContent = g.group_name || "[Sem nome]";
        if (!opt.textContent.trim()) {
            opt.disabled = true;
            opt.textContent = "";
            opt.style.color = "#999";
        }
        select.appendChild(opt);
    });

    async function loadGroup(groupId) {
        if (!groupId) return;
        select.value = groupId;

        $("#groupVillages").html("<i>Carregando aldeias...</i>");
        villageCountSpan.textContent = "Carregando...";
        copyAllButton.style.display = "none";

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

        let output = `<table class="vis"><thead>
            <tr><th>Nome</th><th>Coordenadas</th><th>Pontos</th><th>Comandos</th></tr>
        </thead><tbody>`;

        const allCoords = [];

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (tds.length >= 2) {
                const name = tds[0].textContent.trim();
                const coords = tds[1].textContent.trim();
                allCoords.push(coords);

                const village = villages.find(v => v.coord === coords);
                const points = village ? village.points : 0;
                const villageId = village ? village.id : null;
                const pct = Math.min(points, 10000) / 100;

                const nameLink = villageId
                    ? `<a href="/game.php?village=${villageId}&screen=overview" target="_blank">${name}</a>`
                    : name;

                const coordLink = villageId
                    ? `<a href="/game.php?village=${game_data.village.id}&screen=info_village&id=${villageId}" target="_blank"><b>${coords}</b></a>`
                    : `<b>${coords}</b>`;

                const progressBar = `
                    <div style="background:#ddd;border-radius:4px;width:100px;height:12px;position:relative;">
                        <div style="background:#4caf50;width:${pct}%;height:100%;border-radius:4px;"></div>
                        <div style="position:absolute;top:0;left:0;width:100%;height:100%;text-align:center;font-size:10px;line-height:12px;font-weight:bold;">
                            ${points}
                        </div>
                    </div>`;

                const commandsButtons = `
                    <button class="btn btn-default" title="Copiar" onclick="navigator.clipboard.writeText('${coords}')">📋</button>
                    <button class="btn btn-default" title="Abrir" onclick="window.open('/game.php?village=${villageId}&screen=overview','_blank')">🏠</button>
                    <button class="btn btn-default" title="Info" onclick="window.open('/game.php?village=${game_data.village.id}&screen=info_village&id=${villageId}','_blank')">ℹ️</button>
                `;

                output += `<tr><td>${nameLink}</td><td>${coordLink}</td><td>${progressBar}</td><td>${commandsButtons}</td></tr>`;
            }
        });

        output += `</tbody></table>`;
        $("#groupVillages").html(output);
        villageCountSpan.textContent = `${rows.length} aldeia${rows.length > 1 ? 's' : ''}`;

        copyAllButton.style.display = "inline-block";
        copyAllButton.onclick = () => {
            navigator.clipboard.writeText(allCoords.join(' '));
            UI.SuccessMessage("Coordenadas copiadas!");
        };
    }

    select.addEventListener("change", () => {
        const groupId = select.value;
        localStorage.setItem("tw_group_selected", groupId);
        loadGroup(groupId);
    });

    closeAndGoButton.addEventListener("click", () => {
        const selectedId = select.value;
        if (!selectedId) {
            UI.ErrorMessage("Selecione um grupo antes!");
            return;
        }
        Dialog.close();
        window.location.href = `/game.php?village=${game_data.village.id}&screen=overview_villages&mode=combined&group=${selectedId}`;
    });

    // Se havia grupo salvo, carrega automaticamente
    if (savedGroupId) {
        localStorage.removeItem("tw_group_selected");
        loadGroup(savedGroupId);
    }
})();
