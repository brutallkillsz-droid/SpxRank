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
    { id: 'quarta', nome: 'ESCALA QUARTA', bg: '#c2deb0', cor: '#000' },
    { id: 'quinta', nome: 'ESCALA QUINTA', bg: '#ff9900', cor: '#000' },
    { id: 'sexta', nome: 'ESCALA SEXTA', bg: '#8ea9db', cor: '#000' },
    { id: 'sabado', nome: 'ESCALA SÁBADO', bg: '#ffe699', cor: '#000' },
    { id: 'domingo', nome: 'ESCALA DOMINGO', bg: '#f4b084', cor: '#000' },
    { id: 'segunda', nome: 'ESCALA SEGUNDA', bg: '#5c6e85', cor: '#fff' } 
];

const escRows = ['ABASTECEDOR', 'BIPADOR', 'ETIQUETADOR', 'SORTING MESA', 'SORTING RUAS'];
const escCols = ['Mesa1', 'Mesa2', 'Mesa3', 'Mesa4', 'Mesa5', 'Mesa6', 'Mesa7', 'Mesa8', 'Mesa9 VOLUMOSO', 'HANDOVER', 'Gaioleiro 1 pct', 'MESA XPT'];

const dcLayout = [
    { id: 'dc', title: 'DOBLE CHECK', rows: 3, cols: 4 },
    { id: 'trat', title: 'TRATATIVAS DE ETIQUETAGEM', rows: 1, cols: 4 },
    { id: 'alim', title: 'ALIMENTAR MESAS (MOVIMENTAR GAIOLAS)', rows: 1, cols: 4 }
];

let operadoresList = []; 
let defaultOperadores = [
    "ANA CARLA TEIXEIRA DE JESUS REIS", "ANA CLAUDIA DAIBERT TOSTA", "AURIETE DE JESUS SALES DOS SANTOS",
    "EDUARDO MARTINS RAMALHO DOS SANTOS", "EDUARDO ROMARIO DE OLIVEIRA SILVA", "JEAN RODRIGUES FERREIRA SOUSA",
    "JOSENICE MARINHO DO NASCIMENTO", "KAIQUE SILVA FERREIRA", "LUCAS VINICIUS DOS SANTOS",
    "MARCELO APOLINARIO DE ALMEIDA", "OTAVIO JUNIO FERREIRA FREITAS", "REGIELI FELIPE SILVA",
    "RIAN AUGUSTO DE CASTRO LEAL", "SOLANGE DE JESUS CAMPOS", "THAYNARA GONCALVES RIBEIRO",
    "VITORIA VILACA MARRA", "GIOVANNA CARVALHO LOPES GONCALVES", "VITORIA CRISTIAN SILVA",
    "MARCELA DA SILVA FARIA", "PEDRO ERICK FERREIRA MEDEIROS", "MATHEUS OTONI AVILA VELASCO",
    "NYCOLLAS DERIK LISBOA GOMES", "EMANNUEL MARTINS MOREIRA", "PETHALLA ELIZABETH ANDIRA DAGMAR VIEIRA SILVA",
    "RIZONEIDE ALVES DE SOUZA", "LAIANE FERREIRA DE SOUZA", "THAYNA BEATRIZ CARVALHO VERGINIO",
    "WILLIAM RESENDE DOS SANTOS", "VICTOR HENRIQUE FERNANDES FREITAS", "IGOR HENRIQUE MATHEUS",
    "ALAN HIDE NITTA", "ALICE ANA LAURA SILVA", "CAUA HENRIQUE ALVES PEREIRA",
    "IDYANARA COSTA DE PAULA", "YASMIN SILVA NASCIMENTO", "CLEDSSA CARLA MARTINS DOS SANTOS"
];

let liveEscalaSemana = {};
let currentSidebarDay = 'quarta';

let liveEscalaDcSemana = {};
let currentSidebarDcDay = 'quarta';

let livePresenca = {};
let currentPresMes = ""; 
let presencaListener = null;
let activePresColab = '';
let activePresDia = '';

let historyDataCache = {};
let historyDcDataCache = {};
let monthlyDataCache = {};

function initCtrl() { return { date: '', totalVol: 0, totalRotas: 0, minTime: null, maxTime: null, finRot: 0, finVol: 0, missRot: 0, missVol: 0, missingRot: 0, missingVol: 0, hourly: {}, sumDurHI: 0, countDurHI: 0 }; }

// =========================================================
// SIDEBAR MENU & NAVEGAÇÃO
// =========================================================
function toggleMenu(menuId, headerEl) {
    document.getElementById(menuId).classList.toggle('open');
    headerEl.classList.toggle('open');
}

function switchTab(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    document.getElementById('view-'+id).classList.remove('hidden');
    
    const btn = document.getElementById('btn-'+id);
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
    if(id==='sitelider') renderSiteliderDashboard(); 
}

