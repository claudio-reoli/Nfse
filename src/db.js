/**
 * NFSe Freire — Data Access Layer (PostgreSQL)
 * Substitui getDb/saveDb do db.json por queries SQL.
 */
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nfse:nfse_dev@localhost:5433/nfse';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

// ─── Helpers: snake_case ↔ camelCase ────────────────────────────────────────

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toSnake(str) {
  return str.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function rowToCamel(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v;
  }
  return out;
}

function rowsToCamel(rows) {
  return rows.map(rowToCamel);
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getConfig() {
  const r = await pool.query('SELECT * FROM config WHERE id = 1');
  const row = r.rows[0];
  if (!row) return {};
  const c = rowToCamel(row);
  delete c.id;
  return c;
}

export async function updateConfig(data) {
  const keys = Object.keys(data).filter(k => k !== 'id');
  if (keys.length === 0) return await getConfig();
  const sets = keys.map(k => `${toSnake(k)} = $${keys.indexOf(k) + 1}`).join(', ');
  const vals = keys.map(k => data[k]);
  await pool.query(
    `UPDATE config SET ${sets} WHERE id = 1`,
    vals
  );
  return await getConfig();
}

// ─── SyncState ───────────────────────────────────────────────────────────────

export async function getMaxNsu() {
  const r = await pool.query('SELECT max_nsu_lido FROM sync_state WHERE id = 1');
  return r.rows[0]?.max_nsu_lido ?? 0;
}

/** Maior NSU presente na tabela notas (para garantir continuidade se sync_state foi resetado) */
export async function getMaxNsuFromNotas() {
  const r = await pool.query('SELECT COALESCE(MAX(nsu), 0)::int AS max_nsu FROM notas');
  return r.rows[0]?.max_nsu ?? 0;
}

/** Retorna o NSU a partir do qual continuar a importação (maior entre sync_state e notas) */
export async function getMaxNsuParaContinuar() {
  const [fromSync, fromNotas] = await Promise.all([getMaxNsu(), getMaxNsuFromNotas()]);
  const max = Math.max(fromSync, fromNotas);
  if (fromNotas > fromSync) {
    await pool.query('UPDATE sync_state SET max_nsu_lido = $1 WHERE id = 1', [max]);
  }
  return max;
}

export async function updateMaxNsu(n) {
  await pool.query('UPDATE sync_state SET max_nsu_lido = $1 WHERE id = 1', [n]);
  return n;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByCpf(cpf) {
  const r = await pool.query('SELECT * FROM users WHERE cpf = $1', [cpf]);
  return rowToCamel(r.rows[0]);
}

export async function getUsers(filter = {}) {
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.userType) {
    sql += ` AND user_type = $${i++}`;
    params.push(filter.userType);
  }
  if (filter.cnpjVinculado !== undefined) {
    sql += ` AND cnpj_vinculado = $${i++}`;
    params.push(filter.cnpjVinculado);
  }
  sql += ' ORDER BY name';
  const r = await pool.query(sql, params);
  return rowsToCamel(r.rows);
}

export async function insertUser(user) {
  const { cpf, name, email, celular, role, userType, passwordHash, authLevel, cnpjVinculado, status } = user;
  await pool.query(
    `INSERT INTO users (cpf, name, email, celular, role, user_type, password_hash, auth_level, cnpj_vinculado, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [cpf, name, email || '', celular || '', role, userType, passwordHash, authLevel || null, cnpjVinculado || '', status || 'Ativo']
  );
  return await getUserByCpf(cpf);
}

export async function updateUser(cpf, data) {
  const allowed = ['name', 'email', 'celular', 'role', 'authLevel', 'status'];
  const updates = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (data[k] !== undefined) {
      updates.push(`${toSnake(k)} = $${i++}`);
      vals.push(data[k]);
    }
  }
  if (updates.length === 0) return await getUserByCpf(cpf);
  vals.push(cpf);
  await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE cpf = $${i}`,
    vals
  );
  return await getUserByCpf(cpf);
}

export async function deleteUser(cpf) {
  await pool.query('DELETE FROM users WHERE cpf = $1', [cpf]);
}

// ─── Notas ───────────────────────────────────────────────────────────────────

function notaRowToNota(row) {
  if (!row) return null;
  const n = {
    chaveAcesso: row.chave_acesso,
    nsu: row.nsu,
    tipoDocumento: row.tipo_documento || 'NFSE',
    fonte: row.fonte || 'ADN',
    dataImportacao: row.data_importacao,
    status: row.status || 'Ativa',
    competencia: row.competencia,
    dadosGerais: row.dados_gerais || {},
    prestador: row.prestador || {},
    tomador: row.tomador || {},
    servico: row.servico || {},
    valores: row.valores || {},
    tributos: row.tributos || {},
  };
  return n;
}

export async function getNotaByChave(chaveAcesso) {
  const chave = String(chaveAcesso || '').replace(/\D/g, '');
  if (!chave || chave.length !== 50) return null;
  const r = await pool.query(
    'SELECT * FROM notas WHERE regexp_replace(chave_acesso, \'[^0-9]\', \'\', \'g\') = $1 OR chave_acesso = $1',
    [chave]
  );
  return r.rows[0] ? notaRowToNota(r.rows[0]) : null;
}

export async function getNotas(filters = {}) {
  let sql = 'SELECT * FROM notas WHERE 1=1';
  const params = [];
  let i = 1;
  if (filters.cnpj) {
    sql += ` AND (prestador_cnpj = $${i} OR tomador_cnpj = $${i})`;
    params.push(filters.cnpj.replace(/\D/g, ''));
    i++;
  }
  if (filters.cLocIncid) {
    sql += ` AND c_loc_incid = $${i++}`;
    params.push(filters.cLocIncid);
  }
  sql += ' ORDER BY nsu DESC';
  const r = await pool.query(sql, params);
  return r.rows.map(notaRowToNota);
}

export async function existingChavesAndNsus() {
  const r = await pool.query('SELECT chave_acesso, nsu FROM notas');
  return {
    chaves: new Set(r.rows.map(x => x.chave_acesso)),
    nsus: new Set(r.rows.map(x => x.nsu)),
  };
}

export async function insertNota(nota) {
  const dg = nota.dadosGerais || {};
  const prest = nota.prestador || {};
  const tom = nota.tomador || {};
  const val = nota.valores || {};
  const dCompet = dg.dCompet || nota.competencia || '';
  const dCompetDate = dCompet ? (dCompet.length >= 10 ? dCompet.substring(0, 10) : null) : null;

  await pool.query(
    `INSERT INTO notas (
      chave_acesso, nsu, tipo_documento, fonte, data_importacao,
      dh_emi, d_compet, n_nfse, c_loc_incid, c_stat,
      prestador_cnpj, prestador_nome, tomador_cnpj, tomador_nome,
      v_serv, v_bc, v_liq, v_iss, p_aliq,
      dados_gerais, prestador, tomador, servico, valores, tributos, status, competencia
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
    [
      nota.chaveAcesso,
      nota.nsu ?? 0,
      nota.tipoDocumento || 'NFSE',
      nota.fonte || 'ADN',
      nota.dataImportacao || new Date().toISOString(),
      dg.dhEmi || null,
      dCompetDate,
      dg.nNFSe || null,
      dg.cLocIncid || null,
      dg.cStat || null,
      prest.CNPJ || prest.cnpj || null,
      prest.xNome || prest.nome || null,
      tom.CNPJ || tom.cnpj || null,
      tom.xNome || tom.nome || null,
      val.vServ ?? val.vBC ?? 0,
      val.vBC ?? 0,
      val.vLiq ?? 0,
      val.vISS ?? 0,
      val.pAliqAplic ?? (nota.tributos?.issqn?.pAliq) ?? 0,
      JSON.stringify(dg),
      JSON.stringify(prest),
      JSON.stringify(tom),
      JSON.stringify(nota.servico || {}),
      JSON.stringify(val),
      JSON.stringify(nota.tributos || {}),
      nota.status || 'Ativa',
      nota.competencia || dCompet || null,
    ]
  );
}

export async function insertNotas(notas) {
  for (const n of notas) {
    await insertNota(n);
  }
}

// ─── Apurações ───────────────────────────────────────────────────────────────

export async function getApuracoesByCnpj(cnpj) {
  const r = await pool.query(
    'SELECT * FROM apuracoes WHERE cnpj = $1 ORDER BY competencia DESC',
    [cnpj]
  );
  return rowsToCamel(r.rows);
}

export async function deleteApuracoesByCompetenciaAndStatus(competencia, status) {
  await pool.query(
    'DELETE FROM apuracoes WHERE competencia = $1 AND status = $2',
    [competencia, status]
  );
}

export async function upsertApuracao(apu) {
  await pool.query(
    `INSERT INTO apuracoes (id, cnpj, competencia, total_notas_emitidas, total_iss_proprio, total_iss_terceiros, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       total_notas_emitidas = EXCLUDED.total_notas_emitidas,
       total_iss_proprio = EXCLUDED.total_iss_proprio,
       total_iss_terceiros = EXCLUDED.total_iss_terceiros,
       status = EXCLUDED.status`,
    [
      apu.id,
      apu.cnpj,
      apu.competencia,
      apu.totalNotasEmitidas ?? 0,
      apu.totalIssProprio ?? 0,
      apu.totalIssTerceiros ?? 0,
      apu.status || 'Aberta',
    ]
  );
}

export async function getApuracaoById(id) {
  const r = await pool.query('SELECT * FROM apuracoes WHERE id = $1', [id]);
  return rowToCamel(r.rows[0]);
}

export async function updateApuracaoStatus(id, status) {
  await pool.query('UPDATE apuracoes SET status = $1 WHERE id = $2', [status, id]);
  return await getApuracaoById(id);
}

export async function updateApuracao(id, data) {
  const updates = [];
  const vals = [];
  let i = 1;
  if (data.status !== undefined) {
    updates.push(`status = $${i++}`);
    vals.push(data.status);
  }
  if (data.guia !== undefined) {
    updates.push(`guia = $${i++}`);
    vals.push(JSON.stringify(data.guia));
  }
  if (data.dataPagamento !== undefined) {
    updates.push(`data_pagamento = $${i++}`);
    vals.push(data.dataPagamento);
  }
  if (updates.length === 0) return await getApuracaoById(id);
  vals.push(id);
  await pool.query(`UPDATE apuracoes SET ${updates.join(', ')} WHERE id = $${i}`, vals);
  return await getApuracaoById(id);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export async function runMigrations() {
  const migrationsDir = join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
  for (const f of sqlFiles) {
    const sql = await fs.readFile(join(migrationsDir, f), 'utf-8');
    await pool.query(sql);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function ping() {
  const r = await pool.query('SELECT 1');
  return r.rows.length > 0;
}

export { pool };
