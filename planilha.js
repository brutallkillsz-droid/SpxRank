// Vercel Serverless Function: lê a planilha de controle (privada) com uma conta de serviço do Google.
// A planilha só precisa ser compartilhada (como Leitor) com o e-mail da conta de serviço.
// Variáveis de ambiente na Vercel (Settings > Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT = conteúdo inteiro do arquivo .json da conta de serviço
//   SHEET_ID               = ID da planilha (opcional; padrão = planilha regional abaixo)
// Devolve só Nome, Líder e as colunas de datas (nada de CPF, contrato etc.).
const crypto = require('crypto');

const SHEET_ID_PADRAO = '1zE6yZcKDIxBo2_MeYdNHkvNAo19zVd8Cy9ZOJtj3mkA';
const b64url = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
let tokenCache = { valor: null, expira: 0 };

async function obterToken(conta) {
    if (tokenCache.valor && Date.now() < tokenCache.expira) return tokenCache.valor;
    const agora = Math.floor(Date.now() / 1000);
    const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const corpo = b64url(JSON.stringify({
        iss: conta.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: agora, exp: agora + 3600
    }));
    const chave = String(conta.private_key || '').replace(/\\n/g, '\n');
    const assinatura = crypto.createSign('RSA-SHA256').update(`${cab}.${corpo}`).sign(chave);
    const jwt = `${cab}.${corpo}.${b64url(assinatura)}`;
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
    });
    const j = await r.json();
    if (!j.access_token) throw new Error('Falha na autenticação com o Google: ' + (j.error_description || j.error || r.status));
    tokenCache = { valor: j.access_token, expira: Date.now() + 50 * 60 * 1000 };
    return j.access_token;
}

const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const ehData = s => /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(String(s || '').trim());

function filtrarColunas(values) {
    let hi = -1;
    for (let i = 0; i < Math.min(values.length, 25); i++) {
        const cab = (values[i] || []).map(norm);
        if (cab.some(c => c.includes('NOME')) && cab.some(c => c.includes('LIDER'))) { hi = i; break; }
    }
    if (hi < 0) return [];
    const cab = values[hi].map(norm);
    let cNome = cab.findIndex(c => c.includes('NOME DO COLABORADOR'));
    if (cNome < 0) cNome = cab.findIndex(c => c.includes('NOME'));
    const cLider = cab.findIndex(c => c.includes('LIDER'));
    const cDatas = [];
    values[hi].forEach((v, i) => { if (i > cNome && ehData(v) && !cab[i].includes('ADMISSAO')) cDatas.push(i); });
    const cols = [cNome, cLider, ...cDatas];
    return values.slice(hi).map(l => cols.map(c => (l && l[c] != null ? l[c] : '')));
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
        const aba = String((req.query && req.query.aba) || '');
        if (!/^Controle-[A-Za-zÀ-ú]+$/.test(aba)) { res.statusCode = 400; return res.end(JSON.stringify({ erro: 'Aba inválida.' })); }
        if (!process.env.GOOGLE_SERVICE_ACCOUNT) { res.statusCode = 500; return res.end(JSON.stringify({ erro: 'GOOGLE_SERVICE_ACCOUNT não configurada na Vercel.' })); }
        const conta = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
        const token = await obterToken(conta);
        const range = encodeURIComponent(`'${aba}'!A1:AZ600`);
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID || SHEET_ID_PADRAO}/values/${range}?valueRenderOption=FORMATTED_VALUE`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const j = await r.json();
        if (!r.ok) {
            const msg = j.error && j.error.message ? j.error.message : 'erro ' + r.status;
            res.statusCode = r.status === 403 ? 403 : (r.status === 400 ? 404 : 502);
            const dica = r.status === 403 ? ` Compartilhe a planilha (Leitor) com ${conta.client_email}.` : '';
            return res.end(JSON.stringify({ erro: `Google: ${msg}.${dica}` }));
        }
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
        res.end(JSON.stringify({ aba, values: filtrarColunas(j.values || []) }));
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ erro: e.message || String(e) }));
    }
};
