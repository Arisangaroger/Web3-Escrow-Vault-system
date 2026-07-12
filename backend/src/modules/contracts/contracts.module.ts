import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { GasRelayService } from './gas-relay.service';
import { SignatureService } from './signature.service';
import { StartupValidationService } from './startup-validation.service';

@Module({
  providers: [
    ContractsService,
    GasRelayService,
    SignatureService,
    StartupValidationService,
  ],
  exports: [ContractsService, GasRelayService, SignatureService],
})
export class ContractsModule {}
