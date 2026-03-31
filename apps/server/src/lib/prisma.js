import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

prisma.$connect()
  .then(() => console.log('✅ Database connected'))
  .catch((err) => console.warn('⚠️ Database cold start, will retry on first query:', err.message));

export default prisma;

export async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.code === 'P1001' || err.code === 'P1002' ||
        err.code === 'P2024' || err.message?.includes('ECONNREFUSED');
      if (!isRetryable || i === retries - 1) throw err;
      console.warn(`[prisma] Retry ${i + 1}/${retries} after ${err.code || err.message}`);
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}
