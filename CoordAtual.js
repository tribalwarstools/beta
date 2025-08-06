// ==UserScript==
// @name         Copia Coordenadas
// @namespace    https://github.com/tribalwarstools/twscripts
// @version      1.0
// @description  Copia Coordenadas da Aldeia Atual
// @author       tribalwarstools
// @match        https://*.tribalwars.com.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/tribalwarstools/twscripts/main/CoordAtual.js
// @downloadURL  https://raw.githubusercontent.com/tribalwarstools/twscripts/main/CoordAtual.js
// ==/UserScript==


(function () {
    'use strict';

    const panelId = 'twSDK-panel';
    if (document.getElementById(panelId)) return;

    const village = game_data.village;
    const STORAGE_KEY = 'tw_favoritos';

    const loadFavoritos = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const saveFavoritos = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.style = `
        position: fixed;
        top: 120px;
        right: 40px;
        width: 320px;
        background: #f4e4bc;
        border: 2px solid #804000;
        border-radius: 10px;
        box-shadow: 2px 2px 6px rgba(0,0,0,0.5);
        padding: 10px;
        z-index: 9999;
        font-family: Verdana, sans-serif;
        cursor: move;
    `;

    panel.innerHTML = `
        <div id="drag-header" style="font-weight: bold; font-size: 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>🏰 ${village.name}</span>
            <button id="btn-close" style="background: transparent; border: none; font-size: 16px; cursor: pointer;">✖</button>
        </div>
        <div style="margin-bottom: 10px;">
            <b>Coordenadas:</b> <span id="village-coord">${village.coord}</span><br>
            <b>Pontos:</b> ${village.points.toLocaleString()}
        </div>
        <button id="btn-copy" class="btn btn-confirm" style="margin-right: 5px;">Copiar Coordenada</button>
        <button id="btn-favoritar" class="btn btn-confirm">⭐ Favoritar</button>
        <div id="favoritos-list" style="margin-top: 15px;"></div>
    `;

    document.body.appendChild(panel);

    // Botões principais
    document.getElementById('btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(village.coord).then(() => {
            UI.SuccessMessage(`Coordenada ${village.coord} copiada!`);
        }).catch(() => {
            UI.ErrorMessage('Erro ao copiar coordenada.');
        });
    });

    document.getElementById('btn-favoritar').addEventListener('click', () => {
        const favoritos = loadFavoritos();
        if (favoritos.find(v => v.coord === village.coord)) {
            UI.InfoMessage('Essa aldeia já está nos favoritos.');
            return;
        }
        favoritos.push({ name: village.name, coord: village.coord });
        saveFavoritos(favoritos);
        UI.SuccessMessage('Aldeia favoritada!');
        renderFavoritos();
    });

    document.getElementById('btn-close').addEventListener('click', () => {
        panel.remove();
    });

    window.removeFavorito = function (index) {
        const favoritos = loadFavoritos();
        favoritos.splice(index, 1);
        saveFavoritos(favoritos);
        UI.SuccessMessage('Aldeia removida dos favoritos.');
        renderFavoritos();
    };

    window.renameFavorito = function (index) {
        const favoritos = loadFavoritos();
        const atual = favoritos[index];
        const novoNome = prompt("Renomear aldeia:", atual.name);
        if (novoNome && novoNome.trim() !== "") {
            favoritos[index].name = novoNome.trim();
            saveFavoritos(favoritos);
            UI.SuccessMessage("Aldeia renomeada!");
            renderFavoritos();
        }
    };

    function renderFavoritos() {
        const container = document.getElementById('favoritos-list');
        const favoritos = loadFavoritos();

        if (favoritos.length === 0) {
            container.innerHTML = '<i>Nenhuma aldeia favoritada ainda.</i>';
            return;
        }

        container.innerHTML = '<b>⭐ Favoritos:</b><br>';
        favoritos.forEach((v, index) => {
            const linha = document.createElement('div');
            linha.style.display = 'flex';
            linha.style.alignItems = 'center';
            linha.style.justifyContent = 'space-between';
            linha.style.margin = '4px 0';
            linha.style.gap = '4px';

            const nome = document.createElement('span');
            nome.title = v.name;
            nome.style.flex = '1';
            nome.style.whiteSpace = 'nowrap';
            nome.style.overflow = 'hidden';
            nome.style.textOverflow = 'ellipsis';
            nome.innerText = `${v.name} (${v.coord})`;

            const copiar = document.createElement('button');
            copiar.className = 'btn btn-confirm';
            copiar.style.padding = '2px 6px';
            copiar.innerText = '📋';
            copiar.title = 'Copiar coordenada';
            copiar.addEventListener('click', () => {
                navigator.clipboard.writeText(v.coord);
                UI.SuccessMessage(`Copiado: ${v.coord}`);
            });

            const renomear = document.createElement('button');
            renomear.className = 'btn';
            renomear.style.padding = '2px 6px';
            renomear.innerText = '✏️';
            renomear.title = 'Renomear favorito';
            renomear.addEventListener('click', () => {
                window.renameFavorito(index);
            });

            const remover = document.createElement('button');
            remover.className = 'btn btn-remov';
            remover.style.padding = '2px 6px';
            remover.innerText = '✖';
            remover.title = 'Remover aldeia dos favoritos';
            remover.addEventListener('click', () => {
                window.removeFavorito(index);
            });

            linha.appendChild(nome);
            linha.appendChild(copiar);
            linha.appendChild(renomear);
            linha.appendChild(remover);
            container.appendChild(linha);
        });
    }

    renderFavoritos();

    // Tornar o painel arrastável
    const header = document.getElementById('drag-header');
    let isDragging = false, offsetX = 0, offsetY = 0;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', function (e) {
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
        }, { once: true });
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        panel.style.left = `${e.clientX - offsetX}px`;
        panel.style.top = `${e.clientY - offsetY}px`;
        panel.style.right = 'auto';
    }
})();

