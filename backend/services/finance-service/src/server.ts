import express from 'express';
import cors from 'cors';
import { logger, connectDatabase, getSecrets, updateConfig, config } from '@procurement/common';

export const app: import('express').Express = express();

export const bootstrapApp = async (): Promise<import('express').Express> => {
  try {
    await connectDatabase();

    app.use(express.json());
    app.use(cors());

    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'ok', service: 'finance-service', timestamp: new Date() });
    });

    app.use('/api', (await import('./index')).default);


    return app;
  } catch (error) {
    logger.error('Failed to bootstrap finance service', error);
    throw error;
  }
};

if (require.main === module) {
  bootstrapApp().then(initializedApp => {
    const port = process.env.PORT || 5002;
    initializedApp.listen(port, () => {
      logger.info(`🚀 Finance Service running on port ${port} in ${config.nodeEnv} mode`);
    });
  }).catch(() => process.exit(1));
}
