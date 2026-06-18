import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();

function calculateRisk(responses: Record<string, string>) {
  let score = 0;
  if (responses.personalData === 'Yes') score += 25; else if (responses.personalData === 'Not sure') score += 10;
  if (responses.customerFacing === 'Yes') score += 20; else if (responses.customerFacing === 'Not sure') score += 8;
  if (responses.claimsOrAdvice === 'Yes') score += 25; else if (responses.claimsOrAdvice === 'Not sure') score += 10;
  if (responses.aiDecisions === 'Yes') score += 15; else if (responses.aiDecisions === 'Not sure') score += 6;
  if (responses.outsideSA === 'Yes') score += 10; else if (responses.outsideSA === 'Not sure') score += 4;
  if (responses.thirdParty === 'Yes') score += 5;
  score = Math.min(100, score);
  const tier = score <= 25 ? 'LOW' : score <= 50 ? 'MEDIUM' : score <= 75 ? 'HIGH' : 'CRITICAL';
  return { score, tier };
}

router.post('/:projectId', async (req, res, next) => {
  try {
    const { responses } = req.body;
    const { score, tier } = calculateRisk(responses);
    const assessment = await prisma.riskAssessment.create({
      data: { projectId: req.params.projectId, totalScore: score, riskTier: tier, questionnaireResponses: responses, scoreVersion: 'v1.0' }
    });
    await prisma.project.update({ where: { id: req.params.projectId }, data: { riskTier: tier, riskScore: score, status: 'IN_ASSESSMENT' } });
    res.status(201).json(assessment);
  } catch (e) { next(e); }
});

router.get('/:projectId', async (req, res, next) => {
  try {
    const assessments = await prisma.riskAssessment.findMany({ where: { projectId: req.params.projectId }, orderBy: { assessedAt: 'desc' } });
    res.json(assessments);
  } catch (e) { next(e); }
});

export { router as riskRoutes };
