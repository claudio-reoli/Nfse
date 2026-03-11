import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fsSync from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import forge from 'node-forge';
import zlib from 'zlib';
import * as db from './db.js';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3099;
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-secret-key-2026';
const CERT_PATH = process.env.CERT_PATH || '';
const CERT_PASSPHRASE = process.env.CERT_PASSPHRASE || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && JWT_SECRET === 'antigravity-secret-key-2026') {
  console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
  process.exit(1);
}

app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json());
app.use(express.text({ type: ['text/xml', 'application/xml'] }));
app.use(express.static('./'));

// ==========================================
// Rate Limiting
// ==========================================

const rateLimitMap = new Map();

function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now - entry.start > windowMs) {
      rateLimitMap.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
    }
    next();
  };
}

// ==========================================
// Database initialization (PostgreSQL)
// ==========================================

async function ensureDataDir() {
  try { await fs.mkdir('./data', { recursive: true }); } catch {}
}

async function seedDefaultUsersIfEmpty() {
  const users = await db.getUsers();
  if (users.length > 0) return;
  const defaults = [
    { cpf: '111.222.333-44', name: 'José da Silva', role: 'MASTER', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    { cpf: '999.888.777-66', name: 'João Contador', role: 'CONTADOR', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '12345678000100' },
    { cpf: '123.456.789-00', name: 'Admin Sefin', role: 'GESTOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '333.444.555-66', name: 'Carlos Fiscal', role: 'FISCAL', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '777.888.999-11', name: 'Auditor Chefe', role: 'AUDITOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' }
  ];
  for (const u of defaults) await db.insertUser(u);
  console.log('[ DB ] Usuários padrão criados.');
}

// Initialize DB on startup
(async () => {
  await ensureDataDir();
  try {
    await db.runMigrations();
    await seedDefaultUsersIfEmpty();
    console.log('[ DB ] PostgreSQL conectado e migrações aplicadas.');
  } catch (err) {
    console.error('[ DB ] Erro ao conectar PostgreSQL:', err.message);
    process.exit(1);
  }
})();

// ==========================================
// Certificate Helper
// ==========================================

function loadCertAgent() {
  if (CERT_PATH && fsSync.existsSync(CERT_PATH)) {
    return new https.Agent({
      pfx: fsSync.readFileSync(CERT_PATH),
      passphrase: CERT_PASSPHRASE
    });
  }
  return new https.Agent({ rejectUnauthorized: false });
}

// ==========================================
// MÓDULO 1: Sincronização Passiva ADN (Worker)
// ==========================================

function decodeArquivoXml(arquivoXml) {
  if (!arquivoXml || typeof arquivoXml !== 'string') return null;
  try {
    const buf = Buffer.from(arquivoXml, 'base64');
    let rawBuf;
    try {
      rawBuf = zlib.gunzipSync(buf);
    } catch {
      rawBuf = buf;
    }
    let xmlStr = rawBuf.toString('utf-8');
    const encodingMatch = xmlStr.match(/encoding="([^"]+)"/i);
    if (encodingMatch) {
      const enc = encodingMatch[1].toLowerCase();
      if (enc !== 'utf-8' && enc !== 'utf8') {
        try {
          xmlStr = rawBuf.toString('latin1');
        } catch { /* keep utf-8 */ }
      }
    }
    if (xmlStr.includes('\ufffd')) {
      xmlStr = rawBuf.toString('latin1');
    }
    return xmlStr;
  } catch (err) {
    console.warn('[ ADN Worker ] Falha ao decodificar ArquivoXml:', err.message);
    return null;
  }
}

function xmlTagValue(xml, tag) {
  const patterns = [
    new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function xmlBlock(xml, tag) {
  const p = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const m = xml.match(p);
  return m ? m[0] : '';
}

function parseNfseXml(xmlStr, envelope) {
  if (!xmlStr) return null;

  const chaveAcesso = envelope.ChaveAcesso || xmlTagValue(xmlStr, 'chNFSe') || '';
  if (!chaveAcesso) return null;

  const emitBlock = xmlBlock(xmlStr, 'emit');
  const tomBlock = xmlBlock(xmlStr, 'toma');
  const valBlock = xmlBlock(xmlStr, 'valores');
  const dpsBlock = xmlBlock(xmlStr, 'infDPS');
  const servBlock = xmlBlock(dpsBlock || xmlStr, 'serv');

  const emitEnder = xmlBlock(emitBlock, 'enderNac') || xmlBlock(emitBlock, 'end');
  const tomEnder = xmlBlock(tomBlock, 'enderNac') || xmlBlock(tomBlock, 'end');

  const pf = (s) => parseFloat(s) || 0;

  const nota = {
    chaveAcesso,
    nsu: envelope.NSU || 0,
    tipoDocumento: envelope.TipoDocumento || 'NFSe',
    fonte: 'ADN',
    dataImportacao: new Date().toISOString(),

    dadosGerais: {
      dhEmi: xmlTagValue(dpsBlock || xmlStr, 'dhEmi') || envelope.DataHoraGeracao || '',
      dhProc: xmlTagValue(xmlStr, 'dhProc') || '',
      nNFSe: xmlTagValue(xmlStr, 'nNFSe') || '',
      nDPS: xmlTagValue(dpsBlock || xmlStr, 'nDPS') || '',
      nDFSe: xmlTagValue(xmlStr, 'nDFSe') || '',
      serie: xmlTagValue(dpsBlock || xmlStr, 'serie') || '',
      dCompet: xmlTagValue(dpsBlock || xmlStr, 'dCompet') || '',
      cLocIncid: xmlTagValue(xmlStr, 'cLocIncid') || '',
      xLocIncid: xmlTagValue(xmlStr, 'xLocIncid') || '',
      xLocEmi: xmlTagValue(xmlStr, 'xLocEmi') || '',
      xLocPrestacao: xmlTagValue(xmlStr, 'xLocPrestacao') || '',
      verAplic: xmlTagValue(xmlStr, 'verAplic') || '',
      ambGer: xmlTagValue(xmlStr, 'ambGer') || '',
      tpEmis: xmlTagValue(xmlStr, 'tpEmis') || '',
      tpEmit: xmlTagValue(dpsBlock || xmlStr, 'tpEmit') || '',
      cStat: xmlTagValue(xmlStr, 'cStat') || '',
    },

    prestador: {
      CNPJ: xmlTagValue(emitBlock, 'CNPJ') || '',
      CPF: xmlTagValue(emitBlock, 'CPF') || '',
      xNome: xmlTagValue(emitBlock, 'xNome') || '',
      xFant: xmlTagValue(emitBlock, 'xFant') || '',
      IM: xmlTagValue(emitBlock, 'IM') || '',
      fone: xmlTagValue(emitBlock, 'fone') || '',
      email: xmlTagValue(emitBlock, 'email') || '',
      endereco: {
        xLgr: xmlTagValue(emitEnder, 'xLgr') || '',
        nro: xmlTagValue(emitEnder, 'nro') || '',
        xBairro: xmlTagValue(emitEnder, 'xBairro') || '',
        cMun: xmlTagValue(emitEnder, 'cMun') || '',
        UF: xmlTagValue(emitEnder, 'UF') || '',
        CEP: xmlTagValue(emitEnder, 'CEP') || '',
      },
    },

    tomador: {
      CNPJ: xmlTagValue(tomBlock, 'CNPJ') || '',
      CPF: xmlTagValue(tomBlock, 'CPF') || '',
      xNome: xmlTagValue(tomBlock, 'xNome') || '',
      email: xmlTagValue(tomBlock, 'email') || '',
      fone: xmlTagValue(tomBlock, 'fone') || '',
      endereco: {
        xLgr: xmlTagValue(tomEnder, 'xLgr') || '',
        nro: xmlTagValue(tomEnder, 'nro') || '',
        xBairro: xmlTagValue(tomEnder, 'xBairro') || '',
        cMun: xmlTagValue(tomEnder, 'cMun') || '',
        UF: xmlTagValue(tomEnder, 'UF') || '',
        CEP: xmlTagValue(tomEnder, 'CEP') || '',
      },
    },

    servico: {
      xDescServ: xmlTagValue(servBlock || dpsBlock || xmlStr, 'xDescServ') || xmlTagValue(xmlStr, 'xTribMun') || '',
      cServTribMun: xmlTagValue(servBlock || dpsBlock, 'cServTribMun') || '',
      cServTribNac: xmlTagValue(servBlock || dpsBlock, 'cServTribNac') || '',
      cLC116: xmlTagValue(servBlock || dpsBlock, 'cLC116') || '',
      cCnae: xmlTagValue(servBlock || dpsBlock, 'CNAE') || xmlTagValue(servBlock || dpsBlock, 'cCnae') || '',
      xTribNac: xmlTagValue(xmlStr, 'xTribNac') || '',
      xTribMun: xmlTagValue(xmlStr, 'xTribMun') || '',
    },

    valores: {
      vServ: pf(xmlTagValue(servBlock || dpsBlock, 'vServ') || xmlTagValue(valBlock, 'vServ') || xmlTagValue(valBlock, 'vBC')),
      vBC: pf(xmlTagValue(valBlock, 'vBC')),
      vLiq: pf(xmlTagValue(valBlock, 'vLiq')),
      vISS: pf(xmlTagValue(valBlock, 'vISSQN') || xmlTagValue(valBlock, 'vISS')),
      vTotalRet: pf(xmlTagValue(valBlock, 'vTotalRet')),
      pAliqAplic: pf(xmlTagValue(valBlock, 'pAliqAplic')),
      vDescIncond: pf(xmlTagValue(servBlock || dpsBlock, 'vDescIncond')),
      vDescCond: pf(xmlTagValue(servBlock || dpsBlock, 'vDescCond')),
    },

    tributos: {
      issqn: {
        pAliq: pf(xmlTagValue(valBlock, 'pAliqAplic') || xmlTagValue(servBlock || dpsBlock, 'pAliq')),
        tpRetISSQN: xmlTagValue(servBlock || dpsBlock, 'tpRetISSQN') || '',
        tpImunidade: xmlTagValue(servBlock || dpsBlock, 'tpImunidade') || '',
        tpTribISSQN: xmlTagValue(servBlock || dpsBlock, 'tpTribISSQN') || '',
      }
    },
  };

  if (!nota.valores.vServ && nota.valores.vBC) {
    nota.valores.vServ = nota.valores.vBC;
  }

  return nota;
}

function v(obj, ...keys) {
  for (const k of keys) { const val = obj?.[k]; if (val !== undefined && val !== null && val !== '') return val; }
  return undefined;
}
function vStr(obj, ...keys) { return String(v(obj, ...keys) ?? ''); }
function vNum(obj, ...keys) { const r = parseFloat(v(obj, ...keys)); return isNaN(r) ? 0 : r; }
function vInt(obj, ...keys) { const r = parseInt(v(obj, ...keys), 10); return isNaN(r) ? 0 : r; }
function vBool(obj, ...keys) { const r = v(obj, ...keys); return r === true || r === '1' || r === 1; }

function parseEnderecoAdn(src) {
  if (!src) return {};
  return {
    cMun: vStr(src, 'cMun'),
    CEP: vStr(src, 'CEP'),
    xLgr: vStr(src, 'xLgr'),
    nro: vStr(src, 'nro'),
    xCpl: vStr(src, 'xCpl'),
    xBairro: vStr(src, 'xBairro'),
    cPais: vStr(src, 'cPais'),
    cEndPost: vStr(src, 'cEndPost'),
    xCidade: vStr(src, 'xCidade'),
    xEstProvReg: vStr(src, 'xEstProvReg')
  };
}

function parsePessoaAdn(src) {
  if (!src) return {};
  const end = src.end || src.endereco || src;
  return {
    CNPJ: vStr(src, 'CNPJ', 'cnpj'),
    CPF: vStr(src, 'CPF', 'cpf'),
    NIF: vStr(src, 'NIF', 'nif'),
    cNaoNIF: vStr(src, 'cNaoNIF'),
    CAEPF: vStr(src, 'CAEPF', 'caepf'),
    IM: vStr(src, 'IM', 'im', 'inscricaoMunicipal'),
    xNome: vStr(src, 'xNome', 'nome', 'razaoSocial'),
    fone: vStr(src, 'fone', 'telefone'),
    email: vStr(src, 'email'),
    endereco: parseEnderecoAdn(end)
  };
}

function parseDocsDedRed(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(d => ({
    tpDedRed: vStr(d, 'tpDedRed'),
    xDescOutDed: vStr(d, 'xDescOutDed'),
    dtEmiDoc: vStr(d, 'dtEmiDoc'),
    vDedutivelRedutivel: vNum(d, 'vDedutivelRedutivel'),
    vDeducaoReducao: vNum(d, 'vDeducaoReducao'),
    chNFSe: vStr(d, 'chNFSe'),
    chNFe: vStr(d, 'chNFe'),
    cMunNFSeMun: vStr(d, 'cMunNFSeMun'),
    nNFSeMun: vStr(d, 'nNFSeMun'),
    cVerifNFSeMun: vStr(d, 'cVerifNFSeMun'),
    nNFS: vStr(d, 'nNFS'),
    modNFS: vStr(d, 'modNFS'),
    serieNFS: vStr(d, 'serieNFS'),
    nDocFisc: vStr(d, 'nDocFisc'),
    nDoc: vStr(d, 'nDoc'),
    fornecedor: parsePessoaAdn(d.fornecedor || d.forn || d)
  }));
}

function parseNfseFromAdn(doc, ibge) {
  if (!doc) return null;

  const nfse = doc.nfse || doc.NFSe || doc;
  const inf = nfse.infNFSe || nfse.infNfse || nfse;
  const dps = inf.DPS || inf.infDPS || inf.dps || inf;

  const prest = dps.prest || dps.prestador || inf.prest || inf.prestador || {};
  const toma = dps.toma || dps.tomador || inf.toma || inf.tomador || {};
  const interm = dps.interm || dps.intermediario || inf.interm || {};
  const serv = dps.serv || dps.servico || inf.serv || inf.servico || {};
  const vals = dps.valores || inf.valores || inf.valoresNfse || {};
  const vServPrest = vals.vServPrest || vals;
  const vDescCondIncond = vals.vDescCondIncond || vals;
  const dedRedSrc = vals.vDedRed || vals.dedRed || {};
  const trib = dps.trib || inf.trib || inf.tributos || {};
  const tribISSQN = trib.tribISSQN || trib.issqn || trib;
  const tribFed = trib.tribFed || trib.federal || {};
  const totTrib = trib.totTrib || trib.totalTributos || {};
  const ibscbs = dps.IBSCBS || dps.ibscbs || inf.IBSCBS || {};
  const obra = dps.obra || dps.construcaoCivil || inf.obra || {};
  const atvEvt = dps.atvEvt || dps.evento || inf.atvEvt || {};
  const comExt = dps.comExt || dps.comercioExterior || serv;
  const dest = dps.dest || dps.destinatario || inf.dest || {};
  const imovel = dps.imovel || dps.imob || inf.imovel || {};

  const prestParsed = parsePessoaAdn(prest);
  const tomaParsed = parsePessoaAdn(toma);
  const intermParsed = parsePessoaAdn(interm);

  const docsDedRed = parseDocsDedRed(
    dedRedSrc.documentos || dedRedSrc.docs || dedRedSrc.docDedRed || []
  );

  const docsRef = (dps.docRef || dps.documentosReferenciados || inf.docRef || []);
  const docsRefParsed = Array.isArray(docsRef) ? docsRef.map(d => ({
    tipoChaveDFe: vStr(d, 'tipoChaveDFe'),
    xTipoChaveDFe: vStr(d, 'xTipoChaveDFe'),
    chaveDFe: vStr(d, 'chaveDFe'),
    cMunDocFiscal: vStr(d, 'cMunDocFiscal'),
    nDocFiscal: vStr(d, 'nDocFiscal'),
    xDocFiscal: vStr(d, 'xDocFiscal'),
    nDoc: vStr(d, 'nDoc'),
    xDoc: vStr(d, 'xDoc'),
    fornecedor: parsePessoaAdn(d.fornecedor || d.forn),
    dtEmiDoc: vStr(d, 'dtEmiDoc'),
    dtCompDoc: vStr(d, 'dtCompDoc'),
    tpReeRepRes: vStr(d, 'tpReeRepRes'),
    xTpReeRepRes: vStr(d, 'xTpReeRepRes'),
    vlrReeRepRes: vNum(d, 'vlrReeRepRes')
  })) : [];

  const chavesRefNFSe = (dps.refNFSe || inf.refNFSe || []);
  const chavesRefParsed = Array.isArray(chavesRefNFSe)
    ? chavesRefNFSe.map(r => typeof r === 'string' ? r : vStr(r, 'refNFSe'))
    : [];

  const itensPed = (dps.itensPed || dps.xItemPed || []);
  const itensPedParsed = Array.isArray(itensPed) ? itensPed.map(i => vStr(i, 'xItemPed') || String(i)) : [];

  return {
    _fonte: 'ADN',
    _importadoEm: new Date().toISOString(),

    nsu: vInt(doc, 'nsu', 'NSU'),
    chaveAcesso: vStr(doc, 'chNFSe', 'chaveAcesso') || vStr(inf, 'chNFSe'),

    dadosGerais: {
      dhEmi: vStr(inf, 'dhEmi', 'dataEmissao') || vStr(dps, 'dhEmi'),
      serie: vStr(dps, 'serie'),
      nDPS: vStr(dps, 'nDPS', 'numeroDPS'),
      dCompet: vStr(dps, 'dCompet', 'competencia') || vStr(inf, 'competencia', 'cCompetencia', 'dCompet'),
      tpEmit: vStr(dps, 'tpEmit'),
      cLocEmi: vStr(dps, 'cLocEmi') || ibge,
      verAplic: vStr(inf, 'verAplic'),
      chSubstda: vStr(dps, 'chSubstda'),
      cMotivo: vStr(dps, 'cMotivo'),
      xMotivo: vStr(dps, 'xMotivo'),
      finNFSe: vStr(dps, 'finNFSe') || vStr(inf, 'finNFSe'),
      xInfComp: vStr(dps, 'xInfComp', 'informacoesComplementares'),
      xPed: vStr(dps, 'xPed'),
      itensPed: itensPedParsed,
      docRef: vStr(dps, 'docRef'),
      idDocTec: vStr(dps, 'idDocTec'),
      refNFSe: chavesRefParsed
    },

    prestador: {
      ...prestParsed,
      opSimpNac: vStr(prest, 'opSimpNac'),
      regApTribSN: vStr(prest, 'regApTribSN'),
      regEspTrib: vStr(prest, 'regEspTrib')
    },

    tomador: tomaParsed,

    intermediario: intermParsed,

    destinatario: {
      ...parsePessoaAdn(dest),
      indDest: vStr(dps, 'indDest') || vStr(dest, 'indDest')
    },

    servico: {
      cTribNac: vStr(serv, 'cTribNac', 'codigoTributacaoNacional'),
      cTribMun: vStr(serv, 'cTribMun', 'codigoTributacaoMunicipal'),
      xDescServ: vStr(serv, 'xDescServ', 'discriminacao', 'descricaoServico'),
      cNBS: vStr(serv, 'cNBS'),
      cIntContrib: vStr(serv, 'cIntContrib'),
      cLocPrestacao: vStr(serv, 'cLocPrestacao', 'cLocIncid') || ibge,
      cPaisPrestacao: vStr(serv, 'cPaisPrestacao'),
      mdPrestacao: vStr(serv, 'mdPrestacao'),
      vincPrest: vStr(serv, 'vincPrest'),
      tpMoeda: vStr(serv, 'tpMoeda'),
      vServMoeda: vNum(serv, 'vServMoeda')
    },

    valores: {
      vServ: vNum(vServPrest, 'vServ', 'vServico', 'valor'),
      vDescIncond: vNum(vDescCondIncond, 'vDescIncond'),
      vDescCond: vNum(vDescCondIncond, 'vDescCond'),
      vLiq: vNum(vals, 'vLiq', 'valorLiquido'),
      vReceb: vNum(vals, 'vReceb'),
      dedRed: {
        pDR: vNum(dedRedSrc, 'pDR'),
        vDR: vNum(dedRedSrc, 'vDR'),
        documentos: docsDedRed
      }
    },

    tributos: {
      issqn: {
        tribISSQN: vStr(tribISSQN, 'tribISSQN', 'tributacao'),
        cPaisResult: vStr(tribISSQN, 'cPaisResult'),
        tpImunidade: vStr(tribISSQN, 'tpImunidade'),
        tpSusp: vStr(tribISSQN, 'tpSusp'),
        nProcesso: vStr(tribISSQN, 'nProcesso'),
        pAliq: vNum(tribISSQN, 'pAliq', 'pAliqAplic', 'aliquota'),
        tpRetISSQN: vStr(tribISSQN, 'tpRetISSQN', 'tipoRetencao'),
        nBM: vStr(tribISSQN, 'nBM'),
        vRedBCBM: vNum(tribISSQN, 'vRedBCBM'),
        pRedBCBM: vNum(tribISSQN, 'pRedBCBM')
      },
      federal: {
        CST: vStr(tribFed, 'CST'),
        vBCPisCofins: vNum(tribFed, 'vBCPisCofins'),
        pAliqPis: vNum(tribFed, 'pAliqPis', 'aliquotaPIS'),
        pAliqCofins: vNum(tribFed, 'pAliqCofins', 'aliquotaCOFINS'),
        vPis: vNum(tribFed, 'vPis'),
        vCofins: vNum(tribFed, 'vCofins'),
        tpRetPisCofins: vStr(tribFed, 'tpRetPisCofins'),
        vRetCP: vNum(tribFed, 'vRetCP'),
        vRetIRRF: vNum(tribFed, 'vRetIRRF'),
        vRetCSLL: vNum(tribFed, 'vRetCSLL')
      },
      totais: {
        vTotTribFed: vNum(totTrib, 'vTotTribFed'),
        vTotTribEst: vNum(totTrib, 'vTotTribEst'),
        vTotTribMun: vNum(totTrib, 'vTotTribMun'),
        pTotTribFed: vNum(totTrib, 'pTotTribFed'),
        pTotTribEst: vNum(totTrib, 'pTotTribEst'),
        pTotTribMun: vNum(totTrib, 'pTotTribMun'),
        pTotTribSN: vNum(totTrib, 'pTotTribSN'),
        indTotTrib: vStr(totTrib, 'indTotTrib')
      }
    },

    ibscbs: {
      CST: vStr(ibscbs, 'CST'),
      cClassTrib: vStr(ibscbs, 'cClassTrib'),
      cCredPres: vStr(ibscbs, 'cCredPres'),
      CSTReg: vStr(ibscbs, 'CSTReg'),
      cClassTribReg: vStr(ibscbs, 'cClassTribReg'),
      pDifUF: vNum(ibscbs, 'pDifUF'),
      pDifMun: vNum(ibscbs, 'pDifMun'),
      pDifCBS: vNum(ibscbs, 'pDifCBS'),
      indFinal: vStr(dps, 'indFinal') || vStr(ibscbs, 'indFinal'),
      cIndOp: vStr(dps, 'cIndOp') || vStr(ibscbs, 'cIndOp'),
      indZFMALC: vStr(dps, 'indZFMALC') || vStr(ibscbs, 'indZFMALC'),
      tpOper: vStr(dps, 'tpOper') || vStr(ibscbs, 'tpOper'),
      tpEnteGov: vStr(dps, 'tpEnteGov') || vStr(ibscbs, 'tpEnteGov')
    },

    comercioExterior: {
      mecAFComexP: vStr(comExt, 'mecAFComexP'),
      mecAFComexT: vStr(comExt, 'mecAFComexT'),
      movTempBens: vStr(comExt, 'movTempBens'),
      nDI: vStr(comExt, 'nDI'),
      nRE: vStr(comExt, 'nRE'),
      mdic: vStr(comExt, 'mdic')
    },

    obra: {
      inscImobFisc: vStr(obra, 'inscImobFisc'),
      cObra: vStr(obra, 'cObra'),
      endereco: parseEnderecoAdn(obra)
    },

    atvEvt: {
      xNome: vStr(atvEvt, 'xNome'),
      dtIni: vStr(atvEvt, 'dtIni'),
      dtFim: vStr(atvEvt, 'dtFim'),
      idAtvEvt: vStr(atvEvt, 'idAtvEvt'),
      endereco: parseEnderecoAdn(atvEvt)
    },

    imovel: {
      inscImobFisc: vStr(imovel, 'inscImobFisc'),
      cCIB: vStr(imovel, 'cCIB'),
      endereco: parseEnderecoAdn(imovel)
    },

    documentosReferenciados: docsRefParsed,

    status: 'Ativa',
    eventos: []
  };
}

async function syncNfsFromAdn() {
  const config = await db.getConfig();
  const ambiente = config.ambiente || 'sandbox';
  const IBGE_MUNICIPIO = config.ibge;
  const adnBaseUrl = AMBIENTES[ambiente]?.adnMun;
  const maxNsu = await db.getMaxNsu();

  console.log(`[ ADN Worker ] Varredura a partir do NSU: ${maxNsu}...`);
  console.log(`[ ADN Worker ] Município: ${config.nome || IBGE_MUNICIPIO} | CNPJ: ${config.cnpj || 'N/A'}`);
  console.log(`[ ADN Worker ] Ambiente: ${ambiente} | URL: ${adnBaseUrl || 'N/A'}`);

  try {
    const agent = loadMunCertAgent();
    const ultNSU = maxNsu;

    const adnUrl = `${adnBaseUrl}/DFe/${ultNSU}`;
    console.log(`[ ADN Worker ] GET ${adnUrl}`);

    const response = await axios({
      method: 'GET',
      url: adnUrl,
      httpsAgent: agent,
      headers: { 'Accept': 'application/json' },
      timeout: 30000
    });

    const payload = response.data;
    const respStatus = payload.StatusProcessamento || payload.cStat || response.status;
    console.log(`[ ADN Worker ] Resposta: status=${respStatus}, HTTP=${response.status}`);
    console.log(`[ ADN Worker ] Payload keys: ${Object.keys(payload).join(', ')}`);

    if (payload.Alertas && payload.Alertas.length) {
      console.log(`[ ADN Worker ] Alertas:`, JSON.stringify(payload.Alertas).substring(0, 300));
    }
    if (payload.Erros && payload.Erros.length) {
      console.log(`[ ADN Worker ] Erros:`, JSON.stringify(payload.Erros).substring(0, 300));
    }

    let docs = [];
    const loteDFe = payload.LoteDFe;
    if (Array.isArray(loteDFe)) {
      docs = loteDFe;
    } else if (loteDFe && typeof loteDFe === 'object') {
      const keys = Object.keys(loteDFe);
      if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
        docs = keys.sort((a, b) => Number(a) - Number(b)).map(k => loteDFe[k]);
      } else {
        docs = loteDFe.resDFe || loteDFe.NFSe || loteDFe.nfse || loteDFe.DFe || [];
      }
    }
    if (docs.length === 0) {
      docs = payload.resDFe || payload.docsFiscais || payload.nfse || payload.documentos || [];
    }

    console.log(`[ ADN Worker ] Documentos encontrados: ${docs.length}`);
    if (docs.length > 0) {
      const sample = docs[0];
      console.log(`[ ADN Worker ] Exemplo doc[0] keys: ${Object.keys(sample || {}).join(', ')}`);
    }

    if (!Array.isArray(docs) || docs.length === 0) {
      console.log('[ ADN Worker ] Nenhum documento novo retornado pela ADN.');
      return { maxNsu, novaNotas: 0, fonte: 'ADN', resposta: respStatus };
    }

    console.log(`[ ADN Worker ] ${docs.length} documentos recebidos. Processando...`);

    let numNotasSalvas = 0;
    let numErros = 0;
    const { chaves: existingChaves, nsus: existingNsus } = await db.existingChavesAndNsus();
    let maxNsuRecebido = maxNsu;

    for (const doc of docs) {
      try {
        let nota = null;
        if (doc.ArquivoXml) {
          const xmlStr = decodeArquivoXml(doc.ArquivoXml);
          nota = parseNfseXml(xmlStr, doc);
        } else {
          nota = parseNfseFromAdn(doc, IBGE_MUNICIPIO);
        }

        if (!nota || !nota.chaveAcesso) { numErros++; continue; }
        if (existingChaves.has(nota.chaveAcesso) || existingNsus.has(nota.nsu)) continue;

        await db.insertNota(nota);
        existingChaves.add(nota.chaveAcesso);
        existingNsus.add(nota.nsu);
        numNotasSalvas++;

        const docNsu = Number(doc.NSU || nota.nsu || 0);
        if (docNsu > maxNsuRecebido) maxNsuRecebido = docNsu;
      } catch (parseErr) {
        numErros++;
        console.warn(`[ ADN Worker ] Erro ao processar doc NSU=${doc.NSU}:`, parseErr.message);
      }
    }

    if (numErros > 0) {
      console.log(`[ ADN Worker ] ${numErros} documentos não puderam ser processados.`);
    }

    await db.updateMaxNsu(maxNsuRecebido);

    console.log(`[ ADN Worker ] ${numNotasSalvas} notas novas salvas via ADN real. maxNSU: ${maxNsuRecebido}`);
    return { maxNsu: maxNsuRecebido, novaNotas: numNotasSalvas, fonte: 'ADN' };

  } catch (error) {
    const status = error.response?.status;
    const respData = error.response?.data;
    const msg = respData?.xMotivo || respData?.error || respData?.message || error.message;
    console.warn(`[ ADN Worker ] API ADN indisponível (${status || 'timeout'}): ${msg}`);
    if (respData) console.warn(`[ ADN Worker ] Resposta completa:`, JSON.stringify(respData).substring(0, 500));
    console.log('[ ADN Worker ] Nenhuma nota importada nesta tentativa.');
    const currentMax = await db.getMaxNsu();
    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: `HTTP ${status || '?'}: ${msg}` };
  }
}

// ==========================================
// MÓDULO 2: Motor de Apuração
// ==========================================

async function gerarApuracaoMensal(competenciaDesejada) {
  const config = await db.getConfig();
  const IBGE_MUNICIPIO = config.ibge;

  await db.deleteApuracoesByCompetenciaAndStatus(competenciaDesejada, 'Aberta');

  const todasNotas = await db.getNotas({ cLocIncid: IBGE_MUNICIPIO });
  const compNorm = competenciaDesejada.substring(0, 7);
  const notasValidas = todasNotas.filter(
    n => {
      const dComp = (n.dadosGerais?.dCompet || n.competencia || '').substring(0, 7);
      const loc = n.dadosGerais?.cLocIncid || n.servico?.cLocPrestacao || '';
      return dComp === compNorm && loc === IBGE_MUNICIPIO && n.status === 'Ativa';
    }
  );

  let consolidadoPorCnpj = {};
  notasValidas.forEach(nota => {
    const vServ = nota.valores?.vServ ?? nota.valorServico ?? 0;
    const pAliq = nota.tributos?.issqn?.pAliq ?? nota.aliquota ?? 0;
    const retido = nota.tributos?.issqn?.tpRetISSQN === '2' || nota.tributos?.issqn?.tpRetISSQN === '3' || nota.issRetidoFonte === true;
    const impostoDaNota = vServ * pAliq;
    let cnpjDevedor = retido
      ? (nota.tomador?.CNPJ || nota.tomador?.cnpj || '')
      : (nota.prestador?.CNPJ || nota.prestador?.cnpj || '');

    if (!consolidadoPorCnpj[cnpjDevedor]) {
      consolidadoPorCnpj[cnpjDevedor] = {
        id: 'APU-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        cnpj: cnpjDevedor,
        competencia: competenciaDesejada,
        totalNotasEmitidas: 0,
        totalIssProprio: 0,
        totalIssTerceiros: 0,
        status: 'Aberta'
      };
    }

    consolidadoPorCnpj[cnpjDevedor].totalNotasEmitidas++;
    if (retido) consolidadoPorCnpj[cnpjDevedor].totalIssTerceiros += impostoDaNota;
    else consolidadoPorCnpj[cnpjDevedor].totalIssProprio += impostoDaNota;
  });

  const lotesFechados = Object.values(consolidadoPorCnpj);
  for (const apu of lotesFechados) await db.upsertApuracao(apu);
  return lotesFechados;
}

// ==========================================
// MÓDULO 3: Autenticação e Segurança
// ==========================================

const AMBIENTES = {
  sandbox: {
    sefin: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
    adn:   'https://adn.producaorestrita.nfse.gov.br/contribuintes',
    adnMun:'https://adn.producaorestrita.nfse.gov.br/municipios',
  },
  production: {
    sefin: 'https://sefin.nfse.gov.br/SefinNacional',
    adn:   'https://adn.nfse.gov.br/contribuintes',
    adnMun:'https://adn.nfse.gov.br/municipios',
  },
};

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ==========================================
// ROTAS: Autenticação
// ==========================================

app.post('/api/auth/login', rateLimit(60000, 10), async (req, res) => {
  const { cpf, password } = req.body;
  if (!cpf || !password) return res.status(400).json({ error: 'CPF e senha são obrigatórios' });

  const user = await db.getUserByCpf(cpf);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { cpf: user.cpf, role: user.role, name: user.name, cnpj: user.cnpjVinculado, userType: user.userType },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      cpf: user.cpf,
      name: user.name,
      role: user.role,
      cnpj: user.cnpjVinculado,
      authLevel: user.authLevel,
      userType: user.userType
    }
  });
});

