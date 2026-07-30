// app.js - Logistics Elite HUB LMG-48

// =========================================================
// JAVASCRIPT GERAL - LÓGICA CENTRAL E SINCRONIA MULTI-PC
// =========================================================

const firebaseConfig = {
    apiKey: "AIzaSyCPfPA96Zytrgx0PrkbL6lvuy1M3W7vxTk",
    authDomain: "rank-spx-logistc.firebaseapp.com",
    databaseURL: "https://rank-spx-logistc-default-rtdb.firebaseio.com",
    projectId: "rank-spx-logistc",
    storageBucket: "rank-spx-logistc.firebasestorage.app",
    messagingSenderId: "426816846853",
    appId: "1:426816846853:web:bc13432f05c2171ec8f06c"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const dbFirebase = firebase.database();

const USERS = [ { u:'admin', p:'spxadminl', r:'admin' }, { u:'mesa', p:'1234', r:'user' } ];
let currentUser = null;
let dailyData = [];
let ctrlData = initCtrl();
let globalProdData = {}; 

const escDiasConf = [
    { id: 'segunda', nome: 'ESCALA SEGUNDA', bg: '#5c6e85', cor: '#fff' },
    { id: 'terca', nome: 'ESCALA TERÇA', bg: '#b4a7d6', cor: '#000' },
    { id: 'quarta', nome: 'ESCALA QUARTA', bg: '#c2deb0', cor: '#000' },
    { id: 'quinta', nome: 'ESCALA QUINTA', bg: '#ff9900', cor: '#000' },
    { id: 'sexta', nome: 'ESCALA SEXTA', bg: '#8ea9db', cor: '#000' },
    { id: 'sabado', nome: 'ESCALA SÁBADO', bg: '#ffe699', cor: '#000' },
    { id: 'domingo', nome: 'ESCALA DOMINGO', bg: '#f4b084', cor: '#000' }
];

const escRows = ['ABASTECEDOR', 'BIPADOR', 'ETIQUETADOR', 'SORTING MESA', 'SORTING RUAS'];
const escCols = ['Mesa1', 'Mesa2', 'Mesa3', 'Mesa4', 'Mesa5', 'Mesa6', 'Mesa7', 'Mesa8', 'Mesa9 VOLUMOSO', 'HANDOVER', 'Gaioleiro 1 pct', 'MESA XPT'];

const dcLayout = [
    { id: 'dc', title: 'DOBLE CHECK', rows: 3, cols: 4 },
    { id: 'trat', title: 'TRATATIVAS DE ETIQUETAGEM', rows: 1, cols: 4 },
    { id: 'alim', title: 'ALIMENTAR MESAS (MOVIMENTAR GAIOLAS)', rows: 1, cols: 4 }
];

let operadoresList = []; 
let liveEscalaSemana = {};
let currentSidebarDay = 'segunda';
let liveEscalaDcSemana = {};
let currentSidebarDcDay = 'segunda';
let livePresenca = {};
let currentPresMes = ""; 
let presencaListener = null;
let activePresColab = '';
let activePresDia = '';

let historyDataCache = {};
let historyDcDataCache = {};
let monthlyDataCache = {};

let globalMetaPHD = 530; 
let prodHistoryCache = {}; 

function initCtrl() { return { date: '', totalVol: 0, totalRotas: 0, minTime: null, maxTime: null, finRot: 0, finVol: 0, missRot: 0, missVol: 0, missingRot: 0, missingVol: 0, hourly: {}, sumDurHI: 0, countDurHI: 0 }; }

// =========================================================
// SIDEBAR MENU & NAVEGAÇÃO BLINDADA
// =========================================================
function toggleMenu(menuId, headerEl) {
    let el = document.getElementById(menuId);
    if(el) el.classList.toggle('open');
    if(headerEl) headerEl.classList.toggle('open');
}

function switchTab(id) {
    if (currentUser && currentUser.r === 'admin') {
        try {
            let elProd = document.getElementById('view-prod');
            if (elProd && !elProd.classList.contains('hidden')) saveProdState();
        } catch(e) { console.error(e); }
    }

    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    
    let targetView = document.getElementById('view-'+id);
    if(targetView) targetView.classList.remove('hidden');
    
    let btn = document.getElementById('btn-'+id);
    if(btn) btn.classList.add('active');
    
    if(id==='dia') renderDaily(); 
    if(id==='ctrl') renderControl(); 
    if(id==='rankprod') renderRankProd(); 
    if(id==='mes') renderMonthly(); 
    if(id==='bi') renderBIChart(); 
    if(id==='escala') renderEscalaSemana(); 
    if(id==='escala-dc') renderEscalaDcSemana(); 
    if(id==='hist-escala') renderHistEscala('lugares');
    if(id==='hist-escala-dc') renderHistEscala('dc');
    if(id==='presenca') loadPresencaData(); 
    if(id==='sitelider' || id==='sitelider-analise') renderSiteliderDashboard(); 
}

// =========================================================
// CÉREBRO MATEMÁTICO E SALVAMENTO CÉLULA A CÉLULA
// =========================================================
window.updateScaleField = function(diaId, field, element) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let valueText = element.innerText.trim();
    if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '', visible: true, grid: {} };
    
    liveEscalaSemana[diaId][field] = valueText;
    dbFirebase.ref(`shopee_escala_semana_live/${diaId}/${field}`).set(valueText);

    if(field === 'hc' || field === 'dw' || field === 'pct') {
        let hc = parseFloat(String(liveEscalaSemana[diaId].hc).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let dw = parseFloat(String(liveEscalaSemana[diaId].dw).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let pct = parseFloat(String(liveEscalaSemana[diaId].pct).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let totalEfetivo = hc + dw;
        let phdCalculado = totalEfetivo > 0 ? Math.round(pct / totalEfetivo) : 0;
        
        liveEscalaSemana[diaId].phd = phdCalculado.toString();
        let phdEl = document.getElementById(`esc-phd-${diaId}`);
        if(phdEl) phdEl.innerText = phdCalculado;
        dbFirebase.ref(`shopee_escala_semana_live/${diaId}/phd`).set(phdCalculado.toString());
    }
};

window.handleEscalaSelect = function(diaId, rIdx, cIdx, selectElement) {
    if(!currentUser || currentUser.r !== 'admin') return;
    if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { grid: {} };
    if(!liveEscalaSemana[diaId].grid) liveEscalaSemana[diaId].grid = {};
    if(!liveEscalaSemana[diaId].grid[rIdx]) liveEscalaSemana[diaId].grid[rIdx] = {};
    
    liveEscalaSemana[diaId].grid[rIdx][cIdx] = selectElement.value || "";
    dbFirebase.ref(`shopee_escala_semana_live/${diaId}/grid/${rIdx}/${cIdx}`).set(selectElement.value || "");
    
    document.getElementById('sidebar-day-select').value = diaId; 
    currentSidebarDay = diaId; 
    updateDropdownsAvailability(diaId);
    updateSidebar();
};

window.updateScaleDcField = function(diaId, field, element) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let valueText = element.innerText.trim();
    if(!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { dataDia: '', visible: true, grid: {} };
    liveEscalaDcSemana[diaId][field] = valueText;
    dbFirebase.ref(`shopee_escala_dc_live/${diaId}/${field}`).set(valueText);
};

window.handleEscalaDcSelect = function(diaId, cellId, selectElement) {
    if(!currentUser || currentUser.r !== 'admin') return;
    if(!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { grid: {} };
    if(!liveEscalaDcSemana[diaId].grid) liveEscalaDcSemana[diaId].grid = {};
    
    liveEscalaDcSemana[diaId].grid[cellId] = selectElement.value || "";
    dbFirebase.ref(`shopee_escala_dc_live/${diaId}/grid/${cellId}`).set(selectElement.value || "");
    
    document.getElementById('sidebar-day-select-dc').value = diaId; 
    currentSidebarDcDay = diaId;
    updateDropdownsAvailabilityDc(diaId);
    updateSidebarDc();
};

window.saveMetaPHD = function() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let inputEl = document.getElementById('meta-phd-input'); if(!inputEl) return;
    let val = parseInt(inputEl.value) || 530;
    dbFirebase.ref('shopee_meta_phd').set(val);
    showToast("Meta PHD atualizada!");
};

// =========================================================
// RENDERIZAÇÃO INTELIGENTE DAS ESCALAS (FIM DO TRAVAMENTO)
// =========================================================
function syncEscalaSemanaUI() {
    const isAdm = currentUser && currentUser.r === 'admin';
    escDiasConf.forEach(diaConf => {
        let id = diaConf.id;
        let escDia = liveEscalaSemana[id] || {};
        
        let dtEl = document.getElementById(`esc-datadia-${id}`); if(dtEl && document.activeElement !== dtEl) dtEl.innerText = escDia.dataDia || '(inserir data)';
        let hcEl = document.getElementById(`esc-hc-${id}`); if(hcEl && document.activeElement !== hcEl) hcEl.innerText = escDia.hc || '0';
        let pctEl = document.getElementById(`esc-pct-${id}`); if(pctEl && document.activeElement !== pctEl) pctEl.innerText = escDia.pct || '0';
        let capEl = document.getElementById(`esc-cap-${id}`); if(capEl && document.activeElement !== capEl) capEl.innerText = escDia.cap || '0';
        let dwEl = document.getElementById(`esc-dw-${id}`); if(dwEl && document.activeElement !== dwEl) dwEl.innerText = escDia.dw || '0';
        let phdEl = document.getElementById(`esc-phd-${id}`); if(phdEl) phdEl.innerText = escDia.phd || '0';
        let capphdEl = document.getElementById(`esc-capphd-${id}`); if(capphdEl && document.activeElement !== capphdEl) capphdEl.innerText = escDia.capphd || '0';

        let eyeBtn = document.getElementById(`btn-eye-sem-${id}`);
        if(eyeBtn) {
            eyeBtn.className = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off';
            eyeBtn.innerHTML = `<i class="fas ${escDia.visible ? 'fa-eye' : 'fa-eye-slash'}"></i> ${escDia.visible ? 'Visível' : 'Oculto'}`;
        }

        escRows.forEach((cargo, rIdx) => {
            escCols.forEach((col, cIdx) => {
                let cellVal = (escDia.grid && escDia.grid[rIdx]) ? (escDia.grid[rIdx][cIdx] || "") : "";
                if(isAdm) {
                    let sel = document.getElementById(`esc-cell-${id}-${rIdx}-${cIdx}`);
                    if(sel && sel.value !== cellVal) sel.value = cellVal;
                } else {
                    let td = document.getElementById(`esc-cell-view-${id}-${rIdx}-${cIdx}`);
                    if(td) td.innerText = formatShortName(cellVal);
                }
            });
        });
        if(isAdm) updateDropdownsAvailability(id);
    });
    if(isAdm) updateSidebar();
}

function renderEscalaSemana() {
    const container = document.getElementById('escala-semanal-container'); if(!container) return;
    const isAdm = currentUser && currentUser.r === 'admin'; 
    const editAttr = isAdm ? 'contenteditable="true"' : ''; 
    const editClass = isAdm ? 'editable-cell' : '';
    
    // Verifica se a tabela já foi desenhada para este usuário. Se sim, apenas atualiza os dados!
    let currentRole = isAdm ? 'admin' : 'user';
    if (container.children.length > 0 && container.getAttribute('data-role') === currentRole) {
        syncEscalaSemanaUI();
        return;
    }

    container.innerHTML = '';
    container.setAttribute('data-role', currentRole);
    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaSemana[diaConf.id] || {hc:'0', pct:'0', cap:'0', dw:'0', phd:'0', capphd:'0', dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let prevDayName = index > 0 ? escDiasConf[index - 1].nome.replace('ESCALA ', '') : "";
        let btnCopiar = (isAdm && index > 0) ? `<button class="esc-day-btn" style="border-color: #3b82f6; color: #3b82f6;" onclick="copyFromPreviousDay('${diaConf.id}')"><i class="fas fa-copy"></i> Copiar Anter.</button>` : '';
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeOperators('${diaConf.id}')"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; 
        let btnEye = isAdm ? `<button id="btn-eye-sem-${diaConf.id}" class="${eyeClass}" onclick="toggleDayVisibility('${diaConf.id}')"><i class="fas ${escDia.visible ? 'fa-eye' : 'fa-eye-slash'}"></i> ${escDia.visible ? 'Visível' : 'Oculto'}</button>` : '';

        let html = `<div class="esc-block"><table class="esc-table" style="border-bottom:none; margin-bottom: 5px;">
                <tr><td colspan="7" style="background-color: ${diaConf.bg} !important; color: ${diaConf.cor} !important; padding: 0;"><div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px;"><span style="font-size: 14px; font-weight: 800;">${diaConf.nome}</span><div style="display:flex; gap:8px;">${btnCopiar}${btnSortear}${btnEye}</div></div></td></tr>
                <tr>
                    <td class="esc-gray-light ${editClass}" ${editAttr} id="esc-datadia-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'dataDia', this)" style="text-align: left; padding-left: 10px; font-weight: bold; font-size: 11px; color: #002f6c; width:20%;">${escDia.dataDia || '(inserir data)'}</td>
                    <td class="esc-gray-light" style="width:10%">Quantidade HC</td><td class="${editClass}" ${editAttr} id="esc-hc-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'hc', this)" style="width:10%">${escDia.hc}</td>
                    <td class="esc-gray-light" style="width:10%">PCT. PROCESSADOS</td><td class="esc-green ${editClass}" ${editAttr} id="esc-pct-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'pct', this)" style="width:10%">${escDia.pct}</td>
                    <td class="esc-gray-light" style="width:10%">CAP PROCESSAMENTO</td><td class="esc-cyan ${editClass}" ${editAttr} id="esc-cap-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'cap', this)" style="width:10%">${escDia.cap}</td>
                </tr>
                <tr>
                    <td class="esc-gray-light" style="border-top: none;"></td>
                    <td class="esc-gray-light">Necessidade DW</td><td class="esc-red-txt ${editClass}" ${editAttr} id="esc-dw-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'dw', this)">${escDia.dw}</td>
                    <td class="esc-gray-light esc-red-txt">PHD Atingido</td><td class="esc-red-txt" id="esc-phd-${diaConf.id}">${escDia.phd}</td>
                    <td class="esc-gray-light">CAP PHD</td><td class="esc-cyan esc-red-txt ${editClass}" ${editAttr} id="esc-capphd-${diaConf.id}" onblur="updateScaleField('${diaConf.id}', 'capphd', this)">${escDia.capphd}</td>
                </tr>
            </table>
            <table class="esc-table"><tr class="esc-gray-light"><th style="width:8%">OPERADOR</th>`;
        escCols.forEach(col => { html += `<th>${col.toUpperCase()}</th>`; }); html += `</tr>`;
        
        escRows.forEach((cargo, rIdx) => {
            html += `<tr><td class="esc-gray-dark" style="text-align:left; padding-left:5px; font-size: 10px;">${cargo}</td>`;
            escCols.forEach((col, cIdx) => {
                const isMergedRow = (rIdx === 0 || rIdx === 3); const isMesaGroupCol = (cIdx === 0 || cIdx === 2 || cIdx === 4 || cIdx === 6); const isSkipCol = (cIdx === 1 || cIdx === 3 || cIdx === 5 || cIdx === 7);
                if (isMergedRow && isSkipCol) return; 
                let cellVal = (escDia.grid && escDia.grid[rIdx]) ? (escDia.grid[rIdx][cIdx] || "") : "";
                let colspanAttr = (isMergedRow && isMesaGroupCol) ? 'colspan="2"' : '';
                
                if (isAdm) {
                    let selectHtml = `<select class="esc-select" id="esc-cell-${diaConf.id}-${rIdx}-${cIdx}" onchange="handleEscalaSelect('${diaConf.id}', ${rIdx}, ${cIdx}, this)"><option value="">--</option>`;
                    operadoresList.forEach(op => { 
                        let short = formatShortName(op); let selected = (cellVal === op) ? 'selected' : ''; 
                        selectHtml += `<option value="${op}" ${selected}>${short}</option>`;
                    });
                    selectHtml += `</select>`; html += `<td ${colspanAttr} style="padding:0;">${selectHtml}</td>`;
                } else { html += `<td id="esc-cell-view-${diaConf.id}-${rIdx}-${cIdx}" ${colspanAttr} class="esc-gray-light" style="color:#000; font-size: 9px; font-weight: 800;">${formatShortName(cellVal)}</td>`; }
            });
            html += `</tr>`;
        });
        html += `</table></div>`; container.innerHTML += html;
    });

    if (!isAdm && !renderedAny) container.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-muted); font-size: 1.2rem; font-weight: bold;">A Escala ainda não foi publicada.</div>';
    if(isAdm) { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); }
}

