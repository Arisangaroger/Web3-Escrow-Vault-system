import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './modules/db/prisma.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DealsModule } from './modules/services/deals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KeeperModule } from './modules/keeper/keeper.module';
import { ApiModule } from './modules/api/api.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Default: 60 seconds
        limit: 20, // Default: 20 requests per minute
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    WalletsModule,
    AuthModule,
    ContractsModule,
    DealsModule,
    NotificationsModule,
    KeeperModule,
    ApiModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
