/**
 * NFS-e Freire — Monitor de Prazo PGDAS-D (R5)
 * Alertas escalonados: dia 17 / 19 / 20 / 21 (multa automática)
 */
import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}
function authH(extra = {}) {
  const t = getMunToken();
  return t ? { 'Authorization': `Bearer ${t}`, ...extra } : { ...extra };
}

const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtCNPJ = c => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c; };

function getAlertInfo(dia) {
  if (dia < 17) return { nivel: 'ok', cor: 'var(--color-success-400)', label: 'Prazo confortável', texto: `${17 - dia} dia(s) até o primeiro aviso (dia 17)` };
  if (dia === 17) return { nivel: 'd17', cor: 'var(--color-warning-400)', label: '⚠️ Aviso — 3 dias', texto: 'Prazo PGDAS-D em 3 dias — revise as receitas' };
  if (dia === 18) return { nivel: 'd17', cor: 'var(--color-warning-400)', label: '⚠️ Aviso — 2 dias', texto: 'Prazo PGDAS-D em 2 dias' };
  if (dia === 19) return { nivel: 'd19', cor: 'rgba(249,115,22,0.9)', label: '🚨 Alerta crítico', texto: 'Último dia útil para envio do PGDAS-D' };
  if (dia === 20) return { nivel: 'd20', cor: 'var(--color-danger-400)', label: '🔴 Emergência', texto: 'Prazo encerra à meia-noite — envie o PGDAS-D agora!' };
  if (dia >= 21) return { nivel: 'd21', cor: 'var(--color-danger-400)', label: '💸 VENCIDO — Multa Automática', texto: `Multa automática aplicada desde o dia 21 (LC 214/2025)` };
  return { nivel: 'ok', cor: 'var(--color-neutral-400)', label: '', texto: '' };
}

