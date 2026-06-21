import { Doc, DocumentDocument } from '../models/Document';
import { uploadToS3, deleteFromS3, generatePresignedDownloadUrl, config } from '@procurement/common';
import { v4 as uuidv4 } from 'uuid';

export class DocumentService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Doc.scan();

    if (query.category) {
      scanReq = scanReq.where('category').eq(query.category);
    }
    if (query.relatedId) {
      scanReq = scanReq.where('relatedId').eq(query.relatedId);
    }

    const allDocs = await scanReq.exec();

    allDocs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const documents = allDocs.slice(skip, skip + limit);
    const total = allDocs.length;

    return { documents, total };
  }

  async uploadFile(
    file: Express.Multer.File,
    category: string,
    userId: string,
    relatedId?: string
  ) {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const s3Key = `${category}s/${fileName}`;

    await uploadToS3(file.buffer, s3Key, file.mimetype);

    const document = await Doc.create({
      _id: uuidv4(),
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      s3Key,
      s3Bucket: config.aws.s3Bucket,
      category: category as any,
      relatedId,
      uploadedBy: userId,
    });

    return document;
  }

  async getDownloadUrl(id: string) {
    const document = await Doc.get(id);
    if (!document) throw new Error('Document not found');

    const url = generatePresignedDownloadUrl(document.s3Key);
    return { url, document };
  }

  async delete(id: string) {
    const document = await Doc.get(id);
    if (!document) throw new Error('Document not found');

    await deleteFromS3(document.s3Key);
    await Doc.delete(id);

    return document;
  }
}

export default new DocumentService();