function syncEscalaDcUI() {
    const isAdm = currentUser && currentUser.r === 'admin';
    escDiasConf.forEach(diaConf => {
        let id = diaConf.id;
        let escDia = liveEscalaDcSemana[id] || {};
        let dtEl = document.getElementById(`esc-dc-datadia-${id}`); if(dtEl && document.activeElement !== dtEl) dtEl.innerText = escDia.dataDia || '(inserir data)';
        
        let eyeBtn = document.getElementById(`btn-eye-dc-${id}`);
        if(eyeBtn) {
            eyeBtn.className = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off';
            eyeBtn.innerHTML = `<i class="fas ${escDia.visible ? 'fa-eye' : 'fa-eye-slash'}"></i> ${escDia.visible ? 'Visível' : 'Oculto'}`;
        }

        dcLayout.forEach(sec => {
            let slots = sec.rows * sec.cols;
            for(let i=0; i<slots; i++) {
                let cellId = `${sec.id}_${i}`;
                let cellVal = escDia.grid ? (escDia.grid[cellId] || "") : "";
                if(isAdm) {
                    let sel = document.getElementById(`esc-dc-cell-${id}-${cellId}`);
                    if(sel && sel.value !== cellVal) sel.value = cellVal;
                } else {
                    let td = document.getElementById(`esc-dc-cell-view-${id}-${cellId}`);
                    if(td) td.innerText = formatShortName(cellVal);
                }
            }
        });
        if(isAdm) updateDropdownsAvailabilityDc(id);
    });
    if(isAdm) updateSidebarDc();
}