export function renderPgdasMonitor(container) {
  const BASE = getBackendUrl();

  const hoje = new Date();
  const dia = hoje.getDate();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const alerta = getAlertInfo(dia);

  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">📅 Monitor PGDAS-D</h1>
        <p class="page-description">Controle de prazo, alertas automáticos e estimativa de multa por contribuinte</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="pgdas-comp-sel" class="form-input" style="width:160px;font-size:0.82rem;">
          ${[-2,-1,0].map(d => {
            const dt = new Date(ano, mes + d, 1);
            const v = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
            return `<option value="${v}" ${d===0?'selected':''}>${nomesMes[dt.getMonth()]}/${dt.getFullYear()}</option>`;
          }).join('')}
        </select>
        <button id="pgdas-refresh" class="btn btn-secondary">🔄 Atualizar</button>
        <button id="pgdas-importar-btn" class="btn btn-primary" style="font-size:0.82rem;">📂 Importar PGDAS-D</button>
      </div>
    </div>

    <!-- Banner de alerta global conforme o dia atual -->
    <div id="pgdas-alerta-banner" style="margin-bottom:20px;padding:14px 20px;border-radius:var(--radius-md);
      background:${alerta.nivel === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.1)'};
      border:1px solid ${alerta.cor};display:flex;align-items:center;gap:14px;">
      <span style="font-size:1.5rem;">${alerta.nivel === 'ok' ? '✅' : alerta.nivel === 'd21' ? '💸' : '⚠️'}</span>
      <div>
        <div style="font-weight:700;color:${alerta.cor};font-size:0.9rem;">${alerta.label}</div>
        <div style="font-size:0.82rem;color:var(--color-neutral-300);">${alerta.texto}</div>
      </div>
      <div style="margin-left:auto;text-align:right;font-size:0.78rem;color:var(--color-neutral-500);">
        Hoje: ${dia.toString().padStart(2,'0')}/${String(mes+1).padStart(2,'0')}/${ano}
      </div>
    </div>

    <!-- Calendário de marcos do mês -->
    <div class="card animate-slide-up" style="padding:20px;margin-bottom:20px;">
      <h3 class="card-title" style="margin-bottom:16px;">📆 Cronograma PGDAS-D — ${nomesMes[mes]}/${ano}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        ${[
          { dia: 17, icon: '📬', titulo: 'Aviso Inicial', desc: 'Notificação: Prazo em 3 dias', nivel: 'd17' },
          { dia: 19, icon: '🚨', titulo: 'Alerta Crítico', desc: 'Último dia útil para envio', nivel: 'd19' },
          { dia: 20, icon: '🔴', titulo: 'Emergência', desc: 'Prazo encerra à meia-noite', nivel: 'd20' },
          { dia: 21, icon: '💸', titulo: 'Vencimento', desc: 'Multa automática (LC 214/2025)', nivel: 'd21' },
        ].map(m => {
          const passado = dia > m.dia;
          const atual   = dia === m.dia;
          const cor = passado ? 'var(--color-neutral-600)' : atual ? alerta.cor : 'var(--color-neutral-500)';
          const bg  = atual ? `${alerta.cor.replace(')',',0.12)').replace('rgba','rgba').replace('var(--color','rgba(0,0,0')}` : 'var(--surface-glass)';
          return `
            <div style="padding:14px;border-radius:var(--radius-md);background:${atual ? 'rgba(239,68,68,0.08)' : 'var(--surface-glass)'};
              border:1px solid ${atual ? alerta.cor : 'var(--surface-glass-border)'};
              ${passado ? 'opacity:0.55;' : ''}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:1.2rem;">${m.icon}</span>
                <span style="font-size:1.4rem;font-weight:800;color:${cor};">Dia ${m.dia}</span>
                ${atual ? '<span style="font-size:0.65rem;background:var(--color-danger-500);color:#fff;padding:2px 6px;border-radius:20px;font-weight:700;">HOJE</span>' : ''}
                ${passado ? '<span style="font-size:0.65rem;color:var(--color-neutral-500);">passado</span>' : ''}
              </div>
              <div style="font-size:0.82rem;font-weight:600;color:${cor};">${m.titulo}</div>
              <div style="font-size:0.75rem;color:var(--color-neutral-400);margin-top:3px;">${m.desc}</div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- KPI Cards -->
    <div id="pgdas-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      ${[1,2,3,4].map(() => `<div class="card" style="padding:16px;"><div style="height:50px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div></div>`).join('')}
    </div>

    <!-- Tabela de Contribuintes -->
    <div class="card animate-slide-up" style="padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <h3 class="card-title" style="margin-bottom:0;">📋 Contribuintes — Competência <span id="pgdas-comp-label">${competencia}</span></h3>
        <div style="display:flex;gap:8px;">
          <input type="text" id="pgdas-busca" class="form-input" placeholder="Filtrar por CNPJ ou razão social..." style="width:250px;font-size:0.82rem;">
          <button id="pgdas-export-csv" class="btn btn-ghost" style="font-size:0.8rem;">📥 CSV</button>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>CNPJ</th>
              <th>Razão Social</th>
              <th>Regime</th>
              <th>RBT12</th>
              <th>Rec. ADN</th>
              <th>Rec. Declarada</th>
              <th>Divergência</th>
              <th>Status PGDAS</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="pgdas-tbody">
            <tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pgdas-paginacao" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;"></div>
    </div>

    <!-- Histórico de Importações PGDAS-D -->
    <div class="card animate-slide-up" style="padding:20px;margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 class="card-title" style="margin-bottom:0;">📂 Histórico de Importações PGDAS-D</h3>
        <button id="pgdas-hist-refresh" class="btn btn-ghost" style="font-size:0.8rem;">🔄</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Cod. TOM</th>
              <th>Total Arq.</th>
              <th>Importados</th>
              <th>Malha</th>
              <th>Impedidos</th>
              <th>Retificações</th>
              <th>Status</th>
              <th>Importado em</th>
            </tr>
          </thead>
          <tbody id="pgdas-hist-tbody">
            <tr><td colspan="9" style="text-align:center;padding:16px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Importar arquivo PGDAS-D -->
    <div id="modal-pgdas-import" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1001;align-items:center;justify-content:center;padding:20px;">
      <div style="width:100%;max-width:560px;background:var(--surface-card);border-radius:var(--radius-xl);border:1px solid var(--surface-glass-border);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--surface-glass-border);">
          <h3 style="margin:0;font-size:1rem;">📂 Importar Arquivo PGDAS-D</h3>
          <button id="modal-import-fechar" style="background:none;border:none;color:var(--color-neutral-400);cursor:pointer;font-size:1.2rem;">✕</button>
        </div>
        <div style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div style="padding:12px 16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:var(--radius-md);font-size:0.82rem;color:var(--color-neutral-300);">
            ℹ️ Aceita arquivos <strong>.zip</strong> (compactado) ou <strong>.txt</strong> (texto) no formato PGDAS-D 2018 v1.0.2.0.<br>
            O sistema filtra automaticamente os contribuintes do seu município pelo Código TOM configurado.
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Código TOM do Município <span style="color:var(--color-danger-400);">*</span></label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="text" id="import-cod-tom" class="form-input form-input-mono" placeholder="0000" maxlength="4" style="max-width:110px;" readonly>
              <span id="import-tom-info" style="font-size:0.8rem;color:var(--color-neutral-400);"></span>
            </div>
            <span class="form-help">Preenchido automaticamente pelo município configurado no sistema.</span>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Arquivo PGDAS-D <span style="color:var(--color-danger-400);">*</span></label>
            <input type="file" id="import-arquivo" class="form-input" accept=".zip,.txt" style="cursor:pointer;">
            <span class="form-help">Arquivo diário fornecido pelo SERPRO/Simples Nacional (máx. 50 MB em texto)</span>
          </div>
          <div id="import-resultado" style="display:none;padding:12px 16px;border-radius:var(--radius-md);font-size:0.85rem;"></div>
        </div>
        <div style="display:flex;gap:10px;padding:16px 24px;justify-content:flex-end;border-top:1px solid var(--surface-glass-border);">
          <button id="modal-import-executar" class="btn btn-primary">📤 Processar Arquivo</button>
          <button id="modal-import-fechar2" class="btn btn-ghost">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal: detalhe da declaração -->
    <div id="modal-pgdas-detalhe" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1000;align-items:center;justify-content:center;padding:20px;">
      <div style="width:100%;max-width:680px;background:var(--surface-card);border-radius:var(--radius-xl);border:1px solid var(--surface-glass-border);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--surface-glass-border);">
          <h3 style="margin:0;font-size:1rem;">📄 Declaração PGDAS-D</h3>
          <button id="modal-pgdas-fechar" style="background:none;border:none;color:var(--color-neutral-400);cursor:pointer;font-size:1.2rem;">✕</button>
        </div>
        <div id="modal-pgdas-corpo" style="padding:24px;max-height:70vh;overflow-y:auto;"></div>
        <div style="display:flex;gap:10px;padding:16px 24px;justify-content:flex-end;border-top:1px solid var(--surface-glass-border);">
          <button id="modal-pgdas-salvar" class="btn btn-primary">💾 Salvar Declaração</button>
          <button id="modal-pgdas-fechar2" class="btn btn-ghost">Fechar</button>
        </div>
      </div>
    </div>
  `;

  let _dadosTabela = [];
  let _cnpjModal = null;
  let _compAtual = competencia;

  async function carregar(comp) {
    _compAtual = comp;
    document.getElementById('pgdas-comp-label').textContent = comp;
    document.getElementById('pgdas-tbody').innerHTML =
      `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>`;

    try {
      const [rMon, rDecl] = await Promise.all([
        fetch(`${BASE}/pgdas/monitor?competencia=${comp}`, { headers: authH() }),
        fetch(`${BASE}/pgdas/declaracoes?competencia=${comp}`, { headers: authH() }),
      ]);

      const mon  = rMon.ok  ? await rMon.json()  : { kpis: {}, contribuintes: [] };
      const decl = rDecl.ok ? await rDecl.json() : { declaracoes: [] };

      renderKpis(mon.kpis || {});
      _dadosTabela = decl.declaracoes || [];
      renderTabela(_dadosTabela);
    } catch (e) {
      document.getElementById('pgdas-tbody').innerHTML =
        `<tr><td colspan="9" style="text-align:center;color:var(--color-danger-400);padding:24px;">❌ Erro ao carregar: ${e.message}</td></tr>`;
    }
  }

  function renderKpis(k) {
    const grid = document.getElementById('pgdas-kpi-grid');
    if (!grid) return;
    const cards = [
      { icon: '🏢', label: 'Contribuintes ativos', value: (k.total_contribuintes || 0).toLocaleString('pt-BR'), cor: 'var(--color-primary-400)' },
      { icon: '⚠️', label: 'PGDAS pendente', value: (k.total_pendentes || 0).toLocaleString('pt-BR'), cor: 'var(--color-warning-400)' },
      { icon: '❌', label: 'Divergências', value: (k.total_divergentes || 0).toLocaleString('pt-BR'), cor: 'var(--color-danger-400)' },
      { icon: '💰', label: 'Receita total ADN', value: fmtBRL(k.rb_adn_total || 0), cor: 'var(--color-success-400)' },
    ];
    grid.innerHTML = cards.map(c => `
      <div class="card" style="padding:16px;border-left:3px solid ${c.cor};">
        <div style="font-size:1.3rem;margin-bottom:4px;">${c.icon}</div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-neutral-500);">${c.label}</div>
        <div style="font-size:1.2rem;font-weight:800;color:${c.cor};">${c.value}</div>
      </div>
    `).join('');
  }

  function statusBadge(s) {
    const map = {
      ok:        ['✅ OK',        'rgba(34,197,94,0.15)',  'rgba(34,197,94,0.8)'],
      divergente:['⚠️ Divergente','rgba(245,158,11,0.15)','rgba(245,158,11,0.9)'],
      pendente:  ['📋 Pendente',  'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.8)'],
      enviado:   ['📤 Enviado',   'rgba(34,197,94,0.1)',   'rgba(34,197,94,0.6)'],
      vencido:   ['💸 Vencido',   'rgba(239,68,68,0.15)',  'rgba(239,68,68,0.9)'],
    };
    const [label, bg, cor] = map[s] || ['—', 'transparent', 'var(--color-neutral-400)'];
    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;background:${bg};color:${cor};">${label}</span>`;
  }

  function regimeBadge(r) {
    const map = {
      '1': ['DAS/Simples', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.9)'],
      '2': ['Guia Municipal', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.9)'],
      '3': ['MEI/SIMEI', 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.8)'],
    };
    const [label, bg, cor] = map[String(r)] || ['Normal', 'var(--surface-glass)', 'var(--color-neutral-400)'];
    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;background:${bg};color:${cor};">${label}</span>`;
  }

  function renderTabela(dados) {
    const tbody = document.getElementById('pgdas-tbody');
    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-neutral-500);">Nenhum contribuinte encontrado para esta competência.</td></tr>`;
      return;
    }
    tbody.innerHTML = dados.map(d => {
      const div = d.divergencia || (d.rb_adn - d.rb_declarada);
      const divCor = Math.abs(div) < 1 ? 'var(--color-success-400)' : div > 0 ? 'var(--color-danger-400)' : 'var(--color-warning-400)';
      return `
        <tr>
          <td style="font-family:monospace;font-size:0.8rem;">${fmtCNPJ(d.cnpj)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.nome || '—'}</td>
          <td>${regimeBadge(d.reg_apur_trib_sn)}</td>
          <td style="text-align:right;">${fmtBRL(d.rbt12 || 0)}</td>
          <td style="text-align:right;">${fmtBRL(d.rb_adn || 0)}</td>
          <td style="text-align:right;">${fmtBRL(d.rb_declarada || 0)}</td>
          <td style="text-align:right;color:${divCor};font-weight:600;">${div !== 0 ? fmtBRL(div) : '—'}</td>
          <td>${statusBadge(d.status || 'pendente')}</td>
          <td>
            <button class="btn btn-ghost btn-sm btn-pgdas-editar" data-cnpj="${d.cnpj}" title="Registrar declaração PGDAS-D">✏️ Declarar</button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-pgdas-editar').forEach(btn => {
      btn.addEventListener('click', () => abrirModal(btn.dataset.cnpj));
    });
  }

  function abrirModal(cnpj) {
    _cnpjModal = cnpj;
    const dados = _dadosTabela.find(d => d.cnpj === cnpj) || {};
    const modal = document.getElementById('modal-pgdas-detalhe');
    document.getElementById('modal-pgdas-corpo').innerHTML = `
      <div style="display:grid;gap:16px;">
        <div style="padding:12px;background:var(--surface-glass);border-radius:var(--radius-md);">
          <div style="font-size:0.72rem;color:var(--color-neutral-500);margin-bottom:4px;">CNPJ</div>
          <div style="font-weight:700;">${fmtCNPJ(cnpj)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Competência</label>
            <input type="text" id="mdecl-comp" class="form-input" value="${_compAtual}" readonly style="background:var(--surface-glass);">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Receita do ADN (NFS-e)</label>
            <input type="text" class="form-input" value="${fmtBRL(dados.rb_adn || 0)}" readonly style="background:var(--surface-glass);">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Receita Bruta Declarada no PGDAS-D (R$)</label>
          <input type="number" id="mdecl-rb" class="form-input" placeholder="0.00" step="0.01" min="0"
            value="${dados.rb_declarada || ''}">
          <span class="form-help">Informe o valor declarado no portal Simples Nacional (simples.receita.fazenda.gov.br)</span>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Data de Envio ao PGDAS-D</label>
          <input type="date" id="mdecl-data" class="form-input" value="${dados.data_envio ? dados.data_envio.substring(0,10) : ''}">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Observação / Justificativa de Divergência</label>
          <textarea id="mdecl-obs" class="form-input" rows="2" placeholder="Ex: Deduções legais aplicadas, nota cancelada após envio...">${dados.observacao || ''}</textarea>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  async function salvarDeclaracao() {
    const rb = parseFloat(document.getElementById('mdecl-rb')?.value || '0');
    const dataEnvio = document.getElementById('mdecl-data')?.value;
    const obs = document.getElementById('mdecl-obs')?.value;

    if (isNaN(rb) || rb < 0) { toast.error('Informe um valor válido para a receita declarada.'); return; }

    try {
      const r = await fetch(`${BASE}/pgdas/declaracoes`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ cnpj: _cnpjModal, competencia: _compAtual, rb_declarada: rb, data_envio: dataEnvio || null, observacao: obs }),
      });
      const d = await r.json();
      if (d.sucesso) {
        toast.success('Declaração PGDAS-D registrada com sucesso.');
        document.getElementById('modal-pgdas-detalhe').style.display = 'none';
        carregar(_compAtual);
      } else {
        toast.error(d.erro || 'Erro ao salvar declaração.');
      }
    } catch (e) {
      toast.error('Erro de conexão: ' + e.message);
    }
  }

  function exportarCSV() {
    if (!_dadosTabela.length) { toast.info('Sem dados para exportar.'); return; }
    const header = ['CNPJ','Nome','Regime','RBT12','Rec_ADN','Rec_Declarada','Divergencia','Status'];
    const linhas = _dadosTabela.map(d => [
      fmtCNPJ(d.cnpj), d.nome || '', d.reg_apur_trib_sn || '',
      d.rbt12 || 0, d.rb_adn || 0, d.rb_declarada || 0,
      (d.rb_adn - d.rb_declarada).toFixed(2), d.status || 'pendente'
    ].map(v => `"${v}"`).join(';'));
    const blob = new Blob(['\uFEFF' + [header.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `pgdas-monitor-${_compAtual}.csv`; a.click();
  }

  // ── Importação PGDAS-D ────────────────────────────────────────────────────

  async function carregarHistoricoImportacoes() {
    const tbody = document.getElementById('pgdas-hist-tbody');
    try {
      const r = await fetch(`${BASE}/pgdas/importacoes`, { headers: authH() });
      if (!r.ok) throw new Error('Erro ' + r.status);
      const d = await r.json();
      const lista = d.importacoes || [];
      if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:16px;color:var(--color-neutral-500);">Nenhuma importação registrada.</td></tr>`;
        return;
      }
      tbody.innerHTML = lista.map(i => {
        const statusCor = i.status === 'ok' ? 'rgba(34,197,94,0.8)' : i.status === 'erro' ? 'rgba(239,68,68,0.8)' : 'rgba(245,158,11,0.8)';
        const dt = new Date(i.importado_em).toLocaleString('pt-BR');
        return `<tr>
          <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${i.nome_arquivo}">${i.nome_arquivo}</td>
          <td style="text-align:center;font-family:monospace;">${i.cod_tom || '—'}</td>
          <td style="text-align:right;">${(i.total_registros||0).toLocaleString('pt-BR')}</td>
          <td style="text-align:right;font-weight:700;color:rgba(99,102,241,0.9);">${(i.importados||0).toLocaleString('pt-BR')}</td>
          <td style="text-align:center;color:${i.retidos_malha > 0 ? 'rgba(239,68,68,0.8)' : 'var(--color-neutral-500)'};">${i.retidos_malha||0}</td>
          <td style="text-align:center;color:${i.impedidos_iss > 0 ? 'rgba(245,158,11,0.8)' : 'var(--color-neutral-500)'};">${i.impedidos_iss||0}</td>
          <td style="text-align:center;">${i.retificacoes||0}</td>
          <td><span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:600;background:${statusCor.replace('0.8','0.12')};color:${statusCor};">${i.status||'ok'}</span></td>
          <td style="font-size:0.75rem;color:var(--color-neutral-400);">${dt}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--color-danger-400);padding:16px;">❌ ${err.message}</td></tr>`;
    }
  }

  async function executarImportacao() {
    const codTOM  = document.getElementById('import-cod-tom')?.value?.trim();
    const arquivo = document.getElementById('import-arquivo')?.files?.[0];
    const res     = document.getElementById('import-resultado');

    if (!codTOM || codTOM.length !== 4) {
      res.style.display = 'block';
      res.style.background = 'rgba(239,68,68,0.1)';
      res.style.color = 'rgba(239,68,68,0.9)';
      res.textContent = '⚠️ Informe o Código TOM de 4 dígitos do município.';
      return;
    }
    if (!arquivo) {
      res.style.display = 'block';
      res.style.background = 'rgba(239,68,68,0.1)';
      res.style.color = 'rgba(239,68,68,0.9)';
      res.textContent = '⚠️ Selecione um arquivo PGDAS-D (.zip ou .txt).';
      return;
    }

    const btn = document.getElementById('modal-import-executar');
    btn.disabled = true;
    btn.textContent = '⏳ Processando...';
    res.style.display = 'block';
    res.style.background = 'rgba(99,102,241,0.08)';
    res.style.color = 'var(--color-neutral-300)';
    res.textContent = '⏳ Lendo arquivo e enviando ao servidor...';

    try {
      const arrayBuf = await arquivo.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

      const r = await fetch(`${BASE}/pgdas/importar`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ nome_arquivo: arquivo.name, content: base64, codTOM }),
      });
      const d = await r.json();

      if (d.sucesso) {
        res.style.background = 'rgba(34,197,94,0.1)';
        res.style.color = 'rgba(34,197,94,0.9)';
        res.innerHTML = `✅ <strong>Importação concluída!</strong><br>
          Importados: <strong>${d.importados}</strong> contribuintes<br>
          Total no arquivo: ${d.total_arquivo} · Malha: ${d.retidos_malha} · Impedidos ISS: ${d.impedidos_iss} · Retificações: ${d.retificacoes}<br>
          ${d.avisos?.length ? `⚠️ Avisos: ${d.avisos.join(', ')}` : ''}`;
        carregarHistoricoImportacoes();
        carregar(_compAtual);
      } else {
        res.style.background = 'rgba(239,68,68,0.1)';
        res.style.color = 'rgba(239,68,68,0.9)';
        res.textContent = `❌ ${d.erro || 'Erro na importação.'}`;
      }
    } catch (err) {
      res.style.background = 'rgba(239,68,68,0.1)';
      res.style.color = 'rgba(239,68,68,0.9)';
      res.textContent = `❌ Erro: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = '📤 Processar Arquivo';
    }
  }

  // Eventos
  document.getElementById('pgdas-refresh')?.addEventListener('click', () => carregar(_compAtual));
  document.getElementById('pgdas-comp-sel')?.addEventListener('change', e => carregar(e.target.value));
  document.getElementById('pgdas-export-csv')?.addEventListener('click', exportarCSV);
  document.getElementById('pgdas-hist-refresh')?.addEventListener('click', carregarHistoricoImportacoes);
  document.getElementById('modal-pgdas-fechar')?.addEventListener('click', () => { document.getElementById('modal-pgdas-detalhe').style.display = 'none'; });
  document.getElementById('modal-pgdas-fechar2')?.addEventListener('click', () => { document.getElementById('modal-pgdas-detalhe').style.display = 'none'; });
  document.getElementById('modal-pgdas-salvar')?.addEventListener('click', salvarDeclaracao);
  document.getElementById('pgdas-importar-btn')?.addEventListener('click', async () => {
    document.getElementById('import-resultado').style.display = 'none';
    document.getElementById('modal-pgdas-import').style.display = 'flex';

    // Sempre auto-preenche o Código TOM a partir das configurações do município e bloqueia o campo
    const codTomEl = document.getElementById('import-cod-tom');
    const infoEl   = document.getElementById('import-tom-info');
    if (!codTomEl) return;

    // Garante campo bloqueado
    codTomEl.readOnly = true;
    codTomEl.style.background    = 'var(--surface-glass, rgba(255,255,255,0.05))';
    codTomEl.style.cursor        = 'default';
    codTomEl.style.pointerEvents = 'none';

    try {
      const r = await fetch(`${BASE}/municipio/config`, { headers: authH() });
      if (!r.ok) throw new Error('config indisponível');
      const cfg = await r.json();
      const tom = cfg.codTom || cfg.cod_tom || '';

      if (tom) {
        codTomEl.value = String(tom).padStart(4, '0');

        // Busca o nome do município pela tabela interna (cod_tom)
        try {
          const rt = await fetch(`${BASE}/municipios-tom?cod_tom=${codTomEl.value}`, { headers: authH() });
          const dt = rt.ok ? await rt.json() : {};
          const m  = (dt.municipios || [])[0];
          const nomeMun = m?.ente || m?.nome_empresarial || cfg.nome || '';
          const ufMun   = m?.uf   || cfg.uf || '';
          if (infoEl) {
            infoEl.textContent = nomeMun ? `— ${nomeMun}${ufMun ? ` (${ufMun})` : ''}` : `— TOM ${codTomEl.value}`;
            infoEl.style.color = 'rgba(34,197,94,0.9)';
          }
        } catch {
          // Fallback: usa nome direto do config
          if (infoEl) {
            infoEl.textContent = cfg.nome ? `— ${cfg.nome} (${cfg.uf || ''})` : `— TOM ${tom}`;
            infoEl.style.color = 'rgba(34,197,94,0.9)';
          }
        }
      } else {
        // TOM não configurado
        if (infoEl) {
          infoEl.textContent = '⚠ Configure o Código TOM em Configurações';
          infoEl.style.color = 'rgba(251,191,36,0.9)';
        }
      }
    } catch {
      if (infoEl) { infoEl.textContent = '— erro ao carregar configuração'; infoEl.style.color = 'rgba(239,68,68,0.7)'; }
    }
  });

  document.getElementById('modal-import-fechar')?.addEventListener('click',  () => { document.getElementById('modal-pgdas-import').style.display = 'none'; });
  document.getElementById('modal-import-fechar2')?.addEventListener('click', () => { document.getElementById('modal-pgdas-import').style.display = 'none'; });
  document.getElementById('modal-import-executar')?.addEventListener('click', executarImportacao);

  document.getElementById('pgdas-busca')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderTabela(_dadosTabela.filter(d =>
      (d.cnpj || '').includes(q.replace(/\D/g,'')) ||
      (d.nome || '').toLowerCase().includes(q)
    ));
  });

  carregar(competencia);
  carregarHistoricoImportacoes();
}
