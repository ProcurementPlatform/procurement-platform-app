import { Feedback } from '../models/Feedback';

const toPlain = (doc: any) => (doc && typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

export class FeedbackService {
  async create(data: {
    feature: 'chat' | 'contract' | 'search' | 'invoice';
    referenceId?: string;
    rating: 'up' | 'down';
    comment?: string;
    context?: Record<string, unknown>;
  }, userId: string) {
    const created = await Feedback.create({ ...data, userId });
    return toPlain(created);
  }
}

export default new FeedbackService();
