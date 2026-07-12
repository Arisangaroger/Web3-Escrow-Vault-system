import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './modules/db/prisma.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DealsModule } from './modules/services/deals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KeeperModule } from './modules/keeper/keeper.module';
import { ApiModule } from './modules/api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    WalletsModule,
    AuthModule,
    ContractsModule,
    DealsModule,
    NotificationsModule,
    KeeperModule,
    ApiModule,
  ],
})
export class AppModule {}
