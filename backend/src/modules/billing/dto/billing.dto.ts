import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray,
  IsUUID, IsNotEmpty, IsObject, IsEmail, Min, Max, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  SENT = 'sent',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  VOID = 'void',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CARD = 'card',
  ACH = 'ach',
  HSA = 'hsa',
  FSA = 'fsa',
  INSURANCE = 'insurance',
  SELF_PAY = 'self_pay',
  SLIDING_SCALE = 'sliding_scale',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsOptional()
  @IsUUID()
  patient_id?: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ─── Create Invoice DTO ───────────────────────────────────────────────────────

export class InvoiceLineItemDto {
  @ApiProperty({ description: 'Service description', example: 'Individual Psychotherapy - 50 min' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'CPT billing code', example: '90837' })
  @IsOptional()
  @IsString()
  cpt_code?: string;

  @ApiProperty({ description: 'Unit price in cents', example: 20000 })
  @IsNumber()
  @Min(0)
  unit_price_cents: number;

  @ApiPropertyOptional({ description: 'Quantity', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Session UUID this line item is for' })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ type: [InvoiceLineItemDto], minItems: 1 })
  @IsArray()
  @Type(() => InvoiceLineItemDto)
  line_items: InvoiceLineItemDto[];

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.SELF_PAY })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Invoice due date (ISO 8601)', example: '2025-02-15' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Internal notes (not shown to patient)' })
  @IsOptional()
  @IsString()
  internal_notes?: string;

  @ApiPropertyOptional({ description: 'Send invoice to patient immediately after creation', default: false })
  @IsOptional()
  @IsBoolean()
  send_immediately?: boolean;
}

// ─── Record Payment DTO ───────────────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty({ description: 'Amount paid in cents', example: 20000 })
  @IsNumber()
  @Min(1)
  amount_cents: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ description: 'Transaction reference ID from payment processor' })
  @IsOptional()
  @IsString()
  transaction_id?: string;

  @ApiPropertyOptional({ description: 'Date payment was received (ISO 8601)', example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  paid_at?: string;

  @ApiPropertyOptional({ description: 'Notes about this payment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Subscription DTO ────────────────────────────────────────────────────────

export class UpdateSubscriptionDto {
  @ApiProperty({ description: 'Stripe price ID to switch to' })
  @IsString()
  @IsNotEmpty()
  price_id: string;

  @ApiPropertyOptional({ description: 'New seat count', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @ApiPropertyOptional({ description: 'Prorate the charge when switching mid-cycle', default: true })
  @IsOptional()
  @IsBoolean()
  prorate?: boolean;
}

// ─── Coupon DTO ───────────────────────────────────────────────────────────────

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon/promotion code to apply', example: 'LAUNCH50' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
