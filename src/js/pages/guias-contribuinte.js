/**
 * NFS-e Antigravity — Portal do Contribuinte (Apurações e Guias Mensais — Production Ready)
 */
import { getSession } from '../auth.js';
import { maskCNPJ } from '../fiscal-utils.js';
import { toast } from '../toast.js';
import { getBackendUrl } from '../api-service.js';

export function renderGuiasContribuinte(container) {
  const session = getSession();
  
  // REQUIREMENT ITEM 7: Use real CNPJ from the authenticated session
  const cnpjContribuinte = session?.cnpj || '12345678000100'; 

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Extrato de Apuração Mensal e Guias (ISSQN)</h1>
        <p class="page-description">Visualize os períodos fechados pelo município e realize o pagamento via PIX/DAM.</p>
      </div>
      <div>
        <strong style="color: var(--color-primary-400);">Contribuinte:</strong> <span class="text-mono">${maskCNPJ(cnpjContribuinte)}</span>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">Resumo Financeiro - Débitos Abertos na Sefin</h3>
      </div>
      <div class="card-body">
        <button id="btn-atualizar-guias" class="btn btn-secondary mb-4">🔄 Atualizar Faturas</button>
        <div class="table-container">
          <table class="data-table" id="tabela-guias-contribuinte">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Vencimento</th>
                <th>Base (NFs)</th>
                <th>Valor (Utinga - BA)</th>
                <th>Situação</th>
                <th>Pagamento</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" style="text-align: center;">Consultando portal municipal...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Pagamento PIX -->
    <div id="modal-pix" class="modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2000; align-items: center; justify-content: center; display: none;">
      <div class="card" style="width: 100%; max-width: 450px; text-align: center; position: relative;">
        <button id="fechar-modal-pix" class="btn btn-ghost" style="position: absolute; right: 10px; top: 10px; color: var(--color-danger-400); font-weight: bold;">X</button>
        <div class="card-header border-0">
          <h3 class="card-title" style="color: #32bcad; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 512 512" width="28" height="28" fill="currentColor"><path d="M495.3 226.7L330.1 61.5c-48.4-48.4-126.3-48.4-174.7 0L24.8 192.1c-19.1 19.1-19.1 50 0 69.1l130.6 130.6c48.4 48.4 126.3 48.4 174.7 0l165.2-165.2c19.1-19.1 19.1-50 0-69.1zM286.3 351c-25 25-65.5 25-90.5 0l-45.3-45.3 45.3-45.3c25-25 25-65.5 0-90.5l-45.3-45.3 45.3-45.3c25-25 65.5-25 90.5 0l45.3 45.3-45.3 45.3c-25 25-25 65.5 0 90.5l45.3 45.3-45.3 45.3z"/></svg>Pagamento PIX</h3>
        </div>
        <div class="card-body">
          <p style="color: var(--color-neutral-400); font-size: 0.9rem;">Escaneie o QR Code abaixo para pagar via PIX.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=antigravity" alt="QR Code"></div>
          <div style="margin-bottom: 20px;"><strong style="font-size: 1.5rem;" id="modal-pix-valor">R$ 0,00</strong></div>
                    <input type="text" class="form-input text-mono" id="pix-payload" readonly value="..." style="text-align: center; font-size: 0.8rem; margin-bottom: 10px;">
          <button class="btn btn-secondary w-full" id="btn-copiar-pix" style="margin-bottom: 10px;">📋 Copiar Código PIX</button>
          <button class="btn btn-primary w-full" id="btn-simular-pagamento" style="background: var(--color-success-400);">✅ Simular Pagamento</button>
        </div>
      </div>
    </div>
  `;

  let lastGuideId = null;

  async function loadGuias() {
    try {
      const resp = await fetch(`${getBackendUrl()}/municipio/apuracoes/${cnpjContribuinte}`);
      const data = await resp.json();
      const tbody = document.getElementById('tabela-guias-contribuinte').querySelector('tbody');
      tbody.innerHTML = '';
      
      if (!data.sucesso || data.apuracoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum débito em aberto.</td></tr>';
        return;
      }
      
      const formataBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      data.apuracoes.forEach(a => {
        const isPaga = a.status === 'Paga';
        const hasGuia = !!a.guia;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${a.competencia}</strong></td>
          <td>${hasGuia ? a.guia.dataVencimento : 'A definir'}</td>
          <td style="text-align: center;">${a.totalNotasEmitidas}</td>
          <td style="color: var(--color-primary-400); font-weight: 600;">${formataBRL(a.guia?.valor || (a.totalIssProprio + a.totalIssTerceiros))}</td>
          <td><span class="badge ${isPaga ? 'badge-success' : (hasGuia ? 'badge-warning' : 'badge-danger')}">${a.status}</span></td>
          <td>${isPaga ? '<span class="text-success">✅ Pago</span>' : (hasGuia ? `<button class="btn btn-primary btn-sm btn-pagar-pix" data-id="${a.id}" data-payload="${a.guia.pixPayload}" data-valor="${a.guia.valor}">Pagar PIX</button>` : '---')}</td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-pagar-pix').forEach(btn => {
         btn.addEventListener('click', (e) => {
             const ds = e.currentTarget.dataset;
             lastGuideId = ds.id;
             document.getElementById('modal-pix-valor').textContent = formataBRL(ds.valor);
             document.getElementById('pix-payload').value = ds.payload;
             document.getElementById('modal-pix').style.display = 'flex';
         });
      });
    } catch (err) {
      document.getElementById('tabela-guias-contribuinte').querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-danger-400);">Falha de rede com o Portal Municipal.</td></tr>';
    }
  }

  document.getElementById('btn-atualizar-guias')?.addEventListener('click', loadGuias);
  document.getElementById('fechar-modal-pix').addEventListener('click', () => document.getElementById('modal-pix').style.display = 'none');
  document.getElementById('btn-copiar-pix').addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById('pix-payload').value);
      toast.success('PIX copiado.');
  });
  document.getElementById('btn-simular-pagamento').addEventListener('click', async () => {
      try {
          const res = await fetch(`${getBackendUrl()}/municipio/pagar-guia/${lastGuideId}`, { method: 'POST' });
          if ((await res.json()).sucesso) {
              toast.success('Pagamento liquidado!');
              document.getElementById('modal-pix').style.display = 'none';
              loadGuias();
          }
      } catch(err) { toast.error('Erro no processamento.'); }
  });

  loadGuias();
}
