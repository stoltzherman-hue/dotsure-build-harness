import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(projects);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, businessProblem, department, businessOwnerId, technicalOwnerId, costCentre, expectedBenefits, estimatedUsers, expectedSavingsZar, targetGoLive, projectType } = req.body;
    const year = new Date().getFullYear();
    const count = await prisma.project.count();
    const projectCode = 'DOT-' + year + '-' + String(count + 1).padStart(4, '0');
    const project = await prisma.project.create({
      data: { projectCode, name, description, businessProblem, department, businessOwnerId, technicalOwnerId, costCentre, expectedBenefits, estimatedUsers, expectedSavingsZar, targetGoLive: targetGoLive ? new Date(targetGoLive) : null, projectType, status: 'REGISTERED' }
    });
    res.status(201).json(project);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { riskAssessments: true, complianceAssessments: true, repositories: true, deployments: true, costRecords: true } });
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.update({ where: { id: req.params.id }, data: req.body });
    res.json(project);
  } catch (e) { next(e); }
});

export { router as projectRoutes };
