import mysql from 'mysql2/promise';
import { env } from '../config/env.ts';

let pool: mysql.Pool;

// Inicializa o pool de conexões compartilhado pela aplicação.
// É chamado uma única vez no start do servidor e depois reutilizado por rotas,
// services e rotinas de schema para evitar criar conexão por requisição.
export function createPool() {
  pool = mysql.createPool({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    ssl: env.mysqlSsl ? { minVersion: 'TLSv1.2' } : undefined,
  });

  return pool;
}

// Retorna o pool já inicializado.
// As funções utilitárias abaixo dependem dele, por isso lançamos erro cedo
// caso alguém tente acessar o banco antes do bootstrap do servidor.
export function getPool() {
  if (!pool) {
    throw new Error('MySQL pool ainda não foi inicializado.');
  }

  return pool;
}

// Helper padrão para SELECTs.
// É usado em praticamente todas as rotas para manter o acesso ao banco curto
// e padronizado, sem repetir getPool().query em cada arquivo.
export async function query<T = any>(sql: string, params: any[] = []) {
  const [rows] = await getPool().query(sql, params);
  return rows as T;
}

// Variação do helper acima para consultas que devem retornar um único registro.
// Muito usado em validações de existência antes de atualizar caminhão, item ou estoque.
export async function queryOne<T = any>(sql: string, params: any[] = []) {
  const rows = await query<T[]>(sql, params);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// Helper para INSERT/UPDATE/DELETE.
// Centraliza o cast do mysql2 para ResultSetHeader e simplifica o uso nas rotas.
export async function execute(sql: string, params: any[] = []) {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Executa um bloco transacional.
// É usado nos fluxos críticos do sistema, como entrada de caminhão, inbound e expedição,
// onde múltiplas operações precisam ser confirmadas ou desfeitas em conjunto.
export async function withTransaction<T>(handler: (conn: mysql.PoolConnection) => Promise<T>) {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
