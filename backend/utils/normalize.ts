// Normaliza o tipo de id vindo do MySQL para string.
// O frontend trabalha melhor com ids serializados de forma consistente,
// então este helper é usado nas respostas das rotas antes de enviar JSON.
export function normalizeRows<T extends Record<string, any>>(rows: T[]) {
  return rows.map((row) => ({ ...row, id: String(row.id) }));
}
