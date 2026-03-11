/**
 * NFS-e Antigravity — Consulta NFS-e
 * Consulta por chave de acesso ou ID DPS
 */
import { validateChaveNFSe, maskCNPJ, maskCurrency } from '../fiscal-utils.js';
import { toast } from '../toast.js';
import { safeFetch, consultarNFSe, consultarDPS } from '../api-service.js';
import { openDANFSe } from '../danfse-generator.js';

export function renderConsultaNFSe(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Consulta NFS-e</h1>
        <p class="page-description">Consulte Notas Fiscais de Serviço por Chave de Acesso ou ID da DPS</p>
      </div>
    </div>

    <!-- Search Card -->
    <div class="card animate-slide-up mb-6">
      <div class="card-body">
        <div class="tabs mb-4" style="padding: 0; border: 0;">
          <button class="tab active" id="search-tab-chave" data-search="chave">Por Chave de Acesso</button>
          <button class="tab" id="search-tab-dps" data-search="dps">Por ID da DPS</button>
        </div>

        <div id="search-chave">
          <div class="form-row">
            <div class="form-group" style="grid-column: span 3;">
              <label class="form-label">Chave de Acesso da NFS-e (50 dígitos)</label>
              <input class="form-input form-input-mono" id="consulta-chave" type="text" maxlength="50" 
                     placeholder="00000000000000000000000000000000000000000000000000"
                     style="font-size: var(--text-md); letter-spacing: 0.15em;">
            </div>
            <div class="form-group" style="align-self: flex-end;">
              <button class="btn btn-primary" id="btn-consultar-chave">🔍 Consultar</button>
            </div>
          </div>
        </div>

        <div id="search-dps" class="hidden">
          <div class="form-row">
            <div class="form-group" style="grid-column: span 3;">
              <label class="form-label">Identificador da DPS (DPS + 42 dígitos)</label>
              <input class="form-input form-input-mono" id="consulta-dps-id" type="text" maxlength="45"
                     placeholder="DPS000000000000000000000000000000000000000000000">
            </div>
            <div class="form-group" style="align-self: flex-end;">
              <button class="btn btn-primary" id="btn-consultar-dps">🔍 Consultar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Result Area -->
    <div id="consulta-result" class="hidden">
      <div class="card animate-slide-up">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <h3 class="card-title">NFS-e Localizada</h3>
            <span class="badge badge-success" id="result-status">Autorizada</span>
          </div>
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-ghost btn-sm" id="btn-danfse">📄 DANFSe (PDF)</button>
            <button class="btn btn-ghost btn-sm" id="btn-xml">⬇ Download XML</button>
            <button class="btn btn-ghost btn-sm" id="btn-eventos">📋 Eventos</button>
          </div>
        </div>
        <div class="card-body">
          <!-- NFS-e Header Info -->
          <div class="grid grid-4 gap-4 mb-6">
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
              <div class="form-label" style="margin-bottom: var(--space-1);">Número NFS-e</div>
              <div class="text-mono" style="font-size: var(--text-md); font-weight: 700; color: var(--color-primary-400);" id="result-nNFSe">000000000001</div>
            </div>
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
              <div class="form-label" style="margin-bottom: var(--space-1);">Data/Hora Processamento</div>
              <div style="font-size: var(--text-sm); color: var(--color-neutral-200);" id="result-dhProc">09/03/2026 17:45:00</div>
            </div>
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
              <div class="form-label" style="margin-bottom: var(--space-1);">Município Emissor</div>
              <div style="font-size: var(--text-sm); color: var(--color-neutral-200);" id="result-locEmi">São Paulo - SP</div>
            </div>
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
              <div class="form-label" style="margin-bottom: var(--space-1);">Ambiente</div>
              <div style="font-size: var(--text-sm); color: var(--color-neutral-200);" id="result-amb">Homologação</div>
            </div>
          </div>

          <!-- Chave de Acesso -->
          <div style="padding: var(--space-3) var(--space-4); background: var(--surface-glass); border-radius: var(--radius-md); margin-bottom: var(--space-6); border: 1px solid var(--surface-glass-border);">
            <div class="form-label" style="margin-bottom: var(--space-1);">Chave de Acesso</div>
            <div class="text-mono" style="font-size: var(--text-sm); color: var(--color-primary-300); letter-spacing: 0.15em; word-break: break-all;" id="result-chave">
              35260212345678000195550010000001231123456789
            </div>
          </div>

          <!-- Actors -->
          <div class="grid grid-2 gap-6 mb-6">
            <div>
              <div class="section-title" style="font-size: var(--text-sm);">
                <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">🏢</span>Prestador
              </div>
              <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                <div><span class="text-muted" style="font-size: var(--text-xs);">CNPJ:</span> <span class="text-mono" id="result-prest-doc">12.345.678/0001-95</span></div>
                <div><span class="text-muted" style="font-size: var(--text-xs);">Razão Social:</span> <span id="result-prest-nome">Tech Solutions Ltda</span></div>
                <div><span class="text-muted" style="font-size: var(--text-xs);">Município:</span> <span id="result-prest-mun">São Paulo - SP (3550308)</span></div>
              </div>
            </div>
            <div>
              <div class="section-title" style="font-size: var(--text-sm);">
                <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">👤</span>Tomador
              </div>
              <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                <div><span class="text-muted" style="font-size: var(--text-xs);">CNPJ:</span> <span class="text-mono" id="result-toma-doc">98.765.432/0001-88</span></div>
                <div><span class="text-muted" style="font-size: var(--text-xs);">Razão Social:</span> <span id="result-toma-nome">Empresa XYZ S.A.</span></div>
                <div><span class="text-muted" style="font-size: var(--text-xs);">Município:</span> <span id="result-toma-mun">Rio de Janeiro - RJ (3304557)</span></div>
              </div>
            </div>
          </div>

          <!-- Values Table -->
          <div class="section-title" style="font-size: var(--text-sm);">
            <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">💰</span>Valores
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Valor do Serviço</td><td style="text-align:right; font-family: var(--font-mono); font-weight: 600;" id="result-vServ">R$ 15.800,00</td></tr>
              <tr><td>Base de Cálculo ISSQN</td><td style="text-align:right; font-family: var(--font-mono);" id="result-vBC">R$ 15.800,00</td></tr>
              <tr><td>ISSQN (5,00%)</td><td style="text-align:right; font-family: var(--font-mono);" id="result-vISSQN">R$ 790,00</td></tr>
              <tr><td>PIS</td><td style="text-align:right; font-family: var(--font-mono);" id="result-vPIS">R$ 102,70</td></tr>
              <tr><td>COFINS</td><td style="text-align:right; font-family: var(--font-mono);" id="result-vCOFINS">R$ 474,00</td></tr>
              <tr style="border-top: 2px solid var(--surface-glass-border);">
                <td style="font-weight: 700; color: var(--color-neutral-100);">Valor Líquido</td>
                <td style="text-align:right; font-family: var(--font-mono); font-weight: 700; color: var(--color-accent-400); font-size: var(--text-md);" id="result-vLiq">R$ 15.010,00</td>
              </tr>
            </tbody>
          </table>

          <!-- IBS/CBS Section -->
          <div class="section-title" style="font-size: var(--text-sm); margin-top: var(--space-6);">
            <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">⚡</span>IBS/CBS (Reforma Tributária)
          </div>
          <div class="grid grid-3 gap-4">
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: var(--text-xs); color: var(--color-neutral-500); margin-bottom: var(--space-1);">IBS UF</div>
              <div style="font-size: var(--text-md); font-weight: 700; color: var(--color-primary-400); font-family: var(--font-mono);" id="result-ibs-uf-val">R$ 0,00</div>
              <div style="font-size: 10px; color: var(--color-neutral-600);" id="result-ibs-uf-aliq">Alíq. Efet. 0,00%</div>
            </div>
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: var(--text-xs); color: var(--color-neutral-500); margin-bottom: var(--space-1);">IBS Municipal</div>
              <div style="font-size: var(--text-md); font-weight: 700; color: var(--color-accent-400); font-family: var(--font-mono);" id="result-ibs-mun-val">R$ 0,00</div>
              <div style="font-size: 10px; color: var(--color-neutral-600);" id="result-ibs-mun-aliq">Alíq. Efet. 0,00%</div>
            </div>
            <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: var(--text-xs); color: var(--color-neutral-500); margin-bottom: var(--space-1);">CBS Federal</div>
              <div style="font-size: var(--text-md); font-weight: 700; color: var(--color-warning-400); font-family: var(--font-mono);" id="result-cbs-val">R$ 0,00</div>
              <div style="font-size: 10px; color: var(--color-neutral-600);" id="result-cbs-aliq">Alíq. Efet. 0,00%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No result -->
    <div id="consulta-empty" class="card animate-slide-up">
      <div class="card-body">
        <div class="empty-state">
          <div class="icon">🔍</div>
          <p style="font-size: var(--text-md); font-weight: 500; color: var(--color-neutral-300); margin-bottom: var(--space-2);">Nenhuma NFS-e consultada</p>
          <p style="font-size: var(--text-sm);">Informe a Chave de Acesso (50 dígitos) ou o ID da DPS para localizar a nota fiscal</p>
        </div>
      </div>
    </div>
  `;

  // Setup search tabs
  document.querySelectorAll('[data-search]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-search]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('search-chave').classList.toggle('hidden', tab.dataset.search !== 'chave');
      document.getElementById('search-dps').classList.toggle('hidden', tab.dataset.search !== 'dps');
    });
  });

  // Search by chave
  document.getElementById('btn-consultar-chave')?.addEventListener('click', async () => {
    const chave = document.getElementById('consulta-chave')?.value.trim();
    if (!chave) {
      toast.warning('Informe a Chave de Acesso.');
      return;
    }
    if (!validateChaveNFSe(chave)) {
      toast.error('Chave de Acesso inválida. Deve conter exatamente 50 dígitos numéricos.');
      return;
    }
    // Show result using API
    toast.info('Consultando NFS-e na Sefin Nacional...');
    try {
      const response = await safeFetch(consultarNFSe, chave);
      if (response.ok) {
        const nfse = response.data.infNFSe || response.data;
        document.getElementById('result-chave').textContent = chave;
        document.getElementById('result-nNFSe').textContent = nfse.nNFSe || 'N/A';
        
        let dEmi = nfse.dhEmi || nfse.dhProc || '-';
        if (dEmi !== '-') {
          const dt = new Date(dEmi);
          dEmi = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR');
        }
        document.getElementById('result-dhProc').textContent = dEmi;
        
        document.getElementById('result-status').textContent = `cStat: ${response.data.cStat} — ${response.data.cStat === '100' ? 'Autorizada' : 'Processada'}`;
        
        const locEmi = nfse.locEmi || (nfse.emit && nfse.emit.xMun ? nfse.emit.xMun : 'São Paulo - SP');
        document.getElementById('result-locEmi').textContent = locEmi;

        document.getElementById('result-amb').textContent = nfse.ambGer === '1' ? 'Produção' : 'Homologação';

        // Prestador
        if (nfse.emit) {
           document.getElementById('result-prest-doc').textContent = maskCNPJ(nfse.emit.CNPJ || '');
           document.getElementById('result-prest-nome').textContent = nfse.emit.xNome || 'N/A';
           document.getElementById('result-prest-mun').textContent = nfse.emit.xMun || 'N/A';
        }

        // Tomador
        if (nfse.toma) {
           document.getElementById('result-toma-doc').textContent = maskCNPJ(nfse.toma.CNPJ || nfse.toma.CPF || '');
           document.getElementById('result-toma-nome').textContent = nfse.toma.xNome || 'N/A';
           document.getElementById('result-toma-mun').textContent = nfse.toma.xMun || 'N/A';
        } else {
           document.getElementById('result-toma-doc').textContent = '—';
           document.getElementById('result-toma-nome').textContent = 'Consumidor Final / Não Informado';
           document.getElementById('result-toma-mun').textContent = '—';
        }

        // Valores update (if we have values container)
        const vS = document.getElementById('result-vServ');
        if (vS && nfse.valores) vS.textContent = maskCurrency(nfse.valores.vServ);

        const vBC = document.getElementById('result-vBC');
        if (vBC && nfse.valores) vBC.textContent = maskCurrency(nfse.valores.vBC || nfse.valores.vServ || 0);

        const vISSQN = document.getElementById('result-vISSQN');
        if (vISSQN && nfse.valores) vISSQN.textContent = maskCurrency(nfse.valores.vISSQN || 0);

        const vPIS = document.getElementById('result-vPIS');
        if (vPIS && nfse.valores) vPIS.textContent = maskCurrency(nfse.valores.vPIS || 0);

        const vCOFINS = document.getElementById('result-vCOFINS');
        if (vCOFINS && nfse.valores) vCOFINS.textContent = maskCurrency(nfse.valores.vCofins || 0);

        const vL = document.getElementById('result-vLiq');
        if (vL && nfse.valores) vL.textContent = maskCurrency(nfse.valores.vLiq || nfse.valores.vServ || 0);

        // IBS/CBS update
        if (nfse.IBSCBS) {
           const ufs = nfse.IBSCBS.uf;
           if (ufs) {
              document.getElementById('result-ibs-uf-val').textContent = maskCurrency(ufs.vIBSUF);
              document.getElementById('result-ibs-uf-aliq').textContent = `Alíq. Efet. ${ufs.pAliqEfetUF || ufs.pIBSUF || '0.00'}%`;
           }
           const muns = nfse.IBSCBS.mun;
           if (muns) {
              document.getElementById('result-ibs-mun-val').textContent = maskCurrency(muns.vIBSMun);
              document.getElementById('result-ibs-mun-aliq').textContent = `Alíq. Efet. ${muns.pAliqEfetMun || muns.pIBSMun || '0.00'}%`;
           }
           const feds = nfse.IBSCBS.fed;
           if (feds) {
              document.getElementById('result-cbs-val').textContent = maskCurrency(feds.vCBS);
              document.getElementById('result-cbs-aliq').textContent = `Alíq. Efet. ${feds.pAliqEfetCBS || feds.pCBS || '0.00'}%`;
           }
        }

        document.getElementById('consulta-result').classList.remove('hidden');
        document.getElementById('consulta-empty').classList.add('hidden');
        toast.success('✅ NFS-e localizada com sucesso!');
      } else {
        toast.error('NFS-e não encontrada.');
      }
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  });

  // Search by DPS
  document.getElementById('btn-consultar-dps')?.addEventListener('click', async () => {
    const dpsId = document.getElementById('consulta-dps-id')?.value.trim();
    if (!dpsId) {
      toast.warning('Informe o ID da DPS.');
      return;
    }
    // Show result using API
    toast.info('Consultando DPS na Sefin Nacional...');
    try {
      const response = await safeFetch(consultarDPS, dpsId);
      if (response.ok) {
        document.getElementById('consulta-result').classList.remove('hidden');
        document.getElementById('consulta-empty').classList.add('hidden');
        toast.success('✅ NFS-e localizada via DPS!');
      } else {
        toast.error('DPS não encontrada.');
      }
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  });

  // Action buttons
  document.getElementById('btn-danfse')?.addEventListener('click', () => {
    toast.info('Gerando DANFSe...');
    openDANFSe();
    toast.success('DANFSe aberto em nova janela para impressão/PDF!');
  });
  document.getElementById('btn-xml')?.addEventListener('click', () => {
    toast.info('Download XML: em produção, conecta ao ADN para baixar o XML original da NFS-e.');
  });
  document.getElementById('btn-eventos')?.addEventListener('click', () => {
    toast.info('Consultando eventos: GET /nfse/{chaveAcesso}/eventos');
    window.location.hash = '/eventos';
  });
}
