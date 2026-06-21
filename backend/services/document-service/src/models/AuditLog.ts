// The canonical Document_AuditLog model now lives in @procurement/middleware so
// every service registers it (required once services run as separate containers).
// Re-exported here for backward compatibility with existing imports.
export { AuditLog } from '@procurement/middleware';
export type { AuditLogDocument } from '@procurement/middleware';
