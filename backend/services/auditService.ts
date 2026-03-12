import { execute } from '../db/pool.ts';

// Service simples para gravação de auditoria.
// Foi isolado em um arquivo próprio para evitar SQL duplicado nas rotas e manter o padrão de logs do sistema.
export async function logAction(action: string, module: string, details: string, user = 'Admin') {
  try {
    await execute(
      'INSERT INTO audit_logs (action, module, details, user) VALUES (?, ?, ?, ?)',
      [action, module, details, user]
    );
  } catch (error) {
    console.error('Falha ao gravar auditoria:', error);
  }
}