// =========================================================
// DASHBOARD SITELIDER
// =========================================================
async function renderSiteliderDashboard() {
    let weekInput = document.getElementById('sl-week-select');
    if(!weekInput.value) {
        let d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        let yearStart = new Date(d.getFullYear(), 0, 1);
        let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        weekInput.value = d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
    }
    
    let weekVal = weekInput.value; let parts = weekVal.split('-W'); let year = parseInt(parts[0]); let week = parseInt(parts[1]);
    let simple = new Date(year, 0, 1 + (week - 1) * 7); let dow = simple.getDay(); let ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

    let weekDates = []; let offsets = [2, 3, 4, 5, 6, 7]; 
    offsets.forEach(off => { let d = new Date(ISOweekStart.getTime()); d.setDate(d.getDate() + off); weekDates.push(d); });
    let friday = weekDates[2]; let refMonthStr = friday.getFullYear() + '-' + String(friday.getMonth() + 1).padStart(2, '0');
    
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

    document.getElementById('sl-abs-mes').innerText = percMes + "%";
    document.getElementById('sl-abs-sem').innerText = percSem + "%";
    document.getElementById('sl-abs-dia').innerText = percDia + "%";

    let dataAbsChart = [];
    for(let d=1; d<=daysInMonth; d++) { let val = diaChartAbs[d].sch > 0 ? (diaChartAbs[d].abs / diaChartAbs[d].sch * 100) : 0; dataAbsChart.push(val.toFixed(1)); }

    let weekData = historyDataCache[weekVal];
    let isWeekActiveTab = false;
    if(liveEscalaSemana && liveEscalaSemana['quarta'] && liveEscalaSemana['quarta'].dataDia) {
         let [dd, mm] = liveEscalaSemana['quarta'].dataDia.split('/');
         if(dd && mm) {
             let wStart = weekDates[0];
             if(parseInt(dd) === wStart.getDate() && parseInt(mm) === (wStart.getMonth() + 1)) { isWeekActiveTab = true; }
         }
    }

    if (!weekData && isWeekActiveTab) { weekData = liveEscalaSemana; } else if (!weekData) { weekData = {}; }

    let sumPhdSemana = 0; let countPhdSemana = 0; let lastPhdDia = 0;
    let chartLabelsPhd = []; let dataPhdChart = [];

    escDiasConf.forEach(dConf => {
        let p = weekData[dConf.id] ? parseFloat(weekData[dConf.id].phd) : 0;
        if(!isNaN(p) && p > 0) { sumPhdSemana += p; countPhdSemana++; lastPhdDia = p; chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(p); } 
        else if(weekData[dConf.id]) { chartLabelsPhd.push(dConf.nome.replace('ESCALA ', '')); dataPhdChart.push(0); }
    });

    let avgPhdSemana = countPhdSemana > 0 ? Math.round(sumPhdSemana / countPhdSemana) : 0;
    document.getElementById('sl-phd-dia').innerText = lastPhdDia;
    document.getElementById('sl-phd-sem').innerText = avgPhdSemana;

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
        let avgMesPHD = countMesPHD > 0 ? Math.round(sumMesPHD / countMesPHD) : 0; document.getElementById('sl-phd-mes').innerText = avgMesPHD;
    } catch(e) { console.error("Erro PHD Mensal", e); }

    const ctxPHD = document.getElementById('slChartPHD').getContext('2d');
    if(window.slChartPHDInstance) window.slChartPHDInstance.destroy();
    window.slChartPHDInstance = new Chart(ctxPHD, {
        type: 'bar',
        data: { labels: chartLabelsPhd.length > 0 ? chartLabelsPhd : ['Nenhum dado'], datasets: [{ label: 'PHD Atingido (Semana Selecionada)', data: dataPhdChart.length > 0 ? dataPhdChart : [0], backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } }, plugins: { legend: { labels: { color: '#fff', font: { family: 'Outfit' } } } } }
    });

    const ctxABS = document.getElementById('slChartABS').getContext('2d');
    if(window.slChartABSInstance) window.slChartABSInstance.destroy();
    window.slChartABSInstance = new Chart(ctxABS, {
        type: 'line',
        data: { labels: chartLabelsAbs, datasets: [{ label: 'Taxa de Absenteísmo % (Mês Referência: ' + refMonthStr + ')', data: dataAbsChart, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 3, tension: 0.3, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8', maxTicksLimit: 15 }, grid: { display: false } } }, plugins: { legend: { labels: { color: '#fff', font: { family: 'Outfit' } } } } }
    });
}

// =========================================================
// ESCUTADORES DA NUVEM MULTI-PC
// =========================================================

dbFirebase.ref('shopee_colaboradores').on('value', snap => {
    if(snap.exists()) { operadoresList = Object.values(snap.val()).sort(); } 
    else { let initialDb = {}; defaultOperadores.forEach(op => initialDb[op] = op); dbFirebase.ref('shopee_colaboradores').set(initialDb); operadoresList = [...defaultOperadores].sort(); }
    if(!document.getElementById('view-escala').classList.contains('hidden')) renderEscalaSemana(); 
    if(!document.getElementById('view-escala-dc').classList.contains('hidden')) renderEscalaDcSemana(); 
    if(!document.getElementById('view-presenca').classList.contains('hidden')) renderPresencaGrid(); 
});

dbFirebase.ref('shopee_daily_live').on('value', (snapshot) => { 
    let data = snapshot.val(); dailyData = data ? (Array.isArray(data) ? data : Object.values(data)) : []; 
    if(!document.getElementById('view-dia').classList.contains('hidden')) renderDaily(); 
});

dbFirebase.ref('shopee_prod_live').on('value', (snapshot) => { globalProdData = snapshot.val() || {}; if(!document.getElementById('view-rankprod').classList.contains('hidden')) renderRankProd(); });

dbFirebase.ref('shopee_ctrl_live').on('value', snap => {
    ctrlData = snap.val() || initCtrl();
    if(!document.getElementById('view-ctrl').classList.contains('hidden')) renderControl();
    if(!document.getElementById('view-bi').classList.contains('hidden')) renderBIChart();
});

dbFirebase.ref('shopee_prod_state').on('value', snap => {
    let state = snap.val();
    if(state) {
        const setV = (id, v) => { let e = document.getElementById(id); if(e) e.value = v; };
        const setT = (id, v) => { let e = document.getElementById(id); if(e) e.innerText = v; };
        setV('p-data', state.data); setV('p-hora-ini', state.horaIni); setV('p-hora-fim', state.horaFim);
        setT('p-backlog', state.backlog); setT('p-xpt', state.xpt); setT('p-vol-rot', state.volRot);
        if(state.stations) {
            for(let j=1; j<=10; j++) { let sel = document.getElementById(`station-select-${j}`); if(sel && state.stations[j-1]) { if(Array.from(sel.options).some(o => o.value === state.stations[j-1])) sel.value = state.stations[j-1]; } }
        }
        calculateProdTotals(false);
    }
});

dbFirebase.ref('shopee_gold_db').on('value', snap => { monthlyDataCache = snap.val() || {}; if(!document.getElementById('view-mes').classList.contains('hidden')) renderMonthly(); });

dbFirebase.ref('shopee_escala_history').on('value', snap => {
    historyDataCache = snap.val() || {};
    if(!document.getElementById('view-hist-escala').classList.contains('hidden')) renderHistEscala('lugares');
    if(!document.getElementById('view-sitelider').classList.contains('hidden')) renderSiteliderDashboard();
});

dbFirebase.ref('shopee_escala_dc_history').on('value', snap => {
    historyDcDataCache = snap.val() || {};
    if(!document.getElementById('view-hist-escala-dc').classList.contains('hidden')) renderHistEscala('dc');
});

dbFirebase.ref('shopee_escala_semana_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaSemana = data; else initEmptyEscalaSemana(); 
    if(!document.getElementById('view-escala').classList.contains('hidden')) renderEscalaSemana(); 
    if(!document.getElementById('view-sitelider').classList.contains('hidden')) renderSiteliderDashboard(); 
});

dbFirebase.ref('shopee_escala_dc_live').on('value', (snapshot) => { 
    let data = snapshot.val(); if (data) liveEscalaDcSemana = data; else initEmptyEscalaDcSemana(); 
    if(!document.getElementById('view-escala-dc').classList.contains('hidden')) renderEscalaDcSemana(); 
});

const dateObj = new Date();
currentPresMes = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0');

presencaListener = dbFirebase.ref('shopee_presenca_live/' + currentPresMes).on('value', snap => {
    livePresenca = snap.val() || {};
    if(!document.getElementById('view-presenca').classList.contains('hidden')) renderPresencaGrid(); 
    if(!document.getElementById('view-escala').classList.contains('hidden')) { if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); } }
    if(!document.getElementById('view-escala-dc').classList.contains('hidden')) { if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailabilityDc(d.id)); updateSidebarDc(); } }
    if(!document.getElementById('view-sitelider').classList.contains('hidden')) renderSiteliderDashboard(); 
});

function saveProdState() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let state = { data: document.getElementById('p-data')?.value || '', horaIni: document.getElementById('p-hora-ini')?.value || '', horaFim: document.getElementById('p-hora-fim')?.value || '', backlog: document.getElementById('p-backlog')?.innerText || '0', xpt: document.getElementById('p-xpt')?.innerText || '0', volRot: document.getElementById('p-vol-rot')?.innerText || '0', stations: [] };
    for(let j=1; j<=10; j++) { let sel = document.getElementById(`station-select-${j}`); state.stations.push(sel ? sel.value : ""); }
    dbFirebase.ref('shopee_prod_state').set(state);
}

function saveDailyToCloud() { if(currentUser && currentUser.r === 'admin') { dbFirebase.ref('shopee_daily_live').set(dailyData).catch(e => console.error(e)); } }
function saveProdToCloud() { if(currentUser && currentUser.r === 'admin') { dbFirebase.ref('shopee_prod_live').set(globalProdData).catch(e => console.error(e)); } }

function checkSession() {
    const saved = localStorage.getItem('spxUser');
    if(saved) {
        const found = JSON.parse(saved); currentUser = found;
        document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-shell').style.display = 'flex';
        document.getElementById('display-user').innerText = found.u.toUpperCase();
        if(found.r === 'admin') { document.body.classList.add('is-admin'); }
        initProdGrid(); document.getElementById('pres-month-select').value = currentPresMes; switchTab('escala'); 
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
        initProdGrid(); document.getElementById('pres-month-select').value = currentPresMes; switchTab('escala');
    } else { document.getElementById('login-err').style.display = 'block'; }
}

