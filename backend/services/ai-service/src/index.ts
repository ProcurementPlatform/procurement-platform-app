import aiRoutes from './routes';

// Models + service singletons, exported by package name for the gateway / scripts.
export { InvoiceAnalysis } from './models/InvoiceAnalysis';
export { ContractAnalysis } from './models/ContractAnalysis';
export { Embedding } from './models/Embedding';
export { Feedback } from './models/Feedback';

export { default as invoiceAnalysisService } from './services/invoice-analysis.service';
export { default as contractAnalysisService } from './services/contract-analysis.service';
export { default as searchService } from './services/search.service';
export { default as feedbackService } from './services/feedback.service';
export { default as chatService } from './services/chat.service';

export default aiRoutes;
