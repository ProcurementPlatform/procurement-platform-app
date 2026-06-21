import documentRoutes from './routes';

export { Doc as Document } from './models/Document';
export { AuditLog } from './models/AuditLog';
export { Notification } from './models/Notification';

export { default as documentService } from './services/document.service';
export { default as auditService } from './services/audit.service';
export { default as notificationService } from './services/notification.service';

export default documentRoutes;
