import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();

function calcGovernanceScore(controls: Record<string, boolean>) {
  return (controls.isPrivate ? 20 : 0) + (controls.mfaEnabled ? 15 : 0) + (controls.branchProtection ? 15 : 0) + (controls.secretScanning ? 10 : 0) + (controls.codeownersPresent ? 10 : 0) + (controls.prReviewsRequired ? 10 : 0) + (controls.dependabotEnabled ? 10 : 0) + (controls.securityPolicyPresent ? 10 : 0);
}

function scoreStatus(score: number) {
  if (score >= 90) return 'COMPLIANT';
  if (score >= 70) return 'ACCEPTABLE';
  if (score >= 50) return 'AT_RISK';
  return 'NON_COMPLIANT';
}

router.get('/', async (req, res, next) => {
  try {
    const repos = await prisma.repository.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(repos);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { projectId, githubOrgRepo, environment, deploymentMethod, controls } = req.body;
    const score = calcGovernanceScore(controls);
    const status = scoreStatus(score);
    const repo = await prisma.repository.create({
      data: { projectId, githubRepoName: githubOrgRepo, githubRepoUrl: 'https://github.com/' + githubOrgRepo, ownerId: (req as any).auth?.sub, environment, deploymentMethod, governanceScore: score, governanceStatus: status, lastValidatedAt: new Date() }
    });
    await prisma.repositoryControlResult.create({
      data: { repositoryId: repo.id, validationTrigger: 'MANUAL', calculatedScore: score, ...controls }
    });
    res.status(201).json(repo);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id }, include: { controlResults: { orderBy: { validatedAt: 'desc' }, take: 10 } } });
    if (!repo) return res.status(404).json({ error: 'Not found' });
    res.json(repo);
  } catch (e) { next(e); }
});

export { router as repositoryRoutes };
