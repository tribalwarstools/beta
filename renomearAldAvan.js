(function () {
  // Variável de controle global para interrupção
  let interromperRenomeacao = false;

  // Função para abrir o painel separado
  function abrirPainelRenomeacaoAvancada() {
    Dialog.show('painel_avancado', `
      <div style="font-size:12px; line-height:1.3;">
        <h3 style="text-align:center;">Renomeação Avançada</h3>
        <table class="vis" style="width:100%;">
          <tr><td>Prefixo:</td><td><input id="ra_prefixo" type="text" style="width:100px;"></td></tr>
          <tr><td>Sufixo:</td><td><input id="ra_sufixo" type="text" style="width:100px;"></td></tr>
          <tr><td>Texto Base:</td><td><input id="ra_texto" type="text" style="width:100px;"></td></tr>
          <tr><td>Remover texto atual:</td><td><input id="ra_remover" type="checkbox"></td></tr>
          <tr><td>Incluir coordenadas:</td><td><input id="ra_coords" type="checkbox"></td></tr>
          <tr><td>Filtro por nome:</td><td><input id="ra_filtro" type="text" style="width:100px;"></td></tr>
          <tr><td>Ordem:</td>
              <td>
                <select id="ra_ordem">
                  <option value="normal">Crescente</option>
                  <option value="reversa">Decrescente</option>
                </select>
              </td>
          </tr>
          <tr><td>Delay (ms):</td><td><input id="ra_delay" type="number" value="300" style="width:60px;"></td></tr>
        </table>
        <div style="text-align:center; margin-top:8px;">
          <button id="ra_executar" class="btn">Renomear Automaticamente</button>
          <button id="ra_parar" class="btn" style="background:red; color:white;">Parar</button>
        </div>
      </div>
    `);

    // Lógica de clique para executar a renomeação
    $('#ra_executar').on('click', async () => {
      interromperRenomeacao = false;
      const delay = parseInt($('#ra_delay').val()) || 300;
      const prefixo = $('#ra_prefixo').val().trim();
      const sufixo = $('#ra_sufixo').val().trim();
      const textoBase = $('#ra_texto').val().trim();
      const removerAtual = $('#ra_remover').is(':checked');
      const incluirCoords = $('#ra_coords').is(':checked');
      const filtro = $('#ra_filtro').val().trim().toLowerCase();
      const ordem = $('#ra_ordem').val();

      let $icones = $('.rename-icon');
      if (ordem === 'reversa') $icones = $($icones.get().reverse());

      let contador = 1;

      for (const icon of $icones) {
        if (interromperRenomeacao) {
          UI.InfoMessage("⏹️ Renomeação interrompida.");
          break;
        }

        const $linha = $(icon).closest('tr');
        const nomeAtual = $linha.find('span.quickedit-label').text().trim();
        const coordenadas = nomeAtual.match(/\d+\|\d+/)?.[0] || '';
        if (filtro && !nomeAtual.toLowerCase().includes(filtro)) continue;

        icon.click();
        await new Promise(r => setTimeout(r, 200));

        const input = document.querySelector('.vis input[type="text"]');
        const botao = document.querySelector('.vis input[type="button"]');
        if (!input || !botao) continue;

        const numero = String(contador++).padStart(2, '0');
        let novoNome = `${prefixo} ${textoBase} ${numero} ${sufixo}`.trim();
        if (incluirCoords && coordenadas) novoNome += ` (${coordenadas})`;
        if (!removerAtual) novoNome = `${nomeAtual} → ${novoNome}`;

        input.value = novoNome;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise(r => setTimeout(r, 200));
        botao.click();

        await new Promise(r => setTimeout(r, delay));
      }
    });

    // Lógica de clique para interromper
    $('#ra_parar').on('click', () => {
      interromperRenomeacao = true;
    });
  }

  // Executa automaticamente o painel ao carregar
  abrirPainelRenomeacaoAvancada();
})();
