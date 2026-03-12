# ZYX - Sistema de Controle de Pátio, Inbound, Expedição e Estoque

Este projeto foi desenvolvido como parte do teste técnico para a vaga de Analista de Sistemas Operacionais.

O objetivo principal foi demonstrar a capacidade de construir uma aplicação web completa, com integração entre frontend e backend, seguindo uma estrutura organizada, clara e funcional. Durant o desenvolvimento, houve preocupação com a organização do código, separação de responsabilidades e funcionamento geral da aplicação..

A funcionalidade de autenticação (como tela de login e controle de acesso) não foi implementada, pois não fazia parte do foco principal da avaliação. A proposta deste teste é priorizar a entrega de uma solução funcional, bem estruturada e de fácil entendimento, evidenciando a capacidade de desenvolvimento e organização do projeto.

## Visão geral

Este projeto é uma aplicação web para controle operacional de veículos no pátio, recebimento de cargas, expedição de saídas, cadastro de itens, acompanhamento de estoque e auditoria de ações.

A aplicação foi construida para trabalhar com **MySQL** utilizando uma arquitetura com:

- **Frontend** em React + Vite + TypeScript
- **Backend** em Express + TypeScript
- **Banco de dados** MySQL
- **Camada de integração do frontend** baseada em API REST interna

O sistema foi organizado para atender o fluxo operacional principal:

1. O veículo entra pela **Portaria**
2. Se vier carregado, os itens são vinculados ao veículo em `truck_items`
3. O **Inbound** recebe a carga e reflete no estoque
4. A **Expedição** registra saídas e movimenta o estoque
5. O **Dashboard** consolida os dados reais do banco
6. A **Auditoria** registra as ações realizadas no sistema

---

## Objetivo do sistema

O objetivo do projeto é centralizar a operação do pátio em uma única aplicação, evitando controles paralelos e permitindo rastreabilidade sobre:

- entrada e saída de veículos
- situação do pátio
- itens vinculados a veículos
- recebimentos realizados
- expedições realizadas
- saldo de estoque
- histórico de ações

---

## Stack utilizada

### Frontend
- React 19
- TypeScript
- Vite
- Lucide React
- Motion
- XLSX (exportação para Excel)

### Backend
- Node.js
- Express
- TypeScript
- mysql2
- dotenv

### Banco de dados
- MySQL

---

## Estrutura do projeto

