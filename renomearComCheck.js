
(function () {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  let interromper = false;
  let renomearAtivo = false;

  function montarNome(contador, digitos, prefixo, textoBase, sufixo, usarNumeracao, usarPrefixo, usarTexto, usarSufixo, coordenadas) {
    let partes = [];
    if (usarNumeracao) partes.push(String(contador).padStart(digitos, '0'));
    if (usarPrefixo) partes.push(prefixo);
    if (usarTexto) partes.push(textoBase);
    if (coordenadas) partes.push(coordenadas);
    if (usarSufixo) partes.push(sufixo);
    return partes.filter(Boolean).join(' ').trim();
  }

  function atualizarPreview(config) {
    const listaPreview = document.getElementById('listaPreview');
    if (!listaPreview) return;

    const icones = [...document.querySelectorAll('.rename-icon')].filter(el => el.offsetParent !== null);
    const nomesAtuais = icones.map(el => el.closest('tr').querySelector('span.quickedit-label')?.innerText || '');
    let aldeias = icones.map((el, i) => ({ el, nome: nomesAtuais[i], id: i }));

    if (config.filtrar) {
      try {
        const re = config.regex ? new RegExp(config.filtroNome) : null;
        aldeias = aldeias.filter(a => config.regex ? re.test(a.nome) : a.nome.includes(config.filtroNome));
      } catch {
        listaPreview.innerHTML = '<li style="color:red;">Filtro regex inválido</li>';
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();
    let contador = config.inicio || 1;

    listaPreview.innerHTML = '';
    aldeias.forEach((aldeia, idx) => {
      const coords = aldeia.el.closest('tr').querySelector('span.quickedit-label')?.innerText.match(/\d+\|\d+/)?.[0] || '';
      const nomePreview = montarNome(
        contador + idx,
        config.digitos,
        config.prefixo,
        config.textoBase,
        config.sufixo,
        config.usarNumeracao,
        config.usarPrefixo,
        config.usarTexto,
        config.usarSufixo,
        config.incluirCoords ? coords : ''
      );

      const li = document.createElement('li');
      li.style.marginBottom = '4px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.index = aldeia.id;
      checkbox.style.marginRight = '4px';

      li.appendChild(checkbox);
      li.append(`${aldeia.nome} → ${nomePreview}`);
      listaPreview.appendChild(li);
    });

    if (aldeias.length === 0) {
      listaPreview.innerHTML = '<li>Nenhuma aldeia visível para pré-visualizar</li>';
    }
  }

  async function renomearAldeias(config) {
    const icones = [...document.querySelectorAll('.rename-icon')].filter(el => el.offsetParent !== null);
    const nomesAtuais = icones.map(el => el.closest('tr').querySelector('span.quickedit-label')?.innerText || '');
    let aldeias = icones.map((el, i) => ({ el, nome: nomesAtuais[i], id: i }));

    if (config.filtrar) {
      try {
        const re = config.regex ? new RegExp(config.filtroNome) : null;
        aldeias = aldeias.filter(a => config.regex ? re.test(a.nome) : a.nome.includes(config.filtroNome));
      } catch {
        UI.ErrorMessage('Expressão regular inválida.');
        renomearAtivo = false;
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();

    const selecionadas = [...document.querySelectorAll('#listaPreview input[type=checkbox]')]
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.index));

    aldeias = aldeias.filter((_, idx) => selecionadas.includes(idx));
    let contador = config.inicio || 1;

    const barraProgresso = document.getElementById('barraProgresso');
    const barraTexto = document.getElementById('barraTexto');
    const btnParar = document.getElementById('btnParar');

    btnParar.disabled = false;
    btnParar.textContent = 'Parar';
    interromper = false;

    for (let i = 0; i < aldeias.length; i++) {
      if (interromper) break;
      const { el } = aldeias[i];
      el.click();
      await delay(300);

      const input = document.querySelector('.vis input[type="text"]');
      const confirmar = document.querySelector('.vis input[type="button"]');
      const coords = el.closest('tr').querySelector('span.quickedit-label')?.innerText.match(/\d+\|\d+/)?.[0];

      if (input && confirmar) {
        const novoNome = montarNome(
          contador,
          config.digitos,
          config.prefixo,
          config.textoBase,
          config.sufixo,
          config.usarNumeracao,
          config.usarPrefixo,
          config.usarTexto,
          config.usarSufixo,
          config.incluirCoords ? coords : ''
        );
        input.value = novoNome;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(200);
        confirmar.click();
        contador++;

        const progresso = ((i + 1) / aldeias.length) * 100;
        barraProgresso.style.width = progresso + '%';
        barraTexto.textContent = progresso.toFixed(1) + '%';
      }

      await delay(config.delay);
    }

    UI.SuccessMessage(interromper ? 'Renomeação interrompida pelo usuário.' : 'Renomeação finalizada.');
    btnParar.textContent = 'Parar';
    btnParar.disabled = true;
    interromper = false;
    renomearAtivo = false;
  }

  window.abrirPainelAvancado = function () {
    if (!window.location.href.includes('screen=overview_villages') || !window.location.href.includes('mode=combined')) {
      return alert('Acesse a tela de Visão Geral (modo combinado) antes de rodar o script.');
    }

    Dialog.show('painelAvancado', `
      <div style="padding:10px; font-size:13px; max-width:600px;">
        <div style="margin-bottom:6px;">Configuração:</div>
        <label><input id="numeracao" type="checkbox" checked> Numeração</label><br>
        <label>Digitos: <input id="digitos" type="number" value="2" style="width:50px;"></label><br>
        <label><input id="prefixcheck" type="checkbox"> Prefixo</label> <input id="prefixbox" type="text"><br>
        <label><input id="textocheck" type="checkbox"> Texto base</label> <input id="textbox" type="text"><br>
        <label><input id="suffixcheck" type="checkbox"> Sufixo</label> <input id="suffixbox" type="text"><br>
        <label>Início contador: <input id="contadorInicio" type="number" value="1" style="width:60px;"></label><br>
        <label>Delay (ms): <input id="delay" type="number" value="400" style="width:60px;"></label><br>
        <label><input id="coords" type="checkbox"> Incluir coordenadas</label><br>
        <label><input id="filtercheck" type="checkbox"> Filtro</label> <input id="filtertext" type="text"><br>
        <label><input id="regexcheck" type="checkbox"> Usar regex</label><br>
        <label>Ordem:
          <select id="ordem">
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </label>
        <hr>
        <button id="btnExecutar" class="btn">Executar</button>
        <button id="btnParar" class="btn">Parar</button>
        <div style="margin-top:10px;">
          <div style="height:14px; background:#ccc;">
            <div id="barraProgresso" style="height:14px; background:green; width:0%;"></div>
          </div>
          <div id="barraTexto" style="text-align:center; font-weight:bold;">0%</div>
        </div>
        <div style="max-height:150px; overflow:auto; margin-top:6px;">
          <ul id="listaPreview" style="list-style:none; padding:0; font-size:11px;"></ul>
        </div>
      </div>
    `);

    const getConfig = () => ({
      usarNumeracao: document.getElementById('numeracao').checked,
      digitos: parseInt(document.getElementById('digitos').value) || 2,
      usarPrefixo: document.getElementById('prefixcheck').checked,
      prefixo: document.getElementById('prefixbox').value.trim(),
      usarTexto: document.getElementById('textocheck').checked,
      textoBase: document.getElementById('textbox').value.trim(),
      usarSufixo: document.getElementById('suffixcheck').checked,
      sufixo: document.getElementById('suffixbox').value.trim(),
      inicio: parseInt(document.getElementById('contadorInicio').value) || 1,
      delay: parseInt(document.getElementById('delay').value) || 400,
      incluirCoords: document.getElementById('coords').checked,
      filtrar: document.getElementById('filtercheck').checked,
      filtroNome: document.getElementById('filtertext').value.trim(),
      regex: document.getElementById('regexcheck').checked,
      ordem: document.getElementById('ordem').value
    });

    document.getElementById('btnExecutar').onclick = async () => {
      if (renomearAtivo) return;
      renomearAtivo = true;
      await renomearAldeias(getConfig());
    };

    document.getElementById('btnParar').onclick = () => {
      interromper = true;
    };

    const atualizar = () => atualizarPreview(getConfig());
    document.querySelectorAll('#painelAvancado input, #painelAvancado select').forEach(el => {
      el.addEventListener('change', atualizar);
      el.addEventListener('input', atualizar);
    });

    atualizar();
  };

  const btn = document.createElement('button');
  btn.textContent = 'Abrir Painel Renomeação';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = 9999;
  btn.className = 'btn';
  btn.onclick = () => abrirPainelAvancado();
  document.body.appendChild(btn);
})();
