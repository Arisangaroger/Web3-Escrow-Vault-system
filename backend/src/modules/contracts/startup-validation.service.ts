import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractsService } from '../contracts/contracts.service';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'RPC_URL',
  'CHAIN_ID',
  'ESCROW_CONTRACT_ADDRESS',
  'ERWF_CONTRACT_ADDRESS',
  'TREASURY_PRIVATE_KEY',
  'ENCRYPTION_KEY',
  'PIN_PEPPER',
] as const;

/**
 * Fail-fast env validation + RPC/contract smoke check at boot.
 */
@Injectable()
export class StartupValidationService implements OnModuleInit {
  private readonly logger = new Logger(StartupValidationService.name);

  constructor(
    private configService: ConfigService,
    private contractsService: ContractsService,
  ) {}

  async onModuleInit() {
    const missing = REQUIRED_ENV.filter((key) => {
      const value = this.configService.get<string>(key);
      return value === undefined || value === null || String(value).trim() === '';
    });

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    const placeholderKeys = ['ESCROW_CONTRACT_ADDRESS', 'ERWF_CONTRACT_ADDRESS', 'TREASURY_PRIVATE_KEY'];
    for (const key of placeholderKeys) {
      const value = String(this.configService.get(key));
      if (value.includes('...') || value === '0x...') {
        this.logger.warn(`${key} looks like a placeholder — replace before production use`);
      }
    }

    try {
      const nextDealId = await this.contractsService.getNextDealId();
      this.logger.log(
        `Startup OK — connected to Escrow (nextDealId=${nextDealId}, chainId=${this.contractsService.getChainId()})`,
      );
    } catch (error) {
      const message = `Cannot read Escrow contract (check RPC_URL / ESCROW_CONTRACT_ADDRESS / ABIs): ${error.message}`;
      if (this.configService.get('NODE_ENV') === 'production') {
        throw new Error(message);
      }
      this.logger.warn(message);
    }
  }
}
