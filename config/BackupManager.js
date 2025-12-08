//BackupManager.js
(function () {
    'use strict';

    if (!window.TWS_ConfigManager) {
        console.warn('[BackupManager] ConfigManager não carregado!');
        return;
    }

    const BACKUP_STORAGE_KEY = 'tws_backup_';

    const BackupManager = {
        createBackup: function() {
            try {
                if (!window.TWS_Backend) {
                    throw new Error('Backend não disponível');
                }

                const list = window.TWS_Backend.getList();
                const config = window.TWS_ConfigManager.getCurrentConfig();
                const timestamp = new Date().toISOString();
                
                const backup = {
                    id: `backup_${Date.now()}`,
                    timestamp,
                    count: list.length,
                    data: list,
                    config: config
                };
                
                const key = `${BACKUP_STORAGE_KEY}${Date.now()}`;
                localStorage.setItem(key, JSON.stringify(backup));
                
                // Manter apenas os últimos N backups
                this.cleanupOldBackups(config.backup.maxBackups);
                
                return { success: true, backup };
            } catch (e) {
                console.error('[BackupManager] Erro ao criar backup:', e);
                return { success: false, error: e.message };
            }
        },

        listBackups: function() {
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(BACKUP_STORAGE_KEY)) {
                    try {
                        const backup = JSON.parse(localStorage.getItem(key));
                        backups.push({
                            key,
                            timestamp: backup.timestamp,
                            count: backup.count,
                            id: backup.id
                        });
                    } catch (e) {
                        console.warn('[BackupManager] Backup corrompido:', key);
                    }
                }
            }
            return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        },

        restoreBackup: function(backupKey) {
            try {
                const backup = JSON.parse(localStorage.getItem(backupKey));
                if (!backup || !backup.data || !Array.isArray(backup.data)) {
                    throw new Error('Backup inválido ou corrompido');
                }
                
                // Restaurar agendamentos
                window.TWS_Backend.setList(backup.data);
                
                // Restaurar configuração se disponível
                if (backup.config) {
                    window.TWS_ConfigManager.saveConfig(backup.config);
                }
                
                return { success: true, count: backup.data.length };
            } catch (e) {
                console.error('[BackupManager] Erro ao restaurar backup:', e);
                return { success: false, error: e.message };
            }
        },

        deleteBackup: function(backupKey) {
            localStorage.removeItem(backupKey);
            return true;
        },

        cleanupOldBackups: function(maxToKeep = 10) {
            const backups = this.listBackups();
            if (backups.length > maxToKeep) {
                const toDelete = backups.slice(maxToKeep);
                toDelete.forEach(backup => {
                    localStorage.removeItem(backup.key);
                });
                console.log(`[BackupManager] ${toDelete.length} backups antigos removidos`);
            }
        }
    };

    // Exportar globalmente
    window.TWS_BackupManager = BackupManager;
    console.log('[BackupManager] ✅ Carregado!');

})();
