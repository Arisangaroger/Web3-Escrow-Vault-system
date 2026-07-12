import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { NotificationStatus } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Send notification (simulated - writes to DB and console)
   */
  async sendNotification(
    phoneNumber: string,
    message: string,
    dealId?: number,
  ): Promise<void> {
    // Write to notifications_log
    await this.prisma.notificationLog.create({
      data: {
        recipientPhone: phoneNumber,
        message,
        dealId,
        deliveryStatus: NotificationStatus.Simulated_Sent,
      },
    });

    // Log to console (simulates SMS gateway)
    this.logger.log(`📱 SMS to ${phoneNumber}: ${message}`);
  }

  /**
   * Notify all parties about deal creation
   */
  async notifyDealCreated(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
      include: {
        sender: true,
        driver: true,
        receiver: true,
      },
    });

    if (!deal) return;

    // Notify driver
    await this.sendNotification(
      deal.driverPhone,
      `New deal #${dealId}: You are the transporter. Sender: ${deal.senderPhone}, Receiver: ${deal.receiverPhone}, Amount: ${deal.amount} RWF`,
      dealId,
    );

    // Notify receiver
    await this.sendNotification(
      deal.receiverPhone,
      `New deal #${dealId}: Lock ${deal.amount} RWF within 24 hours to confirm. Sender: ${deal.senderPhone}`,
      dealId,
    );
  }

  /**
   * Notify about funds locked
   */
  async notifyFundsLocked(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify sender
    await this.sendNotification(
      deal.senderPhone,
      `Deal #${dealId}: Funds locked by buyer. You can now ship the goods.`,
      dealId,
    );

    // Notify driver
    await this.sendNotification(
      deal.driverPhone,
      `Deal #${dealId}: Funds secured. Ready for pickup.`,
      dealId,
    );
  }

  /**
   * Notify about shipment
   */
  async notifyShipped(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify driver
    await this.sendNotification(
      deal.driverPhone,
      `Deal #${dealId}: Goods marked as shipped. Please pick up and deliver.`,
      dealId,
    );

    // Notify receiver
    await this.sendNotification(
      deal.receiverPhone,
      `Deal #${dealId}: Goods shipped. Delivery in progress.`,
      dealId,
    );
  }

  /**
   * CRITICAL: Triangular broadcast for delivery
   * This is the fraud prevention mechanism
   */
  async notifyDelivered(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify BOTH sender and receiver simultaneously
    // If receiver didn't actually receive, they can dispute within 3 hours
    
    // Notify sender
    await this.sendNotification(
      deal.senderPhone,
      `Deal #${dealId}: Driver marked DELIVERED. Funds will release in 3 hours unless disputed.`,
      dealId,
    );

    // Notify receiver (CRITICAL - fraud detection alert)
    await this.sendNotification(
      deal.receiverPhone,
      `Deal #${dealId}: Driver marked DELIVERED. If you did NOT receive goods, DISPUTE NOW! You have 3 hours.`,
      dealId,
    );
  }

  /**
   * Notify about dispute/revoke
   */
  async notifyRevoked(dealId: number, revokedBy: string): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify all three parties
    const parties = [deal.senderPhone, deal.driverPhone, deal.receiverPhone];
    
    for (const phone of parties) {
      if (phone !== revokedBy) {
        await this.sendNotification(
          phone,
          `Deal #${dealId}: DISPUTED by ${revokedBy}. Deal frozen. Admin will review.`,
          dealId,
        );
      }
    }

    // Notify admin (in production, this would go to admin dashboard)
    this.logger.warn(`⚠️  Deal #${dealId} disputed by ${revokedBy}. Admin review required.`);
  }

  /**
   * Notify about funds released
   */
  async notifyReleased(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify sender (they received payment)
    await this.sendNotification(
      deal.senderPhone,
      `Deal #${dealId}: ✅ COMPLETE! Payment of ${deal.amount} RWF released to you.`,
      dealId,
    );

    // Notify receiver
    await this.sendNotification(
      deal.receiverPhone,
      `Deal #${dealId}: ✅ COMPLETE! Transaction finished.`,
      dealId,
    );

    // Notify driver
    await this.sendNotification(
      deal.driverPhone,
      `Deal #${dealId}: ✅ COMPLETE! Delivery confirmed.`,
      dealId,
    );
  }

  /**
   * Notify about dispute resolution
   */
  async notifyDisputeResolved(
    dealId: number,
    amountToSender: string,
    amountToReceiver: string,
  ): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify sender
    await this.sendNotification(
      deal.senderPhone,
      `Deal #${dealId}: Dispute RESOLVED. You received ${amountToSender} RWF.`,
      dealId,
    );

    // Notify receiver
    await this.sendNotification(
      deal.receiverPhone,
      `Deal #${dealId}: Dispute RESOLVED. You received ${amountToReceiver} RWF refund.`,
      dealId,
    );

    // Notify driver
    await this.sendNotification(
      deal.driverPhone,
      `Deal #${dealId}: Dispute RESOLVED by admin.`,
      dealId,
    );
  }

  /**
   * Notify about auto-cancellation
   */
  async notifyAutoCancelled(dealId: number): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) return;

    // Notify all parties
    await this.sendNotification(
      deal.senderPhone,
      `Deal #${dealId}: AUTO-CANCELLED. Buyer did not lock funds within 24 hours.`,
      dealId,
    );

    await this.sendNotification(
      deal.receiverPhone,
      `Deal #${dealId}: AUTO-CANCELLED. You did not lock funds in time.`,
      dealId,
    );

    await this.sendNotification(
      deal.driverPhone,
      `Deal #${dealId}: AUTO-CANCELLED. Deal expired.`,
      dealId,
    );
  }
}
