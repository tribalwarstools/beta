// ========== VELOCITY-MANAGER.JS ==========
// Busca e gerencia velocidades das unidades do mundo atual
(function() {
    'use strict';
    
    if (!window.TWS_FarmInteligente) {
        window.TWS_FarmInteligente = {};
    }
    
    var VelocityManager = {
        // Cache de velocidades por mundo
        cache: {},
        CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 horas
        currentWorld: null,
        
        // Inicializar
        init: function() {
            this.currentWorld = this.detectCurrentWorld();
            console.log('[Velocity] Mundo detectado:', this.currentWorld);
            
            // Tentar carregar do cache primeiro
            if (this.loadFromCache()) {
                console.log('[Velocity] Velocidades carregadas do cache');
                this.updateFarmCore();
            } else {
                // Buscar em tempo real
                this.fetchRealSpeeds();
            }
            
            // Iniciar monitoramento periódico (1x por dia)
            setInterval(() => this.checkForUpdates(), this.CACHE_DURATION);
            
            // Monitorar mudanças de mundo
            this.monitorWorldChanges();
        },
        
        // Detectar mundo atual
        detectCurrentWorld: function() {
            try {
                // Tentar extrair do URL
                const url = window.location.href;
                const match = url.match(/https?:\/\/([^.]+)\.tribalwars/);
                if (match && match[1]) {
                    return match[1];
                }
                
                // Tentar extrair de game_data
                if (window.game_data && game_data.world) {
                    return game_data.world;
                }
                
                // Fallback
                return 'brp10';
            } catch (error) {
                console.warn('[Velocity] Não foi possível detectar o mundo:', error);
                return 'brp10';
            }
        },
        
        // Buscar velocidades em tempo real
        fetchRealSpeeds: function() {
            console.log('[Velocity] Buscando velocidades reais do mundo', this.currentWorld);
            
            const apiUrl = `https://${this.currentWorld}.tribalwars.com.br/interface.php?func=get_unit_info`;
            
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(xmlText => {
                    const speeds = this.parseXMLToSpeeds(xmlText);
                    
                    if (speeds && Object.keys(speeds).length > 0) {
                        this.saveToCache(speeds);
                        this.updateFarmCore();
                        this.notifySuccess(speeds);
                    } else {
                        throw new Error('Nenhuma velocidade extraída do XML');
                    }
                })
                .catch(error => {
                    console.error('[Velocity] Erro ao buscar velocidades:', error);
                    this.useFallbackSpeeds();
                });
        },
        
        // Parse XML para objeto de velocidades
        parseXMLToSpeeds: function(xmlText) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                
                const speeds = {};
                const unitElements = xmlDoc.querySelectorAll('config > *');
                
                unitElements.forEach(unitEl => {
                    const unitName = unitEl.tagName;
                    const speedElement = unitEl.querySelector('speed');
                    
                    if (speedElement) {
                        speeds[unitName] = parseFloat(speedElement.textContent);
                    }
                });
                
                return speeds;
            } catch (error) {
                console.error('[Velocity] Erro ao parsear XML:', error);
                return null;
            }
        },
        
        // Usar velocidades de fallback
        useFallbackSpeeds: function() {
            console.log('[Velocity] Usando velocidades padrão como fallback');
            
            const fallbackSpeeds = {
                spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
                light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
                knight: 10, snob: 35
            };
            
            this.updateFarmCore(fallbackSpeeds);
        },
        
        // Atualizar o FarmCore com novas velocidades
        updateFarmCore: function(speeds) {
            if (!speeds) {
                speeds = this.cache[this.currentWorld]?.speeds;
            }
            
            if (!speeds) {
                console.warn('[Velocity] Nenhuma velocidade disponível para atualizar');
                return;
            }
            
            // Atualizar no FarmCore
            if (window.TWS_FarmInteligente.Core) {
                // Sobrescrever o método getVelocidadesUnidades
                const originalMethod = window.TWS_FarmInteligente.Core.getVelocidadesUnidades;
                
                window.TWS_FarmInteligente.Core.getVelocidadesUnidades = function() {
                    // Primeiro tentar do VelocityManager
                    if (window.TWS_FarmInteligente.VelocityManager) {
                        const realSpeeds = window.TWS_FarmInteligente.VelocityManager.getCurrentSpeeds();
                        if (realSpeeds && Object.keys(realSpeeds).length > 0) {
                            return realSpeeds;
                        }
                    }
                    
                    // Fallback para o método original
                    return originalMethod.call(this);
                };
                
                console.log('[Velocity] FarmCore atualizado com velocidades reais');
                
                // Recalcular todos os farms
                window.TWS_FarmInteligente.Core.recarregarVelocidades();
            }
        },
        
        // Gerenciamento de cache
        saveToCache: function(speeds) {
            const cacheEntry = {
                world: this.currentWorld,
                speeds: speeds,
                timestamp: Date.now(),
                expiresAt: Date.now() + this.CACHE_DURATION
            };
            
            this.cache[this.currentWorld] = cacheEntry;
            localStorage.setItem('tws_velocity_cache', JSON.stringify(this.cache));
            
            console.log('[Velocity] Velocidades salvas em cache:', Object.keys(speeds).length, 'unidades');
        },
        
        loadFromCache: function() {
            try {
                const savedCache = localStorage.getItem('tws_velocity_cache');
                if (savedCache) {
                    this.cache = JSON.parse(savedCache);
                    
                    const worldCache = this.cache[this.currentWorld];
                    if (worldCache && worldCache.expiresAt > Date.now()) {
                        console.log('[Velocity] Cache válido encontrado para', this.currentWorld);
                        return true;
                    } else {
                        console.log('[Velocity] Cache expirado ou não encontrado');
                        return false;
                    }
                }
            } catch (error) {
                console.warn('[Velocity] Erro ao carregar cache:', error);
            }
            return false;
        },
        
        // Verificar atualizações
        checkForUpdates: function() {
            console.log('[Velocity] Verificando atualizações de velocidades...');
            
            // Limpar cache expirado
            this.cleanExpiredCache();
            
            // Buscar novas velocidades se necessário
            if (!this.cache[this.currentWorld] || this.cache[this.currentWorld].expiresAt <= Date.now()) {
                this.fetchRealSpeeds();
            }
        },
        
        // Limpar cache expirado
        cleanExpiredCache: function() {
            const now = Date.now();
            Object.keys(this.cache).forEach(world => {
                if (this.cache[world].expiresAt <= now) {
                    delete this.cache[world];
                }
            });
        },
        
        // Monitorar mudanças de mundo
        monitorWorldChanges: function() {
            let lastUrl = window.location.href;
            
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    
                    const newWorld = this.detectCurrentWorld();
                    if (newWorld !== this.currentWorld) {
                        console.log('[Velocity] Mundo alterado:', this.currentWorld, '→', newWorld);
                        this.currentWorld = newWorld;
                        
                        // Aguardar um pouco para o jogo carregar
                        setTimeout(() => {
                            if (this.loadFromCache()) {
                                this.updateFarmCore();
                            } else {
                                this.fetchRealSpeeds();
                            }
                        }, 3000);
                    }
                }
            }, 5000);
        },
        
        // Notificar sucesso
        notifySuccess: function(speeds) {
            console.log('[Velocity] ✅ Velocidades atualizadas com sucesso!');
            
            // Opcional: mostrar notificação para o usuário
            if (window.TWS_NotificationManager) {
                const unitsCount = Object.keys(speeds).length;
                window.TWS_NotificationManager.showSuccess(
                    `Velocidades Atualizadas`,
                    `${unitsCount} unidades sincronizadas do mundo ${this.currentWorld}`,
                    5000
                );
            }
            
            // Log das velocidades
            console.table(
                Object.entries(speeds)
                    .sort(([,a], [,b]) => b - a)
                    .reduce((obj, [key, val]) => {
                        obj[key] = `${val} min/campo`;
                        return obj;
                    }, {})
            );
        },
        
        // Métodos públicos
        getCurrentSpeeds: function() {
            const worldCache = this.cache[this.currentWorld];
            return worldCache ? worldCache.speeds : null;
        },
        
        getWorldInfo: function() {
            return {
                world: this.currentWorld,
                speeds: this.getCurrentSpeeds(),
                lastUpdate: this.cache[this.currentWorld]?.timestamp
            };
        },
        
        forceRefresh: function() {
            console.log('[Velocity] Forçando atualização de velocidades...');
            this.fetchRealSpeeds();
        },
        
        // Método para integração direta com FarmCore
