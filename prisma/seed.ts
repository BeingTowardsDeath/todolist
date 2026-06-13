import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { clearAllWorkspaceData } from '../src/lib/workspace';

// CLI entry point for `prisma db seed` (configured in prisma.config.ts).
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await clearAllWorkspaceData(prisma);
    console.log('Database workspace data cleared.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
