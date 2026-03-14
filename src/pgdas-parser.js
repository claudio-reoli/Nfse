/**
 * NFSe Freire — Parser PGDAS-D 2018 v1.0.2.0
 *
 * Estrutura hierárquica do arquivo (pipe-delimitado, UTF-8):
 *   AAAAA  — Abertura
 *   00000  — Identificação do contribuinte + dados da apuração
 *     02000  — RBT12 e receitas de períodos anteriores
 *     03000  — Dados de cada estabelecimento (filial/matriz)
 *       03100 → 03110/03120/03130 → valores ISS por atividade/município
 *   ZZZZZ  — Fechamento
 *
 * Uso:
 *   import { parsePgdas } from './pgdas-parser.js';
 *   const resultado = await parsePgdas(buffer, { codTOM: '1234' });
 *
 * Retorna array de { cnpj, pa, rbt12, rpa, operacao, retido_malha,
 *                    impedido_iss, v_iss_municipio, v_receita_pa }
 */

import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

/**
 * Extrai o conteúdo de texto de um buffer (ZIP ou texto plano).
 * Se o buffer começar com os bytes PK (magic ZIP), usa adm-zip.
 * Caso contrário, trata como texto UTF-8 diretamente.
 */
function _extrairTexto(buffer) {
  // Detecta ZIP pelos magic bytes PK (0x50 0x4B)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    try {
      const AdmZip = _require('adm-zip');
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries().filter(e => !e.isDirectory);
      if (!entries.length) throw new Error('ZIP vazio: nenhum arquivo encontrado');
      // Pega o primeiro arquivo de texto dentro do ZIP
      const entry = entries[0];
      return zip.readAsText(entry, 'utf8');
    } catch (err) {
      throw new Error(`Falha ao extrair ZIP: ${err.message}`);
    }
  }
  // Trata como texto
  return buffer.toString('utf8');
}

/**
 * Converte string numérica BR (vírgula como decimal) para float.
 */
function _num(s) {
  if (!s || s.trim() === '') return 0;
  return parseFloat(s.replace(',', '.')) || 0;
}

/**
 * Converte PA "AAAAMM" → "AAAA-MM".
 */
function _paToComp(pa) {
  if (!pa || pa.length < 6) return null;
  return `${pa.slice(0, 4)}-${pa.slice(4, 6)}`;
}

/**
 * Parseia o conteúdo de um arquivo PGDAS-D e retorna apenas os
 * contribuintes do município indicado (filtro por Cod_TOM).
 *
 * @param {Buffer} buffer  - conteúdo do arquivo (ZIP ou texto)
 * @param {object} opts
 *   @param {string} [opts.codTOM]  - código TOM do município (4 dígitos)
 *                                    Se omitido, retorna todos.
 * @returns {{ resultado: Array, totais: object, versao: string, erros: string[] }}
 */
export function parsePgdas(buffer, opts = {}) {
  const { codTOM } = opts;

  let texto;
  try {
    texto = _extrairTexto(buffer);
  } catch (err) {
    return { resultado: [], totais: {}, versao: '', erros: [err.message] };
  }

  const linhas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
  const erros = [];

  let versao = '';
  const resultado = [];
  const errosMap = new Map();

  // Estado do contribuinte corrente
  let ctx = null;        // contexto do bloco 00000
  let rbt12 = 0;         // valor do registro 02000
  let blocoEstab = null; // contexto do registro 03000 corrente

  for (const linha of linhas) {
    // Dividindo: a linha começa e termina com |, então slice(1) remove o '' inicial
    const parts = linha.split('|');
    // Se a linha começa com |, parts[0] é '', e parts[1] é o REG
    const offset = parts[0] === '' ? 1 : 0;
    const fields = parts.slice(offset);

    if (!fields.length) continue;
    const reg = fields[0];

    switch (reg) {
      // ── AAAAA: abertura ───────────────────────────────────────────────────
      case 'AAAAA':
        versao = fields[1] || '';
        break;

      // ── 00000: contribuinte ───────────────────────────────────────────────
      case '00000': {
        const cnpj      = (fields[6] || '').trim();
        const pa        = (fields[11] || '').trim();
        const rpa       = _num(fields[12]);
        const operacao  = (fields[14] || 'A').trim().toUpperCase();
        const retido    = (fields[21] || '0').trim() === '1';

        if (!cnpj || !pa) break;

        ctx = {
          cnpj,
          pa,
          competencia: _paToComp(pa),
          rpa,
          operacao,
          retido_malha: retido,
          rbt12: 0,
          // Acumuladores para cada estabelecimento do município
          v_iss_municipio: 0,
          impedido_iss: false,
          tem_municipio: false,
        };
        rbt12 = 0;
        blocoEstab = null;
        break;
      }

      // ── 02000: RBT12 ─────────────────────────────────────────────────────
      case '02000':
        if (ctx) {
          rbt12 = _num(fields[1]);
          ctx.rbt12 = rbt12;
        }
        break;

      // ── 03000: estabelecimento ────────────────────────────────────────────
      case '03000': {
        if (!ctx) break;
        const cnpjEstab  = (fields[1] || '').trim();
        const tomEstab   = (fields[3] || '').trim();
        const impedido   = (fields[10] || '0').trim() === '1';

        // Considera o estabelecimento se bater com o Cod_TOM do município
        // ou se não houve filtro (codTOM vazio → importa tudo)
        const pertence = !codTOM || tomEstab === codTOM.padStart(4, '0');

        blocoEstab = { cnpjEstab, tomEstab, impedido, pertence };

        if (pertence) {
          ctx.tem_municipio = true;
          if (impedido) ctx.impedido_iss = true;
        }
        break;
      }

      // ── 03110: ISS por atividade (Faixa A) ───────────────────────────────
      case '03110': {
        if (!ctx || !blocoEstab?.pertence) break;
        const tomAtiv = (fields[2] || '').trim();
        if (!codTOM || tomAtiv === codTOM.padStart(4, '0') || tomAtiv === '') {
          ctx.v_iss_municipio += _num(fields[27]); // Val ISS na posição 27
        }
        break;
      }

      // ── 03120 / 03130: ISS por atividade (Faixa B/C) ─────────────────────
      case '03120':
      case '03130': {
        if (!ctx || !blocoEstab?.pertence) break;
        ctx.v_iss_municipio += _num(fields[15]); // Val ISS na posição 15
        break;
      }

      // ── 99999: encerra bloco 00000 ────────────────────────────────────────
      case '99999': {
        if (ctx) {
          // Registra apenas se há dados do município (ou sem filtro)
          if (!codTOM || ctx.tem_municipio) {
            resultado.push({
              cnpj:             ctx.cnpj,
              pa:               ctx.pa,
              competencia:      ctx.competencia,
              rbt12:            ctx.rbt12,
              v_receita_pa:     ctx.rpa,
              operacao:         ctx.operacao,
              retido_malha:     ctx.retido_malha,
              impedido_iss:     ctx.impedido_iss,
              v_iss_municipio:  Math.round(ctx.v_iss_municipio * 100) / 100,
            });
          }
          ctx = null;
          blocoEstab = null;
        }
        break;
      }

      case 'ZZZZZ':
        break;

      default:
        break;
    }
  }

  const totais = {
    total:          resultado.length,
    retidos_malha:  resultado.filter(r => r.retido_malha).length,
    impedidos_iss:  resultado.filter(r => r.impedido_iss).length,
    retificacoes:   resultado.filter(r => r.operacao === 'R').length,
  };

  return { resultado, totais, versao, erros };
}
