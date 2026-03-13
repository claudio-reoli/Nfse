/**
 * NFS-e Freire — Consulta de Notas Importadas (Módulo Município)
 */
import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';
import { formatMunicipioDisplaySync, formatEnderecoMunicipio, formatEstrangeiroDisplay } from '../municipios-ibge.js';

const fmtCNPJ = (v) => { if (!v || v.length < 14) return v || '—'; return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"); };
const fmtCPF = (v) => { if (!v || v.length < 11) return v || ''; return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); };
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtPct = (v) => {
  if (v == null || v === '') return '—';
  const num = Number(v);
  const pct = num <= 1 && num > 0 ? num * 100 : num;
  return `${pct.toFixed(2)}%`;
};
const fmtDoc = (p) => p?.CNPJ ? fmtCNPJ(p.CNPJ) : p?.CPF ? fmtCPF(p.CPF) : '—';
const fmtData = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleString('pt-BR'); } catch { return v; } };
const fmtDataCurta = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; } };
const safe = (v) => v || '—';

const TRIB_ISSQN_MAP = { '1': 'Tributável', '2': 'Imunidade', '3': 'Exportação', '4': 'Não Incidência' };
const RET_ISSQN_MAP = { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' };
const TP_EMIT_MAP = { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' };
const OP_SIMP_MAP = { '1': 'Não Optante', '2': 'MEI', '3': 'ME/EPP' };
const REG_ESP_MAP = { '0': 'Nenhum', '1': 'Ato Cooperado', '2': 'Estimativa', '3': 'ME Municipal', '4': 'Notário', '5': 'Autônomo', '6': 'Soc. Profissionais', '9': 'Outros' };
const MD_PREST_MAP = { '0': 'Desconhecido', '1': 'Transfronteiriço', '2': 'Consumo no Brasil', '3': 'Presença Comercial Ext.', '4': 'Mov. Temp. PF' };

function buildEnderecoHtml(end, xLocEmissor) {
  if (!end) return '';
  const cPais = end.cPais || end.cPaisPrestacao;
  if (cPais && String(cPais).toUpperCase() !== 'BR') {
    const ext = formatEstrangeiroDisplay(cPais, end.xCidade, end.xEstProvReg || end.xEstProv);
    if (ext) return ext;
  }
  const parts = [];
  if (end.xLgr) parts.push(`${end.xLgr}${end.nro ? ', ' + end.nro : ''}`);
  if (end.xCpl) parts.push(end.xCpl);
  if (end.xBairro) parts.push(end.xBairro);
  if (end.CEP) parts.push(`CEP ${end.CEP}`);
  const munDisplay = formatEnderecoMunicipio(end, xLocEmissor) || (end.cMun ? formatMunicipioDisplaySync(end.cMun, end.xMun, end.UF || end.uf) : '');
  if (munDisplay) parts.push(munDisplay);
  return parts.join(' — ') || '';
}

function buildPessoaCard(title, p) {
  if (!p || (!p.CNPJ && !p.CPF && !p.NIF && !p.xNome)) return '';
  const isEstrangeiro = !!(p.NIF && !p.CNPJ && !p.CPF);
  const doc = p.CNPJ ? `CNPJ: ${fmtCNPJ(p.CNPJ)}` : p.CPF ? `CPF: ${fmtCPF(p.CPF)}` : p.NIF ? `NIF: ${p.NIF}${isEstrangeiro ? ' <span class="badge badge-warning" style="font-size:0.65rem;">Estrangeiro</span>' : ''}` : '';
  const nif = (p.NIF && (p.CNPJ || p.CPF)) ? `<div>NIF: ${p.NIF}</div>` : '';
  const im = p.IM ? `<div>IM: ${p.IM}</div>` : '';
  const caepf = p.CAEPF ? `<div>CAEPF: ${p.CAEPF}</div>` : '';
  const contato = [p.fone ? `Tel: ${p.fone}` : '', p.email || ''].filter(Boolean).join(' | ');
  const endereco = buildEnderecoHtml(p.endereco);
  const extras = [];
  if (p.opSimpNac) extras.push(`SN: ${OP_SIMP_MAP[p.opSimpNac] || p.opSimpNac}`);
  if (p.regEspTrib) extras.push(`Reg.Esp: ${REG_ESP_MAP[p.regEspTrib] || p.regEspTrib}`);

  return `<div style="padding:12px;background:var(--surface-glass);border-radius:var(--radius-sm);margin-bottom:8px;">
    <div style="font-size:0.75rem;color:var(--color-neutral-400);text-transform:uppercase;margin-bottom:4px;">${title}</div>
    <strong>${safe(p.xNome)}</strong>
    <div style="font-size:0.85rem;">${doc}</div>
    ${nif}${im}${caepf}
    ${contato ? `<div style="font-size:0.82rem;color:var(--color-neutral-300);">${contato}</div>` : ''}
    ${endereco ? `<div style="font-size:0.8rem;color:var(--color-neutral-400);margin-top:2px;">${endereco}</div>` : ''}
    ${extras.length ? `<div style="font-size:0.8rem;margin-top:3px;">${extras.join(' | ')}</div>` : ''}
  </div>`;
}

function buildRow(label, value, color) {
  if (value === '—' || value === '' || value === undefined || value === null) return '';
  const style = color ? `color:${color};` : '';
  return `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
    <span style="color:var(--color-neutral-400);">${label}</span>
    <strong style="${style}">${value}</strong>
  </div>`;
}

export function renderConsultaNotasMun(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Notas Importadas da Base Nacional (ADN)</h1>
        <p class="page-description">Consulta ao repositório local de NFS-e sincronizadas — todos os campos da API ADN.</p>
      </div>
      <button class="btn btn-secondary" onclick="window.location.hash='/dashboard'">
        <i class="fas fa-arrow-left"></i> Voltar ao Painel
      </button>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <input type="text" class="form-input" id="filtro-pesquisa" placeholder="Buscar por Chave, CNPJ, Nome, Serviço..." style="max-width: 350px;">
        <button class="btn btn-secondary" id="btn-buscar">🔍 Buscar</button>
      </div>
      
      <div class="table-container">
        <table class="data-table data-table--notas-adn" id="tabela-notas">
          <thead>
            <tr>
              <th>NSU / Competência</th>
              <th>Chave da NFS-e</th>
              <th>Prestador</th>
              <th>Tomador</th>
              <th>Serviço</th>
              <th>Valor (R$)</th>
              <th>ISS</th>
              <th>Fonte</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="9" style="text-align: center;">Carregando notas...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="modal-detalhes" class="modal-overlay hidden" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;display:none;">
      <div class="card" style="width:100%;max-width:900px;max-height:92vh;overflow-y:auto;position:relative;">
        <button id="fechar-modal-det" class="btn btn-ghost" style="position:absolute;right:10px;top:10px;font-weight:bold;color:var(--color-danger-400);z-index:10;">✕</button>
        <div class="card-header">
          <h3 class="card-title">Dados completos da NFS-e</h3>
          <p style="font-size:0.8rem;color:var(--color-neutral-400);margin-top:4px;">Agrupados por: Dados Gerais, Partes, Serviço, Valores, Tributos e demais blocos de negócio</p>
        </div>
        <div class="card-body" id="detalhes-conteudo" style="padding:20px;"></div>
      </div>
    </div>
  `;

  let localNotasData = [];

  const getNome = (p) => p?.xNome || p?.nome || '—';
  const getDoc = (p) => p?.CNPJ || p?.cnpj || p?.CPF || p?.cpf || '';
  const getValor = (n) => n.valores?.vServ ?? n.valorServico ?? 0;
  const getCompet = (n) => n.dadosGerais?.dCompet || n.competencia || '';
  const getAliq = (n) => n.tributos?.issqn?.pAliq ?? n.aliquota ?? 0;
  const getTribDesc = (n) => {
    const t = n.tributos?.issqn?.tribISSQN;
    return TRIB_ISSQN_MAP[t] || '';
  };
  const getRetDesc = (n) => {
    const r = n.tributos?.issqn?.tpRetISSQN;
    return r ? (RET_ISSQN_MAP[r] || r) : (n.issRetidoFonte ? 'Retido' : '');
  };
  const getServDesc = (n) => n.servico?.xDescServ || '—';

  function renderNotasTable(notas) {
    const tbody = document.getElementById('tabela-notas').querySelector('tbody');
    tbody.innerHTML = '';

    if (!notas || notas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhuma nota encontrada.</td></tr>';
      return;
    }

    notas.forEach((n) => {
      const tr = document.createElement('tr');
      const fonteBadge = n._fonte === 'ADN'
        ? '<span class="badge badge-success" style="font-size:0.7rem;">ADN</span>'
        : '<span class="badge badge-warning" style="font-size:0.7rem;">Local</span>';
      const chave = n.chaveAcesso || '';
      const prestNome = getNome(n.prestador);
      const prestDoc = getDoc(n.prestador);
      const tomaNome = getNome(n.tomador);
      const tomaDoc = getDoc(n.tomador);
      const aliq = getAliq(n);
      const retInfo = getRetDesc(n);

      tr.innerHTML = `
        <td>
          <div style="font-weight:500;">NSU ${n.nsu}</div>
          <div style="font-size:0.8rem;color:var(--color-neutral-400);">${getCompet(n)}</div>
        </td>
        <td class="text-mono" title="${chave}">${chave || '—'}</td>
        <td>
          <div style="font-weight:500;">${prestNome}</div>
          <div class="text-mono" style="font-size:0.78rem;color:var(--color-neutral-400);">${fmtCNPJ(prestDoc)}</div>
        </td>
        <td>
          <div style="font-weight:500;">${tomaNome}</div>
          <div class="text-mono" style="font-size:0.78rem;color:var(--color-neutral-400);">${fmtCNPJ(tomaDoc)}</div>
        </td>
        <td style="font-size:0.82rem;">${getServDesc(n)}</td>
        <td style="font-weight:600;color:var(--color-primary-400);">${fmtBRL(getValor(n))}</td>
        <td style="font-size:0.82rem;">
          <div>${aliq ? fmtPct(aliq) : '—'}</div>
          <div style="font-size:0.75rem;color:${retInfo.includes('Retido') && !retInfo.includes('Não') ? 'var(--color-danger-400)' : 'var(--color-success-400)'};">${retInfo || '—'}</div>
        </td>
        <td style="text-align:center;">${fonteBadge}</td>
        <td>
          <button class="btn btn-primary btn-sm btn-detalhes" data-chave="${chave}" title="Exibir todos os dados da nota agrupados por negócio">
            <i class="fas fa-file-invoice"></i> Ver dados completos
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('tabela-notas')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-detalhes');
    if (!btn) return;
    const chave = btn.dataset.chave;
    const nota = localNotasData.find(n => n.chaveAcesso === chave);
    if (nota) abrirModalDetalhes(nota);
  });

  async function loadNotas() {
    try {
      const response = await fetch(`${getBackendUrl()}/municipio/notas`);
      const data = await response.json();
      if (!data.sucesso || data.notas.length === 0) { renderNotasTable([]); return; }
      localNotasData = data.notas;
      renderNotasTable(localNotasData);
    } catch (err) {
      console.error('Erro ao carregar NFSe:', err);
      document.getElementById('tabela-notas').querySelector('tbody').innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:var(--color-danger-400);">Erro ao conectar ao Backend-município.</td></tr>';
    }
  }

  function abrirModalDetalhes(n) {
    const g = n.dadosGerais || {};
    const s = n.servico || {};
    const v = n.valores || {};
    const ti = n.tributos?.issqn || {};
    const tf = n.tributos?.federal || {};
    const tt = n.tributos?.totais || {};
    const ib = n.ibscbs || {};
    const ce = n.comercioExterior || {};
    const ob = n.obra || {};
    const ev = n.atvEvt || {};
    const im = n.imovel || {};
    const dr = v.dedRed || {};

    const retIss = RET_ISSQN_MAP[ti.tpRetISSQN] || (n.issRetidoFonte ? 'Retido' : 'Não Retido');
    const isRetido = ti.tpRetISSQN === '2' || ti.tpRetISSQN === '3' || n.issRetidoFonte;

    let html = '';

    html += `<div style="margin-bottom:14px;">
      <span style="font-size:0.75rem;color:var(--color-neutral-400);">CHAVE DE ACESSO PADRÃO NACIONAL</span><br>
      <strong style="word-break:break-all;color:var(--color-primary-400);font-family:monospace;font-size:0.9rem;">${n.chaveAcesso || '—'}</strong>
    </div>`;

    html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">DADOS GERAIS</div>`;
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
    html += buildRow('NSU', n.nsu);
    html += buildRow('Série / Nº DPS', `${safe(g.serie)} / ${safe(g.nDPS)}`);
    html += buildRow('Data Emissão', fmtData(g.dhEmi));
    html += buildRow('Competência', safe(g.dCompet));
    html += buildRow('Município Emissor', formatMunicipioDisplaySync(g.cLocEmi, g.xLocEmi, g.uf) || safe(g.cLocEmi));
    html += buildRow('Emitente', TP_EMIT_MAP[g.tpEmit] || safe(g.tpEmit));
    html += buildRow('Finalidade', g.finNFSe === '0' ? 'Regular' : safe(g.finNFSe));
    html += buildRow('Versão Aplicação', safe(g.verAplic));
    html += buildRow('Status', n.status, n.status === 'Ativa' ? 'var(--color-success-400)' : 'var(--color-danger-400)');
    html += buildRow('Importado em', fmtData(n._importadoEm));
    html += '</div>';
    if (g.xInfComp) html += `<div style="margin-top:6px;font-size:0.82rem;padding:8px;background:var(--surface-glass);border-radius:var(--radius-sm);"><strong>Info Complementar:</strong> ${g.xInfComp}</div>`;
    if (g.chSubstda) html += `<div style="margin-top:4px;font-size:0.82rem;">Substitui: <code>${g.chSubstda}</code> — Motivo: ${safe(g.xMotivo)} (${safe(g.cMotivo)})</div>`;

    html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">PARTES</div>`;
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    html += buildPessoaCard('PRESTADOR', n.prestador);
    html += buildPessoaCard('TOMADOR', n.tomador);
    html += '</div>';
    if (n.intermediario?.CNPJ || n.intermediario?.xNome) html += buildPessoaCard('INTERMEDIÁRIO', n.intermediario);
    if (n.destinatario?.CNPJ || n.destinatario?.xNome) html += buildPessoaCard('DESTINATÁRIO', n.destinatario);

    html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">SERVIÇO</div>`;
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
    html += buildRow('Cód. Trib. Nacional', safe(s.cTribNac));
    html += buildRow('Cód. Trib. Municipal', safe(s.cTribMun));
    html += buildRow('Cód. NBS', safe(s.cNBS));
    html += buildRow('Local Prestação', (s.cPaisPrestacao && String(s.cPaisPrestacao).toUpperCase() !== 'BR')
      ? (formatEstrangeiroDisplay(s.cPaisPrestacao) || `Exterior — País: ${s.cPaisPrestacao}`)
      : formatMunicipioDisplaySync(s.cLocPrestacao, s.xLocPrestacao, s.uf) || safe(s.cLocPrestacao));
    html += buildRow('País Prestação', safe(s.cPaisPrestacao));
    html += buildRow('Modo Prestação', MD_PREST_MAP[s.mdPrestacao] || safe(s.mdPrestacao));
    html += buildRow('Vínculo', safe(s.vincPrest));
    html += buildRow('Moeda', safe(s.tpMoeda));
    html += buildRow('Valor Moeda Ext.', s.vServMoeda ? fmtBRL(s.vServMoeda) : '—');
    html += buildRow('Cód. Interno', safe(s.cIntContrib));
    html += '</div>';
    if (s.xDescServ) html += `<div style="margin-top:6px;font-size:0.82rem;padding:8px;background:var(--surface-glass);border-radius:var(--radius-sm);"><strong>Descrição:</strong> ${s.xDescServ}</div>`;

    html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">VALORES</div>`;
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
    html += buildRow('Valor dos Serviços', fmtBRL(v.vServ), 'var(--color-primary-400)');
    html += buildRow('Desc. Incondicionado', v.vDescIncond ? fmtBRL(v.vDescIncond) : '—');
    html += buildRow('Desc. Condicionado', v.vDescCond ? fmtBRL(v.vDescCond) : '—');
    html += buildRow('Valor Líquido', v.vLiq ? fmtBRL(v.vLiq) : '—', 'var(--color-success-400)');
    html += buildRow('Valor Recebido Interm.', v.vReceb ? fmtBRL(v.vReceb) : '—');
    html += '</div>';
    if (dr.pDR || dr.vDR) {
      html += '<div style="margin-top:4px;font-size:0.82rem;">';
      html += `Dedução/Redução: ${dr.pDR ? fmtPct(dr.pDR / 100) : ''} ${dr.vDR ? fmtBRL(dr.vDR) : ''} — ${(dr.documentos || []).length} doc(s)`;
      html += '</div>';
    }

    html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">TRIBUTOS — ISSQN</div>`;
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
    html += buildRow('Tributação', TRIB_ISSQN_MAP[ti.tribISSQN] || safe(ti.tribISSQN));
    html += buildRow('Alíquota ISS', ti.pAliq ? fmtPct(ti.pAliq) : '—');
    html += buildRow('Retenção ISS', retIss, isRetido ? 'var(--color-danger-400)' : 'var(--color-success-400)');
    html += buildRow('País Resultado', safe(ti.cPaisResult));
    html += buildRow('Imunidade', safe(ti.tpImunidade));
    html += buildRow('Exig. Suspensa', safe(ti.tpSusp));
    html += buildRow('Nº Processo', safe(ti.nProcesso));
    html += buildRow('Benefício Municipal', safe(ti.nBM));
    html += buildRow('Red. BC (BM) R$', ti.vRedBCBM ? fmtBRL(ti.vRedBCBM) : '—');
    html += buildRow('Red. BC (BM) %', ti.pRedBCBM ? fmtPct(ti.pRedBCBM / 100) : '—');
    html += '</div>';

    const hasFed = tf.CST || tf.vBCPisCofins || tf.pAliqPis || tf.vRetCP || tf.vRetIRRF || tf.vRetCSLL;
    if (hasFed) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">TRIBUTOS — FEDERAIS</div>`;
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
      html += buildRow('CST PIS/COFINS', safe(tf.CST));
      html += buildRow('BC PIS/COFINS', tf.vBCPisCofins ? fmtBRL(tf.vBCPisCofins) : '—');
      html += buildRow('Alíq. PIS', tf.pAliqPis ? `${tf.pAliqPis}%` : '—');
      html += buildRow('Alíq. COFINS', tf.pAliqCofins ? `${tf.pAliqCofins}%` : '—');
      html += buildRow('PIS (apuração)', tf.vPis ? fmtBRL(tf.vPis) : '—');
      html += buildRow('COFINS (apuração)', tf.vCofins ? fmtBRL(tf.vCofins) : '—');
      html += buildRow('Tipo Ret. PIS/COFINS', safe(tf.tpRetPisCofins));
      html += buildRow('Ret. CP', tf.vRetCP ? fmtBRL(tf.vRetCP) : '—', 'var(--color-danger-400)');
      html += buildRow('Ret. IRRF', tf.vRetIRRF ? fmtBRL(tf.vRetIRRF) : '—', 'var(--color-danger-400)');
      html += buildRow('Ret. CSLL (PIS+COF+CSLL)', tf.vRetCSLL ? fmtBRL(tf.vRetCSLL) : '—', 'var(--color-danger-400)');
      html += '</div>';
    }

    const hasTot = tt.vTotTribFed || tt.vTotTribEst || tt.vTotTribMun;
    if (hasTot) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">TOTAL APROXIMADO DE TRIBUTOS</div>`;
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
      html += `<div style="padding:8px;background:var(--surface-glass);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:0.72rem;color:var(--color-neutral-400);">FEDERAL</div>
        <div style="font-weight:600;">${tt.vTotTribFed ? fmtBRL(tt.vTotTribFed) : '—'}</div>
        <div style="font-size:0.75rem;">${tt.pTotTribFed ? tt.pTotTribFed + '%' : ''}</div>
      </div>`;
      html += `<div style="padding:8px;background:var(--surface-glass);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:0.72rem;color:var(--color-neutral-400);">ESTADUAL</div>
        <div style="font-weight:600;">${tt.vTotTribEst ? fmtBRL(tt.vTotTribEst) : '—'}</div>
        <div style="font-size:0.75rem;">${tt.pTotTribEst ? tt.pTotTribEst + '%' : ''}</div>
      </div>`;
      html += `<div style="padding:8px;background:var(--surface-glass);border-radius:var(--radius-sm);text-align:center;">
        <div style="font-size:0.72rem;color:var(--color-neutral-400);">MUNICIPAL</div>
        <div style="font-weight:600;">${tt.vTotTribMun ? fmtBRL(tt.vTotTribMun) : '—'}</div>
        <div style="font-size:0.75rem;">${tt.pTotTribMun ? tt.pTotTribMun + '%' : ''}</div>
      </div>`;
      html += '</div>';
      if (tt.pTotTribSN) html += `<div style="font-size:0.82rem;margin-top:4px;">Simples Nacional: ${tt.pTotTribSN}%</div>`;
    }

    const hasIbs = ib.CST || ib.cClassTrib || ib.pDifUF || ib.pDifMun || ib.pDifCBS;
    if (hasIbs) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">IBS / CBS (REFORMA TRIBUTÁRIA)</div>`;
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
      html += buildRow('CST IBS/CBS', safe(ib.CST));
      html += buildRow('Classificação Trib.', safe(ib.cClassTrib));
      html += buildRow('Créd. Presumido', safe(ib.cCredPres));
      html += buildRow('CST Regular', safe(ib.CSTReg));
      html += buildRow('Class. Trib. Regular', safe(ib.cClassTribReg));
      html += buildRow('Diferimento IBS UF', ib.pDifUF ? `${ib.pDifUF}%` : '—');
      html += buildRow('Diferimento IBS Mun', ib.pDifMun ? `${ib.pDifMun}%` : '—');
      html += buildRow('Diferimento CBS', ib.pDifCBS ? `${ib.pDifCBS}%` : '—');
      html += buildRow('Consumidor Final', ib.indFinal === '1' ? 'Sim' : ib.indFinal === '0' ? 'Não' : '—');
      html += buildRow('Indicador Operação', safe(ib.cIndOp));
      html += buildRow('ZFM/ALC', ib.indZFMALC === '1' ? 'Sim' : '—');
      html += buildRow('Tipo Operação Gov.', safe(ib.tpOper));
      html += buildRow('Tipo Ente Gov.', safe(ib.tpEnteGov));
      html += '</div>';
    }

    const hasComExt = ce.mecAFComexP || ce.mecAFComexT || ce.nDI || ce.nRE;
    if (hasComExt) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">COMÉRCIO EXTERIOR</div>`;
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">';
      html += buildRow('Mecanismo Prestador', safe(ce.mecAFComexP));
      html += buildRow('Mecanismo Tomador', safe(ce.mecAFComexT));
      html += buildRow('Mov. Temp. Bens', safe(ce.movTempBens));
      html += buildRow('Nº Decl. Importação', safe(ce.nDI));
      html += buildRow('Nº Reg. Exportação', safe(ce.nRE));
      html += buildRow('MDIC', ce.mdic === '1' ? 'Sim' : '—');
      html += '</div>';
    }

    const hasObra = ob.inscImobFisc || ob.cObra;
    if (hasObra) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">CONSTRUÇÃO CIVIL / OBRA</div>`;
      html += buildRow('Insc. Imobiliária', safe(ob.inscImobFisc));
      html += buildRow('Código Obra (CNO/CEI)', safe(ob.cObra));
      const endObra = buildEnderecoHtml(ob.endereco);
      if (endObra) html += `<div style="font-size:0.82rem;">${endObra}</div>`;
    }

    const hasEvt = ev.xNome || ev.idAtvEvt;
    if (hasEvt) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">EVENTO / ATIVIDADE</div>`;
      html += buildRow('Nome', safe(ev.xNome));
      html += buildRow('ID Atividade', safe(ev.idAtvEvt));
      html += buildRow('Período', `${fmtDataCurta(ev.dtIni)} a ${fmtDataCurta(ev.dtFim)}`);
    }

    const hasImov = im.inscImobFisc || im.cCIB;
    if (hasImov) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">IMÓVEL</div>`;
      html += buildRow('Insc. Imobiliária', safe(im.inscImobFisc));
      html += buildRow('CIB', safe(im.cCIB));
      const endIm = buildEnderecoHtml(im.endereco);
      if (endIm) html += `<div style="font-size:0.82rem;">${endIm}</div>`;
    }

    const docsRef = n.documentosReferenciados || [];
    if (docsRef.length > 0) {
      html += `<div style="font-size:0.8rem;font-weight:600;color:var(--color-primary-300);margin:16px 0 8px;border-bottom:1px solid var(--surface-glass-border);padding-bottom:4px;">DOCUMENTOS REFERENCIADOS (${docsRef.length})</div>`;
      docsRef.forEach((d, i) => {
        html += `<div style="padding:6px 8px;background:var(--surface-glass);border-radius:var(--radius-sm);margin-bottom:4px;font-size:0.82rem;">
          #${i + 1} — Chave: ${safe(d.chaveDFe)} | Tipo: ${safe(d.tipoChaveDFe)} | Valor: ${d.vlrReeRepRes ? fmtBRL(d.vlrReeRepRes) : '—'}
        </div>`;
      });
    }

    if (g.xPed) html += `<div style="margin-top:10px;font-size:0.82rem;">Pedido/OS: <strong>${g.xPed}</strong></div>`;
    if (g.idDocTec) html += `<div style="font-size:0.82rem;">Doc. Técnico: <strong>${g.idDocTec}</strong></div>`;
    if (g.docRef) html += `<div style="font-size:0.82rem;">Doc. Referência: <strong>${g.docRef}</strong></div>`;

    document.getElementById('detalhes-conteudo').innerHTML = html;
    const modal = document.getElementById('modal-detalhes');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  document.getElementById('fechar-modal-det').addEventListener('click', () => {
    const modal = document.getElementById('modal-detalhes');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  loadNotas();

  document.getElementById('btn-buscar')?.addEventListener('click', () => {
    const termo = document.getElementById('filtro-pesquisa')?.value.toLowerCase().trim();
    if (!termo) { renderNotasTable(localNotasData); return; }
    const filtered = localNotasData.filter(n => {
      const chave = (n.chaveAcesso || '').toLowerCase();
      const pCnpj = (n.prestador?.CNPJ || n.prestador?.cnpj || '').toLowerCase();
      const pNome = (n.prestador?.xNome || n.prestador?.nome || '').toLowerCase();
      const tCnpj = (n.tomador?.CNPJ || n.tomador?.cnpj || '').toLowerCase();
      const tNome = (n.tomador?.xNome || n.tomador?.nome || '').toLowerCase();
      const desc = (n.servico?.xDescServ || '').toLowerCase();
      return chave.includes(termo) || pCnpj.includes(termo) || pNome.includes(termo) ||
             tCnpj.includes(termo) || tNome.includes(termo) || desc.includes(termo);
    });
    renderNotasTable(filtered);
    toast.info(`${filtered.length} nota(s) encontrada(s).`);
  });
}
