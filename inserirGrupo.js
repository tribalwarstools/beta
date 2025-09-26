(function() {
    const STORAGE_KEY = 'tw_mass_players_list';
    const DELAY_DEFAULT = 300; // delay padrão entre adições (ms)

    // Checar se painel já existe
    if(document.getElementById('tw_mass_add_players_panel')) return;

    // Criar painel flutuante
    const panel = document.createElement('div');
    panel.id = 'tw_mass_add_players_panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.left = '20px';
    panel.style.width = '350px';
    panel.style.background = '#2b2b2b';
    panel.style.color = '#ccc';
    panel.style.border = '2px solid #444';
    panel.style.borderRadius = '8px';
    panel.style.padding = '10px';
    panel.style.zIndex = '99999';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '13px';
    panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.7)';

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <b>Adicionar Jogadores</b>
            <button id="tw_close_panel" style="background:#800;color:#fff;border:none;padding:2px 5px;border-radius:3px;cursor:pointer;">X</button>
        </div>
        <hr style="border-color:#444">
        <p>Delay entre adições (ms): <input type="number" id="tw_delay" value="${DELAY_DEFAULT}" style="width:60px;"></p>
        <button id="tw_start_add" class="btn">Adicionar todos</button>
        <button id="tw_stop_add" class="btn" style="margin-left:5px;">Parar</button>
        <div id="tw_progress" style="margin-top:10px;"></div>
    `;

    document.body.appendChild(panel);

    // Fechar painel
    document.getElementById('tw_close_panel').addEventListener('click', () => panel.remove());

    // Elementos
    const startBtn = document.getElementById('tw_start_add');
    const stopBtn = document.getElementById('tw_stop_add');
    const progressBox = document.getElementById('tw_progress');
    const delayInput = document.getElementById('tw_delay');

    let stopFlag = false;

    // Função para adicionar jogadores
    function adicionarJogadores(jogadores, delay = DELAY_DEFAULT) {
        let i = 0;
        stopFlag = false;

        function adicionarProximo() {
            if(stopFlag || i >= jogadores.length) {
                progressBox.innerHTML = stopFlag 
                    ? `<b>Execução interrompida! ${i} jogadores adicionados.</b>`
                    : `<b>Concluído! ${i} jogadores adicionados.</b>`;
                return;
            }

            const nome = jogadores[i].trim();
            if(nome) {
                const inputField = document.getElementById('new_player');
                const addButton = document.getElementById('add_new_player');
                if(inputField && addButton) {
                    inputField.value = nome;
                    addButton.click();
                }
            }

            i++;
            progressBox.innerHTML = `Adicionando jogador ${i} de ${jogadores.length}...`;
            setTimeout(adicionarProximo, delay);
        }

        adicionarProximo();
    }

    // Botão iniciar
    startBtn.addEventListener('click', () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if(!stored) return alert('Nenhuma lista salva! Faça upload do TXT primeiro.');

        const jogadores = JSON.parse(stored);
        const delay = parseInt(delayInput.value) || DELAY_DEFAULT;
        adicionarJogadores(jogadores, delay);
    });

    // Botão parar
    stopBtn.addEventListener('click', () => {
        stopFlag = true;
    });
})();
