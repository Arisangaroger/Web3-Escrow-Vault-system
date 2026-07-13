import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { DealsModule } from '../services/deals.module';
import { ContractsModule } from '../contracts/contracts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    WalletsModule,
    AuthModule,
    DealsModule,
    ContractsModule,
    NotificationsModule,
  ],
  controllers: [ApiController],
})
export class ApiModule {}
