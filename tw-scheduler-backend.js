// === Scheduler ===
function startScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);

    _schedulerInterval = setInterval(async () => {
        const list = getList();
        const now = Date.now();
        const msgs = [];
        let hasChanges = false;

        const ataquesPorHorario = {};

        // === SCAN DOS AGENDAMENTOS ===
        for (const a of list) {

            const fingerprint = getAttackFingerprint(a);

            if (_processedAttacks.has(fingerprint)) {
                continue;
            }

            if (a.done || a.locked) continue;

            const t = parseDateTimeToMs(a.datetime);
            if (!t) continue;

            const diff = t - now;

            if (diff <= 0 && diff > -10000) {
                // agrupar por horário
                const h = a.datetime;
                (ataquesPorHorario[h] ??= []).push(a);
            } else if (diff > 0) {
                const seconds = (diff / 1000) | 0;
                const minutes = (seconds / 60) | 0;
                const secs = seconds % 60;

                msgs.push(
                    `🕒 ${a.origem} → ${a.alvo} em ${minutes}:${secs.toString().padStart(2, '0')}`
                );
            }
        }

        // === EXECUÇÃO DE LOTES POR HORÁRIO ===
        for (const [horario, ataques] of Object.entries(ataquesPorHorario)) {

            const total = ataques.length;

            msgs.push(`🔥 Executando ${total} ataque(s)...`);

            for (let i = 0; i < total; i++) {

                const a = ataques[i];
                const fingerprint = getAttackFingerprint(a);

                if (_processedAttacks.has(fingerprint)) {
                    continue;
                }

                if (!a._id) {
                    a._id = generateUniqueId();
                    hasChanges = true;
                }

                if (_executing.has(a._id)) {
                    continue;
                }

                // marca como processado ANTES de executar
                _processedAttacks.add(fingerprint);

                a.locked = true;
                hasChanges = true;

                // grava apenas quando necessário
                setList(list);

                _executing.add(a._id);

                try {
                    await executeAttack(a);
                    a.done = true;
                    a.executedAt = new Date().toISOString();
                    hasChanges = true;
                } catch (err) {
                    a.error = err.message;
                    a.done = true;
                    a.success = false;
                    hasChanges = true;
                } finally {
                    a.locked = false;
                    _executing.delete(a._id);
                    hasChanges = true;
                }

                // delay apenas se houver próximo
                if (i < total - 1) {
                    await sleep(200);
                }
            }

            // === inicia validação pós-execução ===
            validateAttacksAfterExecution();
        }

        // salva alterações finais
        if (hasChanges) {
            setList(list);
        }

        // atualiza status
        const status = document.getElementById('tws-status');
        if (status) {
            status.innerHTML = msgs.length ? msgs.join('<br>') : 'Sem agendamentos ativos.';
        }

    }, 1000);
}
