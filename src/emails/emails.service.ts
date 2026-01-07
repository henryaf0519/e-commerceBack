/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailsService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailsService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.getOrThrow('EMAIL_USER'),
        pass: this.configService.getOrThrow('EMAIL_PASS'),
      },
    });
  }

  async sendOrderConfirmation(to: string, orderDetails: any) {
    const { orderId, invoice, shipping } = orderDetails;

    const brandColor = '#d946ef'; // El color rosa de tu marca
const bgColor = '#fdf4ff'; // Un fondo muy suave para contrastar

const htmlContent = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #f3f4f6;">
    
    <div style="background-color: ${brandColor}; padding: 30px 0; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">Dulciland</h1>
    </div>

    <div style="padding: 40px 30px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #111827; margin-top: 0; font-size: 24px; font-weight: 700;">Thank you for your order!</h2>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 0;">
          Your order <strong style="color: ${brandColor};">#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed.
        </p>
      </div>

      <div style="background-color: ${bgColor}; border: 1px solid #fbcfe8; border-radius: 10px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <p style="color: #be185d; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">Shipment Ready</p>
        <p style="color: #374151; font-size: 14px; margin: 10px 0 20px;">
          Your package is on its way. Track its progress here:
        </p>
        
        <a href="${shipping.trackingUrl}" style="background-color: ${brandColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(217, 70, 239, 0.4);">
          Track Package
        </a>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 15px; margin-bottom: 0;">Tracking Number: ${shipping.trackingNumber}</p>
      </div>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <div>
        <h3 style="color: #111827; font-size: 18px; margin-bottom: 15px;">🧾 Payment Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Paid:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: bold; font-size: 14px; text-align: right;">$${invoice.total} ${invoice.currency}</td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; text-align: center;">
          <a href="${invoice.stripeReceiptUrl}" style="color: ${brandColor}; text-decoration: none; font-size: 14px; font-weight: 600;">
            View Official Receipt &rarr;
          </a>
        </div>
      </div>

    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Need help? Reply to this email.<br>
        &copy; ${new Date().getFullYear()} Dulciland. All rights reserved.
      </p>
    </div>
  </div>
`;

    try {
      await this.transporter.sendMail({
        from: 'Dulciland',
        to: to,
        subject: `Order confirmation #${orderId.slice(0, 8)}`,
        html: htmlContent,
      });
      this.logger.log(`📧 Email enviado correctamente a ${to}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando email: ${error.message}`);
      // No lanzamos error para no romper la respuesta al usuario si falla el email
    }
  }
}