// No velocity-manager.js, modificar getVelocidadesParaFarmCore:

getVelocidadesParaFarmCore: function() {
    const realSpeeds = this.getCurrentSpeeds();
    
    if (realSpeeds) {
        // Garantir todas as unidades necessárias
        const requiredUnits = ['spear', 'sword', 'axe', 'spy', 
                              'light', 'heavy', 'ram', 
                              'catapult', 'knight', 'snob'];
        
        const completeSpeeds = { ...realSpeeds };
        
        // Adicionar unidades faltantes com valores padrão SILENCIOSAMENTE
        requiredUnits.forEach(unit => {
            if (!completeSpeeds[unit]) {
                // SILENCIOSO - não logar toda vez
                completeSpeeds[unit] = this.getDefaultSpeed(unit);
            }
        });
        
        // Adicionar archer e marcher apenas se existirem no mundo
        // (não adicionar automaticamente)
        if (!completeSpeeds.archer && !completeSpeeds.marcher) {
            // Mundo sem arqueiros - tudo bem
        }
        
        return completeSpeeds;
    }
    
    return null;
},
        
        getDefaultSpeed: function(unit) {
            const defaults = {
                spear: 18, sword: 22, axe: 18, archer: 18, spy: 9,
                light: 10, marcher: 10, heavy: 11, ram: 30, catapult: 30,
                knight: 10, snob: 35
            };
            
            return defaults[unit] || 18;
        }
    };
    
    // Inicializar automaticamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => VelocityManager.init(), 2000);
        });
    } else {
        setTimeout(() => VelocityManager.init(), 2000);
    }
    
    // Exportar para namespace global
    window.TWS_FarmInteligente.VelocityManager = VelocityManager;
    
})();
