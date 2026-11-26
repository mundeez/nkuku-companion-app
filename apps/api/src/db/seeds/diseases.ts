import { Prisma, PrismaClient } from '@prisma/client';
import type { DiseaseRecord } from './data/diseases.types.js';
import { diseasesPart1 } from './data/diseases-1.js';
import { diseasesPart2 } from './data/diseases-2.js';
import { diseasesPart3 } from './data/diseases-3.js';

const diseases: DiseaseRecord[] = [...diseasesPart1, ...diseasesPart2, ...diseasesPart3];

export async function seedDiseases(prisma: PrismaClient) {
  console.log('[SEED] Diseases...');

  for (const disease of diseases) {
    await prisma.disease.upsert({
      where: { name: disease.name },
      update: {
        category: disease.category,
        incubation: disease.incubation,
        mortalityRate: disease.mortalityRate,
        symptoms: disease.symptoms,
        prevention: disease.prevention,
        treatment: disease.treatment,
        supportiveTreatments: disease.supportiveTreatments,
        imageUrl: disease.imageUrl,
        videoUrl: disease.videoUrl,
        videoProvider: disease.videoProvider,
        sources: disease.sources as Prisma.InputJsonValue | undefined,
        regionalNotes: disease.regionalNotes as Prisma.InputJsonValue | undefined,
        evidence: disease.evidence as Prisma.InputJsonValue | undefined,
      },
      create: {
        ...disease,
        sources: disease.sources as Prisma.InputJsonValue | undefined,
        regionalNotes: disease.regionalNotes as Prisma.InputJsonValue | undefined,
        evidence: disease.evidence as Prisma.InputJsonValue | undefined,
      },
    });
  }

  console.log('[SEED] Diseases:', diseases.length);
}
