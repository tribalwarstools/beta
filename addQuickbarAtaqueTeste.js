(async function abrirPainelAddAtalho(defaultName = '', defaultHref = '') {
  async function adicionarAtalho(name, href) {
    try {
      const token = window.csrf_token || (typeof twSDK !== 'undefined' && await twSDK.getCSRFToken()) || null;
      if (!token) {
        UI.ErrorMessage('Token CSRF não encontrado.');
        return false;
      }
      const data = `hotkey=&name=${encodeURIComponent(name)}&href=${encodeURIComponent(href)}&h=${token}`;
      await jQuery.ajax({
        url: '/game.php?screen=settings&mode=quickbar_edit&action=quickbar_edit&',
        method: 'POST',
        data,
      });
      UI.SuccessMessage('Atalho adicionado com sucesso!');
      return true;
    } catch (e) {
      UI.ErrorMessage('Erro ao adicionar atalho: ' + e.message);
      return false;
    }
  }

  const $html = `
    <div style="font-size:11px; line-height:1.2;">
      <h2 align="center">Adicionar atalho quickbar</h2>
      <table class="vis" style="width:100%; margin-top:4px;">
        <tr>
          <td>Nome do atalho:</td>
          <td>
            <input id="inputName" type="text" maxlength="30" style="width:50%;" placeholder="Nome do atalho">
          </td>
        </tr>
        <tr>
          <td>Link do script:</td>
          <td style="display:flex; gap:4px;">
            <input id="inputHref" type="text" maxlength="200" style="width:50%;" value="${defaultHref}" readonly>
            <button id="btnCopyUrl" class="btn" style="white-space: nowrap;">Copiar URL</button>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="text-align:center; padding-top:6px;">
            <input id="btnAdd" type="button" class="btn" value="Adicionar Atalho">
          </td>
        </tr>
      </table>
    </div>
  `;

  Dialog.show('add_quickbar', $html);

  $('#btnCopyUrl').on('click', () => {
    const url = $('#inputHref').val();
    if (!url) {
      UI.ErrorMessage('Campo URL está vazio.');
      return;
    }
    navigator.clipboard.writeText(url)
      .then(() => UI.SuccessMessage('URL copiada para a área de transferência!'))
      .catch(() => UI.ErrorMessage('Falha ao copiar a URL.'));
  });

  $('#btnAdd').on('click', async () => {
    const name = $('#inputName').val().trim();
    const href = $('#inputHref').val().trim();

    if (!name || !href) {
      UI.ErrorMessage('Preencha nome e link do atalho.');
      return;
    }

    await adicionarAtalho(name, href);

    Dialog.close();
    location.reload();  // Atualiza a página para refletir o novo atalho
  });
})(
  '',
  "javascript:$.getScript('https://tribalwarstools.github.io/twscripts/ataque.js');"
);
