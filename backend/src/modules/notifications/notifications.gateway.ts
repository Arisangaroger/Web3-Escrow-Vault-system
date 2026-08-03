import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../../common/logger.service';

/**
 * WebSocket Gateway for real-time SMS notifications.
 *
 * Each simulated phone connects and joins a room named after its
 * canonical phone number (e.g. "+250788100001").
 *
 * When NotificationsService.sendNotification() is called it asks this
 * gateway to push the message directly into the recipient's room —
 * so all simulator tabs watching that number see it instantly.
 */
@WebSocketGateway({
  cors: {
    origin: '*', // simulator runs from file:// or localhost
    methods: ['GET', 'POST'],
    credentials: false,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new LoggerService(NotificationsGateway.name);

  /** Called when a simulator phone connects */
  handleConnection(client: Socket) {
    this.logger.log(`WS client connected: ${client.id}`);
  }

  /** Called when a simulator phone disconnects */
  handleDisconnect(client: Socket) {
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  /**
   * Simulator sends { phone: "+250788100001" } to subscribe to its inbox.
   * The socket is added to a room with that phone number as the name.
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { phone: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.normalizePhone(data?.phone);
    if (!room) return;

    await client.join(room);
    this.logger.log(`Socket ${client.id} joined room: ${room}`);

    // Acknowledge subscription
    client.emit('subscribed', { phone: room });
  }

  /**
   * Push a notification to every socket in a phone's room.
   * Called internally by NotificationsService.
   */
  pushNotification(phoneNumber: string, payload: NotificationPayload) {
    const room = this.normalizePhone(phoneNumber);
    if (!room) return;

    this.server.to(room).emit('notification', payload);
    this.logger.log(`📡 WS push → room ${room}: ${payload.message.slice(0, 60)}…`);
  }

  /** Normalise 07xxxxxxxx → +25007xxxxxxxx */
  private normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const c = phone.trim().replace(/[\s-]/g, '');
    if (/^07\d{8}$/.test(c)) return '+250' + c.slice(1);
    if (/^\+2507\d{8}$/.test(c)) return c;
    if (/^2507\d{8}$/.test(c)) return '+' + c;
    return c || null;
  }
}

export interface NotificationPayload {
  id?: number;
  dealId?: number;
  recipientPhone?: string;
  message: string;
  sentAt: string;
  deliveryStatus: string;
}
