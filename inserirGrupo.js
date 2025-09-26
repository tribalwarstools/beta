(function() {
    const STORAGE_KEY = 'tw_mass_players_list';
    const STORAGE_DONE = 'tw_mass_players_done';
    const DELAY_DEFAULT = 300;
    const LOTE_DEFAULT = 10;

    if(document.getElementById('tw_mass_add_players_panel')) return;

    const panel = document.createElement('div');
    panel.id = 'tw_mass_add_players_panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.left = '20px';
    panel.style.width = '400px';
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
        <p>Tamanho do lote: <input type="number" id="tw_lote" value="${LOTE_DEFAULT}" style="width:60px;"></p>
        <button id="tw_start_add" class="btn">Adicionar próximo lote</button>
        <div id="tw_progress" style="margin-top:10px;"></div>
    `;

    document.body.appendChild(panel);

    document.getElementById('tw_close_panel').addEventListener('click', () => panel.remove());

    const startBtn = document.getElementById('tw_start_add');
    const progressBox = document.getElementById('tw_progress');
    const delayInput = document.getElementById('tw_delay');
    const loteInput = document.getElementById('tw_lote');

    let stopFlag = false;

    function adicionarLote(jogadores, delay = DELAY_DEFAULT, loteTam = LOTE_DEFAULT) {
        let adicionados = JSON.parse(localStorage.getItem(STORAGE_DONE) || "[]");
        let setAdicionados = new Set(adicionados);

        // lista de jogadores ainda não adicionados
        let lista = jogadores.filter(j => !setAdicionados.has(j.trim()));
        if(lista.length === 0) {
            progressBox.innerHTML = `<b>Nenhum jogador novo para adicionar.</b>`;
            return;
        }

        // pega apenas o próximo lote
        let lote = lista.slice(0, loteTam);

        let i = 0;

        function adicionarProximo() {
            if(i >= lote.length) {
                // ao terminar o lote, salva no localStorage
                lote.forEach(nome => setAdicionados.add(nome));
                localStorage.setItem(STORAGE_DONE, JSON.stringify([...setAdicionados]));
                progressBox.innerHTML = `<b>Lote concluído! ${lote.length} jogadores adicionados.</b>`;
                return;
            }

            const nome = lote[i].trim();
            if(nome) {
                const inputField = document.getElementById('new_player');
                const addButton = document.getElementById('add_new_player');
                if(inputField && addButton) {
                    inputField.value = nome;
                    addButton.click();
                }
            }

            i++;
            progressBox.innerHTML = `Adicionando jogador ${i} de ${lote.length}...`;
            setTimeout(adicionarProximo, delay);
        }

        adicionarProximo();
    }

    startBtn.addEventListener('click', () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if(!stored) return alert('Nenhuma lista salva! Faça upload do TXT primeiro.');

        const jogadores = JSON.parse(stored);
        const delay = parseInt(delayInput.value) || DELAY_DEFAULT;
        const loteTam = parseInt(loteInput.value) || LOTE_DEFAULT;
        adicionarLote(jogadores, delay, loteTam);
    });
})();
