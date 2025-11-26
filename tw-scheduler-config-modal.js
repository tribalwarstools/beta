import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

// TWSConfigModal.jsx
// Default export: React component TWSConfigModal
// Usage (example):
// import TWSConfigModal from './TWSConfigModal';
// <TWSConfigModal ref={modalRef} />
// modalRef.current.open()

const CONFIG_STORAGE_KEY = 'tws_global_config_v2';

const defaultConfig = {
  velocidadesUnidades: {
    spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
    light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
    knight: 10, snob: 35
  },
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    notifications: {
      success: true,
      failure: true,
      farmCycle: false,
      error: true
    }
  },
  theme: 'light',
  behavior: {
    autoStartScheduler: true,
    showNotifications: true,
    soundOnComplete: false,
    retryOnFail: true,
    maxRetries: 3,
    delayBetweenAttacks: 1000
  },
  security: {
    confirmDeletion: true,
    confirmMassActions: true,
    askBeforeSend: false,
    backupInterval: 86400000
  }
};

function safeParseJSON(s, fallback) {
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

function getConfigFromStorage() {
  const raw = localStorage.getItem(CONFIG_STORAGE_KEY) || '{}';
  const parsed = safeParseJSON(raw, {});
  return { ...defaultConfig, ...parsed, velocidadesUnidades: { ...defaultConfig.velocidadesUnidades, ...(parsed.velocidadesUnidades || {}) }, telegram: { ...defaultConfig.telegram, ...(parsed.telegram || {}) }, behavior: { ...defaultConfig.behavior, ...(parsed.behavior || {}) } };
}

function saveConfigToStorage(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('[TWS Config] Erro ao salvar:', e);
    return false;
  }
}

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-tws-theme', isDark ? 'dark' : 'light');
}

function applyVelocidadesGlobais(vels) {
  if (window.TWS_Backend && window.TWS_Backend._internal) {
    window.TWS_Backend._internal.velocidadesUnidades = { ...vels };
  }
}

