/**
 * NFS-e Antigravity — Eventos Page
 */
import { ENUMS } from '../fiscal-utils.js';
import { toast } from '../toast.js';
import { safeFetch, registrarEvento } from '../api-service.js';

export function renderEventos(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Eventos da NFS-e</h1>
        <p class="page-description">Cancelamento, Substituição, Manifestação e Análise Fiscal</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-novo-evento">＋ Novo Evento</button>
      </div>
    </div>

    <!-- Event Types -->
    <div class="grid grid-3 gap-4 stagger mb-6">
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-cancelamento">
        <div class="card-body" style="text-align: center; padding: var(--space-8);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">❌</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Cancelamento</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Cancelar uma NFS-e emitida</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-substituicao">
        <div class="card-body" style="text-align: center; padding: var(--space-8);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">🔄</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Substituição</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Substituir NFS-e gerando cancelamento automático</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-manifestacao">
        <div class="card-body" style="text-align: center; padding: var(--space-8);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">✅</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Manifestação</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Confirmar ou rejeitar NFS-e</div>
        </div>
      </div>
    </div>

    <!-- Cancelamento Form -->
    <div class="card animate-slide-up hidden" id="form-cancelamento">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">❌</span>Cancelamento de NFS-e
          </span>
        </h3>
        <button class="btn btn-ghost btn-sm" id="close-cancel">✕</button>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="cancel-chave" type="text" maxlength="50"
                   placeholder="50 dígitos da chave de acesso">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Justificativa <span class="required">*</span></label>
            <select class="form-select" id="cancel-justificativa">
              ${Object.entries(ENUMS.codJustCanc).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Descrição do Motivo <span class="required">*</span></label>
            <input class="form-input" id="cancel-motivo" type="text" minlength="15" maxlength="255"
                   placeholder="Mínimo 15 caracteres">
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" id="cancel-btn-cancel">Cancelar</button>
        <button class="btn btn-danger" id="cancel-btn-submit">
          🔒 Assinar e Registrar Cancelamento
        </button>
      </div>
    </div>

    <!-- Recent Events Table -->
    <div class="card animate-slide-up mt-6">
      <div class="card-header">
        <h3 class="card-title">Eventos Recentes</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Chave NFS-e</th>
              <th>Autor</th>
              <th>Data</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-danger">Cancelamento</span></td>
              <td class="cell-mono">3526021234...6789</td>
              <td>Prestador</td>
              <td>09/03/2026</td>
              <td><span class="badge badge-success">Registrado</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-primary">Manifestação</span></td>
              <td class="cell-mono">3526029876...4321</td>
              <td>Tomador</td>
              <td>08/03/2026</td>
              <td><span class="badge badge-success">Confirmada</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-warning">Substituição</span></td>
              <td class="cell-mono">3526021122...9012</td>
              <td>Sistema</td>
              <td>07/03/2026</td>
              <td><span class="badge badge-success">Processada</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Toggle event forms
  document.getElementById('evt-cancelamento')?.addEventListener('click', () => {
    document.getElementById('form-cancelamento').classList.remove('hidden');
  });

  document.getElementById('close-cancel')?.addEventListener('click', () => {
    document.getElementById('form-cancelamento').classList.add('hidden');
  });
  document.getElementById('cancel-btn-cancel')?.addEventListener('click', () => {
    document.getElementById('form-cancelamento').classList.add('hidden');
  });

  document.getElementById('evt-substituicao')?.addEventListener('click', () => {
    toast.info('Substituição: Gera automaticamente Evento de Cancelamento por Substituição + NFS-e substituta via POST /nfse');
  });

  document.getElementById('evt-manifestacao')?.addEventListener('click', () => {
    toast.info('Manifestação: Confirmação/Rejeição via POST /nfse/{chave}/eventos');
  });

  document.getElementById('cancel-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('cancel-chave')?.value.trim();
    const justificativa = document.getElementById('cancel-justificativa')?.value;
    const motivo = document.getElementById('cancel-motivo')?.value.trim();

    if (!chave || chave.length !== 50) {
      toast.error('Chave de Acesso inválida (50 dígitos).');
      return;
    }
    if (!motivo || motivo.length < 15) {
      toast.error('Motivo do cancelamento deve ter pelo menos 15 caracteres.');
      return;
    }

    toast.info('Enviando evento de cancelamento...');
    try {
      const response = await safeFetch(registrarEvento, chave, {
        tpEvento: 'e101101',
        cJustCanc: justificativa,
        xMotivo: motivo,
      });
      if (response.ok) {
        toast.success(`✅ Cancelamento registrado! Seq: ${response.data.nSeqEvento} — cStat: ${response.data.cStat}`);
        document.getElementById('form-cancelamento').classList.add('hidden');
      } else {
        toast.error(`Erro: ${response.data?.xMotivo || 'Desconhecido'}`);
      }
    } catch (err) {
      toast.error(`Falha: ${err.message}`);
    }
  });
}