function renderEscalaDcSemana() {
    const container = document.getElementById('escala-dc-container'); if(!container) return; 
    const isAdm = currentUser && currentUser.r === 'admin'; 
    let currentRole = isAdm ? 'admin' : 'user';

    // Evita redesenhar a tabela do zero se já existir, apenas atualiza
    if (container.children.length > 0 && container.getAttribute('data-role') === currentRole) {
        syncEscalaDcUI();
        return;
    }

    container.innerHTML = '';
    container.setAttribute('data-role', currentRole);
    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaDcSemana[diaConf.id] || { dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeDc('${diaConf.id}')"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; 
        let btnEye = isAdm ? `<button id="btn-eye-dc-${diaConf.id}" class="${eyeClass}" onclick="toggleDayVisibilityDc('${diaConf.id}')"><i class="fas ${escDia.visible ? 'fa-eye' : 'fa-eye-slash'}"></i> ${escDia.visible ? 'Visível' : 'Oculto'}</button>` : '';
        let headerControls = isAdm ? `<div style="display:flex; gap:8px; align-items:center;">${btnSortear}${btnEye}</div>` : '';

        let html = `<div class="esc-block"><table class="esc-table" style="border-bottom:none; margin-bottom: 5px;">
                <tr><td style="background-color: ${diaConf.bg} !important; color: ${diaConf.cor} !important; padding: 0;"><div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px;"><span style="font-size: 14px; font-weight: 800;">${diaConf.nome}</span>${headerControls}</div></td></tr>
                <tr><td class="esc-gray-light editable-cell" contenteditable="${isAdm}" id="esc-dc-datadia-${diaConf.id}" onblur="updateScaleDcField('${diaConf.id}', 'dataDia', this)" style="text-align: left; padding-left: 10px; font-weight: bold; font-size: 11px; color: #002f6c;">${escDia.dataDia || '(inserir data)'}</td></tr>
            </table>
            <table class="esc-table">`;
        
        dcLayout.forEach(sec => {
            html += `<tr class="spx-navy"><td colspan="${sec.cols}" style="color:#fff; font-size:10px;">${sec.title}</td></tr>`;
            let cellCounter = 0;
            for(let r=0; r<sec.rows; r++) {
                html += `<tr>`;
                for(let c=0; c<sec.cols; c++) {
                    let cellId = `${sec.id}_${cellCounter}`;
                    let cellVal = escDia.grid ? escDia.grid[cellId] : '';
                    
                    if (isAdm) {
                        let selectHtml = `<select class="esc-select" id="esc-dc-cell-${diaConf.id}-${cellId}" onchange="handleEscalaDcSelect('${diaConf.id}', '${cellId}', this)"><option value="">--</option>`;
                        operadoresList.forEach(op => { 
                            let short = formatShortName(op); let selected = (cellVal === op) ? 'selected' : ''; 
                            selectHtml += `<option value="${op}" ${selected}>${short}</option>`; 
                        });
                        selectHtml += `</select>`; html += `<td style="padding:0; width: 25%;">${selectHtml}</td>`;
                    } else { html += `<td id="esc-dc-cell-view-${diaConf.id}-${cellId}" class="esc-gray-light" style="color:#000; font-size: 9px; font-weight: 800; width: 25%;">${formatShortName(cellVal)}</td>`; }
                    cellCounter++;
                }
                html += `</tr>`;
            }
        });
        html += `</table></div>`; container.innerHTML += html;
    });

    if (!isAdm && !renderedAny) container.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-muted); font-size: 1.2rem; font-weight: bold;">A Escala Doblecheck ainda não foi publicada.</div>';
    if(isAdm) { escDiasConf.forEach(d => updateDropdownsAvailabilityDc(d.id)); updateSidebarDc(); }
}

