(function() {
    'use strict';

    if (!window.location.href.includes('screen=place') && !window.location.href.includes('screen=overview')) return;

    const salvarConfig = (cfg) => localStorage.setItem('tw_agendamento', JSON.stringify(cfg));
    const carregarConfig = () => JSON.parse(localStorage.getItem('tw_agendamento') || '{}');

    const criarPainel = () => {
        const container = document.createElement('div');
        container.style = 'position:fixed;top:60px;right:20px;background:#f4f4f4;padding:10px;border:2px solid #444;z-index:9999;font-size:12px;width:280px';

        container.innerHTML = `
            <b>🎯 Agendar Envio + Cancelamento</b><br><br>
            <label>Horário de envio (HH:MM:SS):<br><input id="ag_horario" type="time" step="1" style="width:100%"></label><br><br>
            <label>Tempo de viagem (segundos, máx. 600):<br><input id="ag_viagem" type="number" max="600" min="1" value="30" style="width:100%"></label><br><br>
            <div id="ag_previa" style="font-size:11px;color:#444;"></div>
            <button id="ag_iniciar">🚀 Agendar Envio</button>
            <button id="ag_cancelar">❌ Cancelar Agendamento</button>
        `;

        document.body.appendChild(container);

        document.getElementById('ag_iniciar').onclick = () => {
            const horario = document.getElementById('ag_horario').value;
            const segundos = parseInt(document.getElementById('ag_viagem').value);

            if (!horario || isNaN(segundos)) return alert('Preencha corretamente os campos');
            if (segundos > 600) return alert('Tempo máximo de cancelamento é 10 minutos (600 segundos)');

            const [h, m, s] = horario.split(':').map(Number);
            const agendar = new Date();
            agendar.setHours(h, m, s, 0);
            if (agendar < new Date()) agendar.setTime(agendar.getTime() + 86400000);

            const cancelar = new Date(agendar.getTime() + segundos * 1000);

            salvarConfig({ envio: agendar.getTime(), cancelar: cancelar.getTime(), ativo: true });
            alert('✅ Agendamento iniciado. Deixe a aba aberta!');
        };

        document.getElementById('ag_cancelar').onclick = () => {
            salvarConfig({ ativo: false });
            alert('❌ Agendamento cancelado.');
        };
    };

    const formatar = (timestamp) => {
        const d = new Date(timestamp);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    };

    const checarExecucao = () => {
        const cfg = carregarConfig();
        if (!cfg.ativo) return;

        const agora = Date.now();

        if (window.location.href.includes('screen=place')) {
            if (agora >= cfg.envio && !cfg.executado) {
                const btn = document.querySelector('#troop_confirm_go, input[type=submit][value*="Enviar"]');
                if (btn) {
                    btn.click();
                    cfg.executado = true;
                    salvarConfig(cfg);
                    console.log('🚀 Enviado com sucesso!');
                }
            }
        }

        if ((window.location.href.includes('screen=overview') || window.location.href.includes('screen=place')) && cfg.executado) {
            if (agora >= cfg.cancelar && !cfg.cancelado) {
                const botoes = document.querySelectorAll('a[href*="action=cancel"]');
                if (botoes.length > 0) {
                    botoes[0].click();
                    cfg.cancelado = true;
                    salvarConfig(cfg);
                    console.log('❌ Cancelado com sucesso!');
                } else {
                    console.warn('Nenhum botão de cancelamento encontrado.');
                }
            }
        }

        // Atualizar prévia no painel
        const painel = document.getElementById('ag_previa');
        if (painel && cfg.envio) {
            painel.innerHTML = `⏰ Envio: <b>${formatar(cfg.envio)}</b><br>↩️ Cancelamento: <b>${formatar(cfg.cancelar)}</b><br>⏳ Retorno: ocorre ${((cfg.cancelar - cfg.envio) / 1000).toFixed(1)} segundos após envio.`;
        }

        setTimeout(checarExecucao, 200);
    };

    criarPainel();
    checarExecucao();
})();
