import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationDocument extends Item {
  _id: string;
  title: string;
  message: string;
  type: 'contract_expiry' | 'invoice_due' | 'vendor_approval' | 'purchase_approval' | 'system';
  userId?: string;
  isRead: boolean;
  relatedId?: string;
  relatedModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['contract_expiry', 'invoice_due', 'vendor_approval', 'purchase_approval', 'system'],
      required: true,
    },
    userId: {
      type: String,
      index: {
        name: 'notificationUserIdIndex',
        type: 'global',
      },
    },
    isRead: { type: Boolean, default: false },
    relatedId: { type: String },
    relatedModel: { type: String },
  },
  { timestamps: true }
);

export const Notification = dynamoose.model<NotificationDocument>(
  'Document_Notification',
  notificationSchema,
  { create: true }
);
