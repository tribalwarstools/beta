(function() {
    'use strict';
    
    if (!window.TWS_Backend) {
        console.error('[TWS Validations] Backend não disponível');
        return;
    }
    
    const { getList, parseDateTimeToMs, generateUniqueId } = window.TWS_Backend;
    
    // ═══════════════════════════════════════════════════════
    // 📋 VALIDAÇÕES CENTRALIZADAS
    // ═══════════════════════════════════════════════════════
    
    const Validations = {
        
        // ✅ VALIDAÇÃO DE ATAQUE DUPLICADO (por fingerprint)
        isDuplicateAttack(newAttack, existingList = null) {
            const list = existingList || getList();
            const newFingerprint = this.getAttackFingerprint(newAttack);
            
            return list.some(existing => {
                // Não comparar com ele mesmo (em caso de edição)
                if (newAttack._id && existing._id === newAttack._id) return false;
                
                const existingFingerprint = this.getAttackFingerprint(existing);
                return existingFingerprint === newFingerprint;
            });
        },
        
        // ✅ VALIDAÇÃO DE EXECUÇÃO DUPLICADA (em tempo real)
        isDuplicateExecution(attack) {
            const list = getList();
            const attackFingerprint = this.getAttackFingerprint(attack);
            
            return list.some(a => {
                // Verifica se já existe um ataque IDÊNTICO executando
                if (!a.locked && !a.done) return false;
                
                const aFingerprint = this.getAttackFingerprint(a);
                return aFingerprint === attackFingerprint && 
                       (a.locked || (a.done && a.success));
            });
        },
        
        // ✅ FINGERPRINT ROBUSTO
        getAttackFingerprint(a) {
            const dt = parseDateTimeToMs(a.datetime);
            const dtKey = isNaN(dt) ? (a.datetime || '') : String(dt);
            
            // Inclui origem, alvo, horário MAS NÃO as tropas
            // (permite ataques diferentes com mesmas coordenadas/horário)
            return `${a.origemId || a.origem}_${a.alvo}_${dtKey}`;
        },
        
        // ✅ VALIDAÇÃO DE COORDENADAS
        isValidCoord(coord) {
            if (!coord) return false;
            const match = coord.toString().match(/^(\d{1,4})\|(\d{1,4})$/);
            if (!match) return false;
            
            const x = parseInt(match[1], 10);
            const y = parseInt(match[2], 10);
            return x >= 0 && x <= 999 && y >= 0 && y <= 999;
        },
        
        // ✅ VALIDAÇÃO DE DATA/HORA
        isValidDateTime(datetimeStr) {
            const ms = parseDateTimeToMs(datetimeStr);
            if (isNaN(ms)) return false;
            
            const now = Date.now();
            const maxFuture = now + (30 * 24 * 60 * 60 * 1000); // 30 dias
            
            return ms > now && ms <= maxFuture;
        },
        
        // ✅ VALIDAÇÃO DE TROPAS
        isValidTroops(troopsObj) {
            if (typeof troopsObj !== 'object') return false;
            
            const validUnits = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
            
            return validUnits.every(unit => {
                const count = troopsObj[unit];
                return typeof count === 'number' && 
                       count >= 0 && 
                       count <= 100000 && // limite razoável
                       Number.isInteger(count);
            });
        },
        
        // ✅ VALIDAÇÃO COMPLETA DE ATAQUE
        validateAttack(attack, options = {}) {
            const errors = [];
            const warnings = [];
            
            // Configurações
            const { skipDuplicates = false, isEdit = false } = options;
            
            // Validações obrigatórias
            if (!this.isValidCoord(attack.origem)) {
                errors.push('Coordenada de origem inválida');
            }
            
            if (!this.isValidCoord(attack.alvo)) {
                errors.push('Coordenada de alvo inválida');
            }
            
            if (!this.isValidDateTime(attack.datetime)) {
                errors.push('Data/hora inválida ou no passado');
            }
            
            if (!this.isValidTroops(attack)) {
                errors.push('Configuração de tropas inválida');
            }
            
            // Validação de duplicata (condicional)
            if (!skipDuplicates && this.isDuplicateAttack(attack)) {
                if (isEdit) {
                    warnings.push('Ataque similar já existe (editando mesmo?)');
                } else {
                    errors.push('Ataque duplicado - já existe um ataque idêntico agendado');
                }
            }
            
            // Validação de auto-ataque
            if (attack.origem === attack.alvo) {
                errors.push('Não é possível atacar a própria aldeia');
            }
            
            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                hasWarnings: warnings.length > 0
            };
        },
        
        // ✅ VALIDAÇÃO EM LOTE (para importação)
        validateBatch(attacks) {
            const results = {
                valid: [],
                invalid: [],
                duplicates: [],
                stats: {
                    total: attacks.length,
                    valid: 0,
                    invalid: 0,
                    duplicates: 0
                }
            };
            
            const seenFingerprints = new Set();
            
            attacks.forEach((attack, index) => {
                const validation = this.validateAttack(attack, { skipDuplicates: true });
                
                // Verifica duplicata dentro do próprio lote
                const fingerprint = this.getAttackFingerprint(attack);
                if (seenFingerprints.has(fingerprint)) {
                    validation.errors.push('Duplicata dentro do lote de importação');
                    validation.isValid = false;
                    results.duplicates.push({ index, attack, validation });
                } else {
                    seenFingerprints.add(fingerprint);
                }
                
                if (validation.isValid) {
                    results.valid.push(attack);
                    results.stats.valid++;
                } else {
                    results.invalid.push({ attack, validation, index });
                    results.stats.invalid++;
                }
            });
            
            return results;
        }
    };
    
    // ═══════════════════════════════════════════════════════
    // 🔧 INTEGRAÇÃO COM BACKEND
    // ═══════════════════════════════════════════════════════
    
    function integrateWithBackend() {
        if (!window.TWS_Backend) return false;
        
        // Guardar função original do backend
        const originalSetList = window.TWS_Backend.setList;
        
        // 🔒 SOBRESCREVER setList com validações
        window.TWS_Backend.setList = function(newList) {
            // Validar cada item da lista
            const validatedList = newList.map(attack => {
                // Garantir que tem ID único
                if (!attack._id) {
                    attack._id = generateUniqueId();
                }
                return attack;
            });
            
            // Verificar duplicatas na lista final
            const fingerprints = new Set();
            const duplicates = [];
            
            validatedList.forEach((attack, index) => {
                const fingerprint = Validations.getAttackFingerprint(attack);
                if (fingerprints.has(fingerprint)) {
                    duplicates.push({ index, attack });
                } else {
                    fingerprints.add(fingerprint);
                }
            });
            
            if (duplicates.length > 0) {
                console.warn('[Validations] Duplicatas detectadas na lista:', duplicates);
                // Remove duplicatas (mantém a primeira ocorrência)
                const uniqueList = validatedList.filter((attack, index) => {
                    const fingerprint = Validations.getAttackFingerprint(attack);
                    const firstIndex = validatedList.findIndex(a => 
                        Validations.getAttackFingerprint(a) === fingerprint
                    );
                    return index === firstIndex;
                });
                
                console.warn(`[Validations] Removidas ${validatedList.length - uniqueList.length} duplicatas`);
                return originalSetList.call(this, uniqueList);
            }
            
            return originalSetList.call(this, validatedList);
        };
        
        // 🔒 VALIDAÇÃO NO EXECUTE ATTACK
        const originalExecuteAttack = window.TWS_Backend.executeAttack;
        
        window.TWS_Backend.executeAttack = async function(cfg) {
            // Validar antes de executar
            const validation = Validations.validateAttack(cfg);
            if (!validation.isValid) {
                throw new Error(`Validação falhou: ${validation.errors.join(', ')}`);
            }
            
            // Verificar duplicata em execução
            if (Validations.isDuplicateExecution(cfg)) {
                throw new Error('Ataque duplicado já está em execução ou foi enviado');
            }
            
            return await originalExecuteAttack.call(this, cfg);
        };
        
        // ✅ ADICIONAR API DE VALIDAÇÃO AO BACKEND
        window.TWS_Backend.Validations = Validations;
        
        console.log('[TWS Validations] ✅ Validações integradas ao Backend');
        return true;
    }
    
    // ═══════════════════════════════════════════════════════
    // 🚀 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════
    
    // Esperar backend carregar completamente
    function initialize() {
        if (window.TWS_Backend) {
            integrateWithBackend();
        } else {
            // Tentar novamente em 100ms
            setTimeout(initialize, 100);
        }
    }
    
    // Iniciar
    setTimeout(initialize, 100);
    
    // ═══════════════════════════════════════════════════════
    // 🌐 EXPORTAR PARA USO GLOBAL
    // ═══════════════════════════════════════════════════════
    
    window.TWS_Validations = Validations;
    
    console.log('[TWS Validations] ✅ Módulo de validações carregado');
    
})();