```text
.
├── backend/
│   ├── config/
│   │   └── env.ts
│   ├── db/
│   │   ├── pool.ts
│   │   └── schema.ts
│   ├── middleware/
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── audit.ts
│   │   ├── expedition.ts
│   │   ├── health.ts
│   │   ├── inbound.ts
│   │   ├── index.ts
│   │   ├── inventory.ts
│   │   ├── items.ts
│   │   ├── reports.ts
│   │   └── trucks.ts
│   ├── services/
│   │   ├── auditService.ts
│   │   └── truckDataService.ts
│   └── utils/
│       └── normalize.ts
├── src/
│   ├── App.tsx
│   ├── dataClient.ts
│   ├── index.css
│   ├── main.tsx
│   └── types.ts
├── server.js
├── server.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

---

## Responsabilidade de cada parte

### `server.js`
Arquivo utilizado apenas para iniciar o `server.ts`, devido a limitações de algumas plataformas de hospedagem que realizam a leitura inicial apenas de arquivos `.js`.

### `server.ts`
Arquivo de bootstrap da aplicação.

Responsável por:
- iniciar o Express
- configurar JSON
- registrar as rotas da API
- conectar no MySQL
- garantir a criação/migração do schema
- subir o Vite em desenvolvimento
- servir o `dist` em produção

### `backend/config/env.ts`
Centraliza a leitura das variáveis de ambiente.

### `backend/db/pool.ts`
Centraliza a conexão com o MySQL, queries simples, execução de comandos e transações.

### `backend/db/schema.ts`
Responsável por:
- criar as tabelas caso não existam
- aplicar migrações simples e idempotentes
- manter a estrutura mínima esperada pelo sistema

### `backend/routes/`
Cada arquivo concentra as rotas de um domínio específico:
- caminhões
- inbound
- expedição
- estoque
- itens
- auditoria
- relatórios
- healthcheck

### `backend/services/`
Concentra regras que são reutilizadas por mais de uma rota.

### `src/dataClient.ts`
Camada de integração do frontend com a API.

Trabalha como ponte entre a interface e os endpoints REST do backend.

### `src/App.tsx`
Concentra a interface principal do sistema.

---

## Banco de dados

O sistema cria automaticamente as tabelas necessárias ao iniciar o backend.

### Tabelas principais

#### `items`
Cadastro mestre de itens.

Campos principais:
- `id`
- `code`
- `description`
- `unit`
- `created_at`

#### `trucks`
Tabela principal de veículos/caminhões no pátio.

Campos principais:
- `id`
- `plate`
- `driver`
- `type`
- `load_status`
- `supplier`
- `customer`
- `entry_time`
- `exit_time`
- `status`
- `last_action`

#### `truck_items`
Itens vinculados a cada veículo.

Essa tabela é crítica para o fluxo operacional porque representa o que foi declarado na Portaria e o que será tratado pelo Inbound ou pela Expedição.

Campos principais:
- `id`
- `truck_id`
- `item_id`
- `quantity`
- `direction`

#### `inventory`
Saldo consolidado por item.

Campos principais:
- `id`
- `item_id`
- `quantity`
- `last_updated`

#### `inbound`
Histórico de recebimentos realizados.

Campos principais:
- `id`
- `load_number`
- `supplier`
- `truck_id`
- `quantity`
- `received_at`
- `status`

#### `expedition`
Histórico de expedições realizadas.

Campos principais:
- `id`
- `order_number`
- `customer`
- `truck_id`
- `quantity`
- `shipped_at`

#### `audit_logs`
Registro de auditoria das ações executadas.

Campos principais:
- `id`
- `action`
- `module`
- `details`
- `user`
- `timestamp`

---

## Relação entre as tabelas

### Fluxo de entrada carregada
1. O veículo é salvo em `trucks`
2. Os itens dos veículos que chegam carregados informados na Portaria são salvos em `truck_items`
3. O Inbound consulta esse vínculo para saber o que será recebido
4. Ao receber, o sistema grava em `inbound`
5. O saldo é refletido em `inventory`

### Fluxo de expedição
1. O veículo pode estar no pátio aguardando carregamento
2. A expedição registra a saída em `expedition`
3. O estoque é reduzido em `inventory`
4. O status do caminhão é atualizado conforme a regra operacional

---

## Regras funcionais importantes

### Portaria
- registra entrada de veículos
- define se o veículo entrou vazio ou carregado
- quando o veículo entra carregado, os itens precisam ser persistidos em `truck_items`

### Inbound
- usa os itens vinculados ao caminhão em `truck_items`
- registra o recebimento em `inbound`
- atualiza o saldo em `inventory`

### Expedição
- registra saídas em `expedition`
- atualiza estoque
- influencia os indicadores operacionais do dashboard

### Dashboard
Os cards e indicadores usam os dados atualizados.

#### Atividade Recente
Lê os dados da tabela `audit_logs`.

#### Status do Pátio
Usa a lógica operacional atual:

- **Em pátio**: todos os veículos que ainda não foram despachados
- **Carregados**: veículos com status `Carregado` e com registro na tabela `expedition`
- **Aguardando recebimento**: veículos com status `Em pátio` e com itens em `truck_items`
- **Prontos para expedição**: veículos com status `Em pátio` e sem itens em `truck_items`

---

## Endpoints principais da API

Todas as rotas são expostas com prefixo `/api`.

### Healthcheck
- `GET /api/health`

### Itens
- `GET /api/items`
- `POST /api/items`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`

### Caminhões / pátio
- `GET /api/trucks`
- `POST /api/trucks/entry`
- `POST /api/trucks/exit/:id`
- `POST /api/trucks/:id/items`

### Inbound
- `GET /api/inbound`
- `POST /api/inbound`

### Expedição
- `GET /api/expedition`
- `POST /api/expedition`

### Estoque
- `GET /api/inventory`
- `POST /api/inventory/adjust`

### Auditoria
- `GET /api/audit`
- `POST /api/audit`

### Relatórios / resumo
- `GET /api/reports/summary`

---

## Variáveis de ambiente

Copie o arquivo `.env.example` para `.env`.

Exemplo:

```env
PORT=port
DB_HOST=dbhost
DB_PORT=dbport
DB_NAME=dbname
DB_USER=dbuser
DB_PASSWORD=dbpassrowd
MYSQL_SSL=false
```

### Descrição das variáveis

- `PORT`: porta local do backend
- `DB_HOST`: host do MySQL
- `DB_PORT`: porta do MySQL
- `DB_NAME`: nome do banco
- `DB_USER`: usuário do banco
- `DB_PASSWORD`: senha do banco
- `MYSQL_SSL`: define se a conexão usa SSL

> Recomenda-se trocar a senha padrão e não manter credenciais sensíveis versionadas em ambientes compartilhados.

---

## Requisitos para rodar

- Node.js 20 ou superior
- npm 10 ou superior
- acesso ao servidor MySQL
- IP liberado no **Remote MySQL** da Hostinger, caso o banco esteja hospedado lá (Como no caso)

---

## Instalação

### 1. Extrair o projeto
Extraia o `.zip` em uma pasta local.

### 2. Criar o `.env`
Copie `.env.example` para `.env`.

### 3. Instalar dependências
```bash
npm install
```

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

### 5. Gerar build do frontend
```bash
npm run build
```

### 6. Validar tipagem
```bash
npm run lint
```

---

## Como o projeto sobe

Ao rodar `npm run dev`, o comando executa `tsx server.ts`.