function logout() { localStorage.removeItem('spxUser'); location.reload(); }
window.onload = checkSession; document.getElementById('pass').addEventListener('keypress', e=>{if(e.key==='Enter')login()});
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function fmtTime(s) { const m = Math.floor(s/60); const sec = Math.round(s%60); return `${m}m ${sec}s`; }
function secToHHMMSS(s) { if(!s) return "00:00:00"; const h = Math.floor(s/3600).toString().padStart(2,'0'); const m = Math.floor((s%3600)/60).toString().padStart(2,'0'); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${h}:${m}:${sec}`; }
function excelDate(serial) { if(!serial) return "-"; const date = new Date((serial - 25569) * 86400 * 1000); return date.toLocaleDateString('pt-BR'); }
function fmtExcelTime(dec) { if(!dec) return "-"; let s = Math.round(dec * 86400); return secToHHMMSS(s).substring(0,5); }
function readExcelFile(file, parseDates = false) { return new Promise(resolve => { const reader = new FileReader(); reader.onload = e => { const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: parseDates }); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header:1}); resolve(data); }; reader.readAsArrayBuffer(file); }); }

let selectedShiftTemp = '';
function openShiftModal() { document.getElementById('shift-modal-overlay').classList.remove('hidden'); }
function closeShiftModal() { document.getElementById('shift-modal-overlay').classList.add('hidden'); }
function confirmShift(shift) { selectedShiftTemp = shift; document.getElementById('shift-display').innerText = "| TURNO: " + shift; closeShiftModal(); document.getElementById('file-prod').click(); }

// =========================================================
// DIÁRIO E CONTROLE 
// =========================================================
async function handleSingleFile(input) {
    if(input.files.length === 0) return; dailyData = []; ctrlData = initCtrl();
    try { const data = await readExcelFile(input.files[0], false); processData([data], true); document.getElementById('st-single').innerText = "Carregado com sucesso!"; showToast("Importação Concluída"); } catch (e) { console.error(e); showToast("Erro."); }
}

async function handleMassFiles(input) {
    if(input.files.length === 0) return; dailyData = []; 
    try { const files = Array.from(input.files); const promises = files.map(f => readExcelFile(f, false)); const results = await Promise.all(promises); processData(results, false); document.getElementById('st-mass').innerText = `${files.length} Arquivos`; showToast("Importação em Massa Concluída"); } catch (e) { console.error(e); showToast("Erro."); }
}

function processData(allFilesData, isSingleImport) {
    const map = {};
    allFilesData.forEach(rows => {
        for(let i=1; i<rows.length; i++) {
            const r = rows[i]; let rawName = String(r[9] || ""); if(!rawName.trim()) continue;
            let tempName = rawName.replace(/\[.*?\]/g, '').replace(/^(AT|OPS?)\s*-?\s*\d*\s*-?\s*/gi, '').replace(/^\d+\s*-?\s*/, '').trim().toUpperCase(); tempName = tempName.replace(/[.\#$\[\]\/]/g, '');
            let parts = tempName.split(/\s+/).filter(Boolean); let cleanName = "";
            if(parts.length > 1) { cleanName = parts[0] + " " + parts[1].charAt(0); } else if(parts.length === 1) { cleanName = parts[0]; }
            if (!cleanName) continue; let nome = cleanName;
            let volRank = parseFloat(String(r[3]).replace(/[^\d,-]/g,'').replace(',','.')) || 0; let volCtrl = parseFloat(String(r[2]).replace(/[^\d,-]/g,'').replace(',','.')) || 0; let volValid = parseFloat(String(r[4]).replace(/[^\d,-]/g,'').replace(',','.')) || 0; let valF = parseFloat(String(r[5]).replace(/[^\d,-]/g,'').replace(',','.')) || 0; let valG = parseFloat(String(r[6]).replace(/[^\d,-]/g,'').replace(',','.')) || 0; let rec = parseFloat(String(r[11]).replace(',','.')) || 0;
            let tStart = r[7]; let tEnd = r[8]; let time = 0; if(typeof tStart==='number' && typeof tEnd==='number') { let diff = tEnd - tStart; if(diff < 0) diff += 1; time = Math.round(diff * 86400); }
            if(!map[nome]) map[nome] = { nome, rotas:0, vol:0, reconf:0, time:0, doblecheck: 0 };
            map[nome].rotas += 1; map[nome].vol += volRank; map[nome].time += time; map[nome].reconf += rec;
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
    dailyData = Object.values(map); saveDailyToCloud(); 
    if (isSingleImport && currentUser && currentUser.r === 'admin') dbFirebase.ref('shopee_ctrl_live').set(ctrlData);
}

function clearData() { 
    dailyData=[]; ctrlData=initCtrl(); saveDailyToCloud(); 
    if(currentUser && currentUser.r === 'admin') dbFirebase.ref('shopee_ctrl_live').set(ctrlData);
    document.getElementById('st-single').innerText="Selecionar CSV (Diário)"; document.getElementById('st-mass').innerText="Múltiplos arquivos .CSV"; 
    renderDaily(); renderControl(); showToast("Tela Limpa"); 
}

let currentDcName = "";
window.openDoblecheck = function(nome) { currentDcName = nome; document.getElementById('dc-modal-driver-name').innerText = "Motorista: " + nome; document.getElementById('dc-modal-overlay').classList.remove('hidden'); };
window.closeDcModal = function() { document.getElementById('dc-modal-overlay').classList.add('hidden'); };
window.applyDc = function(val) { let d = dailyData.find(x => x.nome === currentDcName); if(d) { d.doblecheck = val; saveDailyToCloud(); } closeDcModal(); };

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
    const d = ctrlData; const el = (id)=>document.getElementById(id);
    el('c-data').innerText = d.date || "-"; el('c-vol').innerText = d.totalVol; el('c-rotas').innerText = d.totalRotas; el('c-ini').innerText = fmtExcelTime(d.minTime); el('c-fim').innerText = fmtExcelTime(d.maxTime);
    let durSec = 0; if(d.minTime && d.maxTime) durSec = Math.round((d.maxTime - d.minTime)*86400); el('c-dur').innerText = secToHHMMSS(durSec);
    let avgHI = d.countDurHI>0 ? d.sumDurHI/d.countDurHI : 0; el('c-avg-time').innerText = secToHHMMSS(avgHI);
    
    let total = d.totalVol; let finPerc = total>0 ? (d.finVol/total)*100 : 0; let pendPerc = total>0 ? (100 - finPerc) : 0;
    let pendRot = d.totalRotas - d.finRot; let pendVol = d.totalVol - d.finVol;
    el('c-fin-rot').innerText = d.finRot; el('c-fin-vol').innerText = d.finVol; el('c-fin-perc').innerText = finPerc.toFixed(2).replace('.',',') + "%";
    el('c-pen-rot').innerText = pendRot; el('c-pen-vol').innerText = pendVol; el('c-pen-perc').innerText = pendPerc.toFixed(2).replace('.',',') + "%";
    el('c-mis-rot').innerText = d.missRot; el('c-mis-vol').innerText = d.missVol; let misPerc = total>0 ? (d.missRot/total)*100 : 0; el('c-mis-perc').innerText = misPerc.toFixed(2).replace('.',',') + "%";
    el('c-missing-rot').innerText = d.missingRot; el('c-missing-vol').innerText = d.missingVol; let missingPerc = total>0 ? (d.missingRot/total)*100 : 0; el('c-missing-perc').innerText = missingPerc.toFixed(2).replace('.',',') + "%";
    const tbody = document.getElementById('c-hourly-body'); tbody.innerHTML = '';
    Object.keys(d.hourly).sort().forEach(h => { tbody.innerHTML += `<tr><td>${h}</td><td style="text-align:center">${d.hourly[h].r}</td><td style="text-align:center">${d.hourly[h].v}</td></tr>`; });
}

async function saveToMonthly() {
    if(dailyData.length===0) return showToast("Sem dados para arquivar."); showToast("Salvando na Nuvem...");
    try { let db = {...monthlyDataCache}; dailyData.forEach(d => { const k = d.nome; if(!db[k]) db[k] = {nome:k, rotas:0, vol:0, reconf:0, time:0, doblecheck:0}; db[k].rotas += d.rotas; db[k].vol += d.vol; db[k].reconf += d.reconf; db[k].doblecheck = (db[k].doblecheck || 0) + (d.doblecheck || 0); db[k].time += d.time; }); await dbFirebase.ref('shopee_gold_db').set(db); showToast("Arquivado na Nuvem!"); } catch(e) { console.error(e); showToast("Erro."); }
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

async function resetMonthly() { if(confirm("Deseja apagar permanentemente o histórico MENSAL DA NUVEM?")) { await dbFirebase.ref('shopee_gold_db').remove(); showToast("Banco Apagado!"); } }

// =========================================================
// PRODUTIVIDADE E DASHBOARD BI
// =========================================================
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

async function importProdData(input) {
    if(input.files.length === 0) return;
    try {
        const data = await readExcelFile(input.files[0], true); if (!data || data.length === 0) { showToast("Arquivo vazio."); return; }
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
        updateDropdowns(); saveProdToCloud(); showToast("Produtividade Processada!");
    } catch(e) { console.error("Erro na importação:", e); showToast("Erro."); }
}

function updateDropdowns() {
    let names = Object.keys(globalProdData).sort();
    for(let j = 1; j <= 10; j++) {
        let select = document.getElementById(`station-select-${j}`); 
        if(select) { let currentVal = select.value; select.innerHTML = `<option value="">Estação ${j}</option>`; names.forEach(n => { select.innerHTML += `<option value="${n}">${n}</option>`; }); if(names.includes(currentVal)) select.value = currentVal; }
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

async function renderBIChart() {
    const ctx = document.getElementById('biChartCanvas').getContext('2d');
    let hours = Object.keys(ctrlData.hourly).sort();
    let labels = hours.length > 0 ? hours : ['Sem Dados'];
    let volumes = hours.length > 0 ? hours.map(h => ctrlData.hourly[h].v) : [0];
    let rotas = hours.length > 0 ? hours.map(h => ctrlData.hourly[h].r) : [0];
    if(window.biChartInstance) window.biChartInstance.destroy();
    window.biChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [ { label: 'Volume (Pacotes)', data: volumes, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 6, yAxisID: 'y' }, { label: 'Rotas Processadas', data: rotas, type: 'line', borderColor: '#fbbf24', backgroundColor: '#fbbf24', borderWidth: 3, tension: 0.4, yAxisID: 'y1' } ] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'linear', display: true, position: 'left', ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y1: { type: 'linear', display: true, position: 'right', ticks: { color: '#fbbf24' }, grid: { drawOnChartArea: false } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } }, plugins: { legend: { labels: { color: '#fff', font: { family: 'Outfit', size: 12 } } }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { family: 'Outfit' }, bodyFont: { family: 'Outfit' } } } }
    });
}

// =========================================================
// ESCALA (LUGARES E DOBLECHECK)
// =========================================================
function updateDatesFromWeek(inputId, tipo) {
    if (!currentUser || currentUser.r !== 'admin') return;
    const weekVal = document.getElementById(inputId).value;
    if (!weekVal) return;

    const parts = weekVal.split('-W');
    if (parts.length !== 2) return;
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    const monday = getDateOfISOWeek(week, year);

    const offsets = { 'quarta': 2, 'quinta': 3, 'sexta': 4, 'sabado': 5, 'domingo': 6, 'segunda': 7 };
    let objAlvo = tipo === 'lugares' ? liveEscalaSemana : liveEscalaDcSemana;

    for (let diaId in offsets) {
        if (!objAlvo[diaId]) objAlvo[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '', visible: false, grid: {} };
        let d = new Date(monday.getTime());
        d.setDate(d.getDate() + offsets[diaId]);
        let dayStr = String(d.getDate()).padStart(2, '0');
        let monthStr = String(d.getMonth() + 1).padStart(2, '0');
        objAlvo[diaId].dataDia = `${dayStr}/${monthStr}`;
    }

    let refDb = tipo === 'lugares' ? 'shopee_escala_semana_live' : 'shopee_escala_dc_live';
    dbFirebase.ref(refDb).set(objAlvo).then(() => { showToast("Datas preenchidas!"); });
}

function getDateOfISOWeek(w, y) {
    let simple = new Date(y, 0, 1 + (w - 1) * 7); let dow = simple.getDay(); let ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

function formatShortName(fullName) {
    if (!fullName) return ""; let p = fullName.split(/\s+/).filter(Boolean);
    if (p.length > 1) { return p[0] + " " + p[1]; } return p[0];
}

function getAbsenteesForDay(diaId, isDc = false) {
    let absentees = [];
    let objAlvo = isDc ? liveEscalaDcSemana : liveEscalaSemana;
    let escDia = objAlvo[diaId];
    if(!escDia || !escDia.dataDia) return absentees;
    
    let match = escDia.dataDia.match(/(\d{1,2})/); 
    if(match) {
        let day = parseInt(match[1]);
        for(let op in livePresenca) {
            if(livePresenca[op] && (livePresenca[op][day] === 'F' || livePresenca[op][day] === 'FG' || livePresenca[op][day] === 'AT')) {
                absentees.push(op);
            }
        }
    }
    return absentees;
}

function addNewCollaborator(inputId) {
    const input = document.getElementById(inputId);
    const name = input.value.trim().toUpperCase();
    if(!name) return showToast("Digite o nome completo.");
    if(operadoresList.includes(name)) return showToast("Este colaborador já existe.");
    
    dbFirebase.ref('shopee_colaboradores/' + name).set(name).then(() => { input.value = ""; showToast("Colaborador cadastrado!"); }).catch(e => console.error(e));
}

function removeCollaborator(name) {
    if(confirm(`Deseja realmente desligar/remover o colaborador ${name} do sistema?`)) {
        dbFirebase.ref('shopee_colaboradores/' + name).remove().then(() => { showToast("Colaborador removido!"); }).catch(e => console.error(e));
    }
}

// ==========================================
// LÓGICA: ESCALA DE LUGARES
// ==========================================
function clearEscalaSemana() {
    if(confirm("Tem certeza que deseja limpar TODA a escala de Lugares?")) {
        let oldData = {...liveEscalaSemana}; liveEscalaSemana = {};
        escDiasConf.forEach(d => { let prevData = oldData[d.id] ? oldData[d.id].dataDia : '(inserir data)'; let prevVis = oldData[d.id] && oldData[d.id].visible !== undefined ? oldData[d.id].visible : false; liveEscalaSemana[d.id] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: prevData, visible: prevVis, grid: {} }; });
        dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Escala limpa com sucesso!"); }).catch(e => console.error(e));
    }
}

window.replicateWednesday = function() {
    if(!confirm("Isso vai copiar a escala de QUARTA-FEIRA para todos os outros dias da semana. Deseja continuar?")) return;
    let baseGrid = liveEscalaSemana['quarta']?.grid;
    if(!baseGrid || Object.keys(baseGrid).length === 0) return showToast("A escala de Quarta está vazia!");

    escDiasConf.forEach((d, idx) => {
        if (idx === 0) return; let diaId = d.id;
        if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };

        let absentees = getAbsenteesForDay(diaId, false);
        let clonedGrid = {};
        for(let r in baseGrid) {
            clonedGrid[r] = {};
            for(let c in baseGrid[r]) {
                let op = baseGrid[r][c];
                if (op && !absentees.includes(op)) clonedGrid[r][c] = op; else clonedGrid[r][c] = "";
            }
        }
        liveEscalaSemana[diaId].grid = clonedGrid;
    });
    dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Semana preenchida baseada na Quarta!"); });
};

function toggleDayVisibility(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    if (!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaSemana[diaId].visible = !liveEscalaSemana[diaId].visible;
    dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).catch(e => console.error(e));
}

function autoDistributeAllLugares() {
    if(confirm("Sortear a semana toda? Isso substituirá as vagas atuais.")) {
        escDiasConf.forEach(d => { autoDistributeOperators(d.id, false); });
        dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Semana completa sorteada com sucesso!"); }).catch(e => console.error(e));
    }
}

function autoDistributeOperators(diaId, autoSave = true) {
    if(!liveEscalaSemana[diaId]) liveEscalaSemana[diaId] = { hc: '16', pct: '0', cap: '16980', dw: '0', phd: '0', capphd: '630', dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaSemana[diaId].grid = {}; for(let r=0; r<escRows.length; r++) liveEscalaSemana[diaId].grid[r] = {};

    let lastRoles = {}; let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) {
        let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaSemana[prevDiaId]?.grid;
        if (prevGrid) escRows.forEach((cargo, rIdx) => { if (prevGrid[rIdx]) Object.values(prevGrid[rIdx]).forEach(op => { if(op) lastRoles[op] = rIdx; }); });
    }

    let absentees = getAbsenteesForDay(diaId, false);
    let pool = operadoresList.filter(op => !absentees.includes(op));
    pool.sort(() => Math.random() - 0.5); 

    for (let cIdx = 0; cIdx < escCols.length; cIdx++) {
        for (let rIdx = 0; rIdx < escRows.length; rIdx++) {
            if (pool.length === 0) break;
            const isMergedRow = (rIdx === 0 || rIdx === 3); const isSkipCol = (isMergedRow && (cIdx === 1 || cIdx === 3 || cIdx === 5 || cIdx === 7));
            if (isSkipCol) continue;
            let foundIdx = pool.findIndex(op => lastRoles[op] !== rIdx); if (foundIdx === -1) foundIdx = 0; 
            let chosenOp = pool.splice(foundIdx, 1)[0];
            liveEscalaSemana[diaId].grid[rIdx][cIdx] = chosenOp;
        }
        if(pool.length === 0) break;
    }

    if(autoSave) dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).then(() => { showToast("Sorteio feito para " + diaId.toUpperCase() + "!"); }).catch(e => console.error(e));
}

function renderEscalaSemana() {
    const container = document.getElementById('escala-semanal-container'); if(!container) return; container.innerHTML = '';
    const isAdm = currentUser && currentUser.r === 'admin'; const editAttr = isAdm ? 'contenteditable="true"' : ''; const editClass = isAdm ? 'editable-cell' : '';
    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaSemana[diaConf.id] || {hc:'0', pct:'0', cap:'0', dw:'0', phd:'0', capphd:'0', dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeOperators('${diaConf.id}')" title="Sortear Vagas"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; let eyeIcon = escDia.visible ? 'fa-eye' : 'fa-eye-slash'; let eyeText = escDia.visible ? 'Visível' : 'Oculto';
        let btnEye = isAdm ? `<button class="${eyeClass}" onclick="toggleDayVisibility('${diaConf.id}')" title="Alternar Visibilidade da Mesa"><i class="fas ${eyeIcon}"></i> ${eyeText}</button>` : '';
        let headerControls = isAdm ? `<div style="display:flex; gap:8px; align-items:center;">${btnSortear}${btnEye}</div>` : '';

        let html = `<div class="esc-block"><table class="esc-table" style="border-bottom:none; margin-bottom: 5px;">
                <tr><td colspan="7" style="background-color: ${diaConf.bg} !important; color: ${diaConf.cor} !important; padding: 0;"><div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px;"><span style="font-size: 14px; font-weight: 800;">${diaConf.nome}</span>${headerControls}</div></td></tr>
                <tr>
                    <td class="esc-gray-light ${editClass}" ${editAttr} id="esc-datadia-${diaConf.id}" onblur="saveEscalaSemanaToCloud()" style="text-align: left; padding-left: 10px; font-weight: bold; font-size: 11px; color: #002f6c; width:20%;">${escDia.dataDia || '(inserir data)'}</td>
                    <td class="esc-gray-light" style="width:10%">Quantidade HC</td><td class="${editClass}" ${editAttr} id="esc-hc-${diaConf.id}" onblur="saveEscalaSemanaToCloud()" style="width:10%">${escDia.hc}</td>
                    <td class="esc-gray-light" style="width:10%">PCT. PROCESSADOS</td><td class="esc-green ${editClass}" ${editAttr} id="esc-pct-${diaConf.id}" onblur="saveEscalaSemanaToCloud()" style="width:10%">${escDia.pct}</td>
                    <td class="esc-gray-light" style="width:10%">CAP PROCESSAMENTO</td><td class="esc-cyan ${editClass}" ${editAttr} id="esc-cap-${diaConf.id}" onblur="saveEscalaSemanaToCloud()" style="width:10%">${escDia.cap}</td>
                </tr>
                <tr>
                    <td class="esc-gray-light" style="text-align: left; padding-left: 10px; font-weight: normal; font-size: 10px; border-top: none;"></td>
                    <td class="esc-gray-light">Necessidade DW</td><td class="esc-red-txt ${editClass}" ${editAttr} id="esc-dw-${diaConf.id}" onblur="saveEscalaSemanaToCloud()">${escDia.dw}</td>
                    <td class="esc-gray-light esc-red-txt">PHD Atingido</td><td class="esc-red-txt ${editClass}" ${editAttr} id="esc-phd-${diaConf.id}" onblur="saveEscalaSemanaToCloud()">${escDia.phd}</td>
                    <td class="esc-gray-light">CAP PHD</td><td class="esc-cyan esc-red-txt ${editClass}" ${editAttr} id="esc-capphd-${diaConf.id}" onblur="saveEscalaSemanaToCloud()">${escDia.capphd}</td>
                </tr>
            </table>
            <table class="esc-table"><tr class="esc-gray-light"><th style="width:8%">OPERADOR</th>`;
        escCols.forEach(col => { html += `<th>${col.toUpperCase()}</th>`; }); html += `</tr>`;
        
        escRows.forEach((cargo, rIdx) => {
            html += `<tr><td class="esc-gray-dark" style="text-align:left; padding-left:5px; font-size: 10px;">${cargo}</td>`;
            escCols.forEach((col, cIdx) => {
                const isMergedRow = (rIdx === 0 || rIdx === 3); const isMesaGroupCol = (cIdx === 0 || cIdx === 2 || cIdx === 4 || cIdx === 6); const isSkipCol = (cIdx === 1 || cIdx === 3 || cIdx === 5 || cIdx === 7);
                if (isMergedRow && isSkipCol) return; 
                let cellVal = ''; if(escDia.grid && escDia.grid[rIdx] && escDia.grid[rIdx][cIdx]) { cellVal = escDia.grid[rIdx][cIdx]; }
                let colspanAttr = (isMergedRow && isMesaGroupCol) ? 'colspan="2"' : '';
                
                if (isAdm) {
                    let selectHtml = `<select class="esc-select" id="esc-cell-${diaConf.id}-${rIdx}-${cIdx}" onchange="handleEscalaSelect('${diaConf.id}')"><option value="">--</option>`;
                    operadoresList.forEach(op => { 
                        let short = formatShortName(op); let selected = (cellVal === op) ? 'selected' : ''; 
                        let alreadyUsedInDay = false;
                        if(escDia.grid) { for(let gR in escDia.grid) { for(let gC in escDia.grid[gR]) { if(escDia.grid[gR][gC] === op && op !== cellVal) alreadyUsedInDay = true; } } }
                        let isAbsent = getAbsenteesForDay(diaConf.id, false).includes(op);

                        if(alreadyUsedInDay || isAbsent) {
                            let absText = isAbsent ? " (OFF)" : "";
                            selectHtml += `<option value="${op}" disabled hidden style="display:none;" ${selected}>${short}${absText}</option>`; 
                        } else { selectHtml += `<option value="${op}" ${selected}>${short}</option>`; }
                    });
                    selectHtml += `</select>`; html += `<td ${colspanAttr} style="padding:0;">${selectHtml}</td>`;
                } else { html += `<td ${colspanAttr} class="esc-gray-light" style="color:#000; font-size: 9px; font-weight: 800; letter-spacing: -0.2px;">${formatShortName(cellVal)}</td>`; }
            });
            html += `</tr>`;
        });
        html += `</table></div>`; container.innerHTML += html;
    });

    if (!isAdm && !renderedAny) container.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-muted); font-size: 1.2rem; font-weight: bold;"><i class="fas fa-eye-slash" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>A Escala da Semana ainda não foi publicada.</div>';
    if(isAdm) { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); }
}

function handleEscalaSelect(diaId) {
    document.getElementById('sidebar-day-select').value = diaId; currentSidebarDay = diaId; 
    updateDropdownsAvailability(diaId); updateSidebar(); saveEscalaSemanaToCloud();
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

function changeSidebarDay(tipo) { 
    if(tipo === 'lugares') { currentSidebarDay = document.getElementById('sidebar-day-select').value; updateSidebar(); }
    else { currentSidebarDcDay = document.getElementById('sidebar-day-select-dc').value; updateSidebarDc(); }
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
    container.innerHTML = html; document.getElementById('sidebar-count').innerText = `(${availableCount})`; document.getElementById('sidebar-day-select').value = currentSidebarDay;
}

function saveEscalaSemanaToCloud() {
    if(!currentUser || currentUser.r !== 'admin') return;
    escDiasConf.forEach(diaConf => {
        const id = diaConf.id; if(!liveEscalaSemana[id]) liveEscalaSemana[id] = {grid: {}};
        let currentVis = liveEscalaSemana[id].visible !== undefined ? liveEscalaSemana[id].visible : false;
        liveEscalaSemana[id].visible = currentVis;
        
        let hcEl = document.getElementById(`esc-hc-${id}`);
        if(hcEl) {
            liveEscalaSemana[id].hc = hcEl.innerText.trim(); liveEscalaSemana[id].pct = document.getElementById(`esc-pct-${id}`).innerText.trim(); liveEscalaSemana[id].cap = document.getElementById(`esc-cap-${id}`).innerText.trim(); liveEscalaSemana[id].dw = document.getElementById(`esc-dw-${id}`).innerText.trim(); liveEscalaSemana[id].phd = document.getElementById(`esc-phd-${id}`).innerText.trim(); liveEscalaSemana[id].capphd = document.getElementById(`esc-capphd-${id}`).innerText.trim(); liveEscalaSemana[id].dataDia = document.getElementById(`esc-datadia-${id}`).innerText.trim();
        }

        escRows.forEach((cargo, rIdx) => {
            if(!liveEscalaSemana[id].grid[rIdx]) liveEscalaSemana[id].grid[rIdx] = {};
            escCols.forEach((col, cIdx) => {
                const isMergedRow = (rIdx === 0 || rIdx === 3); const isSkipCol = (cIdx === 1 || cIdx === 3 || cIdx === 5 || cIdx === 7); if (isMergedRow && isSkipCol) return; 
                const cell = document.getElementById(`esc-cell-${id}-${rIdx}-${cIdx}`); if(cell) { liveEscalaSemana[id].grid[rIdx][cIdx] = cell.value || ""; }
            });
        });
    });
    dbFirebase.ref('shopee_escala_semana_live').set(liveEscalaSemana).catch(e => console.error(e));
}

async function archiveEscalaSemanal() {
    let dataInput = document.getElementById('hist-date-input').value; if(!dataInput) { showToast("Selecione a semana de referência no topo."); return; }
    showToast("Salvando Semana no Histórico...");
    try { await dbFirebase.ref('shopee_escala_history/' + dataInput).set(liveEscalaSemana); showToast("Semana Salva com Sucesso!"); } catch(e) { console.error(e); showToast("Erro."); }
}

// ==========================================
// LÓGICA: ESCALA DOBLECHECK (ALTERNADA)
// ==========================================
function initEmptyEscalaDcSemana() {
    let oldData = {...liveEscalaDcSemana}; liveEscalaDcSemana = {};
    escDiasConf.forEach(d => { 
        let prevData = oldData[d.id] ? oldData[d.id].dataDia : '(inserir data)'; let prevVis = oldData[d.id] && oldData[d.id].visible !== undefined ? oldData[d.id].visible : false; liveEscalaDcSemana[d.id] = { dataDia: prevData, visible: prevVis, grid: {} }; 
    });
}

function clearEscalaDc() {
    if(confirm("Tem certeza que deseja limpar TODA a escala de Doblecheck?")) {
        initEmptyEscalaDcSemana();
        dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Escala DC limpa!"); }).catch(e => console.error(e));
    }
}

function toggleDayVisibilityDc(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    if (!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaDcSemana[diaId].visible = !liveEscalaDcSemana[diaId].visible;
    dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).catch(e => console.error(e));
}

function autoDistributeAllDc() {
    if(confirm("Sortear a semana toda de DC? Lembre-se que quem rodar em um dia não roda no dia seguinte.")) {
        escDiasConf.forEach(d => { autoDistributeDc(d.id, false); });
        dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Semana DC sorteada!"); }).catch(e => console.error(e));
    }
}

function autoDistributeDc(diaId, autoSave = true) {
    if(!liveEscalaDcSemana[diaId]) liveEscalaDcSemana[diaId] = { dataDia: '(inserir data)', visible: false, grid: {} };
    liveEscalaDcSemana[diaId].grid = {};

    let prevAllocated = [];
    let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) {
        let prevDiaId = escDiasConf[currentIdx - 1].id;
        let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid;
        if (prevGrid) { Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); }); }
    }

    let absentees = getAbsenteesForDay(diaId, true);
    let pool = operadoresList.filter(op => !absentees.includes(op) && !prevAllocated.includes(op));
    pool.sort(() => Math.random() - 0.5); 

    dcLayout.forEach(sec => {
        let slots = sec.rows * sec.cols;
        for(let i=0; i<slots; i++) {
            let cellId = `${sec.id}_${i}`;
            let chosenOp = pool.length > 0 ? pool.shift() : "";
            liveEscalaDcSemana[diaId].grid[cellId] = chosenOp;
        }
    });

    if(autoSave) dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).then(() => { showToast("Sorteio DC feito para " + diaId.toUpperCase()); }).catch(e => console.error(e));
}

function renderEscalaDcSemana() {
    const container = document.getElementById('escala-dc-container'); if(!container) return; container.innerHTML = '';
    const isAdm = currentUser && currentUser.r === 'admin'; 

    let renderedAny = false;

    escDiasConf.forEach((diaConf, index) => {
        let escDia = liveEscalaDcSemana[diaConf.id] || { dataDia: '(inserir data)', visible: false, grid:{}};
        if (!isAdm && escDia.visible !== true) return; 
        renderedAny = true;
        
        let btnSortear = isAdm ? `<button class="esc-day-btn" onclick="autoDistributeDc('${diaConf.id}')" title="Sortear Vagas DC"><i class="fas fa-random"></i> Sortear</button>` : '';
        let eyeClass = escDia.visible ? 'esc-day-btn' : 'esc-day-btn eye-off'; let eyeIcon = escDia.visible ? 'fa-eye' : 'fa-eye-slash'; let eyeText = escDia.visible ? 'Visível' : 'Oculto';
        let btnEye = isAdm ? `<button class="${eyeClass}" onclick="toggleDayVisibilityDc('${diaConf.id}')" title="Alternar Visibilidade"><i class="fas ${eyeIcon}"></i> ${eyeText}</button>` : '';
        let headerControls = isAdm ? `<div style="display:flex; gap:8px; align-items:center;">${btnSortear}${btnEye}</div>` : '';

        let html = `<div class="esc-block"><table class="esc-table" style="border-bottom:none; margin-bottom: 5px;">
                <tr><td style="background-color: ${diaConf.bg} !important; color: ${diaConf.cor} !important; padding: 0;"><div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px;"><span style="font-size: 14px; font-weight: 800;">${diaConf.nome}</span>${headerControls}</div></td></tr>
                <tr><td class="esc-gray-light" id="esc-dc-datadia-${diaConf.id}" style="text-align: left; padding-left: 10px; font-weight: bold; font-size: 11px; color: #002f6c;">${escDia.dataDia || '(inserir data)'}</td></tr>
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
                        let selectHtml = `<select class="esc-select" id="esc-dc-cell-${diaConf.id}-${cellId}" onchange="handleEscalaDcSelect('${diaConf.id}')"><option value="">--</option>`;
                        operadoresList.forEach(op => { 
                            let short = formatShortName(op); let selected = (cellVal === op) ? 'selected' : ''; 
                            
                            let alreadyUsedInDay = false;
                            if(escDia.grid) { for(let key in escDia.grid) { if(escDia.grid[key] === op && op !== cellVal) alreadyUsedInDay = true; } }

                            let usedYesterday = false;
                            if(index > 0) {
                                let prevDiaId = escDiasConf[index - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid;
                                if (prevGrid && Object.values(prevGrid).includes(op)) usedYesterday = true;
                            }

                            let isAbsent = getAbsenteesForDay(diaConf.id, true).includes(op);

                            if(alreadyUsedInDay || isAbsent || usedYesterday) {
                                let reasonText = isAbsent ? " (OFF)" : (usedYesterday ? " (FEZ ONTEM)" : "");
                                selectHtml += `<option value="${op}" disabled hidden style="display:none;" ${selected}>${short}${reasonText}</option>`; 
                            } else { selectHtml += `<option value="${op}" ${selected}>${short}</option>`; }
                        });
                        selectHtml += `</select>`; html += `<td style="padding:0; width: 25%;">${selectHtml}</td>`;
                    } else { html += `<td class="esc-gray-light" style="color:#000; font-size: 9px; font-weight: 800; letter-spacing: -0.2px; width: 25%;">${formatShortName(cellVal)}</td>`; }
                    cellCounter++;
                }
                html += `</tr>`;
            }
        });
        html += `</table></div>`; container.innerHTML += html;
    });

    if (!isAdm && !renderedAny) container.innerHTML = '<div style="text-align:center; padding: 50px; color: var(--text-muted); font-size: 1.2rem; font-weight: bold;"><i class="fas fa-eye-slash" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>A Escala Doblecheck ainda não foi publicada.</div>';
    if(isAdm) { escDiasConf.forEach(d => updateDropdownsAvailabilityDc(d.id)); updateSidebarDc(); }
}

