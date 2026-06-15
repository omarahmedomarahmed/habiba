import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface SearchOptions {
  query?: string;
  specializations?: string[];
  languages?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  acceptsInsurance?: boolean;
  availableNow?: boolean;
  sessionFormats?: string[];
  sortBy?: 'relevance' | 'rating' | 'price_asc' | 'price_desc' | 'reviews';
  page?: number;
  limit?: number;
  organizationId?: string;
  searcherId?: string;
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ============================================================
  // SEARCH
  // ============================================================

  /**
   * Primary marketplace search using PostgreSQL search_marketplace() function
   * Supports full-text, filters, sorting, and pagination
   */
  async search(options: SearchOptions) {
    const {
      query = '',
      specializations = [],
      languages = [],
      minPrice,
      maxPrice,
      minRating,
      acceptsInsurance,
      availableNow,
      sessionFormats = [],
      sortBy = 'relevance',
      page = 1,
      limit = 20,
      organizationId,
      searcherId,
    } = options;

    const offset = (page - 1) * limit;

    // Use the DB search_marketplace function for semantic + filter search
    const results = await this.db.query(
      `SELECT * FROM search_marketplace(
        $1::text,
        $2::text[],
        $3::text[],
        $4::numeric,
        $5::numeric,
        $6::numeric,
        $7::boolean,
        $8::boolean,
        $9::text[],
        $10::text,
        $11::integer,
        $12::integer
      )`,
      [
        query || null,
        specializations.length > 0 ? specializations : null,
        languages.length > 0 ? languages : null,
        minPrice ?? null,
        maxPrice ?? null,
        minRating ?? null,
        acceptsInsurance ?? null,
        availableNow ?? null,
        sessionFormats.length > 0 ? sessionFormats : null,
        sortBy,
        limit,
        offset,
      ],
    );

    // Track search analytics
    if (searcherId) {
      this.trackSearch(searcherId, organizationId, query, options, results.length).catch(() => {});
    }

    const totalRow = results[0];
    const total = totalRow ? parseInt((totalRow as any).total_count || '0', 10) : 0;

    // Augment results with therapists.public_slug for booking page links
    let slugMap: Record<string, string> = {};
    if (results.length > 0) {
      const therapistIds = results.map((r: any) => r.therapist_id).filter(Boolean);
      if (therapistIds.length > 0) {
        const slugRows = await this.db.query(
          `SELECT id, public_slug FROM therapists WHERE id = ANY($1::uuid[]) AND public_slug IS NOT NULL`,
          [therapistIds],
        );
        for (const row of slugRows as any[]) {
          slugMap[row.id] = row.public_slug;
        }
      }
    }
    const augmentedResults = results.map((r: any) => ({
      ...r,
      public_slug: slugMap[r.therapist_id] ?? null,
    }));

    return {
      results: augmentedResults,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  private async trackSearch(
    userId: string,
    organizationId: string | undefined,
    query: string,
    filters: SearchOptions,
    resultCount: number,
  ) {
    await this.db.execute(
      `INSERT INTO marketplace_searches
         (user_id, organization_id, search_query, filters_used, result_count, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        organizationId || null,
        query,
        JSON.stringify(filters),
        resultCount,
      ],
    );
  }

  // ============================================================
  // LISTINGS
  // ============================================================

  async getListings(organizationId?: string, options?: { page: number; limit: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ml.is_active = TRUE AND ml.deleted_at IS NULL`;
    const params: any[] = [];

    if (organizationId) {
      whereClause += ` AND ml.organization_id = $${params.length + 1}`;
      params.push(organizationId);
    }

    const listings = await this.db.query(
      `SELECT ml.*, t.first_name, t.last_name, t.title, t.avatar_url,
              t.years_experience, t.rating_average, t.rating_count
       FROM marketplace_listings ml
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       ${whereClause}
       ORDER BY ml.is_featured DESC, t.rating_average DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const countRow = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM marketplace_listings ml ${whereClause}`,
      params,
    );

    return {
      listings,
      total: parseInt(countRow?.count || '0', 10),
      page,
      limit,
    };
  }

  async getListingByTherapistId(therapistId: string) {
    const listing = await this.db.queryOne(
      `SELECT ml.*, t.first_name, t.last_name, t.title, t.bio, t.avatar_url,
              t.years_experience, t.rating_average, t.rating_count,
              t.specializations, t.languages, t.license_number, t.license_state,
              t.education, t.certifications, t.approaches
       FROM marketplace_listings ml
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       WHERE ml.therapist_id = $1 AND ml.deleted_at IS NULL`,
      [therapistId],
    );

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    return listing;
  }

  async getListingById(id: string) {
    const listing = await this.db.queryOne(
      `SELECT ml.*, t.first_name, t.last_name, t.title, t.bio, t.avatar_url,
              t.years_experience, t.rating_average, t.rating_count,
              t.specializations, t.languages, t.license_number, t.license_state,
              t.education, t.certifications, t.approaches
       FROM marketplace_listings ml
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       WHERE ml.id = $1 AND ml.is_active = TRUE AND ml.deleted_at IS NULL`,
      [id],
    );

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    // Record view
    this.db.execute(
      `UPDATE marketplace_listings SET view_count = view_count + 1 WHERE id = $1`,
      [id],
    ).catch(() => {});

    return listing;
  }

  async createListing(therapistId: string, organizationId: string, data: any) {
    // Check if listing already exists
    const existing = await this.db.queryOne(
      `SELECT id FROM marketplace_listings WHERE therapist_id = $1 AND deleted_at IS NULL`,
      [therapistId],
    );

    if (existing) {
      throw new BadRequestException('Marketplace listing already exists for this therapist');
    }

    const listing = await this.db.queryOne(
      `INSERT INTO marketplace_listings
         (therapist_id, organization_id, headline, bio_extended, session_rate_min, session_rate_max,
          session_formats, availability_summary, tags, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        therapistId,
        organizationId,
        data.headline,
        data.bio_extended,
        data.session_rate_min,
        data.session_rate_max,
        JSON.stringify(data.session_formats || []),
        data.availability_summary,
        JSON.stringify(data.tags || []),
        data.is_active !== false,
      ],
    );

    this.eventEmitter.emit('marketplace.listing.created', { therapistId, listingId: (listing as any).id });
    return listing;
  }

  async updateListing(id: string, therapistId: string, data: any) {
    const listing = await this.db.queryOne(
      `SELECT id FROM marketplace_listings WHERE id = $1 AND therapist_id = $2 AND deleted_at IS NULL`,
      [id, therapistId],
    );

    if (!listing) {
      throw new NotFoundException('Listing not found or access denied');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields = [
      'headline', 'bio_extended', 'session_rate_min', 'session_rate_max',
      'session_formats', 'availability_summary', 'tags', 'is_active',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(
          typeof data[field] === 'object' ? JSON.stringify(data[field]) : data[field],
        );
      }
    }

    if (updates.length === 0) return listing;

    values.push(id);
    return this.db.queryOne(
      `UPDATE marketplace_listings SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING *`,
      values,
    );
  }

  async deleteListing(id: string, therapistId: string) {
    await this.db.execute(
      `UPDATE marketplace_listings SET deleted_at = NOW(), is_active = FALSE
       WHERE id = $1 AND therapist_id = $2`,
      [id, therapistId],
    );
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  async getReviews(
    listingId: string,
    options: { page: number; limit: number; sortBy?: string },
  ) {
    const offset = (options.page - 1) * options.limit;
    const sortMap: Record<string, string> = {
      newest: 'r.created_at DESC',
      highest: 'r.overall_rating DESC',
      lowest: 'r.overall_rating ASC',
      helpful: 'helpful_count DESC',
    };
    const orderBy = sortMap[options.sortBy || 'newest'] || 'r.created_at DESC';

    const reviews = await this.db.query(
      `SELECT r.id, r.overall_rating, r.communication_rating, r.expertise_rating,
              r.punctuality_rating, r.review_text, r.session_count, r.is_verified,
              r.helpful_count, r.created_at,
              (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.vote_type = 'helpful') AS helpful_votes
       FROM marketplace_reviews r
       WHERE r.listing_id = $1 AND r.is_published = TRUE AND r.deleted_at IS NULL
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [listingId, options.limit, offset],
    );

    const stats = await this.db.queryOne(
      `SELECT
         COUNT(*) AS total_reviews,
         ROUND(AVG(overall_rating), 1) AS avg_rating,
         COUNT(*) FILTER (WHERE overall_rating = 5) AS five_star,
         COUNT(*) FILTER (WHERE overall_rating = 4) AS four_star,
         COUNT(*) FILTER (WHERE overall_rating = 3) AS three_star,
         COUNT(*) FILTER (WHERE overall_rating = 2) AS two_star,
         COUNT(*) FILTER (WHERE overall_rating = 1) AS one_star
       FROM marketplace_reviews
       WHERE listing_id = $1 AND is_published = TRUE AND deleted_at IS NULL`,
      [listingId],
    );

    return { reviews, stats };
  }

  async createReview(
    listingId: string,
    patientId: string,
    data: {
      overall_rating: number;
      communication_rating?: number;
      expertise_rating?: number;
      punctuality_rating?: number;
      review_text?: string;
      session_count?: number;
    },
  ) {
    // Verify patient has completed sessions with this therapist
    const hasSession = await this.db.queryOne(
      `SELECT s.id FROM sessions s
       JOIN marketplace_listings ml ON ml.therapist_id = s.therapist_id
       WHERE ml.id = $1 AND s.patient_id = $2 AND s.status = 'completed'`,
      [listingId, patientId],
    );

    if (!hasSession) {
      throw new ForbiddenException('You must complete a session before leaving a review');
    }

    // Check for existing review
    const existing = await this.db.queryOne(
      `SELECT id FROM marketplace_reviews WHERE listing_id = $1 AND patient_id = $2 AND deleted_at IS NULL`,
      [listingId, patientId],
    );

    if (existing) {
      throw new BadRequestException('You have already reviewed this therapist');
    }

    const review = await this.db.queryOne(
      `INSERT INTO marketplace_reviews
         (listing_id, patient_id, overall_rating, communication_rating, expertise_rating,
          punctuality_rating, review_text, session_count, is_verified, is_published, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE, NOW())
       RETURNING *`,
      [
        listingId,
        patientId,
        data.overall_rating,
        data.communication_rating || null,
        data.expertise_rating || null,
        data.punctuality_rating || null,
        data.review_text || null,
        data.session_count || null,
      ],
    );

    this.eventEmitter.emit('marketplace.review.created', { listingId, patientId });
    return review;
  }

  async voteReviewHelpful(reviewId: string, userId: string, voteType: 'helpful' | 'not_helpful') {
    await this.db.execute(
      `INSERT INTO review_votes (review_id, user_id, vote_type, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (review_id, user_id) DO UPDATE SET vote_type = EXCLUDED.vote_type`,
      [reviewId, userId, voteType],
    );

    // Update helpful_count
    await this.db.execute(
      `UPDATE marketplace_reviews SET
         helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND vote_type = 'helpful')
       WHERE id = $1`,
      [reviewId],
    );
  }

  // ============================================================
  // BOOKMARKS
  // ============================================================

  async getBookmarks(userId: string) {
    return this.db.query(
      `SELECT mb.id, mb.created_at, ml.id AS listing_id, ml.headline,
              t.first_name, t.last_name, t.avatar_url, t.rating_average
       FROM marketplace_bookmarks mb
       JOIN marketplace_listings ml ON ml.id = mb.listing_id
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       WHERE mb.user_id = $1 AND mb.deleted_at IS NULL
       ORDER BY mb.created_at DESC`,
      [userId],
    );
  }

  async addBookmark(userId: string, listingId: string) {
    const bookmark = await this.db.queryOne(
      `INSERT INTO marketplace_bookmarks (user_id, listing_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, listing_id) DO UPDATE SET deleted_at = NULL
       RETURNING id`,
      [userId, listingId],
    );
    return bookmark;
  }

  async removeBookmark(userId: string, listingId: string) {
    await this.db.execute(
      `UPDATE marketplace_bookmarks SET deleted_at = NOW()
       WHERE user_id = $1 AND listing_id = $2`,
      [userId, listingId],
    );
  }

  // ============================================================
  // CATEGORIES
  // ============================================================

  async getCategories() {
    return this.db.query(
      `SELECT id, name, slug, description, icon, listing_count, is_featured
       FROM marketplace_categories
       WHERE is_active = TRUE
       ORDER BY is_featured DESC, sort_order ASC, name ASC`,
    );
  }

  // ============================================================
  // FEATURED SLOTS
  // ============================================================

  async getFeaturedListings(limit = 6) {
    return this.db.query(
      `SELECT ml.*, t.first_name, t.last_name, t.title, t.avatar_url,
              t.rating_average, t.rating_count, t.years_experience
       FROM marketplace_listings ml
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       LEFT JOIN marketplace_featured_slots fs ON fs.listing_id = ml.id
         AND fs.starts_at <= NOW() AND fs.ends_at >= NOW() AND fs.is_active = TRUE
       WHERE ml.is_active = TRUE AND ml.deleted_at IS NULL
       ORDER BY (fs.id IS NOT NULL) DESC, t.rating_average DESC
       LIMIT $1`,
      [limit],
    );
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  async getListingAnalytics(listingId: string, therapistId: string) {
    // Verify ownership
    const listing = await this.db.queryOne(
      `SELECT id FROM marketplace_listings WHERE id = $1 AND therapist_id = $2`,
      [listingId, therapistId],
    );

    if (!listing) throw new ForbiddenException('Access denied');

    return this.db.query(
      `SELECT date_trunc('day', created_at) AS date,
              action_type,
              COUNT(*) AS count
       FROM marketplace_analytics
       WHERE listing_id = $1
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
       ORDER BY 1 DESC`,
      [listingId],
    );
  }

  async getMarketplaceStats() {
    const stats = await this.db.queryOne(
      `SELECT
         (SELECT COUNT(*) FROM marketplace_listings WHERE is_active = TRUE AND deleted_at IS NULL) AS active_listings,
         (SELECT COUNT(*) FROM marketplace_reviews WHERE is_published = TRUE AND deleted_at IS NULL) AS total_reviews,
         (SELECT COUNT(*) FROM marketplace_categories WHERE is_active = TRUE) AS categories,
         (SELECT ROUND(AVG(overall_rating), 1) FROM marketplace_reviews WHERE is_published = TRUE AND deleted_at IS NULL) AS platform_avg_rating`,
      [],
    );
    return stats;
  }

  // ============================================================
  // PUBLIC THERAPIST PROFILE BY ID
  // ============================================================

  async getTherapistById(id: string) {
    const therapist = await this.db.queryOne<any>(
      `SELECT
         t.id, t.display_name, t.bio, t.specialty, t.specializations,
         t.languages, t.avatar_url, t.license_number, t.years_experience,
         t.location, t.public_slug, t.verification_status,
         (SELECT price_cents FROM therapist_booking_offerings
          WHERE therapist_id = t.id AND is_active = TRUE ORDER BY duration_mins ASC LIMIT 1
         ) AS session_price_cents
       FROM therapists t
       WHERE t.id = $1 AND t.verification_status = 'approved'`,
      [id],
    );
    if (!therapist) throw new NotFoundException('Therapist not found');
    return therapist;
  }

  // ============================================================
  // BOOKING FLOW
  // ============================================================

  async initiateBooking(
    patientId: string,
    organizationId: string,
    listingId: string,
    data: {
      preferred_date: string;
      preferred_time: string;
      session_format: string;
      message?: string;
    },
  ) {
    // Get listing + therapist info
    const listing = await this.db.queryOne<any>(
      `SELECT ml.therapist_id, ml.session_rate_min, t.first_name, t.last_name
       FROM marketplace_listings ml
       JOIN therapist_profiles t ON t.id = ml.therapist_id
       WHERE ml.id = $1 AND ml.is_active = TRUE`,
      [listingId],
    );

    if (!listing) throw new NotFoundException('Listing not found');

    // Create booking request (maps to radar/session system)
    const bookingRef = await this.db.queryOne(
      `INSERT INTO radar_requests
         (patient_id, organization_id, status, urgency, preferred_specializations,
          preferred_languages, message, metadata, expires_at, created_at)
       VALUES ($1, $2, 'pending', 'normal', '{}', '{}', $3, $4, NOW() + INTERVAL '48 hours', NOW())
       RETURNING id`,
      [
        patientId,
        organizationId,
        data.message || null,
        JSON.stringify({
          listing_id: listingId,
          therapist_id: listing.therapist_id,
          preferred_date: data.preferred_date,
          preferred_time: data.preferred_time,
          session_format: data.session_format,
          direct_booking: true,
        }),
      ],
    );

    // Track analytics
    await this.db.execute(
      `INSERT INTO marketplace_analytics (listing_id, action_type, user_id, created_at)
       VALUES ($1, 'booking_initiated', $2, NOW())`,
      [listingId, patientId],
    );

    this.eventEmitter.emit('marketplace.booking.initiated', {
      patientId,
      therapistId: listing.therapist_id,
      listingId,
      bookingId: (bookingRef as any).id,
    });

    return {
      booking_id: (bookingRef as any).id,
      therapist: { first_name: listing.first_name, last_name: listing.last_name },
      status: 'pending',
      message: 'Booking request sent to therapist',
    };
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
