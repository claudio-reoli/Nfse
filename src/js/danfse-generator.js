/**
 * NFS-e Antigravity — DANFSe Generator
 * Gera PDF do Documento Auxiliar da NFS-e (via Canvas/Print)
 * Ref: requisitos-nfse-rtc-v2.md seção 2.4.3
 */

/**
 * Gera o DANFSe em HTML para impressão/PDF
 * @param {Object} nfseData - Dados da NFS-e
 * @returns {string} HTML do DANFSe
 */
export function generateDANFSeHTML(nfseData) {
  const d = nfseData || getDemoNFSeData();
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFSe - ${d.nNFSe}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 15mm;
    }
    
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      line-height: 1.4;
      background: white;
    }
    
    .danfse-container {
      max-width: 190mm;
      margin: 0 auto;
      border: 2px solid #333;
    }
    
    .header {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      border-bottom: 2px solid #333;
    }
    
    .header-logo {
      padding: 8px;
      border-right: 1px solid #999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24pt;
      font-weight: 800;
      color: #4F46E5;
    }
    
    .header-title {
      padding: 8px 12px;
      text-align: center;
      border-right: 1px solid #999;
    }
    
    .header-title h1 {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .header-title h2 {
      font-size: 8pt;
      font-weight: 400;
      color: #666;
    }
    
    .header-info {
      padding: 8px;
      text-align: center;
    }
    
    .header-info .nfse-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11pt;
      font-weight: 700;
      color: #4F46E5;
    }
    
    .chave-row {
      padding: 6px 10px;
      background: #f5f5f5;
      border-bottom: 1px solid #999;
      text-align: center;
    }
    
    .chave-row .label { font-size: 7pt; color: #666; text-transform: uppercase; }
    .chave-row .value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 1.5px;
    }
    
    .section {
      border-bottom: 1px solid #999;
    }
    
    .section-title {
      background: #e8e8e8;
      padding: 3px 10px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
      border-bottom: 1px solid #ccc;
    }
    
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }
    
    .field {
      padding: 4px 8px;
      border-right: 1px solid #ddd;
      border-bottom: 1px solid #eee;
    }
    
    .field:last-child { border-right: none; }
    
    .field .label {
      font-size: 6pt;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .field .value {
      font-size: 8pt;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .field .value.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
    }
    
    .field .value.large {
      font-size: 10pt;
      font-weight: 700;
    }
    
    .field .value.highlight {
      color: #4F46E5;
    }
    
    .field-wide {
      grid-column: 1 / -1;
      padding: 4px 8px;
    }
    
    .desc-serv {
      padding: 6px 10px;
      font-size: 8pt;
      min-height: 30px;
    }
    
    .valores-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
    }
    
    .ibscbs-section {
      background: #f0f0ff;
    }
    
    .ibscbs-section .section-title {
      background: #4F46E5;
      color: white;
    }
    
    .ibscbs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }
    
    .footer {
      padding: 6px 10px;
      font-size: 7pt;
      color: #888;
      text-align: center;
      border-top: 1px solid #999;
    }
    
    .barcode-area {
      padding: 10px;
      text-align: center;
      border-bottom: 1px solid #999;
    }
    
    .barcode-area img { max-height: 40px; }
    
    .qrcode-area {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      gap: 15px;
    }
    
    .qrcode-placeholder {
      width: 60px;
      height: 60px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 6pt;
      color: #aaa;
    }
    
    @media print {
      body { background: white; }
      .danfse-container { border: 2px solid #000; }
    }
  </style>
</head>
<body>
  <div class="danfse-container">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">NFS-e</div>
      <div class="header-title">
        <h1>DOCUMENTO AUXILIAR DA NFS-e</h1>
        <h2>Nota Fiscal de Serviços Eletrônica — Padrão Nacional</h2>
      </div>
      <div class="header-info">
        <div class="label" style="font-size: 7pt; color: #888;">NÚMERO</div>
        <div class="nfse-num">${d.nNFSe}</div>
        <div style="font-size: 7pt; color: #888; margin-top: 4px;">${d.dhProc}</div>
        <div style="font-size: 7pt; margin-top: 2px;">
          <span style="background: ${d.tpAmb === '1' ? '#059669' : '#D97706'}; color: white; padding: 1px 4px; border-radius: 2px; font-weight: 600;">
            ${d.tpAmb === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Chave de Acesso -->
    <div class="chave-row">
      <div class="label">Chave de Acesso</div>
      <div class="value">${formatChave(d.chaveAcesso)}</div>
    </div>
    
    <!-- Prestador -->
    <div class="section">
      <div class="section-title">Prestador de Serviços</div>
      <div class="fields" style="grid-template-columns: 180px 1fr 120px;">
        <div class="field">
          <div class="label">CNPJ/CPF</div>
          <div class="value mono">${d.prest.doc}</div>
        </div>
        <div class="field">
          <div class="label">Razão Social</div>
          <div class="value">${d.prest.xNome}</div>
        </div>
        <div class="field">
          <div class="label">Inscrição Municipal</div>
          <div class="value mono">${d.prest.IM || '-'}</div>
        </div>
      </div>
      <div class="fields" style="grid-template-columns: 1fr 120px 80px;">
        <div class="field">
          <div class="label">Endereço</div>
          <div class="value">${d.prest.endereco || '-'}</div>
        </div>
        <div class="field">
          <div class="label">Município</div>
          <div class="value">${d.prest.municipio || '-'}</div>
        </div>
        <div class="field">
          <div class="label">UF</div>
          <div class="value">${d.prest.uf || '-'}</div>
        </div>
      </div>
    </div>
    
    <!-- Tomador -->
    <div class="section">
      <div class="section-title">Tomador de Serviços</div>
      <div class="fields" style="grid-template-columns: 180px 1fr 120px;">
        <div class="field">
          <div class="label">CNPJ/CPF</div>
          <div class="value mono">${d.toma.doc}</div>
        </div>
        <div class="field">
          <div class="label">Razão Social / Nome</div>
          <div class="value">${d.toma.xNome}</div>
        </div>
        <div class="field">
          <div class="label">Inscrição Municipal</div>
          <div class="value mono">${d.toma.IM || '-'}</div>
        </div>
      </div>
      <div class="fields" style="grid-template-columns: 1fr 120px 80px;">
        <div class="field">
          <div class="label">Endereço</div>
          <div class="value">${d.toma.endereco || '-'}</div>
        </div>
        <div class="field">
          <div class="label">Município</div>
          <div class="value">${d.toma.municipio || '-'}</div>
        </div>
        <div class="field">
          <div class="label">UF</div>
          <div class="value">${d.toma.uf || '-'}</div>
        </div>
      </div>
    </div>
    
    <!-- Serviço -->
    <div class="section">
      <div class="section-title">Discriminação do Serviço</div>
      <div class="fields" style="grid-template-columns: 120px 120px 1fr;">
        <div class="field">
          <div class="label">Código Tributação Nacional</div>
          <div class="value mono highlight">${d.serv.cTribNac}</div>
        </div>
        <div class="field">
          <div class="label">Município da Prestação</div>
          <div class="value">${d.serv.localPrest}</div>
        </div>
        <div class="field">
          <div class="label">Data Competência</div>
          <div class="value">${d.dCompet}</div>
        </div>
      </div>
      <div class="desc-serv">${d.serv.xDescServ}</div>
    </div>
    
    <!-- Valores -->
    <div class="section">
      <div class="section-title">Valores da NFS-e</div>
      <div class="valores-grid">
        <div class="field">
          <div class="label">Valor do Serviço</div>
          <div class="value large">${d.valores.vServ}</div>
        </div>
        <div class="field">
          <div class="label">Base de Cálculo ISSQN</div>
          <div class="value mono">${d.valores.vBC}</div>
        </div>
        <div class="field">
          <div class="label">Alíquota ISSQN</div>
          <div class="value mono">${d.valores.pAliq}%</div>
        </div>
        <div class="field">
          <div class="label">Valor ISSQN</div>
          <div class="value mono">${d.valores.vISSQN}</div>
        </div>
      </div>
      <div class="valores-grid">
        <div class="field">
          <div class="label">Desc. Incondicionado</div>
          <div class="value mono">${d.valores.descIncond || 'R$ 0,00'}</div>
        </div>
        <div class="field">
          <div class="label">PIS</div>
          <div class="value mono">${d.valores.vPIS || 'R$ 0,00'}</div>
        </div>
        <div class="field">
          <div class="label">COFINS</div>
          <div class="value mono">${d.valores.vCofins || 'R$ 0,00'}</div>
        </div>
        <div class="field">
          <div class="label">Valor Líquido</div>
          <div class="value large highlight">${d.valores.vLiq}</div>
        </div>
      </div>
    </div>
    
    <!-- IBS/CBS -->
    <div class="section ibscbs-section">
      <div class="section-title">⚡ IBS/CBS — Reforma Tributária do Consumo</div>
      <div class="ibscbs-grid">
        <div class="field">
          <div class="label">IBS Estadual (UF)</div>
          <div class="value mono">${d.ibscbs.vIBSUF} <span style="font-size:6pt;color:#888">(${d.ibscbs.pAliqEfetUF}%)</span></div>
        </div>
        <div class="field">
          <div class="label">IBS Municipal (Mun)</div>
          <div class="value mono">${d.ibscbs.vIBSMun} <span style="font-size:6pt;color:#888">(${d.ibscbs.pAliqEfetMun}%)</span></div>
        </div>
        <div class="field">
          <div class="label">CBS (Federal)</div>
          <div class="value mono">${d.ibscbs.vCBS} <span style="font-size:6pt;color:#888">(${d.ibscbs.pAliqEfetCBS}%)</span></div>
        </div>
      </div>
      <div class="ibscbs-grid">
        <div class="field">
          <div class="label">IBS Total</div>
          <div class="value mono">${d.ibscbs.vIBSTot}</div>
        </div>
        <div class="field">
          <div class="label">Base de Cálculo IBS/CBS</div>
          <div class="value mono">${d.ibscbs.vBC}</div>
        </div>
        <div class="field">
          <div class="label">Valor Total NF (com IBS/CBS)</div>
          <div class="value large">${d.ibscbs.vTotNF}</div>
        </div>
      </div>
    </div>
    
    <!-- QR Code area -->
    <div class="qrcode-area">
      <div class="qrcode-placeholder">QR Code</div>
      <div style="font-size: 7pt; color: #888; text-align: left;">
        <div>Consulte a NFS-e em:</div>
        <div style="font-weight: 600; color: #4F46E5;">https://www.nfse.gov.br/consulta</div>
        <div style="margin-top: 4px;">Protocolo: ${d.protocolo || 'PROT' + Date.now()}</div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      Documento Auxiliar da NFS-e (DANFSe) — Gerado pelo Sistema Antigravity ADN — 
      ${new Date().toLocaleString('pt-BR')} — Válido como representação gráfica da NFS-e
    </div>
  </div>
</body>
</html>`;
}

/**
 * Abre o DANFSe em nova janela (para impressão/PDF)
 */
export function openDANFSe(nfseData) {
  const html = generateDANFSeHTML(nfseData);
  const win = window.open('', '_blank', 'width=800,height=1100');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Auto-trigger print after rendering
    win.onload = () => {
      setTimeout(() => win.print(), 500);
    };
  }
  return html;
}

/**
 * Faz download do DANFSe como HTML
 */
export function downloadDANFSeHTML(nfseData) {
  const html = generateDANFSeHTML(nfseData);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DANFSe_${nfseData?.nNFSe || 'preview'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────
function formatChave(chave) {
  if (!chave) return '';
  return chave.replace(/(.{4})/g, '$1 ').trim();
}

function getDemoNFSeData() {
  return {
    nNFSe: '000000000001248',
    chaveAcesso: '35260212345678000195550010000012481234567890',
    dhProc: '09/03/2026 17:45:00',
    tpAmb: '2',
    dCompet: '09/03/2026',
    protocolo: 'PROT356789012345',
    prest: {
      doc: '12.345.678/0001-95',
      xNome: 'Tech Solutions Ltda',
      IM: '12345-X',
      endereco: 'Av. Paulista, 1000 - 10º andar',
      municipio: 'São Paulo',
      uf: 'SP',
    },
    toma: {
      doc: '98.765.432/0001-88',
      xNome: 'Empresa XYZ S.A.',
      IM: '67890-Y',
      endereco: 'Rua Rio Branco, 500',
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
    },
    serv: {
      cTribNac: '1.05',
      localPrest: 'São Paulo - SP',
      xDescServ: 'Licenciamento de uso de software desenvolvido sob encomenda, incluindo manutenção mensal e suporte técnico especializado. Período: março/2026.',
    },
    valores: {
      vServ: 'R$ 15.800,00',
      vBC: 'R$ 15.800,00',
      pAliq: '5,00',
      vISSQN: 'R$ 790,00',
      descIncond: 'R$ 0,00',
      vPIS: 'R$ 102,70',
      vCofins: 'R$ 474,00',
      vLiq: 'R$ 15.010,00',
    },
    ibscbs: {
      vBC: 'R$ 14.433,30',
      pAliqEfetUF: '0,10',
      vIBSUF: 'R$ 14,43',
      pAliqEfetMun: '0,05',
      vIBSMun: 'R$ 7,22',
      pAliqEfetCBS: '0,90',
      vCBS: 'R$ 129,90',
      vIBSTot: 'R$ 21,65',
      vTotNF: 'R$ 15.010,00',
    },
  };
}
