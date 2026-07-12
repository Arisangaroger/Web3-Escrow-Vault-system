import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS for testing
  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;

  await app.listen(port);
  console.log(`🚀 Escrow Backend running on port ${port}`);
  console.log(`📦 Environment: ${configService.get('NODE_ENV')}`);
  console.log(`⛓️  Chain ID: ${configService.get('CHAIN_ID')}`);
}

bootstrap();
