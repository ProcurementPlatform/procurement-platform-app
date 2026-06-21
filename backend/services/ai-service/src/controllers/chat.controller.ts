import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { sendSuccess, sendError } from '@procurement/utils';
import chatService from '../services/chat.service';
import { callerToken } from './token';

export class ChatController {
  async chat(req: IAuthenticatedRequest, res: Response) {
    try {
      const { messages, structured } = req.body;
      const result = await chatService.chat(req.user!, callerToken(req), messages, !!structured);
      return sendSuccess(res, result);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new ChatController();
