import { AuditLog } from '../models/AuditLog';

export class AuditService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 50) {
    let scanReq = AuditLog.scan();

    if (query.entity) scanReq = scanReq.where('entity').eq(query.entity);
    if (query.action) scanReq = scanReq.where('action').eq(query.action);
    if (query.userId) scanReq = scanReq.where('userId').eq(query.userId);

    const allLogs = await scanReq.exec();

    // In-memory filter for dates
    let filtered = [...allLogs];
    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate as string) : new Date(0);
      const end = query.endDate ? new Date(query.endDate as string) : new Date(8640000000000000); // max date
      filtered = filtered.filter((log: any) => {
        const d = new Date(log.createdAt);
        return d >= start && d <= end;
      });
    }

    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const logs = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return { logs, total };
  }
}

export default new AuditService();
