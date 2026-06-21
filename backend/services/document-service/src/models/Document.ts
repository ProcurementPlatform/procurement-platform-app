import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';
import { DocumentCategory } from '@procurement/types';

export interface DocumentDocument extends Item {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  category: DocumentCategory;
  relatedId?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new dynamoose.Schema(
  {
    _id: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    s3Key: { type: String, required: true },
    s3Bucket: { type: String, required: true },
    category: {
      type: String,
      enum: ['contract', 'invoice', 'purchase_order', 'vendor_certificate'],
      required: true,
      index: {
        name: 'documentCategoryIndex',
        type: 'global',
      },
    },
    relatedId: {
      type: String,
      index: {
        name: 'documentRelatedIdIndex',
        type: 'global',
      },
    },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Doc = dynamoose.model<DocumentDocument>('Document_Document', documentSchema, {
  create: true,
});
