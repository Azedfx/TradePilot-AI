import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3000;
  // Combined Render/Docker boot binds Nest to loopback so Render only
  // detects Next on $PORT as the public HTTP server.
  const host = process.env.HOST || '0.0.0.0';

  app.setGlobalPrefix('api');
  const corsOrigin =
    process.env.CORS_ORIGIN?.split(',') ??
    (process.env.RENDER_EXTERNAL_URL
      ? [process.env.RENDER_EXTERNAL_URL]
      : ['http://localhost:3001']);

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port, host);
  Logger.log(
    `TradePilot backend running on http://${host}:${port}/api`,
    'Bootstrap',
  );
}

void bootstrap();