function calcularDistancia(coord1, coord2) {
  const [x1, y1] = coord1.split('|').map(Number);
  const [x2, y2] = coord2.split('|').map(Number);
  const deltaX = Math.abs(x1 - x2);
  const deltaY = Math.abs(y1 - y2);
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// Utility to download a blob as file
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TWSConfigModal = forwardRef(function TWSConfigModal(_, ref) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(getConfigFromStorage());
  const [activeTab, setActiveTab] = useState('unidades');
  const [unsaved, setUnsaved] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef();

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    getConfig: () => ({ ...config }),
    save: () => handleSave(),
  }));

  useEffect(() => {
    // Apply on mount
    applyTheme(config.theme);
    applyVelocidadesGlobais(config.velocidadesUnidades);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && modalRef.current) {
      // trap focus could be implemented here
    }
  }, [open]);

  function openModal() {
    setOpen(true);
  }

  function closeModal(force = false) {
    if (!force && unsaved) {
      const should = window.confirm('Existem mudanças não salvas. Deseja fechar sem salvar?');
      if (!should) return;
    }
    setOpen(false);
    setUnsaved(false);
  }

  function handleFieldChange(path, value) {
    setConfig(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]] = cur[parts[i]] || {};
      }
      cur[parts[parts.length - 1]] = value;
      return copy;
    });
    setUnsaved(true);
  }

  function handleUnitSpeedChange(unit, rawValue) {
    const value = parseFloat(String(rawValue).replace(',', '.')) || 0.1;
    setConfig(prev => ({ ...prev, velocidadesUnidades: { ...prev.velocidadesUnidades, [unit]: Math.max(0.1, value) } }));
    setUnsaved(true);
  }

  function handleSave() {
    const ok = saveConfigToStorage(config);
    if (ok) {
      applyTheme(config.theme);
      applyVelocidadesGlobais(config.velocidadesUnidades);
      setUnsaved(false);
      window.alert('✅ Configurações salvas com sucesso!');
    } else {
      window.alert('❌ Erro ao salvar configurações. Verifique o console.');
    }
  }

  function handleSaveAndClose() {
    handleSave();
    closeModal(true);
  }

  function handleResetToDefaults() {
    const ok = window.confirm('⚠️ TEM CERTEZA? Isso resetará TODAS as configurações para os valores padrão.');
    if (!ok) return;
    setConfig(JSON.parse(JSON.stringify(defaultConfig)));
    setUnsaved(true);
  }

  function exportConfig() {
    downloadJSON(config, `tws_config_${Date.now()}.json`);
  }

  function onImportClick() {
    fileInputRef.current?.click();
  }

  function onFileSelected(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        const merged = { ...defaultConfig, ...parsed, velocidadesUnidades: { ...defaultConfig.velocidadesUnidades, ...(parsed.velocidadesUnidades || {}) } };
        setConfig(merged);
        setUnsaved(true);
        window.alert('✅ Arquivo importado (é necessário salvar para aplicar).');
      } catch (err) {
        window.alert('❌ Arquivo inválido.');
      }
    };
    reader.readAsText(f);
    // clear
    e.target.value = '';
  }

  function backupData() {
    // Cria um backup básico com info do frontend + listas se existirem
    const payload = {
      timestamp: Date.now(),
      config,
      schedulerList: window.TWS_Backend?.getList ? window.TWS_Backend.getList() : [],
      farmList: window.TWS_FarmInteligente?._getFarmList ? window.TWS_FarmInteligente._getFarmList() : []
    };
    downloadJSON(payload, `tws_backup_${Date.now()}.json`);
    window.alert('✅ Backup gerado.');
  }

  function testTelegram() {
    // Placeholder: in a production environment this would call a backend proxy (não direto do browser)
    window.alert('🧪 Teste do Telegram: Implemente um endpoint servidor para evitar expor o token no cliente.');
  }

  function handleTestUnitSpeed() {
    const origem = window.prompt('Coordenada de origem (ex: 500|500):', '500|500');
    const destino = window.prompt('Coordenada de destino (ex: 501|501):', '501|501');
    if (!origem || !destino) return;
    const distancia = calcularDistancia(origem, destino);
    // pega a unidade mais lenta atualmente configurada
    let slowestUnit = null;
    let slowestVal = -Infinity;
    Object.entries(config.velocidadesUnidades).forEach(([u, v]) => {
      const val = parseFloat(v) || 0;
      if (val > slowestVal) { slowestVal = val; slowestUnit = u; }
    });
    const tempo = distancia * (parseFloat(slowestVal) || 0);
    window.alert(`🧪 TESTE DE CÁLCULO:\n\n📍 ${origem} → ${destino}\n📏 Distância: ${distancia.toFixed(2)} campos\n🐌 Unidade mais lenta: ${slowestUnit} (${slowestVal} min/campo)\n⏱️ Tempo: ${tempo.toFixed(1)} min`);
  }

  function calculateStatsSize() {
    const sizeKB = Math.round(JSON.stringify(config).length / 1024 * 100) / 100;
    return sizeKB;
  }

  // Render
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div ref={modalRef} className="w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-indigo-500 to-purple-700 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-700/80 p-4 text-center border-b border-indigo-400 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">⚙️ CONFIGURAÇÕES GLOBAIS</div>
            <div className="text-sm text-gray-200">Ajuste velocidades, Telegram, aparência e comportamento do sistema</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => closeModal(false)} className="px-3 py-1 rounded bg-gray-600 text-white hover:opacity-90">Fechar</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-600">
          <button onClick={() => setActiveTab('unidades')} className={`flex-1 p-3 text-white font-semibold ${activeTab === 'unidades' ? 'bg-indigo-500' : ''}`}>🎯 Unidades</button>
          <button onClick={() => setActiveTab('telegram')} className={`flex-1 p-3 text-white font-semibold ${activeTab === 'telegram' ? 'bg-indigo-500' : ''}`}>🤖 Telegram</button>
          <button onClick={() => setActiveTab('aparencia')} className={`flex-1 p-3 text-white font-semibold ${activeTab === 'aparencia' ? 'bg-indigo-500' : ''}`}>🎨 Aparência</button>
          <button onClick={() => setActiveTab('comportamento')} className={`flex-1 p-3 text-white font-semibold ${activeTab === 'comportamento' ? 'bg-indigo-500' : ''}`}>⚡ Comportamento</button>
          <button onClick={() => setActiveTab('backup')} className={`flex-1 p-3 text-white font-semibold ${activeTab === 'backup' ? 'bg-indigo-500' : ''}`}>💾 Backup</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-800">

          {/* UNIDADES */}
          {activeTab === 'unidades' && (
            <div className="space-y-4">
              <div className="bg-white rounded p-4 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800">🎯 Velocidades das Unidades</h3>
                <p className="text-sm text-gray-500">Ajuste as velocidades conforme as configurações do seu mundo. Valores em minutos por campo.</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(config.velocidadesUnidades).map(([unit, speed]) => (
                    <div key={unit} className="flex items-center gap-3 bg-white p-2 rounded border">
                      <div className="w-28 font-medium text-gray-700">{unit}</div>
                      <input type="number" step="0.1" min="0.1" max="999" value={String(speed)} onChange={(e) => handleUnitSpeedChange(unit, e.target.value)} className="w-24 p-1 border rounded" />
                      <div className="text-sm text-gray-500">min/campo</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setConfig(prev => ({ ...prev, velocidadesUnidades: { ...defaultConfig.velocidadesUnidades } })); setUnsaved(true); }} className="px-3 py-1 rounded bg-gray-600 text-white">🔄 Resetar Velocidades</button>
                  <button onClick={handleTestUnitSpeed} className="px-3 py-1 rounded bg-green-500 text-white">🧪 Testar Cálculo</button>
                </div>
              </div>
            </div>
          )}

          {/* TELEGRAM */}
          {activeTab === 'telegram' && (
            <div className="bg-white rounded p-4 shadow-sm space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">🤖 Configurações do Telegram</h3>
              <label className="flex items-center gap-2"><input type="checkbox" checked={config.telegram.enabled} onChange={(e) => handleFieldChange('telegram.enabled', e.target.checked)} /> Ativar notificações do Telegram</label>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-medium text-sm">Bot Token</label>
                  <input type="password" value={config.telegram.botToken} onChange={(e) => handleFieldChange('telegram.botToken', e.target.value)} className="w-full p-2 border rounded" placeholder="123456789:ABCdef..." />
                </div>
                <div>
                  <label className="block font-medium text-sm">Chat ID</label>
                  <input value={config.telegram.chatId} onChange={(e) => handleFieldChange('telegram.chatId', e.target.value)} className="w-full p-2 border rounded" placeholder="-100123456789" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label><input type="checkbox" checked={config.telegram.notifications.success} onChange={(e)=>handleFieldChange('telegram.notifications.success', e.target.checked)} /> ✅ Ataques bem-sucedidos</label>
                  <label><input type="checkbox" checked={config.telegram.notifications.failure} onChange={(e)=>handleFieldChange('telegram.notifications.failure', e.target.checked)} /> ❌ Ataques falhos</label>
                  <label><input type="checkbox" checked={config.telegram.notifications.farmCycle} onChange={(e)=>handleFieldChange('telegram.notifications.farmCycle', e.target.checked)} /> 🔄 Ciclos de Farm</label>
                  <label><input type="checkbox" checked={config.telegram.notifications.error} onChange={(e)=>handleFieldChange('telegram.notifications.error', e.target.checked)} /> 🚨 Erros do sistema</label>
                </div>

                <div>
                  <button onClick={testTelegram} className="px-3 py-1 rounded bg-indigo-500 text-white">🧪 Testar Conexão Telegram</button>
                </div>
              </div>
            </div>
          )}

          {/* APARÊNCIA */}
          {activeTab === 'aparencia' && (
            <div className="bg-white rounded p-4 shadow-sm space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">🎨 Aparência e Tema</h3>
              <label className="block font-medium text-sm">Tema</label>
              <select value={config.theme} onChange={(e)=>handleFieldChange('theme', e.target.value)} className="p-2 border rounded w-48">
                <option value="light">🌞 Claro</option>
                <option value="dark">🌙 Escuro</option>
                <option value="auto">⚡ Automático (Sistema)</option>
              </select>

              <div className="grid grid-cols-1 gap-2 mt-2">
                <label><input type="checkbox" checked={config.behavior.showNotifications} onChange={(e)=>handleFieldChange('behavior.showNotifications', e.target.checked)} /> Mostrar notificações na tela</label>
                <label><input type="checkbox" checked={config.behavior.soundOnComplete} onChange={(e)=>handleFieldChange('behavior.soundOnComplete', e.target.checked)} /> Som quando ataques são concluídos</label>
              </div>
            </div>
          )}

          {/* COMPORTAMENTO */}
          {activeTab === 'comportamento' && (
            <div className="bg-white rounded p-4 shadow-sm space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">⚡ Comportamento do Sistema</h3>

              <label><input type="checkbox" checked={config.behavior.autoStartScheduler} onChange={(e)=>handleFieldChange('behavior.autoStartScheduler', e.target.checked)} /> Iniciar scheduler automaticamente</label>
              <label><input type="checkbox" checked={config.behavior.retryOnFail} onChange={(e)=>handleFieldChange('behavior.retryOnFail', e.target.checked)} /> Tentar novamente em caso de falha</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block font-medium text-sm">Máximo de tentativas</label>
                  <input type="number" min="1" max="99" value={config.behavior.maxRetries} onChange={(e)=>handleFieldChange('behavior.maxRetries', parseInt(e.target.value) || 1)} className="p-2 border rounded w-32" />
                </div>
                <div>
                  <label className="block font-medium text-sm">Delay entre ataques (ms)</label>
                  <input type="number" min="0" max="60000" value={config.behavior.delayBetweenAttacks} onChange={(e)=>handleFieldChange('behavior.delayBetweenAttacks', parseInt(e.target.value) || 0)} className="p-2 border rounded w-40" />
                </div>
              </div>
            </div>
          )}

          {/* BACKUP */}
          {activeTab === 'backup' && (
            <div className="bg-white rounded p-4 shadow-sm space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">💾 Backup e Restauração</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={exportConfig} className="px-3 py-2 rounded bg-green-600 text-white">📤 Exportar Configurações</button>
                <button onClick={onImportClick} className="px-3 py-2 rounded bg-blue-600 text-white">📥 Importar Configurações</button>
                <button onClick={backupData} className="px-3 py-2 rounded bg-yellow-500 text-white">💾 Backup Completo</button>
                <button onClick={handleResetToDefaults} className="px-3 py-2 rounded bg-red-500 text-white">🗑️ Resetar Tudo</button>
              </div>

              <div className="bg-gray-100 p-3 rounded mt-3">
                <h4 className="font-semibold">📊 Estatísticas do Sistema</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 mt-2">
                  <div>Agendamentos: <span>{window.TWS_Backend?.getList ? window.TWS_Backend.getList().length : 0}</span></div>
                  <div>Farms: <span>{window.TWS_FarmInteligente?._getFarmList ? window.TWS_FarmInteligente._getFarmList().length : 0}</span></div>
                  <div>Configurações: <span>{calculateStatsSize()}</span> KB</div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-3 flex items-center justify-between border-t">
          <div>
            <button onClick={() => closeModal(false)} className="px-3 py-1 rounded bg-gray-400">❌ Cancelar</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600 mr-4">{unsaved ? '⚠️ Alterações não salvas' : 'Salvo'}</div>
            <button onClick={handleSave} className="px-3 py-1 rounded bg-yellow-500 text-white">💾 Salvar</button>
            <button onClick={handleSaveAndClose} className="px-3 py-1 rounded bg-green-600 text-white">✅ Salvar e Fechar</button>
          </div>
        </div>

      </div>

      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept="application/json" onChange={onFileSelected} className="hidden" />
    </div>
  );
});

export default TWSConfigModal;
