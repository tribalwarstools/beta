(async function () {
    const coordAtual = game_data.village.coord;
    let villages = [];

    function calcularDistancia(coord1, coord2) {
        const [x1, y1] = coord1.split('|').map(Number);
        const [x2, y2] = coord2.split('|').map(Number);
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    async function carregarVillages() {
        const response = await fetch('/map/village.txt');
        const data = await response.text();
        return data.trim().split('\n').map((line) => {
            const [id, name, x, y, player, points] = line.split(',');
            return [id, name, parseInt(x), parseInt(y), parseInt(player), parseInt(points)];
        });
    }

    const html = `
        <div style="font-family: Verdana, sans-serif; font-size: 10px; color: #000; line-height: 1.1; max-width: 260px; width: 100%;">
            <div style="margin-bottom: 6px;">
                <label for="coordAtual" style="font-weight: bold; display: block; margin-bottom: 1px;">Aldeia Atual:</label>
                <input id="coordAtual" type="text" value="${coordAtual}" style="width: 100%; padding: 3px 5px; font-weight: bold; border: 1px solid #603000; background: #fff3cc; color: #000; box-sizing: border-box; border-radius: 2px; font-size: 10px;">
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                <div style="flex: 1;">
                    <label for="campoValor" style="font-weight: bold; display: block; margin-bottom: 1px;">Campo:</label>
                    <input id="campoValor" type="number" value="50" min="1" style="width: 100%; padding: 3px 5px; font-weight: bold; border: 1px solid #603000; background: #fff3cc; color: #000; box-sizing: border-box; border-radius: 2px; font-size: 10px;">
                </div>
                <div style="flex: 1;">
                    <label for="minPontos" style="font-weight: bold; display: block; margin-bottom: 1px;">Pontos min.:</label>
                    <input id="minPontos" type="number" value="26" min="0" style="width: 100%; padding: 3px 5px; font-weight: bold; border: 1px solid #603000; background: #fff3cc; color: #000; box-sizing: border-box; border-radius: 2px; font-size: 10px;">
                </div>
                <div style="flex: 1;">
                    <label for="maxPontos" style="font-weight: bold; display: block; margin-bottom: 1px;">Pontos max.:</label>
                    <input id="maxPontos" type="number" value="12154" min="0" style="width: 100%; padding: 3px 5px; font-weight: bold; border: 1px solid #603000; background: #fff3cc; color: #000; box-sizing: border-box; border-radius: 2px; font-size: 10px;">
                </div>
            </div>

            <div style="margin-bottom: 6px;">
                <button id="btnFiltro" class="btn btn-confirm-yes" style="margin-right: 6px; font-size: 10px; padding: 2px 6px;">Filtro</button>
                <button id="btnReset" class="btn btn-confirm-no" style="margin-right: 6px; font-size: 10px; padding: 2px 6px;">Reset</button>
                <button id="btnCopiar" class="btn" style="font-size: 10px; padding: 2px 6px;">Copiar</button>
            </div>

            <div style="margin-bottom: 6px;">
                <strong>Bárbaras encontradas:</strong> <span id="contador">0</span>
            </div>

            <div>
                <strong>Coordenadas:</strong><br>
                <textarea id="coordenadas" style="width: 95%; height: 60px; font-size: 10px;" readonly></textarea>
            </div>
        </div>
    `;

    Dialog.show("tw_barbaras_filter_ultracompact", html);

    document.getElementById('btnReset').addEventListener('click', () => {
        document.getElementById('coordAtual').value = game_data.village.coord;
        document.getElementById('campoValor').value = 50;
        document.getElementById('minPontos').value = 26;
        document.getElementById('maxPontos').value = 12154;
        document.getElementById('contador').textContent = '0';
        document.getElementById('coordenadas').value = '';
    });

    document.getElementById('btnFiltro').addEventListener('click', async () => {
        if (!villages.length) villages = await carregarVillages();

        const coordAtual = document.getElementById('coordAtual').value.trim();
        const raio = parseInt(document.getElementById('campoValor').value);
        const minPontos = parseInt(document.getElementById('minPontos').value);
        const maxPontos = parseInt(document.getElementById('maxPontos').value);

        const barbaras = villages.filter(([id, name, x, y, player, points]) => {
            return player === 0 && points >= minPontos && points <= maxPontos;
        });

        const resultado = barbaras.filter(([id, name, x, y]) => {
            const coord = `${x}|${y}`;
            return calcularDistancia(coordAtual, coord) <= raio;
        });

        const coords = resultado.map(([id, name, x, y]) => `${x}|${y}`);

        document.getElementById('contador').textContent = coords.length;
        document.getElementById('coordenadas').value = coords.join(' ');
    });

    document.getElementById('btnCopiar').addEventListener('click', () => {
        const texto = document.getElementById('coordenadas').value;
        if (!texto.trim()) {
            UI.ErrorMessage('Nada para copiar!');
            return;
        }

        navigator.clipboard.writeText(texto)
            .then(() => UI.InfoMessage('Coordenadas copiadas!'))
            .catch(() => UI.ErrorMessage('Erro ao copiar as coordenadas!'));
    });
})();
