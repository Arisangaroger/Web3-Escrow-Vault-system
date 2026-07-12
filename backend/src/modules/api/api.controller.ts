import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { DealsService } from '../services/deals.service';
import { ContractsService } from '../contracts/contracts.service';
import { SetPinDto } from './dto/set-pin.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActionDto, RevokeDto, ResolveDisputeDto } from './dto/deal-action.dto';

@Controller()
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private walletsService: WalletsService,
    private authService: AuthService,
    private dealsService: DealsService,
    private contractsService: ContractsService,
  ) {}

  /**
   * Set PIN for first-time user
   * POST /users/:phone/pin
   */
  @Post('users/:phone/pin')
  @HttpCode(HttpStatus.OK)
  async setPin(@Param('phone') phone: string, @Body() dto: SetPinDto) {
    try {
      // Ensure wallet exists
      await this.walletsService.getOrCreateWallet(phone);
      
      // Set PIN
      await this.authService.setPin(phone, dto.pin);

      return {
        success: true,
        data: { message: 'PIN set successfully' },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new deal
   * POST /deals
   */
  @Post('deals')
  @HttpCode(HttpStatus.CREATED)
  async createDeal(@Body() dto: CreateDealDto) {
    try {
      const result = await this.dealsService.createDeal(
        dto.senderPhone,
        dto.driverPhone,
        dto.receiverPhone,
        dto.amount,
        dto.pin,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Create deal error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lock funds into escrow
   * POST /deals/:dealId/lock
   */
  @Post('deals/:dealId/lock')
  @HttpCode(HttpStatus.OK)
  async lockFunds(@Param('dealId') dealId: string, @Body() dto: DealActionDto) {
    try {
      const txHash = await this.dealsService.lockFunds(
        dto.phone,
        parseInt(dealId),
        dto.pin,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Lock funds error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark goods as shipped
   * POST /deals/:dealId/ship
   */
  @Post('deals/:dealId/ship')
  @HttpCode(HttpStatus.OK)
  async markShipped(@Param('dealId') dealId: string, @Body() dto: DealActionDto) {
    try {
      const txHash = await this.dealsService.markShipped(
        dto.phone,
        parseInt(dealId),
        dto.pin,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Mark shipped error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark goods as delivered
   * POST /deals/:dealId/deliver
   */
  @Post('deals/:dealId/deliver')
  @HttpCode(HttpStatus.OK)
  async markDelivered(@Param('dealId') dealId: string, @Body() dto: DealActionDto) {
    try {
      const txHash = await this.dealsService.markDelivered(
        dto.phone,
        parseInt(dealId),
        dto.pin,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Mark delivered error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Revoke/dispute a deal
   * POST /deals/:dealId/revoke
   */
  @Post('deals/:dealId/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('dealId') dealId: string, @Body() dto: RevokeDto) {
    try {
      const txHash = await this.dealsService.revoke(
        dto.phone,
        parseInt(dealId),
        dto.reasonCode,
        dto.pin,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Revoke error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel deal before funds locked
   * POST /deals/:dealId/cancel
   */
  @Post('deals/:dealId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBeforeLock(@Param('dealId') dealId: string, @Body() dto: DealActionDto) {
    try {
      const txHash = await this.dealsService.cancelBeforeLock(
        dto.phone,
        parseInt(dealId),
        dto.pin,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Cancel error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get active deals for a phone number (role-segmented)
   * GET /users/:phone/deals
   */
  @Get('users/:phone/deals')
  async getActiveDeals(@Param('phone') phone: string) {
    try {
      const deals = await this.dealsService.getActiveDealsForPhone(phone);

      return {
        success: true,
        data: deals,
      };
    } catch (error) {
      this.logger.error(`Get deals error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get deal details
   * GET /deals/:dealId
   */
  @Get('deals/:dealId')
  async getDeal(@Param('dealId') dealId: string) {
    try {
      const deal = await this.dealsService.getDealDetails(parseInt(dealId));

      return {
        success: true,
        data: deal,
      };
    } catch (error) {
      this.logger.error(`Get deal error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resolve dispute (admin only)
   * POST /deals/:dealId/resolve
   */
  @Post('deals/:dealId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveDispute(
    @Param('dealId') dealId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    try {
      const txHash = await this.contractsService.resolveDisputeOnChain(
        parseInt(dealId),
        dto.amountToSender,
        dto.amountToReceiver,
      );

      return {
        success: true,
        data: { txHash },
      };
    } catch (error) {
      this.logger.error(`Resolve dispute error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mint tokens (testing only - operator role required)
   * POST /test/mint
   */
  @Post('test/mint')
  @HttpCode(HttpStatus.OK)
  async mintTokens(
    @Body() body: { phone: string; amount: string },
  ) {
    try {
      const { address } = await this.walletsService.getOrCreateWallet(body.phone);
      const txHash = await this.contractsService.mintTokens(address, body.amount);

      return {
        success: true,
        data: { txHash, address },
      };
    } catch (error) {
      this.logger.error(`Mint error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check
   * GET /health
   */
  @Get('health')
  getHealth() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
