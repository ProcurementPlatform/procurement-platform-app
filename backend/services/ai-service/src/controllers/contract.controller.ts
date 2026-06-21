import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { sendSuccess, sendError } from '@procurement/utils';
import contractAnalysisService from '../services/contract-analysis.service';
import { callerToken } from './token';

export class ContractIntelligenceController {
  async analyze(req: IAuthenticatedRequest, res: Response) {
    try {
      const analysis = await contractAnalysisService.analyze(callerToken(req), req.params.documentId, req.user!.userId);
      return sendSuccess(res, analysis, 'Contract analyzed', 201);
    } catch (error: any) {
      const code = error.message === 'Document not found' ? 404 : 400;
      return sendError(res, error.message, code);
    }
  }

  async getAnalysis(req: IAuthenticatedRequest, res: Response) {
    try {
      const analysis = await contractAnalysisService.getLatest(req.params.documentId);
      if (!analysis) return sendError(res, 'No analysis found for this document', 404);
      return sendSuccess(res, analysis);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new ContractIntelligenceController();
