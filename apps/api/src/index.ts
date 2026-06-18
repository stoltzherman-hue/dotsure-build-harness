import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { projectRoutes } from './routes/projects';
import { riskRoutes } from './routes/risk';
import { repositoryRoutes } from './routes/repositories';
import { complianceRoutes } from './routes/compliance';
import { deploymentRoutes } from './routes/deployments';
import { technologyRoutes } from './routes/technologies';
import { auditRoutes } from './routes/audit';
import { finopsRoutes } from './routes/finops';
import { conciergeRoutes } from './routes/concierge';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/errors';
import { logger } from './services/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(auditMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', version: '0.1.0' }));

app.use('/v1/projects', authMiddleware, projectRoutes);
app.use('/v1/risk', authMiddleware, riskRoutes);
app.use('/v1/repositories', authMiddleware, repositoryRoutes);
app.use('/v1/compliance', authMiddleware, complianceRoutes);
app.use('/v1/deployments', authMiddleware, deploymentRoutes);
app.use('/v1/technologies', authMiddleware, technologyRoutes);
app.use('/v1/audit', authMiddleware, auditRoutes);
app.use('/v1/finops', authMiddleware, finopsRoutes);
app.use('/v1/concierge', authMiddleware, conciergeRoutes);

app.use(errorHandler);

app.listen(PORT, () => logger.info('API running on port ' + PORT));

export default app;