app.post('/api/auth/login-cert', rateLimit(60000, 10), async (req, res) => {
  const { certificateB64, subject, cnpj } = req.body;
  if (!certificateB64 || !subject) {
    return res.status(400).json({ error: 'Dados do certificado são obrigatórios' });
  }
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ válido não encontrado no certificado' });
  }

  const users = await db.getUsers({ userType: 'contribuinte' });
  const user = users.find(u =>
    u.cnpjVinculado?.replace(/\D/g, '') === cleanCnpj &&
    u.authLevel === 'CERTIFICADO_A1_A3'
  );

  if (!user) {
    return res.status(401).json({ error: `Nenhum usuário com nível Certificado Digital vinculado ao CNPJ ${cleanCnpj}` });
  }

  const token = jwt.sign(
    { cpf: user.cpf, role: user.role, name: user.name, cnpj: user.cnpjVinculado, userType: user.userType, authMethod: 'certificate' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      cpf: user.cpf,
      name: user.name,
      role: user.role,
      cnpj: user.cnpjVinculado,
      authLevel: 'CERTIFICADO_A1_A3',
      userType: user.userType
    }
  });
});

// ==========================================
// ROTAS: Proxy para Sefin / ADN
// ==========================================

app.use('/api/proxy/:env/:api/*restOfPath', async (req, res) => {
  const { env, api } = req.params;
  const restOfPath = Array.isArray(req.params.restOfPath) ? req.params.restOfPath.join('/') : req.params.restOfPath;

  if (!AMBIENTES[env] || !AMBIENTES[env][api]) return res.status(400).json({ error: 'Ambiente ou API inválidos' });

  const targetUrl = `${AMBIENTES[env][api]}/${restOfPath}`;

  try {
    const agent = loadCertAgent();
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers['accept'] || 'application/json'
      },
      data: req.method !== 'GET' ? req.body : undefined,
      httpsAgent: agent,
      responseType: req.headers['accept'] === 'application/pdf' ? 'arraybuffer' : 'json'
    });

    if (req.headers['accept'] === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(response.data);
    }
    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).send(error.response?.data || { error: error.message });
  }
});

