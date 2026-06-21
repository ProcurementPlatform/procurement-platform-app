import { Notification } from '../models/Notification';
import { v4 as uuidv4 } from 'uuid';

export class NotificationService {
  async findAll(userId: string, skip = 0, limit = 20) {
    const allNotifications = await Notification.scan().where('userId').eq(userId).exec();

    allNotifications.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const notifications = allNotifications.slice(skip, skip + limit);
    const total = allNotifications.length;

    return { notifications, total };
  }

  async getUnreadCount(userId: string) {
    const allUnread = await Notification.scan().where('userId').eq(userId).and().where('isRead').eq(false).exec();
    return { count: allUnread.length };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await Notification.get(id);
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found');
    }

    const updated = await Notification.update({ _id: id }, { isRead: true });
    return updated;
  }

  async markAllAsRead(userId: string) {
    const unread = await Notification.scan().where('userId').eq(userId).and().where('isRead').eq(false).exec();
    
    // Using individual updates since Dynamoose doesn't have updateMany
    await Promise.all(
      unread.map((notif: any) => Notification.update({ _id: notif._id }, { isRead: true }))
    );
  }

  async createSystemNotification(data: { title: string; message: string; type: string; relatedId?: string; relatedModel?: string }) {
    await Notification.create({
      ...data,
      type: data.type as any,
      _id: uuidv4(),
      userId: 'SYSTEM', 
    });
  }
}

export default new NotificationService();
