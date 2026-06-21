import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export type AIFeature = 'chat' | 'contract' | 'search' | 'invoice';

export interface FeedbackDocument extends Item {
  _id: string;
  feature: AIFeature;
  referenceId?: string;
  userId: string;
  rating: 'up' | 'down';
  comment?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    feature: {
      type: String,
      enum: ['chat', 'contract', 'search', 'invoice'],
      required: true,
      index: { name: 'feedbackFeatureIndex', type: 'global' },
    },
    referenceId: {
      type: String,
      index: { name: 'feedbackReferenceIdIndex', type: 'global' },
    },
    userId: {
      type: String,
      required: true,
      index: { name: 'feedbackUserIdIndex', type: 'global' },
    },
    rating: { type: String, enum: ['up', 'down'], required: true },
    comment: { type: String },
    context: { type: Object, schema: {} },
  },
  { timestamps: true }
);

export const Feedback = dynamoose.model<FeedbackDocument>('AI_Feedback', feedbackSchema, {
  create: true,
});