// ==========================================
// ROTAS: Dashboard Stats
// ==========================================

app.get('/api/dashboard/stats', async (req, res) => {
  const cnpj = req.query.cnpj;
  const notas = await db.getNotas(cnpj ? { cnpj: cnpj.replace(/\D/g, '') } : {});

  const getEmis = n => n.dadosGerais?.dhEmi || n.dataEmis || '';
  res.json({
    emitidas: notas.filter(n => n.status === 'Ativa').length,
    aprovadas: notas.filter(n => n.status === 'Ativa').length,
    pendentes: 0,
    canceladas: notas.filter(n => n.status === 'Cancelada').length,
    recentes: [...notas].sort((a, b) => new Date(getEmis(b)) - new Date(getEmis(a))).slice(0, 5)
  });
});

// ==========================================
// ROTAS: Health Check (real ping)
// ==========================================

app.get('/api/health', async (req, res) => {
  const checkEndpoint = async (url) => {
    const start = Date.now();
    try {
      await axios.head(url, { timeout: 5000, httpsAgent: loadCertAgent() });
      return { status: 'online', latency: `${Date.now() - start}ms` };
    } catch {
      return { status: 'offline', latency: `${Date.now() - start}ms` };
    }
  };

  const env = 'sandbox';
  const [sefin, adn] = await Promise.all([
    checkEndpoint(AMBIENTES[env].sefin),
    checkEndpoint(AMBIENTES[env].adn)
  ]);

  let dbStatus = 'offline';
  try {
    dbStatus = (await db.ping()) ? 'online' : 'offline';
  } catch (_) {}

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: env,
    services: { sefin, adn, database: { status: dbStatus } }
  });
});

