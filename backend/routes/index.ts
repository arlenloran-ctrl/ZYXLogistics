import { Router } from 'express';
import { auditRouter } from './audit.ts';
import { expeditionRouter } from './expedition.ts';
import { healthRouter } from './health.ts';
import { inboundRouter } from './inbound.ts';
import { inventoryRouter } from './inventory.ts';
import { itemsRouter } from './items.ts';
import { reportsRouter } from './reports.ts';
import { trucksRouter } from './trucks.ts';

// Router agregador da API.
// O server principal monta apenas este router em /api, e cada domínio fica responsável pelo seu próprio arquivo.
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(itemsRouter);
apiRouter.use(trucksRouter);
apiRouter.use(inboundRouter);
apiRouter.use(expeditionRouter);
apiRouter.use(inventoryRouter);
apiRouter.use(auditRouter);
apiRouter.use(reportsRouter);
