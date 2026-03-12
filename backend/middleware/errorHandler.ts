import type { NextFunction, Request, Response } from 'express';
import { isMissingColumnError } from '../db/schema.ts';

// Middleware global de tratamento de erro.
// Toda rota encaminha falhas para cá com next(error), o que mantém a resposta padronizada
// e evita duplicar tratamento de exceção em cada módulo.
export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Server Error:', error);

  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'Registro duplicado. Verifique os dados informados.' });
  }

  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Registro relacionado não encontrado.' });
  }

  if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(500).json({ error: 'Acesso negado ao MySQL. Libere o IP no Remote MySQL da Hostinger e confira usuário/senha.' });
  }

  if (isMissingColumnError(error)) {
    return res.status(500).json({ error: 'Estrutura do banco incompleta. Reinicie o servidor para aplicar as migrações.' });
  }

  return res.status(500).json({ error: error?.message || 'Internal Server Error' });
}
