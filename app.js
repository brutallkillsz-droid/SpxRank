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
            let elDc = document.getElementById('view-escala-dc');
            if (elDc && !elDc.classList.contains('hidden')) saveEscalaDcToCloud();
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
    if(id==='escala') renderEscalaSemana(); 
    if(id==='escala-dc') renderEscalaDcSemana(); 
    if(id==='hist-escala') renderHistEscala('lugares');
    if(id==='hist-escala-dc') renderHistEscala('dc');
    if(id==='presenca') loadPresencaData(); 
    if(id==='bi') renderBIChart(); 
    if(id==='sitelider' || id==='sitelider-analise') renderSiteliderDashboard(); 
}

// =========================================================
// SALVAMENTO INDEPENDENTE POR CÉLULA (FIX DO ZERAMENTO)
// =========================================================
window.updateScaleField = function(diaId, field, element) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let valueText = element.innerText.trim();
    
    if(!liveEscalaSemana[diaId]) {
        liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '', visible: true, grid: {} };
    }
    
    liveEscalaSemana[diaId][field] = valueText;

    if(field === 'hc' || field === 'dw' || field === 'pct') {
        let hc = parseFloat(liveEscalaSemana[diaId].hc.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let dw = parseFloat(liveEscalaSemana[diaId].dw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let pct = parseFloat(liveEscalaSemana[diaId].pct.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        let totalEfetivo = hc + dw;
        let phdCalculado = totalEfetivo > 0 ? Math.round(pct / totalEfetivo) : 0;
        
        liveEscalaSemana[diaId].phd = phdCalculado.toString();
        let phdEl = document.getElementById(`esc-phd-${diaId}`);
        if(phdEl) phdEl.innerText = phdCalculado;
    }

    dbFirebase.ref(`shopee_escala_semana_live/${diaId}`).set(liveEscalaSemana[diaId]);
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

window.saveMetaPHD = function() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let inputEl = document.getElementById('meta-phd-input'); if(!inputEl) return;
    let val = parseInt(inputEl.value) || 530;
    dbFirebase.ref('shopee_meta_phd').set(val);
    showToast("Meta PHD atualizada!");
};

// =========================================================
// DASHBOARD SITELIDER & GAAPS
// =========================================================
function colorizePHD(elementId, value) {
    let el = document.getElementById(elementId); if(!el) return; el.innerText = value;
    if(value >= globalMetaPHD && value > 0) el.style.background = 'linear-gradient(to bottom, #fff, #10b981)';
    else if (value > 0) el.style.background = 'linear-gradient(to bottom, #fff, #ef4444)';
    else el.style.background = 'linear-gradient(to bottom, #fff, #3b82f6)';
    el.style.webkitBackgroundClip = 'text'; el.style.webkitTextFillColor = 'transparent';
}

async function renderSiteliderDashboard() {
    try {
        let weekInput = document.getElementById('sl-week-select'); if(!weekInput) return;
        if(!weekInput.value) {
            let d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            let yearStart = new Date(d.getFullYear(), 0, 1);
            let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            weekInput.value = d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
        }
        let weekVal = weekInput.value; if(!weekVal) return;
        let parts = weekVal.split('-W'); let year = parseInt(parts[0]); let week = parseInt(parts[1]);
        let simple = new Date(year, 0, 1 + (week - 1) * 7); let dow = simple.getDay(); let ISOweekStart = simple;
        if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

        let weekDates = []; let offsets = [0, 1, 2, 3, 4, 5, 6]; offsets.forEach(off => { let d = new Date(ISOweekStart.getTime()); d.setDate(d.getDate() + off); weekDates.push(d); });
        let friday = weekDates[4]; let refMonthStr = friday.getFullYear() + '-' + String(friday.getMonth() + 1).padStart(2, '0');
        
        let monthPresData = {}; if(refMonthStr === currentPresMes) { monthPresData = livePresenca; } else { let presSnap = await dbFirebase.ref('shopee_presenca_live/' + refMonthStr).once('value'); monthPresData = presSnap.val() || {}; }
        let daysInMonth = new Date(friday.getFullYear(), friday.getMonth() + 1, 0).getDate();
        let absMes = { sch: 0, abs: 0 }; let absSem = { sch: 0, abs: 0 }; let absDia = { sch: 0, abs: 0 };
        let diaChartAbs = []; let chartLabelsAbs = []; for(let d=1; d<=daysInMonth; d++) { diaChartAbs[d] = { sch: 0, abs: 0 }; chartLabelsAbs.push(d.toString()); }

        let weekDayNumbers = weekDates.filter(d => d.getMonth() === friday.getMonth()).map(d => d.getDate());
        let lastDayOfWeekNum = weekDayNumbers[weekDayNumbers.length - 1]; 

        for(let op in monthPresData) {
            for(let d=1; d<=daysInMonth; d++) {
                let st = monthPresData[op][d];
                if(st === 'P' || st === 'F' || st === 'AT') {
                    absMes.sch++; diaChartAbs[d].sch++; let isAbs = (st === 'F' || st === 'AT'); if(isAbs) { absMes.abs++; diaChartAbs[d].abs++; }
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

        let dataAbsChart = []; for(let d=1; d<=daysInMonth; d++) { let val = diaChartAbs[d].sch > 0 ? (diaChartAbs[d].abs / diaChartAbs[d].sch * 100) : 0; dataAbsChart.push(val.toFixed(1)); }
        let weekData = historyDataCache[weekVal]; let isWeekActiveTab = false;
        if(liveEscalaSemana && liveEscalaSemana['segunda'] && liveEscalaSemana['segunda'].dataDia) {
             let [dd, mm] = liveEscalaSemana['segunda'].dataDia.split('/');
             if(dd && mm) { let wStart = weekDates[0]; if(parseInt(dd) === wStart.getDate() && parseInt(mm) === (wStart.getMonth() + 1)) isWeekActiveTab = true; }
        }

        if (!weekData && isWeekActiveTab) { weekData = liveEscalaSemana; } else if (!weekData) { weekData = {}; }

        let sumPhdSemana = 0; let countPhdSemana = 0; let lastPhdDia = 0;
        let chartLabelsPhd = []; let dataPhdChart = []; let lastDayName = "SEM DADOS"; let lastDayDate = "--/--";

        escDiasConf.forEach(dConf => {
            let p = weekData[dConf.id] ? parseFloat(weekData[dConf.id].phd) : 0;
            if(!isNaN(p) && p > 0) { 
                sumPhdSemana += p; countPhdSemana++; lastPhdDia = p; lastDayName = dConf.nome.replace('ESCALA ', ''); lastDayDate = weekData[dConf.id].dataDia || "--/--"; 
                chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(p); 
            } else if(weekData[dConf.id]) { chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(0); }
        });

        let avgPhdSemana = countPhdSemana > 0 ? Math.round(sumPhdSemana / countPhdSemana) : 0;
        colorizePHD('sl-phd-dia', lastPhdDia); colorizePHD('sl-phd-sem', avgPhdSemana);

        let avgMesPHD = 0;
        try {
            let sumMesPHD = 0; let countMesPHD = 0;
            for(let wKey in historyDataCache) {
                let wObj = historyDataCache[wKey]; let belongsToMonth = false;
                for(let dia in wObj) { if(wObj[dia] && wObj[dia].dataDia) { let [dd, mm] = wObj[dia].dataDia.split('/'); if(mm === refMonthStr.split('-')[1]) belongsToMonth = true; } }
                if(belongsToMonth) { for(let dia in wObj) { let p = parseFloat(wObj[dia].phd) || 0; if(p > 0) { sumMesPHD += p; countMesPHD++; } } }
            }
            if(isWeekActiveTab && refMonthStr === currentPresMes) { sumMesPHD += sumPhdSemana; countMesPHD += countPhdSemana; }
            avgMesPHD = countMesPHD > 0 ? Math.round(sumMesPHD / countMesPHD) : 0; 
        } catch(e) { console.error(e); }
        colorizePHD('shopee-meta-phd', avgMesPHD);

        if(document.getElementById('sl-phd-dia-lbl')){
            document.getElementById('sl-phd-dia-lbl').innerText = `ÚLTIMO REGISTRO (${globalMetaPHD > 0 ? ((lastPhdDia / globalMetaPHD) * 100).toFixed(1) : 0}% DA META)`;
            document.getElementById('sl-phd-sem-lbl').innerText = `MÉDIA DA SEMANA (${globalMetaPHD > 0 ? ((avgPhdSemana / globalMetaPHD) * 100).toFixed(1) : 0}% DA META)`;
            document.getElementById('sl-phd-mes-lbl').innerText = `MÉDIA DO MÊS (${globalMetaPHD > 0 ? ((avgMesPHD / globalMetaPHD) * 100).toFixed(1) : 0}% DA META)`;
        }

        // GAP LABELS
        if (document.getElementById('sa-meta-display')) document.getElementById('sa-meta-display').innerText = globalMetaPHD;
        if (document.getElementById('sa-dia-data')) document.getElementById('sa-dia-data').innerText = `REF: ${lastDayName} (${lastDayDate})`;
        if (document.getElementById('sa-sem-data')) document.getElementById('sa-sem-data').innerText = `REF: SEMANA ${week} DE ${year}`;
        if (document.getElementById('sa-mes-data')) { const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]; document.getElementById('sa-mes-data').innerText = `REF: ${monthNames[parseInt(refMonthStr.split('-')[1]) - 1] || 'MÊS'} DE ${refMonthStr.split('-')[0]}`; }

        function updateGapCard(prefix, realized) {
            let elReal = document.getElementById(`sa-${prefix}-real`); let elMeta = document.getElementById(`sa-${prefix}-meta`); let elGap = document.getElementById(`sa-${prefix}-gap`); let elStatus = document.getElementById(`sa-${prefix}-status`); let elPerc = document.getElementById(`sa-${prefix}-perc`);
            if(!elReal) return; elReal.innerText = realized; elMeta.innerText = globalMetaPHD;
            let gap = realized - globalMetaPHD; let perc = globalMetaPHD > 0 ? ((realized / globalMetaPHD) * 100).toFixed(1) : 0; elPerc.innerText = `${perc}%`;
            if(realized === 0) { elGap.innerText = "-"; elGap.style.color = "var(--text-muted)"; elStatus.innerText = "AGUARDANDO DADOS..."; elStatus.style.background = "rgba(255,255,255,0.05)"; elStatus.style.color = "var(--text-muted)"; }
            else if (gap >= 0) { elGap.innerText = `+${gap}`; elGap.style.color = "var(--success)"; elStatus.innerText = "META ATINGIDA"; elStatus.style.background = "rgba(16, 185, 129, 0.1)"; elStatus.style.color = "var(--success)"; }
            else { elGap.innerText = gap; elGap.style.color = "var(--danger)"; elStatus.innerText = "ABAIXO DA META"; elStatus.style.background = "rgba(239, 68, 68, 0.1)"; elStatus.style.color = "var(--danger)"; }
        }
        updateGapCard('dia', lastPhdDia); updateGapCard('sem', avgPhdSemana); updateGapCard('mes', avgMesPHD);

        // =========================================================================
        // FIX COMPLETO: DISTRIBUIÇÃO DO RANK DE BIPAGEM AM ISOLADO POR DATAS EXATAS
        // =========================================================================
        let targetInputDate = document.getElementById('p-data')?.value || ''; 
        let latestDayVolMap = (targetInputDate && prodHistoryCache[targetInputDate]) ? prodHistoryCache[targetInputDate] : {};

        let semTotals = {};
        let weekDatesStrArray = weekDates.map(d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        weekDatesStrArray.forEach(dStr => { if (prodHistoryCache[dStr]) { for(let op in prodHistoryCache[dStr]) { semTotals[op] = (semTotals[op] || 0) + prodHistoryCache[dStr][op]; } } });

        let mesTotals = {}; for(let dStr in prodHistoryCache) { if (dStr.startsWith(refMonthStr)) { for(let op in prodHistoryCache[dStr]) { mesTotals[op] = (mesTotals[op] || 0) + prodHistoryCache[dStr][op]; } } }

        function getTop4(obj) { return Object.keys(obj).map(k => ({name: k, vol: obj[k]})).sort((a,b) => b.vol - a.vol).slice(0, 4); }
        let topDia = getTop4(latestDayVolMap); let topSem = getTop4(semTotals); let topMes = getTop4(mesTotals);

        function renderTopList(elementId, arr) {
            let el = document.getElementById(elementId); if(!el) return;
            if(arr.length === 0) { el.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding: 20px 0;">Sem dados importados no período.</div>'; return; }
            let html = '';
            arr.forEach((item, idx) => {
                let icon = idx===0 ? '🥇' : (idx===1 ? '🥈' : (idx===2 ? '🥉' : '4º'));
                let color = idx===0 ? 'var(--gold)' : (idx===1 ? 'var(--silver)' : (idx===2 ? 'var(--bronze)' : '#fff'));
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);"><div style="font-size: 0.85rem; font-weight: 700; color: ${color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;"><span style="margin-right: 5px;">${icon}</span> ${item.name}</div><div style="font-size: 0.95rem; color: var(--success); font-weight: 800;">${item.vol.toLocaleString('pt-BR')}</div></div>`;
            });
            el.innerHTML = html;
        }
        renderTopList('sa-top-dia-list', topDia); renderTopList('sa-top-sem-list', topSem); renderTopList('sa-top-mes-list', topMes);

        // Render Canvas charts safely
        let canvasPHD = document.getElementById('slChartPHD');
        if(canvasPHD) {
            let ctxPHD = canvasPHD.getContext('2d'); if(window.slChartPHDInstance) window.slChartPHDInstance.destroy();
            window.slChartPHDInstance = new Chart(ctxPHD, { type: 'bar', data: { labels: chartLabelsPhd.length > 0 ? chartLabelsPhd : ['Nenhum dado'], datasets: [ { type: 'line', label: `Meta (${globalMetaPHD})`, data: chartLabelsPhd.map(() => globalMetaPHD), borderColor: '#fbbf24', borderWidth: 2, borderDash: [5, 5], fill: false, pointRadius: 0 }, { type: 'bar', label: 'PHD Atingido', data: dataPhdChart.length > 0 ? dataPhdChart : [0], backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 4 } ] }, options: { responsive: true, maintainAspectRatio: false } });
        }
        let canvasABS = document.getElementById('slChartABS');
        if(canvasABS) {
            let ctxABS = canvasABS.getContext('2d'); if(window.slChartABSInstance) window.slChartABSInstance.destroy();
            window.slChartABSInstance = new Chart(ctxABS, { type: 'line', data: { labels: chartLabelsAbs, datasets: [{ label: 'Absenteísmo %', data: dataAbsChart, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false } });
        }
    } catch(err) { console.error(err); }
}

// =========================================================
// ESCUTADORES DA NUVEM MULTI-PC
// =========================================================
dbFirebase.ref('shopee_prod_history').on('value', snap => { prodHistoryCache = snap.val() || {}; let el = document.getElementById('view-sitelider-analise'); if(el && !el.classList.contains('hidden')) renderSiteliderDashboard(); });
dbFirebase.ref('shopee_meta_phd').on('value', snap => { if (snap.exists()) { globalMetaPHD = snap.val(); let el = document.getElementById('meta-phd-input'); if (el) el.value = globalMetaPHD; let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise'); if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard(); } });
dbFirebase.ref('shopee_colaboradores').on('value', snap => { if(snap.exists()) { operadoresList = Object.values(snap.val()).sort(); } let elEsc = document.getElementById('view-escala'); if(elEsc && !elEsc.classList.contains('hidden')) renderEscalaSemana(); let elDc = document.getElementById('view-escala-dc'); if(elDc && !elDc.classList.contains('hidden')) renderEscalaDcSemana(); let elPres = document.getElementById('view-presenca'); if(elPres && !elPres.classList.contains('hidden')) renderPresencaGrid(); });
dbFirebase.ref('shopee_daily_live').on('value', snap => { let data = snap.val(); dailyData = data ? (Array.isArray(data) ? data : Object.values(data)) : []; let el = document.getElementById('view-dia'); if(el && !el.classList.contains('hidden')) renderDaily(); });
dbFirebase.ref('shopee_prod_live').on('value', snap => { globalProdData = snap.val() || {}; let el = document.getElementById('view-rankprod'); if(el && !el.classList.contains('hidden')) renderRankProd(); });
dbFirebase.ref('shopee_ctrl_live').on('value', snap => { ctrlData = snap.val() || initCtrl(); let elCtrl = document.getElementById('view-ctrl'); if(elCtrl && !elCtrl.classList.contains('hidden')) renderControl(); let elBi = document.getElementById('view-bi'); if(elBi && !elBi.classList.contains('hidden')) renderBIChart(); });
dbFirebase.ref('shopee_gold_db').on('value', snap => { monthlyDataCache = snap.val() || {}; let el = document.getElementById('view-mes'); if(el && !el.classList.contains('hidden')) renderMonthly(); });
dbFirebase.ref('shopee_escala_history').on('value', snap => { historyDataCache = snap.val() || {}; let elH = document.getElementById('view-hist-escala'); if(elH && !elH.classList.contains('hidden')) renderHistEscala('lugares'); let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise'); if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard(); });
dbFirebase.ref('shopee_escala_dc_history').on('value', snap => { historyDcDataCache = snap.val() || {}; let el = document.getElementById('view-hist-escala-dc'); if(el && !el.classList.contains('hidden')) renderHistEscala('dc'); });

dbFirebase.ref('shopee_escala_semana_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaSemana = data; else initEmptyEscalaSemana(); 
    let el = document.getElementById('view-escala'); if(el && !el.classList.contains('hidden')) renderEscalaSemana(); 
    let v1 = document.getElementById('view-sitelider'); let v2 = document.getElementById('view-sitelider-analise');
    if((v1 && !v1.classList.contains('hidden')) || (v2 && !v2.classList.contains('hidden'))) renderSiteliderDashboard(); 
});

dbFirebase.ref('shopee_escala_dc_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaDcSemana = data; else initEmptyEscalaDcSemana(); 
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
// RENDERIZADOR DA NOVA METODOLOGIA DA ESCALA PROCESSAMENTO
// =========================================================
function renderEscalaSemana() {
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
                } else { html += `<td ${colspanAttr} class="esc-gray-light" style="color:#000; font-size: 9px; font-weight: 800;">${formatShortName(cellVal)}</td>`; }
            });
            html += `</tr>`;
        });
        html += `</table></div>`; container.innerHTML += html;
    });

    if (!isAdm && !renderedAny) container.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-muted); font-size: 1.2rem; font-weight: bold;">A Escala ainda não foi publicada.</div>';
    if(isAdm) { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); }
}

// =========================================================
// AUTO-FILL AUTOMATIZADO (PUXAR MOTOR DO AM)
// =========================================================
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

// =========================================================
// PREVENÇÃO DE QUEBRA DA GRADE H/H (RESTAURO TOTAL)
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

// =========================================================
// RESTANTE DO MOTOR OPERACIONAL ORIGINAL (INTOCADO)
// =========================================================
function checkSession() { const saved = localStorage.getItem('spxUser'); if(saved) { const found = JSON.parse(saved); currentUser = found; document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex'; document.getElementById('display-user').innerText = found.u.toUpperCase(); if(found.r === 'admin') { document.body.classList.add('is-admin'); } initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; switchTab('escala'); } }
function login() { const u = document.getElementById('user').value; const p = document.getElementById('pass').value; const found = USERS.find(x => x.u === u && x.p === p); if(found) { currentUser = found; localStorage.setItem('spxUser', JSON.stringify(found)); document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex'; document.getElementById('display-user').innerText = u.toUpperCase(); if(found.r === 'admin') { document.body.classList.add('is-admin'); } initProdGrid(); let pm = document.getElementById('pres-month-select'); if(pm) pm.value = currentPresMes; switchTab('escala'); } else { document.getElementById('login-err').style.display = 'block'; } }
function logout() { localStorage.removeItem('spxUser'); location.reload(); }
function showToast(msg) { const t = document.getElementById('toast'); if(!t) return; t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function fmtTime(s) { const m = Math.floor(s/60); const sec = Math.round(s%60); return `${m}m ${sec}s`; }
function secToHHMMSS(s) { if(!s) return "00:00:00"; const h = Math.floor(s/3600).toString().padStart(2,'0'); const m = Math.floor((s%3600)/60).toString().padStart(2,'0'); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${h}:${m}:${sec}`; }
function excelDate(serial) { if(!serial) return "-"; const date = new Date((serial - 25569) * 86400 * 1000); return date.toLocaleDateString('pt-BR'); }
function fmtExcelTime(dec) { if(!dec) return "-"; let s = Math.round(dec * 86400); return secToHHMMSS(s).substring(0,5); }
function readExcelFile(file, parseDates = false) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = e => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: parseDates }); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header:1}); resolve(data); }; reader.readAsArrayBuffer(file); }); }
