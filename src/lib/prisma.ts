import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 requires a driver adapter at runtime. We instantiate the pg adapter
// from DATABASE_URL (loaded by Next.js automatically) and reuse a single client
// across hot reloads in development to avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};

const hasCurrentModelDelegates = (client: PrismaClient | undefined): client is PrismaClient => {
  const candidate = client as (PrismaClient & { user?: unknown; session?: unknown }) | undefined;
  return Boolean(candidate?.user && candidate.session);
};

export const prisma = hasCurrentModelDelegates(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
