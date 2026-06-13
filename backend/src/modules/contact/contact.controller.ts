import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { ContactService, ContactFormDto } from './contact.service';

class ContactDto implements ContactFormDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(200) subject!: string;
  @IsString() @MinLength(1) @MaxLength(5000) message!: string;
  @IsOptional() @IsEnum(['general', 'sales', 'support', 'partnership']) contact_type?: 'general' | 'sales' | 'support' | 'partnership';
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit contact form (no auth required)' })
  async submit(@Body() dto: ContactDto) {
    await this.contactService.submit(dto);
    return { success: true, message: 'Your message has been received. We\'ll respond within 1 business day.' };
  }
}
