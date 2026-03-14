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
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const app = express();

const PORT    = process.env.PORT    || 3099;
const IA_PORT = process.env.IA_PORT || 8001;
const IA_URL  = `http://localhost:${IA_PORT}`;
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
      return res.status(429).json({ error: 'Muitas requisiÃ§Ãµes. Tente novamente em instantes.' });
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
    { cpf: '111.222.333-44', name: 'JosÃ© da Silva', email: 'jose.silva@exemplo.com', celular: '11999990001', role: 'MASTER', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    { cpf: '999.888.777-66', name: 'JoÃ£o Contador', email: 'joao.contador@exemplo.com', celular: '11999990002', role: 'CONTADOR', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '12345678000100' },
    { cpf: '444.555.666-77', name: 'Maria Faturista', email: 'maria.faturista@exemplo.com', celular: '11999990003', role: 'FATURISTA', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    { cpf: '555.666.777-88', name: 'Ana Auditora', email: 'ana.auditora@exemplo.com', celular: '11999990004', role: 'AUDITOR', userType: 'contribuinte', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '12345678000100' },
    // MunicÃ­pio
    { cpf: '123.456.789-00', name: 'Admin Sefin', email: 'admin.sefin@municipio.gov.br', celular: '11988880001', role: 'GESTOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '333.444.555-66', name: 'Carlos Fiscal', email: 'carlos.fiscal@municipio.gov.br', celular: '11988880002', role: 'FISCAL', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '777.888.999-11', name: 'Auditor Chefe', email: 'auditor.chefe@municipio.gov.br', celular: '11988880003', role: 'AUDITOR', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'CERTIFICADO_A1_A3', cnpjVinculado: '' },
    { cpf: '666.777.888-99', name: 'Paula Atendente', email: 'paula.atendente@municipio.gov.br', celular: '11988880004', role: 'ATENDENTE', userType: 'municipio', passwordHash: bcrypt.hashSync('12345678', 10), authLevel: 'GOVBR_OURO', cnpjVinculado: '' }
  ];
  const users = await db.getUsers();
  if (users.length === 0) {
    for (const u of defaults) await db.insertUser(u);
    console.log('[ DB ] UsuÃ¡rios padrÃ£o criados.');
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
  if (added > 0) console.log(`[ DB ] ${added} usuÃ¡rio(s) adicionado(s) para perfis faltantes.`);
}

// Initialize DB on startup
(async () => {
  await ensureDataDir();
  try {
    await db.runMigrations();
    await seedDefaultUsersIfEmpty();
    console.log('[ DB ] PostgreSQL conectado e migraÃ§Ãµes aplicadas.');
  } catch (err) {
    console.error('[ DB ] Erro ao conectar PostgreSQL:', err.message);
    // Deadlock em migraÃ§Ã£o concorrente (node --watch) â€” aguarda e tenta novamente
    if (err.code === '40P01' || err.message?.includes('deadlock')) {
      console.warn('[ DB ] Deadlock detectado nas migraÃ§Ãµes â€” aguardando 3s e reiniciando...');
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
// MÃ“DULO 1: SincronizaÃ§Ã£o Passiva ADN (Worker)
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
  // Ambiente vem da tela de ConfiguraÃ§Ãµes do municÃ­pio: sandbox (ProduÃ§Ã£o Restrita) ou production (ProduÃ§Ã£o)
  const ambiente = config.ambiente || 'sandbox';
  const IBGE_MUNICIPIO = config.ibge;
  const adnBaseUrl = (config.urlAdnMun || process.env.ADN_MUN_URL || AMBIENTES[ambiente]?.adnMun)?.trim() || AMBIENTES[ambiente]?.adnMun;
  // Usa o maior entre sync_state e max(nsu) das notas â€” garante continuidade apÃ³s importaÃ§Ãµes anteriores
  const maxNsu = await db.getMaxNsuParaContinuar();

  if (!adnBaseUrl) {
    const currentMax = await db.getMaxNsu();
    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: 'URL ADN MunicÃ­pios nÃ£o configurada. Defina o ambiente em ConfiguraÃ§Ãµes (Sandbox ou ProduÃ§Ã£o) ou ADN_MUN_URL.' };
  }

  const ambLabel = ambiente === 'production' ? 'ProduÃ§Ã£o' : 'ProduÃ§Ã£o Restrita (Sandbox)';
  const certOk = fsSync.existsSync(MUN_CERT_PATH) || (fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH));
  if (!certOk) {
    const currentMax = await db.getMaxNsu();
    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: 'Certificado municipal ICP-Brasil nÃ£o configurado. A API ADN exige mTLS. Envie o certificado em ConfiguraÃ§Ãµes > Certificado.' };
  }

  const lastEmpty = await db.getLastEmptySyncAt();
  if (lastEmpty) {
    const diff = (Date.now() - new Date(lastEmpty).getTime()) / 1000 / 60;
    if (diff < 60) {
      console.log(`[ ADN Worker ] Rate-limit: aguardando 1h desde Ãºltimo sync vazio (${Math.round(60 - diff)} min restantes).`);
      return { maxNsu, novaNotas: 0, fonte: 'rate_limit', aviso: 'Aguardando 1 hora desde Ãºltimo sync sem documentos.' };
    }
  }

  console.log(`[ ADN Worker ] Varredura a partir do NSU: ${maxNsu}...`);
  console.log(`[ ADN Worker ] MunicÃ­pio: ${config.nome || IBGE_MUNICIPIO} | CNPJ: ${config.cnpj || 'N/A'}`);
  console.log(`[ ADN Worker ] Ambiente: ${ambLabel} (${ambiente}) | URL base: ${adnBaseUrl}`);

  const agent = loadMunCertAgent();
  const ultNSU = maxNsu;

  // URLs: ACBr/gov.br indicam adn.../dfe na RAIZ. Doc tambÃ©m cita municipios/DFe.
  const baseMun = adnBaseUrl.replace(/\/$/, '');
  const baseRoot = baseMun.replace(/\/(municipios|contribuintes|dfe|DFe)\/?$/, '') || baseMun;
  const nsuStr = String(ultNSU).padStart(15, '0');  // NSU pode exigir padding (15 dÃ­gitos conforme NF-e)

  const urlsToTry = [
    `${baseMun}/DFe/${ultNSU}`,                                     // Doc: municipios/DFe/{NSU} â€” tentar primeiro
    `${baseMun}/DFe?ultNsu=${ultNSU}`,                              // Query param variant
    `${baseMun}/dfe/${ultNSU}`,                                     // Case-insensitive variant
    `${baseMun}/DFe/${nsuStr}`,                                     // NSU com padding 15 dÃ­gitos
    `${baseMun}/DFe?ultNsu=${nsuStr}`,                              // Query param com padding
    `${baseRoot}/municipios/DFe/${ultNSU}`,                         // Raiz + municipios
    `${baseRoot}/dfe/${ultNSU}`,                                    // ACBr: raiz/dfe
    `${baseRoot}/DFe/${ultNSU}`,                                    // Raiz maiÃºsculo
    `${baseMun}/v1/DFe/${ultNSU}`,                                  // VersÃ£o /v1/
    `${baseMun}/api/DFe/${ultNSU}`,                                 // /api/ prefix
    `${baseRoot}/api/dfe/${ultNSU}`,
    (AMBIENTES[ambiente === 'sandbox' ? 'production' : 'sandbox']?.adnMun || baseRoot).replace(/\/$/, '') + `/DFe/${ultNSU}`,
  ].filter((u, i, a) => a.indexOf(u) === i);

  let response = null;
  let lastError = null;
  const urlResults = [];  // DiagnÃ³stico: registra status de cada URL tentada

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
        validateStatus: () => true,  // Nunca lanÃ§a erro por status HTTP â€” analisa corpo manualmente
      });

      const body = r.data;
      // ADN retorna HTTP 404 para "sem documentos" com JSON vÃ¡lido â€” isso Ã© resposta normal, nÃ£o erro de rota
      const isAdnJson = body && typeof body === 'object' && (
        body.LoteDFe !== undefined ||
        body.StatusProcessamento !== undefined ||
        body.resDFe !== undefined ||
        body.docsFiscais !== undefined
      );

      if (r.status === 200 || (r.status < 300) || isAdnJson) {
        // Resposta vÃ¡lida (com ou sem documentos)
        const nota404 = r.status === 404 ? ' (HTTP 404 â€” ADN sinaliza "sem documentos")' : '';
        urlResults.push({ url: adnUrl, status: r.status, ok: true, nota: isAdnJson ? `JSON ADN${nota404}` : '' });
        console.log(`[ ADN Worker ] âœ“ Resposta vÃ¡lida de ${adnUrl} [HTTP ${r.status}]${nota404}`);
        response = r;
        break;
      } else {
        urlResults.push({ url: adnUrl, status: r.status, ok: false });
        console.warn(`[ ADN Worker ] HTTP ${r.status} em ${adnUrl} (sem JSON ADN vÃ¡lido), tentando prÃ³xima URL...`);
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

  // Log de diagnÃ³stico das URLs tentadas
  console.log(`[ ADN Worker ] Resultados das URLs tentadas:`);
  for (const r of urlResults) {
    console.log(`  ${r.ok ? 'âœ“' : 'âœ—'} [${r.status}] ${r.url}`);
  }

  try {
    if (!response) {
      // Todas as URLs falharam â€” lanÃ§a o Ãºltimo erro para o catch abaixo tratÃ¡-lo adequadamente
      const errDiag = new Error(`Todas as ${urlResults.length} URLs tentadas falharam. Ãšltimo erro: ${lastError?.message}`);
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
      console.log(`[ ADN Worker ] Nenhum documento novo retornado pela ADN. (${semDocs ? 'municÃ­pio sem NFS-e no ADN ainda' : respStatus})`);
      const maxNsuRet = payload.maxNSU ?? payload.MaxNSU ?? maxNsu;
      if (maxNsuRet === maxNsu) {
        await db.setLastEmptySyncAt();
      }
      const aviso = semDocs
        ? 'MunicÃ­pio autenticado no ADN, mas sem NFS-e distribuÃ­das ainda. Aguarde emissÃ£o de notas ou use "Simular ImportaÃ§Ã£o" para testes.'
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
            await db.updateNotaStatus(chaveRef, 'SubstituÃ­da');
            console.log(`[ ADN Worker ] Evento substituiÃ§Ã£o aplicado: ${chaveRef}`);
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
      console.log(`[ ADN Worker ] ${numErros} documentos nÃ£o puderam ser processados.`);
    }

    await db.updateMaxNsu(maxNsuRecebido);

    console.log(`[ ADN Worker ] ${numNotasSalvas} notas novas salvas via ADN real. maxNSU: ${maxNsuRecebido}`);
    return { maxNsu: maxNsuRecebido, novaNotas: numNotasSalvas, fonte: 'ADN' };

  } catch (error) {
    const status = error.response?.status;
    const respData = error.response?.data;
    const diagUrls = error._urlResults || urlResults || [];
    const msg = respData?.xMotivo || respData?.error || respData?.message || error.message;
    console.warn(`[ ADN Worker ] API ADN indisponÃ­vel (${status || 'N/A'}): ${msg}`);
    if (respData) console.warn(`[ ADN Worker ] Resposta completa:`, JSON.stringify(respData).substring(0, 500));
    console.log('[ ADN Worker ] Nenhuma nota importada nesta tentativa.');

    const ambLabel = ambiente === 'production' ? 'ProduÃ§Ã£o' : 'ProduÃ§Ã£o Restrita (Sandbox)';
    const certOk = fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH);
    const currentMax = await db.getMaxNsu();

    // DiagnÃ³stico detalhado â€” inclui quais URLs foram tentadas e seus status
    const diagSummary = diagUrls.length > 0
      ? ` URLs tentadas: ${diagUrls.map(r => `[${r.status}] ${r.url.replace(/.*\/(municipios|contribuintes)/, '...')}`).join(', ')}.`
      : '';

    let erroMsg;
    if (!certOk) {
      erroMsg = `ADN 404 (${ambLabel}): Certificado municipal nÃ£o configurado. Envie o certificado ICP-Brasil da Prefeitura em ConfiguraÃ§Ãµes > Certificado.`;
    } else if (diagUrls.every(r => r.status === 404 || r.status === '404')) {
      erroMsg = `ADN indisponÃ­vel (${ambLabel}): O servidor retornou 404 em todas as ${diagUrls.length} URLs tentadas.${diagSummary} PossÃ­veis causas: (1) MunicÃ­pio nÃ£o cadastrado no ADN; (2) URL base incorreta â€” use "URL ADN MunicÃ­pios (override)" em ConfiguraÃ§Ãµes; (3) API ainda nÃ£o disponÃ­vel neste ambiente. Use o Modo SimulaÃ§Ã£o para testes.`;
    } else {
      erroMsg = `ADN erro ${status || '?'} (${ambLabel}): ${msg}.${diagSummary}`;
    }

    // Modo fallback: ADN_SKIP_404=1 retorna sucesso silencioso (permite usar sistema com dados locais)
    if (process.env.ADN_SKIP_404 === '1') {
      console.log('[ ADN Worker ] ADN_SKIP_404=1: retornando sucesso sem importar (API indisponÃ­vel).');
      return { maxNsu: currentMax, novaNotas: 0, fonte: 'adn_indisponivel', aviso: erroMsg, diagnostico: diagUrls };
    }

    return { maxNsu: currentMax, novaNotas: 0, fonte: 'erro', erro: erroMsg, diagnostico: diagUrls };
  }
}

