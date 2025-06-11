//bonito mas não funciona

(function () {
  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  let interromper = false;

  // Monta o nome baseado nos parâmetros
  function montarNome(contador, digitos, prefixo, textoBase, usarNumeracao, usarPrefixo, usarTexto, usarSufixo, sufixo, incluirCoords, coords) {
    let partes = [];
    if (usarNumeracao) partes.push(String(contador).padStart(digitos, '0'));
    if (usarPrefixo) partes.push(prefixo);
    if (usarTexto) partes.push(textoBase);
    if (usarSufixo && sufixo) partes.push(sufixo);
    if (incluirCoords && coords) partes.push(coords);
    return partes.filter(Boolean).join(' ').trim();
  }

  // Pega coordenadas da linha da aldeia
  function pegarCoordenadasDoIcone($icon) {
    let coord = $icon.closest('tr').find('.quickedit-village-coordinate').text() || '';
    return coord.trim();
  }

  // Executa a renomeação com as configs, atualizando barra e respeitando interrupção
  async function executarRenomeacaoAvancada(config, contadorInicial, onUpdateProgress) {
    interromper = false;
    let contador = contadorInicial;

    let $aldeias = $('.rename-icon:visible').filter(function () {
      const nomeAtual = $(this).closest('tr').find('.quickedit-village-name').text() || '';
      if (!config.filtroNome) return true;
      try {
        if (config.regex) {
          const re = new RegExp(config.filtroNome, 'i');
          return re.test(nomeAtual);
        } else {
          return nomeAtual.toLowerCase().includes(config.filtroNome.toLowerCase());
        }
      } catch {
        return true;
      }
    });

    if (config.ordem === 'decrescente') {
      $aldeias = $($aldeias.get().reverse());
    }

    const total = $aldeias.length;
    for (let i = 0; i < total; i++) {
      if (interromper) break;

      const $btn = $($aldeias[i]);
      $btn.click();

      await delay(300);

      const coord = pegarCoordenadasDoIcone($btn);

      const novoNome = montarNome(
        contador,
        config.digitos,
        config.prefixo,
        config.textoBase,
        config.usarNumeracao,
        config.usarPrefixo,
        config.usarTexto,
        config.usarSufixo,
        config.sufixo,
        config.incluirCoordenadas,
        coord
      );

      const input = document.querySelector('.vis input[type="text"]');
      const confirmar = document.querySelector('.vis input[type="button"]');

      if (input && confirmar) {
        input.value = novoNome;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(150);
        confirmar.click();
      }

      contador++;

      if (onUpdateProgress) onUpdateProgress(i + 1, total);
      await delay(config.delay);
    }

    return contador;
  }

  // Mostra preview no painel
  function mostrarPreview(config, contadorInicial) {
    const $aldeias = $('.rename-icon:visible');
    let contador = contadorInicial;
    let htmlPreview = `<b>Prévia (${$aldeias.length})</b><br>`;

    $aldeias.each(function () {
      const coord = pegarCoordenadasDoIcone($(this));
      const nome = montarNome(
        contador++,
        config.digitos,
        config.prefixo,
        config.textoBase,
        config.usarNumeracao,
        config.usarPrefixo,
        config.usarTexto,
        config.usarSufixo,
        config.sufixo,
        config.incluirCoordenadas,
        coord
      );
      htmlPreview += `• ${nome}<br>`;
    });

    $('#previewList').html(htmlPreview);
  }

  // Abre painel principal bonitinho
  function abrirPainelAvancado() {
    const contadorAtual = parseInt(localStorage.getItem('renamer_counter') || '1', 10);

    const html = `
      <div style="font-size:11px; line-height:1.2;">
        <h2 align='center'>Renomeação Avançada de Aldeias</h2>
        <table class="vis" style="width:100%; margin-top:4px;">
          <tr><td><input id="firstbox" type="checkbox"> Usar numeração</td>
              <td><input id="end" type="number" min="1" max="10" value="2" style="width:40px;"></td></tr>

          <tr><td><input id="prefixcheck" type="checkbox"> Usar prefixo</td>
              <td><input id="prefixbox" type="text" maxlength="10" style="width:50px;" placeholder="Ex: 08"></td></tr>

          <tr><td><input id="secondbox" type="checkbox"> Usar nome base</td>
              <td><input id="textname" type="text" maxlength="32" style="width:90px;" placeholder="Nome"></td></tr>

          <tr><td><input id="sufixocheck" type="checkbox"> Usar sufixo</td>
              <td><input id="sufixobox" type="text" maxlength="15" style="width:90px;" placeholder="Ex: (A)"></td></tr>

          <tr><td><input id="incluirCoords" type="checkbox"> Incluir coordenadas</td><td></td></tr>

          <tr><td>Filtro por nome (texto ou regex):</td>
              <td><input id="filtroNome" type="text" style="width:90px;" placeholder="Filtro"></td></tr>

          <tr><td><input id="usarRegex" type="checkbox"> Usar regex</td><td></td></tr>

          <tr><td>Ordem:</td>
              <td>
                <select id="ordem">
                  <option value="crescente">Crescente</option>
                  <option value="decrescente">Decrescente</option>
                </select>
              </td></tr>

          <tr><td>Delay (ms):</td>
              <td><input id="delay" type="number" min="50" max="2000" step="50" value="300" style="width:60px;"></td></tr>

          <tr><td>Contador atual:</td>
              <td><span id="contadorAtual" style="color:green;">${contadorAtual}</span></td></tr>

          <tr><td>Início contador:</td>
              <td><input id="setCounter" type="number" style="width:60px;" value="${contadorAtual}"></td></tr>
        </table>

        <div style="margin-top:10px; text-align:center;">
          <input id="btnPreview" class="btn" type="button" value="Visualizar Prévia">
          <input id="btnRenomear" class="btn" type="button" value="Renomear">
          <input id="btnSalvar" class="btn" type="button" value="Salvar Configuração">
          <input id="btnResetar" class="btn" type="button" value="Resetar">
        </div>

        <div style="margin-top: 10px;">
          <div style="font-size:11px; margin-bottom:2px;">Progresso:</div>
          <div style="width: 100%; background: #ddd; height: 14px; border-radius: 5px; overflow: hidden;">
            <div id="barraProgresso" style="width: 0%; background: green; height: 100%; transition: width 0.3s;"></div>
          </div>
          <div style="text-align: right; font-size:10px;"><span id="progressoTexto">0%</span></div>
        </div>

        <div id="previewList" style="max-height:150px; overflow:auto; border:1px solid #ccc; margin-top:8px; font-size:10px;"></div>

        <div style="text-align:center; font-size:10px; margin-top:8px;">
          <strong>Versão: <span style="color:red;">2.2</span></strong>
        </div>
      </div>`;

    Dialog.show('renomeacaoAvancada', html);

    // Carregar configs salvas
    const configSalva = JSON.parse(localStorage.getItem('renamer_config_avancada') || '{}');

    $('#firstbox').prop('checked', !!configSalva.usarNumeracao);
    $('#end').val(configSalva.digitos || 2);
    $('#prefixcheck').prop('checked', !!configSalva.usarPrefixo);
    $('#prefixbox').val(configSalva.prefixo || '');
    $('#secondbox').prop('checked', !!configSalva.usarTexto);
    $('#textname').val(configSalva.textoBase || '');
    $('#sufixocheck').prop('checked', !!configSalva.usarSufixo);
    $('#sufixobox').val(configSalva.sufixo || '');
    $('#incluirCoords').prop('checked', !!configSalva.incluirCoordenadas);
    $('#filtroNome').val(configSalva.filtroNome || '');
    $('#usarRegex').prop('checked', !!configSalva.regex);
    $('#ordem').val(configSalva.ordem || 'crescente');
    $('#delay').val(configSalva.delay || 300);
    $('#setCounter').val(contadorAtual);
    $('#contadorAtual').text(contadorAtual);

    // Atualiza preview
    function atualizarPreview() {
      const config = lerConfigDoPainel();
      mostrarPreview(config, Number($('#setCounter').val()) || 1);
    }

    // Ler configs do painel
    function lerConfigDoPainel() {
      return {
        usarNumeracao: $('#firstbox').is(':checked'),
        digitos: Math.max(1, Math.min(10, Number($('#end').val()) || 2)),
        usarPrefixo: $('#prefixcheck').is(':checked'),
        prefixo: $('#prefixbox').val(),
        usarTexto: $('#secondbox').is(':checked'),
        textoBase: $('#textname').val(),
        usarSufixo: $('#sufixocheck').is(':checked'),
        sufixo: $('#sufixobox').val(),
        incluirCoordenadas: $('#incluirCoords').is(':checked'),
        filtroNome: $('#filtroNome').val(),
        regex: $('#usarRegex').is(':checked'),
        ordem: $('#ordem').val(),
        delay: Math.max(50, Math.min(2000, Number($('#delay').val()) || 300)),
      };
    }

    // Evento botões e inputs para preview automático
    $('#firstbox, #end, #prefixcheck, #prefixbox, #secondbox, #textname, #sufixocheck, #sufixobox, #incluirCoords, #filtroNome, #usarRegex, #ordem, #delay, #setCounter').on('input change', function () {
      atualizarPreview();
    });

    // Botão Visualizar Prévia
    $('#btnPreview').on('click', () => {
      atualizarPreview();
    });

    // Botão Salvar configuração
    $('#btnSalvar').on('click', () => {
      const config = lerConfigDoPainel();
      localStorage.setItem('renamer_config_avancada', JSON.stringify(config));
      alert('Configuração salva!');
    });

    // Botão Resetar
    $('#btnResetar').on('click', () => {
      localStorage.removeItem('renamer_config_avancada');
      localStorage.removeItem('renamer_counter');
      alert('Configurações e contador resetados!');
      Dialog.close('renomeacaoAvancada');
      abrirPainelAvancado();
    });

    // Botão Renomear
    $('#btnRenomear').on('click', async () => {
      const config = lerConfigDoPainel();
      let contador = Number($('#setCounter').val()) || 1;

      // Cria diálogo para controle e progresso
      Dialog.show('renomeacaoProgresso', `
        <div style="font-size:12px; text-align:center; padding:15px;">
          <h3>Renomeando aldeias...</h3>
          <div style="width: 100%; background: #ddd; height: 20px; border-radius: 10px; overflow: hidden; margin-bottom:10px;">
            <div id="barraDialog" style="width: 0%; height: 100%; background: #4CAF50; transition: width 0.3s;"></div>
          </div>
          <div id="textoDialog" style="margin-bottom:10px;">0%</div>
          <button id="btnParar" class="btn">Parar</button>
        </div>
      `);

      $('#btnParar').on('click', () => {
        interromper = true;
      });

      // Executa renomeação
      contador = await executarRenomeacaoAvancada(config, contador, (atual, total) => {
        const perc = Math.round((atual / total) * 100);
        $('#barraDialog').css('width', perc + '%');
        $('#textoDialog').text(`${perc}% (${atual}/${total})`);

        $('#barraProgresso').css('width', perc + '%');
        $('#progressoTexto').text(`${perc}% (${atual}/${total})`);
      });

      localStorage.setItem('renamer_counter', contador);
      $('#contadorAtual').text(contador);

      if (interromper) {
        alert('Renomeação interrompida.');
      } else {
        alert('Renomeação concluída.');
      }

      // Fecha diálogo de progresso e volta ao painel principal
      Dialog.close('renomeacaoProgresso');
      Dialog.show('renomeacaoAvancada', html); // Reabre o painel com tudo restaurado
      // Restaura os valores dos inputs e preview
      abrirPainelAvancado();
    });

    // Gera preview inicial
    atualizarPreview();
  }

  // Inicializa
  abrirPainelAvancado();

})();
