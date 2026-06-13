import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

export interface ContactFormDto {
  name: string;
  email: string;
  subject: string;
  message: string;
  contact_type?: 'general' | 'sales' | 'support' | 'partnership';
}

@Injectable()
export class ContactService {
  constructor(private readonly mail: MailService) {}

  async submit(dto: ContactFormDto): Promise<void> {
    await this.mail.send({
      to: 'support@24therapy.ai',
      subject: `[Contact Form] ${dto.contact_type ?? 'general'}: ${dto.subject}`,
      html: `
        <p><strong>From:</strong> ${dto.name} &lt;${dto.email}&gt;</p>
        <p><strong>Type:</strong> ${dto.contact_type ?? 'general'}</p>
        <p><strong>Message:</strong></p>
        <p>${dto.message.replace(/\n/g, '<br/>')}</p>
      `,
    });
  }
}
