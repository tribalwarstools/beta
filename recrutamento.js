(function() {
    'use strict';

    const prefix = 'twra_';
    const STORAGE_KEY = `${prefix}config`;

    // --- CSS do painel ---
    const css = `
    #${prefix}painel { position: fixed; top: 50px; left: 0; background: #2b2b2b; border: 2px solid #654321; border-left: none; border-radius: 0 10px 10px 0; box-shadow: 2px 2px 8px #000; font-family: Verdana, sans-serif; color: #f1e1c1; z-index: 9999; transition: transform 0.3s ease-in-out; transform: translateX(-280px); }
    #${prefix}toggle { position: absolute; top: 0; right: -28px; width: 28px; height: 40px; background: #5c4023; border: 2px solid #654321; border-left: none; border-radius: 0 6px 6px 0; color: #f1e1c1; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; box-shadow: 2px 2px 6px #000; }
    #${prefix}conteudo { padding: 8px; width: 280px; }
    #${prefix}conteudo h4 { margin: 0 0 6px 0; font-size: 13px; text-align: center; border-bottom: 1px solid #654321; padding-bottom: 4px; }
    .${prefix}btn { display: inline-block; width: 120px; margin: 2px 2px 2px 0; background: #5c4023; border: 1px solid #3c2f2f; border-radius: 6px; color: #f1e1c1; padding: 4px; cursor: pointer; font-size: 12px; text-align: center; }
    .${prefix}input { width: 60px; padding: 2px; font-size: 12px; border-radius: 4px; border: 1px solid #654321; margin-right: 4px; text-align: center; }
    .${prefix}btn:hover { filter: brightness(1.1); }
    #${prefix}painel.ativo { transform: translateX(0); }
    #${prefix}topBtns { text-align: center; margin-bottom: 6px; }
    #${prefix}topBtns button { width: 120px; margin: 0 4px; }
    #${prefix}percent-container { text-align:center; margin-bottom:6px; }
    #${prefix}percent { width: 50px; text-align: center; }
    .${prefix}ignore-checkbox { margin-left: 4px; transform: scale(1.1); }
    #${prefix}bottomBtns { text-align: center; margin-top: 6px; }
    #${prefix}bottomBtns button { width: 120px; margin: 2px 2px; }
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
                <button id="${prefix}btn-calcular" class="${prefix}btn">Calcular</button>
                <button id="${prefix}btn-salvar" class="${prefix}btn">Salvar</button>
            </div>
            <!-- Inputs das unidades serão inseridos aqui -->
            <div id="${prefix}unidades-container"></div>
            <div id="${prefix}bottomBtns">
                <button id="${prefix}btn-defesa" class="${prefix}btn">Defesa</button>
                <button id="${prefix}btn-ataque" class="${prefix}btn">Ataque</button>
            </div>
        </div>
    `;
    document.body.appendChild(painel);

    const toggle = painel.querySelector(`#${prefix}toggle`);
    toggle.addEventListener('click', () => painel.classList.toggle('ativo'));

    const percentInput = document.getElementById(`${prefix}percent`);

    const todasUnidades = [
        { codigo: 'spear', nome: 'Lanceiro' },
        { codigo: 'sword', nome: 'Espadachim' },
        { codigo: 'axe', nome: 'Bárbaro' },
        { codigo: 'archer', nome: 'Arqueiro' },
        { codigo: 'spy', nome: 'Explorador' },
        { codigo: 'light', nome: 'Cavalaria leve' },
        { codigo: 'marcher', nome: 'Arqueiro a cavalo' },
        { codigo: 'heavy', nome: 'Cavalaria pesada' },
        { codigo: 'ram', nome: 'Aríete' },
        { codigo: 'catapult', nome: 'Catapulta' }
    ];

    const inputsMap = {};

    function salvarConfiguracao() {
        const config = {};
        Object.keys(inputsMap).forEach(codigo => {
            config[codigo] = {
                valor: parseInt(inputsMap[codigo].input.value) || 0,
                ignore: inputsMap[codigo].ignore.checked
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
                    inputsMap[codigo].ignore.checked = config[codigo].ignore;
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
            const maxDisponivel = parseInt(colunaRecrutar.querySelector('a')?.textContent.replace(/[()]/g,'') || '0');

            const container = document.createElement('div');
            container.style.marginBottom = '4px';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = maxDisponivel;
            input.value = maxDisponivel;
            input.className = `${prefix}input`;

            const ignore = document.createElement('input');
            ignore.type = 'checkbox';
            ignore.className = `${prefix}ignore-checkbox`;
            ignore.title = 'Ignorar esta unidade';

            inputsMap[unit.codigo] = { input, max: maxDisponivel, coluna: colunaRecrutar, ignore };

            const btn = document.createElement('button');
            btn.className = `${prefix}btn`;
            btn.textContent = unit.nome;
            btn.addEventListener('click', () => {
                if (ignore.checked) return;
                const qty = parseInt(input.value) || 0;
                const inputTabela = colunaRecrutar.querySelector('input.recruit_unit');
                if (inputTabela) inputTabela.value = qty;
                const btnGlobal = document.querySelector('input.btn-recruit[type="submit"]');
                if (btnGlobal) btnGlobal.click();
            });

            container.appendChild(input);
            container.appendChild(ignore);
            container.appendChild(btn);
            containerUnidades.appendChild(container);
        });

        // --- Carrega configuração salva ---
        carregarConfiguracao();

        // --- Botão calcular % ---
        document.getElementById(`${prefix}btn-calcular`).addEventListener('click', () => {
            const pct = Math.min(Math.max(parseInt(percentInput.value) || 0, 0), 100);
            Object.keys(inputsMap).forEach(codigo => {
                if (!inputsMap[codigo].ignore.checked) {
                    inputsMap[codigo].input.value = Math.floor(inputsMap[codigo].max * pct / 100);
                }
            });
        });

        // --- Botões de Ataque e Defesa ---
        const unidadesAtaque = ['axe', 'light', 'marcher', 'ram', 'catapult', 'spy'];
        const unidadesDefesa = ['spear', 'sword', 'archer', 'spy', 'heavy', 'catapult'];

        function preencherERecrutar(unidades) {
            unidades.forEach(codigo => {
                if (inputsMap[codigo] && !inputsMap[codigo].ignore.checked) {
                    const val = parseInt(inputsMap[codigo].input.value) || 0;
                    const inputTabela = inputsMap[codigo].coluna.querySelector('input.recruit_unit');
                    if (inputTabela) inputTabela.value = val;
                }
            });
            const btnGlobal = document.querySelector('input.btn-recruit[type="submit"]');
            if (btnGlobal) btnGlobal.click();
        }

        document.getElementById(`${prefix}btn-defesa`).addEventListener('click', () => preencherERecrutar(unidadesDefesa));
        document.getElementById(`${prefix}btn-ataque`).addEventListener('click', () => preencherERecrutar(unidadesAtaque));
        document.getElementById(`${prefix}btn-salvar`).addEventListener('click', salvarConfiguracao);
    }

    iniciarPainel();
})();