// =========================================================
// DASHBOARD SITELIDER & ANÁLISE DE GAP REALTIME
// =========================================================
async function renderSiteliderDashboard() {
    try {
        let weekInput = document.getElementById('sl-week-select');
        if(!weekInput) return;

        if(!weekInput.value) {
            let d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            let yearStart = new Date(d.getFullYear(), 0, 1);
            let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            weekInput.value = d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
        }
        
        let weekVal = weekInput.value; 
        if(!weekVal) return;
        
        let parts = weekVal.split('-W'); let year = parseInt(parts[0]); let week = parseInt(parts[1]);
        let simple = new Date(year, 0, 1 + (week - 1) * 7); let dow = simple.getDay(); let ISOweekStart = simple;
        if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

        let weekDates = []; let offsets = [0, 1, 2, 3, 4, 5, 6]; 
        offsets.forEach(off => { let d = new Date(ISOweekStart.getTime()); d.setDate(d.getDate() + off); weekDates.push(d); });
        let friday = weekDates[4]; let refMonthStr = friday.getFullYear() + '-' + String(friday.getMonth() + 1).padStart(2, '0');
        
        let monthPresData = {};
        if(refMonthStr === currentPresMes) { monthPresData = livePresenca; } else {
            let presSnap = await dbFirebase.ref('shopee_presenca_live/' + refMonthStr).once('value'); monthPresData = presSnap.val() || {};
        }

        let daysInMonth = new Date(friday.getFullYear(), friday.getMonth() + 1, 0).getDate();
        let absMes = { sch: 0, abs: 0 }; let absSem = { sch: 0, abs: 0 }; let absDia = { sch: 0, abs: 0 };
        let diaChartAbs = []; let chartLabelsAbs = [];
        for(let d=1; d<=daysInMonth; d++) { diaChartAbs[d] = { sch: 0, abs: 0 }; chartLabelsAbs.push(d.toString()); }

        let weekDayNumbers = weekDates.filter(d => d.getMonth() === friday.getMonth()).map(d => d.getDate());
        let lastDayOfWeekNum = weekDayNumbers[weekDayNumbers.length - 1]; 

        for(let op in monthPresData) {
            for(let d=1; d<=daysInMonth; d++) {
                let st = monthPresData[op][d];
                if(st === 'P' || st === 'F' || st === 'AT') {
                    absMes.sch++; diaChartAbs[d].sch++;
                    let isAbs = (st === 'F' || st === 'AT');
                    if(isAbs) { absMes.abs++; diaChartAbs[d].abs++; }
                    if(weekDayNumbers.includes(d)) { absSem.sch++; if(isAbs) absSem.abs++; }
                    if(d === lastDayOfWeekNum) { absDia.sch++; if(isAbs) absDia.abs++; }
                }
            }
        }

        let percMes = absMes.sch > 0 ? (absMes.abs / absMes.sch * 100).toFixed(1) : "0.0";
        let percSem = absSem.sch > 0 ? (absSem.abs / absSem.sch * 100).toFixed(1) : "0.0";
        let percDia = absDia.sch > 0 ? (absDia.abs / absDia.sch * 100).toFixed(1) : "0.0";

        if(document.getElementById('sl-abs-mes')) {
            document.getElementById('sl-abs-mes').innerText = percMes + "%";
            document.getElementById('sl-abs-sem').innerText = percSem + "%";
            document.getElementById('sl-abs-dia').innerText = percDia + "%";
        }

        let dataAbsChart = [];
        for(let d=1; d<=daysInMonth; d++) { let val = diaChartAbs[d].sch > 0 ? (diaChartAbs[d].abs / diaChartAbs[d].sch * 100) : 0; dataAbsChart.push(val.toFixed(1)); }

        let weekData = historyDataCache[weekVal];
        let isWeekActiveTab = false;
        if(liveEscalaSemana && liveEscalaSemana['segunda'] && liveEscalaSemana['segunda'].dataDia) {
             let [dd, mm] = liveEscalaSemana['segunda'].dataDia.split('/');
             if(dd && mm) {
                 let wStart = weekDates[0];
                 if(parseInt(dd) === wStart.getDate() && parseInt(mm) === (wStart.getMonth() + 1)) { isWeekActiveTab = true; }
             }
        }

        if (!weekData && isWeekActiveTab) { weekData = liveEscalaSemana; } else if (!weekData) { weekData = {}; }

        let sumPhdSemana = 0; let countPhdSemana = 0; let lastPhdDia = 0;
        let chartLabelsPhd = []; let dataPhdChart = [];
        let lastDayName = "SEM DADOS"; let lastDayDate = "--/--";

        escDiasConf.forEach(dConf => {
            let p = weekData[dConf.id] ? parseFloat(weekData[dConf.id].phd) : 0;
            if(!isNaN(p) && p > 0) { 
                sumPhdSemana += p; countPhdSemana++; lastPhdDia = p; 
                lastDayName = dConf.nome.replace('ESCALA ', ''); 
                lastDayDate = weekData[dConf.id].dataDia || "--/--"; 
                chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(p); 
            } 
            else if(weekData[dConf.id]) { chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(0); }
        });

        let avgPhdSemana = countPhdSemana > 0 ? Math.round(sumPhdSemana / countPhdSemana) : 0;
        
        colorizePHD('sl-phd-dia', lastPhdDia);
        colorizePHD('sl-phd-sem', avgPhdSemana);

        let avgMesPHD = 0;
        try {
            let sumMesPHD = 0; let countMesPHD = 0;
            for(let wKey in historyDataCache) {
                let wObj = historyDataCache[wKey]; let belongsToMonth = false;
                for(let dia in wObj) {
                    if(wObj[dia] && wObj[dia].dataDia) { let [dd, mm] = wObj[dia].dataDia.split('/'); if(mm === refMonthStr.split('-')[1]) belongsToMonth = true; }
                }
                if(belongsToMonth) {
                    for(let dia in wObj) { let p = parseFloat(wObj[dia].phd) || 0; if(p > 0) { sumMesPHD += p; countMesPHD++; } }
                }
            }
            if(isWeekActiveTab && refMonthStr === currentPresMes) { sumMesPHD += sumPhdSemana; countMesPHD += countPhdSemana; }
            avgMesPHD = countMesPHD > 0 ? Math.round(sumMesPHD / countMesPHD) : 0; 
        } catch(e) { console.error("Erro PHD Mensal", e); }
        
        colorizePHD('sl-phd-mes', avgMesPHD);

        let percDiaPHD = globalMetaPHD > 0 ? ((lastPhdDia / globalMetaPHD) * 100).toFixed(1) : "0.0";
        let percSemPHD = globalMetaPHD > 0 ? ((avgPhdSemana / globalMetaPHD) * 100).toFixed(1) : "0.0";
        let percMesPHD = globalMetaPHD > 0 ? ((avgMesPHD / globalMetaPHD) * 100).toFixed(1) : "0.0";

        if(document.getElementById('sl-phd-dia-lbl')){
            document.getElementById('sl-phd-dia-lbl').innerText = `ÚLTIMO REGISTRO (${percDiaPHD}% DA META)`;
            document.getElementById('sl-phd-sem-lbl').innerText = `MÉDIA DA SEMANA (${percSemPHD}% DA META)`;
            document.getElementById('sl-phd-mes-lbl').innerText = `MÉDIA DO MÊS (${percMesPHD}% DA META)`;
        }

        // ==================================================
        // LABELS DE TEMPO E ANÁLISE DE GAP (BLINDADO)
        // ==================================================
        let elMetaDisplay = document.getElementById('sa-meta-display');
        if (elMetaDisplay) elMetaDisplay.innerText = globalMetaPHD;

        let elDiaData = document.getElementById('sa-dia-data');
        if (elDiaData) elDiaData.innerText = `REF: ${lastDayName} (${lastDayDate})`;
        let elSemData = document.getElementById('sa-sem-data');
        if (elSemData) elSemData.innerText = `REF: SEMANA ${week} DE ${year}`;
        let elMesData = document.getElementById('sa-mes-data');
        const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        if (elMesData) elMesData.innerText = `REF: ${monthNames[parseInt(refMonthStr.split('-')[1]) - 1] || 'MÊS'} DE ${refMonthStr.split('-')[0]}`;

        function updateGapCard(prefix, realized) {
            let elReal = document.getElementById(`sa-${prefix}-real`); 
            let elMeta = document.getElementById(`sa-${prefix}-meta`); 
            let elGap = document.getElementById(`sa-${prefix}-gap`); 
            let elStatus = document.getElementById(`sa-${prefix}-status`); 
            let elPerc = document.getElementById(`sa-${prefix}-perc`);
            
            if(!elReal) return;
            elReal.innerText = realized; elMeta.innerText = globalMetaPHD;
            let gap = realized - globalMetaPHD; let perc = globalMetaPHD > 0 ? ((realized / globalMetaPHD) * 100).toFixed(1) : 0;
            elPerc.innerText = `${perc}%`;
            
            if(realized === 0) {
                elGap.innerText = "-"; elGap.style.color = "var(--text-muted)";
                elStatus.innerText = "AGUARDANDO DADOS..."; elStatus.style.background = "rgba(255,255,255,0.05)"; elStatus.style.color = "var(--text-muted)";
            } else if (gap >= 0) {
                elGap.innerText = `+${gap}`; elGap.style.color = "var(--success)";
                elStatus.innerText = "META ATINGIDA / SUPERADA"; elStatus.style.background = "rgba(16, 185, 129, 0.1)"; elStatus.style.color = "var(--success)";
            } else {
                elGap.innerText = gap; elGap.style.color = "var(--danger)";
                elStatus.innerText = "ABAIXO DA META"; elStatus.style.background = "rgba(239, 68, 68, 0.1)"; elStatus.style.color = "var(--danger)";
            }
        }
        updateGapCard('dia', lastPhdDia); updateGapCard('sem', avgPhdSemana); updateGapCard('mes', avgMesPHD);

        // =========================================================================
        // RANK DE BIPAGEM AM (FILTRO EXATO DE DATAS)
        // =========================================================================
        
        let semTotals = {};
        let weekDatesStrArray = weekDates.map(d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        
        let latestDayWithDataStr = null;
        let latestDayVolMap = {};

        // Rastreia a semana e puxa a última data que tem dados como o "Diário", além de somar a Semana.
        weekDatesStrArray.forEach(dStr => {
            if (prodHistoryCache[dStr]) {
                latestDayWithDataStr = dStr;
                latestDayVolMap = prodHistoryCache[dStr];
                for(let op in prodHistoryCache[dStr]) {
                    semTotals[op] = (semTotals[op] || 0) + prodHistoryCache[dStr][op];
                }
            }
        });

        // Soma Mensal (Puxa do mês exato de referência)
        let mesTotals = {};
        for(let dStr in prodHistoryCache) {
            if (dStr.startsWith(refMonthStr)) { 
                for(let op in prodHistoryCache[dStr]) {
                    mesTotals[op] = (mesTotals[op] || 0) + prodHistoryCache[dStr][op];
                } 
            }
        }

        function getTop4(obj) {
            return Object.keys(obj).map(k => ({name: k, vol: obj[k]})).sort((a,b) => b.vol - a.vol).slice(0, 4);
        }

        let topDia = getTop4(latestDayVolMap);
        let topSem = getTop4(semTotals);
        let topMes = getTop4(mesTotals);

        function renderTopList(elementId, arr) {
            let el = document.getElementById(elementId);
            if(!el) return;
            if(arr.length === 0) { el.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding: 20px 0;">Sem dados importados no período.</div>'; return; }
            
            let html = '';
            arr.forEach((item, idx) => {
                let icon = ''; let color = '';
                if(idx===0) { icon = '🥇'; color = 'var(--gold)'; }
                else if(idx===1) { icon = '🥈'; color = 'var(--silver)'; }
                else if(idx===2) { icon = '🥉'; color = 'var(--bronze)'; }
                else { icon = '4º'; color = '#fff'; }
                
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                            <div style="font-size: 0.85rem; font-weight: 700; color: ${color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">
                                <span style="margin-right: 5px; font-size:1rem;">${icon}</span> ${item.name}
                            </div>
                            <div style="font-size: 0.95rem; color: var(--success); font-weight: 800;">${item.vol.toLocaleString('pt-BR')}</div>
                         </div>`;
            });
            el.innerHTML = html;
        }

        renderTopList('sa-top-dia-list', topDia);
        renderTopList('sa-top-sem-list', topSem);
        renderTopList('sa-top-mes-list', topMes);

        // Gráficos do Canvas
        const canvasPHD = document.getElementById('slChartPHD');
        if(canvasPHD) {
            const ctxPHD = canvasPHD.getContext('2d');
            if(window.slChartPHDInstance) window.slChartPHDInstance.destroy();
            window.slChartPHDInstance = new Chart(ctxPHD, {
                type: 'bar',
                data: { 
                    labels: chartLabelsPhd.length > 0 ? chartLabelsPhd : ['Nenhum dado'], 
                    datasets: [
                        { type: 'line', label: `Meta (${globalMetaPHD})`, data: chartLabelsPhd.map(() => globalMetaPHD), borderColor: '#fbbf24', borderWidth: 2, borderDash: [5, 5], fill: false, pointRadius: 0 },
                        { type: 'bar', label: 'PHD Atingido (Semana)', data: dataPhdChart.length > 0 ? dataPhdChart : [0], backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 4 }
                    ] 
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } }, plugins: { legend: { labels: { color: '#fff', font: { family: 'Outfit' } } } } }
            });
        }

        const canvasABS = document.getElementById('slChartABS');
        if(canvasABS) {
            const ctxABS = canvasABS.getContext('2d');
            if(window.slChartABSInstance) window.slChartABSInstance.destroy();
            window.slChartABSInstance = new Chart(ctxABS, {
                type: 'line',
                data: { labels: chartLabelsAbs, datasets: [{ label: 'Taxa de Absenteísmo % (Mês Referência: ' + refMonthStr + ')', data: dataAbsChart, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 3, tension: 0.3, fill: true }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8', maxTicksLimit: 15 }, grid: { display: false } } }, plugins: { legend: { labels: { color: '#fff', font: { family: 'Outfit' } } } } }
            });
        }
    } catch(err) {
        console.error("Sitelider error ignorado para proteger o sistema:", err);
    }
}

// =========================================================
// ESCUTADORES DA NUVEM MULTI-PC
// =========================================================
dbFirebase.ref('shopee_prod_history').on('value', snap => {
    prodHistoryCache = snap.val() || {};
    let el = document.getElementById('view-sitelider-analise');
    if(el && !el.classList.contains('hidden')) renderSiteliderDashboard();
});

dbFirebase.ref('shopee_meta_phd').on('value', snap => {
    if (snap.exists()) {
        globalMetaPHD = snap.val();
        let el = document.getElementById('meta-phd-input'); if (el) el.value = globalMetaPHD;
        let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise');
        if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard();
    }
});

dbFirebase.ref('shopee_colaboradores').on('value', snap => {
    if(snap.exists()) { operadoresList = Object.values(snap.val()).sort(); } 
    let elEsc = document.getElementById('view-escala'); if(elEsc && !elEsc.classList.contains('hidden')) renderEscalaSemana(); 
    let elDc = document.getElementById('view-escala-dc'); if(elDc && !elDc.classList.contains('hidden')) renderEscalaDcSemana(); 
    let elPres = document.getElementById('view-presenca'); if(elPres && !elPres.classList.contains('hidden')) renderPresencaGrid(); 
});

dbFirebase.ref('shopee_daily_live').on('value', (snapshot) => { 
    let data = snapshot.val(); dailyData = data ? (Array.isArray(data) ? data : Object.values(data)) : []; 
    let el = document.getElementById('view-dia'); if(el && !el.classList.contains('hidden')) renderDaily(); 
});

dbFirebase.ref('shopee_prod_live').on('value', (snapshot) => { 
    globalProdData = snapshot.val() || {}; 
    let el = document.getElementById('view-rankprod'); if(el && !el.classList.contains('hidden')) renderRankProd(); 
});

dbFirebase.ref('shopee_ctrl_live').on('value', snap => {
    ctrlData = snap.val() || initCtrl();
    let elCtrl = document.getElementById('view-ctrl'); if(elCtrl && !elCtrl.classList.contains('hidden')) renderControl();
    let elBi = document.getElementById('view-bi'); if(elBi && !elBi.classList.contains('hidden')) renderBIChart();
});

dbFirebase.ref('shopee_gold_db').on('value', snap => { 
    monthlyDataCache = snap.val() || {}; 
    let el = document.getElementById('view-mes'); if(el && !el.classList.contains('hidden')) renderMonthly(); 
});

dbFirebase.ref('shopee_escala_history').on('value', snap => {
    historyDataCache = snap.val() || {};
    let elH = document.getElementById('view-hist-escala'); if(elH && !elH.classList.contains('hidden')) renderHistEscala('lugares');
    let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise');
    if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard();
});

dbFirebase.ref('shopee_escala_dc_history').on('value', snap => {
    historyDcDataCache = snap.val() || {};
    let el = document.getElementById('view-hist-escala-dc'); if(el && !el.classList.contains('hidden')) renderHistEscala('dc');
});

dbFirebase.ref('shopee_escala_semana_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaSemana = data; else { liveEscalaSemana = {}; }
    let el = document.getElementById('view-escala'); if(el && !el.classList.contains('hidden')) renderEscalaSemana(); 
    let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise');
    if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard(); 
});

dbFirebase.ref('shopee_escala_dc_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaDcSemana = data; else { liveEscalaDcSemana = {}; } 
    let el = document.getElementById('view-escala-dc'); if(el && !el.classList.contains('hidden')) renderEscalaDcSemana(); 
});

dbFirebase.ref('shopee_prod_state').on('value', snap => {
    let state = snap.val();
    if(state) {
        if(document.getElementById('p-data')) {
            document.getElementById('p-data').value = state.data; document.getElementById('p-hora-ini').value = state.horaIni; document.getElementById('p-hora-fim').value = state.horaFim;
            document.getElementById('p-backlog').innerText = state.backlog; document.getElementById('p-xpt').innerText = state.xpt; document.getElementById('p-vol-rot').innerText = state.volRot;
            if(state.stations) {
                for(let j=1; j<=10; j++) { 
                    let sel = document.getElementById(`station-select-${j}`); 
                    if(sel && state.stations[j-1]) { if(Array.from(sel.options).some(o => o.value === state.stations[j-1])) sel.value = state.stations[j-1]; } 
                }
            }
            calculateProdTotals(false);
        }
    }
});

const dateObj = new Date(); currentPresMes = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0');
presencaListener = dbFirebase.ref('shopee_presenca_live/' + currentPresMes).on('value', snap => {
    livePresenca = snap.val() || {};
    let elP = document.getElementById('view-presenca'); if(elP && !elP.classList.contains('hidden')) renderPresencaGrid(); 
    let elEsc = document.getElementById('view-escala'); if(elEsc && !elEsc.classList.contains('hidden')) { if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); } }
    let elDc = document.getElementById('view-escala-dc'); if(elDc && !elDc.classList.contains('hidden')) { if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailabilityDc(d.id)); updateSidebarDc(); } }
    let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise'); if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard(); 
});

// =========================================================
// RENDERIZADOR E CHECK DE AUTENTICAÇÃO
// =========================================================
function checkSession() {
    const saved = localStorage.getItem('spxUser');
    if(saved) {
        const found = JSON.parse(saved); currentUser = found;
        document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex';
        document.getElementById('display-user').innerText = found.u.toUpperCase();
        if(found.r === 'admin') { document.body.classList.add('is-admin'); }
        initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; 
        switchTab('escala'); 
    }
}

function login() {
    const u = document.getElementById('user').value; const p = document.getElementById('pass').value;
    const found = USERS.find(x => x.u === u && x.p === p);
    if(found) {
        currentUser = found; localStorage.setItem('spxUser', JSON.stringify(found));
        document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex';
        document.getElementById('display-user').innerText = u.toUpperCase();
        if(found.r === 'admin') { document.body.classList.add('is-admin'); }
        initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; 
        switchTab('escala');
    } else { document.getElementById('login-err').style.display = 'block'; }
}

function logout() { localStorage.removeItem('spxUser'); location.reload(); }
window.onload = function() { checkSession(); let pw = document.getElementById('pass'); if(pw) pw.addEventListener('keypress', e => { if(e.key==='Enter') login(); }); };

function showToast(msg) { const t = document.getElementById('toast'); if(!t) return; t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function fmtTime(s) { const m = Math.floor(s/60); const sec = Math.round(s%60); return `${m}m ${sec}s`; }
function secToHHMMSS(s) { if(!s) return "00:00:00"; const h = Math.floor(s/3600).toString().padStart(2,'0'); const m = Math.floor((s%3600)/60).toString().padStart(2,'0'); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${h}:${m}:${sec}`; }
function excelDate(serial) { if(!serial) return "-"; const date = new Date((serial - 25569) * 86400 * 1000); return date.toLocaleDateString('pt-BR'); }
function fmtExcelTime(dec) { if(!dec) return "-"; let s = Math.round(dec * 86400); return secToHHMMSS(s).substring(0,5); }
function readExcelFile(file, parseDates = false) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = e => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: parseDates }); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header:1}); resolve(data); }; reader.readAsArrayBuffer(file); }); }

