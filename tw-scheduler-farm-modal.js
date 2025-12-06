// Dentro da renderização de cada farm, adicione:
let tempoRestante = '';
let atrasoTexto = '';

if (nextRun) {
    const diffMs = nextRun - now;
    
    if (diffMs > 0) {
        // No futuro - mostrar tempo restante
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        
        if (diffHours > 0) {
            tempoRestante = `${diffHours}h ${remainingMins}m`;
        } else {
            tempoRestante = `${diffMins}m`;
        }
    } else {
        // No passado - mostrar atraso
        const atrasoMins = Math.floor(Math.abs(diffMs) / 60000);
        atrasoTexto = `<span style="color: #FF6B6B; font-weight: bold;">⏰ ${atrasoMins} min atrás</span>`;
    }
}

// Na UI do farm:
<div>
    <strong>Próximo envio:</strong><br>
    ${farm.nextRun || 'Calculando...'}
    ${tempoRestante ? `<br><small>⏱️ ${tempoRestante}</small>` : ''}
    ${atrasoTexto ? `<br><small>${atrasoTexto}</small>` : ''}
</div>
