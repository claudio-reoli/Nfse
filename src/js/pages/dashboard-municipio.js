import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';

export function renderDashboardMunicipio(container) {
  const BASE_URL = getBackendUrl();
  let munConfig = null;

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title" id="dash-mun-titulo">Painel de Apuração ISSQN</h1>
        <p class="page-description">Sincronize com a Sefin Nacional e feche os impostos mensais.</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary" id="btn-forcar-sync">
           📥 Baixar NFs do ADN Sefin
        </button>
        <button class="btn btn-primary" id="btn-rodar-apuracao" style="background:var(--color-success-400);">
           💰 Fechar Apuração Mensal
        </button>
      </div>
    </div>

    <div id="cert-alert-mun" class="hidden" style="margin-bottom: var(--space-4); padding: var(--space-3); border-radius: var(--radius-md); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: var(--color-warning-400); font-weight: 500; display: flex; align-items: center; gap: var(--space-3);">
      <span>⚠️ Certificado digital do município não configurado. <a href="#/configuracoes" style="color: var(--color-primary-400); text-decoration: underline;">Configurar agora</a></span>
    </div>

    <div id="alertBoxMun" class="hidden" style="margin-bottom: var(--space-4); padding: var(--space-3); border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: var(--color-success-400); font-weight: 500;">
    </div>

    <div class="grid grid-3 gap-4 mb-6">
      <div class="card animate-slide-up">
        <div class="card-body" style="padding: var(--space-4);">
          <div style="font-size: var(--text-xs); color: var(--color-neutral-400); text-transform: uppercase;">ISS Próprio (A Receber)</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-primary-400); margin: var(--space-2) 0;" id="statIssProprio">R$ 0,00</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Imposto devido pelo Prestador</div>
        </div>
      </div>
      <div class="card animate-slide-up">
        <div class="card-body" style="padding: var(--space-4);">
          <div style="font-size: var(--text-xs); color: var(--color-neutral-400); text-transform: uppercase;">ISS Retido na Fonte</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-danger-400); margin: var(--space-2) 0;" id="statIssRetido">R$ 0,00</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Imposto devido pelo Tomador</div>
        </div>
      </div>
      <div class="card animate-slide-up">
        <div class="card-body" style="padding: var(--space-4);">
          <div style="font-size: var(--text-xs); color: var(--color-neutral-400); text-transform: uppercase;">Total Notas Emitidas</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-accent-400); margin: var(--space-2) 0;" id="statQtdNotas">0</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Volume da competência</div>
        </div>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">Guias de Arrecadação por CNPJ (Março/2026)</h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table" id="tabelaApuracoes">
            <thead>
              <tr>
                <th>CNPJ Contribuinte</th>
                <th>Imposto Próprio (Guia)</th>
                <th>Imposto Retido (Guia Tomador)</th>
                <th>Volume (NFs)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="5" style="text-align: center;">Nenhuma apuração processada. Clique em "Fechar Apuração Mensal"</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const alertBox = document.getElementById('alertBoxMun');

  function showAlert(msg) {
      alertBox.textContent = msg;
      alertBox.classList.remove('hidden');
      setTimeout(() => alertBox.classList.add('hidden'), 5000);
  }

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/municipio/config`);
      munConfig = await res.json();
      const titulo = document.getElementById('dash-mun-titulo');
      if (titulo && munConfig.nome) {
        titulo.textContent = `Painel de Apuração ISSQN (${munConfig.nome} - ${munConfig.ibge})`;
      }
      const certAlert = document.getElementById('cert-alert-mun');
      if (!munConfig.certSubject && certAlert) {
        certAlert.classList.remove('hidden');
        certAlert.style.display = 'flex';
      }
    } catch { /* silent */ }
  })();

  document.getElementById('btn-forcar-sync')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-forcar-sync');
      btn.disabled = true;
      btn.textContent = '⏳ Sincronizando com ADN...';
      try {
          const response = await fetch(`${BASE_URL}/admin/force-sync`, { method: 'POST' });
          const data = await response.json();
          if (data.sucesso) {
              const notasRes = await fetch(`${BASE_URL}/municipio/notas`);
              const notasData = await notasRes.json();
              const totalNotas = notasData.notas?.length || 0;
              document.getElementById('statQtdNotas').textContent = totalNotas;

              const fonteLabel = data.fonte === 'ADN' ? 'API ADN Real' : data.fonte === 'erro' ? 'Falha na API' : 'Base local';
              const novasLabel = data.novaNotas !== undefined ? `${data.novaNotas} novas` : '';

              if (data.fonte === 'erro') {
                showAlert(`API ADN indisponível: ${data.erro || 'sem resposta'}. Nenhuma nota importada.`);
                toast.warning(`ADN não respondeu. ${totalNotas} notas na base local.`);
              } else {
                showAlert(`Fonte: ${fonteLabel} | NSU: ${data.maxNsu} | ${novasLabel} | ${totalNotas} total na base.`);
                toast.success(`${novasLabel || 'Sincronização concluída'} via ${fonteLabel}. ${totalNotas} na base local.`);
              }
          }
      } catch (err) {
          console.error('Erro de Sync:', err);
          toast.error('Erro: Backend-município não respondeu.');
      } finally {
          btn.disabled = false;
          btn.textContent = '📥 Baixar NFs do ADN Sefin';
      }
  });

  document.getElementById('btn-rodar-apuracao')?.addEventListener('click', async () => {
      try {
          const response = await fetch(`${BASE_URL}/admin/force-apuracao`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ competencia: '2026-03' })
          });
          const data = await response.json();
          if (data.sucesso) {
              showAlert(`Mês fechado! ${data.qdtGuias} CNPJs consolidados na base de Utinga.`);
              renderTable(data.resultados);
              updateStats(data.resultados);
          }
      } catch (err) {
          console.error('Erro de Apuração:', err);
          showAlert('Falha na apuração: O Backend não respondeu.');
      }
  });

  function renderTable(apuracoes) {
      const tbody = document.querySelector('#tabelaApuracoes tbody');
      tbody.innerHTML = '';
      if (apuracoes.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum débito na competência para Utinga</td></tr>';
          return;
      }

      apuracoes.forEach(a => {
          const tr = document.createElement('tr');
          const formataBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

          const btnHtml = a.guia 
            ? `<span class="badge ${a.status === 'Paga' ? 'badge-success' : 'badge-warning'}">${a.status}</span>`
            : `<button class="btn btn-sm btn-secondary btn-gerar-guia" data-id="${a.id}">Gerar DAM / PIX</button>`;

          tr.innerHTML = `
              <td><strong>${a.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</strong></td>
              <td style="color:var(--color-success-400); font-weight: 600;">${formataBRL(a.totalIssProprio) || 'R$ 0,00'}</td>
              <td style="color:var(--color-danger-400); font-weight: 600;">${formataBRL(a.totalIssTerceiros) || 'R$ 0,00'}</td>
              <td>${a.totalNotasEmitidas} NFs</td>
              <td>${btnHtml}</td>
          `;
          tbody.appendChild(tr);
      });

      document.querySelectorAll('.btn-gerar-guia').forEach(btn => {
          btn.addEventListener('click', async (e) => {
              const id = e.target.getAttribute('data-id');
              try {
                  const res = await fetch(`${BASE_URL}/municipio/gerar-guia/${id}`, { method: 'POST' });
                  const data = await res.json();
                  if(data.sucesso) {
                      showAlert('Guia de Recolhimento gerada com sucesso.');
                      // Refresh table 
                      document.getElementById('btn-rodar-apuracao').click();
                  }
              } catch(err) {
                  showAlert('Erro ao gerar guia.');
              }
          });
      });
  }

  function updateStats(apuracoes) {
      const formataBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      let totalProprio = 0, totalRetido = 0, totalNotas = 0;

      apuracoes.forEach(a => {
          totalProprio += a.totalIssProprio || 0;
          totalRetido += a.totalIssTerceiros || 0;
          totalNotas += a.totalNotasEmitidas || 0;
      });

      document.getElementById('statIssProprio').textContent = formataBRL(totalProprio);
      document.getElementById('statIssRetido').textContent = formataBRL(totalRetido);
      document.getElementById('statQtdNotas').textContent = totalNotas;
  }
}
