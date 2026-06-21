import express from 'express';
import cors from 'cors';
import { logger, connectDatabase, config } from '@procurement/common';

export const app: import('express').Express = express();

export const bootstrapApp = async (): Promise<import('express').Express> => {
  try {
    await connectDatabase();

    app.use(express.json({ limit: '10mb' }));
    app.use(cors());

    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'ok', service: 'ai-service', timestamp: new Date() });
    });

    app.use('/api', (await import('./index')).default);

    return app;
  } catch (error) {
    logger.error('Failed to bootstrap AI service', error);
    throw error;
  }
};

// Standalone mode only (never used in production — the gateway imports this
// service in-process). Mirrors the other services' optional dev servers.
if (require.main === module) {
  bootstrapApp().then(initializedApp => {
    const port = process.env.PORT || 5006;
    initializedApp.listen(port, () => {
      logger.info(`🚀 AI Service running on port ${port} in ${config.nodeEnv} mode`);
    });
  }).catch(() => process.exit(1));
}
