import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { EventListenerService } from './event-listener.service';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { ContractsModule } from '../contracts/contracts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    WalletsModule,
    AuthModule,
    ContractsModule,
    NotificationsModule,
  ],
  providers: [DealsService, EventListenerService],
  exports: [DealsService, EventListenerService],
})
export class DealsModule {}
