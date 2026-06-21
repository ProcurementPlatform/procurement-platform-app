import { Router } from 'express';
import { authenticate, authorize, validate, auditLog } from '@procurement/middleware';
import { ROLES } from '@procurement/types';
import invoiceController from '../controllers/invoice.controller';
import feedbackController from '../controllers/feedback.controller';
import chatController from '../controllers/chat.controller';
import contractController from '../controllers/contract.controller';
import searchController from '../controllers/search.controller';
import { feedbackSchema, chatSchema, searchSchema } from '../validators';

const router: import('express').Router = Router();

// All AI routes require a valid JWT. (In the in-process gateway, the
// procurement/finance/document routers mounted before this one already apply a
// blanket authenticate to fall-through paths, so gating consistently here is
// both correct and simpler.)
router.use(authenticate);

// Authenticated liveness check — confirms the ai-service router is mounted and
// reports the configured Bedrock models (no secrets).
router.get('/ai/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ok',
    data: { service: 'ai-service', timestamp: new Date() },
  });
});

// ── Procurement Copilot (Phase 2) ───────────────────────────────────────────
// Open to all roles; chat.service scopes the data each role can see.
router.post(
  '/ai/chat',
  authorize(ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE, ROLES.VENDOR, ROLES.AUDITOR, ROLES.EMPLOYEE),
  validate(chatSchema),
  auditLog('ai_chat_message', 'ai_chat'),
  chatController.chat
);

// ── Invoice Intelligence (Phase 1) ──────────────────────────────────────────
router.post(
  '/ai/invoices/:invoiceId/analyze',
  authorize(ROLES.ADMIN, ROLES.FINANCE, ROLES.PROCUREMENT_MANAGER, ROLES.AUDITOR),
  auditLog('ai_invoice_analyze', 'ai_invoice'),
  invoiceController.analyze
);
router.get(
  '/ai/invoices/:invoiceId',
  authorize(ROLES.ADMIN, ROLES.FINANCE, ROLES.PROCUREMENT_MANAGER, ROLES.AUDITOR, ROLES.VENDOR),
  auditLog('ai_invoice_view', 'ai_invoice'),
  invoiceController.getAnalysis
);

// ── Contract Intelligence (Phase 3) ─────────────────────────────────────────
router.post(
  '/ai/contracts/:documentId/analyze',
  authorize(ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE, ROLES.AUDITOR),
  auditLog('ai_contract_analyze', 'ai_contract'),
  contractController.analyze
);
router.get(
  '/ai/contracts/:documentId',
  authorize(ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE, ROLES.AUDITOR),
  auditLog('ai_contract_view', 'ai_contract'),
  contractController.getAnalysis
);

// ── Document Search / RAG (Phase 4) ─────────────────────────────────────────
router.post(
  '/ai/search',
  authorize(ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE, ROLES.VENDOR, ROLES.AUDITOR, ROLES.EMPLOYEE),
  validate(searchSchema),
  auditLog('ai_search_query', 'ai_search'),
  searchController.search
);
router.post(
  '/ai/search/index/:documentId',
  authorize(ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE),
  auditLog('ai_search_index', 'ai_search'),
  searchController.indexDocument
);

// ── Feedback (quality tracking) ─────────────────────────────────────────────
router.post(
  '/ai/feedback',
  validate(feedbackSchema),
  auditLog('ai_feedback', 'ai_feedback'),
  feedbackController.create
);

export default router;
