import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

// Canonical Document_AuditLog model. Lives in the shared middleware package so
// that EVERY service which uses the auditLog middleware registers the model in
// its own process — required once services run as independent containers
// (previously this worked only because the gateway imported document-service in
// the same process). document-service re-exports this same instance.

export interface AuditLogDocument extends Item {
  _id: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    userId: { type: String, required: true, index: { name: 'auditUserIdIndex', type: 'global' } },
    action: { type: String, required: true },
    entity: { type: String, required: true, index: { name: 'auditEntityIndex', type: 'global' } },
    entityId: { type: String },
    details: { type: Object, default: {} },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
  },
  { timestamps: true }
);

export const AuditLog = dynamoose.model<AuditLogDocument>('Document_AuditLog', auditLogSchema, {
  create: true,
});