// =========================================================
// ESCALA DE PROCESSAMENTO: FUNÇÕES SECUNDÁRIAS E LIMPEZA
// =========================================================
function updateDatesFromWeek(inputId, tipo) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let inputEl = document.getElementById(inputId); if(!inputEl) return;
    const weekVal = inputEl.value; if (!weekVal) return;
    const parts = weekVal.split('-W'); if (parts.length !== 2) return;
    const year = parseInt(parts[0]); const week = parseInt(parts[1]);
    const monday = getDateOfISOWeek(week, year);

    const offsets = { 'segunda': 0, 'terca': 1, 'quarta': 2, 'quinta': 3, 'sexta': 4, 'sabado': 5, 'domingo': 6 };
    let objAlvo = tipo === 'lugares' ? liveEscalaSemana : liveEscalaDcSemana;

    for (let diaId in offsets) {
        if (!objAlvo[diaId]) objAlvo[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '', visible: false, grid: {} };
        let d = new Date(monday.getTime()); d.setDate(d.getDate() + offsets[diaId]);
        let dayStr = String(d.getDate()).padStart(2, '0'); let monthStr = String(d.getMonth() + 1).padStart(2, '0');
        objAlvo[diaId].dataDia = `${dayStr}/${monthStr}`;
    }
    let refDb = tipo === 'lugares' ? 'shopee_escala_semana_live' : 'shopee_escala_dc_live';
    dbFirebase.ref(refDb).set(objAlvo).then(() => { showToast("Datas preenchidas!"); });
}

