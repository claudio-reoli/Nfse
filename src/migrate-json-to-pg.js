#!/usr/bin/env node
/**
 * Migra dados do db.json para PostgreSQL.
 * Uso: node src/migrate-json-to-pg.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const DB_JSON_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

async function migrate() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nfse:nfse_dev@localhost:5433/nfse';
  const url = process.env.DATABASE_URL;
  console.log('[ Migrate ] DATABASE_URL:', url.replace(/:[^:@]+@/, ':****@'));
  const db = await import('./db.js');
  console.log('[ Migrate ] Lendo db.json...');
  let raw;
  try {
    raw = await fs.readFile(DB_JSON_PATH, 'utf-8');
  } catch (err) {
    console.error('[ Migrate ] db.json não encontrado:', DB_JSON_PATH);
    process.exit(1);
  }

  const data = JSON.parse(raw);
  console.log('[ Migrate ] Executando migrações SQL...');
  await db.runMigrations();

  const config = data.config || {};
  const configUpdates = {};
  const configKeys = ['ibge', 'ambiente', 'nome', 'uf', 'cnpj', 'certSubject', 'certSerialNumber', 'certNotBefore', 'certNotAfter', 'certLoadedAt', 'certFileName', 'certKeyAlgorithm', 'certIssuer', 'inscEstadual', 'endereco', 'email', 'telefone', 'certPassphrase'];
  for (const k of configKeys) {
    if (config[k] !== undefined && config[k] !== null && config[k] !== '') {
      configUpdates[k] = k === 'cnpj' ? (config[k] || '').replace(/\D/g, '') : config[k];
    }
  }
  if (config.ambiente !== undefined) configUpdates.ambiente = config.ambiente || 'sandbox';
  if (Object.keys(configUpdates).length > 0) {
    console.log('[ Migrate ] Inserindo config...');
    await db.updateConfig(configUpdates);
  }

  const syncState = data.syncState || {};
  if (syncState.maxNsuLido !== undefined) {
    console.log('[ Migrate ] Atualizando sync_state (maxNsuLido=%d)...', syncState.maxNsuLido);
    await db.updateMaxNsu(syncState.maxNsuLido);
  }

  const users = data.users || [];
  if (users.length > 0) {
    console.log('[ Migrate ] Inserindo %d usuários...', users.length);
    for (const u of users) {
      try {
        await db.insertUser({
          cpf: u.cpf,
          name: u.name,
          email: u.email || '',
          celular: u.celular || '',
          role: u.role,
          userType: u.userType || 'contribuinte',
          passwordHash: u.passwordHash,
          authLevel: u.authLevel,
          cnpjVinculado: u.cnpjVinculado || '',
          status: u.status || 'Ativo',
        });
      } catch (err) {
        if (err.code === '23505') {
          console.log('[ Migrate ] Usuário %s já existe, ignorando.', u.cpf);
        } else throw err;
      }
    }
  }

  const notas = data.notas || [];
  if (notas.length > 0) {
    console.log('[ Migrate ] Inserindo %d notas...', notas.length);
    let inserted = 0;
    for (const n of notas) {
      try {
        await db.insertNota(n);
        inserted++;
        if (inserted % 20 === 0) process.stdout.write('.');
      } catch (err) {
        if (err.code === '23505') {
          /* chave duplicada, ignorar */
        } else {
          console.warn('\n[ Migrate ] Erro ao inserir nota', n.chaveAcesso, err.message);
        }
      }
    }
    console.log(' %d notas inseridas.', inserted);
  }

  const apuracoes = data.apuracoes || [];
  if (apuracoes.length > 0) {
    console.log('[ Migrate ] Inserindo %d apurações...', apuracoes.length);
    for (const a of apuracoes) {
      await db.upsertApuracao(a);
    }
  }

  console.log('[ Migrate ] Concluído com sucesso.');
}

migrate().catch((err) => {
  console.error('[ Migrate ] Erro:', err.message);
  process.exit(1);
});