// ==========================================
// ROTAS: Gestão de Usuários (CRUD)
// ==========================================

app.get('/api/users', async (req, res) => {
  const filter = req.query.type ? { userType: req.query.type } : {};
  const users = await db.getUsers(filter);

  res.json(users.map(u => ({
    cpf: u.cpf,
    name: u.name,
    role: u.role,
    authLevel: u.authLevel,
    cnpjVinculado: u.cnpjVinculado,
    userType: u.userType || 'contribuinte',
    status: u.status || 'Ativo'
  })));
});

app.post('/api/users', rateLimit(60000, 20), async (req, res) => {
  const { cpf, name, role, password, authLevel, cnpjVinculado, userType } = req.body;

  if (!cpf || !name || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios: cpf, name, role' });
  }

  const existing = await db.getUserByCpf(cpf);
  if (existing) {
    return res.status(409).json({ error: 'Usuário com este CPF já existe' });
  }

  await db.insertUser({
    cpf,
    name,
    role,
    authLevel: authLevel || 'GOVBR_OURO',
    cnpjVinculado: cnpjVinculado || '',
    userType: userType || 'contribuinte',
    passwordHash: password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync('12345678', 10),
    status: 'Ativo'
  });
  res.status(201).json({ sucesso: true });
});

app.put('/api/users/:cpf', async (req, res) => {
  const existing = await db.getUserByCpf(req.params.cpf);
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { name, role, authLevel, status } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (authLevel !== undefined) updates.authLevel = authLevel;
  if (status !== undefined) updates.status = status;

  await db.updateUser(req.params.cpf, updates);
  res.json({ sucesso: true });
});