function handleEscalaDcSelect(diaId) {
    document.getElementById('sidebar-day-select-dc').value = diaId; currentSidebarDcDay = diaId; 
    updateDropdownsAvailabilityDc(diaId); updateSidebarDc(); saveEscalaDcToCloud();
}

function updateDropdownsAvailabilityDc(diaId) {
    if (!currentUser || currentUser.r !== 'admin') return;
    let selectedValues = []; let absentees = getAbsenteesForDay(diaId, true);
    let prevAllocated = [];
    let currentIdx = escDiasConf.findIndex(d => d.id === diaId);
    if (currentIdx > 0) {
        let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid;
        if (prevGrid) Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); });
    }

    dcLayout.forEach(sec => {
        let slots = sec.rows * sec.cols;
        for(let i=0; i<slots; i++) { let el = document.getElementById(`esc-dc-cell-${diaId}-${sec.id}_${i}`); if (el && el.value) selectedValues.push(el.value); }
    });
    
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
                    } else { 
                        opt.disabled = false; opt.hidden = false; opt.style.display = ''; opt.text = formatShortName(opt.value);
                    } 
                }); 
            }
        }
    });
}

function updateSidebarDc() {
    if (!currentUser || currentUser.r !== 'admin') return;
    let container = document.getElementById('sidebar-names-list-dc'); if (!container) return;
    let selectedValues = []; let absentees = getAbsenteesForDay(currentSidebarDcDay, true);

    let prevAllocated = [];
    let currentIdx = escDiasConf.findIndex(d => d.id === currentSidebarDcDay);
    if (currentIdx > 0) {
        let prevDiaId = escDiasConf[currentIdx - 1].id; let prevGrid = liveEscalaDcSemana[prevDiaId]?.grid;
        if (prevGrid) Object.values(prevGrid).forEach(op => { if(op) prevAllocated.push(op); });
    }

    dcLayout.forEach(sec => {
        let slots = sec.rows * sec.cols;
        for(let i=0; i<slots; i++) { let el = document.getElementById(`esc-dc-cell-${currentSidebarDcDay}-${sec.id}_${i}`); if (el && el.value) selectedValues.push(el.value); }
    });

    let html = ''; let availableCount = 0;
    operadoresList.forEach(op => { 
        if (!selectedValues.includes(op) && !absentees.includes(op) && !prevAllocated.includes(op)) { 
            html += `<div class="sidebar-name-item"><div style="display:flex; align-items:center; gap:8px;"><i class="fas fa-user"></i> ${op}</div><i class="fas fa-times" style="color:var(--danger); cursor:pointer; font-size:1rem; padding:0 5px;" onclick="removeCollaborator('${op}')" title="Desligar Colaborador"></i></div>`; 
            availableCount++; 
        } 
    });
    if(availableCount === 0) { html = `<div style="text-align:center; color: var(--success); font-weight: bold; margin-top: 20px; font-size: 1rem;"><i class="fas fa-check-circle"></i> Todos Alocados ou Sem Efetivo!</div>`; }
    container.innerHTML = html; document.getElementById('sidebar-count-dc').innerText = `(${availableCount})`; document.getElementById('sidebar-day-select-dc').value = currentSidebarDcDay;
}

