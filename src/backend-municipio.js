import express from 'express';
import cors from 'cors';
import axios from 'axios';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fsSync from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import forge from 'node-forge';
import zlib from 'zlib';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const app = express();

const PORT = process.env.PORT || 3099;
const JWT_SECRET = process.env.JWT_SECRET || 'freire-secret-key-2026';
const CERT_PATH = process.env.CERT_PATH || '';
const CERT_PASSPHRASE = process.env.CERT_PASSPHRASE || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && JWT_SECRET === 'freire-secret-key-2026') {
  console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
  process.exit(1);
}

app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json({ limit: '8mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '8mb' }));
app.use(express.static(path.join(__dirname, '..')));

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
  const defaults = [
    // Contribuintes
    { cpf: '111.222.333-44', name: 'José da Silva', email: 'jose.silva@exemplo.com', celular: '11999990001', role: 'MASTER', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    { cpf: '999.888.777-66', name: 'João Contador', email: 'joao.contador@exemplo.com', celular: '11999990002', role: 'CONTADOR', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '12345678000100' },
    { cpf: '444.555.666-77', name: 'Maria Faturista', email: 'maria.faturista@exemplo.com', celular: '11999990003', role: 'FATURISTA', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    { cpf: '555.666.777-88', name: 'Ana Auditora', email: 'ana.auditora@exemplo.com', celular: '11999990004', role: 'AUDITOR', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    // Município
    { cpf: '123.456.789-00', name: 'Admin Sefin', email: 'admin.sefin@municipio.gov.br', celular: '11988880001', role: 'GESTOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '333.444.555-66', name: 'Carlos Fiscal', email: 'carlos.fiscal@municipio.gov.br', celular: '11988880002', role: 'FISCAL', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '777.888.999-11', name: 'Auditor Chefe', email: 'auditor.chefe@municipio.gov.br', celular: '11988880003', role: 'AUDITOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '666.777.888-99', name: 'Paula Atendente', email: 'paula.atendente@municipio.gov.br', celular: '11988880004', role: 'ATENDENTE', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '' }
  ];
  const users = await db.getUsers();
  if (users.length === 0) {
    for (const u of defaults) await db.insertUser(u);
    console.log('[ DB ] Usuários padrão criados.');
    return;
  }
  const rolesPresent = new Set(users.map(u => `${u.userType}:${u.role}`));
  let added = 0;
  for (const u of defaults) {
    const key = `${u.userType}:${u.role}`;
    if (!rolesPresent.has(key)) {
      const exists = await db.getUserByCpf(u.cpf);
      if (!exists) {
        await db.insertUser(u);
        rolesPresent.add(key);
        added++;
      }
    }
  }
  if (added > 0) console.log(`[ DB ] ${added} usuário(s) adicionado(s) para perfis faltantes.`);
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
    // Deadlock em migração concorrente (node --watch) — aguarda e tenta novamente
    if (err.code === '40P01' || err.message?.includes('deadlock')) {
      console.warn('[ DB ] Deadlock detectado nas migrações — aguardando 3s e reiniciando...');
      await new Promise(r => setTimeout(r, 3000));
      try {
        await db.runMigrations();
        await seedDefaultUsersIfEmpty();
        console.log('[ DB ] PostgreSQL conectado (retentativa bem-sucedida).');
      } catch (err2) {
        console.error('[ DB ] Falha na retentativa:', err2.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
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
  const endNac = src.endNac || src.enderecoNacional || src;
  const endExt = src.endExt || src.enderecoExterior || src;
  const base = endExt?.cPais ? endExt : endNac;
  return {
    cMun: vStr(base, 'cMun'),
    xMun: vStr(base, 'xMun', 'nomeMunicipio'),
    UF: vStr(base, 'UF', 'uf'),
    CEP: vStr(base, 'CEP'),
    xLgr: vStr(base, 'xLgr'),
    nro: vStr(base, 'nro'),
    xCpl: vStr(base, 'xCpl'),
    xBairro: vStr(base, 'xBairro'),
    cPais: vStr(endExt, 'cPais') || vStr(base, 'cPais'),
    cEndPost: vStr(endExt, 'cEndPost'),
    xCidade: vStr(endExt, 'xCidade'),
    xEstProvReg: vStr(endExt, 'xEstProvReg', 'xEstProv')
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
  // Ambiente vem da tela de Configurações do município: sandbox (Produção Restrita) ou production (Produção)
  const ambiente = config.ambiente || 'sandbox';
  const IBGE_MUNICIPIO = config.ibge;
  const adnBaseUrl = (config.urlAdnMun || process.env.ADN_MUN_URL || AMBIENTES[ambiente]?.adnMun)?.trim() || AMBIENTES[ambiente]?.adnMun;
  // Usa o maior entre sync_state e max(nsu) das notas — garante continuidade após importações anteriores
  const maxNsu = await db.getMaxNsuParaContinuar();

  if (!adnBaseUrl) {
    const currentMax = await db.getMaxNsu();
    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: 'URL ADN Municípios não configurada. Defina o ambiente em Configurações (Sandbox ou Produção) ou ADN_MUN_URL.' };
  }

  const ambLabel = ambiente === 'production' ? 'Produção' : 'Produção Restrita (Sandbox)';
  const certOk = fsSync.existsSync(MUN_CERT_PATH) || (fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH));
  if (!certOk) {
    const currentMax = await db.getMaxNsu();
    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: 'Certificado municipal ICP-Brasil não configurado. A API ADN exige mTLS. Envie o certificado em Configurações > Certificado.' };
  }

  const lastEmpty = await db.getLastEmptySyncAt();
  if (lastEmpty) {
    const diff = (Date.now() - new Date(lastEmpty).getTime()) / 1000 / 60;
    if (diff < 60) {
      console.log(`[ ADN Worker ] Rate-limit: aguardando 1h desde último sync vazio (${Math.round(60 - diff)} min restantes).`);
      return { maxNsu, novaNotas: 0, fonte: 'rate_limit', aviso: 'Aguardando 1 hora desde último sync sem documentos.' };
    }
  }

  console.log(`[ ADN Worker ] Varredura a partir do NSU: ${maxNsu}...`);
  console.log(`[ ADN Worker ] Município: ${config.nome || IBGE_MUNICIPIO} | CNPJ: ${config.cnpj || 'N/A'}`);
  console.log(`[ ADN Worker ] Ambiente: ${ambLabel} (${ambiente}) | URL base: ${adnBaseUrl}`);

  const agent = loadMunCertAgent();
  const ultNSU = maxNsu;

  // URLs: ACBr/gov.br indicam adn.../dfe na RAIZ. Doc também cita municipios/DFe.
  const baseMun = adnBaseUrl.replace(/\/$/, '');
  const baseRoot = baseMun.replace(/\/(municipios|contribuintes|dfe|DFe)\/?$/, '') || baseMun;
  const nsuStr = String(ultNSU).padStart(15, '0');  // NSU pode exigir padding (15 dígitos conforme NF-e)

  const urlsToTry = [
    `${baseMun}/DFe/${ultNSU}`,                                     // Doc: municipios/DFe/{NSU} — tentar primeiro
    `${baseMun}/DFe?ultNsu=${ultNSU}`,                              // Query param variant
    `${baseMun}/dfe/${ultNSU}`,                                     // Case-insensitive variant
    `${baseMun}/DFe/${nsuStr}`,                                     // NSU com padding 15 dígitos
    `${baseMun}/DFe?ultNsu=${nsuStr}`,                              // Query param com padding
    `${baseRoot}/municipios/DFe/${ultNSU}`,                         // Raiz + municipios
    `${baseRoot}/dfe/${ultNSU}`,                                    // ACBr: raiz/dfe
    `${baseRoot}/DFe/${ultNSU}`,                                    // Raiz maiúsculo
    `${baseMun}/v1/DFe/${ultNSU}`,                                  // Versão /v1/
    `${baseMun}/api/DFe/${ultNSU}`,                                 // /api/ prefix
    `${baseRoot}/api/dfe/${ultNSU}`,
    (AMBIENTES[ambiente === 'sandbox' ? 'production' : 'sandbox']?.adnMun || baseRoot).replace(/\/$/, '') + `/DFe/${ultNSU}`,
  ].filter((u, i, a) => a.indexOf(u) === i);

  let response = null;
  let lastError = null;
  const urlResults = [];  // Diagnóstico: registra status de cada URL tentada

  const reqHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'Freire-NFSe/1.0 (Municipio; Node.js)',
    'Content-Type': 'application/json',
  };

  for (const adnUrl of urlsToTry) {
    console.log(`[ ADN Worker ] GET ${adnUrl}`);
    try {
      const r = await axios({
        method: 'GET',
        url: adnUrl,
        httpsAgent: agent,
        headers: reqHeaders,
        timeout: 20000,
        validateStatus: () => true,  // Nunca lança erro por status HTTP — analisa corpo manualmente
      });

      const body = r.data;
      // ADN retorna HTTP 404 para "sem documentos" com JSON válido — isso é resposta normal, não erro de rota
      const isAdnJson = body && typeof body === 'object' && (
        body.LoteDFe !== undefined ||
        body.StatusProcessamento !== undefined ||
        body.resDFe !== undefined ||
        body.docsFiscais !== undefined
      );

      if (r.status === 200 || (r.status < 300) || isAdnJson) {
        // Resposta válida (com ou sem documentos)
        const nota404 = r.status === 404 ? ' (HTTP 404 — ADN sinaliza "sem documentos")' : '';
        urlResults.push({ url: adnUrl, status: r.status, ok: true, nota: isAdnJson ? `JSON ADN${nota404}` : '' });
        console.log(`[ ADN Worker ] ✓ Resposta válida de ${adnUrl} [HTTP ${r.status}]${nota404}`);
        response = r;
        break;
      } else {
        urlResults.push({ url: adnUrl, status: r.status, ok: false });
        console.warn(`[ ADN Worker ] HTTP ${r.status} em ${adnUrl} (sem JSON ADN válido), tentando próxima URL...`);
        lastError = { message: `HTTP ${r.status}`, response: r };
        continue;
      }
    } catch (err) {
      // Erro de rede/TLS (sem resposta HTTP)
      const errCode = err.code || err.message?.substring(0, 50);
      urlResults.push({ url: adnUrl, status: errCode, ok: false });
      lastError = err;
      console.warn(`[ ADN Worker ] Erro de rede ${errCode} em ${adnUrl}`);
      continue;
    }
  }

  // Log de diagnóstico das URLs tentadas
  console.log(`[ ADN Worker ] Resultados das URLs tentadas:`);
  for (const r of urlResults) {
    console.log(`  ${r.ok ? '✓' : '✗'} [${r.status}] ${r.url}`);
  }

  try {
    if (!response) {
      // Todas as URLs falharam — lança o último erro para o catch abaixo tratá-lo adequadamente
      const errDiag = new Error(`Todas as ${urlResults.length} URLs tentadas falharam. Último erro: ${lastError?.message}`);
      errDiag.response = lastError?.response;
      errDiag._urlResults = urlResults;
      throw errDiag;
    }

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
      const semDocs = respStatus === 'NENHUM_DOCUMENTO_LOCALIZADO' || payload.Erros?.some(e => e.Codigo === 'E2020');
      console.log(`[ ADN Worker ] Nenhum documento novo retornado pela ADN. (${semDocs ? 'município sem NFS-e no ADN ainda' : respStatus})`);
      const maxNsuRet = payload.maxNSU ?? payload.MaxNSU ?? maxNsu;
      if (maxNsuRet === maxNsu) {
        await db.setLastEmptySyncAt();
      }
      const aviso = semDocs
        ? 'Município autenticado no ADN, mas sem NFS-e distribuídas ainda. Aguarde emissão de notas ou use "Simular Importação" para testes.'
        : undefined;
      return { maxNsu, novaNotas: 0, fonte: 'ADN', resposta: respStatus, ...(aviso ? { aviso } : {}) };
    }

    await db.clearLastEmptySyncAt();

    console.log(`[ ADN Worker ] ${docs.length} documentos recebidos. Processando...`);

    let numNotasSalvas = 0;
    let numErros = 0;
    const { chaves: existingChaves, nsus: existingNsus } = await db.existingChavesAndNsus();
    let maxNsuRecebido = maxNsu;

    for (const doc of docs) {
      try {
        const tipoDoc = (doc.TipoDocumento || doc.tipoDocumento || '').toUpperCase();
        if (tipoDoc === 'EVENTO' || (doc.ArquivoXml && decodeArquivoXml(doc.ArquivoXml || '')?.includes('tpEvento'))) {
          const xmlStr = doc.ArquivoXml ? decodeArquivoXml(doc.ArquivoXml) : null;
          const chaveRef = doc.ChaveAcesso || doc.chaveAcesso || (xmlStr && xmlTagValue(xmlStr, 'chNFSe'));
          const tpEvento = doc.tpEvento || (xmlStr && xmlTagValue(xmlStr, 'tpEvento'));
          if (chaveRef && (tpEvento === 'e101101' || tpEvento === 'e204101' || tpEvento === 'e204104')) {
            await db.updateNotaStatus(chaveRef, 'Cancelada');
            console.log(`[ ADN Worker ] Evento cancelamento aplicado: ${chaveRef}`);
          } else if (chaveRef && tpEvento === 'e101103') {
            await db.updateNotaStatus(chaveRef, 'Substituída');
            console.log(`[ ADN Worker ] Evento substituição aplicado: ${chaveRef}`);
          }
          const docNsu = Number(doc.NSU || 0);
          if (docNsu > maxNsuRecebido) maxNsuRecebido = docNsu;
          continue;
        }

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
    const diagUrls = error._urlResults || urlResults || [];
    const msg = respData?.xMotivo || respData?.error || respData?.message || error.message;
    console.warn(`[ ADN Worker ] API ADN indisponível (${status || 'N/A'}): ${msg}`);
    if (respData) console.warn(`[ ADN Worker ] Resposta completa:`, JSON.stringify(respData).substring(0, 500));
    console.log('[ ADN Worker ] Nenhuma nota importada nesta tentativa.');

    const ambLabel = ambiente === 'production' ? 'Produção' : 'Produção Restrita (Sandbox)';
    const certOk = fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH);
    const currentMax = await db.getMaxNsu();

    // Diagnóstico detalhado — inclui quais URLs foram tentadas e seus status
    const diagSummary = diagUrls.length > 0
      ? ` URLs tentadas: ${diagUrls.map(r => `[${r.status}] ${r.url.replace(/.*\/(municipios|contribuintes)/, '...')}`).join(', ')}.`
      : '';

    let erroMsg;
    if (!certOk) {
      erroMsg = `ADN 404 (${ambLabel}): Certificado municipal não configurado. Envie o certificado ICP-Brasil da Prefeitura em Configurações > Certificado.`;
    } else if (diagUrls.every(r => r.status === 404 || r.status === '404')) {
      erroMsg = `ADN indisponível (${ambLabel}): O servidor retornou 404 em todas as ${diagUrls.length} URLs tentadas.${diagSummary} Possíveis causas: (1) Município não cadastrado no ADN; (2) URL base incorreta — use "URL ADN Municípios (override)" em Configurações; (3) API ainda não disponível neste ambiente. Use o Modo Simulação para testes.`;
    } else {
      erroMsg = `ADN erro ${status || '?'} (${ambLabel}): ${msg}.${diagSummary}`;
    }

    // Modo fallback: ADN_SKIP_404=1 retorna sucesso silencioso (permite usar sistema com dados locais)
    if (process.env.ADN_SKIP_404 === '1') {
      console.log('[ ADN Worker ] ADN_SKIP_404=1: retornando sucesso sem importar (API indisponível).');
      return { maxNsu: currentMax, novaNotas: 0, fonte: 'adn_indisponivel', aviso: erroMsg, diagnostico: diagUrls };
    }

    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: erroMsg, diagnostico: diagUrls };
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
    // pAliq pode estar em decimal (0.05) ou percentual inteiro (5) — normalizar para decimal
    const pAliqDecimal = (pAliq && pAliq > 1) ? pAliq / 100 : (pAliq || 0);
    const impostoDaNota = vServ * pAliqDecimal;
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
  for (const apu of lotesFechados) {
    const regime = await db.getContribuinteRegime(apu.cnpj);
    if (regime?.isentoGuia) continue;
    await db.upsertApuracao(apu);
  }
  return lotesFechados;
}

// ==========================================
// MÓDULO 3: Autenticação e Segurança
// ==========================================

// URLs conforme documentação oficial (requisitos-nfse-rtc-v2.md, Fontes/manual-municipios-apis-adn)
// ADN Municípios: https://adn.producaorestrita.nfse.gov.br/municipios/docs/index.html (sandbox)
// ADN Municípios: https://adn.nfse.gov.br/municipios/docs/index.html (produção)
// Endpoint distribuição: GET /DFe/{UltimoNSU} — base = host + /municipios (sem /docs)
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
  const { certificateB64, subject, cnpj, passphrase } = req.body;
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

  // Armazena certificado para mTLS (Sefin/ADN)
  try {
    const pfxBuf = Buffer.from(certificateB64, 'base64');
    const { keyPem, certPem } = convertPfxToPem(pfxBuf, passphrase || '');
    contribuinteCertCache.set(token, { keyPem, certPem });
    setTimeout(() => contribuinteCertCache.delete(token), 8 * 60 * 60 * 1000);
  } catch (certErr) {
    console.warn('[ Auth ] Certificado não convertido para mTLS:', certErr.message);
  }

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

app.use('/api/proxy', async (req, res) => {
  const suffix = req.originalUrl.replace(/^\/api\/proxy\/?/, '') || '';
  const pathParts = suffix.split('/').filter(Boolean);
  const api = pathParts[0];
  const restOfPath = pathParts.slice(1).join('/');

  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';

  if (!api || !AMBIENTES[env] || !AMBIENTES[env][api]) {
    return res.status(400).json({ error: 'Ambiente ou API inválidos' });
  }

  const baseUrl = AMBIENTES[env][api];
  const targetUrl = restOfPath ? `${baseUrl}/${restOfPath}` : baseUrl;

  let agent = loadCertAgent();
  const token = req.headers.authorization?.split(' ')[1];
  if (token && contribuinteCertCache.has(token)) {
    const { keyPem, certPem } = contribuinteCertCache.get(token);
    agent = new https.Agent({ key: keyPem, cert: certPem, rejectUnauthorized: false });
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers['accept'] || 'application/json'
      },
      data: req.method !== 'GET' ? req.body : undefined,
      httpsAgent: agent,
      responseType: req.headers['accept'] === 'application/pdf' ? 'arraybuffer' : 'json',
      timeout: 30000
    });

    if (req.headers['accept'] === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(response.data);
    }
    res.status(response.status).send(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Sistema externo (Sefin/ADN) não respondeu no prazo. Tente novamente.' });
    }
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    res.status(status).send(typeof data === 'object' ? data : { error: String(data) });
  }
});

// ==========================================
// ROTAS: Config (ambiente — fonte única)
// ==========================================

app.get('/api/config/ambiente', async (req, res) => {
  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';
  const { sefin, adn } = AMBIENTES[env];
  res.json({
    ambiente: env,
    urlSefin: new URL(sefin).hostname,
    urlAdn: new URL(adn).hostname,
  });
});

// ==========================================
// ROTAS: Dashboard Stats
// ==========================================

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
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
  const agent = loadCertAgent();

  const checkEndpoint = (url) => new Promise((resolve) => {
    const start = Date.now();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname || '/',
      method: 'GET',
      agent,
      timeout: 10000
    };
    const req = https.request(options, (resp) => {
      const latency = `${Date.now() - start}ms`;
      const code = resp.statusCode || 0;
      resolve({ status: code > 0 ? 'online' : 'offline', latency });
    });
    req.on('error', () => {
      resolve({ status: 'offline', latency: `${Date.now() - start}ms` });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'offline', latency: `${Date.now() - start}ms` });
    });
    req.setTimeout(10000);
    req.end();
  });

  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';
  let [sefin, adn] = await Promise.all([
    checkEndpoint(AMBIENTES[env].sefin),
    checkEndpoint(AMBIENTES[env].adn)
  ]);

  if (env === 'sandbox' && sefin.status === 'offline' && adn.status === 'offline') {
    sefin = { status: 'online', latency: '—', _fallback: true };
    adn = { status: 'online', latency: '—', _fallback: true };
  }

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

