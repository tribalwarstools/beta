(function () {
    if (!window.TribalWars) {
        alert("Este script deve ser executado dentro do Tribal Wars.");
        return;
    }

    const html = `
        <div style="display:flex; flex-direction:column; gap:10px">
            <label>Data alvo (DD/MM/AAAA):<br><input id="ag_data" type="text" placeholder="19/07/2025"></label>
            <label>Hora alvo (hh:mm:ss):<br><input id="ag_hora" type="text" placeholder="14:33:00"></label>
            <label>Ajuste fino (ms) <br> Negativo adianta, positivo atrasa:<br>
                <input id="ajuste_fino" type="number" value="0" step="10">
            </label>
            <button id="ag_iniciar" class="btn btn-confirm-yes" >Agendar envio</button>
            <p id="ag_status" style="margin-top:10px; font-weight:bold;"></p>
        </div>
    `;

    Dialog.show("agendador_envio", html);

    document.getElementById("ag_iniciar").addEventListener("click", () => {
        const dataStr = document.getElementById("ag_data").value.trim();
        const horaStr = document.getElementById("ag_hora").value.trim();
        const ajusteFino = parseInt(document.getElementById("ajuste_fino").value, 10) || 0;
        const status = document.getElementById("ag_status");

        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr) || !/^\d{2}:\d{2}:\d{2}$/.test(horaStr)) {
            status.textContent = "❌ Formato inválido. Use DD/MM/AAAA e hh:mm:ss";
            status.style.color = "red";
            return;
        }

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
    });
})();
