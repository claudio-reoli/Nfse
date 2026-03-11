/**
 * NFS-e Antigravity — Dashboard Page (Production)
 */
import { getCertSummary } from '../digital-signature.js';
import { getDashboardStats, getHealthStatus } from '../api-service.js';
import { getSession } from '../auth.js';
import { toast } from '../toast.js';

export async function renderDashboard(container) {
  const session = getSession();
  let certAlertHtml = '';
  
  // Cert alert logic (Item 3 related)
  try {
    const cert = getCertSummary();
    if (cert && cert.notAfter) {
      const expiry = new Date(cert.notAfter);
      const diffDays = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        certAlertHtml = `
          <div class="animate-slide-up" style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-danger-500); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1rem;">
             <div style="font-size: 2rem;">🚨</div>
             <div><h4 style="margin: 0; color: var(--color-danger-400);">Certificado Expirado!</h4><p>A emissão está bloqueada.</p></div>
          </div>
        `;
      } else if (diffDays <= 5) {
        certAlertHtml = `
          <div class="animate-slide-up" style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--color-warning-500); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1rem;">
             <div style="font-size: 2rem;">⚠️</div>
             <div><h4 style="margin: 0; color: var(--color-warning-400);">Certificado Vencendo em ${diffDays} dia(s)</h4></div>
          </div>
        `;
      }
    }
  } catch(e) {}

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-description">Bem-vindo, ${session?.name || 'Contribuinte'}.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="window.location.hash='/emissao-dps'">＋ Nova DPS</button>
      </div>
    </div>

    ${certAlertHtml}

    <div class="grid grid-4 stagger mb-6">
      <div class="stat-card" style="--stat-color: var(--color-primary-500)"><div class="stat-value" id="stat-emitidas">...</div><div class="stat-label">NFS-e Emitidas</div></div>
      <div class="stat-card" style="--stat-color: var(--color-accent-500)"><div class="stat-value" id="stat-aprovadas">...</div><div class="stat-label">Autorizadas</div></div>
      <div class="stat-card" style="--stat-color: var(--color-warning-500)"><div class="stat-value" id="stat-pendentes">...</div><div class="stat-label">Pendentes</div></div>
      <div class="stat-card" style="--stat-color: var(--color-danger-500)"><div class="stat-value" id="stat-canceladas">...</div><div class="stat-label">Canceladas</div></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 280px; gap: var(--space-6);">
      <div class="card">
        <div class="card-header"><h3 class="card-title">NFS-e Recentes</h3></div>
        <div class="card-body" style="padding: 0;"><table class="data-table"><thead><tr><th>Chave</th><th>Prestador</th><th>Valor</th><th>Status</th></tr></thead><tbody id="recent-nfse-body"></tbody></table></div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Status do Sistema</h3></div>
        <div class="card-body" id="system-health-panel">
          <div class="loading-spinner"></div>
        </div>
      </div>
    </div>
  `;

  // Fetch real stats (Item 2)
  try {
    const statsResp = await getDashboardStats(session?.cnpj);
    const stats = statsResp.data;
    document.getElementById('stat-emitidas').textContent = stats.emitidas;
    document.getElementById('stat-aprovadas').textContent = stats.aprovadas;
    document.getElementById('stat-pendentes').textContent = stats.pendentes;
    document.getElementById('stat-canceladas').textContent = stats.canceladas;
    
    const tbody = document.getElementById('recent-nfse-body');
    if (stats.recentes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhuma nota encontrada.</td></tr>';
    } else {
      tbody.innerHTML = stats.recentes.map(d => `
        <tr>
          <td class="cell-mono">${d.chaveAcesso.slice(0, 10)}...${d.chaveAcesso.slice(-4)}</td>
          <td class="truncate">${d.prestador.nome}</td>
          <td style="font-variant-numeric: tabular-nums;">R$ ${d.valorServico.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
          <td><span class="badge ${d.status === 'Cancelada' ? 'badge-danger' : 'badge-success'}">${d.status}</span></td>
        </tr>
      `).join('');
    }
  } catch(e) { toast.error('Falha ao carregar estatísticas reais.'); }

  // Health Check (Item 8)
  try {
    const healthResp = await getHealthStatus();
    const health = healthResp.data;
    const panel = document.getElementById('system-health-panel');
    panel.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between;"><span>Sefin Nacional</span> <span class="status-dot ${health.services.sefin.status === 'online' ? 'online' : 'offline'}"></span></div>
        <div style="display: flex; justify-content: space-between;"><span>ADN Nacional</span> <span class="status-dot ${health.services.adn.status === 'online' ? 'online' : 'offline'}"></span></div>
        <div style="display: flex; justify-content: space-between;"><span>Backend Local</span> <span class="status-dot online"></span></div>
      </div>
    `;
  } catch(e) { document.getElementById('system-health-panel').innerHTML = '⚠️ Erro ao verificar disponibilidade.'; }
}
