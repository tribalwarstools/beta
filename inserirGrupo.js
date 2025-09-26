(function() {
    const STORAGE_KEY = 'tw_mass_players_list';
    const ADDED_KEY   = 'tw_mass_players_added'; // jogadores já adicionados
    const DELAY_DEFAULT = 300;

    // Impedir painel duplicado
    if(document.getElementById('tw_mass_add_players_panel')) return;

    // === Criar painel ===
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
        <div style="margin-top:5px;">
            <button id="tw_start_add" class="btn">Adicionar todos</button>
            <button id="tw_stop_add" class="btn" style="margin-left:5px;">Parar</button>
            <button id="tw_reset_hist" class="btn" style="margin-left:5px;background:#555;">Resetar histórico</button>
        </div>
        <div id="tw_progress" style="margin-top:10px;"></div>
    `;
    document.body.appendChild(panel);

    // === Elementos ===
    document.getElementById('tw_close_panel').addEventListener('click', () => panel.remove());
    const startBtn = document.getElementById('tw_start_add');
    const stopBtn = document.getElementById('tw_stop_add');
    const resetBtn = document.getElementById('tw_reset_hist');
    const progressBox = document.getElementById('tw_progress');
    const delayInput = document.getElementById('tw_delay');

    let stopFlag = false;

    // === Função principal ===
    function adicionarJogadores(jogadores, delay = DELAY_DEFAULT) {
        let i = 0;
        stopFlag = false;

        // carregar histórico de já adicionados
        let added = JSON.parse(localStorage.getItem(ADDED_KEY) || "[]");

        function adicionarProximo() {
            if(stopFlag || i >= jogadores.length) {
                localStorage.setItem(ADDED_KEY, JSON.stringify(added));
                progressBox.innerHTML = stopFlag 
                    ? `<b>Execução interrompida! ${i} processados.</b>`
                    : `<b>Concluído! ${i} processados.</b>`;
                return;
            }

            const nome = jogadores[i].trim();
            if(nome && !added.includes(nome)) { // <- evita duplicado
                const inputField = document.getElementById('new_player');
                const addButton = document.getElementById('add_new_player');
                if(inputField && addButton) {
                    inputField.value = nome;
                    addButton.click();
                    added.push(nome); // salvar como já inserido
                }
            }

            i++;
            progressBox.innerHTML = `Processando ${i} de ${jogadores.length}...`;
            setTimeout(adicionarProximo, delay);
        }

        adicionarProximo();
    }

    // === Botões ===
    startBtn.addEventListener('click', () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if(!stored) return alert('Nenhuma lista salva! Faça upload do TXT primeiro.');

        const jogadores = JSON.parse(stored);
        const delay = parseInt(delayInput.value) || DELAY_DEFAULT;
        adicionarJogadores(jogadores, delay);
    });

    stopBtn.addEventListener('click', () => {
        stopFlag = true;
    });

    resetBtn.addEventListener('click', () => {
        if(confirm("Deseja realmente resetar o histórico de jogadores adicionados?")) {
            localStorage.removeItem(ADDED_KEY);
            progressBox.innerHTML = "<b>Histórico resetado!</b>";
        }
    });
})();