// ==========================================
// MÃ“DULO 2: Motor de ApuraÃ§Ã£o
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
    // pAliq pode estar em decimal (0.05) ou percentual inteiro (5) â€” normalizar para decimal
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
// MÃ“DULO 3: AutenticaÃ§Ã£o e SeguranÃ§a
// ==========================================

// URLs conforme documentaÃ§Ã£o oficial (requisitos-nfse-rtc-v2.md, Fontes/manual-municipios-apis-adn)
// ADN MunicÃ­pios: https://adn.producaorestrita.nfse.gov.br/municipios/docs/index.html (sandbox)
// ADN MunicÃ­pios: https://adn.nfse.gov.br/municipios/docs/index.html (produÃ§Ã£o)
// Endpoint distribuiÃ§Ã£o: GET /DFe/{UltimoNSU} â€” base = host + /municipios (sem /docs)
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

/** Retorna as URLs efetivas de cada API, priorizando valores salvos na config. */
function resolveUrls(config, env) {
  const amb = AMBIENTES[env] || AMBIENTES.sandbox;
  return {
    sefin:  (config.urlSefin  || amb.sefin  || '').trim(),
    adn:    (config.urlAdn    || amb.adn    || '').trim(),
    adnMun: (config.urlAdnMun || amb.adnMun || '').trim(),
  };
}

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token nÃ£o fornecido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Token invÃ¡lido' });
  }
};

// ==========================================
// ROTAS: AutenticaÃ§Ã£o
// ==========================================

app.post('/api/auth/login', rateLimit(60000, 10), async (req, res) => {
  const { cpf, password } = req.body;
  if (!cpf || !password) return res.status(400).json({ error: 'CPF e senha sÃ£o obrigatÃ³rios' });

  const user = await db.getUserByCpf(cpf);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais invÃ¡lidas' });
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
    return res.status(400).json({ error: 'Dados do certificado sÃ£o obrigatÃ³rios' });
  }
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ vÃ¡lido nÃ£o encontrado no certificado' });
  }

  const users = await db.getUsers({ userType: 'contribuinte' });
  const user = users.find(u =>
    u.cnpjVinculado?.replace(/\D/g, '') === cleanCnpj &&
    u.authLevel === 'CERTIFICADO_A1_A3'
  );

  if (!user) {
    return res.status(401).json({ error: `Nenhum usuÃ¡rio com nÃ­vel Certificado Digital vinculado ao CNPJ ${cleanCnpj}` });
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
    console.warn('[ Auth ] Certificado nÃ£o convertido para mTLS:', certErr.message);
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

  const urls = resolveUrls(config, env);
  const baseUrl = urls[api];
  if (!api || !baseUrl) {
    return res.status(400).json({ error: 'Ambiente ou API invÃ¡lidos' });
  }
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
      return res.status(504).json({ error: 'Sistema externo (Sefin/ADN) nÃ£o respondeu no prazo. Tente novamente.' });
    }
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    res.status(status).send(typeof data === 'object' ? data : { error: String(data) });
  }
});

// ==========================================
// ROTAS: Config (ambiente â€” fonte Ãºnica)
// ==========================================

// InformaÃ§Ãµes pÃºblicas do municÃ­pio (cabeÃ§alho do DANFSe, sem auth)
app.get('/api/municipio/info', async (req, res) => {
  const config = await db.getConfig();
  const uf = (config.uf || '').toUpperCase().trim();
  const addUF = (s) => {
    if (!s) return '';
    const txt = s.trim();
    return (uf && !txt.toUpperCase().endsWith(uf) && !txt.toUpperCase().includes(` - ${uf}`))
      ? `${txt} - ${uf}`
      : txt;
  };
  res.json({
    nome:       addUF(config.nome       || ''),
    prefeitura: addUF(config.prefeitura || ''),
    fone:       config.telefone || '',
    email:      config.email    || '',
    brasao:     config.brasao   || '',
  });
});

