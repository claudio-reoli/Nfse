/**
 * NFS-e Antigravity — Visualização de XML Assinado
 * Renderiza o XML da última DPS enviada com assinatura digital para conferência.
 */
import { toast } from '../toast.js';

export function renderXmlAssinado(container) {
  const lastXml = localStorage.getItem('nfse_last_signed_xml');

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">XML Assinado (Última DPS)</h1>
        <p class="page-description">Visualize o XML completo da última Declaração de Prestação de Serviços transmitida.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btn-copiar-xml">📋 Copiar XML</button>
        <button class="btn btn-secondary" id="btn-download-xml-assinado">⬇ Download .xml</button>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">Conteúdo do XML</h3>
      </div>
      <div class="card-body">
        <pre id="xml-viewer" style="
          background: var(--surface-glass);
          border: 1px solid var(--surface-glass-border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--color-primary-400);
          max-height: 600px;
          white-space: pre-wrap;
          word-break: break-all;
        ">${lastXml ? escapeHtml(lastXml) : '&lt;!-- Nenhum XML assinado encontrado. Emita uma DPS pela aba "Emissão de DPS" primeiro. --&gt;'}</pre>
      </div>
    </div>
  `;

  document.getElementById('btn-copiar-xml')?.addEventListener('click', () => {
    if (!lastXml) {
      toast.warning('Nenhum XML disponível para copiar.');
      return;
    }
    navigator.clipboard.writeText(lastXml);
    toast.success('XML copiado para a área de transferência!');
  });

  document.getElementById('btn-download-xml-assinado')?.addEventListener('click', () => {
    if (!lastXml) {
      toast.warning('Nenhum XML disponível para download.');
      return;
    }
    const blob = new Blob([lastXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dps-assinada.xml';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download do XML iniciado!');
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
