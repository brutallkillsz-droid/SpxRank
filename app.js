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

let isEscalaSemanaRendered = false;
let isEscalaDcSemanaRendered = false;

function initCtrl() { return { date: '', totalVol: 0, totalRotas: 0, minTime: null, maxTime: null, finRot: 0, finVol: 0, missRot: 0, missVol: 0, missingRot: 0, missingVol: 0, hourly: {}, sumDurHI: 0, countDurHI: 0 }; }

// =========================================================
// SIDEBAR MENU & NAVEGAÇÃO
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
        let hc = parseFloat(liveEscalaSemana[diaId].hc.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let dw = parseFloat(liveEscalaSemana[diaId].dw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let pct = parseFloat(liveEscalaSemana[diaId].pct.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
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
    updateDropdownsAvailabilityDc(diaId);
    updateSidebarDc();
};

window.saveMetaPHD = function() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let inputEl = document.getElementById('meta-phd-input'); if(!inputEl) return;
    let val = parseInt(inputEl.value) || 530;
    dbFirebase.ref('shopee_meta_phd').set(val);
    showToast("Meta PHD atualizada para " + val + "!");
};

// =========================================================
// DASHBOARD SITELIDER & ANÁLISE DE GAP REALTIME
// =========================================================
function colorizePHD(elementId, value) {
    let el = document.getElementById(elementId);
    if(!el) return;
    el.innerText = value;
    if(value >= globalMetaPHD && value > 0) {
        el.style.background = 'linear-gradient(to bottom, #fff, #10b981)';
    } else if (value > 0) {
        el.style.background = 'linear-gradient(to bottom, #fff, #ef4444)';
    } else {
        el.style.background = 'linear-gradient(to bottom, #fff, #3b82f6)';
    }
    el.style.webkitBackgroundClip = 'text';
    el.style.webkitTextFillColor = 'transparent';
}

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
        let targetInputDate = document.getElementById('p-data')?.value || ''; 
        let latestDayVolMap = {};
        if (targetInputDate && prodHistoryCache[targetInputDate]) {
            latestDayVolMap = prodHistoryCache[targetInputDate];
        }

        let semTotals = {};
        let weekDatesStrArray = weekDates.map(d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        weekDatesStrArray.forEach(dStr => {
            if (prodHistoryCache[dStr]) {
                for(let op in prodHistoryCache[dStr]) {
                    semTotals[op] = (semTotals[op] || 0) + prodHistoryCache[dStr][op];
                }
            }
        });

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
// RENDERIZADOR SUAVE DAS ESCALAS (FIM DO LAG E RESET)
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
    if(isEscalaSemanaRendered) {
        syncEscalaSemanaUI();
        return;
    }

    const container = document.getElementById('escala-semanal-container'); if(!container) return; container.innerHTML = '';
    const isAdm = currentUser && currentUser.r === 'admin'; 
    const editAttr = isAdm ? 'contenteditable="true"' : ''; 
    const editClass = isAdm ? 'editable-cell' : '';
    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaSemana[diaConf.id] || {hc:'0', pct:'0', cap:'0', dw:'0', phd:'0', capphd:'0', dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let prevDayName = index > 0 ? escDiasConf[index - 1].nome.replace('ESCALA ', '') : "";
        let btnCopiar = (isAdm && index > 0) ? `<button class="esc-day-btn" style="border-color: #3b82f6; color: #3b82f6;" onclick="copyFromPreviousDay('${diaConf.id}')"><i class="fas fa-copy"></i> Copiar Anter.</button>` : '';
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeOperators('${diaConf.id}')"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; 
        let btnEye = isAdm ? `<button class="${eyeClass}" onclick="toggleDayVisibility('${diaConf.id}')"><i class="fas fa-eye"></i> ${escDia.visible ? 'Visível' : 'Oculto'}</button>` : '';

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
    isEscalaSemanaRendered = true;
}

function syncEscalaDcUI() {
    const isAdm = currentUser && currentUser.r === 'admin';
    escDiasConf.forEach(diaConf => {
        let id = diaConf.id;
        let escDia = liveEscalaDcSemana[id] || {};
        let dtEl = document.getElementById(`esc-dc-datadia-${id}`); if(dtEl && document.activeElement !== dtEl) dtEl.innerText = escDia.dataDia || '(inserir data)';
        
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
    if(isEscalaDcSemanaRendered) {
        syncEscalaDcUI();
        return;
    }

    const container = document.getElementById('escala-dc-container'); if(!container) return; container.innerHTML = '';
    const isAdm = currentUser && currentUser.r === 'admin'; 
    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaDcSemana[diaConf.id] || { dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeDc('${diaConf.id}')"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; 
        let btnEye = isAdm ? `<button class="${eyeClass}" onclick="toggleDayVisibilityDc('${diaConf.id}')"><i class="fas fa-eye"></i> ${escDia.visible ? 'Visível' : 'Oculto'}</button>` : '';
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
    isEscalaDcSemanaRendered = true;
}

// =========================================================
// O RESTANTE DO SISTEMA (DEMAIS TELAS E LÓGICAS)
// =========================================================

function saveProdState() {
    if (!currentUser || currentUser.r !== 'admin') return;
    try {
        let dateVal = document.getElementById('p-data')?.value || '';
        let state = { data: dateVal, horaIni: document.getElementById('p-hora-ini')?.value || '', horaFim: document.getElementById('p-hora-fim')?.value || '', backlog: document.getElementById('p-backlog')?.innerText || '0', xpt: document.getElementById('p-xpt')?.innerText || '0', volRot: document.getElementById('p-vol-rot')?.innerText || '0', stations: [] };
        for(let j=1; j<=10; j++) { let sel = document.getElementById(`station-select-${j}`); state.stations.push(sel ? sel.value : ""); }
        dbFirebase.ref('shopee_prod_state').set(state);

        if (dateVal && Object.keys(globalProdData).length > 0) {
            let dailyTotals = {};
            for(let name in globalProdData) {
                let sum = 0; for(let h in globalProdData[name]) sum += globalProdData[name][h];
                if (sum > 0) dailyTotals[name] = sum;
            }
            dbFirebase.ref('shopee_prod_history/' + dateVal).set(dailyTotals);
        }
    } catch(e) { console.error(e); }
}

function checkSession() { const saved = localStorage.getItem('spxUser'); if(saved) { const found = JSON.parse(saved); currentUser = found; document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex'; document.getElementById('display-user').innerText = found.u.toUpperCase(); if(found.r === 'admin') { document.body.classList.add('is-admin'); } initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; switchTab('escala'); } }
function login() { const u = document.getElementById('user').value; const p = document.getElementById('pass').value; const found = USERS.find(x => x.u === u && x.p === p); if(found) { currentUser = found; localStorage.setItem('spxUser', JSON.stringify(found)); document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex'; document.getElementById('display-user').innerText = u.toUpperCase(); if(found.r === 'admin') { document.body.classList.add('is-admin'); } initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; switchTab('escala'); } else { document.getElementById('login-err').style.display = 'block'; } }
function logout() { localStorage.removeItem('spxUser'); location.reload(); }
function showToast(msg) { const t = document.getElementById('toast'); if(!t) return; t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function fmtTime(s) { const m = Math.floor(s/60); const sec = Math.round(s%60); return `${m}m ${sec}s`; }
function secToHHMMSS(s) { if(!s) return "00:00:00"; const h = Math.floor(s/3600).toString().padStart(2,'0'); const m = Math.floor((s%3600)/60).toString().padStart(2,'0'); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${h}:${m}:${sec}`; }
function excelDate(serial) { if(!serial) return "-"; const date = new Date((serial - 25569) * 86400 * 1000); return date.toLocaleDateString('pt-BR'); }
function fmtExcelTime(dec) { if(!dec) return "-"; let s = Math.round(dec * 86400); return secToHHMMSS(s).substring(0,5); }
function readExcelFile(file, parseDates = false) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = e => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: parseDates }); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header:1}); resolve(data); }; reader.readAsArrayBuffer(file); }); }

let selectedShiftTemp = '';
function openShiftModal() { let el = document.getElementById('shift-modal-overlay'); if(el) el.classList.remove('hidden'); }
function closeShiftModal() { let el = document.getElementById('shift-modal-overlay'); if(el) el.classList.add('hidden'); }
function confirmShift(shift) { selectedShiftTemp = shift; let el = document.getElementById('shift-display'); if(el) el.innerText = "| TURNO: " + shift; closeShiftModal(); document.getElementById('file-prod').click(); }

window.autoFillStations = function() {
    try {
        let dateVal = document.getElementById('p-data')?.value || '';
        if (!dateVal) { showToast("Preencha a Data primeiro!"); return; }
        let [y, m, d] = dateVal.split('-'); let dateObj = new Date(y, m - 1, d);
        let daysMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        let dayStr = daysMap[dateObj.getDay()];

        let escDia = liveEscalaSemana[dayStr];
        if (escDia && escDia.grid) {
            let bipadorRow = escDia.grid[1]; let etiquetadorRow = escDia.grid[2]; 
            let changed = false;
            for (let i = 0; i < 10; i++) {
                let name = "";
                if (bipadorRow && bipadorRow[i]) name = bipadorRow[i];
                else if (etiquetadorRow && etiquetadorRow[i]) name = etiquetadorRow[i];
                if (name) {
                    let select = document.getElementById(`station-select-${i+1}`);
                    if (select) {
                        if (!Array.from(select.options).some(opt => opt.value === name)) { select.innerHTML += `<option value="${name}">${name}</option>`; }
                        select.value = name; changed = true;
                    }
                }
            }
            if(changed) { refreshProdGridData(); saveProdState(); showToast("Estações alocadas pela Escala!"); }
            else { showToast("Nenhum Bipador alocado na escala deste dia."); }
        } else { showToast("A escala de processamento deste dia está vazia."); }
    } catch(e) { console.error(e); showToast("Erro ao sincronizar escala."); }
};

async function importProdData(input) {
    if(input.files.length === 0) return;
    try {
        const data = await readExcelFile(input.files[0], true); 
        if (!data || data.length === 0) { showToast("Arquivo vazio."); return; }
        
        globalProdData = {}; let headers = data[0] || []; let colHoursMap = {};
        let allowedHours = [];
        if (selectedShiftTemp === 'AM') { allowedHours = ['23:00', '00:00', '01:00', '02:00', '03:00', '04:00']; } 
        else if (selectedShiftTemp === 'PM') { allowedHours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']; }

        for (let c = 3; c < headers.length; c++) {
            let timeVal = headers[c]; if (timeVal === undefined || timeVal === null || timeVal === '') continue;
            let hourStr = null;
            if (timeVal instanceof Date) { hourStr = timeVal.getHours().toString().padStart(2, '0') + ":00"; } 
            else if (typeof timeVal === 'number') { let totalSeconds = Math.round((timeVal - Math.floor(timeVal)) * 86400); let h = Math.floor(totalSeconds / 3600); hourStr = h.toString().padStart(2, '0') + ":00"; } 
            else { let match = String(timeVal).match(/(?:^|\s)(\d{1,2}):/); if(match) hourStr = match[1].padStart(2, '0') + ":00"; }
            if (hourStr && (!selectedShiftTemp || allowedHours.includes(hourStr))) { colHoursMap[c] = hourStr; }
        }

        for(let i = 1; i < data.length; i++) {
            let row = data[i]; if(!row || !row[0]) continue; let rawName = String(row[0]); 
            let tempName = rawName.replace(/\[.*?\]/g, '').replace(/^(AT|OPS?)\s*-?\s*\d*\s*-?\s*/gi, '').replace(/^\d+\s*-?\s*/, '').trim().toUpperCase(); tempName = tempName.replace(/[.\#$\[\]\/]/g, '');
            let parts = tempName.split(/\s+/).filter(Boolean); let cleanName = "";
            if(parts.length > 1) { cleanName = parts[0] + " " + parts[1].charAt(0); } else if(parts.length === 1) { cleanName = parts[0]; }
            if (!cleanName) continue;
            
            let hasValidData = false;
            for (let c in colHoursMap) { let valStr = String(row[c] || '').replace(/[^\d.,]/g, '').replace(',', '.'); let val = parseFloat(valStr) || 0; if(val > 0) hasValidData = true; }
            if(!hasValidData) continue;

            if(!globalProdData[cleanName]) globalProdData[cleanName] = {};
            for (let c in colHoursMap) {
                let mappedHour = colHoursMap[c]; let valStr = String(row[c] || '').replace(/[^\d.,]/g, '').replace(',', '.'); let val = parseFloat(valStr) || 0; 
                globalProdData[cleanName][mappedHour] = (globalProdData[cleanName][mappedHour] || 0) + val;
            }
        }
        updateDropdowns(); 
        saveProdToCloud(); 
        showToast("Produtividade Processada!");
    } catch(e) { console.error(e); showToast("Erro."); }
}

function updateDropdowns() {
    let names = Object.keys(globalProdData).sort();
    for(let j = 1; j <= 10; j++) {
        let select = document.getElementById(`station-select-${j}`); 
        if(select) { 
            let currentVal = select.value; 
            select.style.maxWidth = "80px"; select.style.textOverflow = "ellipsis";
            select.innerHTML = `<option value="">Estação ${j}</option>`; 
            names.forEach(n => { select.innerHTML += `<option value="${n}">${n}</option>`; }); 
            if(names.includes(currentVal)) select.value = currentVal; 
        }
    }
    refreshProdGridData();
}

function refreshProdGridData() {
    for(let i = 0; i < 24; i++) {
        let hourCell = document.getElementById(`p-hour-${i}`); let rawHour = hourCell ? hourCell.innerText.trim() : '';
        let hourRef = null; let match = rawHour.match(/^(\d{1,2})(:\d{2})?/); if(match) { hourRef = match[1].padStart(2, '0') + ":00"; }
        for(let j = 1; j <= 10; j++) {
            let select = document.getElementById(`station-select-${j}`); let name = select ? select.value : ''; let val = 0;
            if(hourRef && name && globalProdData[name] && globalProdData[name][hourRef]) { val = globalProdData[name][hourRef]; }
            let cell = document.getElementById(`p-cell-${i}-${j}`); if(cell) cell.innerText = val || '';
        }
    }
    calculateProdTotals(true);
}

function calculateProdTotals(triggerSave = false) {
    let colTotals = [0,0,0,0,0,0,0,0,0,0]; let grandTotal = 0;
    for(let i = 0; i < 24; i++) {
        let rowTotal = 0; let hourCell = document.getElementById(`p-hour-${i}`); let rawHour = hourCell ? hourCell.innerText.trim() : '';
        let hourRef = null; let match = rawHour.match(/^(\d{1,2})(:\d{2})?/); if(match) hourRef = match[1].padStart(2, '0') + ":00";
        for(let j = 1; j <= 10; j++) {
            let cell = document.getElementById(`p-cell-${i}-${j}`); if(!cell) continue;
            let strVal = cell.innerText.replace(/[^\d.,]/g, '').replace(',', '.'); let val = parseFloat(strVal) || 0; rowTotal += val; colTotals[j-1] += val;
            let select = document.getElementById(`station-select-${j}`);
            if(select && triggerSave) { let name = select.value; if(name && hourRef) { if(!globalProdData[name]) globalProdData[name] = {}; globalProdData[name][hourRef] = val; } }
        }
        grandTotal += rowTotal; let rowTotalCell = document.getElementById(`p-row-total-${i}`); if(rowTotalCell) rowTotalCell.innerText = rowTotal > 0 ? rowTotal.toLocaleString('pt-BR') : '';
    }
    for(let j = 1; j <= 10; j++) { let colEl = document.getElementById(`p-col-total-${j}`); if(colEl) colEl.innerText = colTotals[j-1] || '0'; }
    let grandTotalCell = document.getElementById('p-grand-total'); if(grandTotalCell) grandTotalCell.innerText = grandTotal.toLocaleString('pt-BR');
    let volRotEl = document.getElementById('p-vol-rot'); let volRot = volRotEl ? (parseInt(volRotEl.innerText.replace(/\D/g, '')) || 0) : 0;
    let backlogEl = document.getElementById('p-backlog'); let backlog = backlogEl ? (parseInt(backlogEl.innerText.replace(/\D/g, '')) || 0) : 0;
    let xptEl = document.getElementById('p-xpt'); let xpt = xptEl ? (parseInt(xptEl.innerText.replace(/\D/g, '')) || 0) : 0;
    let totalAlvo = volRot; let qtdRealizada = grandTotal + backlog + xpt; 
    let pRealizada = document.getElementById('p-realizada'); if(pRealizada) pRealizada.innerText = qtdRealizada.toLocaleString('pt-BR');
    let pendente = totalAlvo - qtdRealizada; if(pendente < 0) pendente = 0; 
    let pPendente = document.getElementById('p-pendente'); if(pPendente) pPendente.innerText = pendente.toLocaleString('pt-BR');
    let percentEtiquetado = totalAlvo > 0 ? parseInt(((qtdRealizada / totalAlvo) * 100).toFixed(0)) : 0; if (percentEtiquetado > 100) percentEtiquetado = 100; 
    let percentPendente = totalAlvo > 0 ? parseInt(((pendente / totalAlvo) * 100).toFixed(0)) : 0; if (percentPendente < 0) percentPendente = 0; 
    let percEtiqEl = document.getElementById('p-perc-etiquetado'); if(percEtiqEl) percEtiqEl.innerText = percentEtiquetado + '%';
    let percPendEl = document.getElementById('p-perc-pendente'); if(percPendEl) percPendEl.innerText = percentPendente + '%';
    let giantPerc = document.getElementById('p-giant-percent');
    if(giantPerc) { giantPerc.innerText = percentEtiquetado + '%'; if (percentEtiquetado >= 97) giantPerc.style.color = '#00b050'; else giantPerc.style.color = '#ff0000'; }
    if(triggerSave) { saveProdToCloud(); renderRankProd(); saveProdState(); }
}

function initProdGrid() {
    const tbody = document.getElementById('prod-body-grid'); let html = '';
    for (let i = 0; i < 24; i++) {
        let h = (i === 0) ? 23 : i - 1; let hour = h.toString().padStart(2, '0') + ':00';
        html += `<tr><td style="border-left: 2px solid #000; font-weight: bold; background:#f0f8ff;" class="editable-cell" contenteditable="true" id="p-hour-${i}" onblur="refreshProdGridData(); saveProdState();">${hour}</td>`;
        for (let j = 1; j <= 10; j++) { html += `<td id="p-cell-${i}-${j}" class="editable-cell" contenteditable="true" onblur="calculateProdTotals(true)"></td>`; }
        html += `<td id="p-row-total-${i}" style="font-weight: bold; background: #e2e8f0; color: #0f172a;"></td>`;
        if (i === 0) { html += `<td rowspan="24" class="spx-percent-giant"><span class="spx-percent-text" id="p-giant-percent">0%</span></td>`; }
        html += `</tr>`;
    }
    html += `<tr class="spx-navy-prod"><td style="border-left: 2px solid #000; padding: 4px;">Total</td>`;
    for (let j = 1; j <= 10; j++) html += `<td style="color:#fff;" id="p-col-total-${j}">0</td>`;
    html += `<td style="color:#fff; font-weight: 900;" id="p-grand-total">0</td><td style="background:#fff; border:2px solid #000; border-top:none;"></td></tr>`;
    if(tbody) tbody.innerHTML = html;
}

window.onload = function() { checkSession(); let pw = document.getElementById('pass'); if(pw) pw.addEventListener('keypress', e => { if(e.key==='Enter') login(); }); };

async function handleSingleFile(input) {
    if(input.files.length === 0) return; dailyData = []; ctrlData = initCtrl();
    try { const data = await readExcelFile(input.files[0], false); processData([data], true); let el = document.getElementById('st-single'); if(el) el.innerText = "Carregado com sucesso!"; showToast("Importação Concluída"); } catch (e) { console.error(e); showToast("Erro."); }
}

async function handleMassFiles(input) {
    if(input.files.length === 0) return; dailyData = []; 
    try { const files = Array.from(input.files); const promises = files.map(f => readExcelFile(f, false)); const results = await Promise.all(promises); processData(results, false); let el = document.getElementById('st-mass'); if(el) el.innerText = `${files.length} Arquivos`; showToast("Importação em Massa Concluída"); } catch (e) { console.error(e); showToast("Erro."); }
}

function processData(allFilesData, isSingleImport) {
    try {
        const map = {};
        allFilesData.forEach(rows => {
            for(let i=1; i<rows.length; i++) {
                const r = rows[i]; let rawName = String(r[9] || ""); if(!rawName.trim()) continue;
                let tempName = rawName.replace(/\[.*?\]/g, '').replace(/^(AT|OPS?)\s*-?\s*\d*\s*-?\s*/gi, '').replace(/^\d+\s*-?\s*/, '').trim().toUpperCase(); tempName = tempName.replace(/[.\#$\[\]\/]/g, '');
                let parts = tempName.split(/\s+/).filter(Boolean); let cleanName = "";
                if(parts.length > 1) { cleanName = parts[0] + " " + parts[1].charAt(0); } else if(parts.length === 1) { cleanName = parts[0]; }
                if (!cleanName) continue;
                
                let volRank = parseFloat(String(r[3]||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0; 
                let volCtrl = parseFloat(String(r[2]||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0; 
                let volValid = parseFloat(String(r[4]||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0; 
                let valF = parseFloat(String(r[5]||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0; 
                let valG = parseFloat(String(r[6]||'').replace(/[^\d,-]/g,'').replace(',','.')) || 0; 
                let rec = parseFloat(String(r[11]||'').replace(',','.')) || 0;
                let tStart = r[7]; let tEnd = r[8]; let time = 0; 
                if(typeof tStart==='number' && typeof tEnd==='number') { let diff = tEnd - tStart; if(diff < 0) diff += 1; time = Math.round(diff * 86400); }
                
                if(!map[cleanName]) map[cleanName] = { nome: cleanName, rotas:0, vol:0, reconf:0, time:0, doblecheck: 0 };
                map[cleanName].rotas += 1; map[cleanName].vol += volRank; map[cleanName].time += time; map[cleanName].reconf += rec;
                
                if (isSingleImport) {
                    let status = String(r[12] || "").trim().toUpperCase(); 
                    if(!ctrlData.date && tStart) ctrlData.date = excelDate(tStart); ctrlData.totalVol += volCtrl; ctrlData.totalRotas++;
                    if(tStart) { if(ctrlData.minTime===null || tStart<ctrlData.minTime) ctrlData.minTime = tStart; }
                    if(tEnd) { if(ctrlData.maxTime===null || tEnd>ctrlData.maxTime) ctrlData.maxTime = tEnd; }
                    if(time > 0) { ctrlData.sumDurHI += time; ctrlData.countDurHI++; }
                    if(status === 'VALIDATED') { ctrlData.finRot++; ctrlData.finVol += volValid; if(valF > 0) { ctrlData.missRot++; ctrlData.missVol += valF; } if(valG > 0) { ctrlData.missingRot++; ctrlData.missingVol += valG; } }
                    if(typeof tStart === 'number') { let sDay = Math.round(tStart * 86400) % 86400; let h = Math.floor(sDay / 3600); let hStr = `${String(h).padStart(2,'0')}:00 - ${String(h+1).padStart(2,'0')}:00`; if(!ctrlData.hourly[hStr]) ctrlData.hourly[hStr] = {r:0, v:0}; ctrlData.hourly[hStr].r++; ctrlData.hourly[hStr].v += volCtrl; }
                }
            }
        });
        dailyData = Object.values(map); saveDailyToCloud(); renderDaily(); 
        if (isSingleImport && currentUser && currentUser.r === 'admin') dbFirebase.ref('shopee_ctrl_live').set(ctrlData);
    } catch(err) { console.error(err); }
}

function clearData() { dailyData=[]; ctrlData=initCtrl(); saveDailyToCloud(); if(currentUser && currentUser.r === 'admin') dbFirebase.ref('shopee_ctrl_live').set(ctrlData); let st1 = document.getElementById('st-single'); if(st1) st1.innerText="Selecionar CSV"; let st2 = document.getElementById('st-mass'); if(st2) st2.innerText="Múltiplos arquivos"; renderDaily(); renderControl(); showToast("Tela Limpa"); }

let currentDcName = ""; window.openDoblecheck = function(nome) { currentDcName = nome; let el = document.getElementById('dc-modal-driver-name'); if(el) el.innerText = "Motorista: " + nome; let m = document.getElementById('dc-modal-overlay'); if(m) m.classList.remove('hidden'); }; window.closeDcModal = function() { let m = document.getElementById('dc-modal-overlay'); if(m) m.classList.add('hidden'); }; window.applyDc = function(val) { let d = dailyData.find(x => x.nome === currentDcName); if(d) { d.doblecheck = val; saveDailyToCloud(); } closeDcModal(); };

function renderDaily() {
    const grid = document.getElementById('grid-diario'); if(!grid) return; grid.innerHTML = '';
    let safeData = Array.isArray(dailyData) ? dailyData : Object.values(dailyData || {});
    let sorted = safeData.map(d => { const avg = d.rotas>0 ? d.time/d.rotas : 0; let dc = d.doblecheck || 0; let totalErrosTela = d.reconf + dc; let errosAcuracidade = d.reconf + (dc * 5); let acur = d.vol > 0 ? ((d.vol - errosAcuracidade) / d.vol) * 100 : 100; if(acur < 0) acur = 0; return {...d, avg, acur, totalErrosTela}; }).sort((a,b) => (b.rotas-a.rotas) || (b.vol-a.vol));
    sorted.forEach((d, i) => {
        const pos = i+1; let css = ''; let icon = ''; if(pos===1) { css='rank-1'; icon='🥇'; } else if(pos===2) { css='rank-2'; icon='🥈'; } else if(pos===3) { css='rank-3'; icon='🥉'; }
        const div = document.createElement('div'); div.className = `stat-card ${css}`;
        let dcBtn = currentUser && currentUser.r === 'admin' ? `<button class="btn-ghost" style="padding: 6px; font-size: 0.65rem; width: 100%; border-color: var(--primary); color: var(--primary);" onclick="openDoblecheck('${d.nome}')"><i class="fas fa-edit"></i> DOBLECHECK ${d.doblecheck > 0 ? '('+d.doblecheck+')' : ''}</button>` : ``;
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"><div class="sc-name">${icon} ${d.nome}</div><div class="sc-rank r-txt">#${pos}</div></div><div class="sc-hero"><div class="sc-val">${d.rotas}</div><div class="sc-lbl">ROTAS CONCLUÍDAS</div></div><div class="sc-grid"><div class="si"><div class="si-l">Volume</div><div class="si-v">${d.vol}</div></div><div class="si"><div class="si-l">Acuracidade</div><div class="si-v" style="color:${d.acur>=99?'var(--success)':'var(--danger)'}">${d.acur.toFixed(2)}%</div></div><div class="si"><div class="si-l">Erros Totais</div><div class="si-v" style="color:${d.totalErrosTela>0?'var(--danger)':'#eee'}">${d.totalErrosTela}</div></div><div class="si" style="display:flex; align-items:flex-end;">${dcBtn}</div></div><div style="text-align:center; padding-top:15px; margin-top:15px; border-top: 1px solid rgba(255,255,255,0.05);"><div class="si-l">Tempo Médio: <span style="color:#fff; font-size: 0.85rem;">${fmtTime(d.avg)}</span></div></div>`;
        grid.appendChild(div);
    });
}

function renderControl() {
    const d = ctrlData; const el = (id)=>document.getElementById(id); if(!el('c-data')) return;
    el('c-data').innerText = d.date || "-"; el('c-vol').innerText = d.totalVol; el('c-rotas').innerText = d.totalRotas; el('c-ini').innerText = fmtExcelTime(d.minTime); el('c-fim').innerText = fmtExcelTime(d.maxTime);
    let durSec = 0; if(d.minTime && d.maxTime) durSec = Math.round((d.maxTime - d.minTime)*86400); el('c-dur').innerText = secToHHMMSS(durSec);
    let avgHI = d.countDurHI>0 ? d.sumDurHI/d.countDurHI : 0; el('c-avg-time').innerText = secToHHMMSS(avgHI);
    let total = d.totalVol; let finPerc = total>0 ? (d.finVol/total)*100 : 0; let pendPerc = total>0 ? (100 - finPerc) : 0; let pendRot = d.totalRotas - d.finRot; let pendVol = d.totalVol - d.finVol;
    el('c-fin-rot').innerText = d.finRot; el('c-fin-vol').innerText = d.finVol; el('c-fin-perc').innerText = finPerc.toFixed(2).replace('.',',') + "%";
    el('c-pen-rot').innerText = pendRot; el('c-pen-vol').innerText = pendVol; el('c-pen-perc').innerText = pendPerc.toFixed(2).replace('.',',') + "%";
    const tbody = document.getElementById('c-hourly-body'); if(tbody) { tbody.innerHTML = ''; Object.keys(d.hourly).sort().forEach(h => { tbody.innerHTML += `<tr><td>${h}</td><td style="text-align:center">${d.hourly[h].r}</td><td style="text-align:center">${d.hourly[h].v}</td></tr>`; }); }
}

async function saveToMonthly() {
    if(dailyData.length===0) return showToast("Sem dados."); showToast("Salvando na Nuvem...");
    try { let db = {...monthlyDataCache}; dailyData.forEach(d => { const k = d.nome; if(!db[k]) db[k] = {nome:k, rotas:0, vol:0, reconf:0, time:0, doblecheck:0}; db[k].rotas += d.rotas; db[k].vol += d.vol; db[k].reconf += d.reconf; db[k].doblecheck = (db[k].doblecheck || 0) + (d.doblecheck || 0); db[k].time += d.time; }); await dbFirebase.ref('shopee_gold_db').set(db); showToast("Arquivado!"); } catch(e) { console.error(e); }
}

function renderMonthly() {
    const container = document.getElementById('monthly-list'); if(!container) return;
    let list = Object.values(monthlyDataCache).map(d => { let dc = d.doblecheck || 0; let totalErrosTela = d.reconf + dc; let errosAcuracidade = d.reconf + (dc * 5); let acur = d.vol > 0 ? ((d.vol - errosAcuracidade) / d.vol) * 100 : 100; if(acur < 0) acur = 0; let avg = d.rotas > 0 ? d.time / d.rotas : 0; return {...d, acur, avg, totalErrosTela}; }).sort((a,b) => (b.rotas-a.rotas) || (b.vol-a.vol));
    container.innerHTML = '';
    if(list.length===0) { container.innerHTML = '<div style="text-align:center;color:#666;padding:40px">Histórico Vazio</div>'; return; }
    list.forEach((d, i) => {
        const pos = i+1; let css = ''; let icon = ''; if(pos===1) { css='mr-1'; icon='🥇'; } else if(pos===2) { css='rank-2'; icon='🥈'; } else if(pos===3) { css='rank-3'; icon='🥉'; }
        const div = document.createElement('div'); div.className = `stat-card m-row ${css}`; div.style.padding = "15px 30px";
        div.innerHTML = `<div class="m-idx">#${pos}</div><div style="font-weight:700;display:flex;gap:10px;align-items:center; color:#fff;">${icon} ${d.nome}</div><div class="m-stat"><div class="ms-l">Rotas</div><div class="ms-v">${d.rotas}</div></div><div class="m-stat"><div class="ms-l">Vol Total</div><div class="ms-v">${d.vol}</div></div><div class="m-stat"><div class="ms-l">Erros Totais</div><div class="ms-v" style="color:${d.totalErrosTela>0?'var(--danger)':'inherit'}">${d.totalErrosTela}</div></div><div class="m-stat"><div class="ms-l">Acuracidade Global</div><div class="ms-v" style="color:${d.acur>=99?'var(--success)':'var(--danger)'}">${d.acur.toFixed(2)}%</div></div><div class="m-stat"><div class="ms-l">T. Médio Global</div><div class="ms-v">${fmtTime(d.avg)}</div></div>`;
        container.appendChild(div);
    });
}
async function resetMonthly() { if(confirm("Apagar o histórico MENSAL?")) { await dbFirebase.ref('shopee_gold_db').remove(); showToast("Apagado!"); } }

function renderRankProd() {
    const listContainer = document.getElementById('rankprod-list'); if(!listContainer) return; listContainer.innerHTML = '';
    let arr = Object.keys(globalProdData).map(name => { let sum = 0; for(let h in globalProdData[name]) sum += globalProdData[name][h]; return { name, vol: sum }; }).sort((a,b) => b.vol - a.vol);
    if(arr.length===0) { listContainer.innerHTML = '<div style="text-align:center;color:#666;padding:40px">Aguardando Importação...</div>'; return; }
    arr.forEach((d, i) => { listContainer.innerHTML += `<div class="stat-card m-row" style="margin-bottom:10px; padding:15px 30px;"><div class="m-idx">#${i+1}</div><div style="font-weight:700; color:#fff;">${d.name}</div><div class="m-stat"><div class="ms-l">Total Bipado (AM)</div><div class="ms-v" style="color:var(--success); font-weight:800;">${d.vol.toLocaleString('pt-BR')} pacotes</div></div></div>`; });
}

async function renderBIChart() {
    const canvas = document.getElementById('biChartCanvas'); if(!canvas) return; const ctx = canvas.getContext('2d');
    let hours = Object.keys(ctrlData.hourly).sort(); let labels = hours.length > 0 ? hours : ['Sem Dados']; let volumes = hours.length > 0 ? hours.map(h => ctrlData.hourly[h].v) : [0]; let rotas = hours.length > 0 ? hours.map(h => ctrlData.hourly[h].r) : [0];
    if(window.biChartInstance) window.biChartInstance.destroy();
    window.biChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Volume', data: volumes, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6, yAxisID: 'y' }, { label: 'Rotas', data: rotas, type: 'line', borderColor: '#fbbf24', backgroundColor: '#fbbf24', borderWidth: 3, tension: 0.4, yAxisID: 'y1' } ] }, options: { responsive: true, maintainAspectRatio: false } });
}

// INICIALIZADORES E LISTENERS
initProdGrid();
