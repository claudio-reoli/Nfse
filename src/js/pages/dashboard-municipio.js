import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v) || 0);
const fmtCNPJ = (v) => (v || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtComp = (v) => {
  if (!v) return '';
  const [ano, mes] = v.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(mes, 10) - 1] || mes}/${ano}`;
};

export function renderDashboardMunicipio(container) {
  const BASE_URL = getBackendUrl();
  let munConfig    = null;
  let competencias = [];
  let compAtual    = '';

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title" id="dash-mun-titulo">Painel de Apuração ISSQN</h1>
        <p class="page-description">Sincronize com a Sefin Nacional e feche os impostos mensais.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-secondary" id="btn-forcar-sync">📥 Baixar NFs do ADN Sefin</button>
        <button class="btn btn-primary" id="btn-rodar-apuracao" style="background:var(--color-success-400);">💰 Fechar Apuração Mensal</button>
      </div>
    </div>

    <div id="cert-alert-mun" class="hidden" style="margin-bottom:var(--space-4);padding:var(--space-3);border-radius:var(--radius-md);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);color:var(--color-warning-400);font-weight:500;display:flex;align-items:center;gap:var(--space-3);">
      <span>⚠️ Certificado digital do município não configurado. <a href="#/configuracoes" style="color:var(--color-primary-400);text-decoration:underline;">Configurar agora</a></span>
    </div>

    <div id="alertBoxMun" class="hidden" style="margin-bottom:var(--space-4);padding:var(--space-3);border-radius:var(--radius-md);background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);color:var(--color-success-400);font-weight:500;"></div>

    <!-- Stats -->
    <div class="grid grid-3 gap-4 mb-6">
      <div class="card animate-slide-up">
        <div class="card-body" style="padding:var(--space-4);">
          <div style="font-size:var(--text-xs);color:var(--color-neutral-400);text-transform:uppercase;">ISS Próprio (A Receber)</div>
          <div style="font-size:2rem;font-weight:700;color:var(--color-primary-400);margin:var(--space-2) 0;" id="statIssProprio">R$ 0,00</div>
          <div style="font-size:var(--text-xs);color:var(--color-neutral-500);">Imposto devido pelo Prestador</div>
        </div>
      </div>
      <div class="card animate-slide-up">
        <div class="card-body" style="padding:var(--space-4);">
          <div style="font-size:var(--text-xs);color:var(--color-neutral-400);text-transform:uppercase;">ISS Retido na Fonte</div>
          <div style="font-size:2rem;font-weight:700;color:var(--color-danger-400);margin:var(--space-2) 0;" id="statIssRetido">R$ 0,00</div>
          <div style="font-size:var(--text-xs);color:var(--color-neutral-500);">Imposto devido pelo Tomador</div>
        </div>
      </div>
      <div class="card animate-slide-up">
        <div class="card-body" style="padding:var(--space-4);">
          <div style="font-size:var(--text-xs);color:var(--color-neutral-400);text-transform:uppercase;">Total Notas na Competência</div>
          <div style="font-size:2rem;font-weight:700;color:var(--color-accent-400);margin:var(--space-2) 0;" id="statQtdNotas">0</div>
          <div style="font-size:var(--text-xs);color:var(--color-neutral-500);">Volume apurado</div>
        </div>
      </div>
    </div>

    <!-- Modal Guia DAM/PIX -->
    <div id="modal-guia-dam" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.72);z-index:1000;align-items:center;justify-content:center;overflow-y:auto;padding:24px 12px;">
      <div style="width:100%;max-width:540px;border-radius:var(--radius-xl);overflow:hidden;background:var(--surface-card);border:1px solid var(--surface-glass-border);position:relative;margin:auto;">
        <button id="fechar-modal-guia" title="Fechar" style="position:absolute;right:14px;top:14px;background:rgba(239,68,68,0.12);border:none;color:var(--color-danger-400);cursor:pointer;width:30px;height:30px;border-radius:50%;font-size:16px;font-weight:bold;z-index:10;display:flex;align-items:center;justify-content:center;">✕</button>
        <div id="modal-guia-conteudo" style="padding:24px;"></div>
        <div style="display:flex;gap:10px;padding:0 24px 20px;justify-content:flex-end;">
          <button id="btn-imprimir-guia" class="btn btn-secondary">🖨️ Imprimir / Salvar PDF</button>
          <button id="btn-fechar-guia-bottom" class="btn btn-ghost">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Tabela de apurações -->
    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <h3 class="card-title" id="titulo-tabela-apu">Guias de Arrecadação por CNPJ</h3>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.82rem;color:var(--color-neutral-400);white-space:nowrap;">Competência:</label>
          <select class="form-select" id="sel-competencia" style="min-width:130px;">
            <option value="">Carregando...</option>
          </select>
        </div>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-container">
          <table class="data-table" id="tabelaApuracoes">
            <thead>
              <tr>
                <th>CNPJ Contribuinte</th>
                <th style="text-align:right;">ISS Próprio</th>
                <th style="text-align:right;">ISS Retido</th>
                <th style="text-align:center;">NFs</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:center;">Ação</th>
              </tr>
            </thead>
            <tbody id="tbody-apuracoes">
              <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-neutral-500);">Selecione uma competência ou clique em "Fechar Apuração Mensal".</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const authH = () => ({ 'Authorization': `Bearer ${getMunToken()}` });
  const alertBox = document.getElementById('alertBoxMun');

  function showAlert(msg, tipo = 'success') {
    const colors = {
      success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', text: 'var(--color-success-400)' },
      warning: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  text: 'var(--color-warning-400)' },
      error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   text: 'var(--color-danger-400)' },
    };
    const c = colors[tipo] || colors.success;
    alertBox.style.cssText = `margin-bottom:var(--space-4);padding:var(--space-3);border-radius:var(--radius-md);background:${c.bg};border:1px solid ${c.border};color:${c.text};font-weight:500;`;
    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');
    setTimeout(() => alertBox.classList.add('hidden'), 6000);
  }

  // ── Carregar config e certificado ──────────────────────────────
  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/municipio/config`, { headers: authH() });
      if (!res.ok) return;
      munConfig = await res.json();

      const titulo = document.getElementById('dash-mun-titulo');
      if (titulo && munConfig.nome) {
        const munDisplay = munConfig.nome && munConfig.uf
          ? `${munConfig.nome} (${munConfig.uf}) — IBGE: ${munConfig.ibge || ''}`
          : munConfig.ibge ? `Código IBGE: ${munConfig.ibge}` : munConfig.nome || 'Município';
        titulo.textContent = `Painel de Apuração ISSQN (${munDisplay})`;
      }

      const certAlert = document.getElementById('cert-alert-mun');
      if (certAlert) {
        const semCert  = !munConfig.certSubject;
        const expirado = munConfig.certNotAfter && new Date(munConfig.certNotAfter) < new Date();
        if (semCert || expirado) {
          const msg = expirado
            ? `⚠️ Certificado digital do município <strong>expirado</strong> em ${new Date(munConfig.certNotAfter).toLocaleDateString('pt-BR')}. <a href="#/configuracoes" style="color:var(--color-primary-400);text-decoration:underline;">Renovar agora</a>`
            : `⚠️ Certificado digital do município não configurado. <a href="#/configuracoes" style="color:var(--color-primary-400);text-decoration:underline;">Configurar agora</a>`;
          certAlert.querySelector('span').innerHTML = msg;
          certAlert.classList.remove('hidden');
          certAlert.style.display = 'flex';
        }
      }
    } catch { /* silent */ }
  })();

  // ── Carregar competências disponíveis ──────────────────────────
  async function carregarCompetencias() {
    try {
      const res  = await fetch(`${BASE_URL}/municipio/competencias`, { headers: authH() });
      const data = await res.json();
      competencias = data.competencias || [];

      // Adiciona competência atual se não estiver na lista
      const hoje = new Date();
      const compHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      if (!competencias.includes(compHoje)) competencias.unshift(compHoje);

      const sel = document.getElementById('sel-competencia');
      sel.innerHTML = competencias.map(c =>
        `<option value="${c}">${fmtComp(c)} (${c})</option>`
      ).join('');

      compAtual = competencias[0] || compHoje;
      sel.value = compAtual;

      await carregarApuracoes(compAtual);
    } catch (err) {
      console.error('Erro ao carregar competências:', err);
    }
  }

  // ── Carregar apurações da base para a competência selecionada ──
  async function carregarApuracoes(comp) {
    if (!comp) return;
    compAtual = comp;
    try {
      const res  = await fetch(`${BASE_URL}/municipio/apuracoes-competencia/${comp}`, { headers: authH() });
      const data = await res.json();
      const apuracoes = data.apuracoes || [];

      const titulo = document.getElementById('titulo-tabela-apu');
      if (titulo) titulo.textContent = `Guias de Arrecadação por CNPJ — ${fmtComp(comp)}`;

      renderTable(apuracoes);
      updateStats(apuracoes);
    } catch (err) {
      console.error('Erro ao carregar apurações:', err);
    }
  }

  document.getElementById('sel-competencia')?.addEventListener('change', (e) => {
    carregarApuracoes(e.target.value);
  });

  // ── Botão: Baixar NFs do ADN ───────────────────────────────────
  document.getElementById('btn-forcar-sync')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-forcar-sync');
    btn.disabled = true;
    btn.textContent = '⏳ Sincronizando com ADN...';
    try {
      const response = await fetch(`${BASE_URL}/admin/force-sync`, { method: 'POST', headers: authH() });
      const data = await response.json();
      if (data.sucesso) {
        const notasRes  = await fetch(`${BASE_URL}/municipio/notas`, { headers: authH() });
        const notasData = await notasRes.json();
        const totalNotas = notasData.notas?.length || 0;

        const fonteLabel = data.fonte === 'ADN'              ? 'API ADN Real'
                         : data.fonte === 'adn_indisponivel' ? 'ADN indisponível'
                         : data.fonte === 'erro'             ? 'Falha na API'
                         : 'Base local';
        const novasLabel = data.novaNotas !== undefined ? `${data.novaNotas} novas` : '';

        if (data.fonte === 'erro') {
          showAlert(`API ADN indisponível: ${data.erro || 'sem resposta'}. Nenhuma nota importada.`, 'error');
        } else if (data.fonte === 'adn_indisponivel') {
          showAlert(`API ADN indisponível (modo local). ${totalNotas} notas na base. ${data.aviso || ''}`, 'warning');
        } else {
          showAlert(`Fonte: ${fonteLabel} | NSU: ${data.maxNsu} | ${novasLabel} | ${totalNotas} total na base.`);
          toast.success(`${novasLabel || 'Sincronização concluída'} via ${fonteLabel}.`);
        }

        // Atualiza lista de competências (podem ter chegado notas novas)
        await carregarCompetencias();
      }
    } catch (err) {
      console.error('Erro de Sync:', err);
      toast.error('Erro: Backend-município não respondeu.');
    } finally {
      btn.disabled = false;
      btn.textContent = '📥 Baixar NFs do ADN Sefin';
    }
  });

  // ── Botão: Fechar Apuração ─────────────────────────────────────
  document.getElementById('btn-rodar-apuracao')?.addEventListener('click', async () => {
    const comp = document.getElementById('sel-competencia')?.value || compAtual;
    if (!comp) { toast.warning('Selecione uma competência antes de fechar a apuração.'); return; }

    const btn = document.getElementById('btn-rodar-apuracao');
    btn.disabled = true;
    btn.textContent = '⏳ Processando...';

    try {
      const response = await fetch(`${BASE_URL}/admin/force-apuracao`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ competencia: comp })
      });
      const data = await response.json();
      if (data.sucesso) {
        showAlert(`Competência ${fmtComp(comp)} fechada! ${data.qdtGuias} CNPJ(s) consolidado(s).`);
        toast.success(`Apuração ${fmtComp(comp)} concluída — ${data.qdtGuias} contribuinte(s).`);
        // Recarrega da base para garantir persistência
        await carregarApuracoes(comp);
        // Atualiza seletor caso a competência seja nova
        await carregarCompetencias();
        document.getElementById('sel-competencia').value = comp;
      } else {
        showAlert(data.erro || 'Falha ao processar apuração.', 'error');
      }
    } catch (err) {
      console.error('Erro de Apuração:', err);
      showAlert('Falha na apuração: o backend não respondeu.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💰 Fechar Apuração Mensal';
    }
  });

  // ── Renderizar tabela ──────────────────────────────────────────
  let _apuracoesMapa = {};

  function renderTable(apuracoes) {
    const tbody = document.getElementById('tbody-apuracoes');
    if (!tbody) return;
    _apuracoesMapa = Object.fromEntries(apuracoes.map(a => [String(a.id), a]));

    if (!apuracoes.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-neutral-500);">
        Nenhuma apuração registrada para esta competência. Clique em "Fechar Apuração Mensal".
      </td></tr>`;
      return;
    }

    tbody.innerHTML = apuracoes.map(a => {
      const vProprio   = parseFloat(a.totalIssProprio   || 0);
      const vTerceiros = parseFloat(a.totalIssTerceiros || 0);
      const statusBadge = a.status === 'Paga'
        ? '<span class="badge badge-success">Paga</span>'
        : a.status === 'Guia Emitida'
          ? '<span class="badge badge-warning">Guia Emitida</span>'
          : '<span class="badge badge-primary">Aberta</span>';

      const verGuiaBtn = a.guia
        ? `<button class="btn btn-primary btn-sm btn-ver-guia" data-id="${a.id}" title="Visualizar e imprimir guia" style="margin-right:4px;">🧾 Ver Guia</button>`
        : '';
      const acaoBtns = a.status === 'Paga'
        ? `${verGuiaBtn}`
        : a.guia
          ? `${verGuiaBtn}<button class="btn btn-ghost btn-sm btn-marcar-paga" data-id="${a.id}" title="Confirmar pagamento">✅ Confirmar Pagamento</button>`
          : `<button class="btn btn-secondary btn-sm btn-gerar-guia" data-id="${a.id}">💳 Gerar DAM / PIX</button>`;

      return `<tr>
        <td><strong>${fmtCNPJ(a.cnpj)}</strong></td>
        <td style="text-align:right;color:var(--color-success-400);font-weight:600;">${fmtBRL(vProprio)}</td>
        <td style="text-align:right;color:var(--color-danger-400);font-weight:600;">${fmtBRL(vTerceiros)}</td>
        <td style="text-align:center;">${a.totalNotasEmitidas || 0}</td>
        <td style="text-align:center;">${statusBadge}</td>
        <td style="text-align:center;">${acaoBtns}</td>
      </tr>`;
    }).join('');

    // Listeners dos botões de ação
    tbody.querySelectorAll('.btn-gerar-guia').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = '⏳';
        try {
          const res  = await fetch(`${BASE_URL}/municipio/gerar-guia/${id}`, { method: 'POST', headers: authH() });
          const data = await res.json();
          if (data.sucesso) {
            toast.success('Guia DAM/PIX gerada com sucesso.');
            await carregarApuracoes(compAtual);
          } else {
            toast.error(data.error || 'Falha ao gerar guia.');
          }
        } catch { toast.error('Erro ao gerar guia.'); }
      });
    });

    tbody.querySelectorAll('.btn-ver-guia').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const apu = _apuracoesMapa[String(id)];
        if (apu) abrirModalGuia(apu);
      });
    });

    tbody.querySelectorAll('.btn-marcar-paga').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Confirmar o pagamento desta guia?')) return;
        try {
          const res  = await fetch(`${BASE_URL}/municipio/pagar-guia/${id}`, { method: 'POST', headers: authH() });
          const data = await res.json();
          if (data.sucesso) {
            toast.success('Pagamento registrado.');
            await carregarApuracoes(compAtual);
          }
        } catch { toast.error('Erro ao registrar pagamento.'); }
      });
    });
  }

  // ── Atualizar cards de stats ────────────────────────────────────
  function updateStats(apuracoes) {
    let totalProprio = 0, totalRetido = 0, totalNotas = 0;
    apuracoes.forEach(a => {
      totalProprio += parseFloat(a.totalIssProprio   || 0);
      totalRetido  += parseFloat(a.totalIssTerceiros || 0);
      totalNotas   += parseInt(a.totalNotasEmitidas  || 0, 10);
    });
    document.getElementById('statIssProprio').textContent = fmtBRL(totalProprio);
    document.getElementById('statIssRetido').textContent  = fmtBRL(totalRetido);
    document.getElementById('statQtdNotas').textContent   = totalNotas;
  }

  // ── Modal Guia DAM/PIX ─────────────────────────────────────────
  function fecharModalGuia() {
    const m = document.getElementById('modal-guia-dam');
    if (m) m.style.display = 'none';
  }
  document.getElementById('fechar-modal-guia')?.addEventListener('click', fecharModalGuia);
  document.getElementById('btn-fechar-guia-bottom')?.addEventListener('click', fecharModalGuia);
  document.getElementById('modal-guia-dam')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharModalGuia();
  });

  function abrirModalGuia(apu) {
    const guia      = apu.guia || {};
    const valor     = parseFloat(guia.valor || 0);
    const venc      = guia.dataVencimento ? new Date(guia.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const compFmt   = fmtComp(apu.competencia);
    const cnpjFmt   = fmtCNPJ(apu.cnpj);
    const munNome   = munConfig?.nome   || 'MUNICÍPIO';
    const munCnpj   = munConfig?.cnpj   ? fmtCNPJ(munConfig.cnpj)   : '—';
    const munEnder  = munConfig?.endereco || '';
    const qrUrl     = guia.pixPayload
      ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(guia.pixPayload)}`
      : '';

    const conteudo = document.getElementById('modal-guia-conteudo');
    conteudo.innerHTML = `
      <div id="dam-printable">
        <!-- Cabeçalho Municipal -->
        <div style="text-align:center;border-bottom:2px solid var(--color-primary-400);padding-bottom:14px;margin-bottom:16px;">
          ${munConfig?.brasao ? `<img src="${munConfig.brasao}" style="height:52px;object-fit:contain;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto;">` : ''}
          <div style="font-size:1rem;font-weight:700;color:var(--color-neutral-100);">${munNome}</div>
          <div style="font-size:0.78rem;color:var(--color-neutral-400);">${munConfig?.prefeitura || ''}</div>
          <div style="font-size:0.75rem;color:var(--color-neutral-500);">${munConfig?.email || ''} ${munConfig?.telefone ? '· ' + munConfig.telefone : ''}</div>
        </div>

        <!-- Título DAM -->
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:0.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--color-neutral-400);">Documento de Arrecadação Municipal</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--color-primary-400);">DAM — ISSQN</div>
        </div>

        <!-- Dados principais -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
          <div style="padding:10px 12px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);">
            <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:3px;">Contribuinte</div>
            <div style="font-weight:600;font-size:0.88rem;">${cnpjFmt}</div>
          </div>
          <div style="padding:10px 12px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);">
            <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:3px;">Competência</div>
            <div style="font-weight:600;font-size:0.88rem;">${compFmt}</div>
          </div>
          <div style="padding:10px 12px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);">
            <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:3px;">Vencimento</div>
            <div style="font-weight:600;font-size:0.88rem;color:${new Date(guia.dataVencimento) < new Date() ? 'var(--color-danger-400)' : 'var(--color-neutral-100)'};">${venc}</div>
          </div>
          <div style="padding:10px 12px;background:rgba(99,102,241,0.12);border-radius:var(--radius-md);border:1px solid rgba(99,102,241,0.3);">
            <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:3px;">Valor Total</div>
            <div style="font-weight:800;font-size:1.05rem;color:var(--color-primary-400);">${fmtBRL(valor)}</div>
          </div>
        </div>

        <!-- Detalhamento ISS -->
        <div style="padding:10px 14px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);margin-bottom:16px;font-size:0.82rem;">
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:var(--color-neutral-400);">ISS Próprio (Prestador)</span>
            <strong style="color:var(--color-success-400);">${fmtBRL(parseFloat(apu.totalIssProprio || 0))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:var(--color-neutral-400);">ISS Retido na Fonte (Tomador)</span>
            <strong style="color:var(--color-danger-400);">${fmtBRL(parseFloat(apu.totalIssTerceiros || 0))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;">
            <span style="color:var(--color-neutral-400);">Notas na Competência</span>
            <strong>${apu.totalNotasEmitidas || 0}</strong>
          </div>
        </div>

        <!-- QR Code PIX + Código de barras -->
        ${qrUrl ? `
        <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;">
          <div style="text-align:center;flex-shrink:0;">
            <div style="font-size:0.72rem;color:var(--color-neutral-500);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">QR Code PIX</div>
            <div style="background:#fff;padding:8px;border-radius:var(--radius-md);display:inline-block;">
              <img src="${qrUrl}" width="140" height="140" alt="QR Code PIX" style="display:block;">
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.72rem;color:var(--color-neutral-500);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Código Copia e Cola</div>
            <textarea id="pix-payload-dam" readonly rows="4"
              style="width:100%;font-family:monospace;font-size:0.72rem;padding:8px;background:var(--surface-glass);border:1px solid var(--surface-glass-border);border-radius:var(--radius-sm);color:var(--color-neutral-300);resize:none;line-height:1.4;">${guia.pixPayload || ''}</textarea>
            <button id="btn-copiar-pix-dam" class="btn btn-ghost btn-sm" style="margin-top:6px;width:100%;font-size:0.78rem;">📋 Copiar Código PIX</button>
          </div>
        </div>` : ''}

        <!-- Código de barras -->
        ${guia.codigoBarras ? `
        <div style="padding:10px 14px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);margin-bottom:4px;">
          <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:4px;">Linha Digitável / Código de Barras</div>
          <div style="font-family:monospace;font-size:0.82rem;letter-spacing:.05em;word-break:break-all;color:var(--color-neutral-200);">${guia.codigoBarras}</div>
        </div>` : ''}

        <div style="font-size:0.72rem;color:var(--color-neutral-500);text-align:center;margin-top:12px;">
          Gerado pelo Sistema NFSe Freire · ${new Date().toLocaleString('pt-BR')}
        </div>
      </div>`;

    // Copiar PIX
    document.getElementById('btn-copiar-pix-dam')?.addEventListener('click', () => {
      const el = document.getElementById('pix-payload-dam');
      if (el) { navigator.clipboard?.writeText(el.value).then(() => toast.success('Código PIX copiado!')); }
    });

    // Imprimir
    document.getElementById('btn-imprimir-guia')?.addEventListener('click', () => imprimirGuia(apu, guia, valor, venc, compFmt, cnpjFmt, qrUrl));

    const modal = document.getElementById('modal-guia-dam');
    modal.style.display = 'flex';
  }

  function imprimirGuia(apu, guia, valor, venc, compFmt, cnpjFmt, qrUrl) {
    const munNome  = munConfig?.nome       || 'MUNICÍPIO';
    const munPref  = munConfig?.prefeitura || '';
    const munEmail = munConfig?.email      || '';
    const munFone  = munConfig?.telefone   || '';
    const brasaoTag = munConfig?.brasao
      ? `<img src="${munConfig.brasao}" style="height:60px;object-fit:contain;margin-bottom:6px;">`
      : '';

    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8">
      <title>DAM ISSQN — ${cnpjFmt} — ${compFmt}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }
        h1 { font-size: 20px; font-weight: 800; color: #3730a3; }
        .header { text-align: center; border-bottom: 2px solid #3730a3; padding-bottom: 14px; margin-bottom: 18px; }
        .subtitle { font-size: 11px; color: #6b7280; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .cell { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .cell-label { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #9ca3af; margin-bottom: 3px; }
        .cell-value { font-weight: 700; font-size: 14px; }
        .valor-cell { background: #eef2ff; border-color: #a5b4fc; }
        .valor-cell .cell-value { color: #3730a3; font-size: 18px; }
        .detail-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
        .detail-row:last-child { border: none; }
        .detail-box { padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 14px; }
        .pix-section { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
        .pix-payload { font-family: monospace; font-size: 9px; word-break: break-all; background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; margin-top: 6px; line-height: 1.5; }
        .barcode { font-family: monospace; font-size: 11px; letter-spacing: .04em; word-break: break-all; padding: 8px; background: #f9fafb; border-radius: 4px; border: 1px solid #e5e7eb; }
        .footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: #6b7280; margin-bottom: 4px; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>
      <div class="header">
        ${brasaoTag}
        <div style="font-size:15px;font-weight:800;">${munNome}</div>
        ${munPref ? `<div class="subtitle">${munPref}</div>` : ''}
        ${(munEmail || munFone) ? `<div class="subtitle">${[munEmail, munFone].filter(Boolean).join(' · ')}</div>` : ''}
        <div style="margin-top:8px;">
          <div class="subtitle" style="letter-spacing:.12em;">DOCUMENTO DE ARRECADAÇÃO MUNICIPAL</div>
          <div style="font-size:18px;font-weight:800;color:#3730a3;">DAM — ISSQN</div>
        </div>
      </div>

      <div class="grid2">
        <div class="cell"><div class="cell-label">Contribuinte (CNPJ)</div><div class="cell-value">${cnpjFmt}</div></div>
        <div class="cell"><div class="cell-label">Competência</div><div class="cell-value">${compFmt}</div></div>
        <div class="cell"><div class="cell-label">Vencimento</div><div class="cell-value">${venc}</div></div>
        <div class="cell valor-cell"><div class="cell-label">Valor Total</div><div class="cell-value">${fmtBRL(valor)}</div></div>
      </div>

      <div class="detail-box">
        <div class="detail-row"><span>ISS Próprio (Prestador)</span><strong style="color:#059669;">${fmtBRL(parseFloat(apu.totalIssProprio || 0))}</strong></div>
        <div class="detail-row"><span>ISS Retido na Fonte (Tomador)</span><strong style="color:#dc2626;">${fmtBRL(parseFloat(apu.totalIssTerceiros || 0))}</strong></div>
        <div class="detail-row"><span>Notas Fiscais na Competência</span><strong>${apu.totalNotasEmitidas || 0}</strong></div>
      </div>

      ${qrUrl ? `
      <div class="pix-section">
        <div style="text-align:center;flex-shrink:0;">
          <div class="section-title">QR Code PIX</div>
          <img src="${qrUrl}" width="130" height="130" style="border:6px solid #fff;box-shadow:0 0 0 1px #e5e7eb;">
        </div>
        <div style="flex:1;">
          <div class="section-title">Código PIX Copia e Cola</div>
          <div class="pix-payload">${guia.pixPayload || ''}</div>
        </div>
      </div>` : ''}

      ${guia.codigoBarras ? `
      <div style="margin-bottom:14px;">
        <div class="section-title">Linha Digitável / Código de Barras</div>
        <div class="barcode">${guia.codigoBarras}</div>
      </div>` : ''}

      <div class="footer">
        Sistema NFSe Freire · Gerado em ${new Date().toLocaleString('pt-BR')}
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
    win.document.close();
  }

  // ── Init ───────────────────────────────────────────────────────
  carregarCompetencias();
}
