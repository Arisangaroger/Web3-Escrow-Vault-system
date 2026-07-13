import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WalletsModule } from '../wallets/wallets.module';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [WalletsModule, ContractsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
