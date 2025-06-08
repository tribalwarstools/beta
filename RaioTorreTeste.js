// Dados de alcance por nível da torre
let dadosTorres = [];
const alcancesTorres = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15, 15, 15, 15, 15, 15, 15, 15, 30];

let entradasAtivas = 0;
const maxEntradas = 99;

// Estilo CSS personalizado
const estiloPersonalizado = `
<style>
.linhaImpar {
    background-color: #c1a264;
    color: #eceff4;
}
.linhaPar {
    background-color: #f0e2be;
    color: #eceff4;
}
.cabecalhoTorre {
    background-color: #7d510f;
    font-weight: bold;
    color: #ffffff;
}
.btn, .btn-default {
    display: inline-block;
    padding: 3px;
    margin: 0 2px;
    text-align: center;
    font-family: Verdana, Arial;
    font-size: 12px !important;
    font-weight: bold;
    line-height: normal;
    cursor: pointer;
    background: #6c4824;
    background: linear-gradient(to bottom, #947a62 0%, #7b5c3d 22%, #6c4824 30%, #6c4824 100%);
    -webkit-border-radius: 5px;
    border-radius: 5px;
    border: 1px solid #000;
    color: #fff;
    white-space: nowrap;
}
</style>`;

$("#contentContainer").eq(0).prepend(estiloPersonalizado);
$("#mobileHeader").eq(0).prepend(estiloPersonalizado);

// Estrutura HTML principal
const painelHTML = `
<div>
    <form id="formEntradaTorre">
        <table class="cabecalhoTorre">
            <tr class="cabecalhoTorre">
                <td>Coordenada</td>
                <td>Nível</td>
                <td>Comando</td>
            </tr>
            <tr id="botaoAdicionarLinha" class="linhaImpar">
                <td colspan="3" align="center">
                    <button type="button" id="botaoAdicionar" class="btn btn-default">Adicionar Torre</button>
                </td>
            </tr>
            <tr id="botoesAcoes" class="linhaPar">
                <td colspan="3" align="right">
                    <button type="button" class="btn btn-default" onclick="salvarDadosTorres()">Salvar</button>
                    <button type="button" class="btn btn-default" onclick="mostrarAlcance()">Mostrar</button>
                </td>
            </tr>
            <tr class="cabecalhoTorre">
                <td colspan="3">
                    <textarea id="coordenadasMultiplas" cols="30" rows="10" placeholder="Cole as coordenadas aqui"></textarea>
                </td>
            </tr>
            <tr>
                <td colspan="3" align="right">
                    <button type="button" class="btn btn-default" onclick="importarCoordenadas()">Importar</button>
                </td>
            </tr>
        </table>
    </form>
</div>`;

// Adiciona a interface na página
$("#contentContainer tr").eq(0).prepend("<td style='display: inline-block;vertical-align: top;'>" + painelHTML + "</td>");

// Eventos
$("#botaoAdicionar").click(() => adicionarLinhaTorre("", 0));

$('table.cabecalhoTorre').on('click', '.removerTorre', function () {
    $(this).closest('tr').remove();
    entradasAtivas--;
    if (entradasAtivas < maxEntradas) {
        $("#botaoAdicionarLinha").show();
    }
});

// Carregar do localStorage
if (localStorage.getItem("dadosVisualTorre") == null) {
    dadosTorres = [];
    localStorage.setItem("dadosVisualTorre", JSON.stringify(dadosTorres));
} else {
    dadosTorres = JSON.parse(localStorage.getItem("dadosVisualTorre"));
    dadosTorres.forEach(entrada => adicionarLinhaTorre(entrada.coord, entrada.level));
}

function adicionarLinhaTorre(coord, nivel) {
    if (entradasAtivas < maxEntradas) {
        entradasAtivas++;
        const classeLinha = entradasAtivas % 2 === 0 ? "linhaPar" : "linhaImpar";
        $(`<tr class="${classeLinha}">
            <td><center><input type="text" name="coord" size="7" placeholder="xxx|yyy" value="${coord}"/></center></td>
            <td><center><input type="text" name="level" size="5" placeholder="Nível" value="${nivel}"/></center></td>
            <td><center><button type="button" class="btn btn-default removerTorre"> Excluir </button></center></td>
        </tr>`).insertBefore($("#botaoAdicionarLinha"));

        if (entradasAtivas >= maxEntradas) {
            $("#botaoAdicionarLinha").hide();
        }
    }
}