app.delete('/api/users/:cpf', async (req, res) => {
  const existing = await db.getUserByCpf(req.params.cpf);
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
  await db.deleteUser(req.params.cpf);
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Município — Notas Importadas
// ==========================================

app.get('/api/municipio/notas', async (req, res) => {
  const notas = await db.getNotas();
  res.json({ sucesso: true, notas });
});

// ==========================================
// ROTAS: Município — Apurações e Guias
// ==========================================

app.get('/api/municipio/apuracoes/:cnpj', async (req, res) => {
  const apuracoes = await db.getApuracoesByCnpj(req.params.cnpj);
  res.json({ sucesso: true, apuracoes });
});

app.post('/api/municipio/gerar-guia/:id', async (req, res) => {
  const apu = await db.getApuracaoById(req.params.id);
  if (!apu) return res.status(404).json({ error: 'Apuração não encontrada' });

  const valorTotal = (apu.totalIssProprio || 0) + (apu.totalIssTerceiros || 0);
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 15);

  const guia = {
    pixPayload: `00020126580014br.gov.bcb.pix0136${apu.id}5204000053039865404${valorTotal.toFixed(2)}5802BR`,
    dataVencimento: vencimento.toISOString().slice(0, 10),
    valor: valorTotal
  };

  await db.updateApuracao(req.params.id, { guia, status: 'Guia Emitida' });
  res.json({ sucesso: true, guia });
});

app.post('/api/municipio/pagar-guia/:id', async (req, res) => {
  const apu = await db.getApuracaoById(req.params.id);
  if (!apu) return res.status(404).json({ error: 'Apuração não encontrada' });

  await db.updateApuracao(req.params.id, { status: 'Paga', dataPagamento: new Date().toISOString() });
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Contribuinte — Minhas Notas
// ==========================================

app.get('/api/notes', async (req, res) => {
  const cnpj = req.query.cnpj;
  if (!cnpj) return res.json([]);

  const rawNotas = await db.getNotas({ cnpj: cnpj.replace(/\D/g, '') });
  const notas = rawNotas.map(n => ({
    chaveAcesso: n.chaveAcesso,
    dhEmit: n.dadosGerais?.dhEmi || n.dataEmis || '',
    tomador: { cnpj: n.tomador?.CNPJ || n.tomador?.cnpj || '', nome: n.tomador?.xNome || n.tomador?.nome || '' },
    prestador: { cnpj: n.prestador?.CNPJ || n.prestador?.cnpj || '', nome: n.prestador?.xNome || n.prestador?.nome || '' },
    valorServico: n.valores?.vServ ?? n.valorServico ?? 0,
    valorIBSCBS: 0,
    status: n.status
  }));

  res.json(notas);
});

// ==========================================
// ROTAS: Configurações do Município
// ==========================================

app.get('/api/municipio/config', async (req, res) => {
  const config = await db.getConfig();
  res.json(config || {});
});

app.put('/api/municipio/config', async (req, res) => {
  const allowed = [
    'ibge', 'nome', 'uf', 'cnpj', 'inscEstadual', 'endereco', 'email', 'telefone', 'ambiente',
    'certSubject', 'certSerialNumber', 'certNotBefore', 'certNotAfter',
    'certLoadedAt', 'certFileName', 'certKeyAlgorithm', 'certIssuer'
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = key === 'cnpj' ? (req.body[key] || '').replace(/\D/g, '') : req.body[key];
    }
  }
  await db.updateConfig(updates);
  const config = await db.getConfig();
  res.json({ sucesso: true, config });
});

const MUN_CERT_PATH = './data/municipio-cert.pfx';
const MUN_KEY_PEM_PATH = './data/municipio-key.pem';
const MUN_CERT_PEM_PATH = './data/municipio-cert.pem';
let _munCertPassphrase = '';

function convertPfxToPem(pfxBuffer, passphrase) {
  const binaryStr = pfxBuffer.toString('binary');
  const pfxDer = forge.util.createBuffer(binaryStr, 'raw');
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, passphrase);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });

  const keyList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certList = certBags[forge.pki.oids.certBag] || [];

  if (keyList.length === 0 || certList.length === 0) {
    throw new Error('Chave privada ou certificado não encontrados no PFX.');
  }

  const keyPem = forge.pki.privateKeyToPem(keyList[0].key);

  let fullChainPem = '';
  for (const bag of certList) {
    fullChainPem += forge.pki.certificateToPem(bag.cert);
  }

  return { keyPem, certPem: fullChainPem };
}