function updateDropdownsAvailability(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let selectedValues = []; let absentees = getAbsenteesForDay(diaId, false);
    escRows.forEach((cargo, rIdx) => { escCols.forEach((col, cIdx) => { let el = document.getElementById(`esc-cell-${diaId}-${rIdx}-${cIdx}`); if (el && el.value) selectedValues.push(el.value); }); });
    escRows.forEach((cargo, rIdx) => { escCols.forEach((col, cIdx) => {
            let el = document.getElementById(`esc-cell-${diaId}-${rIdx}-${cIdx}`);
            if (el) { 
                Array.from(el.options).forEach(opt => { 
                    if (opt.value === "") return; 
                    let isUsedElsewhere = (selectedValues.includes(opt.value) && opt.value !== el.value);
                    let isAbsent = absentees.includes(opt.value);
                    if (isUsedElsewhere || isAbsent) { 
                        opt.disabled = true; opt.hidden = true; opt.style.display = 'none';      
                        if(isAbsent) opt.text = formatShortName(opt.value) + " (OFF)"; else opt.text = formatShortName(opt.value);
                    } else { 
                        opt.disabled = false; opt.hidden = false; opt.style.display = ''; opt.text = formatShortName(opt.value);
                    } 
                }); 
            }
        });
    });
}

function updateDropdownsAvailabilityDc(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let selectedValues = []; let absentees = getAbsenteesForDay(diaId, true);
    let prevAllocated = []; let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) { let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid; if (prevGrid) Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); }); }

    dcLayout.forEach(sec => { let slots = sec.rows * sec.cols; for(let i=0; i<slots; i++) { let el = document.getElementById(`esc-dc-cell-${diaId}-${sec.id}_${i}`); if (el && el.value) selectedValues.push(el.value); } });
    
    dcLayout.forEach(sec => {
        let slots = sec.rows * sec.cols;
        for(let i=0; i<slots; i++) {
            let el = document.getElementById(`esc-dc-cell-${diaId}-${sec.id}_${i}`);
            if (el) { 
                Array.from(el.options).forEach(opt => { 
                    if (opt.value === "") return; 
                    let isUsedElsewhere = (selectedValues.includes(opt.value) && opt.value !== el.value);
                    let isAbsent = absentees.includes(opt.value);
                    let usedYesterday = prevAllocated.includes(opt.value);
                    if (isUsedElsewhere || isAbsent || usedYesterday) { 
                        opt.disabled = true; opt.hidden = true; opt.style.display = 'none';      
                        let rText = isAbsent ? " (OFF)" : (usedYesterday ? " (ONTEM)" : "");
                        opt.text = formatShortName(opt.value) + rText;
                    } else { opt.disabled = false; opt.hidden = false; opt.style.display = ''; opt.text = formatShortName(opt.value); } 
                }); 
            }
        }
    });
}

function updateSidebar() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let container = document.getElementById('sidebar-names-list'); if (!container) return;
    let selectedValues = []; let absentees = getAbsenteesForDay(currentSidebarDay, false);
    escRows.forEach((cargo, rIdx) => { escCols.forEach((col, cIdx) => { let el = document.getElementById(`esc-cell-${currentSidebarDay}-${rIdx}-${cIdx}`); if (el && el.value) selectedValues.push(el.value); }); });

    let html = ''; let availableCount = 0;
    operadoresList.forEach(op => { 
        if (!selectedValues.includes(op) && !absentees.includes(op)) { 
            html += `<div class="sidebar-name-item"><div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-user"></i> ${op}</div><i class="fas fa-times" style="color:var(--danger); cursor:pointer; font-size:1rem; padding:0 5px;" onclick="removeCollaborator('${op}')" title="Desligar Colaborador"></i></div>`; 
            availableCount++; 
        } 
    });
    if(availableCount === 0) { html = `<div style="text-align:center; color: var(--success); font-weight: bold; margin-top: 20px; font-size: 1rem;"><i class="fas fa-check-circle"></i> Todos Alocados!</div>`; }
    container.innerHTML = html; let countEl = document.getElementById('sidebar-count'); if(countEl) countEl.innerText = `(${availableCount})`; 
    let sideSelect = document.getElementById('sidebar-day-select'); if(sideSelect) sideSelect.value = currentSidebarDay;
}

function updateSidebarDc() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let container = document.getElementById('sidebar-names-list-dc'); if (!container) return;
    let selectedValues = []; let absentees = getAbsenteesForDay(currentSidebarDcDay, true);
    let prevAllocated = []; let currentIdx = escDiasConf.findIndex(d => d.id === currentSidebarDcDay);
    if (currentIdx > 0) { let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid; if (prevGrid) Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); }); }

    dcLayout.forEach(sec => { let slots = sec.rows * sec.cols; for(let i=0; i<slots; i++) { let el = document.getElementById(`esc-dc-cell-${currentSidebarDcDay}-${sec.id}_${i}`); if (el && el.value) selectedValues.push(el.value); } });

    let html = ''; let availableCount = 0;
    operadoresList.forEach(op => { 
        if (!selectedValues.includes(op) && !absentees.includes(op) && !prevAllocated.includes(op)) { 
            html += `<div class="sidebar-name-item"><div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-user"></i> ${op}</div><i class="fas fa-times" style="color:var(--danger); cursor:pointer; font-size:1rem; padding:0 5px;" onclick="removeCollaborator('${op}')"></i></div>`; 
            availableCount++; 
        } 
    });
    if(availableCount === 0) { html = `<div style="text-align:center; color: var(--success); font-weight: bold; margin-top: 20px; font-size: 1rem;"><i class="fas fa-check-circle"></i> Todos Alocados ou Sem Efetivo!</div>`; }
    container.innerHTML = html; let countEl = document.getElementById('sidebar-count-dc'); if(countEl) countEl.innerText = `(${availableCount})`; 
    let sideSelect = document.getElementById('sidebar-day-select-dc'); if(sideSelect) sideSelect.value = currentSidebarDcDay;
}

function changeSidebarDay(tipo) { 
    if(tipo === 'lugares') { currentSidebarDay = document.getElementById('sidebar-day-select').value; updateSidebar(); }
    else { currentSidebarDcDay = document.getElementById('sidebar-day-select-dc').value; updateSidebarDc(); }
}

