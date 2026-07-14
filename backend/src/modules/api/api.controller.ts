import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { DealsService } from '../services/deals.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetPinDto } from './dto/set-pin.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealActionDto, RevokeDto } from './dto/deal-action.dto';
import { normalizePhoneNumber } from '../../common/phone.util';
import { LoggerService } from '../../common/logger.service';

@Controller()
export class ApiController {
  private readonly logger = new LoggerService(ApiController.name);

  constructor(
    private walletsService: WalletsService,
    private authService: AuthService,
    private dealsService: DealsService,
    private contractsService: ContractsService,
    private notificationsService: NotificationsService,
  ) {}

  private phone(raw: string): string {
    return normalizePhoneNumber(decodeURIComponent(raw));
  }

  /**
   * Set PIN for first-time user
   * POST /users/:phone/pin
   */
  @Post('users/:phone/pin')
  @HttpCode(HttpStatus.OK)
  async setPin(@Param('phone') phone: string, @Body() dto: SetPinDto) {
    try {
      const normalized = this.phone(phone);
      await this.walletsService.getOrCreateWallet(normalized);
      await this.authService.setPin(normalized, dto.pin);

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
   * Verify PIN (for login authentication)
   * POST /users/:phone/verify-pin
   */
  @Post('users/:phone/verify-pin')
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Param('phone') phone: string, @Body() dto: SetPinDto) {
    try {
      const isValid = await this.authService.verifyPin(this.phone(phone), dto.pin);

      if (isValid) {
        return {
          success: true,
          data: { message: 'PIN verified' },
        };
      } else {
        return {
          success: false,
          error: 'Invalid PIN',
        };
      }
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
        normalizePhoneNumber(dto.senderPhone),
        normalizePhoneNumber(dto.driverPhone),
        normalizePhoneNumber(dto.receiverPhone),
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
        normalizePhoneNumber(dto.phone),
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
        normalizePhoneNumber(dto.phone),
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
        normalizePhoneNumber(dto.phone),
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
        normalizePhoneNumber(dto.phone),
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
        normalizePhoneNumber(dto.phone),
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
   * Check whether a user has a PIN set (for USSD new vs returning routing)
   * GET /users/:phone/pin-status
   */
  @Get('users/:phone/pin-status')
  async getPinStatus(@Param('phone') phone: string) {
    try {
      const hasPin = await this.authService.hasPinSet(this.phone(phone));
      return {
        success: true,
        data: { hasPin: Boolean(hasPin) },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Recent SMS notifications for a phone (simulator inbox)
   * GET /users/:phone/notifications
   */
  @Get('users/:phone/notifications')
  async getNotifications(@Param('phone') phone: string) {
    try {
      const notifications =
        await this.notificationsService.getNotificationsForPhone(this.phone(phone));
      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      this.logger.error(`Get notifications error: ${error.message}`);
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
      const deals = await this.dealsService.getActiveDealsForPhone(this.phone(phone));

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
   * Mint tokens (testing only - operator role required)
   * POST /test/mint
   */
  @Post('test/mint')
  @HttpCode(HttpStatus.OK)
  async mintTokens(
    @Body() body: { phone: string; amount: string },
  ) {
    try {
      const { address } = await this.walletsService.getOrCreateWallet(
        normalizePhoneNumber(body.phone),
      );
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
