(function() {
    'use strict';

    // --- CSS do painel ---
    const css = `
    #tw-painel { position: fixed; top: 50px; left: 0; background: #2b2b2b; border: 2px solid #654321; border-left: none; border-radius: 0 10px 10px 0; box-shadow: 2px 2px 8px #000; font-family: Verdana, sans-serif; color: #f1e1c1; z-index: 9999; transition: transform 0.3s ease-in-out; transform: translateX(-280px); }
    #tw-toggle { position: absolute; top: 0; right: -28px; width: 28px; height: 40px; background: #5c4023; border: 2px solid #654321; border-left: none; border-radius: 0 6px 6px 0; color: #f1e1c1; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; box-shadow: 2px 2px 6px #000; }
    #tw-conteudo { padding: 8px; width: 260px; }
    #tw-conteudo h4, #tw-conteudo h5 { margin: 0 0 6px 0; font-size: 13px; text-align: center; border-bottom: 1px solid #654321; padding-bottom: 4px; }
    .scriptBtn { display: inline-block; width: 120px; margin: 2px 2px 2px 0; background: #5c4023; border: 1px solid #3c2f2f; border-radius: 6px; color: #f1e1c1; padding: 4px; cursor: pointer; font-size: 12px; text-align: center; }
    .scriptInput { width: 60px; padding: 2px; font-size: 12px; border-radius: 4px; border: 1px solid #654321; margin-right: 4px; text-align: center; }
    .scriptBtn:hover { filter: brightness(1.1); }
    #tw-painel.ativo { transform: translateX(0); }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- Criar painel ---
    const painel = document.createElement('div');
    painel.id = 'tw-painel';
    painel.innerHTML = `
        <div id="tw-toggle">⚔</div>
        <div id="tw-conteudo">
            <h4>Recrutamento Rápido</h4>
        </div>
    `;
    document.body.appendChild(painel);

    const toggle = painel.querySelector('#tw-toggle');
    toggle.addEventListener('click', () => painel.classList.toggle('ativo'));

    const conteudo = painel.querySelector('#tw-conteudo');

    // --- Definir unidades e metas ---
    const defesa = [
        { codigo: 'spear', nome: 'Lanceiro', meta: 6000 },
        { codigo: 'sword', nome: 'Espadachim', meta: 6000 },
        { codigo: 'archer', nome: 'Arqueiro', meta: 0 },
        { codigo: 'heavy', nome: 'Cavalaria pesada', meta: 1200 },
        { codigo: 'spy', nome: 'Explorador', meta: 200 },
        { codigo: 'catapult', nome: 'Catapulta', meta: 100 }
    ];

    const ataque = [
        { codigo: 'axe', nome: 'Bárbaro', meta: 6000 },
        { codigo: 'light', nome: 'Cavalaria leve', meta: 3000 },
        { codigo: 'marcher', nome: 'Arqueiro a cavalo', meta: 0 },
        { codigo: 'ram', nome: 'Aríete', meta: 300 },
        { codigo: 'spy', nome: 'Explorador', meta: 50 },
        { codigo: 'catapult', nome: 'Catapulta', meta: 100 }
    ];

    // --- Função para criar blocos ---
    function criarBloco(titulo, unidades) {
        const bloco = document.createElement('div');
        const header = document.createElement('h5');
        header.textContent = titulo;
        bloco.appendChild(header);

        unidades.forEach(unit => {
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
            input.value = Math.min(unit.meta, maxDisponivel);
            input.className = 'scriptInput';

            const btn = document.createElement('button');
            btn.className = 'scriptBtn';
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
            bloco.appendChild(container);
        });

        conteudo.appendChild(bloco);
    }

    // --- Criar blocos de Defesa e Ataque ---
    criarBloco('Defesa', defesa);
    criarBloco('Ataque', ataque);

})();
