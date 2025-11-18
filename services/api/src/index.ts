import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const app = fastify({ logger: true });

async function buildServer() {
  await app.register(cors, {});
  await app.register(helmet);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}

async function start() {
  const server = await buildServer();
  const port = Number(process.env.API_PORT ?? 4000);
  const host = '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`API listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  start();
}

export { buildServer };