(async () => {
  try {
    const config = await db.getConfig();
    if (config?.certPassphrase) {
      _munCertPassphrase = Buffer.from(config.certPassphrase, 'base64').toString('utf-8');
      if (fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH)) {
        console.log('[ Cert ] PEM do certificado municipal encontrado. Passphrase restaurada.');
      } else if (fsSync.existsSync(MUN_CERT_PATH)) {
        try {
          const pfxBuf = fsSync.readFileSync(MUN_CERT_PATH);
          const { keyPem, certPem } = convertPfxToPem(pfxBuf, _munCertPassphrase);
          fsSync.writeFileSync(MUN_KEY_PEM_PATH, keyPem);
          fsSync.writeFileSync(MUN_CERT_PEM_PATH, certPem);
          console.log('[ Cert ] PFX convertido para PEM com sucesso na inicialização.');
        } catch (convErr) {
          console.warn('[ Cert ] Falha ao converter PFX → PEM na inicialização:', convErr.message);
        }
      }
    }
  } catch (_) { /* db ainda não existe na primeira inicialização */ }
})();

app.post('/api/municipio/upload-cert', express.raw({ type: 'application/octet-stream', limit: '5mb' }), async (req, res) => {
  try {
    const passphrase = req.headers['x-cert-passphrase'] || '';
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'Arquivo do certificado não recebido.' });
    }
    await ensureDataDir();

    const { keyPem, certPem } = convertPfxToPem(Buffer.from(req.body), passphrase);

    await fs.writeFile(MUN_CERT_PATH, req.body);
    await fs.writeFile(MUN_KEY_PEM_PATH, keyPem);
    await fs.writeFile(MUN_CERT_PEM_PATH, certPem);

    _munCertPassphrase = passphrase;

    await db.updateConfig({ certPassphrase: Buffer.from(passphrase).toString('base64') });

    console.log(`[ Cert ] Certificado convertido PFX→PEM e salvo (${req.body.length} bytes).`);
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[ Cert ] Falha no upload/conversão:', err.message);
    res.status(500).json({ error: `Falha ao processar certificado: ${err.message}` });
  }
});

