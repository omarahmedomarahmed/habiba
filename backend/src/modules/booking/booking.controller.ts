import {
  Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Booking')
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ── Public: patient-facing booking flow ─────────────────────────────────────

  @Public()
  @Get('t/:slug')
  @ApiOperation({ summary: 'Get therapist public profile + offerings' })
  getPublicProfile(@Param('slug') slug: string) {
    return this.bookingService.getPublicProfile(slug);
  }

  @Public()
  @Get('t/:slug/slots')
  @ApiOperation({ summary: 'Get available time slots for a date' })
  getAvailableSlots(
    @Param('slug') slug: string,
    @Query('date') date: string,
    @Query('duration_mins') durationMins: string,
  ) {
    return this.bookingService.getAvailableSlots(slug, date, parseInt(durationMins) || 60);
  }

  @Public()
  @Post('t/:slug/checkout')
  @ApiOperation({ summary: 'Create booking and return Stripe checkout URL' })
  createBookingCheckout(
    @Param('slug') slug: string,
    @Body() body: {
      patient_name: string;
      patient_email: string;
      duration_mins: number;
      starts_at: string;
      notes?: string;
    },
  ) {
    return this.bookingService.createBookingCheckout(slug, body);
  }

  @Public()
  @Get('confirmed/:bookingId')
  @ApiOperation({ summary: 'Get booking confirmation details' })
  getBookingConfirmation(@Param('bookingId') bookingId: string) {
    return this.bookingService.getBookingConfirmation(bookingId);
  }

  // ── Authenticated: therapist manages their offerings ─────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('therapist', 'org_admin')
  @Get('me/offerings')
  @ApiOperation({ summary: 'Get my session offerings' })
  getMyOfferings(@Request() req: { user: { therapistId?: string; userId: string } }) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.bookingService.getMyOfferings(therapistId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('therapist', 'org_admin')
  @Put('me/offerings')
  @ApiOperation({ summary: 'Update my session offerings' })
  updateOfferings(
    @Request() req: { user: { therapistId?: string; userId: string } },
    @Body() body: Array<{ duration_mins: number; price_cents: number; is_enabled: boolean }>,
  ) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.bookingService.updateOfferings(therapistId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('therapist', 'org_admin')
  @Get('me/upcoming')
  @ApiOperation({ summary: 'Get upcoming self-booked sessions' })
  getUpcomingBookings(@Request() req: { user: { therapistId?: string; userId: string } }) {
    const therapistId = req.user.therapistId || req.user.userId;
    return this.bookingService.getUpcomingBookings(therapistId);
  }
}
