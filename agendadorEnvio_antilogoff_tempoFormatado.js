(function () {
    if (!window.TribalWars) {
        alert("Este script deve ser executado dentro do Tribal Wars.");
        return;
    }

    let agendamentoAtivo = null;
    let intervaloCountdown = null;

    // Função para converter "HH:MM:SS" em milissegundos
    function duracaoParaMs(str) {
        const [h, m, s] = str.split(":").map(Number);
        return ((h * 3600) + (m * 60) + s) * 1000;
    }

    // Cria o painel flutuante
    const painel = document.createElement("div");
    painel.id = "painel_agendador";
    painel.style = `
        position:fixed;
        top:100px;
        right:20px;
        width:320px;
        z-index:99999;
        background:white;
        border:2px solid #888;
        border-radius:8px;
        box-shadow:0 0 10px rgba(0,0,0,0.2);
        padding:12px;
        font-family:Arial;
        display:flex;
        flex-direction:column;
        gap:10px;
    `;

    painel.innerHTML = `
        <div id="ag_header" style="display:flex; justify-content:space-between; align-items:center; cursor:move;">
            <h2>Agendador de Envio de Tropas</h2>
            <button id="fechar_painel_ag" style="background:#f44336; color:white; border:none; border-radius:4px; padding:2px 6px; cursor:pointer;">✖</button>
        </div>
        <label>📅 Data alvo:<br><input id="ag_data" type="text" placeholder="19/07/2025" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;"></label>
        <label>⏰ Hora alvo:<br><input id="ag_hora" type="text" placeholder="14:33:00" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;"></label>
        <label>⚙️ Ajuste (ms):<br><input id="ajuste_fino" type="number" value="0" step="10" style="padding:5px; width:auto; border:1px solid #ccc; border-radius:5px;"></label>
        <div>
          <label><input type="radio" name="modo_agendamento" value="saida" checked>🚀Horário de saída</label>
          <label style="margin-left:10px;"><input type="radio" name="modo_agendamento" value="chegada">🎯Horário de chegada</label>
        </div>
        <div style="display:flex; gap:8px;">
            <button id="btn_salvar" class="btn" style="flex:1; background:#4CAF50; color:white; border:none; border-radius:5px; padding:6px;">💾 Salvar</button>
            <button id="btn_limpar" class="btn" style="flex:1; background:#f44336; color:white; border:none; border-radius:5px; padding:6px;">🗑️ Limpar</button>
        </div>
        <div id="lista_horarios" style="max-height:150px; overflow:auto; border:1px solid #ccc; padding:5px; background:#f9f9f9; border-radius:5px;"></div>
        <p id="ag_status" style="font-weight:bold;"></p>
    `;

    document.body.appendChild(painel);

    const status = document.getElementById("ag_status");

    // Painel arrastável
    (function tornarArrastavel(painel, handle) {
        let offsetX = 0, offsetY = 0, isDragging = false;

        handle.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - painel.offsetLeft;
            offsetY = e.clientY - painel.offsetTop;
            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                painel.style.left = `${e.clientX - offsetX}px`;
                painel.style.top = `${e.clientY - offsetY}px`;
                painel.style.right = "auto";
            }
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.userSelect = "";
        });
    })(painel, document.getElementById("ag_header"));

    document.getElementById("fechar_painel_ag").addEventListener("click", () => {
        if (agendamentoAtivo) {
            alert("⛔ Não é possível fechar o painel com agendamento ativo.");
        } else {
            painel.remove();
        }
    });

    document.getElementById("btn_salvar").addEventListener("click", () => {
        const data = document.getElementById("ag_data").value.trim();
        const hora = document.getElementById("ag_hora").value.trim();
        const ajuste = parseInt(document.getElementById("ajuste_fino").value, 10) || 0;

        if (!/\d{2}\/\d{2}\/\d{4}/.test(data) || !/\d{2}:\d{2}:\d{2}/.test(hora)) {
            status.textContent = "❌ Formato inválido. Use DD/MM/AAAA e hh:mm:ss";
            status.style.color = "red";
            return;
        }

        const lista = JSON.parse(localStorage.getItem("horarios_salvos") || "[]");
        lista.push({ data, hora, ajuste });
        localStorage.setItem("horarios_salvos", JSON.stringify(lista));
        
    // === ANTILOGOFF ===

    // 1. Ping ao servidor a cada 4 minutos
    setInterval(() => {
        fetch('/game.php?screen=overview')
            .then(() => console.log("[Ping] Sessão mantida"));
    }, 1000 * 60 * 4); // 4 minutos

    // 2. Simulação de movimento do mouse
    setInterval(() => {
        const evt = new MouseEvent('mousemove', { bubbles: true });
        document.dispatchEvent(evt);
        console.log("[Mouse] Movimento simulado");
    }, 1000 * 60 * 5); // 5 minutos

    // 3. Simulação de pressionamento de tecla
    setInterval(() => {
        const evt = new KeyboardEvent('keydown', { key: 'Shift' });
        document.dispatchEvent(evt);
        console.log("[Tecla] Pressionamento simulado");
    }, 1000 * 60 * 6); // 6 minutos

    atualizarLista();
    });

    document.getElementById("btn_limpar").addEventListener("click", () => {
        if (confirm("Deseja apagar todos os horários salvos?")) {
            localStorage.removeItem("horarios_salvos");
            
    /* // === ANTILOGOFF ===

    // 1. Ping ao servidor a cada 4 minutos
    setInterval(() => {
        fetch('/game.php?screen=overview')
            .then(() => console.log("[Ping] Sessão mantida"));
    }, 1000 * 60 * 4); // 4 minutos

    // 2. Simulação de movimento do mouse
    setInterval(() => {
        const evt = new MouseEvent('mousemove', { bubbles: true });
        document.dispatchEvent(evt);
        console.log("[Mouse] Movimento simulado");
    }, 1000 * 60 * 5); // 5 minutos

    // 3. Simulação de pressionamento de tecla
    setInterval(() => {
        const evt = new KeyboardEvent('keydown', { key: 'Shift' });
        document.dispatchEvent(evt);
        console.log("[Tecla] Pressionamento simulado");
    }, 1000 * 60 * 6); // 6 minutos */

    atualizarLista();
        }
    });

    function atualizarLista() {
        const container = document.getElementById("lista_horarios");
        const lista = JSON.parse(localStorage.getItem("horarios_salvos") || "[]");
        container.innerHTML = lista.length === 0 ? "<i>Nenhum horário salvo.</i>" : "";

        lista.forEach(({ data, hora, ajuste }, i) => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.marginBottom = "4px";
            div.innerHTML = `
                <span style="font-size:12px;">${data} ${hora} [${ajuste}ms]</span>
                <div style="display:flex; gap:3px;">
                    <button style="background:#2196F3; color:white; border:none; border-radius:4px; padding:2px 5px;" data-editar="${i}">✏️</button>
                    <button style="background:#4CAF50; color:white; border:none; border-radius:4px; padding:2px 5px;" data-agendar="${i}">▶️</button>
                    <button style="background:#f44336; color:white; border:none; border-radius:4px; padding:2px 5px;" data-remover="${i}">❌</button>
                </div>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll("[data-editar]").forEach(btn => {
            btn.onclick = () => {
                const { data, hora, ajuste } = lista[parseInt(btn.dataset.editar)];
                document.getElementById("ag_data").value = data;
                document.getElementById("ag_hora").value = hora;
                document.getElementById("ajuste_fino").value = ajuste;
            };
        });

        container.querySelectorAll("[data-remover]").forEach(btn => {
            btn.onclick = () => {
                lista.splice(parseInt(btn.dataset.remover), 1);
                localStorage.setItem("horarios_salvos", JSON.stringify(lista));
                
    /* // === ANTILOGOFF ===

    // 1. Ping ao servidor a cada 4 minutos
    setInterval(() => {
        fetch('/game.php?screen=overview')
            .then(() => console.log("[Ping] Sessão mantida"));
    }, 1000 * 60 * 4); // 4 minutos

    // 2. Simulação de movimento do mouse
    setInterval(() => {
        const evt = new MouseEvent('mousemove', { bubbles: true });
        document.dispatchEvent(evt);
        console.log("[Mouse] Movimento simulado");
    }, 1000 * 60 * 5); // 5 minutos

    // 3. Simulação de pressionamento de tecla
    setInterval(() => {
        const evt = new KeyboardEvent('keydown', { key: 'Shift' });
        document.dispatchEvent(evt);
        console.log("[Tecla] Pressionamento simulado");
    }, 1000 * 60 * 6); // 6 minutos
 */
    atualizarLista();
            };
        });

        container.querySelectorAll("[data-agendar]").forEach(btn => {
            btn.onclick = () => {
                agendarEnvio(lista[parseInt(btn.dataset.agendar)]);
            };
        });
    }

    function agendarEnvio({ data, hora, ajuste }) {
        const [sd, sm, sy] = document.getElementById("serverDate").textContent.split("/").map(Number);
        const [sh, smi, ss] = document.getElementById("serverTime").textContent.split(":").map(Number);
        const serverDate = new Date(sy, sm - 1, sd, sh, smi, ss);
        const offset = serverDate - new Date();

        // Pega o modo de agendamento selecionado
        const modo = document.querySelector('input[name="modo_agendamento"]:checked').value;

        // Pega a duração da viagem (tempo de viagem)
        const duracaoTexto = (() => {
            // tenta encontrar o tempo da viagem na tabela de comando
            // Ajuste o seletor conforme necessário na sua página
            const linhas = document.querySelectorAll("table.vis tr");
            for (const linha of linhas) {
                const celulas = linha.querySelectorAll("td");
                if (celulas.length === 2 && celulas[0].textContent.trim() === "Duração:") {
                    return celulas[1].textContent.trim();
                }
            }
            return "0:0:0";
        })();

        const tempoViagem = duracaoParaMs(duracaoTexto);

        const [td, tm, ty] = data.split("/").map(Number);
        const [th, tmin, ts] = hora.split(":").map(Number);
        const target = new Date(ty, tm - 1, td, th, tmin, ts);

        let horarioEnvio;
        if (modo === "chegada") {
            horarioEnvio = new Date(target.getTime() - tempoViagem);
        } else {
            horarioEnvio = target;
        }

        const millis = horarioEnvio - new Date() - offset + ajuste;

        if (millis < 0) {
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

        status.textContent = "⏳ Envio agendado...";
        status.style.color = "blue";
        desativarBotoes();

        agendamentoAtivo = setTimeout(() => {
            btn.click();
            status.textContent = `✔️ Tropas enviadas com ajuste de ${ajuste}ms!`;
            status.style.color = "green";
            agendamentoAtivo = null;
            reativarBotoes();
            removerBotaoCancelar();
        }, millis);

        intervaloCountdown = setInterval(() => {
            const restante = millis - (Date.now() - (target - millis));
            if (restante <= 0) {
                clearInterval(intervaloCountdown);
            } else {
                const segundos = Math.floor(restante / 1000);
                const dias = Math.floor(segundos / 86400);
                const horas = Math.floor((segundos % 86400) / 3600);
                const minutos = Math.floor((segundos % 3600) / 60);
                const seg = segundos % 60;

                let tempoStr = "⏳ Enviando em ";
                if (dias > 0) tempoStr += `${dias}d `;
                if (horas > 0 || dias > 0) tempoStr += `${horas}h `;
                if (minutos > 0 || horas > 0 || dias > 0) tempoStr += `${minutos}m `;
                tempoStr += `${seg}s`;

                status.innerHTML = tempoStr.trim();
            }
        }, 250);

        criarBotaoCancelar();
    }

    function cancelarAgendamento() {
        clearTimeout(agendamentoAtivo);
        clearInterval(intervaloCountdown);
        agendamentoAtivo = null;
        status.textContent = "❌ Agendamento cancelado.";
        status.style.color = "orange";
        reativarBotoes();
        removerBotaoCancelar();
    }

    function criarBotaoCancelar() {
        removerBotaoCancelar();
        const btnCancelar = document.createElement("button");
        btnCancelar.textContent = "🛑 Cancelar";
        btnCancelar.id = "cancelar_envio";
        btnCancelar.className = "btn";
        btnCancelar.style = "margin-top:5px; background:#ff9800; color:white; border:none; border-radius:5px; padding:6px; width:100%; cursor:pointer;";
        status.parentElement.appendChild(btnCancelar);
        btnCancelar.addEventListener("click", cancelarAgendamento);
    }

    function removerBotaoCancelar() {
        const b = document.getElementById("cancelar_envio");
        if (b) b.remove();
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
    }

    window.addEventListener("beforeunload", function (e) {
        if (agendamentoAtivo) {
            e.preventDefault();
            e.returnValue = "";
        }
    });

    
    // === ANTILOGOFF ===

    // 1. Ping ao servidor a cada 4 minutos
    setInterval(() => {
        fetch('/game.php?screen=overview')
            .then(() => console.log("[Ping] Sessão mantida"));
    }, 1000 * 60 * 4); // 4 minutos

    // 2. Simulação de movimento do mouse
    setInterval(() => {
        const evt = new MouseEvent('mousemove', { bubbles: true });
        document.dispatchEvent(evt);
        console.log("[Mouse] Movimento simulado");
    }, 1000 * 60 * 5); // 5 minutos

    // 3. Simulação de pressionamento de tecla
    setInterval(() => {
        const evt = new KeyboardEvent('keydown', { key: 'Shift' });
        document.dispatchEvent(evt);
        console.log("[Tecla] Pressionamento simulado");
    }, 1000 * 60 * 6); // 6 minutos

    atualizarLista();
})();
