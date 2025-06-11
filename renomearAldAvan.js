(function () {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  let interromper = false;

  function montarNome(contador, digitos, prefixo, textoBase, sufixo, usarNumeracao, usarPrefixo, usarTexto, usarSufixo, coordenadas) {
    let partes = [];
    if (usarNumeracao) partes.push(String(contador).padStart(digitos, '0'));
    if (usarPrefixo) partes.push(prefixo);
    if (usarTexto) partes.push(textoBase);
    if (coordenadas) partes.push(coordenadas);
    if (usarSufixo) partes.push(sufixo);
    return partes.filter(Boolean).join(' ').trim();
  }

  async function renomearAldeias(config) {
    const icones = [...document.querySelectorAll('.rename-icon')];
    const nomesAtuais = icones.map(el => el.closest('tr').querySelector('span.quickedit-label')?.innerText || '');

    let aldeias = icones.map((el, i) => ({ el, nome: nomesAtuais[i] }));

    if (config.filtrar) {
      try {
        const re = config.regex ? new RegExp(config.filtroNome) : null;
        aldeias = aldeias.filter(a => {
          return config.regex ? re.test(a.nome) : a.nome.includes(config.filtroNome);
        });
      } catch (e) {
        UI.ErrorMessage('Expressão regular inválida.');
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();
    let contador = config.inicio || 1;

    interromper = false;

    // Inicia barra e botão no painel já aberto
    const barraProgresso = document.getElementById('barraProgresso');
    const btnParar = document.getElementById('btnPararRenomeacao');
    if (barraProgresso) barraProgresso.style.width = '0%';
    if (btnParar) {
      btnParar.disabled = false;
      btnParar.innerText = 'Parar renomeação';
      btnParar.onclick = () => {
        interromper = true;
        btnParar.disabled = true;
        btnParar.innerText = 'Parando...';
      };
    }

    for (let i = 0; i < aldeias.length; i++) {
      if (interromper) break;

      const { el, nome } = aldeias[i];
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
        if (barraProgresso) barraProgresso.style.width = progresso + '%';
      } else {
        UI.ErrorMessage('Campo de edição não encontrado.');
        break;
      }

      await delay(config.delay);
    }

    Dialog.close();
    interromper = false;
    UI.SuccessMessage(interromper ? 'Renomeação interrompida pelo usuário.' : 'Processo de renomeação finalizado.');
  }

  function abrirPainelAvancado() {
    Dialog.show('painelAvancado', `
      <div style="font-size:11px;">
        <h3 style="text-align:center">Painel de Renomeação Avançado</h3>
        <table class="vis" style="width:100%">
          <tr><td><input id="numeracao" type="checkbox" checked> Numeração</td><td><input id="digitos" type="number" value="2" min="1" max="10" style="width:40px;"></td></tr>
          <tr><td><input id="prefixcheck" type="checkbox"> Prefixo</td><td><input id="prefixbox" type="text" style="width:80px;"></td></tr>
          <tr><td><input id="textocheck" type="checkbox"> Texto base</td><td><input id="textbox" type="text" style="width:100px;"></td></tr>
          <tr><td><input id="suffixcheck" type="checkbox"> Sufixo</td><td><input id="suffixbox" type="text" style="width:80px;"></td></tr>
          <tr><td>Início contador</td><td><input id="contadorInicio" type="number" value="1" style="width:60px;"></td></tr>
          <tr><td>Delay (ms)</td><td><input id="delay" type="number" value="400" style="width:60px;"></td></tr>
          <tr><td>Incluir coordenadas</td><td><input id="coords" type="checkbox"></td></tr>
          <tr><td><input id="filtercheck" type="checkbox"> Filtro por nome</td><td><input id="filtertext" type="text" style="width:100px;"></td></tr>
          <tr><td><input id="regexcheck" type="checkbox"> Regex avançado</td><td></td></tr>
          <tr><td>Ordem</td><td><select id="ordem"><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></td></tr>
        </table>

        <div style="margin-top:10px; text-align:center;">
          <div id="progressoRenomeio" style="margin:10px auto; height:14px; border:1px solid #000; width:90%; max-width:300px; border-radius:4px; overflow:hidden;">
            <div id="barraProgresso" style="height:100%; width:0%; background:#0c0; transition: width 0.3s ease;"></div>
          </div>
          <button class="btn" id="btnPararRenomeacao">Parar renomeação</button>
        </div>

        <div style="text-align:center; margin-top:8px">
          <button class="btn" id="executarAvancado">Executar</button>
        </div>
      </div>
    `);

    document.getElementById('executarAvancado').addEventListener('click', () => {
      if (interromper) return; // evita clicar várias vezes

      const config = {
        usarNumeracao: document.getElementById('numeracao').checked,
        usarPrefixo: document.getElementById('prefixcheck').checked,
        prefixo: document.getElementById('prefixbox').value.trim(),
        usarTexto: document.getElementById('textocheck').checked,
        textoBase: document.getElementById('textbox').value.trim(),
        usarSufixo: document.getElementById('suffixcheck').checked,
        sufixo: document.getElementById('suffixbox').value.trim(),
        digitos: parseInt(document.getElementById('digitos').value) || 2,
        inicio: parseInt(document.getElementById('contadorInicio').value) || 1,
        delay: parseInt(document.getElementById('delay').value) || 400,
        incluirCoords: document.getElementById('coords').checked,
        filtrar: document.getElementById('filtercheck').checked,
        filtroNome: document.getElementById('filtertext').value.trim(),
        regex: document.getElementById('regexcheck').checked,
        ordem: document.getElementById('ordem').value
      };
      renomearAldeias(config);
    });
  }

  abrirPainelAvancado();
})();
