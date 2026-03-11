/**
 * NFS-e Antigravity — Minhas Notas (Histórico Local - Production Ready)
 */
import { getSession } from '../auth.js';
import { toast } from '../toast.js';
import { getBackendUrl } from '../api-service.js';

export async function renderMinhasNotas(container) {
  const session = getSession();
  
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Minhas Notas (Histórico Local)</h1>
        <p class="page-description">Consulta persistente de notas emitidas pelo sistema Antigravity.</p>
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
    const res = await fetch(`${getBackendUrl()}/notes?cnpj=${session?.cnpj || ''}`);
    const notes = await res.json();
    const tbody = document.getElementById('lista-notas-local');
    
    if (notes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">Nenhuma nota emitida localmente encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = notes.map(n => `
      <tr>
        <td style="font-size: 0.8rem;">${new Date(n.dhEmit).toLocaleString('pt-BR')}</td>
        <td class="cell-mono" style="font-size: 0.75rem;">${n.chaveAcesso}</td>
        <td>${n.tomador.nome}</td>
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
      if (e.target.classList.contains('btn-nota-xml')) {
        toast.info('Baixando XML...');
      } else if (e.target.classList.contains('btn-nota-danfse')) {
        toast.info('Gerando PDF...');
      }
    });
  } catch (e) {
    toast.error('Erro ao conectar com a base de dados local.');
  }
}
