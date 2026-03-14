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
        const dadosGerais = nota.dadosGerais || {};
        const prest = nota.prestador || {};
        const toma = nota.tomador || {};
        const val = nota.valores || {};
        openDANFSe({
          nNFSe: dadosGerais.nNFSe || nota.nNFSe || '—',
          chaveAcesso: nota.chaveAcesso || '',
          dhProc: nota.dataImportacao ? new Date(nota.dataImportacao).toLocaleString('pt-BR') : '—',
          tpAmb: dadosGerais.tpAmb || '2',
          dCompet: nota.competencia || dadosGerais.dCompet || '—',
          prest: { doc: prest.CNPJ || prest.cpf || '—', xNome: prest.xNome || prest.nome || '—', IM: prest.IM || '' },
          toma: { doc: toma.CNPJ || toma.cpf || '—', xNome: toma.xNome || toma.nome || '—', IM: toma.IM || '' },
          serv: { cTribNac: nota.servico?.cServ?.cTribNac || nota.servico?.cTribNac || '—', xDescServ: nota.servico?.xDescServ || '—', localPrest: String(nota.dadosGerais?.cLocIncid || '').padStart(7,'0') },
          valores: {
            vServ: `R$ ${(val.vServ || nota.valorServico || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
            vBC: `R$ ${(val.vBC || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
            pAliq: `${(val.pAliq || nota.aliquota || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
            vISSQN: `R$ ${(val.vISS || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
            vLiq: `R$ ${(val.vLiq || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
          },
          ibscbs: { vBC: 'R$ 0,00', pAliqEfetUF: '0,10', vIBSUF: 'R$ 0,00', pAliqEfetMun: '0,05', vIBSMun: 'R$ 0,00', pAliqEfetCBS: '0,90', vCBS: 'R$ 0,00', vIBSTot: 'R$ 0,00', vTotNF: `R$ ${(val.vLiq || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}` },
        });
      }
    });
  } catch (e) {
    toast.error('Erro ao conectar com a base de dados local.');
  }
}
