import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  private r(data: any, meta?: any) {
    return {
      success: true,
      data,
      meta: {
        request_id: uuidv4(),
        timestamp: new Date().toISOString(),
        version: 'v1',
        ...meta,
      },
    };
  }

  // ─── Public search (no auth required for browsing) ───────────────────────

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search marketplace for therapists' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'specializations', required: false, isArray: true })
  @ApiQuery({ name: 'languages', required: false, isArray: true })
  @ApiQuery({ name: 'min_price', required: false, type: Number })
  @ApiQuery({ name: 'max_price', required: false, type: Number })
  @ApiQuery({ name: 'min_rating', required: false, type: Number })
  @ApiQuery({ name: 'accepts_insurance', required: false, type: Boolean })
  @ApiQuery({ name: 'available_now', required: false, type: Boolean })
  @ApiQuery({ name: 'sort_by', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(
    @Query('q') query?: string,
    @Query('specializations') specializations?: string | string[],
    @Query('languages') languages?: string | string[],
    @Query('min_price') minPrice?: string,
    @Query('max_price') maxPrice?: string,
    @Query('min_rating') minRating?: string,
    @Query('accepts_insurance') acceptsInsurance?: string,
    @Query('available_now') availableNow?: string,
    @Query('sort_by') sortBy?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.service.search({
      query,
      specializations: Array.isArray(specializations)
        ? specializations
        : specializations
        ? [specializations]
        : [],
      languages: Array.isArray(languages)
        ? languages
        : languages
        ? [languages]
        : [],
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      acceptsInsurance: acceptsInsurance === 'true' ? true : undefined,
      availableNow: availableNow === 'true' ? true : undefined,
      sortBy: sortBy as any,
      page: Number(page),
      limit: Number(limit),
    });

    return this.r(result.results, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    });
  }

  // ─── Featured listings (public) ──────────────────────────────────────────

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured marketplace listings' })
  async getFeatured(@Query('limit') limit = 6) {
    const listings = await this.service.getFeaturedListings(Number(limit));
    return this.r(listings);
  }

  // ─── Categories (public) ─────────────────────────────────────────────────

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get marketplace categories' })
  async getCategories() {
    const categories = await this.service.getCategories();
    return this.r(categories);
  }

  // ─── Marketplace stats (public) ──────────────────────────────────────────

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get marketplace platform statistics' })
  async getStats() {
    const stats = await this.service.getMarketplaceStats();
    return this.r(stats);
  }

  // ─── Get therapist public profile by ID (public) ─────────────────────────

  @Get('therapist/:id')
  @Public()
  @ApiOperation({ summary: 'Get public therapist profile by ID' })
  async getTherapistById(@Param('id') id: string) {
    const therapist = await this.service.getTherapistById(id);
    return this.r(therapist);
  }

  // ─── Get listing by ID (public) ──────────────────────────────────────────

  @Get('listings/:id')
  @Public()
  @ApiOperation({ summary: 'Get marketplace listing details' })
  async getListing(@Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.service.getListingById(id);
    return this.r(listing);
  }

  // ─── Get all listings ────────────────────────────────────────────────────

  @Get('listings')
  @ApiOperation({ summary: 'Get marketplace listings' })
  async getListings(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.service.getListings(
      ['admin', 'super_admin'].includes(user.role) ? undefined : user.organizationId,
      { page: Number(page), limit: Number(limit) },
    );
    return this.r(result.listings, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  }

  // ─── Get my listing (therapist) ──────────────────────────────────────────

  @Get('listings/me/my')
  @ApiOperation({ summary: 'Get current therapist marketplace listing' })
  async getMyListing(@CurrentUser() user: CurrentUserData) {
    if (!user.therapistId) {
      return this.r(null);
    }
    const listing = await this.service.getListingByTherapistId(user.therapistId);
    return this.r(listing);
  }

  // ─── Create listing (therapist) ──────────────────────────────────────────

  @Post('listings')
  @ApiOperation({ summary: 'Create marketplace listing' })
  async createListing(
    @CurrentUser() user: CurrentUserData,
    @Body()
    body: {
      headline: string;
      bio_extended?: string;
      session_rate_min: number;
      session_rate_max?: number;
      session_formats?: string[];
      availability_summary?: string;
      tags?: string[];
      is_active?: boolean;
    },
  ) {
    if (!user.therapistId) {
      return this.r({ error: 'Therapist profile required' });
    }
    const listing = await this.service.createListing(
      user.therapistId,
      user.organizationId,
      body,
    );
    return this.r(listing);
  }

  // ─── Update listing (therapist) ──────────────────────────────────────────

  @Patch('listings/:id')
  @ApiOperation({ summary: 'Update marketplace listing' })
  async updateListing(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    if (!user.therapistId) {
      return this.r({ error: 'Therapist profile required' });
    }
    const listing = await this.service.updateListing(id, user.therapistId, body);
    return this.r(listing);
  }

  // ─── Delete listing (therapist) ──────────────────────────────────────────

  @Delete('listings/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete marketplace listing' })
  async deleteListing(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!user.therapistId) {
      return this.r({ error: 'Therapist profile required' });
    }
    await this.service.deleteListing(id, user.therapistId);
    return this.r({ deleted: true });
  }

  // ─── Get listing analytics ────────────────────────────────────────────────

  @Get('listings/:id/analytics')
  @ApiOperation({ summary: 'Get listing performance analytics' })
  async getListingAnalytics(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!user.therapistId) {
      return this.r({ error: 'Therapist profile required' });
    }
    const analytics = await this.service.getListingAnalytics(id, user.therapistId);
    return this.r(analytics);
  }

  // ─── Reviews ─────────────────────────────────────────────────────────────

  @Get('listings/:id/reviews')
  @Public()
  @ApiOperation({ summary: 'Get reviews for a listing' })
  async getReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sort_by') sortBy = 'newest',
  ) {
    const result = await this.service.getReviews(id, {
      page: Number(page),
      limit: Number(limit),
      sortBy,
    });
    return this.r(result);
  }

  @Post('listings/:id/reviews')
  @ApiOperation({ summary: 'Submit a review for a listing' })
  async createReview(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      overall_rating: number;
      communication_rating?: number;
      expertise_rating?: number;
      punctuality_rating?: number;
      review_text?: string;
      session_count?: number;
    },
  ) {
    if (!user.patientId) {
      return this.r({ error: 'Patient account required to leave reviews' });
    }
    const review = await this.service.createReview(id, user.patientId, body);
    return this.r(review);
  }

  @Post('reviews/:reviewId/vote')
  @ApiOperation({ summary: 'Vote a review as helpful or not helpful' })
  async voteReview(
    @CurrentUser() user: CurrentUserData,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() body: { vote_type: 'helpful' | 'not_helpful' },
  ) {
    await this.service.voteReviewHelpful(reviewId, user.userId, body.vote_type);
    return this.r({ voted: true });
  }

  // ─── Bookmarks ────────────────────────────────────────────────────────────

  @Get('bookmarks')
  @ApiOperation({ summary: 'Get bookmarked listings' })
  async getBookmarks(@CurrentUser() user: CurrentUserData) {
    const bookmarks = await this.service.getBookmarks(user.userId);
    return this.r(bookmarks);
  }

  @Post('bookmarks/:listingId')
  @ApiOperation({ summary: 'Bookmark a listing' })
  async addBookmark(
    @CurrentUser() user: CurrentUserData,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    const bookmark = await this.service.addBookmark(user.userId, listingId);
    return this.r(bookmark);
  }

  @Delete('bookmarks/:listingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove bookmark' })
  async removeBookmark(
    @CurrentUser() user: CurrentUserData,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    await this.service.removeBookmark(user.userId, listingId);
    return this.r({ removed: true });
  }

  // ─── Booking ──────────────────────────────────────────────────────────────

  @Post('listings/:id/book')
  @ApiOperation({ summary: 'Initiate a booking with a therapist' })
  async initiateBooking(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      preferred_date: string;
      preferred_time: string;
      session_format: string;
      message?: string;
    },
  ) {
    if (!user.patientId) {
      return this.r({ error: 'Patient account required' });
    }
    const booking = await this.service.initiateBooking(
      user.patientId,
      user.organizationId,
      id,
      body,
    );
    return this.r(booking);
  }
}

// Reviewed: 2026-06-13 — 24Therapy audit