app.get('/api/config/ambiente', async (req, res) => {
  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';
  const urls = resolveUrls(config, env);
  res.json({
    ambiente: env,
    urlSefin: urls.sefin,
    urlAdn:   urls.adn,
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
  const _urls = resolveUrls(config, env);
  let [sefin, adn] = await Promise.all([
    checkEndpoint(_urls.sefin),
    checkEndpoint(_urls.adn)
  ]);

  if (env === 'sandbox' && sefin.status === 'offline' && adn.status === 'offline') {
    sefin = { status: 'online', latency: 'â€”', _fallback: true };
    adn = { status: 'online', latency: 'â€”', _fallback: true };
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
// ROTAS: GestÃ£o de UsuÃ¡rios (CRUD)
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
    return res.status(400).json({ error: 'Campos obrigatÃ³rios: cpf, name, role' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'E-mail Ã© obrigatÃ³rio' });
  }
  if (!celular || !celular.trim()) {
    return res.status(400).json({ error: 'Celular Ã© obrigatÃ³rio' });
  }

  const existing = await db.getUserByCpf(cpf);
  if (existing) {
    return res.status(409).json({ error: 'UsuÃ¡rio com este CPF jÃ¡ existe' });
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
  if (!existing) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });

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
  if (!existing) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
  await db.deleteUser(req.params.cpf);
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: MunicÃ­pio â€” Notas Importadas
// ==========================================

app.get('/api/municipio/notas', authenticate, async (req, res) => {
  const notas = await db.getNotas();
  res.json({ sucesso: true, notas });
});

// ==========================================
// ROTAS: MunicÃ­pio â€” ApuraÃ§Ãµes e Guias
// ==========================================

// CompetÃªncias com notas ou apuraÃ§Ãµes registradas na base
app.get('/api/municipio/competencias', authenticate, async (req, res) => {
  const competencias = await db.getCompetenciasDisponiveis();
  res.json({ sucesso: true, competencias });
});

// ApuraÃ§Ãµes de uma competÃªncia especÃ­fica
app.get('/api/municipio/apuracoes-competencia/:competencia', authenticate, async (req, res) => {
  const apuracoes = await db.getApuracoesByCompetencia(req.params.competencia);
  res.json({ sucesso: true, apuracoes });
});

app.get('/api/municipio/apuracoes/:cnpj', authenticate, async (req, res) => {
  const apuracoes = await db.getApuracoesByCnpj(req.params.cnpj);
  res.json({ sucesso: true, apuracoes });
});

app.post('/api/municipio/gerar-guia/:id', authenticate, async (req, res) => {
  const apu = await db.getApuracaoById(req.params.id);
  if (!apu) return res.status(404).json({ error: 'ApuraÃ§Ã£o nÃ£o encontrada' });

  const valorTotal = parseFloat(apu.totalIssProprio || 0) + parseFloat(apu.totalIssTerceiros || 0);
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
  if (!apu) return res.status(404).json({ error: 'ApuraÃ§Ã£o nÃ£o encontrada' });

  await db.updateApuracao(req.params.id, { status: 'Paga', dataPagamento: new Date().toISOString() });
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Contribuinte â€” Sync ADN, DecisÃ£o Judicial
// ==========================================

app.post('/api/contribuinte/sync-adn', authenticate, async (req, res) => {
  const user = req.user;
  if (user.userType !== 'contribuinte' || !user.cnpj) {
    return res.status(403).json({ error: 'Acesso restrito a contribuintes com CNPJ vinculado.' });
  }
  const cnpj = String(user.cnpj).replace(/\D/g, '');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !contribuinteCertCache.has(token)) {
    return res.status(400).json({ error: 'FaÃ§a login com certificado digital para sincronizar com o ADN.' });
  }
  const { keyPem, certPem } = contribuinteCertCache.get(token);
  const agent = new https.Agent({ key: keyPem, cert: certPem, rejectUnauthorized: false });
  const config = await db.getConfig();
  const env = config.ambiente || 'sandbox';
  const baseAdn = resolveUrls(config, env).adn;
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
    return res.status(403).json({ error: 'Acesso restrito ao municÃ­pio.' });
  }
  const decisoes = await db.getAllDecisoesJudiciais();
  res.json({ sucesso: true, decisoes });
});

app.post('/api/municipio/decisao-judicial', authenticate, async (req, res) => {
  if (req.user.userType !== 'municipio') {
    return res.status(403).json({ error: 'Apenas usuÃ¡rios do municÃ­pio podem cadastrar decisÃµes.' });
  }
  const { cnpjContribuinte, numeroProcesso, tipo } = req.body;
  if (!cnpjContribuinte || !numeroProcesso) {
    return res.status(400).json({ error: 'CNPJ do contribuinte e nÃºmero do processo sÃ£o obrigatÃ³rios.' });
  }
  await db.insertDecisaoJudicial({ cnpj: cnpjContribuinte, numeroProcesso, tipo });
  res.json({ sucesso: true });
});

app.delete('/api/municipio/decisao-judicial/:id', authenticate, async (req, res) => {
  if (req.user.userType !== 'municipio') {
    return res.status(403).json({ error: 'Acesso restrito ao municÃ­pio.' });
  }
  const { id } = req.params;
  await db.deleteDecisaoJudicial(id);
  res.json({ sucesso: true });
});

// ==========================================
// ROTAS: Contribuinte â€” Minhas Notas
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

// Consulta NFS-e por chave (banco local â€” evita 403 da Sefin sem certificado)
// Requer login; contribuinte sÃ³ vÃª notas onde Ã© prestador ou tomador
app.get('/api/nfse/:chave', authenticate, async (req, res) => {
  const nota = await db.getNotaByChave(req.params.chave);
  if (!nota) return res.status(404).json({ error: 'NFS-e nÃ£o encontrada no banco local' });

  const user = req.user;
  if (user.userType === 'contribuinte' && user.cnpj) {
    const cnpjUser = String(user.cnpj).replace(/\D/g, '');
    const prestCnpj = String(nota.prestador?.CNPJ || nota.prestador?.cnpj || '').replace(/\D/g, '');
    const tomCnpj = String(nota.tomador?.CNPJ || nota.tomador?.cnpj || '').replace(/\D/g, '');
    if (cnpjUser && prestCnpj !== cnpjUser && tomCnpj !== cnpjUser) {
      return res.status(403).json({
        error: 'VocÃª nÃ£o tem permissÃ£o para consultar esta NFS-e. A nota deve ser do prestador ou tomador vinculado ao seu usuÃ¡rio.',
        hint: 'Verifique se estÃ¡ logado com o CNPJ correto ou use certificado digital para consulta direta na Sefin.'
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

  // Monta endereÃ§o como string para o campo EndereÃ§o do DANFSe
  const fmtEnd = (e, p) => [
    p.xLgr || e.xLgr, p.nro || e.nro,
    p.xCpl || e.xCpl || 'NÃ£o Informado',
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
    // â”€â”€ IdentificaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    nNFSe:   dg.nNFSe   || '',
    dhNFSe:  dg.dhProc  || dg.dhEmi || '',
    nDPS:    dg.nDPS    || '',
    serie:   dg.serie   || '',
    dCompet: dg.dCompet || nota.competencia || '',
    dhDPS:   dg.dhEmi   || '',
    ambGer:  dg.ambGer  || '2',
    // â”€â”€ MunicÃ­pio emissor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Concatena UF ao final se ainda nÃ£o estiver presente no texto
    ...((() => {
      const uf   = (config.uf || '').toUpperCase().trim();
      const addUF = (s) => {
        if (!s) return '';
        const txt = s.trim();
        return (uf && !txt.toUpperCase().endsWith(uf) && !txt.toUpperCase().includes(` - ${uf}`))
          ? `${txt} - ${uf}`
          : txt;
      };
      return {
        _munNome:      addUF(config.nome       || dg.xLocEmi || ''),
        _munPrefeitura:addUF(config.prefeitura || ''),
        _munFone:      config.telefone || '',
        _munEmail:     config.email    || '',
        _munBrasao:    config.brasao   || '',
      };
    })()),
    // â”€â”€ Prestador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        xCpl:    endPrest.xCpl    || prest.xCpl     || 'NÃ£o Informado',
        xBairro: endPrest.xBairro || prest.xBairro  || '',
        cMun:    endPrest.cMun    || prest.cMun      || '',
        xMun:    endPrest.xMun    || prest.xMun      || '',
        UF:      endPrest.UF      || endPrest.uf     || prest.UF || prest.uf || '',
        CEP:     endPrest.CEP     || endPrest.cep    || prest.CEP || prest.cep || '',
      },
      // Regime tributÃ¡rio
      opSimpNac:  prest.opSimpNac  || dg.opSimpNac  || '',
      regApurSN:  prest.regApurSN  || dg.regApurSN  || '',
      regEspTrib: prest.regEspTrib || ti.regEspTrib  || '0',
    },
    // â”€â”€ Tomador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // â”€â”€ ServiÃ§o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    serv: {
      cTribNac:      serv.cServ?.cTribNac  || serv.cTribNac  || '',
      cTribMun:      serv.cServ?.cTribMun  || serv.cTribMun  || '',
      cNBS:          serv.cServ?.cNBS      || serv.cNBS      || '',
      xDescServ:     serv.xDescServ || '',
      cLocPrestacao: serv.cLocPrestacao    || serv.cLocPrest  || dg.cLocIncid || '',
      xLocPrestacao: serv.xLocPrestacao   || '',
      cPaisPrestacao:serv.cPaisPrestacao  || '',
    },
    // â”€â”€ TributaÃ§Ã£o Municipal (ISSQN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // â”€â”€ Valores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // MantÃ©m compatibilidade com cÃ³digo anterior
    dadosGerais: dg,
    prestador:   prest,
    tomador:     tom,
  };

  res.json({ cStat: '100', infNFSe, fonte: 'local' });
});

// ==========================================
// ROTAS: ConfiguraÃ§Ãµes do MunicÃ­pio
// ==========================================

app.get('/api/municipio/config', authenticate, async (req, res) => {
  const config = await db.getConfig();
  res.json(config || {});
});

// â”€â”€ GET /api/municipios-tom?uf=XX&q=texto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Busca municÃ­pios por UF e/ou nome para sugestÃ£o no frontend
app.get('/api/municipios-tom', authenticate, async (req, res) => {
  try {
    const { uf, q, cod_tom, cod_ibge } = req.query;
    if (cod_tom) {
      const { rows } = await db.pool.query(
        'SELECT uf, cod_tom, cod_ibge, nome_empresarial, ente FROM municipios_tom WHERE cod_tom = $1 LIMIT 5',
        [String(cod_tom).padStart(4, '0')]
      );
      return res.json({ municipios: rows });
    }
    if (cod_ibge) {
      const { rows } = await db.pool.query(
        'SELECT uf, cod_tom, cod_ibge, nome_empresarial, ente FROM municipios_tom WHERE cod_ibge = $1 LIMIT 3',
        [String(cod_ibge)]
      );
      return res.json({ municipios: rows });
    }
    const params = [];
    let sql = 'SELECT uf, cod_tom, cod_ibge, nome_empresarial, ente FROM municipios_tom WHERE 1=1';
    if (uf) { params.push(uf.toUpperCase()); sql += ` AND uf = $${params.length}`; }
    if (q)  {
      params.push(`%${q.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}%`);
      sql += ` AND (UPPER(unaccent(ente)) LIKE $${params.length} OR UPPER(unaccent(nome_empresarial)) LIKE $${params.length})`;
    }
    sql += ' ORDER BY ente LIMIT 20';
    const { rows } = await db.pool.query(sql, params);
    res.json({ municipios: rows });
  } catch (err) {
    // Fallback sem unaccent (extensÃ£o pode nÃ£o estar instalada)
    try {
      const { uf, q, cod_ibge } = req.query;
      const params = [];
      if (cod_ibge) {
        const { rows } = await db.pool.query(
          'SELECT uf, cod_tom, cod_ibge, nome_empresarial, ente FROM municipios_tom WHERE cod_ibge = $1 LIMIT 3',
          [String(cod_ibge)]
        );
        return res.json({ municipios: rows });
      }
      let sql = 'SELECT uf, cod_tom, cod_ibge, nome_empresarial, ente FROM municipios_tom WHERE 1=1';
      if (uf) { params.push(uf.toUpperCase()); sql += ` AND uf = $${params.length}`; }
      if (q)  { params.push(`%${q.toUpperCase()}%`); sql += ` AND (UPPER(ente) LIKE $${params.length} OR UPPER(nome_empresarial) LIKE $${params.length})`; }
      sql += ' ORDER BY ente LIMIT 20';
      const { rows } = await db.pool.query(sql, params);
      res.json({ municipios: rows });
    } catch (err2) {
      res.status(500).json({ erro: err2.message });
    }
  }
});

// â”€â”€ GET /api/estados-tom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/estados-tom', authenticate, async (req, res) => {
  try {
    const { rows } = await db.pool.query('SELECT uf, cod_tom, nome FROM estados_tom ORDER BY uf');
    res.json({ estados: rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ POST /api/municipio/config/resolve-tom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auto-resolve cod_tom a partir do nome + uf salvos em config
app.post('/api/municipio/config/resolve-tom', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    if (config.cod_tom) return res.json({ sucesso: true, cod_tom: config.cod_tom, fonte: 'config' });

    const uf   = (req.body.uf   || config.uf   || '').toUpperCase();
    const nome = (req.body.nome || config.nome  || '').toUpperCase();
    if (!uf || !nome) return res.status(400).json({ erro: 'UF e nome sÃ£o obrigatÃ³rios.' });

    // Tenta busca exata, depois aproximada
    let rows;
    try {
      ({ rows } = await db.pool.query(
        `SELECT uf, cod_tom, nome_empresarial, ente,
                similarity(UPPER(unaccent(ente)), UPPER(unaccent($2))) AS sim
         FROM municipios_tom
         WHERE uf = $1
         ORDER BY sim DESC LIMIT 5`,
        [uf, nome]
      ));
    } catch {
      ({ rows } = await db.pool.query(
        'SELECT uf, cod_tom, nome_empresarial, ente FROM municipios_tom WHERE uf = $1 ORDER BY ente LIMIT 20',
        [uf]
      ));
    }
    res.json({ sucesso: true, candidatos: rows, fonte: 'busca' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/municipio/config', authenticate, async (req, res) => {
  const allowed = [
    'ibge', 'nome', 'prefeitura', 'brasao', 'uf', 'cnpj', 'inscEstadual', 'endereco', 'email', 'telefone', 'ambiente',
    'urlSefin', 'urlAdn', 'urlAdnMun', 'cod_tom',
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
    throw new Error('Chave privada ou certificado nÃ£o encontrados no PFX.');
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
          console.log('[ Cert ] PFX convertido para PEM com sucesso na inicializaÃ§Ã£o.');
        } catch (convErr) {
          console.warn('[ Cert ] Falha ao converter PFX â†’ PEM na inicializaÃ§Ã£o:', convErr.message);
        }
      }
    }
  } catch (_) { /* db ainda nÃ£o existe na primeira inicializaÃ§Ã£o */ }
})();

app.post('/api/municipio/upload-cert', authenticate, express.raw({ type: 'application/octet-stream', limit: '5mb' }), async (req, res) => {
  try {
    const passphrase = req.headers['x-cert-passphrase'] || '';
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'Arquivo do certificado nÃ£o recebido.' });
    }
    await ensureDataDir();

    const { keyPem, certPem } = convertPfxToPem(Buffer.from(req.body), passphrase);

    await fs.writeFile(MUN_CERT_PATH, req.body);
    await fs.writeFile(MUN_KEY_PEM_PATH, keyPem);
    await fs.writeFile(MUN_CERT_PEM_PATH, certPem);

    _munCertPassphrase = passphrase;

    await db.updateConfig({ certPassphrase: Buffer.from(passphrase).toString('base64') });

    console.log(`[ Cert ] Certificado convertido PFXâ†’PEM e salvo (${req.body.length} bytes).`);
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[ Cert ] Falha no upload/conversÃ£o:', err.message);
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
      console.warn('[ Cert ] Falha ao converter PFX â†’ PEM:', err.message);
    }
  }

  console.warn('[ Cert ] Certificado municipal nÃ£o encontrado.');
  return loadCertAgent();
}

// ==========================================
// ROTAS: Admin â€” AÃ§Ãµes ForÃ§adas
// ==========================================

app.post('/api/admin/force-sync', authenticate, async (req, res) => {
  try {
    const result = await syncNfsFromAdn();
    res.json({ sucesso: true, ...result });
  } catch (err) {
    console.error('[ force-sync ] Erro nÃ£o tratado:', err.message);
    res.status(500).json({ sucesso: false, fonte: 'erro', erro: err.message });
  }
});

// DiagnÃ³stico ADN â€” testa cada URL e retorna status detalhado (usa certificado armazenado)
app.get('/api/admin/probe-adn', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const ambiente = config.ambiente || 'sandbox';
    const adnBaseUrl = (config.urlAdnMun || process.env.ADN_MUN_URL || AMBIENTES[ambiente]?.adnMun)?.trim() || AMBIENTES[ambiente]?.adnMun;
    const agent = loadMunCertAgent();
    const certOk = fsSync.existsSync(MUN_KEY_PEM_PATH) && fsSync.existsSync(MUN_CERT_PEM_PATH);

    if (!adnBaseUrl) {
      return res.json({ erro: 'URL ADN nÃ£o configurada.', certOk });
    }

    const baseMun = adnBaseUrl.replace(/\/$/, '');
    const baseRoot = baseMun.replace(/\/(municipios|contribuintes|dfe|DFe)\/?$/, '') || baseMun;

    // Tenta vÃ¡rias URLs e coleta resultado completo de cada uma
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
          validateStatus: () => true,  // nÃ£o jogar erro em qualquer status HTTP
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

// SimulaÃ§Ã£o ADN â€” importa notas sintÃ©ticas para teste quando ADN real nÃ£o estÃ¡ disponÃ­vel
app.post('/api/admin/simular-importacao', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const IBGE_MUNICIPIO = config.ibge || '0000000';
    const qtd = Math.min(Number(req.body?.quantidade) || 10, 50);
    const { chaves: existingChaves, nsus: existingNsus } = await db.existingChavesAndNsus();
    const currentMaxNsu = await db.getMaxNsu();

    const servicos = ['01.01.01', '01.02.01', '01.04.01', '02.01.01', '07.01.01', '14.01.00', '17.06.00'];
    const cnpjs = ['11222333000181', '22333444000195', '33444555000107', '44555666000140', '55666777000160'];
    const nomes = ['Consultoria XYZ Ltda', 'Tech Solutions SA', 'ServiÃ§os Prestados ME', 'Empresa Demo Ltda', 'Consultores Associados'];

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

      // Formato compatÃ­vel com insertNota (campos aninhados como o parseNfseFromAdn gera)
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
          xDescServ: `ServiÃ§o de simulaÃ§Ã£o â€” cÃ³digo ${servicos[servIdx]}`,
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

    console.log(`[ SimulaÃ§Ã£o ] ${salvos} notas sintÃ©ticas importadas para teste.`);
    res.json({ sucesso: true, novaNotas: salvos, maxNsu: newMax, notas: notasGeradas });
  } catch (err) {
    console.error('[ SimulaÃ§Ã£o ] Erro:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/force-apuracao', authenticate, async (req, res) => {
  const comp = req.body.competencia || '2026-03';
  const resultados = await gerarApuracaoMensal(comp);
  res.json({ sucesso: true, qdtGuias: resultados.length, resultados });
});

// â”€â”€â”€ Contribuinte Regime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ ParÃ¢metros Municipais (proxy para Sefin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/parametros-municipais/:codMun', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    const ambiente = config.ambiente || 'sandbox';
    const sefinBase = resolveUrls(config, ambiente).sefin?.replace(/\/SefinNacional$/, '').trim();
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
// PGDAS-D â€” Monitor, ReconciliaÃ§Ã£o, RBT12
// ==========================================

/** Calcula o regime de apuraÃ§Ã£o (regApurTribSN) conforme RBT12 */
function calcRegApurTribSN(rbt12, isMEI = false) {
  if (isMEI) return '3';
  if (rbt12 > 3_600_000) return '2';   // sublimite â†’ guia municipal
  return '1';                           // DAS / PGDAS-D
}

/** Soma v_serv das NFS-e dos Ãºltimos 12 meses para um CNPJ */
async function calcRbt12(cnpj) {
  const cnpjClean = cnpj.replace(/\D/g, '');
  const r = await db.pool.query(
    `SELECT COALESCE(SUM(v_serv),0) AS rbt12
     FROM notas
     WHERE prestador_cnpj = $1
       AND dh_emi >= NOW() - INTERVAL '12 months'
       AND status NOT IN ('Cancelada','SubstituÃ­da')`,
    [cnpjClean]
  );
  return Number(r.rows[0]?.rbt12 || 0);
}

/** Retorna lista de CNPJs contribuintes Ãºnicos das notas importadas */
async function listarCnpjsAtivos(competencia) {
  const r = await db.pool.query(
    `SELECT DISTINCT prestador_cnpj AS cnpj, prestador_nome AS nome
     FROM notas
     WHERE competencia = $1 AND status NOT IN ('Cancelada','SubstituÃ­da')
     ORDER BY prestador_nome`,
    [competencia]
  );
  return r.rows;
}

// â”€â”€ GET /api/pgdas/monitor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/monitor', authenticate, async (req, res) => {
  try {
    const competencia = req.query.competencia || new Date().toISOString().substring(0,7);
    const cnpjs = await listarCnpjsAtivos(competencia);

    // Conta status das declaraÃ§Ãµes
    const rDecl = await db.pool.query(
      `SELECT status, COUNT(*) AS qtd FROM pgdas_declaracoes
       WHERE competencia = $1 GROUP BY status`,
      [competencia]
    ).catch(() => ({ rows: [] }));

    const contadores = rDecl.rows.reduce((a, r) => { a[r.status] = Number(r.qtd); return a; }, {});
    const rAdn = await db.pool.query(
      `SELECT COALESCE(SUM(v_serv),0) AS rb_total, COALESCE(SUM(v_iss),0) AS iss_total
       FROM notas WHERE competencia = $1 AND status NOT IN ('Cancelada','SubstituÃ­da')`,
      [competencia]
    ).catch(() => ({ rows: [{ rb_total: 0 }] }));

    res.json({
      sucesso: true,
      competencia,
      kpis: {
        total_contribuintes: cnpjs.length,
        total_pendentes: (cnpjs.length - (contadores.ok || 0) - (contadores.enviado || 0)),
        total_divergentes: contadores.divergente || 0,
        rb_adn_total: Number(rAdn.rows[0]?.rb_total || 0),
        iss_total: Number(rAdn.rows[0]?.iss_total || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/declaracoes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/declaracoes', authenticate, async (req, res) => {
  try {
    const competencia = req.query.competencia || new Date().toISOString().substring(0,7);
    const cnpjs = await listarCnpjsAtivos(competencia);

    // Soma de receita por CNPJ no ADN
    const rAdn = await db.pool.query(
      `SELECT prestador_cnpj AS cnpj,
              COUNT(*) AS total_notas,
              COALESCE(SUM(v_serv),0) AS rb_adn,
              COALESCE(SUM(v_iss),0)  AS v_iss
       FROM notas
       WHERE competencia = $1 AND status NOT IN ('Cancelada','SubstituÃ­da')
       GROUP BY prestador_cnpj`,
      [competencia]
    );
    const adnMap = Object.fromEntries(rAdn.rows.map(r => [r.cnpj, r]));

    // DeclaraÃ§Ãµes jÃ¡ registradas
    const rDecl = await db.pool.query(
      `SELECT * FROM pgdas_declaracoes WHERE competencia = $1`,
      [competencia]
    ).catch(() => ({ rows: [] }));
    const declMap = Object.fromEntries(rDecl.rows.map(r => [r.cnpj, r]));

    // Regimes
    const rReg = await db.pool.query('SELECT cnpj, regime FROM contribuinte_regime').catch(() => ({ rows: [] }));
    const regMap = Object.fromEntries(rReg.rows.map(r => [r.cnpj, r.regime]));

    const declaracoes = await Promise.all(cnpjs.map(async c => {
      const cnpjClean = c.cnpj.replace(/\D/g,'');
      const adn   = adnMap[cnpjClean] || { rb_adn: 0, v_iss: 0, total_notas: 0 };
      const decl  = declMap[cnpjClean] || {};
      const rbt12 = await calcRbt12(cnpjClean);
      const isMEI = regMap[cnpjClean] === 'mei';
      const reg   = calcRegApurTribSN(rbt12, isMEI);

      // Determina status
      const div = Number(adn.rb_adn) - Number(decl.rb_declarada || 0);
      let status = decl.status || 'pendente';
      if (decl.rb_declarada !== undefined && decl.rb_declarada !== null) {
        status = Math.abs(div) < 1 ? 'ok' : 'divergente';
        if (decl.data_envio) status = Math.abs(div) < 1 ? 'enviado' : 'divergente';
      }

      return {
        cnpj: cnpjClean,
        nome: c.nome,
        rbt12,
        reg_apur_trib_sn: reg,
        total_notas: Number(adn.total_notas || 0),
        rb_adn: Number(adn.rb_adn || 0),
        rb_declarada: Number(decl.rb_declarada || 0),
        v_iss: Number(adn.v_iss || 0),
        divergencia: div,
        status,
        data_envio: decl.data_envio,
        observacao: decl.observacao,
      };
    }));

    res.json({ sucesso: true, competencia, declaracoes });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ POST /api/pgdas/declaracoes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/pgdas/declaracoes', authenticate, async (req, res) => {
  try {
    const { cnpj, competencia, rb_declarada, data_envio, observacao } = req.body;
    if (!cnpj || !competencia) return res.status(400).json({ erro: 'cnpj e competencia sÃ£o obrigatÃ³rios' });

    const cnpjClean = cnpj.replace(/\D/g,'');
    const rAdn = await db.pool.query(
      `SELECT COALESCE(SUM(v_serv),0) AS rb_adn FROM notas
       WHERE prestador_cnpj=$1 AND competencia=$2 AND status NOT IN ('Cancelada','SubstituÃ­da')`,
      [cnpjClean, competencia]
    );
    const rb_adn = Number(rAdn.rows[0]?.rb_adn || 0);
    const div    = rb_adn - Number(rb_declarada || 0);
    const status = Math.abs(div) < 1 ? (data_envio ? 'enviado' : 'ok') : 'divergente';

    await db.pool.query(
      `INSERT INTO pgdas_declaracoes (cnpj, competencia, rb_declarada, rb_adn, status, data_envio, observacao, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (cnpj, competencia) DO UPDATE SET
         rb_declarada=$3, rb_adn=$4, status=$5, data_envio=$6, observacao=$7, updated_at=NOW()`,
      [cnpjClean, competencia, Number(rb_declarada || 0), rb_adn, status, data_envio || null, observacao || null]
    );

    // Log de alerta se divergÃªncia acima de R$ 1
    if (Math.abs(div) >= 1) {
      await db.pool.query(
        `INSERT INTO pgdas_alertas_log (cnpj, competencia, tipo_alerta, mensagem) VALUES ($1,$2,'divergencia',$3)`,
        [cnpjClean, competencia, `DivergÃªncia de ${div.toFixed(2)} entre ADN e PGDAS-D`]
      ).catch(() => {});
    }

    res.json({ sucesso: true, status, divergencia: div });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/reconciliacao â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/reconciliacao', authenticate, async (req, res) => {
  try {
    const competencia = req.query.competencia || new Date().toISOString().substring(0,7);
    const cnpjs = await listarCnpjsAtivos(competencia);

    const rAdn = await db.pool.query(
      `SELECT prestador_cnpj AS cnpj,
              COUNT(*) AS total_notas,
              COALESCE(SUM(v_serv),0) AS rb_adn,
              COALESCE(SUM(v_iss),0)  AS v_iss
       FROM notas WHERE competencia=$1 AND status NOT IN ('Cancelada','SubstituÃ­da')
       GROUP BY prestador_cnpj`,
      [competencia]
    );
    const adnMap = Object.fromEntries(rAdn.rows.map(r => [r.cnpj, r]));

    const rDecl = await db.pool.query(
      `SELECT * FROM pgdas_declaracoes WHERE competencia=$1`,
      [competencia]
    ).catch(() => ({ rows: [] }));
    const declMap = Object.fromEntries(rDecl.rows.map(r => [r.cnpj, r]));

    const rReg = await db.pool.query('SELECT cnpj, regime FROM contribuinte_regime').catch(() => ({ rows: [] }));
    const regMap = Object.fromEntries(rReg.rows.map(r => [r.cnpj, r.regime]));

    let total_ok = 0, total_divergente = 0, rb_adn_total = 0, iss_total = 0;
    const contribuintes = await Promise.all(cnpjs.map(async c => {
      const cnpjClean = c.cnpj.replace(/\D/g,'');
      const adn   = adnMap[cnpjClean] || { rb_adn: 0, v_iss: 0, total_notas: 0 };
      const decl  = declMap[cnpjClean] || {};
      const rbt12 = await calcRbt12(cnpjClean);
      const isMEI = regMap[cnpjClean] === 'mei';
      const reg   = calcRegApurTribSN(rbt12, isMEI);
      const div   = Number(adn.rb_adn) - Number(decl.rb_declarada || 0);
      const status = !decl.rb_declarada ? 'pendente' : Math.abs(div) < 1 ? (decl.data_envio ? 'enviado' : 'ok') : 'divergente';

      rb_adn_total += Number(adn.rb_adn);
      iss_total    += Number(adn.v_iss);
      if (status === 'ok' || status === 'enviado') total_ok++;
      else if (status === 'divergente') total_divergente++;

      return { cnpj: cnpjClean, nome: c.nome, rbt12, reg_apur_trib_sn: reg,
               total_notas: Number(adn.total_notas), rb_adn: Number(adn.rb_adn),
               rb_declarada: Number(decl.rb_declarada || 0), v_iss: Number(adn.v_iss), status };
    }));

    res.json({
      sucesso: true, competencia, contribuintes,
      kpis: { total_contrib: cnpjs.length, total_ok, total_divergente,
               rb_adn_total, iss_total },
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ POST /api/pgdas/reconciliacao/:cnpj/:competencia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/pgdas/reconciliacao/:cnpj/:competencia', authenticate, async (req, res) => {
  try {
    const cnpjClean = req.params.cnpj.replace(/\D/g,'');
    const competencia = req.params.competencia;

    const rAdn = await db.pool.query(
      `SELECT COALESCE(SUM(v_serv),0) AS rb_adn FROM notas
       WHERE prestador_cnpj=$1 AND competencia=$2 AND status NOT IN ('Cancelada','SubstituÃ­da')`,
      [cnpjClean, competencia]
    );
    const rb_adn = Number(rAdn.rows[0]?.rb_adn || 0);

    const rDecl = await db.pool.query(
      `SELECT rb_declarada FROM pgdas_declaracoes WHERE cnpj=$1 AND competencia=$2`,
      [cnpjClean, competencia]
    ).catch(() => ({ rows: [] }));

    const rb_declarada = Number(rDecl.rows[0]?.rb_declarada || 0);
    const div = rb_adn - rb_declarada;
    const status = rb_declarada === 0 ? 'pendente' : Math.abs(div) < 1 ? 'ok' : 'divergente';

    await db.pool.query(
      `INSERT INTO pgdas_declaracoes (cnpj, competencia, rb_adn, rb_declarada, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (cnpj, competencia) DO UPDATE SET rb_adn=$3, status=$5, updated_at=NOW()`,
      [cnpjClean, competencia, rb_adn, rb_declarada, status]
    ).catch(() => {});

    res.json({ sucesso: true, cnpj: cnpjClean, competencia, rb_adn, rb_declarada, divergencia: div, status });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/notas-pa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/notas-pa', authenticate, async (req, res) => {
  try {
    const { cnpj, competencia } = req.query;
    if (!cnpj || !competencia) return res.status(400).json({ erro: 'cnpj e competencia obrigatÃ³rios' });

    const r = await db.pool.query(
      `SELECT n_nfse, dh_emi, competencia, d_compet, tomador_nome, tomador_cnpj,
              v_serv, v_iss, p_aliq, c_stat, status, tributos, chave_acesso
       FROM notas
       WHERE prestador_cnpj=$1 AND competencia=$2
       ORDER BY dh_emi DESC`,
      [cnpj.replace(/\D/g,''), competencia]
    );
    res.json({ sucesso: true, notas: r.rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/rbt12/:cnpj â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/rbt12/:cnpj', authenticate, async (req, res) => {
  try {
    const cnpj  = req.params.cnpj.replace(/\D/g,'');
    const rbt12 = await calcRbt12(cnpj);
    const isMEI = false; // TODO: integrar com registro de regime
    const reg   = calcRegApurTribSN(rbt12, isMEI);
    const sublimite = rbt12 >= 3_600_000;
    res.json({ sucesso: true, cnpj, rbt12, reg_apur_trib_sn: reg,
               sublimite, mensagem: sublimite
                 ? 'ATENÃ‡ÃƒO: RBT12 â‰¥ R$ 3,6M â€” ISS deve ser recolhido via guia municipal'
                 : 'Simples Nacional â€” ISS recolhido via DAS/PGDAS-D' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/sublimites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/sublimites', authenticate, async (req, res) => {
  try {
    // Retorna contribuintes prÃ³ximos ou acima do sublimite (R$ 3,2M - 4,8M)
    const r = await db.pool.query(
      `SELECT prestador_cnpj AS cnpj, prestador_nome AS nome,
              COALESCE(SUM(v_serv),0) AS rbt12
       FROM notas
       WHERE dh_emi >= NOW() - INTERVAL '12 months'
         AND status NOT IN ('Cancelada','SubstituÃ­da')
       GROUP BY prestador_cnpj, prestador_nome
       HAVING SUM(v_serv) >= 3200000
       ORDER BY rbt12 DESC`
    );
    res.json({ sucesso: true, contribuintes: r.rows.map(row => ({
      ...row, rbt12: Number(row.rbt12),
      reg_apur_trib_sn: calcRegApurTribSN(Number(row.rbt12)),
      alerta: Number(row.rbt12) >= 3_600_000 ? 'sublimite' : 'proximo',
    })) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/historico-arrecadacao â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/historico-arrecadacao', authenticate, async (req, res) => {
  try {
    const { ano, cnpj } = req.query;
    let query = `SELECT * FROM arrecadacao_historico WHERE 1=1`;
    const params = [];
    if (ano)  { params.push(ano);  query += ` AND ano=$${params.length}`; }
    if (cnpj) { params.push(cnpj.replace(/\D/g,'')); query += ` AND cnpj=$${params.length}`; }
    query += ' ORDER BY ano DESC, competencia DESC';

    const r = await db.pool.query(query, params).catch(() => ({ rows: [] }));
    res.json({ sucesso: true, registros: r.rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ POST /api/pgdas/historico-arrecadacao/consolidar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/pgdas/historico-arrecadacao/consolidar', authenticate, async (req, res) => {
  try {
    const { ano } = req.body;
    if (!ano) return res.status(400).json({ erro: 'ano Ã© obrigatÃ³rio' });

    // Agrupa notas por CNPJ/competÃªncia do ano solicitado
    const r = await db.pool.query(
      `SELECT prestador_cnpj AS cnpj, competencia, EXTRACT(YEAR FROM d_compet) AS ano,
              COUNT(*) AS total_notas, COALESCE(SUM(v_serv),0) AS v_servico_bruto,
              COALESCE(SUM(v_iss),0) AS v_iss_apurado,
              COALESCE(SUM(CASE WHEN status='Cancelada' THEN 1 ELSE 0 END),0) AS total_cancelamentos,
              COALESCE(SUM(CASE WHEN status='SubstituÃ­da' THEN 1 ELSE 0 END),0) AS total_substituicoes
       FROM notas
       WHERE EXTRACT(YEAR FROM d_compet) = $1
       GROUP BY prestador_cnpj, competencia, EXTRACT(YEAR FROM d_compet)`,
      [ano]
    );

    let inseridos = 0;
    for (const row of r.rows) {
      // Gera hash SHA-256 do registro para imutabilidade
      const hashData = JSON.stringify({ cnpj: row.cnpj, competencia: row.competencia, v_iss: row.v_iss_apurado, ts: row.ano });
      const hash = crypto.createHash('sha256').update(hashData).digest('hex');

      await db.pool.query(
        `INSERT INTO arrecadacao_historico
           (cnpj, competencia, ano, total_notas, v_servico_bruto, v_iss_apurado, v_iss_liquido, hash_sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7)
         ON CONFLICT (cnpj, competencia) DO NOTHING`,
        [row.cnpj, row.competencia, Number(row.ano), Number(row.total_notas),
         Number(row.v_servico_bruto), Number(row.v_iss_apurado), hash]
      ).catch(() => {});
      inseridos++;
    }

    res.json({ sucesso: true, ano, registros_consolidados: inseridos });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/nt-versoes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/nt-versoes', authenticate, async (req, res) => {
  try {
    const r = await db.pool.query('SELECT * FROM nt_versoes ORDER BY data_publicacao DESC NULLS LAST').catch(() => ({ rows: [] }));
    res.json({ sucesso: true, versoes: r.rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ PUT /api/pgdas/nt-versoes/:codigo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.put('/api/pgdas/nt-versoes/:codigo', authenticate, async (req, res) => {
  try {
    const { status, implementado_em } = req.body;
    await db.pool.query(
      `UPDATE nt_versoes SET status=$1, implementado_em=$2 WHERE codigo=$3`,
      [status, implementado_em || null, req.params.codigo]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/transmissao/queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/transmissao/queue', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let q = 'SELECT * FROM transmissao_queue';
    const params = [];
    if (status) { params.push(status); q += ` WHERE status=$1`; }
    q += ' ORDER BY criado_em DESC LIMIT 100';
    const r = await db.pool.query(q, params).catch(() => ({ rows: [] }));
    res.json({ sucesso: true, itens: r.rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ POST /api/transmissao/reprocessar/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/transmissao/reprocessar/:id', authenticate, async (req, res) => {
  try {
    await db.pool.query(
      `UPDATE transmissao_queue SET status='pendente', tentativas=0, proxima_tentativa=NOW(), ultimo_erro=NULL WHERE id=$1`,
      [req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/municipio/cert-status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/municipio/cert-status', authenticate, async (req, res) => {
  try {
    const config = await db.getConfig();
    if (!config.cert_not_after) {
      return res.json({ sucesso: true, status: 'sem_cert', mensagem: 'Nenhum certificado digital carregado.' });
    }
    const expiry = new Date(config.cert_not_after);
    const hoje   = new Date();
    const diasRestantes = Math.ceil((expiry - hoje) / (1000 * 60 * 60 * 24));

    let nivel = 'ok';
    if (diasRestantes <= 0)  nivel = 'vencido';
    else if (diasRestantes <= 7)  nivel = 'critico';
    else if (diasRestantes <= 15) nivel = 'alerta';
    else if (diasRestantes <= 30) nivel = 'aviso';

    res.json({
      sucesso: true, status: nivel,
      dias_restantes: diasRestantes,
      data_vencimento: expiry.toISOString(),
      cert_subject: config.cert_subject,
      mensagem: nivel === 'ok' ? `Certificado vÃ¡lido por ${diasRestantes} dias`
              : nivel === 'vencido' ? 'CERTIFICADO VENCIDO â€” renove imediatamente!'
              : `âš ï¸ Certificado vence em ${diasRestantes} dia(s)`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==========================================
// PGDAS-D Import
// ==========================================
import { parsePgdas } from './pgdas-parser.js';

// â”€â”€ POST /api/pgdas/importar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Body: { nome_arquivo, content (base64), codTOM }
app.post('/api/pgdas/importar', authenticate, async (req, res) => {
  const { nome_arquivo, content, codTOM } = req.body || {};

  if (!content) return res.status(400).json({ erro: 'Campo "content" (base64) Ã© obrigatÃ³rio.' });
  if (!codTOM)  return res.status(400).json({ erro: 'Campo "codTOM" Ã© obrigatÃ³rio.' });

  let buffer;
  try {
    buffer = Buffer.from(content, 'base64');
  } catch {
    return res.status(400).json({ erro: 'Content invÃ¡lido â€” use Base64.' });
  }

  let parsed;
  try {
    parsed = parsePgdas(buffer, { codTOM: String(codTOM).padStart(4, '0') });
  } catch (err) {
    return res.status(500).json({ erro: `Falha ao parsear arquivo: ${err.message}` });
  }

  if (parsed.erros.length && !parsed.resultado.length) {
    return res.status(422).json({ erro: parsed.erros.join('; '), detalhes: parsed.erros });
  }

  const usuario = req.user?.login || 'sistema';
  let importados = 0;

  try {
    // Registra a importaÃ§Ã£o
    const { rows: [imp] } = await db.pool.query(
      `INSERT INTO pgdas_importacoes
         (nome_arquivo, cod_tom, total_registros, retidos_malha, impedidos_iss,
          retificacoes, importado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [nome_arquivo || 'upload', codTOM, parsed.totais.total,
       parsed.totais.retidos_malha, parsed.totais.impedidos_iss,
       parsed.totais.retificacoes, usuario]
    );
    const importacaoId = imp.id;

    // Upsert de cada declaraÃ§Ã£o
    for (const r of parsed.resultado) {
      if (!r.cnpj || !r.competencia) continue;

      await db.pool.query(
        `INSERT INTO pgdas_declaracoes
           (cnpj, competencia, rbt12_oficial, v_iss_declarado, retido_malha,
            impedido_iss, operacao, v_receita_pa, cod_tom_municipio,
            fonte_importacao, status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           CASE WHEN $5 THEN 'malha' ELSE 'importado' END, NOW())
         ON CONFLICT (cnpj, competencia) DO UPDATE SET
           rbt12_oficial       = EXCLUDED.rbt12_oficial,
           v_iss_declarado     = EXCLUDED.v_iss_declarado,
           retido_malha        = EXCLUDED.retido_malha,
           impedido_iss        = EXCLUDED.impedido_iss,
           operacao            = EXCLUDED.operacao,
           v_receita_pa        = EXCLUDED.v_receita_pa,
           cod_tom_municipio   = EXCLUDED.cod_tom_municipio,
           fonte_importacao    = EXCLUDED.fonte_importacao,
           status              = CASE
             WHEN EXCLUDED.retido_malha THEN 'malha'
             WHEN ABS(COALESCE(pgdas_declaracoes.rb_adn,0) - EXCLUDED.v_receita_pa) > 10
               THEN 'divergente'
             ELSE 'importado'
           END,
           updated_at          = NOW()`,
        [r.cnpj, r.competencia, r.rbt12, r.v_iss_municipio,
         r.retido_malha, r.impedido_iss, r.operacao, r.v_receita_pa,
         codTOM, importacaoId]
      );
      importados++;

      // Se ImpedidoIcmsIss â†’ atualiza regime do contribuinte
      if (r.impedido_iss) {
        await db.pool.query(
          `UPDATE contribuintes SET reg_apur_trib_sn = '2'
           WHERE cnpj = $1 AND (reg_apur_trib_sn IS NULL OR reg_apur_trib_sn <> '2')`,
          [r.cnpj]
        ).catch(() => {});
      }
    }

    // Atualiza o log com o total real importado
    await db.pool.query(
      `UPDATE pgdas_importacoes SET importados = $1, status = 'ok' WHERE id = $2`,
      [importados, importacaoId]
    );

    res.json({
      sucesso: true,
      importados,
      total_arquivo: parsed.totais.total,
      retidos_malha: parsed.totais.retidos_malha,
      impedidos_iss: parsed.totais.impedidos_iss,
      retificacoes:  parsed.totais.retificacoes,
      versao_layout: parsed.versao,
      avisos:        parsed.erros,
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// â”€â”€ GET /api/pgdas/importacoes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/pgdas/importacoes', authenticate, async (req, res) => {
  try {
    const { rows } = await db.pool.query(
      `SELECT id, nome_arquivo, data_arquivo, cod_tom,
              total_registros, importados, retidos_malha, impedidos_iss,
              retificacoes, status, mensagem, importado_por,
              importado_em
       FROM pgdas_importacoes
       ORDER BY importado_em DESC
       LIMIT 50`
    );
    res.json({ sucesso: true, importacoes: rows });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==========================================
// Proxy â€” ServiÃ§o de IA (Python / FastAPI)
// ==========================================

app.use('/api/ia', authenticate, async (req, res) => {
  try {
    const url      = `${IA_URL}/api/ia${req.path}`;
    const response = await axios({
      method:         req.method,
      url,
      params:         req.query,
      data:           req.body,
      validateStatus: () => true,
      timeout:        30_000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(503).json({
      error:  'ServiÃ§o de IA indisponÃ­vel',
      detail: err.message,
      dica:   'Execute src/ia/start.bat ou python src/ia/main.py para iniciar o microserviÃ§o.',
    });
  }
});

// ==========================================
// Startup
// ==========================================

// â”€â”€ Gerenciamento do MicroserviÃ§o Python de IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _iaProc = null; // referÃªncia ao processo filho

/**
 * Verifica se o serviÃ§o de IA jÃ¡ estÃ¡ respondendo na porta configurada.
 * Retorna true se estiver no ar, false caso contrÃ¡rio.
 */
async function _iaOnline() {
  try {
    const res = await axios.get(`${IA_URL}/api/ia/status`, { timeout: 2_000, validateStatus: () => true });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Monta o PATH completo do sistema (Machine + User) para garantir que
 * o Python seja encontrado mesmo quando o processo Node foi iniciado
 * sem o PATH atualizado.
 */
function _fullSystemPath() {
  if (process.platform !== 'win32') return process.env.PATH || '';
  try {
    const machine = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      '[System.Environment]::GetEnvironmentVariable("Path","Machine")',
    ], { encoding: 'utf8', timeout: 5000 }).stdout?.trim() || '';

    const user = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      '[System.Environment]::GetEnvironmentVariable("Path","User")',
    ], { encoding: 'utf8', timeout: 5000 }).stdout?.trim() || '';

    return [machine, user, process.env.PATH || ''].filter(Boolean).join(';');
  } catch {
    return process.env.PATH || '';
  }
}

/**
 * Encontra o executÃ¡vel Python disponÃ­vel no sistema.
 * Usa PATH completo do sistema + caminhos absolutos conhecidos como fallback.
 */
async function _findPython() {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);

  const fullPath = _fullSystemPath();
  const env = { ...process.env, PATH: fullPath };

  // Candidatos por nome (PATH atualizado)
  const nameCandidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  // Caminhos absolutos conhecidos (Windows) â€” fallback se PATH falhar
  const absCandidates = process.platform === 'win32' ? [
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python312\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python310\\python.exe`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python39\\python.exe`,
    'C:\\Python313\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
  ] : [];

  // Primeiro tenta por nome com PATH completo
  for (const cmd of nameCandidates) {
    try {
      const result = await exec(cmd, ['--version'], { env, timeout: 5000 });
      return { cmd, env };
    } catch { /* tenta o prÃ³ximo */ }
  }

  // Depois tenta caminhos absolutos
  for (const abs of absCandidates) {
    if (!fsSync.existsSync(abs)) continue;
    try {
      await exec(abs, ['--version'], { timeout: 5000 });
      return { cmd: abs, env };
    } catch { /* tenta o prÃ³ximo */ }
  }

  return null;
}

/**
 * Aguarda o serviÃ§o de IA responder com polling, atÃ© o timeout.
 */
async function _waitForIa(timeoutMs = 30_000, intervalMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await _iaOnline()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Inicia o microserviÃ§o Python de IA automaticamente.
 * - Se jÃ¡ estiver rodando: apenas confirma e nÃ£o spawn novo processo.
 * - Se nÃ£o estiver: localiza Python, instala deps e sobe o serviÃ§o.
 * - Em caso de crash: reinicia automaticamente atÃ© 3 vezes.
 */
async function startIaService(attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const iaDir    = path.join(__dirname, 'ia');
  const iaScript = path.join(iaDir, 'main.py');
  const reqFile  = path.join(iaDir, 'requirements.txt');

  if (!fsSync.existsSync(iaScript)) {
    console.warn('[ IA ] main.py nÃ£o encontrado â€” mÃ³dulo de IA desativado.');
    return;
  }

  // Verifica se jÃ¡ estÃ¡ no ar (ex: iniciado externamente ou reinÃ­cio do Node)
  if (await _iaOnline()) {
    console.log(`[ IA ] ServiÃ§o jÃ¡ estÃ¡ ativo na porta ${IA_PORT} âœ“`);
    return;
  }

  const pythonResult = await _findPython();
  if (!pythonResult) {
    console.warn('[ IA ] Python nÃ£o encontrado. Instale Python 3.9+ e adicione ao PATH.');
    console.warn('[ IA ]   Download: https://www.python.org/downloads/');
    return;
  }
  const { cmd: python, env: pythonEnv } = pythonResult;

  console.log(`[ IA ] Iniciando microserviÃ§o Python (tentativa ${attempt}/${MAX_ATTEMPTS})...`);

  // Ambiente completo para o processo filho (PATH do sistema + flags UTF-8)
  const childEnv = {
    ...pythonEnv,
    PYTHONUTF8:       '1',
    PYTHONIOENCODING: 'utf-8',
  };

  // Instala dependÃªncias silenciosamente na primeira tentativa
  if (attempt === 1 && fsSync.existsSync(reqFile)) {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)(python, ['-m', 'pip', 'install', '-r', reqFile, '--quiet'], {
        timeout: 120_000,
        env: childEnv,
      });
      console.log('[ IA ] DependÃªncias Python verificadas âœ“');
    } catch (e) {
      console.warn(`[ IA ] Aviso ao instalar deps: ${e.message}`);
    }
  }

  // Spawna o processo Python com o ambiente completo
  _iaProc = spawn(python, [iaScript], {
    cwd:   iaDir,
    stdio: 'pipe',
    env:   childEnv,
  });

  _iaProc.stdout.on('data', d => process.stdout.write(`[ IA ] ${d}`));
  _iaProc.stderr.on('data', d => {
    const msg = d.toString();
    // Suprime o aviso de porta em uso (esperado se jÃ¡ estava rodando)
    if (!msg.includes('10048') && !msg.includes('address already in use')) {
      process.stderr.write(`[ IA ] ${msg}`);
    }
  });

  _iaProc.on('error', err => {
    console.warn(`[ IA ] Erro ao iniciar processo: ${err.message}`);
  });

  _iaProc.on('exit', (code, signal) => {
    _iaProc = null;
    if (code === 1 && attempt === 1) {
      // Porta ocupada na primeira tentativa â€” serviÃ§o jÃ¡ estava rodando
      console.log('[ IA ] ServiÃ§o jÃ¡ estava ativo em outra instÃ¢ncia âœ“');
      return;
    }
    if (code !== 0 && signal !== 'SIGTERM' && attempt < MAX_ATTEMPTS) {
      console.warn(`[ IA ] Processo encerrado (code=${code}). Reiniciando em 5s...`);
      setTimeout(() => startIaService(attempt + 1), 5_000);
    } else if (code !== 0) {
      console.warn(`[ IA ] ServiÃ§o de IA encerrado apÃ³s ${attempt} tentativas. Reinicie manualmente: src/ia/start.bat`);
    }
  });

  // Aguarda o serviÃ§o ficar pronto (atÃ© 30s)
  const pronto = await _waitForIa(30_000);
  if (pronto) {
    console.log(`[ IA ] MicroserviÃ§o de InteligÃªncia Fiscal ativo na porta ${IA_PORT} âœ“`);
  } else {
    console.warn(`[ IA ] ServiÃ§o nÃ£o respondeu em 30s â€” verificar logs acima.`);
  }
}

// Encerra o processo filho ao desligar o Node
process.on('exit',    () => _iaProc?.kill());
process.on('SIGINT',  () => { _iaProc?.kill(); process.exit(0); });
process.on('SIGTERM', () => { _iaProc?.kill(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`[ Freire ] Backend ativo na porta ${PORT} (${NODE_ENV})`);
  startIaService();
});