function loadMunCertAgent() {
  if (fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH)) {
    try {
      const agent = new https.Agent({
        key: fsSync.readFileSync(MUN_KEY_PEM_PATH),
        cert: fsSync.readFileSync(MUN_CERT_PEM_PATH),
        rejectUnauthorized: false
      });
      return agent;
    } catch (err) {
      console.warn('[ Cert ] Falha ao carregar PEM municipal:', err.message);
    }
  }

  if (fsSync.existsSync(MUN_CERT_PATH)) {
    const pass = _munCertPassphrase || CERT_PASSPHRASE;
    try {
      const pfxBuf = fsSync.readFileSync(MUN_CERT_PATH);
      const { keyPem, certPem } = convertPfxToPem(pfxBuf, pass);
      fsSync.writeFileSync(MUN_KEY_PEM_PATH, keyPem);
      fsSync.writeFileSync(MUN_CERT_PEM_PATH, certPem);
      console.log('[ Cert ] PFX convertido para PEM on-the-fly.');
      return new https.Agent({ key: keyPem, cert: certPem, rejectUnauthorized: false });
    } catch (err) {
      console.warn('[ Cert ] Falha ao converter PFX → PEM:', err.message);
    }
  }

  console.warn('[ Cert ] Certificado municipal não encontrado.');
  return loadCertAgent();
}

// ==========================================
// ROTAS: Admin — Ações Forçadas
// ==========================================

app.post('/api/admin/force-sync', async (req, res) => {
  const result = await syncNfsFromAdn();
  res.json({ sucesso: true, ...result });
});

app.post('/api/admin/force-apuracao', async (req, res) => {
  const comp = req.body.competencia || '2026-03';
  const resultados = await gerarApuracaoMensal(comp);
  res.json({ sucesso: true, qdtGuias: resultados.length, resultados });
});

// ==========================================
// Startup
// ==========================================

app.listen(PORT, () => {
  console.log(`[ Antigravity ] Backend ativo na porta ${PORT} (${NODE_ENV})`);
});