Durante a inicialização, o backend:

1. lê as variáveis de ambiente
2. abre a conexão com o MySQL
3. executa um teste de conexão
4. cria as tabelas e aplica migrações básicas
5. inicia a API
6. injeta o Vite em modo middleware para servir o frontend em desenvolvimento

---

## Comportamento do schema automático

O arquivo `backend/db/schema.ts` garante que:

- as tabelas sejam criadas se ainda não existirem
- algumas colunas antigas sejam adicionadas em bancos já existentes
- a aplicação continue funcional mesmo em cenários de evolução incremental

Esse comportamento é importante para reduzir erro de ambiente em instalação nova ou atualização de versão.

---

## Fluxo operacional resumido

### 1. Cadastro de item
O item é cadastrado em `items` e pode ser utilizado nos demais módulos.

### 2. Entrada de veículo
A Portaria registra o veículo em `trucks`.

### 3. Vínculo dos itens ao veículo
Se o veículo entrar carregado, os itens devem ser persistidos em `truck_items`.

### 4. Recebimento
O Inbound usa os itens do veículo e registra o recebimento em `inbound`, refletindo o saldo em `inventory`.

### 5. Expedição
A Expedição registra a saída e também atualiza o estoque.

### 6. Saída / despacho
Quando o veículo deixa o pátio, o sistema marca o caminhão como despachado.

### 7. Auditoria
As ações relevantes são registradas em `audit_logs`.

---

## Convenções adotadas no backend

A organização atual do backend foi feita para facilitar manutenção:

- **config**: variáveis de ambiente e configuração
- **db**: conexão e schema
- **routes**: entrada HTTP por domínio
- **services**: regras reutilizáveis
- **middleware**: tratamento central de erro
- **utils**: funções auxiliares sem responsabilidade de domínio

Essa divisão reduz acoplamento e facilita localizar o ponto correto de alteração.

---

## Pontos de manutenção mais importantes

### Ajustar regras do pátio
Arquivo principal:
- `backend/routes/reports.ts`
- ou o serviço usado por essa rota, dependendo da evolução do projeto

### Ajustar persistência de entrada de veículos
Arquivo principal:
- `backend/routes/trucks.ts`

### Ajustar regras de recebimento
Arquivo principal:
- `backend/routes/inbound.ts`

### Ajustar regras de expedição
Arquivo principal:
- `backend/routes/expedition.ts`

### Ajustar criação/migração de tabelas
Arquivo principal:
- `backend/db/schema.ts`

### Ajustar comunicação do frontend com a API
Arquivo principal:
- `src/dataClient.ts`

---

## Possíveis erros e diagnóstico

### Erro de acesso ao MySQL
Exemplo comum:
- `ER_ACCESS_DENIED_ERROR`

Verificar:
- usuário e senha
- IP liberado no Remote MySQL
- nome correto do banco
- host e porta corretos

### Erro de host não encontrado
Exemplos comuns:
- `ENOTFOUND`
- `ETIMEDOUT`

Verificar:
- host do banco
- rede local
- firewall
- disponibilidade do serviço MySQL

### Dados não aparecendo no dashboard
Verificar:
- se existem registros reais no banco
- se os itens do caminhão estão em `truck_items`
- se o inbound gravou em `inbound`
- se a expedição gravou em `expedition`
- se a auditoria gravou em `audit_logs`

### Alteração no banco não refletiu
Verificar:
- se o backend foi reiniciado
- se a migração automática foi aplicada
- se a lógica da rota correspondente foi atualizada

---

## Exportação para Excel

O frontend utiliza a biblioteca `xlsx` para exportação de dados.

Observação importante:
- essa dependência pode aparecer em auditorias do npm com vulnerabilidade conhecida sem correção disponível no momento
- se isso se tornar impeditivo, a recomendação é planejar a substituição por outra biblioteca ou restringir o uso à exportação controlada

---

## Boas práticas para continuidade

- manter as regras de negócio no backend, evitando duplicidade no frontend
- documentar novas tabelas e novos fluxos sempre que houver expansão
- manter comentários técnicos nos arquivos-chave
- evitar nomes herdados que não representem mais a arquitetura atual
- revisar o README sempre que houver mudança estrutural relevante

---

## Sugestões de evolução futura

- separar o `App.tsx` em páginas e componentes menores
- criar camada de serviço também no frontend
- adicionar testes automatizados para rotas críticas
- criar seed de dados para ambiente de homologação
- adicionar autenticação real com perfis de acesso
- versionar migrações em arquivos próprios se o projeto crescer

---

## Observação final

Este README foi escrito para servir tanto como guia de uso quanto como referência de manutenção.

A ideia é que uma pessoa nova no projeto consiga:
- entender o objetivo do sistema
- subir o ambiente local
- localizar os arquivos principais
- compreender o fluxo entre Portaria, Inbound, Expedição, Estoque e Dashboard
- identificar com mais facilidade onde fazer ajustes futuros
