import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { BillingService } from '../billing/billing.service';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BookingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly billingService: BillingService,
    private readonly mail: MailService,
  ) {}

  async getPublicProfile(slug: string) {
    const therapist = await this.db.queryOne<any>(
      `SELECT t.id, t.display_name, t.bio, t.specializations, t.languages,
              t.timezone, t.public_slug, u.avatar_url,
              u.first_name, u.last_name
       FROM therapists t
       JOIN users u ON u.id = t.user_id
       WHERE t.public_slug = $1 AND t.deleted_at IS NULL`,
      [slug],
    );
    if (!therapist) throw new NotFoundException('Therapist not found');

    const offerings = await this.db.query(
      `SELECT id, duration_mins, price_cents, currency, is_enabled
       FROM therapist_booking_offerings
       WHERE therapist_id = $1 AND is_enabled = TRUE
       ORDER BY duration_mins ASC`,
      [therapist.id],
    );

    const availability = await this.db.query(
      `SELECT day_of_week, start_time, end_time, timezone, is_active
       FROM therapist_availability
       WHERE therapist_id = $1 AND is_active = TRUE
       ORDER BY day_of_week ASC`,
      [therapist.id],
    );

    return { therapist, offerings, availability };
  }

  async getAvailableSlots(slug: string, date: string, durationMins: number) {
    const therapist = await this.db.queryOne<any>(
      `SELECT t.id, t.timezone FROM therapists t WHERE t.public_slug = $1 AND t.deleted_at IS NULL`,
      [slug],
    );
    if (!therapist) throw new NotFoundException('Therapist not found');

    const timezone = therapist.timezone || 'UTC';
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay(); // 0=Sunday

    // Get weekly availability for this day
    const daySlots = await this.db.query<any>(
      `SELECT start_time, end_time FROM therapist_availability
       WHERE therapist_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [therapist.id, dayOfWeek],
    );

    if (!daySlots.length) return [];

    // Check for exceptions on this date
    const exception = await this.db.queryOne<any>(
      `SELECT id FROM therapist_availability_exceptions
       WHERE therapist_id = $1 AND exception_date = $2::date`,
      [therapist.id, date],
    );
    if (exception) return [];

    // Get booked sessions for this date
    const bookedSessions = await this.db.query<any>(
      `SELECT scheduled_at, duration_minutes FROM sessions
       WHERE therapist_id = $1
         AND DATE(scheduled_at AT TIME ZONE $2) = $3::date
         AND status NOT IN ('cancelled', 'no_show')`,
      [therapist.id, timezone, date],
    );

    // Get booked booking_sessions for this date
    const bookedBookings = await this.db.query<any>(
      `SELECT scheduled_at, duration_mins FROM booking_sessions
       WHERE therapist_id = $1
         AND DATE(scheduled_at AT TIME ZONE $2) = $3::date
         AND status NOT IN ('cancelled')`,
      [therapist.id, timezone, date],
    );

    // Generate all possible slots for the day
    const slots: { starts_at: string; ends_at: string; available: boolean }[] = [];

    for (const daySlot of daySlots) {
      const [startHour, startMin] = daySlot.start_time.split(':').map(Number);
      const [endHour, endMin] = daySlot.end_time.split(':').map(Number);

      const slotStart = new Date(date);
      slotStart.setUTCHours(startHour, startMin, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setUTCHours(endHour, endMin, 0, 0);

      let current = new Date(slotStart);
      while (current.getTime() + durationMins * 60000 <= slotEnd.getTime()) {
        const slotStartTs = new Date(current);
        const slotEndTs = new Date(current.getTime() + durationMins * 60000);

        // Check if this slot overlaps with any existing booking
        const isBooked = [...bookedSessions, ...bookedBookings].some((b) => {
          const bStart = new Date(b.scheduled_at);
          const bDuration = b.duration_minutes || b.duration_mins || 60;
          const bEnd = new Date(bStart.getTime() + bDuration * 60000);
          return slotStartTs < bEnd && slotEndTs > bStart;
        });

        // Only show future slots
        const isFuture = slotStartTs > new Date();

        if (isFuture) {
          slots.push({
            starts_at: slotStartTs.toISOString(),
            ends_at: slotEndTs.toISOString(),
            available: !isBooked,
          });
        }

        current = new Date(current.getTime() + 30 * 60000); // 30-min intervals
      }
    }

    return slots;
  }

  async createBookingCheckout(slug: string, dto: {
    patient_name: string;
    patient_email: string;
    duration_mins: number;
    starts_at: string;
    notes?: string;
  }) {
    const therapist = await this.db.queryOne<any>(
      `SELECT t.id, t.display_name, t.timezone, u.avatar_url
       FROM therapists t JOIN users u ON u.id = t.user_id
       WHERE t.public_slug = $1 AND t.deleted_at IS NULL`,
      [slug],
    );
    if (!therapist) throw new NotFoundException('Therapist not found');

    const offering = await this.db.queryOne<any>(
      `SELECT id, price_cents, currency FROM therapist_booking_offerings
       WHERE therapist_id = $1 AND duration_mins = $2 AND is_enabled = TRUE`,
      [therapist.id, dto.duration_mins],
    );
    if (!offering) throw new BadRequestException('Session offering not available');

    // Validate slot is still available
    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(startsAt.getTime() + dto.duration_mins * 60000);

    const conflictingSession = await this.db.queryOne<any>(
      `SELECT id FROM sessions
       WHERE therapist_id = $1
         AND scheduled_at < $3 AND scheduled_at + (duration_minutes * interval '1 minute') > $2
         AND status NOT IN ('cancelled', 'no_show')`,
      [therapist.id, startsAt.toISOString(), endsAt.toISOString()],
    );

    const conflictingBooking = await this.db.queryOne<any>(
      `SELECT id FROM booking_sessions
       WHERE therapist_id = $1
         AND scheduled_at < $3 AND scheduled_at + (duration_mins * interval '1 minute') > $2
         AND status NOT IN ('cancelled')`,
      [therapist.id, startsAt.toISOString(), endsAt.toISOString()],
    );

    if (conflictingSession || conflictingBooking) {
      throw new ConflictException('This time slot is no longer available');
    }

    // Create booking record
    const bookingId = uuidv4();
    await this.db.execute(
      `INSERT INTO booking_sessions (id, therapist_id, offering_id, patient_name, patient_email,
        scheduled_at, duration_mins, price_cents, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_payment')`,
      [
        bookingId, therapist.id, offering.id, dto.patient_name, dto.patient_email,
        dto.starts_at, dto.duration_mins, offering.price_cents, offering.currency || 'USD',
      ],
    );

    // Create Stripe checkout
    const therapistAppUrl = this.config.get<string>('THERAPIST_APP_URL') || 'https://app.24therapy.ai';
    const checkoutUrl = await this.billingService.createBookingCheckout(
      bookingId,
      therapist.id,
      offering.price_cents,
      dto.patient_email,
      therapist.display_name,
      therapist.avatar_url,
      `${therapistAppUrl}/t/${slug}/confirmed?booking_id=${bookingId}`,
      `${therapistAppUrl}/t/${slug}`,
    );

    return { booking_id: bookingId, checkout_url: checkoutUrl };
  }

  async getBookingConfirmation(bookingId: string) {
    const booking = await this.db.queryOne<any>(
      `SELECT bs.*, t.display_name AS therapist_name, t.timezone, t.public_slug,
              u.avatar_url AS therapist_avatar_url
       FROM booking_sessions bs
       JOIN therapists t ON t.id = bs.therapist_id
       JOIN users u ON u.id = t.user_id
       WHERE bs.id = $1 AND bs.status IN ('paid', 'confirmed')`,
      [bookingId],
    );
    if (!booking) throw new NotFoundException('Booking not found or not yet confirmed');
    return booking;
  }

  async getMyOfferings(therapistId: string) {
    return this.db.query(
      `SELECT id, duration_mins, price_cents, currency, is_enabled
       FROM therapist_booking_offerings
       WHERE therapist_id = $1
       ORDER BY duration_mins ASC`,
      [therapistId],
    );
  }

  async updateOfferings(therapistId: string, offerings: Array<{ duration_mins: number; price_cents: number; is_enabled: boolean }>) {
    for (const o of offerings) {
      await this.db.execute(
        `INSERT INTO therapist_booking_offerings (id, therapist_id, duration_mins, price_cents, is_enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (therapist_id, duration_mins) DO UPDATE
           SET price_cents = EXCLUDED.price_cents,
               is_enabled = EXCLUDED.is_enabled,
               updated_at = NOW()`,
        [uuidv4(), therapistId, o.duration_mins, o.price_cents, o.is_enabled],
      );
    }
    return { success: true };
  }

  async getUpcomingBookings(therapistId: string) {
    return this.db.query(
      `SELECT bs.*, t.display_name AS therapist_name
       FROM booking_sessions bs
       JOIN therapists t ON t.id = bs.therapist_id
       WHERE bs.therapist_id = $1
         AND bs.scheduled_at >= NOW()
         AND bs.status IN ('paid', 'confirmed')
       ORDER BY bs.scheduled_at ASC
       LIMIT 20`,
      [therapistId],
    );
  }
}
