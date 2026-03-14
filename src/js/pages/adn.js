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
      <div class="page-actions" style="gap: var(--space-2); display: flex; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" id="btn-probe-adn">🔍 Diagnóstico ADN</button>
        <button class="btn btn-secondary btn-sm" id="btn-simular-import">🧪 Simular Importação</button>
        <button class="btn btn-primary" id="btn-sync-nsu">🔄 Sincronizar NSU</button>
      </div>
    </div>

    <!-- Painel de diagnóstico (oculto inicialmente) -->
    <div class="card animate-slide-up mb-4" id="card-diagnostico" style="display:none; border: 1px solid var(--color-warning-400);">
      <div class="card-header" style="background: rgba(var(--color-warning-rgb,245,158,11),0.08);">
        <h3 class="card-title">🔍 Resultado do Diagnóstico ADN</h3>
        <button class="btn btn-ghost btn-sm" id="btn-close-diag">✕ Fechar</button>
      </div>
      <div class="card-body" id="diag-body" style="font-family: var(--font-mono); font-size: var(--text-xs); white-space: pre-wrap; max-height: 400px; overflow-y: auto;"></div>
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

    <!-- Sync result message -->
    <div id="sync-result-msg" style="display:none; margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); border: 1px solid;"></div>

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
              GET /DFe?ultNsu={NSU}<br>
              POST /Eventos (manutenção)
            </div>
          </div>
        </div>
        <div style="margin-top: var(--space-3); padding: var(--space-3); background: rgba(245,158,11,0.08); border-radius: var(--radius-md); border: 1px solid rgba(245,158,11,0.3); font-size: var(--text-xs); color: var(--color-neutral-300);">
          <strong>💡 Dica:</strong> Se a sincronização retornar erro 404, use <strong>🔍 Diagnóstico ADN</strong> para verificar quais endpoints respondem com o certificado municipal.
          Se o município ainda não está cadastrado no ADN, use <strong>🧪 Simular Importação</strong> para gerar notas de teste e validar o fluxo completo (apuração, guias, eventos).
        </div>
      </div>
    </div>
  `;

  function showSyncResult(msg, type = 'info') {
    const el = document.getElementById('sync-result-msg');
    if (!el) return;
    const colors = {
      success: { bg: 'rgba(34,197,94,0.1)', border: 'var(--color-success-400)', text: 'var(--color-success-300)' },
      error:   { bg: 'rgba(239,68,68,0.1)',  border: 'var(--color-danger-400)',  text: 'var(--color-danger-300)' },
      info:    { bg: 'rgba(59,130,246,0.1)',  border: 'var(--color-primary-400)', text: 'var(--color-primary-200)' },
    };
    const c = colors[type] || colors.info;
    el.style.display = 'block';
    el.style.background = c.bg;
    el.style.borderColor = c.border;
    el.style.color = c.text;
    el.textContent = msg;
  }

  // ─── Diagnóstico ADN ─────────────────────────────────────────
  document.getElementById('btn-probe-adn')?.addEventListener('click', async () => {
    const card = document.getElementById('card-diagnostico');
    const body = document.getElementById('diag-body');
    if (card) card.style.display = 'block';
    if (body) body.textContent = '⏳ Testando conectividade com ADN (pode levar até 30s)...';
    toast.info('Iniciando diagnóstico ADN...');
    try {
      const res = await fetch('/api/admin/probe-adn');
      const data = await res.json();
      if (data.erro) {
        if (body) body.textContent = `❌ Erro: ${data.erro}`;
        toast.error('Falha no diagnóstico: ' + data.erro);
        return;
      }
      let txt = `Ambiente: ${data.ambiente}\nURL Base: ${data.adnBaseUrl}\nCertificado: ${data.certOk ? '✓ Configurado' : '✗ NÃO configurado'}\nSubject: ${data.certSubject}\n\n`;
      txt += `━━━━ RESULTADOS POR URL ━━━━\n`;
      for (const r of (data.results || [])) {
        const icon = r.status && r.status < 400 ? '✅' : r.status === 404 ? '🔴' : r.status ? '🟡' : '⚫';
        txt += `${icon} [${r.status ?? r.erro ?? '?'}] ${r.label}\n   ${r.url}\n`;
        if (r.body) txt += `   Resposta: ${r.body.substring(0, 150).replace(/\n/g, ' ')}\n`;
        txt += '\n';
      }
      const respondendo = (data.results || []).filter(r => r.status && r.status < 500);
      if (respondendo.length === 0) {
        txt += `\n⚠️  DIAGNÓSTICO: Nenhum endpoint respondeu com sucesso.\n   Verifique se o município está cadastrado no ADN e se o certificado ICP-Brasil é do tipo e-CNPJ A1.\n`;
      } else {
        const ok = respondendo.filter(r => r.status < 400);
        if (ok.length > 0) {
          txt += `\n✅  ENDPOINTS OK: ${ok.map(r => r.url).join(', ')}\n`;
        } else {
          txt += `\n⚠️  SERVIDOR RESPONDEU mas todos retornaram erro. Status encontrados: ${[...new Set(respondendo.map(r => r.status))].join(', ')}\n`;
        }
      }
      if (body) body.textContent = txt;
      toast.success('Diagnóstico concluído!');
    } catch (err) {
      if (body) body.textContent = `❌ Erro na requisição: ${err.message}`;
      toast.error('Falha: ' + err.message);
    }
  });

  document.getElementById('btn-close-diag')?.addEventListener('click', () => {
    const card = document.getElementById('card-diagnostico');
    if (card) card.style.display = 'none';
  });

  // ─── Simular Importação (modo demonstração) ──────────────────
  document.getElementById('btn-simular-import')?.addEventListener('click', async () => {
    const qtd = prompt('Quantas notas sintéticas gerar? (máx 50)', '10');
    if (qtd === null) return;
    const n = parseInt(qtd, 10);
    if (!n || n < 1) { toast.error('Quantidade inválida'); return; }
    toast.info(`Gerando ${n} notas de simulação...`);
    try {
      const res = await fetch('/api/admin/simular-importacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: n }),
      });
      const data = await res.json();
      if (data.sucesso) {
        document.getElementById('adn-ultNSU').textContent = data.maxNsu.toLocaleString('pt-BR');
        showSyncResult(`✅ ${data.novaNotas} nota(s) de simulação importada(s). NSU atual: ${data.maxNsu}. Acesse "Consulta de Notas" para visualizá-las.`, 'success');
        toast.success(`${data.novaNotas} notas simuladas importadas!`);
      } else {
        toast.error(data.erro || 'Erro na simulação');
      }
    } catch (err) {
      toast.error('Falha: ' + err.message);
    }
  });

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
    toast.info('Consultando status de sincronização...');
    try {
      const res = await fetch('/api/admin/force-sync', { method: 'POST' });
      const data = await res.json();
      document.getElementById('adn-ultNSU').textContent = (data.maxNsu ?? '—').toLocaleString?.('pt-BR') ?? data.maxNsu ?? '—';
      if (data.novaNotas > 0) {
        showSyncResult(`✅ ${data.novaNotas} nota(s) importada(s) do ADN. NSU atual: ${data.maxNsu}`, 'success');
        toast.success(`${data.novaNotas} notas importadas!`);
      } else if (data.aviso) {
        showSyncResult(`⚠️ ${data.aviso}`, 'info');
        toast.info('Sem novas notas: ' + (data.aviso || '').substring(0, 80));
      } else if (data.erro) {
        showSyncResult(`❌ ${data.erro}\n\n💡 Use "🔍 Diagnóstico ADN" para investigar ou "🧪 Simular Importação" para testes.`, 'error');
        toast.error('ADN indisponível — veja detalhes na tela');
      } else {
        showSyncResult(`ℹ️ Nenhuma nota nova. NSU: ${data.maxNsu}`, 'info');
        toast.info('Sem novas notas no ADN.');
      }
    } catch (err) {
      showSyncResult(`❌ Erro de comunicação: ${err.message}`, 'error');
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
