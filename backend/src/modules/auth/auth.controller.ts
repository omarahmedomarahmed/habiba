import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new account (therapist or patient)' })
  async register(@Body() dto: RegisterDto, @Request() req: any) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Request() req: any) {
    dto.ip_address = req.ip;
    const result = await this.authService.login(dto);
    return {
      success: true,
      data: result,
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh_token in body' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    const tokens = await this.authService.refreshToken(refreshToken);
    return {
      success: true,
      data: { tokens },
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.id);
    return {
      success: true,
      data: { message: 'Logged out successfully' },
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Request() req: any) {
    return {
      success: true,
      data: { user: req.user },
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.requestPasswordReset(email);
    return {
      success: true,
      data: { message: 'If the email exists, a reset link has been sent.' },
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() body: { token: string; password: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return {
      success: true,
      data: { message: 'Password reset successfully' },
      meta: { request_id: uuidv4(), timestamp: new Date().toISOString(), version: 'v1' },
    };
  }
}
