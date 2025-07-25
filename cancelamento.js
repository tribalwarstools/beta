(function () {
    'use strict';

    if (!/screen=place|screen=overview/.test(window.location.href)) return;

    const salvarConfig = (cfg) => localStorage.setItem('tw_cancelamento_auto', JSON.stringify(cfg));
    const carregarConfig = () => JSON.parse(localStorage.getItem('tw_cancelamento_auto') || '{}');

    const formatar = (timestamp) => {
        const d = new Date(timestamp);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    };

    let timeoutId = null;

    const criarPainel = () => {
        const container = document.createElement('div');
        container.style = `
            position:fixed;
            top:60px;
            right:20px;
            background:#f4e4bc;
            padding:10px;
            border:1px solid #804000;
            border-radius:4px;
            z-index:9999;
            font-size:12px;
            width:260px;
            font-family:Tahoma, Verdana, sans-serif;
            box-shadow: 2px 2px 4px rgba(0,0,0,0.3)
        `;

        container.innerHTML = `
            <div id="cabecalho_cancelamento" style="font-weight:bold;font-size:13px;margin-bottom:5px;color:#522;cursor:move;">
                ⏱️ Cancelamento em Horário Específico
            </div>
            <label>Horário para cancelar (HH:MM:SS):<br>
                <div style="display:flex;gap:5px;margin-top:4px;margin-bottom:6px;">
                    <input id="hora" type="number" min="0" max="23" placeholder="HH" style="width:45px;padding:4px;text-align:center;">
                    <input id="minuto" type="number" min="0" max="59" placeholder="MM" style="width:45px;padding:4px;text-align:center;">
                    <input id="segundo" type="number" min="0" max="59" placeholder="SS" style="width:45px;padding:4px;text-align:center;">
                </div>
            </label>
            <div id="cancel_previa" style="font-size:11px;color:#333;padding:4px 0;"></div>
            <button id="btn_agendar_cancel" style="
                width:100%;
                padding:5px;
                margin-top:6px;
                background:#d4c097;
                color:#000;
                border:1px solid #a38b5f;
                border-radius:3px;
                font-weight:bold;
                cursor:pointer;
            ">🕒 Agendar Cancelamento</button>
            <button id="btn_cancelar_cancel" style="
                width:100%;
                padding:5px;
                margin-top:5px;
                background:#e0b9b9;
                color:#000;
                border:1px solid #a66;
                border-radius:3px;
                font-weight:bold;
                cursor:pointer;
            ">❌ Remover Agendamento</button>
        `;

        document.body.appendChild(container);
        arrastarPainel(container, document.getElementById('cabecalho_cancelamento'));

        const inputHora = document.getElementById('hora');
        const inputMinuto = document.getElementById('minuto');
        const inputSegundo = document.getElementById('segundo');
        const btnAgendar = document.getElementById('btn_agendar_cancel');
        const btnRemover = document.getElementById('btn_cancelar_cancel');
        const painelPrev = document.getElementById('cancel_previa');

        const cfg = carregarConfig();
        if (cfg.ativo && cfg.cancelar) {
            const d = new Date(cfg.cancelar);
            inputHora.value = d.getHours();
            inputMinuto.value = d.getMinutes();
            inputSegundo.value = d.getSeconds();
            btnAgendar.disabled = true;
            btnRemover.disabled = false;
        } else {
            btnAgendar.disabled = false;
            btnRemover.disabled = true;
        }

        btnAgendar.onclick = () => {
            const h = parseInt(inputHora.value);
            const m = parseInt(inputMinuto.value);
            const s = parseInt(inputSegundo.value);

            if (
                isNaN(h) || isNaN(m) || isNaN(s) ||
                h < 0 || h > 23 ||
                m < 0 || m > 59 ||
                s < 0 || s > 59
            ) {
                alert("Informe um horário válido: 00:00:00 até 23:59:59.");
                return;
            }

            const agora = new Date();
            const alvo = new Date();
            alvo.setHours(h, m, s, 0);

            if (alvo.getTime() <= agora.getTime()) {
                alert("⛔ O horário deve ser no futuro.");
                return;
            }

            salvarConfig({ cancelar: alvo.getTime(), ativo: true, cancelado: false });
            btnAgendar.disabled = true;
            btnRemover.disabled = false;
            alert("✅ Cancelamento agendado para " + formatar(alvo.getTime()));
            atualizarPainel();
            iniciarChecagem();
        };

        btnRemover.onclick = () => {
            salvarConfig({ ativo: false });
            btnAgendar.disabled = false;
            btnRemover.disabled = true;
            painelPrev.innerHTML = '❌ Agendamento removido.';
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            alert("❌ Agendamento removido.");
        };
    };

    const atualizarPainel = () => {
        const cfg = carregarConfig();
        const painel = document.getElementById('cancel_previa');
        if (!painel) return;

        if (cfg.ativo && cfg.cancelar) {
            const agora = Date.now();
            const restante = Math.max(0, Math.floor((cfg.cancelar - agora) / 1000));
            painel.innerHTML = `
                ⏰ Cancelamento agendado para: <b>${formatar(cfg.cancelar)}</b><br>
                ⏳ Tempo restante: <b>${restante}s</b>
            `;
        } else {
            painel.innerHTML = 'Nenhum cancelamento agendado.';
        }
    };

    const checarCancelamento = () => {
        const cfg = carregarConfig();
        if (!cfg.ativo || !cfg.cancelar || cfg.cancelado) {
            timeoutId = null;
            atualizarPainel();
            return;
        }

        const agora = Date.now();

        if (agora >= cfg.cancelar) {
            const botoes = document.querySelectorAll('a[href*="action=cancel"]');
            if (botoes.length > 0) {
                botoes[0].click();
                cfg.cancelado = true;
                salvarConfig(cfg);
                console.log('❌ Cancelamento executado!');
                atualizarPainel();
                timeoutId = null;
                return;
            } else {
                console.warn('⚠️ Nenhum botão de cancelamento encontrado.');
            }
        }

        atualizarPainel();
        timeoutId = setTimeout(checarCancelamento, 200); // ⏱️ mais preciso
    };

    const iniciarChecagem = () => {
        if (!timeoutId) {
            checarCancelamento();
        }
    };

    const arrastarPainel = (elemento, cabecalho) => {
        let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

        const mouseDown = (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        };

        const mouseMove = (e) => {
            e.preventDefault();
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            startX = e.clientX;
            startY = e.clientY;
            elemento.style.top = (elemento.offsetTop + offsetY) + "px";
            elemento.style.left = (elemento.offsetLeft + offsetX) + "px";
        };

        const mouseUp = () => {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
        };

        cabecalho.addEventListener('mousedown', mouseDown);
    };

    criarPainel();
    iniciarChecagem();
})();