function toggleDayVisibility(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    if (!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaSemana[diaId].visible = !liveEscalaSemana[diaId].visible;
    dbFirebase.ref(`shopee_escala_semana_live/${diaId}/visible`).set(liveEscalaSemana[diaId].visible);
}

function toggleDayVisibilityDc(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    if (!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaDcSemana[diaId].visible = !liveEscalaDcSemana[diaId].visible;
    dbFirebase.ref(`shopee_escala_dc_live/${diaId}/visible`).set(liveEscalaDcSemana[diaId].visible);
}

function clearEscalaSemana() {
    if(confirm("Tem certeza que deseja limpar TODA a escala de Processamento?")) {
        let oldData = {...liveEscalaSemana}; liveEscalaSemana = {};
        escDiasConf.forEach(d => { let prevData = oldData[d.id] ? oldData[d.id].dataDia : '(inserir data)'; let prevVis = oldData[d.id] && oldData[d.id].visible !== undefined ? oldData[d.id].visible : false; liveEscalaSemana[d.id] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: prevData, visible: prevVis, grid: {} }; });
        dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Escala limpa com sucesso!"); }).catch(e => console.error(e));
    }
}

function clearEscalaDc() {
    if(confirm("Tem certeza que deseja limpar TODA a escala de Doblecheck?")) {
        let oldData = {...liveEscalaDcSemana}; liveEscalaDcSemana = {};
        escDiasConf.forEach(d => { let prevData = oldData[d.id] ? oldData[d.id].dataDia : '(inserir data)'; let prevVis = oldData[d.id] && oldData[d.id].visible !== undefined ? oldData[d.id].visible : false; liveEscalaDcSemana[d.id] = { dataDia: prevData, visible: prevVis, grid: {} }; });
        dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Escala DC limpa!"); }).catch(e => console.error(e));
    }
}

window.replicateMonday = function() {
    if(!confirm("Isso vai copiar a escala de SEGUNDA-FEIRA para todos os outros dias da semana. Deseja continuar?")) return;
    let baseGrid = liveEscalaSemana['segunda']?.grid;
    if(!baseGrid || Object.keys(baseGrid).length === 0) return showToast("A escala de Segunda está vazia!");
    escDiasConf.forEach((d, idx) => {
        if (idx === 0) return; let diaId = d.id;
        if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };
        let absentees = getAbsenteesForDay(diaId, false); let clonedGrid = {};
        for(let r in baseGrid) { clonedGrid[r] = {}; for(let c in baseGrid[r]) { let op = baseGrid[r][c]; if (op && !absentees.includes(op)) clonedGrid[r][c] = op; else clonedGrid[r][c] = ""; } }
        liveEscalaSemana[diaId].grid = clonedGrid;
    });
    dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Semana preenchida baseada na Segunda!"); });
};

function autoDistributeAllLugares() { if(confirm("Sortear a semana toda? Isso substituirá as vagas atuais.")) { escDiasConf.forEach(d => { autoDistributeOperators(d.id, false); }); dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Semana completa sorteada!"); }).catch(e => console.error(e)); } }
function autoDistributeAllDc() { if(confirm("Sortear a semana toda de DC? Lembre-se que quem rodar em um dia não roda no dia seguinte.")) { escDiasConf.forEach(d => { autoDistributeDc(d.id, false); }); dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Semana DC sorteada!"); }).catch(e => console.error(e)); } }

function autoDistributeOperators(diaId, autoSave = true) {
    if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaSemana[diaId].grid = {}; for(let r=0; r<escRows.length; r++) liveEscalaSemana[diaId].grid[r] = {};
    let lastRoles = {}; let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) { let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaSemana[prevDiaId]?.grid; if (prevGrid) escRows.forEach((cargo, rIdx) => { if (prevGrid[rIdx]) Object.values(prevGrid[rIdx]).forEach(op => { if(op) lastRoles[op] = rIdx; }); }); }
    let absentees = getAbsenteesForDay(diaId, false); let pool = operadoresList.filter(op => !absentees.includes(op)); pool.sort(() => Math.random() - 0.5); 
    for (let cIdx = 0; cIdx < escCols.length; cIdx++) {
        for (let rIdx = 0; rIdx < escRows.length; rIdx++) {
            if (pool.length === 0) break;
            const isMergedRow = (rIdx === 0 || rIdx === 3); const isSkipCol = (isMergedRow && (cIdx === 1 || cIdx === 3 || cIdx === 5 || cIdx === 7)); if (isSkipCol) continue;
            let foundIdx = pool.findIndex(op => lastRoles[op] !== rIdx); if (foundIdx === -1) foundIdx = 0; 
            let chosenOp = pool.splice(foundIdx, 1)[0]; liveEscalaSemana[diaId].grid[rIdx][cIdx] = chosenOp;
        }
        if(pool.length === 0) break;
    }
    if(autoSave) dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Sorteio feito para " + diaId.toUpperCase()); }).catch(e => console.error(e));
}

function autoDistributeDc(diaId, autoSave = true) {
    if(!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaDcSemana[diaId].grid = {};
    let prevAllocated = []; let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) { let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid; if (prevGrid) { Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); }); } }
    let absentees = getAbsenteesForDay(diaId, true); let pool = operadoresList.filter(op => !absentees.includes(op) && !prevAllocated.includes(op)); pool.sort(() => Math.random() - 0.5); 
    dcLayout.forEach(sec => { let slots = sec.rows * sec.cols; for(let i=0; i<slots; i++) { let cellId = `${sec.id}_${i}`; let chosenOp = pool.length > 0 ? pool.shift() : ""; liveEscalaDcSemana[diaId].grid[cellId] = chosenOp; } });
    if(autoSave) dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Sorteio DC feito para " + diaId.toUpperCase()); }).catch(e => console.error(e));
}

// =========================================================
// SALVAMENTO DE HISTÓRICO COM CONTAGEM DE DIAS TRABALHADOS
// =========================================================
async function archiveEscalaSemanal() {
    let dataInput = document.getElementById('hist-date-input').value; if(!dataInput) { showToast("Selecione a semana de referência no topo."); return; }
    showToast("Salvando Semana no Histórico...");
    let resumoDias = {};
    escDiasConf.forEach(diaConf => {
        let escDia = liveEscalaSemana[diaConf.id];
        if(escDia && escDia.grid) {
            escRows.forEach((cargo, rIdx) => {
                escCols.forEach((col, cIdx) => {
                    let op = escDia.grid[rIdx] ? escDia.grid[rIdx][cIdx] : null;
                    if(op) {
                        if(!resumoDias[op]) resumoDias[op] = { Total: 0 };
                        let roleName = `${cargo} - ${col.replace(' VOLUMOSO','')}`;
                        resumoDias[op][roleName] = (resumoDias[op][roleName] || 0) + 1;
                        resumoDias[op].Total += 1;
                    }
                });
            });
        }
    });
    liveEscalaSemana.resumoDias = resumoDias;
    try { await dbFirebase.ref('shopee_escala_history/' + dataInput).set(liveEscalaSemana); showToast("Semana Salva com Sucesso!"); } catch(e) { console.error(e); showToast("Erro."); }
}

async function archiveEscalaDc() {
    let dataInput = document.getElementById('hist-date-input-dc').value; if(!dataInput) { showToast("Selecione a semana de referência no topo."); return; }
    showToast("Salvando Semana DC...");
    let resumoDias = {};
    escDiasConf.forEach(diaConf => {
        let escDia = liveEscalaDcSemana[diaConf.id];
        if(escDia && escDia.grid) {
            dcLayout.forEach(sec => {
                let slots = sec.rows * sec.cols;
                for(let i=0; i<slots; i++) {
                    let op = escDia.grid[`${sec.id}_${i}`];
                    if(op) {
                        if(!resumoDias[op]) resumoDias[op] = { Total: 0 };
                        let roleName = sec.title;
                        resumoDias[op][roleName] = (resumoDias[op][roleName] || 0) + 1;
                        resumoDias[op].Total += 1;
                    }
                }
            });
        }
    });
    liveEscalaDcSemana.resumoDias = resumoDias;
    try { await dbFirebase.ref('shopee_escala_dc_history/' + dataInput).set(liveEscalaDcSemana); showToast("Semana Salva com Sucesso!"); } catch(e) { console.error(e); showToast("Erro."); }
}

