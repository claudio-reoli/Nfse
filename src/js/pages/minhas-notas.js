/**
 * NFS-e Freire — Minhas Notas (Histórico Local - Production Ready)
 */
import { getSession } from '../auth.js';
import { toast } from '../toast.js';
import { getBackendUrl } from '../api-service.js';
import { openDANFSe } from '../danfse-generator.js';
import { downloadXml } from '../xml-builder.js';

export async function renderMinhasNotas(container) {
  const session = getSession();
  
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Minhas Notas (Histórico Local)</h1>
        <p class="page-description">Consulta persistente de notas emitidas pelo sistema Freire.</p>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Chave de Acesso</th>
              <th>Tomador</th>
              <th>Valor Serv.</th>
              <th>IBS/CBS</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="lista-notas-local">
            <tr><td colspan="7" style="text-align: center;">Carregando sua base local...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`${getBackendUrl()}/notes?cnpj=${session?.cnpj || ''}`, {
      headers: { 'Authorization': `Bearer ${session?.token || ''}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const notes = await res.json();
    if (!Array.isArray(notes)) throw new Error('Formato inesperado');
    const tbody = document.getElementById('lista-notas-local');
    
    if (notes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">Nenhuma nota emitida localmente encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = notes.map((n, idx) => `
      <tr data-note-idx="${idx}">
        <td style="font-size: 0.8rem;">${n.dhEmit ? new Date(n.dhEmit).toLocaleString('pt-BR') : '—'}</td>
        <td class="cell-mono" style="font-size: 0.75rem;">${n.chaveAcesso}</td>
        <td>${n.tomador?.nome || n.tomador?.xNome || '—'}</td>
        <td class="text-mono">R$ ${n.valorServico.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        <td class="text-mono">R$ ${(n.valorIBSCBS || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        <td><span class="badge badge-success">${n.status}</span></td>
        <td>
           <button class="btn btn-ghost btn-sm btn-nota-xml">XML</button>
           <button class="btn btn-ghost btn-sm btn-nota-danfse">DANFSe</button>
        </td>
      </tr>
    `).join('');

    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const idx = tr.dataset.noteIdx;
      const nota = notes[parseInt(idx, 10)];
      if (!nota) return;

      if (e.target.classList.contains('btn-nota-xml')) {
        const xmlStr = nota.xmlOriginal || nota.xml || `<!-- XML não disponível para NSU ${nota.nsu} -->`;
        downloadXml(xmlStr, `NFSe_${nota.chaveAcesso || nota.nsu}.xml`);
      } else if (e.target.classList.contains('btn-nota-danfse')) {
        const g     = nota.dadosGerais || {};
        const prest = nota.prestador   || {};
        const toma  = nota.tomador     || {};
        const serv  = nota.servico     || {};
        const val   = nota.valores     || {};
        const ti    = nota.tributos?.issqn   || {};
        const tf    = nota.tributos?.federal || {};
        const tt    = nota.tributos?.totais  || {};
        const endP  = prest.endereco || {};
        const endT  = toma.endereco  || {};

        const fmtDocMN = (p) => {
          const cnpj = String(p.CNPJ || p.cnpj || '').replace(/\D/g, '');
          if (cnpj.length === 14) return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
          const cpf = String(p.CPF || p.cpf || '').replace(/\D/g, '');
          if (cpf.length === 11)  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
          return p.NIF || '';
        };
        const fmtEndMN = (e, p) => [
          e.xLgr || p.xLgr, e.nro || p.nro,
          e.xCpl || p.xCpl || (e.xLgr || p.xLgr ? 'Não Informado' : ''),
          e.xBairro || p.xBairro,
        ].filter(Boolean).join(', ');
        const fmtMunMN = (e, p) => {
          const m = e.xMun || p.xMun || '';
          const u = e.UF || e.uf || p.UF || p.uf || '';
          return [m, u].filter(Boolean).join(' - ');
        };
        const fmtCEPMN = (e, p) => {
          const raw = String(e.CEP || e.cep || p.CEP || p.cep || '').replace(/\D/g, '');
          return raw.length === 8 ? raw.replace(/(\d{5})(\d{3})/, '$1-$2') : raw;
        };

        const vServ    = val.vServ   ?? nota.valorServico ?? 0;
        const vBC      = val.vBC     ?? vServ;
        const vLiq     = val.vLiq    ?? vServ;
        const vISS     = val.vISSQN  ?? val.vISS ?? ti.vISS ?? 0;
        const pAliq    = ti.pAliq    ?? val.pAliq ?? nota.aliquota ?? 0;
        const vIRRF    = tf.vRetIRRF ?? 0;
        const vRetCP   = tf.vRetCP   ?? 0;
        const vRetPC   = tf.vRetCSLL ?? 0;
        const vPIS     = tf.vPis     ?? tf.vPIS   ?? 0;
        const vCofins  = tf.vCofins  ?? 0;
        const vTotFed  = vIRRF + vRetCP + vPIS + vCofins;
        const tpRet    = ti.tpRetISSQN || '1';
        const localPrest = serv.xLocPrestacao || String(serv.cLocPrestacao || ti.cLocIncid || '');

        openDANFSe({
          mun: { nome: g.xLocEmi || '', prefeitura: '', fone: '', email: '', brasao: '' },
          nNFSe:      g.nNFSe    || nota.nNFSe || '',
          chaveAcesso:nota.chaveAcesso || '',
          dCompet:    g.dCompet  || nota.competencia || '',
          dhNFSe:     g.dhProc   || g.dhEmi || '',
          nDPS:       g.nDPS     || '',
          serie:      g.serie    || '',
          dhDPS:      g.dhEmi    || '',
          prest: {
            doc:       fmtDocMN(prest),
            xNome:     prest.xNome  || prest.nome  || '',
            IM:        prest.IM     || '',
            fone:      prest.fone   || '',
            email:     prest.email  || '',
            endereco:  fmtEndMN(endP, prest),
            municipio: fmtMunMN(endP, prest),
            cep:       fmtCEPMN(endP, prest),
            opSimpNac: prest.opSimpNac  || '',
            regApurSN: prest.regApurSN  || '',
            regEspTrib:prest.regEspTrib || '',
          },
          toma: {
            doc:       fmtDocMN(toma),
            xNome:     toma.xNome  || toma.nome  || '',
            IM:        toma.IM     || '',
            fone:      toma.fone   || '',
            email:     toma.email  || '',
            endereco:  fmtEndMN(endT, toma),
            municipio: fmtMunMN(endT, toma),
            cep:       fmtCEPMN(endT, toma),
          },
          interm: null,
          serv: {
            cTribNac:   serv.cServ?.cTribNac || serv.cTribNac || '',
            cTribMun:   serv.cServ?.cTribMun || serv.cTribMun || '',
            localPrest: localPrest,
            cPaisPrest: serv.cPaisPrestacao  || '',
            xDescServ:  serv.xDescServ       || '',
          },
          tribMun: {
            tribISSQN:   ti.tribISSQN  || '1',
            cPaisResult: ti.cPaisResult || '',
            cLocIncid:   ti.cLocIncid   || localPrest,
            regEspTrib:  prest.regEspTrib || ti.regEspTrib || '0',
            tpImunidade: ti.tpImunidade  || '',
            tpSusp:      ti.tpSusp || ti.cExigSusp || '0',
            nProcesso:   ti.nProcesso    || '',
            nBM:         ti.nBM          || '',
            vServ:       vServ,
            vDescIncond: val.vDescIncond ?? 0,
            vDedRed:     val.vDedRed     ?? val.dedRed?.vDR ?? 0,
            vCalcBM:     val.vCalcBM     ?? 0,
            vBC:         vBC,
            pAliq:       pAliq,
            tpRetISSQN:  tpRet,
            vISSQN:      vISS,
          },
          tribFed: {
            vIRRF:             vIRRF,
            vRetCP:            vRetCP,
            vRetPisCofinsCSLL: vRetPC,
            vPIS:              vPIS,
            vCofins:           vCofins,
            tpRetPisCofins:    tf.tpRetPisCofins || '',
            vTotFed:           vTotFed,
          },
          totais: {
            vServ:        vServ,
            vDescCond:    val.vDescCond  ?? 0,
            vDescIncond:  val.vDescIncond ?? 0,
            vISSQNRet:    (tpRet === '2' || tpRet === '3') ? vISS : 0,
            vTribFed:     vTotFed,
            vPisCofinsDev:vPIS + vCofins,
            vLiq:         vLiq,
          },
          totApro: { vFed: tt.vTotTribFed ?? 0, vEst: tt.vTotTribEst ?? 0, vMun: tt.vTotTribMun ?? 0 },
          xInfComp: g.xInfComp || '',
          nbs:      serv.cServ?.cNBS || serv.cNBS || '',
        });
      }
    });
  } catch (e) {
    toast.error('Erro ao conectar com a base de dados local.');
  }
}
