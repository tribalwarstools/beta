(function() {
    const STORAGE_KEY = 'tw_mass_players_list';
    const ADDED_KEY   = 'tw_mass_players_added';
    const DELAY_DEFAULT = 500;     // intervalo entre lotes
    const BATCH_SIZE   = 5;        // quantos jogadores por lote

    if(document.getElementById('tw_mass_add_players_panel')) return;

    // === Criar painel ===
    const panel = document.createElement('div');
    panel.id = 'tw_mass_add_players_panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.left = '20px';
    panel.style.width = '370px';
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
        <p>
            Delay (ms): <input type="number" id="tw_delay" value="${DELAY_DEFAULT}" style="width:60px;"> 
            Lote: <input type="number" id="tw_batch" value="${BATCH_SIZE}" style="width:40px;">
        </p>
        <div style="margin-top:5px;">
            <button id="tw_start_add" class="btn">Adicionar</button>
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
    const batchInput = document.getElementById('tw_batch');

    let stopFlag = false;

    // === Inserção em lotes (um por vez) ===
    function adicionarJogadores(jogadores, delay = DELAY_DEFAULT, batchSize = BATCH_SIZE) {
        stopFlag = false;
        let index = 0;

        let added = JSON.parse(localStorage.getItem(ADDED_KEY) || "[]");

        function processarLote() {
            if(stopFlag || index >= jogadores.length) {
                localStorage.setItem(ADDED_KEY, JSON.stringify(added));
                progressBox.innerHTML = stopFlag 
                    ? `<b>Execução interrompida! ${index} processados.</b>`
                    : `<b>Concluído! ${index} processados.</b>`;
                return;
            }

            const inputField = document.getElementById('new_player');
            const addButton = document.getElementById('add_new_player');

            if(inputField && addButton) {
                let count = 0;
                while(count < batchSize && index < jogadores.length) {
                    const nome = jogadores[index].trim();
                    index++;
                    if(nome && !added.includes(nome)) {
                        inputField.value = nome;
                        addButton.click();
                        added.push(nome);
                        count++;
                    }
                }
            }

            progressBox.innerHTML = `Processados ${index} de ${jogadores.length}... (histórico: ${added.length})`;
            setTimeout(processarLote, delay);
        }

        processarLote();
    }

    // === Botões ===
    startBtn.addEventListener('click', () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if(!stored) return alert('Nenhuma lista salva! Faça upload do TXT primeiro.');

        const jogadores = JSON.parse(stored);
        const delay = parseInt(delayInput.value) || DELAY_DEFAULT;
        const batchSize = parseInt(batchInput.value) || BATCH_SIZE;
        adicionarJogadores(jogadores, delay, batchSize);
    });

    stopBtn.addEventListener('click', () => stopFlag = true);

    resetBtn.addEventListener('click', () => {
        if(confirm("Deseja realmente resetar o histórico de jogadores adicionados?")) {
            localStorage.removeItem(ADDED_KEY);
            progressBox.innerHTML = "<b>Histórico resetado!</b>";
        }
    });
})();
