(function() {
    const STORAGE_KEY = 'tw_mass_players_list';

    // Checar se o painel já existe
    if(document.getElementById('tw_mass_players_panel')) return;

    // Criar painel
    const panel = document.createElement('div');
    panel.id = 'tw_mass_players_panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.right = '20px';
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
            <b>Upload de Jogadores</b>
            <button id="tw_close_panel" style="background:#800;color:#fff;border:none;padding:2px 5px;border-radius:3px;cursor:pointer;">X</button>
        </div>
        <hr style="border-color:#444">
        <p>Selecione um TXT com 1 jogador por linha:</p>
        <input type="file" id="tw_file_input" accept=".txt"><br><br>
        <button id="tw_load_button" class="btn">Carregar arquivo</button>
        <button id="tw_clear_button" class="btn" style="margin-left:5px;">Limpar memória</button>
        <div id="tw_status_box" style="margin-top:10px;color:#ccc;"></div>
        <textarea id="tw_preview_box" style="width:100%;height:120px;margin-top:10px;background:#1c1c1c;color:#ccc;border:1px solid #444;" readonly placeholder="Preview da lista..."></textarea>
    `;

    document.body.appendChild(panel);

    // Fechar painel
    document.getElementById('tw_close_panel').addEventListener('click', () => {
        panel.remove();
    });

    // Elementos
    const fileInput = document.getElementById('tw_file_input');
    const loadButton = document.getElementById('tw_load_button');
    const clearButton = document.getElementById('tw_clear_button');
    const statusBox = document.getElementById('tw_status_box');
    const previewBox = document.getElementById('tw_preview_box');

    // Salvar lista
    function salvarLista(jogadores) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadores));
        statusBox.innerHTML = `<b>${jogadores.length} jogadores salvos na memória.</b>`;
    }

    // Carregar lista da memória
    function carregarLista() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if(stored) {
            const jogadores = JSON.parse(stored);
            previewBox.value = jogadores.join('\n');
            statusBox.innerHTML = `<b>${jogadores.length} jogadores carregados da memória.</b>`;
            return jogadores;
        }
        return [];
    }

    carregarLista();

    // Evento carregar arquivo
    loadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if(!file) return alert('Selecione um arquivo TXT!');

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const jogadores = content.trim().split(/\r?\n/).map(s => s.trim()).filter(s => s);
            previewBox.value = jogadores.join('\n');
            salvarLista(jogadores);
        };
        reader.readAsText(file);
    });

    // Evento limpar memória
    clearButton.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        previewBox.value = '';
        statusBox.innerHTML = '<b>Memória limpa!</b>';
    });
})();
