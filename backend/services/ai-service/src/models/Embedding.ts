import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface EmbeddingDocument extends Item {
  _id: string;
  documentId: string;
  category: 'contract' | 'invoice' | 'purchase_order' | 'vendor_certificate' | 'other';
  relatedId?: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  tokenCount?: number;
  ownerVendorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const embeddingSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    documentId: {
      type: String,
      required: true,
      index: { name: 'embeddingDocumentIdIndex', type: 'global' },
    },
    category: {
      type: String,
      enum: ['contract', 'invoice', 'purchase_order', 'vendor_certificate', 'other'],
      required: true,
      index: { name: 'embeddingCategoryIndex', type: 'global' },
    },
    relatedId: {
      type: String,
      index: { name: 'embeddingRelatedIdIndex', type: 'global' },
    },
    chunkIndex: { type: Number, required: true },
    chunkText: { type: String, required: true },
    // Stored as a DynamoDB number list (List<N>).
    embedding: { type: Array, schema: [Number], required: true },
    tokenCount: { type: Number },
    // Denormalized so vendor-scoped retrieval is a single GSI query.
    ownerVendorId: {
      type: String,
      index: { name: 'embeddingOwnerVendorIndex', type: 'global' },
    },
  },
  { timestamps: true }
);

export const Embedding = dynamoose.model<EmbeddingDocument>('AI_Embedding', embeddingSchema, {
  create: true,
});
