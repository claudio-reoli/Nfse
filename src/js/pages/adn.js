/**
 * NFS-e Freire — Integração ADN (Ambiente de Dados Nacional)
 * Distribuição por NSU, compartilhamento de DF-e, DANFSe
 */
import { toast } from '../toast.js';
import { safeFetch, distribuicaoDFe, ultimoNSU, adnEventos, syncAdnContribuinte } from '../api-service.js';
import { openDANFSe } from '../danfse-generator.js';

export function renderADN(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Integração ADN</h1>
        <p class="page-description">Ambiente de Dados Nacional — Distribuição de DF-e por NSU e compartilhamento</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-sync-nsu">🔄 Sincronizar NSU</button>
      </div>
    </div>

    <!-- NSU Status -->
    <div class="grid grid-3 gap-4 stagger mb-6">
      <div class="stat-card animate-slide-up">
        <div class="stat-number" id="adn-ultNSU">—</div>
        <div class="stat-label">ÚLTIMO NSU PROCESSADO</div>
        <div class="stat-trend trend-up">Atualizado agora</div>
      </div>
      <div class="stat-card animate-slide-up">
        <div class="stat-number" id="adn-maxNSU">—</div>
        <div class="stat-label">NSU MÁXIMO DISPONÍVEL</div>
        <div class="stat-trend trend-up">ADN Nacional</div>
      </div>
      <div class="stat-card animate-slide-up">
        <div class="stat-number" id="adn-pending">—</div>
        <div class="stat-label">PENDENTES DE DOWNLOAD</div>
        <div class="stat-trend trend-down">A processar</div>
      </div>
    </div>

    <!-- Documents Table -->
    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">📦 Documentos Distribuídos</h3>
        <div style="display: flex; gap: var(--space-2);">
          <button class="btn btn-ghost btn-sm" id="btn-danfse-demo">📄 DANFSe Demo</button>
          <button class="btn btn-ghost btn-sm" id="btn-load-docs">🔄 Carregar</button>
        </div>
      </div>
      <div class="card-body" style="padding: 0;">
        <table class="data-table" id="adn-table">
          <thead>
            <tr>
              <th>NSU</th>
              <th>Tipo</th>
              <th>Chave de Acesso</th>
              <th>Data Recebimento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="adn-table-body">
            <tr>
              <td colspan="5" style="text-align: center; padding: var(--space-6);">
                <div class="empty-state">
                  <div class="icon">📦</div>
                  <p>Clique em "Sincronizar NSU" para buscar documentos do ADN</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- API Reference -->
    <div class="card animate-slide-up mt-6">
      <div class="card-header">
        <h3 class="card-title">📚 Referência de APIs ADN</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-2 gap-4">
          <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); border: 1px solid var(--surface-glass-border);">
            <div style="font-weight: 600; color: var(--color-primary-400); margin-bottom: var(--space-2);">ADN Contribuintes</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-400); font-family: var(--font-mono);">
              GET /DFe/{NSU}<br>
              GET /DFe (último NSU)<br>
              GET /NFSe/{chave}/Eventos<br>
              GET /danfse/{chave}
            </div>
          </div>
          <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); border: 1px solid var(--surface-glass-border);">
            <div style="font-weight: 600; color: var(--color-accent-400); margin-bottom: var(--space-2);">ADN Municípios</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-400); font-family: var(--font-mono);">
              GET /DFe/{NSU}<br>
              GET /DFe (último NSU)<br>
              POST /Eventos (manutenção)
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── Sync NSU / Importar do ADN ───────────────────────────────
  document.getElementById('btn-sync-nsu')?.addEventListener('click', async () => {
    const session = JSON.parse(localStorage.getItem('nfse_session') || '{}');
    const hasCert = session.authMethod === 'certificate';
    if (hasCert && session.token) {
      toast.info('Importando notas do ADN (certificado)...');
      try {
        const res = await syncAdnContribuinte();
        const data = res.data;
        if (data.sucesso) {
          document.getElementById('adn-ultNSU').textContent = data.maxNsu.toLocaleString('pt-BR');
          document.getElementById('adn-pending').textContent = '0';
          toast.success(`✅ ${data.importadas || 0} nota(s) importada(s). NSU: ${data.maxNsu}`);
        } else {
          toast.error(data.error || 'Falha na importação');
        }
      } catch (err) {
        toast.error(err.message || 'Falha na importação');
      }
      return;
    }
    toast.info('Consultando último NSU no ADN...');
    try {
      const response = await safeFetch(ultimoNSU);
      if (response.ok) {
        document.getElementById('adn-ultNSU').textContent = response.data.ultNSU?.toLocaleString('pt-BR') ?? '—';
        document.getElementById('adn-maxNSU').textContent = response.data.maxNSU?.toLocaleString('pt-BR') ?? '—';
        document.getElementById('adn-pending').textContent = ((response.data.maxNSU || 0) - (response.data.ultNSU || 0)).toLocaleString('pt-BR');
        toast.success(`✅ NSU atualizado! Faça login com certificado para importar notas.`);
      }
    } catch (err) {
      toast.error(`Falha: ${err.message}`);
    }
  });

  // ─── Load Documents ─────────────────────────
  document.getElementById('btn-load-docs')?.addEventListener('click', async () => {
    toast.info('Buscando documentos distribuídos...');
    try {
      const response = await safeFetch(distribuicaoDFe, 1500);
      if (response.ok && response.data.docs) {
        const tbody = document.getElementById('adn-table-body');
        if (tbody) {
          tbody.innerHTML = response.data.docs.map(doc => `
            <tr>
              <td><span class="badge badge-primary">${doc.NSU}</span></td>
              <td>${doc.tipo}</td>
              <td class="cell-mono" style="font-size: var(--text-xs);">${doc.chaveAcesso.substring(0, 20)}...${doc.chaveAcesso.slice(-10)}</td>
              <td>${new Date(doc.dhRecbto).toLocaleString('pt-BR')}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="import('../danfse-generator.js').then(m => m.openDANFSe())">📄</button>
              </td>
            </tr>
          `).join('');
          toast.success(`✅ ${response.data.docs.length} documentos carregados`);
        }
      }
    } catch (err) {
      toast.error(`Falha: ${err.message}`);
    }
  });

  // ─── DANFSe Demo ────────────────────────────
  document.getElementById('btn-danfse-demo')?.addEventListener('click', () => {
    toast.info('Gerando DANFSe de demonstração...');
    openDANFSe();
    toast.success('DANFSe aberto em nova janela!');
  });

  // Auto-sync on load
  document.getElementById('btn-sync-nsu')?.click();
}
