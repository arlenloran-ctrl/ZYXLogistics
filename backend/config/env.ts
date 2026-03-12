import 'dotenv/config';

// Centraliza a leitura das variáveis de ambiente.
// Este arquivo é consumido no bootstrap do servidor, na conexão com o banco
// e nas rotas de healthcheck para expor informações básicas de ambiente.
export const env = {
  port: Number(process.env.PORT || 3000),
  dbHost: process.env.DB_HOST || 'srv1844.hstgr.io',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbName: process.env.DB_NAME || 'u437845973_zyx',
  dbUser: process.env.DB_USER || 'u437845973_zyx',
  dbPassword: process.env.DB_PASSWORD || 'senhateste1',
  mysqlSsl: String(process.env.MYSQL_SSL || 'false').toLowerCase() === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
};
