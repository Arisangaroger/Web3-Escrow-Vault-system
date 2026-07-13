import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { LoginDto } from './dto/login.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AdminAuthGuard } from '../../middleware/admin-auth.guard';
import { Response } from 'express';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  /**
   * Admin login
   * POST /admin/login
   * Rate limited (IP) + account lockout after N failed attempts
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // IP throttle; lockout is per-account
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.adminService.login(dto.email, dto.password);

      res.cookie('admin_token', result.token, this.adminService.getCookieOptions());

      return {
        success: true,
        data: {
          admin: result.admin,
        },
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current admin info
   * GET /admin/me
   */
  @Get('me')
  @UseGuards(AdminAuthGuard)
  async getMe(@Req() req: any) {
    return {
      success: true,
      data: req.admin,
    };
  }

  /**
   * Logout
   * POST /admin/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('admin_token');
    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  }

  /**
   * Get all disputed deals
   * GET /admin/disputes
   */
  @Get('disputes')
  @UseGuards(AdminAuthGuard)
  async getDisputes() {
    try {
      const disputes = await this.adminService.getDisputedDeals();
      return {
        success: true,
        data: disputes,
      };
    } catch (error) {
      this.logger.error(`Get disputes failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get resolved disputes history
   * GET /admin/disputes/history
   * Must be registered before :dealId or "history" is captured as an id.
   */
  @Get('disputes/history')
  @UseGuards(AdminAuthGuard)
  async getHistory() {
    try {
      const history = await this.adminService.getResolvedDisputes();
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error(`Get history failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get dispute detail with timeline
   * GET /admin/disputes/:dealId
   */
  @Get('disputes/:dealId')
  @UseGuards(AdminAuthGuard)
  async getDisputeDetail(@Param('dealId') dealId: string) {
    try {
      const detail = await this.adminService.getDisputeDetail(parseInt(dealId));
      return {
        success: true,
        data: detail,
      };
    } catch (error) {
      this.logger.error(`Get dispute detail failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resolve a dispute
   * POST /admin/disputes/:dealId/resolve
   */
  @Post('disputes/:dealId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminAuthGuard)
  async resolveDispute(
    @Param('dealId') dealId: string,
    @Body() dto: ResolveDisputeDto,
    @Req() req: any,
  ) {
    try {
      const result = await this.adminService.resolveDispute(
        req.admin.adminId,
        parseInt(dealId),
        dto.outcome,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Resolve dispute failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
