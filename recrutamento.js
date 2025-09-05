(function() {
    'use strict';

    const prefix = 'twra_'; // prefixo para evitar conflitos

    // --- CSS do painel ---
    const css = `
    #${prefix}painel { position: fixed; top: 50px; left: 0; background: #2b2b2b; border: 2px solid #654321; border-left: none; border-radius: 0 10px 10px 0; box-shadow: 2px 2px 8px #000; font-family: Verdana, sans-serif; color: #f1e1c1; z-index: 9999; transition: transform 0.3s ease-in-out; transform: translateX(-280px); }
    #${prefix}toggle { position: absolute; top: 0; right: -28px; width: 28px; height: 40px; background: #5c4023; border: 2px solid #654321; border-left: none; border-radius: 0 6px 6px 0; color: #f1e1c1; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; box-shadow: 2px 2px 6px #000; }
    #${prefix}conteudo { padding: 8px; width: 280px; }
    #${prefix}conteudo h4, #${prefix}conteudo h5 { margin: 0 0 6px 0; font-size: 13px; text-align: center; border-bottom: 1px solid #654321; padding-bottom: 4px; }
    .${prefix}btn { display: inline-block; width: 120px; margin: 2px 2px 2px 0; background: #5c4023; border: 1px solid #3c2f2f; border-radius: 6px; color: #f1e1c1; padding: 4px; cursor: pointer; font-size: 12px; text-align: center; }
    .${prefix}input { width: 60px; padding: 2px; font-size: 12px; border-radius: 4px; border: 1px solid #654321; margin-right: 4px; text-align: center; }
    .${prefix}btn:hover { filter: brightness(1.1); }
    #${prefix}painel.ativo { transform: translateX(0); }
    #${prefix}topBtns { text-align: center; margin-bottom: 6px; }
    #${prefix}topBtns button { width: 120px; margin: 0 4px; }
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
            <div id="${prefix}topBtns">
                <button id="${prefix}btn-defesa" class="${prefix}btn">Defesa</button>
                <button id="${prefix}btn-ataque" class="${prefix}btn">Ataque</button>
            </div>
        </div>
    `;
    document.body.appendChild(painel);

    const toggle = painel.querySelector(`#${prefix}toggle`);
    toggle.addEventListener('click', () => painel.classList.toggle('ativo'));

    const conteudo = painel.querySelector(`#${prefix}conteudo`);

    // --- Unidades e metas ---
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

    const metasDefesa = {
        'spear': 6000,
        'sword': 6000,
        'archer': 0,
        'heavy': 1200,
        'spy': 200,
        'catapult': 100
    };

    const metasAtaque = {
        'axe': 6000,
        'light': 3000,
        'marcher': 0,
        'ram': 300,
        'spy': 50,
        'catapult': 100
    };

    const inputsMap = {};

    // --- Função para iniciar painel ---
    function iniciarPainel() {
        const tabela = document.querySelector('table.vis tbody tr');
        if (!tabela) {
            setTimeout(iniciarPainel, 500);
            return;
        }

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
            inputsMap[unit.codigo] = { input, max: maxDisponivel, coluna: colunaRecrutar };

            const btn = document.createElement('button');
            btn.className = `${prefix}btn`;
            btn.textContent = unit.nome;
            btn.addEventListener('click', () => {
                const qty = Math.min(parseInt(input.value) || 0, maxDisponivel);
                const inputTabela = colunaRecrutar.querySelector('input.recruit_unit');
                if (inputTabela) {
                    inputTabela.value = qty;
                    const btnGlobal = document.querySelector('input.btn-recruit[type="submit"]');
                    if (btnGlobal) btnGlobal.click();
                }
            });

            container.appendChild(input);
            container.appendChild(btn);
            conteudo.appendChild(container);
        });

        // --- Botões de preenchimento ---
        document.getElementById(`${prefix}btn-defesa`).addEventListener('click', () => {
            Object.keys(inputsMap).forEach(codigo => {
                if (metasDefesa[codigo] !== undefined) {
                    inputsMap[codigo].input.value = Math.min(metasDefesa[codigo], inputsMap[codigo].max);
                } else {
                    inputsMap[codigo].input.value = 0;
                }
            });
        });

        document.getElementById(`${prefix}btn-ataque`).addEventListener('click', () => {
            Object.keys(inputsMap).forEach(codigo => {
                if (metasAtaque[codigo] !== undefined) {
                    inputsMap[codigo].input.value = Math.min(metasAtaque[codigo], inputsMap[codigo].max);
                } else {
                    inputsMap[codigo].input.value = 0;
                }
            });
        });
    }

    iniciarPainel();
})();
