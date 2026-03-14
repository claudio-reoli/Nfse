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
  // Suporta formatos: YYYY-MM-DD, YYYY-MM-DDTHH... (tira os 10 primeiros)
  //                   YYYY-MM (7 chars → adiciona -01 para data válida)
  //                   YYYYMM  (6 chars → interpreta como YYYY-MM-01)
  let dCompetDate = null;
  if (dCompet) {
    if (dCompet.length >= 10) {
      dCompetDate = dCompet.substring(0, 10);
    } else if (dCompet.length === 7 && dCompet.includes('-')) {
      dCompetDate = dCompet + '-01';
    } else if (dCompet.length === 6 && /^\d{6}$/.test(dCompet)) {
      dCompetDate = `${dCompet.substring(0, 4)}-${dCompet.substring(4, 6)}-01`;
    }
  }

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

export async function updateNotaStatus(chaveAcesso, status) {
  const chave = String(chaveAcesso || '').replace(/\D/g, '');
  if (!chave) return;
  await pool.query(
    "UPDATE notas SET status = $1 WHERE regexp_replace(chave_acesso, '[^0-9]', '', 'g') = $2 OR chave_acesso = $2",
    [status, chave]
  );
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

// ─── Contribuinte Sync State (ADN) ────────────────────────────────────────────

export async function getContribuinteMaxNsu(cnpj) {
  const r = await pool.query(
    'SELECT ultimo_nsu FROM contribuinte_sync_state WHERE cnpj = $1',
    [cnpj.replace(/\D/g, '')]
  );
  return r.rows[0]?.ultimo_nsu ?? 0;
}

export async function updateContribuinteMaxNsu(cnpj, nsu) {
  await pool.query(
    `INSERT INTO contribuinte_sync_state (cnpj, ultimo_nsu, atualizado_em)
     VALUES ($1, $2, NOW())
     ON CONFLICT (cnpj) DO UPDATE SET ultimo_nsu = $2, atualizado_em = NOW()`,
    [cnpj.replace(/\D/g, ''), nsu]
  );
}

// ─── Rate-limit ADN (1h quando sem docs novos) ────────────────────────────────

export async function getLastEmptySyncAt() {
  const r = await pool.query(
    "SELECT last_empty_sync_at FROM sync_state WHERE id = 1"
  );
  return r.rows[0]?.last_empty_sync_at ?? null;
}

export async function setLastEmptySyncAt() {
  await pool.query(
    'UPDATE sync_state SET last_empty_sync_at = NOW() WHERE id = 1'
  );
}

export async function clearLastEmptySyncAt() {
  await pool.query(
    'UPDATE sync_state SET last_empty_sync_at = NULL WHERE id = 1'
  );
}

// ─── Decisão Judicial ────────────────────────────────────────────────────────

export async function getDecisaoJudicialByCnpj(cnpj) {
  const r = await pool.query(
    'SELECT * FROM decisao_judicial WHERE cnpj_contribuinte = $1 AND ativo = true',
    [cnpj.replace(/\D/g, '')]
  );
  return rowsToCamel(r.rows);
}

export async function insertDecisaoJudicial(data) {
  await pool.query(
    `INSERT INTO decisao_judicial (cnpj_contribuinte, numero_processo, tipo)
     VALUES ($1, $2, $3)
     ON CONFLICT (cnpj_contribuinte, numero_processo) DO UPDATE SET ativo = true`,
    [data.cnpj.replace(/\D/g, ''), data.numeroProcesso, data.tipo || 'judicial']
  );
}

// ─── Contribuinte Regime (Simples/MEI) ────────────────────────────────────────

export async function getContribuinteRegime(cnpj) {
  const r = await pool.query(
    'SELECT * FROM contribuinte_regime WHERE cnpj = $1',
    [cnpj.replace(/\D/g, '')]
  );
  return rowToCamel(r.rows[0]);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Advisory lock previne execução concorrente (node --watch pode reiniciar 2x em seguida)
    await client.query('SELECT pg_advisory_lock(9876543)');
    const migrationsDir = join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    for (const f of sqlFiles) {
      const sql = await fs.readFile(join(migrationsDir, f), 'utf-8');
      await client.query(sql);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(9876543)').catch(() => {});
    client.release();
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function ping() {
  const r = await pool.query('SELECT 1');
  return r.rows.length > 0;
}

export { pool };