function salvarDadosTorres() {
    dadosTorres = [];
    const entradas = $("#formEntradaTorre :input").serializeArray();
    for (let i = 0; i < entradas.length; i += 2) {
        dadosTorres.push({ coord: entradas[i].value, level: parseInt(entradas[i + 1].value) });
    }
    localStorage.setItem("dadosVisualTorre", JSON.stringify(dadosTorres));
}

function importarCoordenadas() {
    let coords = $("#coordenadasMultiplas").val().replace(/[\s\n]+/g, ",").split(",");
    coords.forEach(c => adicionarLinhaTorre(c, 0));
}

function mostrarAlcance() {
    const mapa = TWMap;
    const entradas = $("#formEntradaTorre :input").serializeArray();
    dadosTorres = [];
    for (let i = 0; i < entradas.length; i += 2) {
        dadosTorres.push({ coord: entradas[i].value, level: parseInt(entradas[i + 1].value) });
    }

    function desenharMapaPrincipal(canvas, setor) {
        const ctx = canvas.getContext("2d");
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        dadosTorres.forEach(({ coord, level }) => {
            if (level > 0) {
                const [x, y] = coord.split('|').map(Number);
                const centro = mapa.map.pixelByCoord(x, y);
                const posSetor = mapa.map.pixelByCoord(setor.x, setor.y);
                const px = (centro[0] - posSetor[0]) + mapa.tileSize[0] / 2;
                const py = (centro[1] - posSetor[1]) + mapa.tileSize[1] / 2;
                const raio = alcancesTorres[level - 1] * mapa.map.scale[0];

                ctx.beginPath();
                ctx.strokeStyle = '#ff0000';
                ctx.ellipse(px, py, raio, raio, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fill();
                ctx.closePath();

                ctx.beginPath();
                ctx.strokeStyle = '#FFFFFF';
                ctx.moveTo(px - 6, py - 6);
                ctx.lineTo(px + 6, py + 6);
                ctx.moveTo(px + 6, py - 6);
                ctx.lineTo(px - 6, py + 6);
                ctx.stroke();
                ctx.closePath();
            }
        });
    }

    function desenharMiniMapa(canvas, setor) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dadosTorres.forEach(({ coord, level }) => {
            if (level > 0) {
                const [x, y] = coord.split('|').map(Number);
                const px = (x - setor.x) * 5 + 3;
                const py = (y - setor.y) * 5 + 3;
                const raio = alcancesTorres[level - 1] * 5;

                ctx.beginPath();
                ctx.strokeStyle = '#ff0000';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.arc(px, py, raio, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fill();
                ctx.closePath();

                ctx.beginPath();
                ctx.strokeStyle = '#FFFFFF';
                ctx.moveTo(px - 2, py - 2);
                ctx.lineTo(px + 2, py + 2);
                ctx.moveTo(px + 2, py - 2);
                ctx.lineTo(px - 2, py + 2);
                ctx.stroke();
                ctx.closePath();
            }
        });
    }

    if (!mapa.mapHandler._originalSpawn) {
        mapa.mapHandler._originalSpawn = mapa.mapHandler.spawnSector;
    }

    mapa.mapHandler.spawnSector = function (dados, setor) {
        mapa.mapHandler._originalSpawn(dados, setor);

        const idCanvas = `mapOverlay_canvas_${setor.x}_${setor.y}`;
        if (!document.getElementById(idCanvas)) {
            const canvas = document.createElement('canvas');
            canvas.className = 'mapOverlay_map_canvas';
            canvas.id = idCanvas;
            canvas.style.position = 'absolute';
            canvas.style.zIndex = 10;
            canvas.width = mapa.map.scale[0] * mapa.map.sectorSize;
            canvas.height = mapa.map.scale[1] * mapa.map.sectorSize;
            setor.appendElement(canvas, 0, 0);
            desenharMapaPrincipal(canvas, setor);
        }

        for (const chave in mapa.minimap._loadedSectors) {
            const setorMini = mapa.minimap._loadedSectors[chave];
            const idMiniCanvas = `mapOverlay_topo_canvas_${chave}`;
            if (!document.getElementById(idMiniCanvas)) {
                const miniCanvas = document.createElement('canvas');
                miniCanvas.className = 'mapOverlay_topo_canvas';
                miniCanvas.id = idMiniCanvas;
                miniCanvas.style.position = 'absolute';
                miniCanvas.style.zIndex = 11;
                miniCanvas.width = 250;
                miniCanvas.height = 250;
                desenharMiniMapa(miniCanvas, setorMini);
                setorMini.appendElement(miniCanvas, 0, 0);
            }
        }
    };

    mapa.reload();
}
