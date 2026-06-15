import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEmail, IsArray, IsIn, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';

class AssessmentResultDto {
  @IsIn(['phq9', 'gad7', 'pcl5'])
  type: 'phq9' | 'gad7' | 'pcl5';

  @IsNumber()
  score: number;

  @IsString()
  severity: string;
}

class SubmitAssessmentDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentResultDto)
  results: AssessmentResultDto[];
}

@ApiTags('assessments-public')
@Controller('assessments/public')
export class PublicAssessmentsController {
  private readonly logger = new Logger(PublicAssessmentsController.name);
  private stripe: Stripe | null = null;
  private readonly couponId: string | undefined;

  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    this.couponId = this.config.get<string>('STRIPE_ASSESSMENT_COUPON_ID');
    if (secretKey && secretKey !== 'sk_test_placeholder') {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    }
  }

  @Post('submit')
  @Public()
  @Throttle({ short: { ttl: 60000, limit: 3 }, long: { ttl: 3600000, limit: 10 } })
  @ApiOperation({ summary: 'Submit public assessment results and receive discount code via email' })
  async submitAssessment(@Body() dto: SubmitAssessmentDto): Promise<{ success: boolean }> {
    if (!dto.results || dto.results.length === 0) {
      throw new BadRequestException('No assessment results provided');
    }

    let promoCode: string | null = null;

    if (this.stripe && this.couponId) {
      try {
        const code = `HEALTH50-${randomUUID().slice(0, 8).toUpperCase()}`;
        const promo = await this.stripe.promotionCodes.create({
          coupon: this.couponId,
          code,
          max_redemptions: 1,
          restrictions: { first_time_transaction: true },
        });
        promoCode = promo.code;
      } catch (err) {
        this.logger.warn(`Stripe promo code creation failed: ${err?.message}`);
      }
    } else {
      promoCode = `HEALTH50-${randomUUID().slice(0, 8).toUpperCase()}`;
    }

    await this.mailService.sendAssessmentResults(dto.email, dto.results, promoCode);

    return { success: true };
  }
}
