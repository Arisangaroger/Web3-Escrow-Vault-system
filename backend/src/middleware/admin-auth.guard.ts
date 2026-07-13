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

    // Extract token from cookie or Authorization header
    const token =
      request.cookies?.admin_token ||
      request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const admin = await this.adminService.verifyToken(token);
      request.admin = admin;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
