(async function () {
    const coordAtual = game_data.village.coord;

    const html = `
        <div style="font-family: Verdana, sans-serif; font-size: 10px; color: #000; line-height: 1.1; max-width: 260px; width: 100%;">
            <div style="margin-bottom: 6px;">
                <label for="coordAtual" style="font-weight: bold; display: block; margin-bottom: 1px;">Aldeia Atual:</label>
                <input id="coordAtual" type="text" value="${coordAtual}" style="
                    width: 100%;
                    padding: 3px 5px;
                    font-weight: bold;
                    border: 1px solid #603000;
                    background: #fff3cc;
                    color: #000;
                    box-sizing: border-box;
                    border-radius: 2px;
                    font-size: 10px;
                ">
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                <div style="flex: 1;">
                    <label for="campoValor" style="font-weight: bold; display: block; margin-bottom: 1px;">Campo:</label>
                    <input id="campoValor" type="number" value="50" min="1" style="
                        width: 100%;
                        padding: 3px 5px;
                        font-weight: bold;
                        border: 1px solid #603000;
                        background: #fff3cc;
                        color: #000;
                        box-sizing: border-box;
                        border-radius: 2px;
                        font-size: 10px;
                    ">
                </div>
                <div style="flex: 1;">
                    <label for="minPontos" style="font-weight: bold; display: block; margin-bottom: 1px;">Pontos min.:</label>
                    <input id="minPontos" type="number" value="26" min="0" style="
                        width: 100%;
                        padding: 3px 5px;
                        font-weight: bold;
                        border: 1px solid #603000;
                        background: #fff3cc;
                        color: #000;
                        box-sizing: border-box;
                        border-radius: 2px;
                        font-size: 10px;
                    ">
                </div>
                <div style="flex: 1;">
                    <label for="maxPontos" style="font-weight: bold; display: block; margin-bottom: 1px;">Pontos max.:</label>
                    <input id="maxPontos" type="number" value="12154" min="0" style="
                        width: 100%;
                        padding: 3px 5px;
                        font-weight: bold;
                        border: 1px solid #603000;
                        background: #fff3cc;
                        color: #000;
                        box-sizing: border-box;
                        border-radius: 2px;
                        font-size: 10px;
                    ">
                </div>
            </div>

            <div style="margin-bottom: 6px;">
                <button id="btnFiltro" class="btn btn-confirm-yes" style="margin-right: 6px; font-size: 10px; padding: 2px 6px;">Filtro</button>
                <button id="btnReset" class="btn btn-confirm-no" style="font-size: 10px; padding: 2px 6px;">Reset</button>
            </div>

            <div style="margin-bottom: 6px;">
                <strong>Bárbaras encontradas:</strong> <span id="contador">0</span>
            </div>

            <div>
                <strong>Coordenadas:</strong><br>
                <textarea id="coordenadas" style="width: 100%; height: 60px; font-size: 10px;" readonly></textarea>
            </div>
        </div>
    `;

    Dialog.show("tw_barbaras_filter_ultracompact", html);

    document.getElementById('btnReset').addEventListener('click', () => {
        document.getElementById('contador').textContent = '0';
        document.getElementById('coordenadas').value = '';
    });

    document.getElementById('btnFiltro').addEventListener('click', () => {
        alert('Funcionalidade de filtro ainda não implementada.');
    });
})();
