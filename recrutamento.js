(function() {
    'use strict';

    const prefix = 'twra_';
    const STORAGE_KEY = `${prefix}config`;

    // --- CSS do painel ---
    const css = `
    #${prefix}painel { position: fixed; top: 150px; left: 0; width: 300px; background: #2b2b2b; border: 2px solid #654321; border-left: none; border-radius: 0 10px 10px 0; box-shadow: 2px 2px 8px #000; font-family: Verdana, sans-serif; color: #f1e1c1; z-index: 9997; transition: transform 0.3s ease-in-out; transform: translateX(-300px); }
    #${prefix}toggle { position: absolute; top: 0; right: -28px; width: 28px; height: 40px; background: #5c4023; border: 2px solid #654321; border-left: none; border-radius: 0 6px 6px 0; color: #f1e1c1; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; box-shadow: 2px 2px 6px #000; }
    #${prefix}conteudo { padding: 8px; }
    #${prefix}conteudo h4 { margin: 0 0 6px 0; font-size: 13px; text-align: center; border-bottom: 1px solid #654321; padding-bottom: 4px; }
    .${prefix}btn { background: #5c4023; border: 1px solid #3c2f2f; border-radius: 6px; color: #f1e1c1; padding: 4px; cursor: pointer; font-size: 12px; text-align: center; }
    .${prefix}input { width: 50px; padding: 2px; font-size: 12px; border-radius: 4px; border: 1px solid #654321; text-align: center; }
    .${prefix}btn:hover { filter: brightness(1.1); }
    #${prefix}painel.ativo { transform: translateX(0); }
    #${prefix}percent-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    #${prefix}topBtns { display: flex; gap: 4px; }
    #${prefix}topBtns button { flex: 1; }
    .${prefix}ignore-checkbox { transform: scale(1.2); margin-left: 4px; }
    #${prefix}bottomBtns { text-align: center; margin-top: 6px; }
    #${prefix}bottomBtns button { width: 120px; margin: 2px 2px; }
    .${prefix}unit-line { display: flex; align-items: center; margin-bottom: 4px; }
    .${prefix}unit-name { width: 120px; }
    .${prefix}unit-checkbox { width: 20px; text-align: center; }
    .${prefix}unit-input { width: 50px; margin: 0 4px; }
    .${prefix}unit-btn { width: 70px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- Criar painel ---
    const painel = document.createElement('div');
    painel.id = `${prefix}painel`;
    painel.innerHTML = `
        <div id="${prefix}toggle">⚔</div>
        <div id="${prefix}conteudo">
            <h4>Recrutamento Rápido</h4>
            <div id="${prefix}percent-container">
                <label for="${prefix}percent">%</label>
                <input id="${prefix}percent" type="number" min="0" max="100" value="1" class="${prefix}input">
                <div id="${prefix}topBtns">
                    <button id="${prefix}btn-calcular" class="${prefix}btn">Calcular</button>
                    <button id="${prefix}btn-salvar" class="${prefix}btn">Salvar</button>
                </div>
            </div>
            <div id="${prefix}unidades-container"></div>
            <div id="${prefix}bottomBtns">
                <button id="${prefix}btn-recrutar" class="${prefix}btn">Recrutar</button>
                <div style="margin-top:6px; display:flex; gap:4px; justify-content:center;">
                    <button id="${prefix}btn-anterior" class="${prefix}btn">⟵ Anterior</button>
                    <button id="${prefix}btn-proxima" class="${prefix}btn">Próxima ⟶</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(painel);

    const toggle = painel.querySelector(`#${prefix}toggle`);
    toggle.addEventListener('click', () => {
        painel.classList.toggle('ativo');
        localStorage.setItem(prefix + 'painelAberto', painel.classList.contains('ativo') ? '1' : '0');
    });

    // restaurar estado do painel
    if (localStorage.getItem(prefix + 'painelAberto') === '1') {
        painel.classList.add('ativo');
    }

    const percentInput = document.getElementById(`${prefix}percent`);

    const todasUnidades = [
        { codigo: 'spear', nome: 'Lanceiro' },
        { codigo: 'sword', nome: 'Espadachim' },
        { codigo: 'axe', nome: 'Bárbaro' },
        { codigo: 'archer', nome: 'Arqueiro' },
        { codigo: 'spy', nome: 'Explorador' },
        { codigo: 'light', nome: 'Cavalaria L.' },
        { codigo: 'marcher', nome: 'Arq. a cav.' },
        { codigo: 'heavy', nome: 'Cav. Pesada' },
        { codigo: 'ram', nome: 'Aríete' },
        { codigo: 'catapult', nome: 'Catapulta' }
    ];

    const inputsMap = {};

    function getDisponivel(codigo) {
        const el = document.getElementById(`${codigo}_0_a`);
        if (!el) return 0;
        const match = el.textContent.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    function salvarConfiguracao() {
        const config = {};
        Object.keys(inputsMap).forEach(codigo => {
            config[codigo] = {
                valor: parseInt(inputsMap[codigo].input.value) || 0,
                marcado: inputsMap[codigo].marcado.checked
            };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        UI.InfoMessage('✅ Configuração salva!', 2000, 'success');
    }

    function carregarConfiguracao() {
        const configStr = localStorage.getItem(STORAGE_KEY);
        if (!configStr) return;
        try {
            const config = JSON.parse(configStr);
            Object.keys(config).forEach(codigo => {
                if (inputsMap[codigo]) {
                    inputsMap[codigo].input.value = config[codigo].valor;
                    inputsMap[codigo].marcado.checked = config[codigo].marcado;
                }
            });
        } catch(e) { console.error('Erro ao carregar configuração:', e); }
    }

    function iniciarPainel() {
        const tabela = document.querySelector('table.vis tbody tr');
        if (!tabela) {
            setTimeout(iniciarPainel, 500);
            return;
        }

        const containerUnidades = document.getElementById(`${prefix}unidades-container`);

        todasUnidades.forEach(unit => {
            const linha = Array.from(document.querySelectorAll('table.vis tbody tr'))
                .find(tr => tr.querySelector(`a.unit_link[data-unit="${unit.codigo}"]`));
            if (!linha) return;

            const colunaRecrutar = linha.querySelectorAll('td')[3];

            const container = document.createElement('div');
            container.className = `${prefix}unit-line`;

            const lbl = document.createElement('span');
            lbl.textContent = unit.nome;
            lbl.className = `${prefix}unit-name`;

            const marcado = document.createElement('input');
            marcado.type = 'checkbox';
            marcado.className = `${prefix}ignore-checkbox ${prefix}unit-checkbox`;
            marcado.title = 'Marcar para incluir no recrutamento';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.className = `${prefix}input ${prefix}unit-input`;

            const btn = document.createElement('button');
            btn.className = `${prefix}btn ${prefix}unit-btn`;
            btn.textContent = '✔';
            btn.title = 'Recrutar apenas esta unidade';
            btn.addEventListener('click', () => {
                if (!marcado.checked) return;
                const qty = parseInt(input.value) || 0;
                const inputTabela = colunaRecrutar.querySelector('input.recruit_unit');
                if (inputTabela) inputTabela.value = qty;
                const btnGlobal = document.querySelector('input.btn-recruit[type="submit"]');
                if (btnGlobal) btnGlobal.click();
            });

            container.appendChild(lbl);
            container.appendChild(marcado);
            container.appendChild(input);
            container.appendChild(btn);

            inputsMap[unit.codigo] = { input, coluna: colunaRecrutar, marcado };

            containerUnidades.appendChild(container);
        });

        carregarConfiguracao();

        document.getElementById(`${prefix}btn-calcular`).addEventListener('click', () => {
            const pct = Math.min(Math.max(parseInt(percentInput.value) || 0, 0), 100);
            Object.keys(inputsMap).forEach(codigo => {
                if (inputsMap[codigo].marcado.checked) {
                    const maxAtual = getDisponivel(codigo);
                    inputsMap[codigo].input.value = Math.floor(maxAtual * pct / 100);
                }
            });
        });

        document.getElementById(`${prefix}btn-recrutar`).addEventListener('click', () => {
            Object.keys(inputsMap).forEach(codigo => {
                if (inputsMap[codigo].marcado.checked) {
                    const val = parseInt(inputsMap[codigo].input.value) || 0;
                    const inputTabela = inputsMap[codigo].coluna.querySelector('input.recruit_unit');
                    if (inputTabela) inputTabela.value = val;
                }
            });
            const btnGlobal = document.querySelector('input.btn-recruit[type="submit"]');
            if (btnGlobal) btnGlobal.click();
        });

        document.getElementById(`${prefix}btn-salvar`).addEventListener('click', salvarConfiguracao);

        // Navegação entre aldeias (simula clique nos controles do jogo)
        document.getElementById(`${prefix}btn-anterior`).addEventListener('click', () => {
            const el = document.querySelector('span.arrowLeft');
            if (el) el.click();
        });
        document.getElementById(`${prefix}btn-proxima`).addEventListener('click', () => {
            const el = document.querySelector('span.arrowRight');
            if (el) el.click();
        });
    }

    iniciarPainel();
})();
