
(function () {
  function getGrupoAtivoViaMenu() {
    const ativo = document.querySelector('strong.group-menu-item');
    if (!ativo) return { id: 0, name: "Nenhum" };
    const id = parseInt(ativo.getAttribute('data-group-id') || "0");
    const texto = ativo.textContent.trim().replace(/[><]/g, '');
    return { id, name: texto };
  }

  function abrirPainelRenomear() {
    const url = window.location.href;
    const urlBase = '/game.php?screen=overview_villages&mode=combined';

    if (!url.includes('screen=overview_villages') || !url.includes('mode=combined')) {
      window.location.href = urlBase;
      return;
    }

    UI.InfoMessage('Iniciando...');
    const contadorAtual = parseInt(localStorage.getItem('renamer_counter') || '1', 10);

    const $html = `
      <div style="font-size:11px; line-height:1.2;">
        <h2 align='center'>Renomear aldeias</h2>
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
          <tr>
            <td colspan="2" style="text-align:center; padding-top:4px;">
              <input id="preview" type="button" class="btn" value="Visualizar">
              <input id="rename" type="button" class="btn" value="Renomear">
              <input id="resetCounter" type="button" class="btn" value="Limpar">
              <input id="save" type="button" class="btn" value="Salvar">
            </td>
          </tr>
        </table>
        <div id="previewList" style="max-height:150px; overflow:auto; border:1px solid #ccc; margin-top:6px; padding:4px; font-size:10px;"></div>
        <div style="text-align:center; font-size:10px; margin-top:4px;">
          <strong>Versão: <span style="color:red;">2.0</span></strong>
        </div>
      </div>`;

    Dialog.show('rename', $html);

    let config = JSON.parse(localStorage.getItem('renamer_config') || '{}');
    $('#firstbox').prop('checked', config.firstbox || false);
    $('#end').val(config.end || 2);
    $('#prefixcheck').prop('checked', config.prefixcheck || false);
    $('#prefixbox').val(config.prefixbox || '');
    $('#secondbox').prop('checked', config.secondbox || false);
    $('#textname').val(config.textname || '');

    $('#save').on('click', () => {
      config = {
        firstbox: $('#firstbox').prop('checked'),
        end: parseInt($('#end').val()) || 2,
        prefixcheck: $('#prefixcheck').prop('checked'),
        prefixbox: $('#prefixbox').val(),
        secondbox: $('#secondbox').prop('checked'),
        textname: $('#textname').val()
      };
      localStorage.setItem('renamer_config', JSON.stringify(config));
      UI.SuccessMessage('Configurações salvas.');
    });

    $('#resetCounter').on('click', () => {
      localStorage.removeItem('renamer_counter');
      localStorage.removeItem('renamer_config');
      $('#firstbox').prop('checked', false);
      $('#end').val('2');
      $('#prefixcheck').prop('checked', false);
      $('#prefixbox').val('');
      $('#secondbox').prop('checked', false);
      $('#textname').val('');
      $('#setCounter').val('');
      $('#contadorAtual').text('1');
      $('#previewList').html('');
      UI.SuccessMessage('Tudo resetado e limpo.');
    });

    $('#preview').on('click', async () => {
      const grupoAtivo = getGrupoAtivoViaMenu();
      const grupoNome = grupoAtivo.name;

      const usarNumeracao = $('#firstbox').prop('checked');
      const digitos = parseInt($('#end').val()) || 2;
      const usarPrefixo = $('#prefixcheck').prop('checked');
      const prefixo = $('#prefixbox').val().trim();
      const usarTexto = $('#secondbox').prop('checked');
      const textoBase = $('#textname').val() || '';
      const novoInicio = parseInt($('#setCounter').val());
      let contador = !isNaN(novoInicio) ? novoInicio : contadorAtual;

      const $aldeias = $('.rename-icon');
      const total = $aldeias.length;

      let htmlPreview = `<b>Prévia de renomeação (${total}) - Grupo: <span style="color:blue;">${grupoNome}</span></b><br>`;
      for (let i = 0; i < total; i++) {
        const nome = [
          usarNumeracao ? String(contador++).padStart(digitos, '0') : '',
          usarPrefixo ? prefixo : '',
          usarTexto ? textoBase : ''
        ].filter(Boolean).join(' ').trim();
        htmlPreview += `• ${nome}<br>`;
      }

      $('#previewList').html(htmlPreview);
    });

    $('#rename').on('click', function (e) {
      e.preventDefault();

      const usarNumeracao = $('#firstbox').prop('checked');
      const digitos = parseInt($('#end').val()) || 2;
      const usarPrefixo = $('#prefixcheck').prop('checked');
      const prefixo = $('#prefixbox').val().trim();
      const usarTexto = $('#secondbox').prop('checked');
      const textoBase = $('#textname').val() || '';
      const novoInicio = parseInt($('#setCounter').val());

      let contador = !isNaN(novoInicio) ? novoInicio : parseInt(localStorage.getItem('renamer_counter') || '1', 10);
      if (!isNaN(novoInicio)) {
        localStorage.setItem('renamer_counter', contador.toString());
      }

      Dialog.close();

      const $aldeias = $('.rename-icon');
      const total = $aldeias.length;

      $aldeias.each(function (i) {
        const $btn = this;
        setTimeout(() => {
          $($btn).click();
          const novoNome = [
            usarNumeracao ? String(contador++).padStart(digitos, '0') : '',
            usarPrefixo ? prefixo : '',
            usarTexto ? textoBase : ''
          ].filter(Boolean).join(' ').trim();
          $('.vis input[type="text"]').val(novoNome);
          $('input[type="button"]').click();
          UI.SuccessMessage(`Renomeada: ${i + 1}/${total}`);
          if (i + 1 === total) {
            localStorage.setItem('renamer_counter', String(contador));
          }
        }, i * 300);
      });
    });
  }

  // ✅ CHAMAR a função aqui:
  abrirPainelRenomear();
})();
