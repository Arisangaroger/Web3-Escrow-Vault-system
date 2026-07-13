import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from '../modules/admin/admin.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private adminService: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const token =
      request.cookies?.admin_token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const { admin, token: refreshedToken } =
        await this.adminService.verifyAndRefreshToken(token);

      request.admin = admin;

      // Slide idle window: reissue cookie with updated lastActivity claim
      response.cookie(
        'admin_token',
        refreshedToken,
        this.adminService.getCookieOptions(),
      );

      return true;
    } catch (error) {
      response.clearCookie('admin_token');
      throw new UnauthorizedException(
        error?.message || 'Invalid or expired token',
      );
    }
  }
}