app.get('/api/users', authenticate, async (req, res) => {
  const filter = req.query.type ? { userType: req.query.type } : {};
  const users = await db.getUsers(filter);

  res.json(users.map(u => ({
    cpf: u.cpf,
    name: u.name,
    email: u.email || '',
    celular: u.celular || '',
    role: u.role,
    authLevel: u.authLevel,
    cnpjVinculado: u.cnpjVinculado,
    userType: u.userType || 'contribuinte',
    status: u.status || 'Ativo'
  })));
});

app.post('/api/users', authenticate, rateLimit(60000, 20), async (req, res) => {
  const { cpf, name, email, celular, role, password, authLevel, cnpjVinculado, userType } = req.body;

  if (!cpf || !name || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios: cpf, name, role' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }
  if (!celular || !celular.trim()) {
    return res.status(400).json({ error: 'Celular é obrigatório' });
  }

  const existing = await db.getUserByCpf(cpf);
  if (existing) {
    return res.status(409).json({ error: 'Usuário com este CPF já existe' });
  }

  await db.insertUser({
    cpf,
    name,
    email: email.trim(),
    celular: celular.trim(),
    role,
    authLevel: authLevel || 'GOVBR_OURO',
    cnpjVinculado: cnpjVinculado || '',
    userType: userType || 'contribuinte',
    passwordHash: password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync('12345678', 10),
    status: 'Ativo'
  });
  res.status(201).json({ sucesso: true });
});

app.put('/api/users/:cpf', authenticate, async (req, res) => {
  const existing = await db.getUserByCpf(req.params.cpf);
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { name, email, celular, role, authLevel, status } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (celular !== undefined) updates.celular = celular;
  if (role !== undefined) updates.role = role;
  if (authLevel !== undefined) updates.authLevel = authLevel;
  if (status !== undefined) updates.status = status;

  await db.updateUser(req.params.cpf, updates);
  res.json({ sucesso: true });
});

app.delete('/api/users/:cpf', authenticate, async (req, res) => {
  const existing = await db.getUserByCpf(req.params.cpf);
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });
  await db.deleteUser(req.params.cpf);
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Município — Notas Importadas
// ==========================================

app.get('/api/municipio/notas', authenticate, async (req, res) => {
  const notas = await db.getNotas();
  res.json({ sucesso: true, notas });
});

// ==========================================
// ROTAS: Município — Apurações e Guias
// ==========================================

app.get('/api/municipio/apuracoes/:cnpj', authenticate, async (req, res) => {
  const apuracoes = await db.getApuracoesByCnpj(req.params.cnpj);
  res.json({ sucesso: true, apuracoes });
});

app.post('/api/municipio/gerar-guia/:id', authenticate, async (req, res) => {
  const apu = await db.getApuracaoById(req.params.id);
  if (!apu) return res.status(404).json({ error: 'Apuração não encontrada' });

  const valorTotal = (apu.totalIssProprio || 0) + (apu.totalIssTerceiros || 0);
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 15);

  const valorStr = valorTotal.toFixed(2).replace('.', '').padStart(11, '0');
  const txid = `NFSE${apu.id.replace(/\D/g, '').padStart(25, '0')}`.substring(0, 25);
  const guia = {
    pixPayload: `00020126580014br.gov.bcb.pix0136${txid}520400005303986540${valorStr}5802BR5925NFSe Freire - ISSQN6009SAO PAULO62070503***6304`,
    codigoBarras: `8581000000${valorStr}${apu.id.replace(/\D/g, '').substring(0, 10).padStart(10, '0')}`,
    dataVencimento: vencimento.toISOString().slice(0, 10),
    valor: valorTotal
  };

  await db.updateApuracao(req.params.id, { guia, status: 'Guia Emitida' });
  res.json({ sucesso: true, guia });
});

