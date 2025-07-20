(function () {
    if (!window.TribalWars) {
        alert("Este script deve ser executado dentro do Tribal Wars.");
        return;
    }

    let agendamentoAtivo = null;
    let intervaloCountdown = null;

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
        <div style="display:flex; flex-direction:column; gap:12px; font-family:Arial; padding:5px 10px">
            <label style="font-weight:bold;">
                📅 Data alvo (DD/MM/AAAA):<br>
                <input id="ag_data" type="text" placeholder="19/07/2025" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;">
            </label>
            <label style="font-weight:bold;">
                ⏰ Hora alvo (hh:mm:ss):<br>
                <input id="ag_hora" type="text" placeholder="14:33:00" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;">
            </label>
            <label style="font-weight:bold;">
                ⚙️ Ajuste fino (ms) – Negativo adianta, positivo atrasa:<br>
                <input id="ajuste_fino" type="number" value="0" step="10" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;">
            </label>
            <div style="display:flex; gap:10px; justify-content:space-between;">
                <button id="btn_salvar" class="btn" style="flex:1; background:#4CAF50; color:white; border:none; border-radius:5px; padding:8px; cursor:pointer;">💾 Salvar horário</button>
                <button id="btn_limpar" class="btn" style="flex:1; background:#f44336; color:white; border:none; border-radius:5px; padding:8px; cursor:pointer;">🗑️ Limpar todos</button>
            </div>
            <div id="lista_horarios" style="max-height:150px; overflow:auto; border:1px solid #ccc; padding:5px; background:#f9f9f9; border-radius:5px; font-size: 9px; "></div>
            <p id="ag_status" style="margin-top:10px; font-weight:bold;"></p>
        </div>
    `;

    Dialog.show("agendador_envio", html);

// Impede o fechamento do Dialog se houver agendamento ativo
setTimeout(() => {
    const dialog = document.querySelector("#popup_box_agendador_envio");
    const fechar = dialog?.querySelector(".popup_box_close");

    if (fechar) {
        fechar.addEventListener("click", (e) => {
            if (agendamentoAtivo) {
                e.stopImmediatePropagation();
                e.preventDefault();
                alert("⛔ Você não pode fechar essa janela enquanto o agendamento estiver ativo.");
            }
        });
    }
}, 100);


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
                <div style="display:flex; gap:4px;">
                    
                    <button class="btn" style="background:#4CAF50; color:white; border:none; border-radius:4px; padding:2px 6px;" data-agendar="${i}">▶️ Agendar</button>
                    <button class="btn" style="background:#f44336; color:white; border:none; border-radius:4px; padding:2px 6px;" data-remover="${i}">❌</button>
					<button class="btn" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:2px 6px;" data-editar="${i}">✏️</button>
					
                </div>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll("[data-remover]").forEach(btn => {
            btn.addEventListener("click", () => {
                removerHorario(parseInt(btn.dataset.remover));
            });
        });

        container.querySelectorAll("[data-editar]").forEach(btn => {
            btn.addEventListener("click", () => {
                const { data, hora, ajuste } = lista[parseInt(btn.dataset.editar)];
                document.getElementById("ag_data").value = data;
                document.getElementById("ag_hora").value = hora;
                document.getElementById("ajuste_fino").value = ajuste;
            });
        });

        container.querySelectorAll("[data-agendar]").forEach(btn => {
            btn.addEventListener("click", () => {
                agendarEnvio(lista[parseInt(btn.dataset.agendar)], true);
            });
        });
    }

    function agendarEnvio({ data: dataStr, hora: horaStr, ajuste: ajusteFino }, mostrarCancelar = false) {
        const syncTime = () => {
            const serverDateStr = document.getElementById("serverDate")?.textContent;
            const serverTimeStr = document.getElementById("serverTime")?.textContent;

            if (!serverDateStr || !serverTimeStr) {
                status.textContent = "❌ Erro ao obter hora do servidor.";
                status.style.color = "red";
                reativarBotoes();
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
                reativarBotoes();
                return;
            }

            const btn = document.getElementById("troop_confirm_submit");
            if (!btn) {
                status.textContent = "❌ Botão de envio não encontrado.";
                status.style.color = "red";
                reativarBotoes();
                return;
            }

            const tempoFinal = Date.now() + millisUntilTarget;
            status.textContent = `⏳ Envio agendado...`;
            status.style.color = "blue";

            desativarBotoes();

            intervaloCountdown = setInterval(() => {
                const restante = tempoFinal - Date.now();
                if (restante <= 0) {
                    clearInterval(intervaloCountdown);
                } else {
                    status.innerHTML = `⏳ Enviando em ${Math.ceil(restante / 1000)}s (${restante}ms)`;
                }
            }, 200);

            agendamentoAtivo = setTimeout(() => {
                btn.click();
                status.textContent = `✔️ Tropas enviadas com ajuste de ${ajusteFino}ms!`;
                status.style.color = "green";
                clearInterval(intervaloCountdown);
                removerBotaoCancelar();
                reativarBotoes();
                agendamentoAtivo = null;
            }, millisUntilTarget);

            if (mostrarCancelar) {
                criarBotaoCancelar();
            }
        };

        syncTime();
    }

    function cancelarAgendamento() {
        clearTimeout(agendamentoAtivo);
        clearInterval(intervaloCountdown);
        agendamentoAtivo = null;
        status.textContent = "❌ Agendamento cancelado.";
        status.style.color = "orange";
        reativarBotoes();
    }

    function criarBotaoCancelar() {
        removerBotaoCancelar();
        const btnCancelar = document.createElement("button");
        btnCancelar.textContent = "🛑 Cancelar";
        btnCancelar.id = "cancelar_envio";
        btnCancelar.style.marginTop = "10px";
        btnCancelar.className = "btn btn-confirm-no";
        status.parentElement.appendChild(btnCancelar);
        btnCancelar.addEventListener("click", cancelarAgendamento);
    }

    function removerBotaoCancelar() {
        const btnCancelar = document.getElementById("cancelar_envio");
        if (btnCancelar) btnCancelar.remove();
    }

    function desativarBotoes() {
        document.getElementById("btn_salvar").disabled = true;
        document.getElementById("btn_limpar").disabled = true;
        document.querySelectorAll("[data-agendar], [data-editar], [data-remover]").forEach(b => b.disabled = true);
    }

    function reativarBotoes() {
        document.getElementById("btn_salvar").disabled = false;
        document.getElementById("btn_limpar").disabled = false;
        document.querySelectorAll("[data-agendar], [data-editar], [data-remover]").forEach(b => b.disabled = false);
        removerBotaoCancelar();
    }




    atualizarLista();
window.addEventListener("beforeunload", function (e) {
    if (agendamentoAtivo) {
        e.preventDefault();
        e.returnValue = ""; // Requerido para exibir o alerta em navegadores modernos
        return "";
    }
});

})();