function saveEscalaDcToCloud() {
    if(!currentUser || currentUser.r !== 'admin') return;
    escDiasConf.forEach(diaConf => {
        const id = diaConf.id; if(!liveEscalaDcSemana[id]) liveEscalaDcSemana[id] = {grid: {}};
        let currentVis = liveEscalaDcSemana[id].visible !== undefined ? liveEscalaDcSemana[id].visible : false;
        liveEscalaDcSemana[id].visible = currentVis;
        
        let dtEl = document.getElementById(`esc-dc-datadia-${id}`);
        if(dtEl) liveEscalaDcSemana[id].dataDia = dtEl.innerText.trim();

        dcLayout.forEach(sec => {
            let slots = sec.rows * sec.cols;
            for(let i=0; i<slots; i++) {
                let cellId = `${sec.id}_${i}`;
                let cell = document.getElementById(`esc-dc-cell-${id}-${cellId}`); 
                if(cell) { liveEscalaDcSemana[id].grid[cellId] = cell.value || ""; }
            }
        });
    });
    dbFirebase.ref('shopee_escala_dc_live').set(liveEscalaDcSemana).catch(e => console.error(e));
}

async function archiveEscalaDc() {
    let dataInput = document.getElementById('hist-date-input-dc').value; if(!dataInput) { showToast("Selecione a semana de referência no topo."); return; }
    showToast("Salvando Semana DC...");
    try { await dbFirebase.ref('shopee_escala_dc_history/' + dataInput).set(liveEscalaDcSemana); showToast("Semana Salva com Sucesso!"); } catch(e) { console.error(e); showToast("Erro."); }
}

