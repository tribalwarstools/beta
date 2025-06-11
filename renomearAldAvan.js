(function () {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  let interromper = false;
  let renomearAtivo = false;

  // Monta nome baseado na config e contador
  function montarNome(contador, digitos, prefixo, textoBase, sufixo, usarNumeracao, usarPrefixo, usarTexto, usarSufixo, coordenadas) {
    let partes = [];
    if (usarNumeracao) partes.push(String(contador).padStart(digitos, '0'));
    if (usarPrefixo) partes.push(prefixo);
    if (usarTexto) partes.push(textoBase);
    if (coordenadas) partes.push(coordenadas);
    if (usarSufixo) partes.push(sufixo);
    return partes.filter(Boolean).join(' ').trim();
  }

  // Atualiza a lista de preview no painel
  function atualizarPreview(config) {
    const listaPreview = document.getElementById('listaPreview');
    if (!listaPreview) return;

    const icones = [...document.querySelectorAll('.rename-icon')].filter(el => el.offsetParent !== null);
    const nomesAtuais = icones.map(el => el.closest('tr').querySelector('span.quickedit-label')?.innerText || '');

    let aldeias = icones.map((el, i) => ({ el, nome: nomesAtuais[i] }));

    if (config.filtrar) {
      try {
        const re = config.regex ? new RegExp(config.filtroNome) : null;
        aldeias = aldeias.filter(a => {
          return config.regex ? re.test(a.nome) : a.nome.includes(config.filtroNome);
        });
      } catch {
        listaPreview.innerHTML = '<li style="color:red;">Filtro regex inválido</li>';
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();

    let contador = config.inicio || 1;

    // Limpa lista
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
      li.textContent = `${aldeia.nome} → ${nomePreview}`;
      listaPreview.appendChild(li);
    });

    if (aldeias.length === 0) {
      listaPreview.innerHTML = '<li>Nenhuma aldeia visível para pré-visualizar</li>';
    }
  }

  // Carrega config do localStorage e preenche inputs
  function carregarConfiguracao() {
    const raw = localStorage.getItem('renomearConfig');
    if (!raw) return;
    try {
      const config = JSON.parse(raw);

      document.getElementById('numeracao').checked = !!config.usarNumeracao;
      document.getElementById('digitos').value = config.digitos || 2;
      document.getElementById('prefixcheck').checked = !!config.usarPrefixo;
      document.getElementById('prefixbox').value = config.prefixo || '';
      document.getElementById('textocheck').checked = !!config.usarTexto;
      document.getElementById('textbox').value = config.textoBase || '';
      document.getElementById('suffixcheck').checked = !!config.usarSufixo;
      document.getElementById('suffixbox').value = config.sufixo || '';
      document.getElementById('contadorInicio').value = config.inicio || 1;
      document.getElementById('delay').value = config.delay || 400;
      document.getElementById('coords').checked = !!config.incluirCoords;
      document.getElementById('filtercheck').checked = !!config.filtrar;
      document.getElementById('filtertext').value = config.filtroNome || '';
      document.getElementById('regexcheck').checked = !!config.regex;
      document.getElementById('ordem').value = config.ordem || 'asc';

    } catch {
      UI.ErrorMessage('Falha ao carregar configuração salva.');
    }
  }

  // Salva config no localStorage
  function salvarConfiguracao() {
    const config = {
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
    };
    localStorage.setItem('renomearConfig', JSON.stringify(config));
    UI.SuccessMessage('Configuração salva!');
  }

  // Reseta configuração para valores padrão
  function resetarConfiguracao() {
    localStorage.removeItem('renomearConfig');
    document.getElementById('numeracao').checked = true;
    document.getElementById('digitos').value = 2;
    document.getElementById('prefixcheck').checked = false;
    document.getElementById('prefixbox').value = '';
    document.getElementById('textocheck').checked = false;
    document.getElementById('textbox').value = '';
    document.getElementById('suffixcheck').checked = false;
    document.getElementById('suffixbox').value = '';
    document.getElementById('contadorInicio').value = 1;
    document.getElementById('delay').value = 400;
    document.getElementById('coords').checked = false;
    document.getElementById('filtercheck').checked = false;
    document.getElementById('filtertext').value = '';
    document.getElementById('regexcheck').checked = false;
    document.getElementById('ordem').value = 'asc';
    UI.SuccessMessage('Configuração resetada para padrão.');
  }

  async function renomearAldeias(config) {
    const icones = [...document.querySelectorAll('.rename-icon')].filter(el => el.offsetParent !== null);
    const nomesAtuais = icones.map(el => el.closest('tr').querySelector('span.quickedit-label')?.innerText || '');

    let aldeias = icones.map((el, i) => ({ el, nome: nomesAtuais[i] }));

    if (config.filtrar) {
      try {
        const re = config.regex ? new RegExp(config.filtroNome) : null;
        aldeias = aldeias.filter(a => {
          return config.regex ? re.test(a.nome) : a.nome.includes(config.filtroNome);
        });
      } catch {
        UI.ErrorMessage('Expressão regular inválida.');
        renomearAtivo = false;
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();
    let contador = config.inicio || 1;

    interromper = false;

    const barraProgresso = document.getElementById('barraProgresso');
    const barraTexto = document.getElementById('barraTexto');
    const btnParar = document.getElementById('btnParar');
    if (!barraProgresso || !btnParar || !barraTexto) {
      UI.ErrorMessage('Painel de controle não encontrado.');
      renomearAtivo = false;
      return;
    }

    btnParar.disabled = false;
    btnParar.textContent = 'Parar';

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
        barraProgresso.style.width = progresso + '%';
        barraTexto.textContent = progresso.toFixed(1) + '%';
      }

      await delay(config.delay);
    }

    // Salvar contador atualizado
    const configSalvaRaw = localStorage.getItem('renomearConfig');
    if (configSalvaRaw) {
      try {
        const configSalva = JSON.parse(configSalvaRaw);
        configSalva.inicio = contador;
        localStorage.setItem('renomearConfig', JSON.stringify(configSalva));
      } catch { }
    }

    UI.SuccessMessage(interromper ? 'Renomeação interrompida pelo usuário.' : 'Processo de renomeação finalizado.');

    btnParar.textContent = 'Parar';
    btnParar.disabled = true;

    interromper = false;
    renomearAtivo = false;
  }

  function abrirPainelAvancado() {
    interromper = false;

    Dialog.show('painelAvancado', `
  <div style="font-size:13px; padding:10px; max-width:650px; margin:auto;">
    <div style="display:flex; gap:10px;">
      <div style="flex:1; min-width:280px;">
        <h3 style="text-align:center; margin-bottom:10px;">Configuração de Renomeação</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <label><input id="numeracao" type="checkbox" checked> Numeração</label>
          <label style="display:flex; align-items:center;">Digitos: <input id="digitos" type="number" value="2" min="1" max="10" style="width:50px; margin-left:4px;"></label>

          <label><input id="prefixcheck" type="checkbox"> Prefixo</label>
          <input id="prefixbox" type="text" placeholder="Ex: K55" style="width:100%;">

          <label><input id="textocheck" type="checkbox"> Texto base</label>
          <input id="textbox" type="text" placeholder="Ex: Aldeia" style="width:100%;">

          <label><input id="suffixcheck" type="checkbox"> Sufixo</label>
          <input id="suffixbox" type="text" placeholder="Ex: Norte" style="width:100%;">

          <label style="grid-column:2; display:flex; align-items:center;">Início contador: <input id="contadorInicio" type="number" value="1" style="width:60px; margin-left:4px;"></label>

          <label style="grid-column:2; display:flex; align-items:center;">Delay (ms): <input id="delay" type="number" value="400" style="width:60px; margin-left:4px;"></label>

          <label><input id="coords" type="checkbox"> Incluir coordenadas</label>
          <label><input id="filtercheck" type="checkbox"> Filtro por nome</label>
          <input id="filtertext" type="text" placeholder="Texto ou regex" style="width:100%;" />
          
          <label><input id="regexcheck" type="checkbox"> Usar regex</label>

          <label for="ordem">Ordem</label>
          <select id="ordem" style="width:100%;">
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:center; gap:8px;">
          <button id="btnExecutar" class="btn btn-confirm-yes" >Executar</button>
          <button id="btnParar" class="btn btn-confirm-no" disabled>Parar</button>
          <button id="btnSalvar" class="btn btn-confirm-yes" >Salvar</button>
          <button id="btnResetar" class="btn btn-confirm-no" >Resetar</button>
        </div>
      </div>

      <div style="flex:1; min-width:300px; max-height:400px; overflow-y:auto; border:1px solid #ccc; border-radius:6px; padding:6px; background:#fafafa;">
        <h3 style="text-align:center; margin:0 0 8px;">Pré-visualização de nomes</h3>
        <ul id="listaPreview" style="list-style:none; padding-left:8px; font-size:10px; line-height:1.3; color:#444; margin:0;">
          <li>Nenhuma aldeia visível para pré-visualizar</li>
        </ul>
      </div>
    </div>

    <!-- BARRA DE PROGRESSO TOTAL -->
    <div style="height:16px; background:#ddd; margin-top:10px; border-radius:8px; overflow:hidden; width:100%;">
      <div id="barraProgresso" style="height:16px; width:0%; background: linear-gradient(90deg,#4caf50,#81c784);"></div>
    </div>
    <div id="barraTexto" style="text-align:center; margin-top:4px; font-weight:bold;">0%</div>
  </div>
`);


    carregarConfiguracao();

    const atualizar = () => {
      const config = {
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
      };
      atualizarPreview(config);
    };

    ['numeracao', 'digitos', 'prefixcheck', 'prefixbox', 'textocheck', 'textbox', 'suffixcheck', 'suffixbox',
      'contadorInicio', 'delay', 'coords', 'filtercheck', 'filtertext', 'regexcheck', 'ordem'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', atualizar);
          el.addEventListener('change', atualizar);
        }
      });

    atualizar();

    document.getElementById('btnSalvar').onclick = () => {
      salvarConfiguracao();
      atualizar();
    };

    document.getElementById('btnResetar').onclick = () => {
      resetarConfiguracao();
      atualizar();
    };

    document.getElementById('btnParar').onclick = () => {
      interromper = true;
      UI.InfoMessage('Parando renomeação...');
    };

    document.getElementById('btnExecutar').onclick = async () => {
      if (renomearAtivo) {
        UI.InfoMessage('Já está renomeando!');
        return;
      }
      renomearAtivo = true;
      atualizar();
      const config = {
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
      };
      await renomearAldeias(config);
    };
  }

  // Cria botão para abrir painel
  function criarBotaoPainel() {
    if (document.getElementById('btnAbrirPainelAvancado')) return;
    const btn = document.createElement('button');
    btn.id = 'btnAbrirPainelAvancado';
    btn.textContent = 'Painel Renomeação Avançada';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.padding = '10px 16px';
    btn.style.zIndex = 9999;
    btn.style.backgroundColor = '#603000';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    btn.onclick = abrirPainelAvancado;
    document.body.appendChild(btn);
  }

  criarBotaoPainel();
})();
