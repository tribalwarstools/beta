//barra de progresso

(function () {
  function montarNome(contador, digitos, prefixo, textoBase, usarNumeracao, usarPrefixo, usarTexto) {
    return [
      usarNumeracao ? String(contador).padStart(digitos, '0') : '',
      usarPrefixo ? prefixo : '',
      usarTexto ? textoBase : ''
    ].filter(Boolean).join(' ').trim();
  }

  async function executarRenomeacao(contadorAtual) {
    const usarNumeracao = $('#firstbox').prop('checked');
    const digitos = parseInt($('#end').val()) || 2;
    const usarPrefixo = $('#prefixcheck').prop('checked');
    const prefixo = $('#prefixbox').val().trim();
    const usarTexto = $('#secondbox').prop('checked');
    const textoBase = $('#textname').val() || '';
    const novoInicio = parseInt($('#setCounter').val());

    let contador = !isNaN(novoInicio) ? novoInicio : contadorAtual;
    if (!isNaN(novoInicio)) {
      localStorage.setItem('renamer_counter', contador.toString());
    }

    const $aldeias = $('.rename-icon:visible');
    const total = $aldeias.length;

    for (let i = 0; i < total; i++) {
      const $btn = $aldeias[i];
      $btn.click();

      await new Promise(res => setTimeout(res, 300));

      const novoNome = montarNome(contador++, digitos, prefixo, textoBase, usarNumeracao, usarPrefixo, usarTexto);
      const input = document.querySelector('.vis input[type="text"]');
      const confirmar = document.querySelector('.vis input[type="button"]');

      if (input && confirmar) {
        input.value = novoNome;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 100));
        confirmar.click();
      }

      // Atualiza barra de progresso
      const progresso = Math.round(((i + 1) / total) * 100);
      $('#barraProgresso').css('width', progresso + '%');
      $('#progressoTexto').text(`${progresso}%`);

      await new Promise(res => setTimeout(res, 200));
    }

    localStorage.setItem('renamer_counter', String(contador));
    UI.SuccessMessage('✅ Renomeação finalizada.');
  }

  function abrirPainelRenomear() {
    const contadorAtual = parseInt(localStorage.getItem('renamer_counter') || '1', 10);

    const $html = `
      <div style="font-size:11px; line-height:1.2;">
        <h2 align='center'>Renomear Aldeias</h2>
        <table class="vis" style="width:100%; margin-top:4px;">
          <tr>
            <td><input id="firstbox" type="checkbox">Dígitos</td>
            <td><input id="end" type="number" min="1" max="10" value="2" style="width:40px;"></td>
          </tr>
          <tr>
            <td><input id="prefixcheck" type="checkbox">Prefixo</td>
            <td><input id="prefixbox" type="text" maxlength="10" style="width:50px;" placeholder="Ex: 08"></td>
          </tr>
          <tr>
            <td><input id="secondbox" type="checkbox">Nome</td>
            <td><input id="textname" type="text" maxlength="32" style="width:90px;" placeholder="Nome"></td>
          </tr>
          <tr>
            <td>Atual:</td>
            <td><span id="contadorAtual" style="color:green;">${contadorAtual}</span></td>
          </tr>
          <tr>
            <td>Início:</td>
            <td><input id="setCounter" type="number" style="width:50px;"></td>
          </tr>
        </table>

        <div style="margin-top:10px; text-align:center;">
          <input id="rename" type="button" class="btn" value="Renomear">
        </div>

        <div style="margin-top: 10px;">
          <div style="font-size:11px; margin-bottom:2px;">Progresso:</div>
          <div style="width: 100%; background: #ddd; height: 12px; border-radius: 5px; overflow: hidden;">
            <div id="barraProgresso" style="width: 0%; background: green; height: 100%; transition: width 0.3s;"></div>
          </div>
          <div style="text-align: right; font-size:10px;"><span id="progressoTexto">0%</span></div>
        </div>

        <div style="text-align:center; font-size:10px; margin-top:4px;">
          <strong>Versão: <span style="color:red;">2.1</span></strong>
        </div>
      </div>`;

    Dialog.show('rename', $html);

    $('#rename').on('click', () => {
      executarRenomeacao(contadorAtual);
    });
  }

  abrirPainelRenomear();
})();
