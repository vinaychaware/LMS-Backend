// config/prisma.js  (ESM)
import { PrismaClient } from '@prisma/client';

const isDev = process.env.NODE_ENV === 'development';

// Reuse a single Prisma instance across hot-reloads
const globalForPrisma = globalThis;
const prismaInstance =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
    errorFormat: 'colorless', // 'pretty' | 'colorless' | 'minimal'
  });

if (isDev) globalForPrisma.__prisma__ = prismaInstance;

const prisma = prismaInstance;

// Connection test (call once at startup)
export const testConnection = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting database:', error);
  }
};

// Install graceful shutdown hooks once
let hooksInstalled = false;
const installShutdownHooks = () => {
  if (hooksInstalled) return;
  hooksInstalled = true;

  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });

  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
};
installShutdownHooks();

export { prisma };
