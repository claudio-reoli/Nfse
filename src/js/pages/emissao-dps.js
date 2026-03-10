/**
 * NFS-e Antigravity — Emissão de DPS
 * Formulário dinâmico com campos conformes ao XSD v1.01
 * Ref: requisitos-nfse-rtc-v2.md seção 3
 */
import { ENUMS, maskCNPJ, maskCPF, maskCEP, maskPhone, maskCurrency, validateCNPJ, validateCPF, calculateIBSCBS } from '../fiscal-utils.js';
import { toast } from '../toast.js';
import { buildDPSXml, collectDPSFormData, validateDPSForm, prettyPrintXml, downloadXml } from '../xml-builder.js';
import { getCertStore, signXml } from '../digital-signature.js';
import { safeFetch, enviarDPS } from '../api-service.js';

export function renderEmissaoDPS(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Emissão de DPS</h1>
        <p class="page-description">Declaração de Prestação de Serviços — Conforme Leiaute ADN v1.01</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="btn-preview-xml">📄 Preview XML</button>
        <button class="btn btn-secondary" id="btn-download-xml">⬇ Download XML</button>
        <button class="btn btn-secondary" id="btn-limpar-dps">Limpar</button>
        <button class="btn btn-success" id="btn-enviar-dps">
          🔒 Assinar e Enviar DPS
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs mb-6" id="dps-tabs" style="flex-wrap: wrap;">
      <button class="tab active" data-tab="tab-identificacao">Identificação</button>
      <button class="tab" data-tab="tab-prestador">Prestador</button>
      <button class="tab" data-tab="tab-tomador">Tomador</button>
      <button class="tab" data-tab="tab-intermediario">Intermediário</button>
      <button class="tab" data-tab="tab-servico">Serviço</button>
      <button class="tab" data-tab="tab-valores">Valores</button>
      <button class="tab" data-tab="tab-ibscbs">IBS/CBS</button>
      <button class="tab" data-tab="tab-complementos">Complementos</button>
      <button class="tab" data-tab="tab-resumo">Resumo</button>
    </div>

    <!-- TAB: Identificação -->
    <div class="card animate-slide-up tab-content" id="tab-identificacao">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">📋</span>Identificação da DPS
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Ambiente <span class="required">*</span></label>
            <select class="form-select" id="dps-tpAmb">
              <option value="2" selected>2 — Homologação</option>
              <option value="1">1 — Produção</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Série DPS <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="dps-serie" type="text" maxlength="5" placeholder="00001" value="00001">
          </div>
          <div class="form-group">
            <label class="form-label">Número DPS <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="dps-nDPS" type="text" maxlength="15" placeholder="000000000000001">
          </div>
          <div class="form-group">
            <label class="form-label">Data de Competência <span class="required">*</span></label>
            <input class="form-input" id="dps-dCompet" type="date">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Emitente da DPS <span class="required">*</span></label>
            <select class="form-select" id="dps-tpEmit">
              ${Object.entries(ENUMS.tipoEmiteDPS).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Município Emissor (IBGE) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="dps-cLocEmi" type="text" maxlength="7" placeholder="3550308">
            <span class="form-help">Código IBGE com 7 dígitos</span>
          </div>
          <div class="form-group">
            <label class="form-label">Data/Hora Emissão <span class="required">*</span></label>
            <input class="form-input" id="dps-dhEmi" type="datetime-local">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Processo de Emissão</label>
            <select class="form-select" id="dps-procEmi">
              <option value="1">1 — Aplicativo do contribuinte (Web Service)</option>
              <option value="2" selected>2 — Aplicativo do fisco (Web)</option>
              <option value="3">3 — Aplicativo do fisco (App)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Versão do Aplicativo</label>
            <input class="form-input" id="dps-verAplic" type="text" maxlength="20" value="Antigravity-1.0">
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Prestador -->
    <div class="card animate-slide-up tab-content hidden" id="tab-prestador">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">🏢</span>Prestador de Serviços
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo de Inscrição <span class="required">*</span></label>
            <select class="form-select" id="prest-tipoInscr">
              <option value="1">CNPJ</option>
              <option value="2">CPF</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">CNPJ/CPF <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="prest-doc" type="text" placeholder="00.000.000/0000-00">
          </div>
          <div class="form-group">
            <label class="form-label">Inscrição Municipal</label>
            <input class="form-input form-input-mono" id="prest-IM" type="text" maxlength="15">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Razão Social <span class="required">*</span></label>
            <input class="form-input" id="prest-xNome" type="text" maxlength="300">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Nome Fantasia</label>
            <input class="form-input" id="prest-xFant" type="text" maxlength="150">
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📍</span>Endereço
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CEP <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="prest-CEP" type="text" maxlength="9" placeholder="00000-000">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Logradouro <span class="required">*</span></label>
            <input class="form-input" id="prest-xLgr" type="text" maxlength="255">
          </div>
          <div class="form-group">
            <label class="form-label">Número <span class="required">*</span></label>
            <input class="form-input" id="prest-nro" type="text" maxlength="60">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Complemento</label>
            <input class="form-input" id="prest-xCpl" type="text" maxlength="156">
          </div>
          <div class="form-group">
            <label class="form-label">Bairro <span class="required">*</span></label>
            <input class="form-input" id="prest-xBairro" type="text" maxlength="60">
          </div>
          <div class="form-group">
            <label class="form-label">Município (IBGE) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="prest-cMun" type="text" maxlength="7">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-input" id="prest-fone" type="text" placeholder="(11) 99999-9999">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" id="prest-email" type="email" maxlength="80">
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Tomador -->
    <div class="card animate-slide-up tab-content hidden" id="tab-tomador">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">👤</span>Tomador de Serviços
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo de Identificação <span class="required">*</span></label>
            <select class="form-select" id="toma-tipoDoc">
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
              <option value="NIF">NIF (Exterior)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Documento <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="toma-doc" type="text">
          </div>
          <div class="form-group">
            <label class="form-label">Inscrição Municipal</label>
            <input class="form-input form-input-mono" id="toma-IM" type="text" maxlength="15">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Razão Social / Nome <span class="required">*</span></label>
            <input class="form-input" id="toma-xNome" type="text" maxlength="150">
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📍</span>Endereço do Tomador
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CEP <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="toma-CEP" type="text" maxlength="9" placeholder="00000-000">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Logradouro <span class="required">*</span></label>
            <input class="form-input" id="toma-xLgr" type="text" maxlength="255">
          </div>
          <div class="form-group">
            <label class="form-label">Número <span class="required">*</span></label>
            <input class="form-input" id="toma-nro" type="text" maxlength="60">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bairro <span class="required">*</span></label>
            <input class="form-input" id="toma-xBairro" type="text" maxlength="60">
          </div>
          <div class="form-group">
            <label class="form-label">Município (IBGE) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="toma-cMun" type="text" maxlength="7">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" id="toma-email" type="email" maxlength="80">
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Intermediário -->
    <div class="card animate-slide-up tab-content hidden" id="tab-intermediario">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">🤝</span>Intermediário (Opcional)
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3) var(--space-4); background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: var(--radius-lg); margin-bottom: var(--space-6); font-size: var(--text-sm); color: var(--color-primary-400);">
          ℹ️ Preencha apenas quando houver um intermediário na operação. O intermediário é um ator da NFS-e com direitos de consulta e manifestação.
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo de Documento</label>
            <select class="form-select" id="inter-tipoDoc">
              <option value="">Não informar</option>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">CNPJ/CPF</label>
            <input class="form-input form-input-mono" id="inter-doc" type="text">
          </div>
          <div class="form-group">
            <label class="form-label">Inscrição Municipal</label>
            <input class="form-input form-input-mono" id="inter-IM" type="text" maxlength="15">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Razão Social / Nome</label>
            <input class="form-input" id="inter-xNome" type="text" maxlength="150">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" id="inter-email" type="email" maxlength="80">
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Serviço -->
    <div class="card animate-slide-up tab-content hidden" id="tab-servico">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">⚙️</span>Dados do Serviço
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Código Trib. Nacional (cTribNac) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="serv-cTribNac" type="text" maxlength="10" placeholder="Ex: 1.05, 17.01, 99.04.01">
            <span class="form-help">Item da lista de serviços ou código 99.x para novos fatos geradores</span>
          </div>
          <div class="form-group">
            <label class="form-label">Código Trib. Municipal (cTribMun)</label>
            <input class="form-input form-input-mono" id="serv-cTribMun" type="text" maxlength="3">
          </div>
          <div class="form-group">
            <label class="form-label">Código NBS</label>
            <input class="form-input form-input-mono" id="serv-cNBS" type="text" maxlength="9" placeholder="Ex: 1.1002.10.00">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Descrição do Serviço <span class="required">*</span></label>
            <textarea class="form-textarea" id="serv-xDescServ" maxlength="2000" rows="4" placeholder="Descreva detalhadamente o serviço prestado..."></textarea>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Local da Prestação (Mun. IBGE) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="serv-cLocPrest" type="text" maxlength="7">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Local da Prestação</label>
            <select class="form-select" id="serv-cTipoPrest">
              <option value="1">1 — No município do prestador</option>
              <option value="2">2 — No município do tomador</option>
              <option value="3">3 — Outro município</option>
            </select>
          </div>
        </div>

        <!-- Novo Fato Gerador — Bens Móveis Panel -->
        <div id="panel-bens-moveis" class="hidden" style="margin-top: var(--space-6);">
          <div class="section-title">
            <span class="icon">📦</span>Locação de Bens Móveis (cTribNac 99.04.01)
          </div>
          <div class="form-row mb-4">
            <div class="form-group">
              <label class="form-label">NCM do Bem Móvel <span class="required">*</span></label>
              <input class="form-input form-input-mono" id="bm-NCM" type="text" maxlength="8">
            </div>
            <div class="form-group">
              <label class="form-label">Descrição do Bem <span class="required">*</span></label>
              <input class="form-input" id="bm-xNCM" type="text" maxlength="150">
            </div>
            <div class="form-group">
              <label class="form-label">Quantidade <span class="required">*</span></label>
              <input class="form-input" id="bm-qtd" type="number" min="1" max="999" value="1">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Valores -->
    <div class="card animate-slide-up tab-content hidden" id="tab-valores">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">💰</span>Valores e Tributos
          </span>
        </h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Valor do Serviço (R$) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="val-vServ" type="text" placeholder="0,00" style="font-size: var(--text-lg); font-weight: 700;">
          </div>
          <div class="form-group">
            <label class="form-label">Desc. Incondicionado (R$)</label>
            <input class="form-input form-input-mono" id="val-descIncond" type="text" placeholder="0,00">
          </div>
          <div class="form-group">
            <label class="form-label">Desc. Condicionado (R$)</label>
            <input class="form-input form-input-mono" id="val-descCond" type="text" placeholder="0,00">
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">🏛️</span>Tributos Federais
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CST PIS/COFINS</label>
            <select class="form-select" id="val-CSTPC">
              ${Object.entries(ENUMS.cstPisCofins).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo Retenção PIS/COFINS/CSLL</label>
            <select class="form-select" id="val-tpRetPC">
              ${Object.entries(ENUMS.tpRetPisCofins).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Valor PIS (R$)</label>
            <input class="form-input form-input-mono" id="val-vPIS" type="text" placeholder="0,00">
            <span class="form-help">Apenas débito de apuração própria (não retenção)</span>
          </div>
          <div class="form-group">
            <label class="form-label">Valor COFINS (R$)</label>
            <input class="form-input form-input-mono" id="val-vCofins" type="text" placeholder="0,00">
            <span class="form-help">Apenas débito de apuração própria (não retenção)</span>
          </div>
          <div class="form-group">
            <label class="form-label">Valor Ret. CSLL (R$)</label>
            <input class="form-input form-input-mono" id="val-vRetCSLL" type="text" placeholder="0,00">
            <span class="form-help">Soma PIS + COFINS + CSLL retidos conforme tpRetPisCofins</span>
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📊</span>Retenções
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">ISSQN Retido?</label>
            <select class="form-select" id="val-tpRetISSQN">
              <option value="1">1 — Sim: Retido pelo tomador</option>
              <option value="2" selected>2 — Não</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Retenção CP (R$)</label>
            <input class="form-input form-input-mono" id="val-vRetCP" type="text" placeholder="0,00">
          </div>
          <div class="form-group">
            <label class="form-label">Retenção IRRF (R$)</label>
            <input class="form-input form-input-mono" id="val-vRetIRRF" type="text" placeholder="0,00">
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: IBS/CBS -->
    <div class="card animate-slide-up tab-content hidden" id="tab-ibscbs">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">⚡</span>IBS/CBS — Reforma Tributária
          </span>
        </h3>
        <span class="badge badge-warning">Opcional em 2026</span>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3) var(--space-4); background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-lg); margin-bottom: var(--space-6); font-size: var(--text-sm); color: var(--color-warning-400);">
          ⚠️ O grupo IBSCBS é <strong>opcional</strong> em 2026 (ocorrência 0-1). Quando obrigatório, passará a 1-1. Confira NT 005 v1.1 e NT 007 v1.0.
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Finalidade da NFS-e (finNFSe) <span class="required">*</span></label>
            <select class="form-select" id="ibs-finNFSe">
              ${Object.entries(ENUMS.finNFSe).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Consumo Pessoal (indFinal) <span class="required">*</span></label>
            <select class="form-select" id="ibs-indFinal">
              ${Object.entries(ENUMS.indFinal).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cód. Indicador de Operação (cIndOp) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="ibs-cIndOp" type="text" maxlength="6" placeholder="Ref. AnexoVII">
            <span class="form-help">Conforme art. 11 LC 214/2025</span>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Destinatário (indDest) <span class="required">*</span></label>
            <select class="form-select" id="ibs-indDest">
              ${Object.entries(ENUMS.indDest).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">🆕 ZFM/ALC (indZFMALC)</label>
            <select class="form-select" id="ibs-indZFMALC">
              <option value="">(não informar)</option>
              ${Object.entries(ENUMS.indZFMALC).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
            <span class="form-help">NT 007 — Art. 451/466 LC 214/2025</span>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo Operação Governo (tpOper)</label>
            <select class="form-select" id="ibs-tpOper">
              <option value="">(não se aplica)</option>
              ${Object.entries(ENUMS.tpOper).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo Ente Governamental (tpEnteGov)</label>
            <select class="form-select" id="ibs-tpEnteGov">
              <option value="">(não se aplica)</option>
              ${Object.entries(ENUMS.tpEnteGov).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Doação (indDoacao)</label>
            <select class="form-select" id="ibs-indDoacao">
              <option value="">(não informar)</option>
              ${Object.entries(ENUMS.indDoacao).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Redutor % (pRedutor)</label>
            <input class="form-input form-input-mono" id="ibs-pRedutor" type="text" placeholder="0,0000">
            <span class="form-help">Compra governamental</span>
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📊</span>Tributação IBS/CBS
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CST IBS/CBS <span class="required">*</span></label>
            <select class="form-select form-input-mono" id="ibs-CST">
              ${Object.entries(ENUMS.cstIBSCBS).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Classificação Tributária (cClassTrib) <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="ibs-cClassTrib" type="text" maxlength="6" placeholder="000000">
          </div>
          <div class="form-group">
            <label class="form-label">Crédito Presumido (cCredPres)</label>
            <input class="form-input form-input-mono" id="ibs-cCredPres" type="text" maxlength="2">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CSTReg (Trib. Regular)</label>
            <input class="form-input form-input-mono" id="ibs-CSTReg" type="text" maxlength="3" placeholder="000">
            <span class="form-help">gTribRegular — Apenas se diferir da trib. principal</span>
          </div>
          <div class="form-group">
            <label class="form-label">cClassTribReg</label>
            <input class="form-input form-input-mono" id="ibs-cClassTribReg" type="text" maxlength="6" placeholder="000000">
          </div>
          <div class="form-group">
            <label class="form-label">% Red. Alíq. UF (pRedAliqUF)</label>
            <input class="form-input form-input-mono" id="ibs-pRedAliqUF" type="text" placeholder="0,0000">
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">% Red. Alíq. Mun. (pRedAliqMun)</label>
            <input class="form-input form-input-mono" id="ibs-pRedAliqMun" type="text" placeholder="0,0000">
          </div>
          <div class="form-group">
            <label class="form-label">% Red. Alíq. CBS (pRedAliqCBS)</label>
            <input class="form-input form-input-mono" id="ibs-pRedAliqCBS" type="text" placeholder="0,0000">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: var(--text-xs);">ℹ️ NFS-e Referenciadas, Destinatário, Imóvel, Deduções</label>
            <span class="form-help">Use a aba <strong>Complementos</strong> para esses subgrupos</span>
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-4);">
          <span class="icon">📐</span>Diferimento (gDif)
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">% Dif. IBS UF (pDifUF)</label>
            <input class="form-input form-input-mono" id="ibs-pDifUF" type="text" placeholder="0,0000">
          </div>
          <div class="form-group">
            <label class="form-label">% Dif. IBS Mun (pDifMun)</label>
            <input class="form-input form-input-mono" id="ibs-pDifMun" type="text" placeholder="0,0000">
          </div>
          <div class="form-group">
            <label class="form-label">% Dif. CBS (pDifCBS)</label>
            <input class="form-input form-input-mono" id="ibs-pDifCBS" type="text" placeholder="0,0000">
          </div>
        </div>

        <div class="section-title" style="margin-top: var(--space-4);">
          <span class="icon">↩️</span>Estornos de Crédito (gEstornoCred)
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Valor Estorno IBS (vIBSEstCred)</label>
            <input class="form-input form-input-mono" id="ibs-vIBSEstCred" type="text" placeholder="0,00">
          </div>
          <div class="form-group">
            <label class="form-label">Valor Estorno CBS (vCBSEstCred)</label>
            <input class="form-input form-input-mono" id="ibs-vCBSEstCred" type="text" placeholder="0,00">
          </div>
        </div>

        <!-- Cálculo automático preview -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">🧮</span>Preview de Cálculo IBS/CBS
        </div>
        <div id="ibscbs-preview" class="grid grid-3 gap-4">
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; margin-bottom: var(--space-2);">Base de Cálculo</div>
            <div id="calc-vBC" style="font-size: var(--text-xl); font-weight: 700; color: var(--color-neutral-100); font-family: var(--font-mono);">R$ 0,00</div>
          </div>
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; margin-bottom: var(--space-2);">IBS Total (UF + Mun)</div>
            <div id="calc-vIBSTot" style="font-size: var(--text-xl); font-weight: 700; color: var(--color-primary-400); font-family: var(--font-mono);">R$ 0,00</div>
          </div>
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; margin-bottom: var(--space-2);">CBS (Federal)</div>
            <div id="calc-vCBS" style="font-size: var(--text-xl); font-weight: 700; color: var(--color-accent-400); font-family: var(--font-mono);">R$ 0,00</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Complementos IBSCBS -->
    <div class="card animate-slide-up tab-content hidden" id="tab-complementos">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">📦</span>Complementos IBSCBS
          </span>
        </h3>
      </div>
      <div class="card-body">

        <!-- NFS-e Referenciadas -->
        <div class="section-title">
          <span class="icon">🔗</span>NFS-e Referenciadas (gRefNFSe) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Até 99 referências</span>
        </div>
        <div id="ref-nfse-list" style="margin-bottom: var(--space-3);"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-ref-nfse">＋ Adicionar NFS-e Referenciada</button>

        <!-- Pagamento Antecipado -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">💳</span>Pagamento Antecipado (gPagAntecipado) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Até 99 referências</span>
        </div>
        <div id="pag-antecipado-list" style="margin-bottom: var(--space-3);"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-pag-antecipado">＋ Adicionar NFS-e Pag. Antecipado</button>

        <!-- Destinatário -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">👤</span>Destinatário (dest) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Quando indDest = 1</span>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo Documento</label>
            <select class="form-select" id="dest-tipoDoc">
              <option value="">Não informar</option>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
              <option value="NIF">NIF (Exterior)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Documento</label>
            <input class="form-input form-input-mono" id="dest-doc" type="text">
          </div>
          <div class="form-group">
            <label class="form-label">Motivo s/ NIF (cNaoNIF)</label>
            <select class="form-select" id="dest-cNaoNIF">
              <option value="">(n/a)</option>
              ${Object.entries(ENUMS.cNaoNIF).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Nome / Razão Social</label>
            <input class="form-input" id="dest-xNome" type="text" maxlength="150">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" id="dest-email" type="email" maxlength="80">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CEP</label>
            <input class="form-input form-input-mono" id="dest-CEP" type="text" maxlength="9">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Logradouro</label>
            <input class="form-input" id="dest-xLgr" type="text" maxlength="255">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Número</label>
            <input class="form-input" id="dest-nro" type="text" maxlength="60">
          </div>
          <div class="form-group">
            <label class="form-label">Complemento</label>
            <input class="form-input" id="dest-xCpl" type="text" maxlength="156">
          </div>
          <div class="form-group">
            <label class="form-label">Bairro</label>
            <input class="form-input" id="dest-xBairro" type="text" maxlength="60">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Município (IBGE)</label>
            <input class="form-input form-input-mono" id="dest-cMun" type="text" maxlength="7">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-input form-input-mono" id="dest-fone" type="text" maxlength="20">
          </div>
          <div class="form-group">
            <label class="form-label">País (ISO) — se exterior</label>
            <input class="form-input form-input-mono" id="dest-cPais" type="text" maxlength="2" placeholder="BR">
          </div>
        </div>
        <div class="form-row mb-4" id="dest-exterior-fields" style="display: none;">
          <div class="form-group">
            <label class="form-label">Cód. Postal Exterior</label>
            <input class="form-input form-input-mono" id="dest-cEndPost" type="text" maxlength="11">
          </div>
          <div class="form-group">
            <label class="form-label">Cidade Exterior</label>
            <input class="form-input" id="dest-xCidade" type="text" maxlength="60">
          </div>
          <div class="form-group">
            <label class="form-label">Estado/Província</label>
            <input class="form-input" id="dest-xEstProv" type="text" maxlength="60">
          </div>
        </div>

        <!-- Imóvel -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">🏠</span>Imóvel (imovel) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Operações 99.03.x — Exceto obras</span>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Inscrição Imobiliária Fiscal</label>
            <input class="form-input form-input-mono" id="imovel-inscFisc" type="text" maxlength="30">
          </div>
          <div class="form-group">
            <label class="form-label">CIB (Cadastro Imobiliário Brasileiro)</label>
            <input class="form-input form-input-mono" id="imovel-cCIB" type="text" maxlength="8">
          </div>
          <div class="form-group">
            <label class="form-label">Município (IBGE)</label>
            <input class="form-input form-input-mono" id="imovel-cMun" type="text" maxlength="7">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CEP</label>
            <input class="form-input form-input-mono" id="imovel-CEP" type="text" maxlength="9">
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Logradouro</label>
            <input class="form-input" id="imovel-xLgr" type="text" maxlength="255">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Número</label>
            <input class="form-input" id="imovel-nro" type="text" maxlength="60">
          </div>
          <div class="form-group">
            <label class="form-label">Complemento</label>
            <input class="form-input" id="imovel-xCpl" type="text" maxlength="156">
          </div>
          <div class="form-group">
            <label class="form-label">Bairro</label>
            <input class="form-input" id="imovel-xBairro" type="text" maxlength="60">
          </div>
        </div>

        <!-- Locação de Bens Móveis -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📦</span>Locação de Bens Móveis (gLocBensMoveis) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Apenas cTribNac = 99.04.01 — Até 99 itens</span>
        </div>
        <div id="bens-moveis-list" style="margin-bottom: var(--space-3);"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-bem-movel">＋ Adicionar Bem Móvel</button>

        <!-- Reembolso/Repasse/Ressarcimento -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">💰</span>Reembolso / Repasse / Ressarcimento (gReeRepRes) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Até 1000 documentos</span>
        </div>
        <div id="reerepres-list" style="margin-bottom: var(--space-3);"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-reerepres">＋ Adicionar Reembolso/Repasse</button>

        <!-- Deduções/Reduções da BC -->
        <div class="section-title" style="margin-top: var(--space-6);">
          <span class="icon">📉</span>Deduções / Reduções da BC (gDedRedIBSCBS) <span style="font-weight: 400; font-size: var(--text-xs); color: var(--color-neutral-500);">Até 1000 itens</span>
        </div>
        <div id="dedred-list" style="margin-bottom: var(--space-3);"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-dedred">＋ Adicionar Dedução/Redução</button>

      </div>
    </div>

    <!-- TAB: Resumo -->
    <div class="card animate-slide-up tab-content hidden" id="tab-resumo">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">📄</span>Resumo da DPS
          </span>
        </h3>
      </div>
      <div class="card-body" id="resumo-body">
        <div id="resumo-empty" class="empty-state">
          <div class="icon">📝</div>
          <p>Clique em "Preview XML" ou na aba Resumo para visualizar o XML gerado</p>
        </div>
        <div id="resumo-xml" class="hidden">
          <div class="section-title" style="font-size: var(--text-sm);">
            <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">📋</span>XML da DPS Gerada
          </div>
          <pre id="xml-preview" style="background: var(--surface-overlay); padding: var(--space-4); border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-primary-300); overflow-x: auto; max-height: 400px; border: 1px solid var(--surface-glass-border); line-height: 1.6;"></pre>
          <div id="api-response" class="hidden" style="margin-top: var(--space-4);">
            <div class="section-title" style="font-size: var(--text-sm);">
              <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">✅</span>Resposta da API Sefin Nacional
            </div>
            <pre id="api-response-body" style="background: rgba(16, 185, 129, 0.08); padding: var(--space-4); border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-accent-300); overflow-x: auto; border: 1px solid rgba(16, 185, 129, 0.15);"></pre>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" id="btn-download-xml-2">⬇ Download XML</button>
        <button class="btn btn-success" id="btn-enviar-dps-2">
          🔒 Assinar e Enviar DPS
        </button>
      </div>
    </div>
  `;

  // ─── Tab switching ────────────────────────────────
  setupTabs();
  setupMasks();
  setupConditionalFields();
  setupCalculations();
  setupFormActions();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-slide-up');
      }
    });
  });
}

function setupMasks() {
  // CNPJ/CPF mask for prestador
  const prestDoc = document.getElementById('prest-doc');
  const prestTipo = document.getElementById('prest-tipoInscr');
  if (prestDoc && prestTipo) {
    prestDoc.addEventListener('input', () => {
      if (prestTipo.value === '1') {
        prestDoc.value = maskCNPJ(prestDoc.value);
      } else {
        prestDoc.value = maskCPF(prestDoc.value);
      }
    });
  }

  // CEP masks
  const cepFields = ['prest-CEP', 'toma-CEP'];
  cepFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { el.value = maskCEP(el.value); });
  });

  // Phone masks
  const phoneFields = ['prest-fone'];
  phoneFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { el.value = maskPhone(el.value); });
  });

  // CNPJ/CPF mask for tomador
  const tomaDoc = document.getElementById('toma-doc');
  const tomaTipo = document.getElementById('toma-tipoDoc');
  if (tomaDoc && tomaTipo) {
    tomaDoc.addEventListener('input', () => {
      if (tomaTipo.value === 'CNPJ') {
        tomaDoc.value = maskCNPJ(tomaDoc.value);
      } else if (tomaTipo.value === 'CPF') {
        tomaDoc.value = maskCPF(tomaDoc.value);
      }
    });
  }
}

function setupConditionalFields() {
  // Show "Bens Móveis" panel when cTribNac = 99.04.01
  const cTribNac = document.getElementById('serv-cTribNac');
  const panelBM = document.getElementById('panel-bens-moveis');
  if (cTribNac && panelBM) {
    cTribNac.addEventListener('input', () => {
      panelBM.classList.toggle('hidden', cTribNac.value.trim() !== '99.04.01');
    });
  }

  // Dest exterior fields toggle
  const destCPais = document.getElementById('dest-cPais');
  const destExtFields = document.getElementById('dest-exterior-fields');
  if (destCPais && destExtFields) {
    destCPais.addEventListener('input', () => {
      const show = destCPais.value.trim() && destCPais.value.trim().toUpperCase() !== 'BR';
      destExtFields.style.display = show ? '' : 'none';
    });
  }

  // ─── Dynamic Lists in Complementos Tab ────────────
  setupDynamicList('btn-add-ref-nfse', 'ref-nfse-list', () => `
    <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;">
      <input class="form-input form-input-mono" data-list-ibs-refNFSe type="text" maxlength="50" placeholder="Chave de acesso NFS-e (50 dígitos)" style="flex: 1;">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>
  `);

  setupDynamicList('btn-add-pag-antecipado', 'pag-antecipado-list', () => `
    <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;">
      <input class="form-input form-input-mono" data-list-ibs-pagAntecipado type="text" maxlength="50" placeholder="Chave NFS-e pag. antecipado (50 dígitos)" style="flex: 1;">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>
  `);

  setupDynamicList('btn-add-bem-movel', 'bens-moveis-list', () => `
    <div data-bm-item style="display: grid; grid-template-columns: 1fr 2fr 80px 40px; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;">
      <input class="form-input form-input-mono" data-bm-ncm type="text" maxlength="8" placeholder="NCM (8 díg.)">
      <input class="form-input" data-bm-desc type="text" maxlength="150" placeholder="Descrição do bem móvel">
      <input class="form-input form-input-mono" data-bm-qtd type="number" min="1" max="999" value="1" placeholder="Qtd">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>
  `);

  setupDynamicList('btn-add-reerepres', 'reerepres-list', () => `
    <div data-reerepres-item style="display: grid; grid-template-columns: 1fr 1fr 2fr 40px; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;">
      <select class="form-select" data-rrr-tipo style="font-size: var(--text-xs);">
        ${Object.entries(ENUMS.tpReeRepRes).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
      </select>
      <input class="form-input form-input-mono" data-rrr-valor type="text" placeholder="Valor R$">
      <input class="form-input form-input-mono" data-rrr-chave type="text" maxlength="50" placeholder="Chave DF-e (opcional)">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>
  `);

  setupDynamicList('btn-add-dedred', 'dedred-list', () => `
    <div data-dedred-item style="display: grid; grid-template-columns: 1fr 1fr 2fr 40px; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;">
      <select class="form-select" data-dr-tipo style="font-size: var(--text-xs);">
        ${Object.entries(ENUMS.tpDedRedIBSCBS).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
      </select>
      <input class="form-input form-input-mono" data-dr-valor type="text" placeholder="Valor R$">
      <input class="form-input" data-dr-desc type="text" maxlength="150" placeholder="Descrição (obrig. para tipo 99)">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>
  `);
}

function setupDynamicList(btnId, listId, templateFn) {
  const btn = document.getElementById(btnId);
  const list = document.getElementById(listId);
  if (btn && list) {
    btn.addEventListener('click', () => {
      const div = document.createElement('div');
      div.innerHTML = templateFn();
      list.appendChild(div.firstElementChild);
    });
  }
}

function setupCalculations() {
  const vServInput = document.getElementById('val-vServ');
  if (vServInput) {
    vServInput.addEventListener('input', recalcIBSCBS);
  }
}

function recalcIBSCBS() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value.replace(/\./g, '').replace(',', '.')) || 0 : 0;
  };

  const result = calculateIBSCBS({
    vServ: getVal('val-vServ'),
    descIncond: getVal('val-descIncond'),
    vISSQN: 0,
    vPIS: getVal('val-vPIS'),
    vCOFINS: getVal('val-vCofins'),
    pIBSUF: 0.10,   // Test rate 2026
    pIBSMun: 0.05,   // Test rate 2026
    pCBS: 0.90,       // Test rate 2026
    year: 2026,
  });

  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const bcEl = document.getElementById('calc-vBC');
  const ibsEl = document.getElementById('calc-vIBSTot');
  const cbsEl = document.getElementById('calc-vCBS');

  if (bcEl) bcEl.textContent = fmt(result.vBC);
  if (ibsEl) ibsEl.textContent = fmt(result.vIBSTot);
  if (cbsEl) cbsEl.textContent = fmt(result.vCBS);
}

function setupFormActions() {
  // ─── Preview XML button ──────────────────────
  const previewBtn = document.getElementById('btn-preview-xml');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      generateAndShowXml();
    });
  }

  // ─── Download XML buttons ───────────────────
  ['btn-download-xml', 'btn-download-xml-2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        const data = collectDPSFormData();
        const { valid, errors } = validateDPSForm(data);
        if (!valid) {
          toast.error(`Campos obrigatórios: ${errors[0]}`);
          return;
        }
        const xml = buildDPSXml(data);
        downloadXml(xml, `DPS_${data.serie}_${data.nDPS}.xml`);
        toast.success('Download do XML iniciado!');
      });
    }
  });

  // ─── Submit (Sign & Send) buttons ───────────
  const submitBtns = ['btn-enviar-dps', 'btn-enviar-dps-2'];
  submitBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        const data = collectDPSFormData();
        const { valid, errors } = validateDPSForm(data);
        if (!valid) {
          toast.error(`Validação falhou: ${errors[0]}`);
          return;
        }

        btn.disabled = true;
        btn.textContent = '⏳ Processando...';

        try {
          let xmlStr = buildDPSXml(data);

          // Sign if certificate is loaded
          const cert = getCertStore();
          if (cert && cert.privateKey) {
            toast.info('Assinando XML com certificado digital...');
            xmlStr = await signXml(xmlStr, cert.privateKey, cert.certificate);
            toast.success('XML assinado com sucesso!');
          } else {
            toast.warning('Certificado não carregado — enviando sem assinatura (modo demo).');
          }

          // Send via API
          toast.info('Enviando DPS para Sefin Nacional...');
          const response = await safeFetch(enviarDPS, xmlStr);

          if (response.ok) {
            toast.success(`✅ NFS-e autorizada! Nº ${response.data.nfse?.nNFSe || 'N/A'} — cStat: ${response.data.cStat}`);

            // Show XML preview and API response
            generateAndShowXml();
            const apiResponseEl = document.getElementById('api-response');
            const apiBodyEl = document.getElementById('api-response-body');
            if (apiResponseEl && apiBodyEl) {
              apiResponseEl.classList.remove('hidden');
              apiBodyEl.textContent = JSON.stringify(response.data, null, 2);
            }

            // Switch to Resumo tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const resumoTab = document.querySelector('[data-tab="tab-resumo"]');
            const resumoContent = document.getElementById('tab-resumo');
            if (resumoTab) resumoTab.classList.add('active');
            if (resumoContent) resumoContent.classList.remove('hidden');
          } else {
            toast.error(`Erro na API: ${response.data?.xMotivo || 'Desconhecido'}`);
          }
        } catch (err) {
          toast.error(`Falha: ${err.message}`);
        } finally {
          btn.disabled = false;
          btn.textContent = '🔒 Assinar e Enviar DPS';
        }
      });
    }
  });

  // ─── Clear button ───────────────────────────
  const clearBtn = document.getElementById('btn-limpar-dps');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.querySelectorAll('.form-input, .form-textarea').forEach(el => {
        if (el.type !== 'hidden') el.value = '';
      });
      toast.info('Formulário limpo.');
    });
  }

  // ─── Set default date/time ──────────────────
  const dhEmi = document.getElementById('dps-dhEmi');
  if (dhEmi) {
    const now = new Date();
    dhEmi.value = now.toISOString().slice(0, 16);
  }
  const dCompet = document.getElementById('dps-dCompet');
  if (dCompet) {
    dCompet.value = new Date().toISOString().slice(0, 10);
  }
}

function generateAndShowXml() {
  const data = collectDPSFormData();
  const { valid, errors } = validateDPSForm(data);
  if (!valid) {
    toast.error(`Campos obrigatórios: ${errors[0]}`);
    return;
  }
  const xml = buildDPSXml(data);
  const formatted = prettyPrintXml(xml);

  const emptyEl = document.getElementById('resumo-empty');
  const xmlEl = document.getElementById('resumo-xml');
  const previewEl = document.getElementById('xml-preview');

  if (emptyEl) emptyEl.classList.add('hidden');
  if (xmlEl) xmlEl.classList.remove('hidden');
  if (previewEl) previewEl.textContent = formatted;

  // Switch to Resumo tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  const resumoTab = document.querySelector('[data-tab="tab-resumo"]');
  const resumoContent = document.getElementById('tab-resumo');
  if (resumoTab) resumoTab.classList.add('active');
  if (resumoContent) resumoContent.classList.remove('hidden');

  toast.success('XML da DPS gerado com sucesso!');
}
