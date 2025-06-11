(function () {
  // Função para montar o nome da aldeia conforme opções
  function montarNome(contador, digitos, prefixo, textoBase, usarNumeracao, usarPrefixo, usarTexto, sufixo, incluirCoord, coord) {
    let partes = [];
    if (usarNumeracao) partes.push(String(contador).padStart(digitos, '0'));
    if (usarPrefixo) partes.push(prefixo);
    if (usarTexto) partes.push(textoBase);
    if (sufixo) partes.push(sufixo);
    if (incluirCoord && coord) partes.push(coord);
    return partes.filter(Boolean).join(' ').trim();
  }

  // Delay auxiliar
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // Função para obter coordenadas da aldeia (exemplo simples, pode precisar adaptar)
  function pegarCoordenadasDoIcone($icon) {
    // Pegando texto no título ou atributo data-coord (depende do jogo)
    let coord = $icon.closest('tr').find('.quickedit-village-coordinate').text() || '';
    return coord.trim();
  }

  // Executar renomeação com barra de progresso e opção de parar
  async function executarRenomeacaoAvancada(config, contadorInicial, onUpdateProgress, onCheckStop) {
    let contador = contadorInicial;
    const $aldeias = $('.rename-icon:visible').filter(function () {
      if (!config.filtroNome) return true;
      // Filtrar pelo nome atual da aldeia - pegar o nome da aldeia, aqui assumindo texto no título ou algo assim
      const nomeAtual = $(this).closest('tr').find('.quickedit-village-name').text() || '';
      if (config.usarRegex) {
        try {
          const regex = new RegExp(config.filtroNome, config.regexFlags || '');
          return regex.test(nomeAtual);
        } catch {
          return true;
        }
      }
      return nomeAtual.toLowerCase().includes(config.filtroNome.toLowerCase());
    });

    // Ordenar de acordo com config
    if (config.ordem === 'decrescente') {
      $aldeias.get().reverse();
    }

    const total = $aldeias.length;
    for (let i = 0; i < total; i++) {
      if (onCheckStop && onCheckStop()) break; // Checa interrupção

      const $btn = $($aldeias[i]);
      $btn.click();

      await delay(config.delay);

      const coord = pegarCoordenadasDoIcone($btn);

      const novoNome = montarNome(
        contador++,
        config.digitos,
        config.prefixo,
        config.textoBase,
        config.usarNumeracao,
        config.usarPrefixo,
        config.usarTexto,
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

      if (onUpdateProgress) {
        onUpdateProgress(i + 1, total);
      }
      await delay(config.delay);
    }

    return contador;
  }

  // Função para mostrar preview no painel
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
        config.sufixo,
        config.incluirCoordenadas,
        coord
      );
      htmlPreview += `• ${nome}<br>`;
    });

    $('#previewList').html(htmlPreview);
  }

  // Painel avançado completo com barra de progresso e botão parar
  function abrirPainelAvancado() {
    const contadorAtual = parseInt(localStorage.getItem('renamer_counter') || '1', 10);

    // HTML do painel (simplificado para o exemplo)
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

          <tr><td>Sufixo:</td>
              <td><input id="sufixobox" type="text" maxlength="15" style="width:90px;" placeholder="Ex: (A)"></td></tr>

          <tr><td><input id="incluirCoords" type="checkbox"> Incluir coordenadas</td><td></td></tr>

          <tr><td>Filtro por nome (texto ou regex):</td>
              <td><input id="filtroNome" type="text" style="width:90px;" placeholder="Filtro"></td></tr>

          <tr><td>Usar Regex:</td>
              <td><input id="usarRegex" type="checkbox"></td></tr>

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
          <input id="btnParar" class="btn" type="button" value="Parar" disabled>
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
          <strong>Versão: <span style="color:red;">2.1</span></strong>
        </div>
      </div>`;

    Dialog.show('renomeacaoAvancada', html);

    // Carregar config localStorage
    const configSalva = JSON.parse(localStorage.getItem('renamer_config_avancada') || '{}');

    // Setar valores dos campos
    $('#firstbox').prop('checked', !!configSalva.usarNumeracao);
    $('#end').val(configSalva.digitos || 2);
    $('#prefixcheck').prop('checked', !!configSalva.usarPrefixo);
    $('#prefixbox').val(configSalva.prefixo || '');
    $('#secondbox').prop('checked', !!configSalva.usarTexto);
    $('#textname').val(configSalva.textoBase || '');
    $('#sufixobox').val(configSalva.sufixo || '');
    $('#incluirCoords').prop('checked', !!configSalva.incluirCoordenadas);
    $('#filtroNome').val(configSalva.filtroNome || '');
    $('#usarRegex').prop('checked', !!configSalva.usarRegex);
    $('#ordem').val(configSalva.ordem || 'crescente');
    $('#delay').val(configSalva.delay || 300);
    $('#setCounter').val(contadorAtual);

    let renomearEmExecucao = false;
    let pararExecucao = false;

    function coletarConfig() {
      return {
        usarNumeracao: $('#firstbox').prop('checked'),
        digitos: parseInt($('#end').val()) || 2,
        usarPrefixo: $('#prefixcheck').prop('checked'),
        prefixo: $('#prefixbox').val().trim(),
        usarTexto: $('#secondbox').prop('checked'),
        textoBase: $('#textname').val().trim(),
        sufixo: $('#sufixobox').val().trim(),
        incluirCoordenadas: $('#incluirCoords').prop('checked'),
        filtroNome: $('#filtroNome').val().trim(),
        usarRegex: $('#usarRegex').prop('checked'),
        ordem: $('#ordem').val(),
        delay: parseInt($('#delay').val()) || 300
      };
    }

    $('#btnPreview').on('click', () => {
      const cfg = coletarConfig();
      const contAtual = parseInt($('#setCounter').val()) || 1;
      mostrarPreview(cfg, contAtual);
    });

    $('#btnSalvar').on('click', () => {
      const cfg = coletarConfig();
      localStorage.setItem('renamer_config_avancada', JSON.stringify(cfg));
      UI.SuccessMessage('Configuração salva!');
    });

    $('#btnResetar').on('click', () => {
      localStorage.removeItem('renamer_config_avancada');
      location.reload();
    });

    $('#btnRenomear').on('click', async () => {
      if (renomearEmExecucao) return;

      renomearEmExecucao = true;
      pararExecucao = false;
      $('#btnRenomear').prop('disabled', true);
      $('#btnParar').prop('disabled', false);
      $('#barraProgresso').css('width', '0%');
      $('#progressoTexto').text('0%');

      const cfg = coletarConfig();
      let contInicio = parseInt($('#setCounter').val()) || contadorAtual;

      const onUpdateProgress = (atual, total) => {
        const pct = Math.round((atual / total) * 100);
        $('#barraProgresso').css('width', pct + '%');
        $('#progressoTexto').text(pct + '%');
        $('#contadorAtual').text(contInicio + atual - 1);
      };

      const onCheckStop = () => pararExecucao;

      const contFinal = await executarRenomeacaoAvancada(cfg, contInicio, onUpdateProgress, onCheckStop);

      localStorage.setItem('renamer_counter', contFinal);

      renomearEmExecucao = false;
      pararExecucao = false;
      $('#btnRenomear').prop('disabled', false);
      $('#btnParar').prop('disabled', true);

      if (pararExecucao) {
        UI.InfoMessage('⏹️ Renomeação interrompida pelo usuário.');
      } else {
        UI.SuccessMessage('✅ Renomeação finalizada.');
      }
    });

    $('#btnParar').on('click', () => {
      if (renomearEmExecucao) {
        pararExecucao = true;
        $('#btnParar').prop('disabled', true);
      }
    });
  }

  abrirPainelAvancado();
})();
