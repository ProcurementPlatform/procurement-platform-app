import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { sendSuccess, sendError } from '@procurement/utils';
import searchService from '../services/search.service';
import { resolveCallerScope } from '../services/rbac-scope.service';
import { callerToken } from './token';

export class SearchController {
  async search(req: IAuthenticatedRequest, res: Response) {
    try {
      const { query, category, topK } = req.body;
      const token = callerToken(req);
      const scope = await resolveCallerScope(req.user!, token);
      const result = await searchService.search(query, category || undefined, topK || 5, scope);
      return sendSuccess(res, result);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async indexDocument(req: IAuthenticatedRequest, res: Response) {
    try {
      const result = await searchService.indexDocument(callerToken(req), req.params.documentId);
      return sendSuccess(res, result, 'Document indexed successfully', 201);
    } catch (error: any) {
      const code = error.message === 'Document not found' ? 404 : 400;
      return sendError(res, error.message, code);
    }
  }
}

export default new SearchController();
