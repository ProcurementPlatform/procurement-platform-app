import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { sendSuccess, sendError } from '@procurement/utils';
import feedbackService from '../services/feedback.service';

export class FeedbackController {
  async create(req: IAuthenticatedRequest, res: Response) {
    try {
      const created = await feedbackService.create(req.body, req.user!.userId);
      return sendSuccess(res, created, 'Feedback recorded', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new FeedbackController();
