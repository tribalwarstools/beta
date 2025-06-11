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
      } catch (e) {
        UI.ErrorMessage('Expressão regular inválida.');
        return;
      }
    }

    if (config.ordem === 'desc') aldeias.reverse();
    let contador = config.inicio || 1;

    interromper = false;

    const barraProgresso = document.getElementById('barraProgresso');
    const barraTexto = document.getElementById('barraTexto');
    const btn = document.getElementById('btn');
    if (!barraProgresso || !btnParar || !barraTexto) {
      UI.ErrorMessage('Painel de controle não encontrado.');
      return;
    }

    btnParar.disabled = false;
    btnParar.textContent = '✋ Parar';

    btnParar.onclick = () => {
      interromper = true;
      btnParar.textContent = 'Parando...';
      btnParar.disabled = true;
    };

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

    // Salvar contador atualizado para próxima execução
    const configSalvaRaw = localStorage.getItem('renomearConfig');
    if (configSalvaRaw) {
      try {
        const configSalva = JSON.parse(configSalvaRaw);
        configSalva.inicio = contador;
        localStorage.setItem('renomearConfig', JSON.stringify(configSalva));
      } catch { /* fail silently */ }
    }

    UI.SuccessMessage(interromper ? 'Renomeação interrompida pelo usuário.' : 'Processo de renomeação finalizado.');
    interromper = false;
    renomearAtivo = false;
  }

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

  function resetarConfiguracao() {
    localStorage.removeItem('renomearConfig');
    // Valores padrão
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

  function abrirPainelAvancado() {
    interromper = false;

    Dialog.show('painelAvancado', `
      <div style="font-size:13px; padding:10px; max-width:500px; margin:auto;">
        <h3 style="text-align:center; margin-bottom:10px;">Painel de Renomeação Avançado</h3>
        
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
          
          <label><input id="regexcheck" type="checkbox"> Regex avançado</label>
          <label>Ordem:
            <select id="ordem" style="margin-left:5px;">
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>
        </div>

        <div style="margin-top:15px; border:1px solid #000; height:24px; width:100%; position:relative; background:#eee; border-radius:6px; overflow:hidden;">
          <div id="barraProgresso" style="height:100%; width:0%; background: linear-gradient(90deg, #4caf50, #81c784); transition: width 0.3s ease;"></div>
          <div id="barraTexto" style="position:absolute; top:0; left:0; width:100%; height:100%; text-align:center; line-height:24px; font-weight:bold; color:#fff; text-shadow: 0 0 3px rgba(0,0,0,0.7); user-select:none;">0%</div>
        </div>

        <div style="text-align:center; margin-top:15px;">
          <button class="btn" id="executarAvancado" style="background:#4caf50; color:white; font-weight:bold;">🚀 Executar</button>
          <button class="btn" id="btnParar" style="margin-left:8px; background:#f44336; color:white;">✋ Parar</button>
          <button class="btn" id="btnSalvar" style="margin-left:8px;">💾 Salvar</button>
          <button class="btn" id="btnReset" style="margin-left:8px;">♻️ Resetar</button>
        </div>
      </div>
    `);

    carregarConfiguracao();

    document.getElementById('executarAvancado').onclick = async () => {
      if (renomearAtivo) {
        UI.InfoMessage('Já está renomeando...');
        return;
      }
      renomearAtivo = true;

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
      renomearAtivo = false;
    };

    document.getElementById('btnParar').onclick = () => {
      interromper = true;
    };

    document.getElementById('btnSalvar').onclick = () => {
      salvarConfiguracao();
    };

    document.getElementById('btnReset').onclick = () => {
      resetarConfiguracao();
    };
  }

  abrirPainelAvancado();
})();
