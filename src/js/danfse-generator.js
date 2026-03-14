/**
 * NFS-e Freire — DANFSe Generator v4.0
 * Layout pixel-fiel ao modelo oficial (screenshot + PDF Utinga-BA)
 *
 * Estrutura exata do documento:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ [Logo NFSe] │  DANFSe v1.0 / Documento Auxiliar   │ [Mun+Seal]│
 *  ├─────────────────────────────────────────────────── ┬─────────┤
 *  │ Chave de Acesso da NFS-e                           │  [QR]   │
 *  │ <chave longa>                                      │         │
 *  │ Nº NFS-e │ Competência │ Data/Hora emissão NFS-e  │ texto   │
 *  │ Nº DPS   │ Série DPS   │ Data/Hora emissão DPS    │ autent. │
 *  ├────────────────────────────────────────────────────┴─────────┤
 *  │ EMITENTE DA NFS-e                                            │
 *  │ TOMADOR DO SERVIÇO                                           │
 *  │ INTERMEDIÁRIO DO SERVIÇO                                     │
 *  │ SERVIÇO PRESTADO                                             │
 *  │ TRIBUTAÇÃO MUNICIPAL                                         │
 *  │ TRIBUTAÇÃO FEDERAL                                           │
 *  │ VALOR TOTAL DA NFS-E                                         │
 *  │ TOTAIS APROXIMADOS DOS TRIBUTOS                              │
 *  │ INFORMAÇÕES COMPLEMENTARES                                   │
 *  └──────────────────────────────────────────────────────────────┘
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const safe  = (v, def = '-') => (v != null && String(v).trim() !== '' && v !== '0' && v !== 0) ? String(v).trim() : def;
const safeMoney = (v, def = '-') => { const n = parseFloat(v); return (!isNaN(n) && n !== 0) ? fmtBRL(n) : def; };
const safeMoneyZero = (v) => { const n = parseFloat(v); return isNaN(n) ? 'R$ 0,00' : fmtBRL(n); };
const fmtPct = (v) => { const n = parseFloat(v); return isNaN(n) ? '-' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`; };
const formatChave = (c) => String(c || '').replace(/(.{4})/g, '$1 ').trim();

const TRIB_ISSQN  = { '1':'Operação Tributável','2':'Imunidade','3':'Exportação de Serviços','4':'Não Incidência','5':'Suspensão da Exigibilidade' };
const RET_ISSQN   = { '1':'Não Retido','2':'Retido pelo Tomador','3':'Retido pelo Intermediário' };
const REG_ESP     = { '0':'Nenhum','1':'Ato Cooperado','2':'Estimativa','3':'ME Municipal','4':'Notário / Registrador','5':'Profissional Autônomo','6':'Sociedade de Profissionais','9':'Outros' };
const OP_SIMP     = { '1':'Não Optante','2':'MEI','3':'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)' };
const REG_APURSN  = {
  '1':'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2':'Regime de apuração dos tributos federais pelo Simples Nacional e ISSQN por fora',
  '3':'Regime de apuração dos tributos federais por fora e ISSQN pelo Simples Nacional',
};

// ─── Célula de campo padrão ────────────────────────────────────────────────────
// bordas: b=bottom, r=right (por padrão ambas ativas)
const cell = (label, value, { spanCol = 1, spanRow = 1, bold = false, accent = false, noRight = false } = {}) => {
  const cs = spanCol > 1 ? `grid-column:span ${spanCol};` : '';
  const rs = spanRow > 1 ? `grid-row:span ${spanRow};` : '';
  const valStyle = bold
    ? 'font-size:9.5pt;font-weight:700;' + (accent ? 'color:#1a4fa0;' : '')
    : 'font-size:8pt;font-weight:600;';
  const borderR = noRight ? '' : 'border-right:1px solid #ccc;';
  return `<div style="${cs}${rs}padding:3px 6px;${borderR}border-bottom:1px solid #e0e0e0;min-height:28px;">
    <div style="font-size:5.8pt;color:#666;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;font-weight:400;">${label}</div>
    <div style="${valStyle}line-height:1.3;">${value}</div>
  </div>`;
};

// ─── Logo NFSe SVG inline ──────────────────────────────────────────────────────
const NFSE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 50" style="height:38px;display:block;">
  <rect x="0" y="0" width="120" height="50" rx="4" fill="#1a56a6"/>
  <text x="10" y="30" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#fff">NFS</text>
  <text x="72" y="18" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#4fc3f7">e</text>
  <line x1="68" y1="22" x2="68" y2="40" stroke="#4fc3f7" stroke-width="1.5"/>
  <text x="72" y="36" font-family="Arial,sans-serif" font-size="6.5" fill="#fff">Nota Fiscal de</text>
</svg>`;

// ─── Gerador principal ─────────────────────────────────────────────────────────
export function generateDANFSeHTML(nfseData) {
  const d      = nfseData || getDemoNFSeData();
  const mun    = d.mun   || {};
  const prest = d.prest || {};
  const toma  = d.toma  || {};
  const interm = d.interm || null;
  const serv  = d.serv  || {};
  const tm    = d.tribMun || {};
  const tf    = d.tribFed || {};
  const tot   = d.totais  || {};
  const ap    = d.totApro || {};

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(d.chaveAcesso || '')}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFSe — NFS-e N° ${safe(d.nNFSe,'')}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
    border: 1px solid #666;
    border-collapse: collapse;
  }
  /* ── Cabeçalho top ── */
  .hdr {
    display: grid;
    grid-template-columns: 100px 1fr 220px;
    border-bottom: 1px solid #aaa;
  }
  .hdr-logo {
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #ccc;
  }
  .hdr-title {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-right: 1px solid #ccc;
  }
  .hdr-title-main { font-size: 13pt; font-weight: 800; color: #111; }
  .hdr-title-sub  { font-size: 8pt;  color: #444; margin-top: 2px; }
  .hdr-mun {
    padding: 5px 8px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 7px;
  }
  .hdr-mun-brasao {
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    object-fit: contain;
  }
  .hdr-mun-txt {
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.45;
  }
  .hdr-mun-nome { font-weight: 700; font-size: 7.5pt; text-transform: uppercase; }
  .hdr-mun-pref { font-size: 6.8pt; }
  .hdr-mun-cnt  { color: #555; font-size: 6.5pt; }
  /* ── Bloco Chave + QR ── */
  .chave-bloco {
    display: grid;
    grid-template-columns: 1fr 104px;
    border-bottom: 1px solid #aaa;
  }
  .chave-esq { padding: 5px 8px; border-right: 1px solid #ccc; }
  .chave-lbl  { font-size: 6pt; color: #666; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
  .chave-val  {
    font-family: 'Courier New', monospace;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 1px;
    word-break: break-all;
    margin-bottom: 5px;
    color: #111;
  }
  .ident-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.5fr;
    border-top: 1px solid #ccc;
    margin-top: 4px;
  }
  .ident-cell { padding: 2px 5px 3px; border-right: 1px solid #e0e0e0; }
  .ident-cell:last-child { border-right: none; }
  .ident-lbl { font-size: 5.5pt; color: #777; text-transform: uppercase; }
  .ident-val  { font-size: 8pt; font-weight: 700; margin-top: 1px; }
  .chave-dir {
    padding: 6px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .chave-dir img  { width: 90px; height: 90px; }
  .chave-dir-txt  { font-size: 5pt; color: #777; text-align: center; line-height: 1.35; }
  /* ── Seções ── */
  .sec { border-bottom: 1px solid #aaa; }
  .sec-hdr {
    background: #d9d9d9;
    padding: 3px 7px;
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #111;
    border-bottom: 1px solid #bbb;
  }
  .grid { display: grid; }
  .g2 { grid-template-columns: 1fr 1fr; }
  .g3 { grid-template-columns: 1fr 1fr 1fr; }
  .g4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .g3-1 { grid-template-columns: 1.8fr 1fr 0.7fr; }
  .g2-1 { grid-template-columns: 1.2fr 0.8fr; }
  /* ── Intermediário ── */
  .interm-line {
    padding: 4px 8px;
    font-size: 7.5pt;
    font-style: italic;
    color: #444;
    text-align: center;
  }
  /* ── Desc. Serviço ── */
  .desc-bloco { padding: 4px 7px; font-size: 7.5pt; line-height: 1.4; }
  .desc-lbl   { font-size: 5.8pt; color: #666; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
  /* ── Totais aproximados ── */
  .tot-apro {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .tot-apro-cell {
    padding: 4px 8px;
    text-align: center;
    border-right: 1px solid #e0e0e0;
  }
  .tot-apro-cell:last-child { border-right: none; }
  .tot-apro-lbl { font-size: 6pt; color: #666; text-transform: uppercase; font-weight: 700; }
  .tot-apro-val { font-size: 8.5pt; font-weight: 600; margin-top: 2px; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
<div class="doc">

  <!-- ═══ CABEÇALHO ═══ -->
  <div class="hdr">
    <div class="hdr-logo">${NFSE_LOGO_SVG}</div>
    <div class="hdr-title">
      <div class="hdr-title-main">DANFSe v1.0</div>
      <div class="hdr-title-sub">Documento Auxiliar da NFS-e</div>
    </div>
    <div class="hdr-mun">
      ${mun.brasao ? `<img class="hdr-mun-brasao" src="${mun.brasao}" alt="Brasão do Município">` : ''}
      <div class="hdr-mun-txt">
        <div class="hdr-mun-nome">${safe(mun.nome, 'MUNICÍPIO EMISSOR')}</div>
        ${mun.prefeitura ? `<div class="hdr-mun-pref">${mun.prefeitura}</div>` : ''}
        ${mun.fone     ? `<div class="hdr-mun-cnt">${mun.fone}</div>` : ''}
        ${mun.email    ? `<div class="hdr-mun-cnt">${mun.email}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- ═══ CHAVE DE ACESSO + QR + IDENTIFICAÇÃO ═══ -->
  <div class="chave-bloco">
    <div class="chave-esq">
      <div class="chave-lbl">Chave de Acesso da NFS-e</div>
      <div class="chave-val">${formatChave(d.chaveAcesso)}</div>
      <div class="ident-grid">
        <div class="ident-cell">
          <div class="ident-lbl">Número da NFS-e</div>
          <div class="ident-val">${safe(d.nNFSe)}</div>
        </div>
        <div class="ident-cell">
          <div class="ident-lbl">Competência da NFS-e</div>
          <div class="ident-val">${safe(d.dCompet)}</div>
        </div>
        <div class="ident-cell" style="border-right:none;">
          <div class="ident-lbl">Data e Hora da emissão da NFS-e</div>
          <div class="ident-val">${safe(d.dhNFSe || d.dhProc)}</div>
        </div>
      </div>
      <div class="ident-grid" style="border-top:1px solid #e0e0e0;">
        <div class="ident-cell">
          <div class="ident-lbl">Número da DPS</div>
          <div class="ident-val">${safe(d.nDPS)}</div>
        </div>
        <div class="ident-cell">
          <div class="ident-lbl">Série da DPS</div>
          <div class="ident-val">${safe(d.serie)}</div>
        </div>
        <div class="ident-cell" style="border-right:none;">
          <div class="ident-lbl">Data e Hora da emissão da DPS</div>
          <div class="ident-val">${safe(d.dhDPS || d.dhProc)}</div>
        </div>
      </div>
    </div>
    <div class="chave-dir">
      <img src="${qrUrl}" alt="QR Code" onerror="this.style.background='#eee';this.alt='QR'">
      <div class="chave-dir-txt">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e</div>
    </div>
  </div>

  <!-- ═══ EMITENTE DA NFS-e ═══ -->
  <div class="sec">
    <div class="sec-hdr">Emitente da NFS-e &nbsp;·&nbsp; Prestador do Serviço</div>
    <div class="grid g3">
      ${cell('CNPJ / CPF / NIF', safe(prest.doc))}
      ${cell('Inscrição Municipal', safe(prest.IM))}
      ${cell('Telefone', safe(prest.fone), { noRight: true })}
    </div>
    <div class="grid g2">
      ${cell('Nome / Nome Empresarial', safe(prest.xNome))}
      ${cell('E-mail', safe(prest.email), { noRight: true })}
    </div>
    <div class="grid g3-1">
      ${cell('Endereço', safe(prest.endereco))}
      ${cell('Município', safe(prest.municipio))}
      ${cell('CEP', safe(prest.cep), { noRight: true })}
    </div>
    ${(prest.opSimpNac && prest.opSimpNac !== '0')
      ? `<div class="grid g2">
           ${cell('Simples Nacional na Data de Competência', OP_SIMP[prest.opSimpNac] || safe(prest.opSimpNac))}
           ${cell('Regime de Apuração Tributária pelo SN', REG_APURSN[prest.regApurSN] || safe(prest.regApurSN), { noRight: true })}
         </div>`
      : ''}
  </div>

  <!-- ═══ TOMADOR DO SERVIÇO ═══ -->
  <div class="sec">
    <div class="sec-hdr">Tomador do Serviço</div>
    <div class="grid g3">
      ${cell('CNPJ / CPF / NIF', safe(toma.doc))}
      ${cell('Inscrição Municipal', safe(toma.IM))}
      ${cell('Telefone', safe(toma.fone), { noRight: true })}
    </div>
    <div class="grid g2">
      ${cell('Nome / Nome Empresarial', safe(toma.xNome))}
      ${cell('E-mail', safe(toma.email), { noRight: true })}
    </div>
    <div class="grid g3-1">
      ${cell('Endereço', safe(toma.endereco))}
      ${cell('Município', safe(toma.municipio))}
      ${cell('CEP', safe(toma.cep), { noRight: true })}
    </div>
  </div>

  <!-- ═══ INTERMEDIÁRIO DO SERVIÇO ═══ -->
  <div class="sec">
    <div class="sec-hdr">Intermediário do Serviço</div>
    ${(interm && (interm.doc || interm.xNome))
      ? `<div class="grid g2">
           ${cell('CNPJ / CPF / NIF', safe(interm.doc))}
           ${cell('Nome / Nome Empresarial', safe(interm.xNome), { noRight: true })}
         </div>`
      : `<div class="interm-line">NÃO IDENTIFICADO NA NFS-e</div>`}
  </div>

  <!-- ═══ SERVIÇO PRESTADO ═══ -->
  <div class="sec">
    <div class="sec-hdr">Serviço Prestado</div>
    <div class="grid g4">
      ${cell('Código de Tributação Nacional', safe(serv.cTribNac))}
      ${cell('Código de Tributação Municipal', safe(serv.cTribMun))}
      ${cell('Local da Prestação', safe(serv.localPrest))}
      ${cell('País da Prestação', safe(serv.cPaisPrest), { noRight: true })}
    </div>
    <div class="desc-bloco" style="border-bottom:1px solid #e0e0e0;">
      <div class="desc-lbl">Descrição do Serviço</div>
      ${safe(serv.xDescServ, 'Não informado')}
    </div>
  </div>

  <!-- ═══ TRIBUTAÇÃO MUNICIPAL ═══ -->
  <div class="sec">
    <div class="sec-hdr">Tributação Municipal</div>
    <!-- Linha 1: Tribut. ISSQN | País Resultado | Município Incidência | Regime Especial -->
    <div class="grid g4">
      ${cell('Tributação do ISSQN', TRIB_ISSQN[tm.tribISSQN] || safe(tm.tribISSQN))}
      ${cell('País Resultado da Prestação do Serviço', safe(tm.cPaisResult))}
      ${cell('Município de Incidência do ISSQN', safe(tm.cLocIncid || serv.localPrest))}
      ${cell('Regime Especial de Tributação', REG_ESP[tm.regEspTrib] || safe(tm.regEspTrib, 'Nenhum'), { noRight: true })}
    </div>
    <!-- Linha 2: Tipo Imunidade | Suspensão | Nº Processo | Benefício Municipal -->
    <div class="grid g4">
      ${cell('Tipo de Imunidade', safe(tm.tpImunidade))}
      ${cell('Suspensão da Exigibilidade do ISSQN', (tm.tpSusp && tm.tpSusp !== '0') ? 'Sim' : 'Não')}
      ${cell('Número Processo Suspensão', safe(tm.nProcesso))}
      ${cell('Benefício Municipal', safe(tm.nBM), { noRight: true })}
    </div>
    <!-- Linha 3: Valor Serviço | Desc. Incond. | Total Ded/Red | Cálculo BM -->
    <div class="grid g4">
      ${cell('Valor do Serviço', safeMoney(tm.vServ || tot.vServ))}
      ${cell('Desconto Incondicionado', safeMoney(tm.vDescIncond))}
      ${cell('Total Deduções/Reduções', safeMoney(tm.vDedRed))}
      ${cell('Cálculo do BM', safeMoney(tm.vCalcBM), { noRight: true })}
    </div>
    <!-- Linha 4: BC ISSQN | Alíquota | Retenção ISSQN | ISSQN Apurado -->
    <div class="grid g4">
      ${cell('BC ISSQN', safeMoney(tm.vBC || tot.vServ))}
      ${cell('Alíquota Aplicada', fmtPct(tm.pAliq))}
      ${cell('Retenção do ISSQN', RET_ISSQN[tm.tpRetISSQN] || safe(tm.tpRetISSQN, 'Não Retido'))}
      <div style="padding:3px 6px;border-bottom:1px solid #e0e0e0;min-height:28px;">
        <div style="font-size:5.8pt;color:#666;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">ISSQN Apurado</div>
        <div style="font-size:10pt;font-weight:700;color:#1a4fa0;line-height:1.2;">${safeMoneyZero(tm.vISSQN)}</div>
      </div>
    </div>
  </div>

  <!-- ═══ TRIBUTAÇÃO FEDERAL ═══ -->
  <div class="sec">
    <div class="sec-hdr">Tributação Federal</div>
    <!-- Linha 1: IRRF | CP Retido | PIS/COFINS/CSLL Retidos -->
    <div class="grid g3">
      ${cell('IRRF', safeMoney(tf.vIRRF))}
      ${cell('CP Retido', safeMoney(tf.vRetCP))}
      ${cell('PIS/COFINS/CSLL Retidos', safeMoney(tf.vRetPisCofinsCSLL), { noRight: true })}
    </div>
    <!-- Linha 2: PIS Devido | COFINS Devido | Retenção PIS/COFINS/CSLL | TOTAL -->
    <div class="grid g4">
      ${cell('PIS Devido', safeMoneyZero(tf.vPIS))}
      ${cell('COFINS Devido', safeMoneyZero(tf.vCofins))}
      ${cell('Retenção do PIS/COFINS/CSLL', safe(tf.tpRetPisCofins, 'Não Retido'))}
      <div style="padding:3px 6px;border-bottom:1px solid #e0e0e0;min-height:28px;">
        <div style="font-size:5.8pt;color:#666;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">TOTAL TRIBUTAÇÃO FEDERAL</div>
        <div style="font-size:9.5pt;font-weight:700;color:#1a4fa0;line-height:1.2;">${safeMoneyZero(tf.vTotFed)}</div>
      </div>
    </div>
  </div>

  <!-- ═══ VALOR TOTAL DA NFS-E ═══ -->
  <div class="sec">
    <div class="sec-hdr">Valor Total da NFS-e</div>
    <!-- Linha 1: Valor Serviço | Desc. Condicionado | Desc. Incondicionado | ISSQN Retido -->
    <div class="grid g4">
      ${cell('Valor do Serviço', safeMoneyZero(tot.vServ), { bold: true })}
      ${cell('Desconto Condicionado', safeMoney(tot.vDescCond, 'R$'))}
      ${cell('Desconto Incondicionado', safeMoney(tot.vDescIncond, 'R$'))}
      ${cell('ISSQN Retido', safeMoney(tot.vISSQNRet), { noRight: true })}
    </div>
    <!-- Linha 2: IRRF,CP,PIS,COFINS,CSLL | PIS/COFINS Devidos | Valor Líquido -->
    <div class="grid g3">
      ${cell('IRRF, CP, PIS, COFINS, CSLL', safeMoneyZero(tot.vTribFed))}
      ${cell('PIS/COFINS Devidos', safeMoney(tot.vPisCofinsDev))}
      <div style="padding:3px 6px;border-bottom:1px solid #e0e0e0;min-height:28px;">
        <div style="font-size:5.8pt;color:#666;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">Valor Líquido da NFS-e</div>
        <div style="font-size:10.5pt;font-weight:700;color:#1a4fa0;line-height:1.2;">${safeMoneyZero(tot.vLiq)}</div>
      </div>
    </div>
  </div>

  <!-- ═══ TOTAIS APROXIMADOS DOS TRIBUTOS ═══ -->
  <div class="sec">
    <div class="sec-hdr">Totais Aproximados dos Tributos</div>
    <div class="tot-apro">
      <div class="tot-apro-cell">
        <div class="tot-apro-lbl">Federais</div>
        <div class="tot-apro-val">${safeMoneyZero(ap.vFed)}</div>
      </div>
      <div class="tot-apro-cell">
        <div class="tot-apro-lbl">Estaduais</div>
        <div class="tot-apro-val">${safeMoneyZero(ap.vEst)}</div>
      </div>
      <div class="tot-apro-cell" style="border-right:none;">
        <div class="tot-apro-lbl">Municipais</div>
        <div class="tot-apro-val">${safeMoneyZero(ap.vMun)}</div>
      </div>
    </div>
  </div>

  ${(d.xInfComp || d.nbs)
    ? `<!-- ═══ INFORMAÇÕES COMPLEMENTARES ═══ -->
       <div class="sec">
         <div class="sec-hdr">Informações Complementares</div>
         <div class="desc-bloco">
           ${[d.xInfComp, d.nbs ? `NBS: ${d.nbs}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}
         </div>
       </div>`
    : ''}

</div>
</body>
</html>`;
}

// ─── Abrir em nova janela ──────────────────────────────────────────────────────
export function openDANFSe(nfseData) {
  const html = generateDANFSeHTML(nfseData);
  const win = window.open('', '_blank', 'width=860,height=1200');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 700);
  }
  return html;
}

// ─── Download HTML ─────────────────────────────────────────────────────────────
export function downloadDANFSeHTML(nfseData) {
  const html = generateDANFSeHTML(nfseData);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `DANFSe_${nfseData?.nNFSe || 'preview'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Dados demo — baseados no modelo oficial Utinga-BA ────────────────────────
function getDemoNFSeData() {
  return {
    mun: {
      nome:      'MUNICIPIO DE UTINGA - BA',
      prefeitura:'PREFEITURA MUNICIPAL DE UTINGA - BA',
      fone:      '(75)98896-1465',
      email:     'tributosutinga@gmail.com',
      brasao:    '',
    },
    nNFSe:      '1',
    chaveAcesso:'29328041255443616000129000000000000126010000813139',
    dCompet:    '14/01/2026',
    dhNFSe:     '14/01/2026 11:10:00',
    nDPS:       '81313',
    serie:      '20262',
    dhDPS:      '14/01/2026 11:10:00',
    prest: {
      doc:       '55.443.616/0001-29',
      xNome:     'VICTORIA CASTRO DANTAS',
      IM:        '6262000989',
      fone:      '(71) 9960-5548',
      email:     'viccastro1@hotmail.com',
      endereco:  'PÇA ANTONIO MUNIZ, N° 02, Não Informado, CENTRO',
      municipio: 'UTINGA - BA',
      cep:       '46810-000',
      opSimpNac: '3',
      regApurSN: '1',
      regEspTrib:'0',
    },
    toma: {
      doc:       '14.284.483/0001-08',
      xNome:     'ASSOCIACAO DE PROTECAO A MATERNIDADE E INFANCIA UBAIRA',
      IM:        '',
      fone:      '',
      email:     '',
      endereco:  'R ANTONIO TEIXEIRA DELLA CELLA, SN, NA, CENTRO',
      municipio: 'Ubaíra - BA',
      cep:       '45310-000',
    },
    interm: null,
    serv: {
      cTribNac:   '04.03.01 - HOSPITAIS, CLÍNICAS, LABORATÓRIOS, SANATÓRIOS, MANICÔMIOS...',
      cTribMun:   '- HOSPITAIS, CLÍNICAS, LABORATÓRIOS, SANATÓRIOS, MANICÔMIOS...',
      localPrest: 'UTINGA - BA',
      cPaisPrest: '',
      xDescServ:  'Referente a serviços médicos prestados (ambulatório de Clínica médica), pelo sócio Ademir dos Santos, na Unidade Especializada Multicentro de Saúde Liberdade, conforme estabelecido em contrato, nas seguintes datas: 03, 04, 10, 15, 17, 18, 19, 22, 23, 29 e 30 de Dezembro de 2025.',
    },
    tribMun: {
      tribISSQN:  '1',
      cPaisResult:'',
      cLocIncid:  'UTINGA - BA',
      regEspTrib: '0',
      tpImunidade:'',
      tpSusp:     '0',
      nProcesso:  '',
      nBM:        '',
      vServ:       14195.00,
      vDescIncond: 0,
      vDedRed:     0,
      vCalcBM:     0,
      vBC:         14195.00,
      pAliq:       2.00,
      tpRetISSQN: '1',
      vISSQN:      283.90,
    },
    tribFed: {
      vIRRF:              0,
      vRetCP:             0,
      vRetPisCofinsCSLL:  0,
      vPIS:               0,
      vCofins:            0,
      tpRetPisCofins:     'Não Retido',
      vTotFed:            0,
    },
    totais: {
      vServ:       14195.00,
      vDescCond:   0,
      vDescIncond: 0,
      vISSQNRet:   0,
      vTribFed:    0,
      vPisCofinsDev: 0,
      vLiq:        14195.00,
    },
    totApro: { vFed: 0, vEst: 0, vMun: 0 },
    xInfComp: 'Nome: VICTORIA CASTRO DANTAS',
    nbs:      '123012100',
  };
}
