/* =====================================================================
   IMPORTAÇÃO DE PRESENÇA DO GOOGLE SHEETS
   Painel Liderança | HUB LMG-48

   Como instalar:
   1. Salve este arquivo na mesma pasta do index.html e do app.js.
   2. No index.html, logo abaixo de <script src="app.js"></script>, adicione:
          <script src="sheets-presenca.js"></script>
   3. Pronto. O botão "Importar do Sheets" aparece sozinho no painel
      de Presença Mensal, ao lado do campo "MÊS REFERÊNCIA".

   Ao clicar, o sistema pergunta o turno:
   - AM    -> importa só quem tem líder FELIPE
   - PM    -> importa só quem tem líder MALANE
   - AMBOS -> importa todo mundo
   Importar um turno NÃO apaga os colaboradores do outro turno.

   Este arquivo fica todo isolado (não cria variáveis globais), então
   não interfere no app.js nem no login.
   ===================================================================== */

(function () {
    'use strict';

    // ======================= CONFIGURAÇÃO =======================

    // Link da planilha (precisa estar como "Qualquer pessoa com o link → Leitor")
    const SHEET_LINK = 'https://docs.google.com/spreadsheets/d/1zE6yZcKDIxBo2_MeYdNHkvNAo19zVd8Cy9ZOJtj3mkA/edit';

    // true  = lendo a planilha ORIGINAL (cabeçalho na linha 4, Líder na coluna F, dia 1 na coluna K)
    // false = lendo a planilha ESPELHO  (A = Nome, B = Líder, C = dia 1)
    const USAR_PLANILHA_ORIGINAL = true;

    // Líder -> turno
    const LIDER_TURNO = {
        FELIPE: 'AM',
        MALANE: 'PM'
    };

    // Onde a presença é salva no Firebase ({mes} vira "2026-11", por exemplo).
    // Se o app.js usa outro caminho, troque aqui.
    const FIREBASE_PATH_PRESENCA = 'presenca/{mes}';

    // Código da planilha -> código do sistema.
    // O que não estiver aqui (AF, FE, TD, NC, BH, S1, SU...) fica em branco.
    const MAPA_CODIGOS = {
        P: 'P',   S2: 'P',     // presente (PHD Shopee = P + S2)
        F: 'F',   FJ: 'F',     // faltas
        AM: 'AT',              // atestado médico
        FO: 'FG', DSR: 'FG'    // folga / descanso semanal
    };

    // true = tira a matrícula do fim do nome ("JOAO SILVA GN48770" -> "JOAO SILVA")
    const REMOVER_MATRICULA_DO_NOME = true;

    // ===================== FIM DA CONFIGURAÇÃO =====================


    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const COLUNAS = USAR_PLANILHA_ORIGINAL
        ? { nome: 0, lider: 5, primeiroDia: 10, range: 'A4:AO400' }   // A | F | K
        : { nome: 0, lider: 1, primeiroDia: 2,  range: '' };          // A | B | C

    function getSheetId() {
        const m = SHEET_LINK.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!m) throw new Error('Link da planilha inválido. Confira o SHEET_LINK no topo do arquivo.');
        return m[1];
    }

    function turnoDoLider(lider) {
        const l = String(lider || '').trim().toUpperCase();
        for (const nome in LIDER_TURNO) {
            if (l.includes(nome)) return LIDER_TURNO[nome];
        }
        return null;
    }

    function limparNome(bruto) {
        let nome = String(bruto || '').trim().toUpperCase().replace(/\s+/g, ' ');
        if (REMOVER_MATRICULA_DO_NOME) nome = nome.replace(/\s+[A-Z]+\d+$/, '').trim();
        return nome.replace(/[.#$\[\]\/]/g, '').trim(); // caracteres proibidos em chaves do Firebase
    }

    // Confere se a aba lida é mesmo a do mês escolhido
    // (protege contra o Google devolver outra aba quando o nome não existe)
    function validarCabecalho(cabecalho, ano, mes, aba) {
        const tituloNome = String(cabecalho[COLUNAS.nome] || '').toUpperCase();
        if (!tituloNome.includes('NOME')) {
            throw new Error(`A aba "${aba}" não foi encontrada ou está com outro formato.\n` +
                            `Confira se o nome da aba na planilha é exatamente "${aba}".`);
        }
        const data = String(cabecalho[COLUNAS.primeiroDia] || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (data && (Number(data[2]) !== mes || Number(data[3]) !== ano)) {
            throw new Error(`A aba "${aba}" começa em ${data[0]}, que não é o mês selecionado ` +
                            `(${String(mes).padStart(2, '0')}/${ano}).`);
        }
    }

    // Transforma as linhas da planilha em { NOME: { dia: código } }
    function processarLinhas(linhas, turno, diasNoMes) {
        const dados = {};
        const semTurno = [];
        let totalMarcacoes = 0;

        linhas.slice(1).forEach(l => {
            const nomeOriginal = String(l[COLUNAS.nome] || '').trim();
            if (!nomeOriginal) return;

            const turnoPessoa = turnoDoLider(l[COLUNAS.lider]);
            if (!turnoPessoa) {
                semTurno.push(`${nomeOriginal} (líder: ${String(l[COLUNAS.lider] || '').trim() || 'vazio'})`);
                if (turno !== 'AMBOS') return;
            } else if (turno !== 'AMBOS' && turnoPessoa !== turno) {
                return;
            }

            const nome = limparNome(nomeOriginal);
            if (!nome) return;

            const dias = {};
            for (let d = 1; d <= diasNoMes; d++) {
                const cod = String(l[COLUNAS.primeiroDia + d - 1] || '').trim().toUpperCase();
                if (MAPA_CODIGOS[cod]) {
                    dias[d] = MAPA_CODIGOS[cod];
                    totalMarcacoes++;
                }
            }
            if (Object.keys(dias).length) dados[nome] = dias;
        });

        return { dados, semTurno, totalMarcacoes };
    }

    async function baixarAba(aba) {
        const range = COLUNAS.range ? `&range=${COLUNAS.range}` : '';
        const url = `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq` +
                    `?tqx=out:csv&headers=1${range}&sheet=${encodeURIComponent(aba)}`;

        let resp;
        try {
            resp = await fetch(url);
        } catch (e) {
            // Planilha restrita: o Google redireciona para a tela de login e o navegador bloqueia
            throw new Error('Não foi possível acessar a planilha.\n\n' +
                            'Confira se ela está compartilhada como "Qualquer pessoa com o link → Leitor" ' +
                            'e se há conexão com a internet.');
        }
        if (!resp.ok) throw new Error(`O Google respondeu com erro ${resp.status}. Confira o nome da aba "${aba}".`);

        const csv = await resp.text();
        if (csv.trim().startsWith('<')) {
            throw new Error('A planilha não está compartilhada como "Qualquer pessoa com o link → Leitor".');
        }
        if (!csv.trim()) throw new Error(`A aba "${aba}" veio vazia.`);
        return csv;
    }

    async function importar(turno) {
        const inputMes = document.getElementById('pres-month-select');
        const mesRef = inputMes ? inputMes.value : ''; // "2026-11"
        if (!mesRef) { alert('Selecione o MÊS REFERÊNCIA antes de importar.'); return; }

        if (typeof XLSX === 'undefined') { alert('Biblioteca XLSX não carregou. Verifique a internet e recarregue a página.'); return; }
        if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
            alert('O Firebase ainda não foi iniciado. Faça login e tente novamente.');
            return;
        }

        const [ano, mes] = mesRef.split('-').map(Number);
        const diasNoMes = new Date(ano, mes, 0).getDate();
        const aba = `Controle-${MESES[mes - 1]}`;
        const descTurno = turno === 'AMBOS' ? 'AM + PM' : turno;

        if (!confirm(`Importar a aba "${aba}" — turno ${descTurno}?\n\n` +
                     `A presença desses colaboradores em ${String(mes).padStart(2, '0')}/${ano} será SUBSTITUÍDA ` +
                     `pelos dados da planilha. Os demais colaboradores não serão alterados.`)) {
            return;
        }

        const btn = document.getElementById('btn-import-sheets');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...'; }

        try {
            const csv = await baixarAba(aba);
            const wb = XLSX.read(csv, { type: 'string', raw: true });
            const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
            if (!linhas.length) throw new Error(`A aba "${aba}" veio vazia.`);

            validarCabecalho(linhas[0], ano, mes, aba);

            const { dados, semTurno, totalMarcacoes } = processarLinhas(linhas, turno, diasNoMes);
            const qtd = Object.keys(dados).length;
            if (qtd === 0) throw new Error(`Nenhum colaborador do turno ${descTurno} com presença lançada na aba "${aba}".`);

            // update (e não set): substitui só os colaboradores importados, sem apagar o outro turno
            const caminho = FIREBASE_PATH_PRESENCA.replace('{mes}', mesRef);
            await firebase.database().ref(caminho).update(dados);

            // Redesenha o painel de presença usando a função que já existe no sistema
            if (typeof window.changePresencaMonth === 'function') {
                try { window.changePresencaMonth(); } catch (e) { console.warn('[Importar Sheets] Erro ao redesenhar:', e); }
            }

            let msg = `Presença importada com sucesso!\n\nAba: ${aba}\nTurno: ${descTurno}\n` +
                      `Colaboradores: ${qtd}\nMarcações: ${totalMarcacoes}`;
            if (semTurno.length) {
                msg += `\n\nAtenção: ${semTurno.length} colaborador(es) com líder fora do Felipe/Malane` +
                       (turno === 'AMBOS' ? ' (importados mesmo assim)' : ' (não importados)') + ':\n- ' +
                       semTurno.slice(0, 10).join('\n- ') + (semTurno.length > 10 ? '\n- ...' : '');
            }
            alert(msg);
        } catch (e) {
            console.error('[Importar Sheets]', e);
            alert('Erro ao importar do Google Sheets:\n\n' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-import"></i> Importar do Sheets'; }
        }
    }

    // ---------- Janela de escolha do turno ----------
    function fecharJanelaTurno() {
        const overlay = document.getElementById('sp-turno-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function abrirJanelaTurno() {
        const inputMes = document.getElementById('pres-month-select');
        if (!inputMes || !inputMes.value) { alert('Selecione o MÊS REFERÊNCIA antes de importar.'); return; }

        let overlay = document.getElementById('sp-turno-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sp-turno-overlay';
            overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; ' +
                                    'display:flex; align-items:center; justify-content:center;';
            overlay.innerHTML = `
                <div class="dc-modal-content">
                    <div class="dc-modal-title">IMPORTAR DO SHEETS</div>
                    <div class="dc-modal-name" style="margin-bottom:25px; color:var(--text-muted); font-size:0.9rem;">
                        Qual turno deseja importar?
                    </div>
                    <div style="display:flex; gap:15px; margin-bottom:15px;">
                        <button type="button" class="dc-btn" data-turno="AM" style="flex:1; border-color:#fbbf24;">
                            <i class="fas fa-sun" style="color:#fbbf24; margin-bottom:8px; display:block; font-size:1.8rem;"></i>
                            AM<div style="font-size:0.7rem; opacity:0.6; margin-top:4px;">Felipe</div>
                        </button>
                        <button type="button" class="dc-btn" data-turno="PM" style="flex:1; border-color:#94a3b8;">
                            <i class="fas fa-moon" style="color:#94a3b8; margin-bottom:8px; display:block; font-size:1.8rem;"></i>
                            PM<div style="font-size:0.7rem; opacity:0.6; margin-top:4px;">Malane</div>
                        </button>
                    </div>
                    <button type="button" class="dc-btn" data-turno="AMBOS" style="width:100%; margin-bottom:15px; border-color:#22c55e;">
                        <i class="fas fa-users" style="color:#22c55e;"></i> AMBOS OS TURNOS
                    </button>
                    <button type="button" class="btn-ghost" data-turno="CANCELAR" style="width:100%; padding:12px;">CANCELAR</button>
                </div>`;

            overlay.addEventListener('click', e => {
                if (e.target === overlay) { fecharJanelaTurno(); return; }
                const botao = e.target.closest('[data-turno]');
                if (!botao) return;
                fecharJanelaTurno();
                if (botao.dataset.turno !== 'CANCELAR') importar(botao.dataset.turno);
            });
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    // ---------- Cria o botão ao lado do campo "MÊS REFERÊNCIA" ----------
    function criarBotao() {
        if (document.getElementById('btn-import-sheets')) return;
        const inputMes = document.getElementById('pres-month-select');
        if (!inputMes) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-import-sheets';
        btn.className = 'btn-ghost';
        btn.style.cssText = 'border-color: #22c55e; color: #22c55e;';
        btn.innerHTML = '<i class="fas fa-file-import"></i> Importar do Sheets';
        btn.addEventListener('click', abrirJanelaTurno);
        inputMes.insertAdjacentElement('afterend', btn);
    }

    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', criarBotao);
        } else {
            criarBotao();
        }
    } catch (e) {
        console.error('[Importar Sheets] Não foi possível criar o botão:', e);
    }

    // Só para testes automatizados fora do navegador
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { processarLinhas, validarCabecalho, limparNome, turnoDoLider };
    }
})();
