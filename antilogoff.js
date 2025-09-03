(function() {
  if (window.AntiLogoff) return; // evitar redefinir

  const INTERVALO_ACOES = 4 * 60 * 1000; // 4 minutos
  let wakeLock = null;
  let audioCtx = null;
  let oscillator = null;
  let proximaAcaoTempo = null;
  let intervaloId = null;

  async function ativarWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => console.log('🔓 Wake Lock liberado'));
        console.log('🔒 Wake Lock ativo');
      } else {
        ativarWebAudioFallback();
      }
    } catch (err) {
      console.warn('⚠️ Falha no Wake Lock, usando Web Audio fallback:', err);
      ativarWebAudioFallback();
    }
  }

  function ativarWebAudioFallback() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode).connect(audioCtx.destination);
      oscillator.start();
      console.log('🎵 Web Audio fallback ativado');
    }
  }

  function desativarWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  function iniciar() {
    if (window.antiLogoffAtivo) return;
    window.antiLogoffAtivo = true;

    ativarWakeLock();

    let contador = 0;
    const acoes = [
      () => { document.title = document.title; },
      () => { document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); },
      () => { document.body.classList.add('anti-logoff-blink'); setTimeout(() => document.body.classList.remove('anti-logoff-blink'), 100); },
      () => { fetch('/game.php').catch(() => {}); }
    ];

    proximaAcaoTempo = Date.now() + INTERVALO_ACOES;

    intervaloId = setInterval(() => {
      try {
        acoes[contador % acoes.length]();
        console.log(`💤 Anti-Logoff ativo [Ação ${contador + 1}]`);
        proximaAcaoTempo = Date.now() + INTERVALO_ACOES;
      } catch (e) { console.warn(e); }
      contador++;
    }, INTERVALO_ACOES);
  }

  function desativar() {
    clearInterval(intervaloId);
    intervaloId = null;
    window.antiLogoffAtivo = false;
    desativarWakeLock();
    proximaAcaoTempo = null;
    console.log('❌ Anti-Logoff desativado');
  }

  window.AntiLogoff = { iniciar, desativar };
})();
