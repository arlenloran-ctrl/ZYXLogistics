import { execute } from './pool.ts';

// Detecta erro típico de banco desatualizado.
// O middleware de erro usa essa função para orientar a equipe a reiniciar o servidor
// e aplicar as migrações automáticas quando faltar coluna em ambiente antigo.
export function isMissingColumnError(error: any) {
  return error?.code === 'ER_BAD_FIELD_ERROR' || /unknown column/i.test(String(error?.message || ''));
}

// Garante a estrutura mínima do sistema no banco.
// É chamada no bootstrap do servidor e cobre tanto instalação nova quanto evolução
// de ambientes já existentes, criando tabelas e tentando adicionar colunas novas.
export async function ensureDatabaseSchema() {
  // Cadastro mestre de itens utilizados nos fluxos de inbound, expedição e estoque.
  await execute(`
    CREATE TABLE IF NOT EXISTS items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(120) NOT NULL,
      description VARCHAR(255) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_items_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabela principal de caminhões/veículos em pátio.
  // As demais operações do sistema giram em torno desse registro.
  await execute(`
    CREATE TABLE IF NOT EXISTS trucks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      plate VARCHAR(32) NOT NULL,
      driver VARCHAR(160) NOT NULL,
      type ENUM('Inbound','Outbound') NOT NULL DEFAULT 'Inbound',
      load_status ENUM('Empty','Loaded') NOT NULL DEFAULT 'Empty',
      supplier VARCHAR(255) NULL,
      customer VARCHAR(255) NULL,
      entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      exit_time DATETIME NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Em pátio',
      last_action VARCHAR(100) NULL,
      PRIMARY KEY (id),
      KEY idx_trucks_status (status),
      KEY idx_trucks_type (type),
      KEY idx_trucks_load_status (load_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Itens vinculados a cada caminhão.
  // Esta tabela é a base para refletir o que chegou na portaria e o que será recebido ou expedido.
  await execute(`
    CREATE TABLE IF NOT EXISTS truck_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      truck_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,3) NOT NULL,
      direction ENUM('Inbound','Outbound') NOT NULL DEFAULT 'Inbound',
      PRIMARY KEY (id),
      KEY idx_truck_items_truck (truck_id),
      KEY idx_truck_items_item (item_id),
      KEY idx_truck_items_direction (direction),
      CONSTRAINT fk_truck_items_truck FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE,
      CONSTRAINT fk_truck_items_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Estoque consolidado por item.
  // É atualizado no inbound e na expedição, e pode receber ajuste manual.
  await execute(`
    CREATE TABLE IF NOT EXISTS inventory (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_inventory_item_id (item_id),
      CONSTRAINT fk_inventory_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Histórico de recebimentos efetivados.
  await execute(`
    CREATE TABLE IF NOT EXISTS inbound (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      load_number VARCHAR(80) NOT NULL,
      supplier VARCHAR(255) NOT NULL,
      truck_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(40) NOT NULL DEFAULT 'Received',
      PRIMARY KEY (id),
      UNIQUE KEY uq_inbound_load_number (load_number),
      KEY idx_inbound_truck (truck_id),
      CONSTRAINT fk_inbound_truck FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Histórico de expedições/carregamentos realizados.
  await execute(`
    CREATE TABLE IF NOT EXISTS expedition (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_number VARCHAR(80) NOT NULL,
      customer VARCHAR(255) NOT NULL,
      truck_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
      shipped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_expedition_order_number (order_number),
      KEY idx_expedition_truck (truck_id),
      CONSTRAINT fk_expedition_truck FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Trilhas de auditoria exibidas no dashboard e úteis para rastrear operações.
  await execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL,
      details TEXT NULL,
      user VARCHAR(160) NOT NULL DEFAULT 'Admin',
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Migrações simples e idempotentes para bancos que já existiam antes da refatoração.
  // Quando a coluna já existe, o erro é ignorado para não interromper a inicialização.
  const migrations = [
    `ALTER TABLE inbound ADD COLUMN truck_id BIGINT UNSIGNED NULL`,
    `ALTER TABLE inbound ADD COLUMN quantity DECIMAL(18,3) NOT NULL DEFAULT 0`,
    `ALTER TABLE expedition ADD COLUMN truck_id BIGINT UNSIGNED NULL`,
    `ALTER TABLE expedition ADD COLUMN quantity DECIMAL(18,3) NOT NULL DEFAULT 0`,
    `ALTER TABLE trucks ADD COLUMN type ENUM('Inbound','Outbound') NOT NULL DEFAULT 'Inbound'`,
    `ALTER TABLE trucks ADD COLUMN load_status ENUM('Empty','Loaded') NOT NULL DEFAULT 'Empty'`,
    `ALTER TABLE trucks ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'Em pátio'`,
    `ALTER TABLE trucks ADD COLUMN last_action VARCHAR(100) NULL`,
    `ALTER TABLE trucks ADD COLUMN supplier VARCHAR(255) NULL`,
    `ALTER TABLE trucks ADD COLUMN customer VARCHAR(255) NULL`,
    `ALTER TABLE truck_items ADD COLUMN direction ENUM('Inbound','Outbound') NOT NULL DEFAULT 'Inbound'`,
  ];

  for (const sql of migrations) {
    try {
      await execute(sql);
    } catch (error: any) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        console.warn('Migração ignorada:', sql, error?.message || error);
      }
    }
  }
}
