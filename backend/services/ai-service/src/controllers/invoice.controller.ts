import { Response } from 'express';
import { IAuthenticatedRequest } from '@procurement/types';
import { sendSuccess, sendError } from '@procurement/utils';
import invoiceAnalysisService from '../services/invoice-analysis.service';
import { resolveCallerScope, canAccessVendorData } from '../services/rbac-scope.service';
import { callerToken } from './token';

export class InvoiceIntelligenceController {
  async analyze(req: IAuthenticatedRequest, res: Response) {
    try {
      const analysis = await invoiceAnalysisService.analyze(callerToken(req), req.params.invoiceId, req.user!.userId);
      return sendSuccess(res, analysis, 'Invoice analyzed successfully', 201);
    } catch (error: any) {
      const code = error.message === 'Invoice not found' ? 404 : 400;
      return sendError(res, error.message, code);
    }
  }

  async getAnalysis(req: IAuthenticatedRequest, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      const token = callerToken(req);

      // Vendor callers may only read analysis for their own invoices.
      const scope = await resolveCallerScope(req.user!, token);
      if (scope.isVendor) {
        const invoice = await invoiceAnalysisService.getInvoice(token, invoiceId);
        if (!invoice) return sendError(res, 'Invoice not found', 404);
        if (!canAccessVendorData(scope, invoice.vendorId)) {
          return sendError(res, 'You do not have access to this invoice.', 403);
        }
      }

      const analysis = await invoiceAnalysisService.getLatest(invoiceId);
      if (!analysis) return sendError(res, 'No analysis found for this invoice', 404);
      return sendSuccess(res, analysis);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export default new InvoiceIntelligenceController();
