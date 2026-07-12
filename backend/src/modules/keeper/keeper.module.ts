import { Module } from '@nestjs/common';
import { KeeperService } from './keeper.service';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [ContractsModule],
  providers: [KeeperService],
})
export class KeeperModule {}
