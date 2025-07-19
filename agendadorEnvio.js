(function () {
    if (!window.TribalWars) {
        alert("Este script deve ser executado dentro do Tribal Wars.");
        return;
    }

    const salvarHorario = (data, hora, ajuste) => {
        const lista = JSON.parse(localStorage.getItem("horarios_salvos") || "[]");
        lista.push({ data, hora, ajuste });
        localStorage.setItem("horarios_salvos", JSON.stringify(lista));
        atualizarLista();
    };

    const removerHorario = (index) => {
        const lista = JSON.parse(localStorage.getItem("horarios_salvos") || "[]");
        lista.splice(index, 1);
        localStorage.setItem("horarios_salvos", JSON.stringify(lista));
        atualizarLista();
    };

    const limparHorarios = () => {
        localStorage.removeItem("horarios_salvos");
        atualizarLista();
    };

    const html = `
        <div style="display:flex; flex-direction:column; gap:10px">
            <label>Data alvo (DD/MM/AAAA):<br><input id="ag_data" type="text" placeholder="19/07/2025"></label>
            <label>Hora alvo (hh:mm:ss):<br><input id="ag_hora" type="text" placeholder="14:33:00"></label>
            <label>Ajuste fino (ms) – Negativo adianta, positivo atrasa:<br>
                <input id="ajuste_fino" type="number" value="0" step="10">
            </label>
            <div style="display:flex; gap:10px">
                <button id="btn_salvar">💾 Salvar horário</button>
                <button id="btn_limpar">🗑️ Limpar todos</button>
            </div>
            <div id="lista_horarios" style="max-height:150px; overflow:auto; border:1px solid #ccc; padding:5px"></div>
            <p id="ag_status" style="margin-top:10px; font-weight:bold;"></p>
        </div>
    `;

    Dialog.show("agendador_envio", html);

    const status = document.getElementById("ag_status");

    document.getElementById("btn_salvar").addEventListener("click", () => {
        const data = document.getElementById("ag_data").value.trim();
        const hora = document.getElementById("ag_hora").value.trim();
        const ajuste = parseInt(document.getElementById("ajuste_fino").value, 10) || 0;

        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data) || !/^\d{2}:\d{2}:\d{2}$/.test(hora)) {
            status.textContent = "❌ Formato inválido. Use DD/MM/AAAA e hh:mm:ss";
            status.style.color = "red";
            return;
        }

        salvarHorario(data, hora, ajuste);
    });

    document.getElementById("btn_limpar").addEventListener("click", () => {
        if (confirm("Tem certeza que deseja apagar todos os horários salvos?")) {
            limparHorarios();
        }
    });

    function atualizarLista() {
        const container = document.getElementById("lista_horarios");
        const lista = JSON.parse(localStorage.getItem("horarios_salvos") || "[]");

        if (lista.length === 0) {
            container.innerHTML = "<i>Nenhum horário salvo.</i>";
            return;
        }

        container.innerHTML = "";

        lista.forEach(({ data, hora, ajuste }, i) => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.marginBottom = "4px";
            div.innerHTML = `
                <span>${data} ${hora} [${ajuste}ms]</span>
                <div>
                    <button data-agendar="${i}">▶️ Agendar</button>
                    <button data-remover="${i}">❌</button>
                </div>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll("[data-remover]").forEach(btn => {
            btn.addEventListener("click", () => {
                removerHorario(parseInt(btn.dataset.remover));
            });
        });

        container.querySelectorAll("[data-agendar]").forEach(btn => {
            btn.addEventListener("click", () => {
                const { data, hora, ajuste } = lista[parseInt(btn.dataset.agendar)];
                agendarEnvio(data, hora, ajuste);
            });
        });
    }

    function agendarEnvio(dataStr, horaStr, ajusteFino) {
        const syncTime = () => {
            const serverDateStr = document.getElementById("serverDate")?.textContent;
            const serverTimeStr = document.getElementById("serverTime")?.textContent;

            if (!serverDateStr || !serverTimeStr) {
                status.textContent = "❌ Erro ao obter hora do servidor.";
                status.style.color = "red";
                return;
            }

            const [sd, sm, sy] = serverDateStr.split("/").map(Number);
            const [sh, smi, ss] = serverTimeStr.split(":").map(Number);
            const serverDate = new Date(sy, sm - 1, sd, sh, smi, ss);
            const localNow = new Date();
            const offset = serverDate.getTime() - localNow.getTime();

            const [td, tm, ty] = dataStr.split("/").map(Number);
            const [th, tmin, ts] = horaStr.split(":").map(Number);
            const targetDate = new Date(ty, tm - 1, td, th, tmin, ts);
            const nowLocal = new Date();

            let millisUntilTarget = targetDate.getTime() - (nowLocal.getTime() + offset) + ajusteFino;

            if (millisUntilTarget < 0) {
                status.textContent = "⛔ Já passou do horário alvo!";
                status.style.color = "red";
                return;
            }

            const btn = document.getElementById("troop_confirm_submit");
            if (!btn) {
                status.textContent = "❌ Botão de envio não encontrado.";
                status.style.color = "red";
                return;
            }

            const tempoFinal = Date.now() + millisUntilTarget;

            status.textContent = `⏳ Envio agendado...`;
            status.style.color = "blue";

            const countdown = setInterval(() => {
                const restante = tempoFinal - Date.now();
                if (restante <= 0) {
                    clearInterval(countdown);
                } else {
                    status.textContent = `⏳ Enviando em ${Math.ceil(restante / 1000)}s (${restante}ms)`;
                }
            }, 200);

            setTimeout(() => {
                btn.click();
                status.textContent = `✔️ Tropas enviadas com ajuste de ${ajusteFino}ms!`;
                status.style.color = "green";
                clearInterval(countdown);
            }, millisUntilTarget);
        };

        syncTime();
    }

    atualizarLista();
})();