function clearEscalaHistory(tipo) {
    let desc = tipo === 'lugares' ? 'LUGARES' : 'DOBLECHECK';
    let refNode = tipo === 'lugares' ? 'shopee_escala_history' : 'shopee_escala_dc_history';
    if(confirm(`ATENÇÃO: Deseja apagar permanentemente TODO o histórico de escalas ${desc}? Esta ação não pode ser desfeita.`)) {
        dbFirebase.ref(refNode).remove().then(() => { renderHistEscala(tipo); showToast("Histórico apagado!"); }).catch(e => console.error(e));
    }
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
        let displayWeek = dateKey;
        if(dateKey.includes('-W')) { let pts = dateKey.split('-W'); displayWeek = "Semana " + pts[1] + " de " + pts[0]; }

        let tableHtml = `<div class="hidden" id="hist-det-${tipo}-${index}" style="margin-top: 15px; border-top: 1px solid var(--glass-border); padding-top: 15px; overflow-x: auto;">
            <table class="hist-table"><tr><th>COLABORADOR</th>`;
        
        escDiasConf.forEach(diaConf => {
            let dData = semanaData[diaConf.id]?.dataDia || diaConf.nome.replace('ESCALA ', '');
            tableHtml += `<th>${diaConf.nome.replace('ESCALA ', '')}<br><span style="font-size:9px; color:var(--text-muted)">${dData}</span></th>`;
        });
        tableHtml += `</tr>`;

        let workedOps = new Set();
        escDiasConf.forEach(d => {
            let grid = semanaData[d.id]?.grid;
            if(grid) { Object.values(grid).forEach(op => { if(typeof op === 'string' && op) workedOps.add(op); else if (typeof op === 'object') { Object.values(op).forEach(v => { if(v) workedOps.add(v); }); } }); }
        });
        let sortedOps = Array.from(workedOps).sort();

        if(sortedOps.length === 0) {
            tableHtml += `<tr><td colspan="7" style="color:var(--text-muted); font-size:10px;">Nenhum operador alocado.</td></tr>`;
        } else {
            sortedOps.forEach(op => {
                tableHtml += `<tr><td style="text-align:left; font-size:10px; font-weight:bold;">${op}</td>`;
                escDiasConf.forEach(d => {
                    let grid = semanaData[d.id]?.grid;
                    let roleStr = "-";
                    if(grid) {
                        if(tipo === 'lugares') {
                            for(let r=0; r<escRows.length; r++) { if(grid[r]) { for(let c=0; c<escCols.length; c++) { if(grid[r][c] === op) { roleStr = `<span style="color:var(--primary); font-weight:800;">${escRows[r]}</span><br><span style="font-size:9px; color:var(--text-muted)">${escCols[c]}</span>`; } } } }
                        } else {
                            dcLayout.forEach(sec => {
                                let slots = sec.rows * sec.cols;
                                for(let i=0; i<slots; i++) { if(grid[`${sec.id}_${i}`] === op) { roleStr = `<span style="color:var(--primary); font-weight:800;">${sec.title}</span><br><span style="font-size:9px; color:var(--text-muted)">Vaga ${i+1}</span>`; } }
                            });
                        }
                    }
                    tableHtml += `<td style="font-size:10px;">${roleStr}</td>`;
                });
                tableHtml += `</tr>`;
            });
        }
        tableHtml += `</table></div>`;

        const div = document.createElement('div'); div.className = `stat-card`; div.style.padding = "20px"; div.style.marginBottom = "15px";
        
        let kpis = '';
        if(tipo === 'lugares') {
            let resumo = semanaData['quarta'] || {hc:'0', pct:'0', dw:'0'};
            kpis = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 15px;"><div class="si"><div class="si-l">Headcount (Quarta)</div><div class="si-v" style="font-size: 1.2rem;">${resumo.hc}</div></div><div class="si"><div class="si-l">Pct Proc. (Quarta)</div><div class="si-v" style="color:var(--success); font-size: 1.2rem;">${resumo.pct}</div></div><div class="si"><div class="si-l">Nec. DW (Quarta)</div><div class="si-v" style="color:var(--danger); font-size: 1.2rem;">${resumo.dw}</div></div></div>`;
        }

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px;">
                <div style="font-weight: 800; font-size: 1.2rem; color: var(--primary);"><i class="fas fa-calendar-week" style="margin-right: 8px;"></i> ${displayWeek}</div>
                <button class="btn-ghost" style="padding: 6px 12px; font-size: 0.75rem;" onclick="document.getElementById('hist-det-${tipo}-${index}').classList.toggle('hidden')"><i class="fas fa-search"></i> Ver Relatório</button>
            </div>
            ${kpis}
            ${tableHtml}
        `;
        container.appendChild(div);
    });
}

// =========================================================
// PRESENÇA MENSAL
// =========================================================

function loadPresencaData() { renderPresencaGrid(); }

function changePresencaMonth() {
    let val = document.getElementById('pres-month-select').value;
    if(val) {
        dbFirebase.ref('shopee_presenca_live/' + currentPresMes).off('value', presencaListener);
        currentPresMes = val;
        presencaListener = dbFirebase.ref('shopee_presenca_live/' + currentPresMes).on('value', snap => {
            livePresenca = snap.val() || {};
            if(!document.getElementById('view-presenca').classList.contains('hidden')) renderPresencaGrid(); 
            if(!document.getElementById('view-escala').classList.contains('hidden')){ if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailability(d.id)); updateSidebar(); } }
            if(!document.getElementById('view-escala-dc').classList.contains('hidden')){ if(currentUser && currentUser.r === 'admin') { escDiasConf.forEach(d => updateDropdownsAvailabilityDc(d.id)); updateSidebarDc(); } }
            if(!document.getElementById('view-sitelider').classList.contains('hidden')) renderSiteliderDashboard(); 
        });
    }
}

function getDaysInMonth(monthStr) {
    let parts = monthStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    return new Date(year, month, 0).getDate();
}

function renderPresencaGrid() {
    const tbody = document.getElementById('presenca-table-body'); if(!tbody) return;
    let daysCount = getDaysInMonth(currentPresMes);
    let isAdm = currentUser && currentUser.r === 'admin';

    let html = `<tr><th>COLABORADOR</th>`;
    for(let d = 1; d <= daysCount; d++) { html += `<th>${d}</th>`; }
    html += `<th class="tot-P">P</th><th class="tot-F">F</th><th class="tot-FG">FG</th><th class="tot-AT">AT</th></tr>`;

    operadoresList.forEach(colab => {
        let pCount = 0; let fCount = 0; let fgCount = 0; let atCount = 0;
        let colabData = livePresenca[colab] || {};
        html += `<tr><td>${colab}</td>`;
        for(let d = 1; d <= daysCount; d++) {
            let val = colabData[d] || '';
            if(val === 'P') pCount++; if(val === 'F') fCount++; if(val === 'FG') fgCount++; if(val === 'AT') atCount++;
            let badgeClass = val ? `badge-${val}` : 'badge-empty';
            let displayVal = val || '';
            let clickEvent = isAdm ? `onclick="openPresPopup('${colab}', ${d}, event)"` : '';
            html += `<td class="pres-cell" ${clickEvent}><div class="badge-pres ${badgeClass}">${displayVal}</div></td>`;
        }
        html += `<td class="tot-col tot-P">${pCount}</td><td class="tot-col tot-F">${fCount}</td><td class="tot-col tot-FG">${fgCount}</td><td class="tot-col tot-AT">${atCount}</td></tr>`;
    });
    tbody.innerHTML = html;
}

function openPresPopup(colab, dia, event) {
    activePresColab = colab; activePresDia = dia;
    const popup = document.getElementById('pres-popup'); popup.classList.remove('hidden');
    let x = event.pageX - 70; let y = event.pageY + 15; popup.style.left = x + 'px'; popup.style.top = y + 'px';
}

function setPresenca(val) {
    if(!livePresenca[activePresColab]) livePresenca[activePresColab] = {};
    livePresenca[activePresColab][activePresDia] = val;
    if(val === '') { delete livePresenca[activePresColab][activePresDia]; }
    dbFirebase.ref('shopee_presenca_live/' + currentPresMes).set(livePresenca);
    document.getElementById('pres-popup').classList.add('hidden');
}

document.addEventListener('click', function(e) {
    const popup = document.getElementById('pres-popup');
    if(!popup.classList.contains('hidden') && !e.target.closest('.pres-cell') && !e.target.closest('#pres-popup')) { popup.classList.add('hidden'); }
});