// NOVA ORDEM DEFINITIVA:
scripts: [
    // 1. Backend (base de tudo)
    { file: 'tw-scheduler-backend.js', check: 'TWS_Backend', essential: true },
    
    // 2. Config modal (necessário para farm)
    { file: 'tw-scheduler-config-modal.js', check: 'TWS_ConfigModal', essential: false },
    
    // 3. MultiTab Lock
    { file: 'tw-scheduler-multitab-lock.js', check: 'TWS_MultiTabLock', essential: false },
    
    // 4. Todos os modais ANTES do frontend
    { file: 'tw-scheduler-modal.js', check: 'TWS_Modal', essential: false },
    { file: 'tw-scheduler-bbcode-modal.js', check: 'TWS_BBCodeModal', essential: false },
    { file: 'tw-scheduler-test-modal.js', check: 'TWS_TestModal', essential: false },
    { file: 'tw-scheduler-farm-modal.js', check: 'TWS_FarmInteligente', essential: false },
    
    // 5. Telegram bot
    { file: 'telegram-bot.js', check: 'TelegramBotReal', essential: false },
    
    // 6. Frontend POR ÚLTIMO (depois de TUDO)
    { file: 'tw-scheduler-frontend.js', check: 'TWS_Panel', essential: true }
],

delays: {
    essential: [0], // só o backend é realmente essencial
    nonEssential: [5000, 0, 10000, 15000, 20000, 25000, 30000, 35000, 0] // 9 scripts não-essenciais
}