function renderHistEscala(tipo) {
    let containerId = tipo === 'lugares' ? 'hist-escala-list' : 'hist-escala-dc-list';
    let cacheSource = tipo === 'lugares' ? historyDataCache : historyDcDataCache;
    const container = document.getElementById(containerId); if(!container) return;
    let keys = Object.keys(cacheSource).sort((a,b) => b.localeCompare(a)); 
    if(keys.length === 0) { container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">Nenhum histórico encontrado.</div>'; return; }
    container.innerHTML = '';
    
    keys.forEach((dateKey, index) => {
        const semanaData = cacheSource[dateKey];
        let displayWeek = dateKey; if(dateKey.includes('-W')) { let pts = dateKey.split('-W'); displayWeek = "Semana " + pts[1] + " de " + pts[0]; }

        let tableHtml = `<div class="hidden" id="hist-det-${tipo}-${index}" style="margin-top: 15px; border-top: 1px solid var(--glass-border); padding-top: 15px; overflow-x: auto;"><table class="hist-table"><tr><th>COLABORADOR</th>`;
        escDiasConf.forEach(diaConf => { let dData = semanaData[diaConf.id]?.dataDia || diaConf.nome.replace('ESCALA ', ''); tableHtml += `<th>${diaConf.nome.replace('ESCALA ', '')}<br><span style="font-size:9px; color:var(--text-muted)">${dData}</span></th>`; });
        tableHtml += `</tr>`;

        let workedOps = new Set();
        escDiasConf.forEach(d => { let grid = semanaData[d.id]?.grid; if(grid) { Object.values(grid).forEach(op => { if(typeof op === 'string' && op) workedOps.add(op); else if (typeof op === 'object') { Object.values(op).forEach(v => { if(v) workedOps.add(v); }); } }); } });
        let sortedOps = Array.from(workedOps).sort();

        if(sortedOps.length === 0) {
            tableHtml += `<tr><td colspan="7" style="color:var(--text-muted); font-size:10px;">Nenhum operador alocado.</td></tr>`;
        } else {
            sortedOps.forEach(op => {
                tableHtml += `<tr><td style="text-align:left; font-size:10px; font-weight:bold;">${op}</td>`;
                escDiasConf.forEach(d => {
                    let grid = semanaData[d.id]?.grid; let roleStr = "-";
                    if(grid) {
                        if(tipo === 'lugares') {
                            for(let r=0; r<escRows.length; r++) { if(grid[r]) { for(let c=0; c<escCols.length; c++) { if(grid[r][c] === op) { roleStr = `<span style="color:var(--primary); font-weight:800;">${escRows[r]}</span><br><span style="font-size:9px; color:var(--text-muted)">${escCols[c]}</span>`; } } } }
                        } else {
                            dcLayout.forEach(sec => { let slots = sec.rows * sec.cols; for(let i=0; i<slots; i++) { if(grid[`${sec.id}_${i}`] === op) { roleStr = `<span style="color:var(--primary); font-weight:800;">${sec.title}</span><br><span style="font-size:9px; color:var(--text-muted)">Vaga ${i+1}</span>`; } } });
                        }
                    }
                    tableHtml += `<td style="font-size:10px;">${roleStr}</td>`;
                });
                tableHtml += `</tr>`;
            });
        }
        
        let resumoHtml = '';
        if(semanaData.resumoDias) {
            resumoHtml = `<div style="background: rgba(0,0,0,0.1); padding: 15px; border-radius: 8px; margin-top: 15px;">
                          <h4 style="color:var(--primary); font-size: 0.9rem; margin-bottom: 10px;">Resumo de Atuação na Semana</h4>
                          <table class="hist-table">
                          <tr><th style="width: 30%;">Operador</th><th style="width: 15%;">Total Dias</th><th>Detalhamento</th></tr>`;
            Object.keys(semanaData.resumoDias).sort().forEach(op => {
                let data = semanaData.resumoDias[op];
                let details = Object.keys(data).filter(k => k !== 'Total').map(k => `<span style="color:var(--accent)">${k}:</span> <b>${data[k]}x</b>`).join(' | ');
                resumoHtml += `<tr><td style="text-align:left; font-weight:bold;">${op}</td><td>${data.Total}</td><td style="text-align:left; font-size:10px;">${details}</td></tr>`;
            });
            resumoHtml += `</table></div>`;
        }

        tableHtml += `</table> ${resumoHtml} </div>`;

        const div = document.createElement('div'); div.className = `stat-card`; div.style.padding = "20px"; div.style.marginBottom = "15px";
        let kpis = '';
        if(tipo === 'lugares') {
            let resumo = semanaData['segunda'] || {hc:'0', pct:'0', dw:'0'};
            kpis = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 15px;"><div class="si"><div class="si-l">Headcount (Segunda)</div><div class="si-v" style="font-size: 1.2rem;">${resumo.hc}</div></div><div class="si"><div class="si-l">Pct Proc. (Segunda)</div><div class="si-v" style="color:var(--success); font-size: 1.2rem;">${resumo.pct}</div></div><div class="si"><div class="si-l">Nec. DW (Segunda)</div><div class="si-v" style="color:var(--danger); font-size: 1.2rem;">${resumo.dw}</div></div></div>`;
        }
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px;"><div style="font-weight: 800; font-size: 1.2rem; color: var(--primary);"><i class="fas fa-calendar-week" style="margin-right: 8px;"></i> ${displayWeek}</div><button class="btn-ghost" style="padding: 6px 12px; font-size: 0.75rem;" onclick="document.getElementById('hist-det-${tipo}-${index}').classList.toggle('hidden')"><i class="fas fa-search"></i> Ver Relatório</button></div>${kpis}${tableHtml}`;
        container.appendChild(div);
    });
}
function clearEscalaHistory(tipo) {
    let desc = tipo === 'lugares' ? 'PROCESSAMENTO' : 'DOBLECHECK';
    let refNode = tipo === 'lugares' ? 'shopee_escala_history' : 'shopee_escala_dc_history';
    if(confirm(`ATENÇÃO: Deseja apagar permanentemente TODO o histórico de escalas ${desc}? Esta ação não pode ser desfeita.`)) {
        dbFirebase.ref(refNode).remove().then(() => { renderHistEscala(tipo); showToast("Histórico apagado!"); }).catch(e => console.error(e));
    }
}
function getDateOfISOWeek(w, y) { let simple = new Date(y, 0, 1 + (w - 1) * 7); let dow = simple.getDay(); let ISOweekStart = simple; if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay()); return ISOweekStart; }
function formatShortName(fullName) { if (!fullName) return ""; let p = fullName.split(/\s+/).filter(Boolean); if (p.length > 1) { return p[0] + " " + p[1]; } return p[0]; }
function getAbsenteesForDay(diaId, isDc = false) { let absentees = []; let objAlvo = isDc ? liveEscalaDcSemana : liveEscalaSemana; let escDia = objAlvo[diaId]; if(!escDia || !escDia.dataDia) return absentees; let match = escDia.dataDia.match(/(\d{1,2})/); if(match) { let day = parseInt(match[1]); for(let op in livePresenca) { if(livePresenca[op] && (livePresenca[op][day] === 'F' || livePresenca[op][day] === 'FG' || livePresenca[op][day] === 'AT')) { absentees.push(op); } } } return absentees; }
function addNewCollaborator(inputId) { const input = document.getElementById(inputId); if(!input) return; const name = input.value.trim().toUpperCase(); if(!name) return showToast("Digite o nome completo."); if(operadoresList.includes(name)) return showToast("Este colaborador já existe."); dbFirebase.ref('shopee_colaboradores/' + name).set(name).then(() => { input.value = ""; showToast("Colaborador cadastrado!"); }).catch(e => console.error(e)); }
function removeCollaborator(name) { if(confirm(`Deseja realmente desligar o colaborador ${name}?`)) { dbFirebase.ref('shopee_colaboradores/' + name).remove().then(() => { showToast("Colaborador removido!"); }).catch(e => console.error(e)); } }
function loadPresencaData() { renderPresencaGrid(); }

// =========================================================
// PUXAR NOMES DA ESCALA PARA A PRODUTIVIDADE (AUTO-FILL)
// =========================================================
let selectedShiftTemp = '';
function openShiftModal() { let el = document.getElementById('shift-modal-overlay'); if(el) el.classList.remove('hidden'); }
function closeShiftModal() { let el = document.getElementById('shift-modal-overlay'); if(el) el.classList.add('hidden'); }
function confirmShift(shift) { selectedShiftTemp = shift; let el = document.getElementById('shift-display'); if(el) el.innerText = "| TURNO: " + shift; closeShiftModal(); document.getElementById('file-prod').click(); }

window.autoFillStations = function() {
    try {
        let dateInput = document.getElementById('p-data');
        let dateVal = dateInput ? dateInput.value : '';
        if (!dateVal) { showToast("Preencha a Data primeiro!"); return; }

        let [y, m, d] = dateVal.split('-'); let dateObj = new Date(y, m - 1, d);
        let daysMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        let dayStr = daysMap[dateObj.getDay()];

        let escDia = liveEscalaSemana[dayStr];
        if (escDia && escDia.grid) {
            let bipadorRow = escDia.grid[1]; 
            let etiquetadorRow = escDia.grid[2]; 
            let changed = false;
            for (let i = 0; i < 10; i++) {
                let name = "";
                if (bipadorRow && bipadorRow[i]) name = bipadorRow[i];
                else if (etiquetadorRow && etiquetadorRow[i]) name = etiquetadorRow[i];

                if (name) {
                    let select = document.getElementById(`station-select-${i+1}`);
                    if (select) {
                        let exists = Array.from(select.options).some(opt => opt.value === name);
                        if (!exists) { select.innerHTML += `<option value="${name}">${name}</option>`; }
                        select.value = name; changed = true;
                    }
                }
            }
            if(changed) { refreshProdGridData(); saveProdState(); showToast("Nomes puxados da Escala com Sucesso!"); } 
            else { showToast("Nenhum Bipador/Etiquetador nesta data."); }
        } else { showToast("A Escala deste dia está vazia."); }
    } catch(e) { console.error("Erro no autoFill:", e); showToast("Erro ao ler escala."); }
};