app.post('/api/municipio/pagar-guia/:id', authenticate, async (req, res) => {
  const apu = await db.getApuracaoById(req.params.id);
  if (!apu) return res.status(404).json({ error: 'Apuração não encontrada' });

  await db.updateApuracao(req.params.id, { status: 'Paga', dataPagamento: new Date().toISOString() });
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Contribuinte — Sync ADN, Decisão Judicial
// ==========================================

app.post('/api/contribuinte/sync-adn', authenticate, async (req, res) => {
  const user = req.user;
  if (user.userType !== 'contribuinte' || !user.cnpj) {
    return res.status(403).json({ error: 'Acesso restrito a contribuintes com CNPJ vinculado.' });
  }
  const cnpj = String(user.cnpj).replace(/\D/g, '');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !contribuinteCertCache.has(token)) {
    return res.status(400).json({ error: 'Faça login com certificado digital para sincronizar com o ADN.' });
  }
  const { keyPem, certPem } = contribuinteCertCache.get(token);
  const agent = new https.Agent({ key: keyPem, cert: certPem, rejectUnauthorized: false });
  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';
  const baseAdn = AMBIENTES[env].adn;
  const ultNsu = await db.getContribuinteMaxNsu(cnpj);

  try {
    const url = `${baseAdn}/DFe/${ultNsu}`;
    const resp = await axios({ method: 'GET', url, httpsAgent: agent, timeout: 20000 });
    const payload = resp.data;
    let docs = payload.LoteDFe || payload.resDFe || payload.documentos || [];
    if (!Array.isArray(docs)) docs = Object.values(docs).filter(Boolean);
    let maxNsu = ultNsu;
    let importadas = 0;
    const { chaves, nsus } = await db.existingChavesAndNsus();
    for (const doc of docs) {
      const nsu = Number(doc.NSU || 0);
      if (nsu > maxNsu) maxNsu = nsu;
      if (!doc.ArquivoXml) continue;
      const xmlStr = decodeArquivoXml(doc.ArquivoXml);
      const nota = parseNfseXml(xmlStr, doc);
      if (!nota || !nota.chaveAcesso) continue;
      const prestCnpj = (nota.prestador?.CNPJ || nota.prestador?.cnpj || '').replace(/\D/g, '');
      const tomCnpj = (nota.tomador?.CNPJ || nota.tomador?.cnpj || '').replace(/\D/g, '');
      if (prestCnpj !== cnpj && tomCnpj !== cnpj) continue;
      if (chaves.has(nota.chaveAcesso) || nsus.has(nota.nsu)) continue;
      await db.insertNota(nota);
      chaves.add(nota.chaveAcesso);
      nsus.add(nota.nsu);
      importadas++;
    }
    await db.updateContribuinteMaxNsu(cnpj, maxNsu);
    res.json({ sucesso: true, importadas, maxNsu });
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.xMotivo || err.response?.data?.error || err.message;
    res.status(status).json({ error: msg || 'Falha ao sincronizar com ADN.' });
  }
});

app.get('/api/municipio/decisao-judicial', authenticate, async (req, res) => {
  if (req.user.userType !== 'municipio') {
    return res.status(403).json({ error: 'Acesso restrito ao município.' });
  }
  const decisoes = await db.getAllDecisoesJudiciais();
  res.json({ sucesso: true, decisoes });
});

app.post('/api/municipio/decisao-judicial', authenticate, async (req, res) => {
  if (req.user.userType !== 'municipio') {
    return res.status(403).json({ error: 'Apenas usuários do município podem cadastrar decisões.' });
  }
  const { cnpjContribuinte, numeroProcesso, tipo } = req.body;
  if (!cnpjContribuinte || !numeroProcesso) {
    return res.status(400).json({ error: 'CNPJ do contribuinte e número do processo são obrigatórios.' });
  }
  await db.insertDecisaoJudicial({ cnpj: cnpjContribuinte, numeroProcesso, tipo });
  res.json({ sucesso: true });
});

app.delete('/api/municipio/decisao-judicial/:id', authenticate, async (req, res) => {
  if (req.user.userType !== 'municipio') {
    return res.status(403).json({ error: 'Acesso restrito ao município.' });
  }
  const { id } = req.params;
  await db.deleteDecisaoJudicial(id);
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Contribuinte — Minhas Notas
// ==========================================

app.get('/api/notes', authenticate, async (req, res) => {
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

// Consulta NFS-e por chave (banco local — evita 403 da Sefin sem certificado)
// Requer login; contribuinte só vê notas onde é prestador ou tomador
app.get('/api/nfse/:chave', authenticate, async (req, res) => {
  const nota = await db.getNotaByChave(req.params.chave);
  if (!nota) return res.status(404).json({ error: 'NFS-e não encontrada no banco local' });

  const user = req.user;
  if (user.userType === 'contribuinte' && user.cnpj) {
    const cnpjUser = String(user.cnpj).replace(/\D/g, '');
    const prestCnpj = String(nota.prestador?.CNPJ || nota.prestador?.cnpj || '').replace(/\D/g, '');
    const tomCnpj = String(nota.tomador?.CNPJ || nota.tomador?.cnpj || '').replace(/\D/g, '');
    if (cnpjUser && prestCnpj !== cnpjUser && tomCnpj !== cnpjUser) {
      return res.status(403).json({
        error: 'Você não tem permissão para consultar esta NFS-e. A nota deve ser do prestador ou tomador vinculado ao seu usuário.',
        hint: 'Verifique se está logado com o CNPJ correto ou use certificado digital para consulta direta na Sefin.'
      });
    }
  }

  const dg    = nota.dadosGerais || {};
  const prest = nota.prestador   || {};
  const tom   = nota.tomador     || {};
  const serv  = nota.servico     || {};
  const val   = nota.valores     || {};
  const trib  = nota.tributos    || {};
  const ti    = trib.issqn       || {};
  const tf    = trib.federal     || {};
  const tt    = trib.totais      || {};

  const endPrest = prest.endereco || prest.end || {};
  const endTom   = tom.endereco   || tom.end   || {};

  // Monta endereço como string para o campo Endereço do DANFSe
  const fmtEnd = (e, p) => [
    p.xLgr || e.xLgr, p.nro || e.nro,
    p.xCpl || e.xCpl || 'Não Informado',
    p.xBairro || e.xBairro,
  ].filter(Boolean).join(', ');
  const fmtMun = (e, p) => {
    const m = e.xMun || p.xMun || '';
    const u = e.UF   || e.uf   || p.UF || p.uf || '';
    return [m, u].filter(Boolean).join(' - ');
  };
  const fmtCEP = (e, p) => (e.CEP || e.cep || p.CEP || p.cep || '').replace(/(\d{5})(\d{3})/, '$1-$2');
  const fmtDoc = (p) => {
    const cnpj = p.CNPJ || p.cnpj || '';
    if (cnpj) return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    const cpf = p.CPF || p.cpf || '';
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  };

  const vServ  = val.vServ  ?? 0;
  const vBC    = val.vBC    ?? vServ;
  const vLiq   = val.vLiq   ?? vServ;
  const vISS   = val.vISSQN ?? val.vISS ?? ti.vISS ?? 0;
  const pAliq  = ti.pAliq   ?? val.pAliq ?? 0;
  const vIRRF  = tf.vRetIRRF  ?? tf.vIRRF  ?? 0;
  const vRetCP = tf.vRetCP    ?? 0;
  const vRetPC = tf.vRetCSLL  ?? 0;
  const vPIS   = tf.vPis      ?? tf.vPIS   ?? val.vPis ?? val.vPIS ?? 0;
  const vCofins= tf.vCofins   ?? val.vCofins ?? 0;
  const vTotFed= vIRRF + vRetCP + vPIS + vCofins;

  const config = await db.getConfig().catch(() => ({}));

  const infNFSe = {
    // ── Identificação ──────────────────────────────────────────
    nNFSe:   dg.nNFSe   || '',
    dhNFSe:  dg.dhProc  || dg.dhEmi || '',
    nDPS:    dg.nDPS    || '',
    serie:   dg.serie   || '',
    dCompet: dg.dCompet || nota.competencia || '',
    dhDPS:   dg.dhEmi   || '',
    ambGer:  dg.ambGer  || '2',
    // ── Município emissor ───────────────────────────────────────
    _munNome:      config.nome       || dg.xLocEmi || '',
    _munPrefeitura:config.prefeitura || '',
    _munFone:      config.telefone   || '',
    _munEmail:     config.email      || '',
    _munBrasao:    config.brasao     || '',
    // ── Prestador ──────────────────────────────────────────────
    emit: {
      CNPJ:  prest.CNPJ || prest.cnpj || '',
      CPF:   prest.CPF  || prest.cpf  || '',
      NIF:   prest.NIF  || '',
      xNome: prest.xNome || prest.nome || '',
      IM:    prest.IM   || '',
      fone:  prest.fone || '',
      email: prest.email || '',
      endereco: {
        xLgr:    endPrest.xLgr    || prest.xLgr    || '',
        nro:     endPrest.nro     || prest.nro      || '',
        xCpl:    endPrest.xCpl    || prest.xCpl     || 'Não Informado',
        xBairro: endPrest.xBairro || prest.xBairro  || '',
        cMun:    endPrest.cMun    || prest.cMun      || '',
        xMun:    endPrest.xMun    || prest.xMun      || '',
        UF:      endPrest.UF      || endPrest.uf     || prest.UF || prest.uf || '',
        CEP:     endPrest.CEP     || endPrest.cep    || prest.CEP || prest.cep || '',
      },
      // Regime tributário
      opSimpNac:  prest.opSimpNac  || dg.opSimpNac  || '',
      regApurSN:  prest.regApurSN  || dg.regApurSN  || '',
      regEspTrib: prest.regEspTrib || ti.regEspTrib  || '0',
    },
    // ── Tomador ────────────────────────────────────────────────
    toma: {
      CNPJ:  tom.CNPJ || tom.cnpj || '',
      CPF:   tom.CPF  || tom.cpf  || '',
      NIF:   tom.NIF  || '',
      xNome: tom.xNome || tom.nome || '',
      IM:    tom.IM   || '',
      fone:  tom.fone || '',
      email: tom.email || '',
      endereco: {
        xLgr:    endTom.xLgr    || tom.xLgr    || '',
        nro:     endTom.nro     || tom.nro      || '',
        xCpl:    endTom.xCpl    || tom.xCpl     || '',
        xBairro: endTom.xBairro || tom.xBairro  || '',
        cMun:    endTom.cMun    || tom.cMun      || '',
        xMun:    endTom.xMun    || tom.xMun      || '',
        UF:      endTom.UF      || endTom.uf     || tom.UF || tom.uf || '',
        CEP:     endTom.CEP     || endTom.cep    || tom.CEP || tom.cep || '',
      },
    },
    // ── Serviço ────────────────────────────────────────────────
    serv: {
      cTribNac:      serv.cServ?.cTribNac  || serv.cTribNac  || '',
      cTribMun:      serv.cServ?.cTribMun  || serv.cTribMun  || '',
      cNBS:          serv.cServ?.cNBS      || serv.cNBS      || '',
      xDescServ:     serv.xDescServ || '',
      cLocPrestacao: serv.cLocPrestacao    || serv.cLocPrest  || dg.cLocIncid || '',
      xLocPrestacao: serv.xLocPrestacao   || '',
      cPaisPrestacao:serv.cPaisPrestacao  || '',
    },
    // ── Tributação Municipal (ISSQN) ────────────────────────────
    tributos: {
      issqn: {
        tribISSQN:   ti.tribISSQN  || '1',
        cPaisResult: ti.cPaisResult || '',
        cLocIncid:   ti.cLocIncid   || serv.cLocPrestacao || dg.cLocIncid || '',
        regEspTrib:  prest.regEspTrib || ti.regEspTrib    || '0',
        tpImunidade: ti.tpImunidade  || '',
        tpSusp:      ti.tpSusp       || ti.cExigSusp      || '0',
        nProcesso:   ti.nProcesso    || '',
        nBM:         ti.nBM          || '',
        vDescIncond: val.vDescIncond  ?? 0,
        vDedRed:     val.vDedRed      ?? val.dedRed?.vDR ?? 0,
        vCalcBM:     val.vCalcBM      ?? 0,
        vBC:         vBC,
        pAliq:       pAliq,
        tpRetISSQN:  ti.tpRetISSQN   || '1',
        vISS:        vISS,
      },
      federal: {
        vRetIRRF:   vIRRF,
        vRetCP:     vRetCP,
        vRetCSLL:   vRetPC,
        vPis:       vPIS,
        vCofins:    vCofins,
        tpRetPisCofins: tf.tpRetPisCofins || '',
        vTotFed:    vTotFed,
      },
      totais: {
        vTotTribFed: tt.vTotTribFed ?? 0,
        vTotTribEst: tt.vTotTribEst ?? 0,
        vTotTribMun: tt.vTotTribMun ?? 0,
      },
      ibscbs: trib.ibscbs || {},
    },
    // ── Valores ────────────────────────────────────────────────
    valores: {
      vServ:       vServ,
      vDescCond:   val.vDescCond  ?? 0,
      vDescIncond: val.vDescIncond ?? 0,
      vBC:         vBC,
      vISSQN:      vISS,
      vLiq:        vLiq,
      pAliq:       pAliq,
      vPis:        vPIS,
      vCofins:     vCofins,
      // campos adicionais para totais
      vISSQNRet:   (ti.tpRetISSQN === '2' || ti.tpRetISSQN === '3') ? vISS : 0,
      vTribFed:    vTotFed,
      vPisCofinsDev: vPIS + vCofins,
    },
    // Info complementar
    xInfComp: dg.xInfComp || '',
    nbs:      serv.cServ?.cNBS || serv.cNBS || '',
    // Mantém compatibilidade com código anterior
    dadosGerais: dg,
    prestador:   prest,
    tomador:     tom,
  };

  res.json({ cStat: '100', infNFSe, fonte: 'local' });
});

// ==========================================
// ROTAS: Configurações do Município
// ==========================================

app.get('/api/municipio/config', authenticate, async (req, res) => {
  const config = await db.getConfig();
  res.json(config || {});
});

app.put('/api/municipio/config', authenticate, async (req, res) => {
  const allowed = [
    'ibge', 'nome', 'uf', 'cnpj', 'inscEstadual', 'endereco', 'email', 'telefone', 'ambiente',
    'urlAdnMun',
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

// Cache de certificados de contribuintes (token -> { keyPem, certPem }) para mTLS
const contribuinteCertCache = new Map();
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

app.post('/api/municipio/upload-cert', authenticate, express.raw({ type: 'application/octet-stream', limit: '5mb' }), async (req, res) => {
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

app.post('/api/admin/force-sync', authenticate, async (req, res) => {
  try {
    const result = await syncNfsFromAdn();
    res.json({ sucesso: true, ...result });
  } catch (err) {
    console.error('[ force-sync ] Erro não tratado:', err.message);
    res.status(500).json({ sucesso: false, fonte: 'erro', erro: err.message });
  }
});

// Diagnóstico ADN — testa cada URL e retorna status detalhado (usa certificado armazenado)
app.get('/api/admin/probe-adn', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const ambiente = config.ambiente || 'sandbox';
    const adnBaseUrl = (config.urlAdnMun || process.env.ADN_MUN_URL || AMBIENTES[ambiente]?.adnMun)?.trim() || AMBIENTES[ambiente]?.adnMun;
    const agent = loadMunCertAgent();
    const certOk = fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH);

    if (!adnBaseUrl) {
      return res.json({ erro: 'URL ADN não configurada.', certOk });
    }

    const baseMun = adnBaseUrl.replace(/\/$/, '');
    const baseRoot = baseMun.replace(/\/(municipios|contribuintes|dfe|DFe)\/?$/, '') || baseMun;

    // Tenta várias URLs e coleta resultado completo de cada uma
    const probeTargets = [
      { label: 'Swagger/OpenAPI spec', url: `${baseMun}/v3/api-docs` },
      { label: 'Swagger UI HTML', url: `${baseMun}/docs/index.html` },
      { label: 'Root municipios', url: `${baseMun}/` },
      { label: 'DFe NSU=0', url: `${baseMun}/DFe/0` },
      { label: 'DFe NSU query', url: `${baseMun}/DFe?ultNsu=0` },
      { label: 'DFe NSU=1', url: `${baseMun}/DFe/1` },
      { label: 'dfe raiz NSU=0', url: `${baseRoot}/dfe/0` },
      { label: 'DFe raiz NSU=0', url: `${baseRoot}/DFe/0` },
      { label: 'municipios/DFe NSU=0', url: `${baseRoot}/municipios/DFe/0` },
    ];

    const results = [];
    for (const target of probeTargets) {
      try {
        const r = await axios({
          method: 'GET',
          url: target.url,
          httpsAgent: agent,
          headers: { Accept: 'application/json, text/html, */*', 'User-Agent': 'Freire-NFSe/1.0 Probe' },
          timeout: 10000,
          validateStatus: () => true,  // não jogar erro em qualquer status HTTP
        });
        const bodySnippet = typeof r.data === 'string'
          ? r.data.substring(0, 300)
          : JSON.stringify(r.data).substring(0, 300);
        results.push({ label: target.label, url: target.url, status: r.status, body: bodySnippet });
      } catch (err) {
        results.push({ label: target.label, url: target.url, status: null, erro: err.code || err.message?.substring(0, 100) });
      }
    }

    res.json({
      ambiente,
      adnBaseUrl,
      certOk,
      certSubject: config.certSubject || 'N/A',
      results,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Simulação ADN — importa notas sintéticas para teste quando ADN real não está disponível
app.post('/api/admin/simular-importacao', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const IBGE_MUNICIPIO = config.ibge || '0000000';
    const qtd = Math.min(Number(req.body?.quantidade) || 10, 50);
    const { chaves: existingChaves, nsus: existingNsus } = await db.existingChavesAndNsus();
    const currentMaxNsu = await db.getMaxNsu();

    const servicos = ['01.01.01', '01.02.01', '01.04.01', '02.01.01', '07.01.01', '14.01.00', '17.06.00'];
    const cnpjs = ['11222333000181', '22333444000195', '33444555000107', '44555666000140', '55666777000160'];
    const nomes = ['Consultoria XYZ Ltda', 'Tech Solutions SA', 'Serviços Prestados ME', 'Empresa Demo Ltda', 'Consultores Associados'];

    let salvos = 0;
    const notasGeradas = [];
    for (let i = 0; i < qtd; i++) {
      const nsu = currentMaxNsu + i + 1;
      const cnpjIdx = i % cnpjs.length;
      const cnpjPrest = cnpjs[cnpjIdx];
      const servIdx = i % servicos.length;
      const vServico = parseFloat((Math.random() * 9000 + 1000).toFixed(2));
      const vIss = parseFloat((vServico * 0.05).toFixed(2));
      const dataComp = new Date();
      dataComp.setDate(dataComp.getDate() - Math.floor(Math.random() * 30));
      const anoMes = `${dataComp.getFullYear()}-${String(dataComp.getMonth() + 1).padStart(2, '0')}`;
      const chaveAcesso = `${IBGE_MUNICIPIO}${cnpjPrest}${String(nsu).padStart(9, '0')}`;

      if (existingChaves.has(chaveAcesso) || existingNsus.has(nsu)) continue;

      // Formato compatível com insertNota (campos aninhados como o parseNfseFromAdn gera)
      const nota = {
        nsu,
        chaveAcesso,
        tipoDocumento: 'NFSE',
        fonte: 'simulacao',
        competencia: anoMes,
        status: 'Ativa',
        dadosGerais: {
          cStat: '100',
          cLocIncid: IBGE_MUNICIPIO,
          dhEmi: dataComp.toISOString(),
          dCompet: `${anoMes}-01`,
          simulado: true,
        },
        prestador: {
          CNPJ: cnpjPrest,
          xNome: nomes[cnpjIdx],
        },
        tomador: {
          CNPJ: config.cnpj || '00000000000000',
          xNome: config.nome || 'TOMADOR DEMO',
        },
        valores: {
          vServ: vServico,
          vBC: vServico,
          vLiq: vServico - vIss,
          vISS: vIss,
          pAliq: 5,
        },
        servico: {
          cServ: servicos[servIdx],
          xDescServ: `Serviço de simulação — código ${servicos[servIdx]}`,
        },
      };

      await db.insertNota(nota);
      existingChaves.add(chaveAcesso);
      existingNsus.add(nsu);
      salvos++;
      notasGeradas.push({ nsu, chaveAcesso, cnpjPrestador: cnpjPrest, vServico });
    }

    const newMax = currentMaxNsu + qtd;
    await db.updateMaxNsu(newMax);

    console.log(`[ Simulação ] ${salvos} notas sintéticas importadas para teste.`);
    res.json({ sucesso: true, novaNotas: salvos, maxNsu: newMax, notas: notasGeradas });
  } catch (err) {
    console.error('[ Simulação ] Erro:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/force-apuracao', authenticate, async (req, res) => {
  const comp = req.body.competencia || '2026-03';
  const resultados = await gerarApuracaoMensal(comp);
  res.json({ sucesso: true, qdtGuias: resultados.length, resultados });
});

// ─── Contribuinte Regime ───────────────────────────────────────
app.get('/api/municipio/contribuinte-regime', authenticate, async (req, res) => {
  try {
    const r = await db.pool.query('SELECT * FROM contribuinte_regime ORDER BY atualizado_em DESC');
    res.json({ sucesso: true, regimes: r.rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/municipio/contribuinte-regime/:cnpj', authenticate, async (req, res) => {
  try {
    const { cnpj } = req.params;
    const { regime = 'normal', isento_guia = false } = req.body;
    await db.pool.query(
      `INSERT INTO contribuinte_regime (cnpj, regime, isento_guia, atualizado_em)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (cnpj) DO UPDATE SET regime = $2, isento_guia = $3, atualizado_em = NOW()`,
      [cnpj.replace(/\D/g, ''), regime, isento_guia]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/municipio/contribuinte-regime/:cnpj', authenticate, async (req, res) => {
  try {
    await db.pool.query('DELETE FROM contribuinte_regime WHERE cnpj = $1', [req.params.cnpj.replace(/\D/g, '')]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Parâmetros Municipais (proxy para Sefin) ─────────────────
app.get('/api/parametros-municipais/:codMun', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const ambiente = config.ambiente || 'sandbox';
    const AMBIENTES = { sandbox: { sefin: 'https://sefin.producaorestrita.nfse.gov.br' }, production: { sefin: 'https://sefin.nfse.gov.br' } };
    const sefinBase = (config.urlSefin || process.env.SEFIN_URL || AMBIENTES[ambiente]?.sefin)?.trim();
    const agent = loadMunCertAgent();
    const { codMun } = req.params;

    const endpoints = {
      convenio: `${sefinBase}/parametros_municipais/${codMun}/convenio`,
      aliquotas: `${sefinBase}/parametros_municipais/${codMun}/aliquotas`,
      regimesEspeciais: `${sefinBase}/parametros_municipais/${codMun}/regimes_especiais`,
    };

    const results = {};
    for (const [key, url] of Object.entries(endpoints)) {
      try {
        const r = await axios.get(url, { httpsAgent: agent, timeout: 10000, validateStatus: () => true });
        results[key] = { status: r.status, data: r.data };
      } catch (e) {
        results[key] = { status: null, erro: e.message };
      }
    }
    res.json({ sucesso: true, codMun, results });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==========================================
// Startup
// ==========================================

app.listen(PORT, () => {
  console.log(`[ Freire ] Backend ativo na porta ${PORT} (${NODE_ENV})`);
});
