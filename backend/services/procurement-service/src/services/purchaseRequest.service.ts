import { PurchaseRequest, PurchaseRequestDocument } from '../models/PurchaseRequest';
import { v4 as uuidv4 } from 'uuid';

export class PurchaseRequestService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = PurchaseRequest.scan();

    if (query.status) {
      scanReq = scanReq.where('status').eq(query.status);
    }
    if (query.department) {
      scanReq = scanReq.where('department').eq(query.department);
    }
    if (query.priority) {
      scanReq = scanReq.where('priority').eq(query.priority);
    }

    const allRequests = await scanReq.exec();
    
    // In-memory text search fallback for DynamoDB
    let filtered = [...allRequests];
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((r) => 
        (r.title && r.title.toLowerCase().includes(search)) || 
        (r.department && r.department.toLowerCase().includes(search))
      );
    }

    // Manual sort and pagination
    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const requests = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return { requests, total };
  }

  async findById(id: string) {
    const request = await PurchaseRequest.get(id);

    if (!request) throw new Error('Purchase request not found');
    return request;
  }

  async create(data: Partial<PurchaseRequestDocument>, userId: string) {
    const request = await PurchaseRequest.create({
      ...data,
      _id: uuidv4(),
      requestedBy: userId,
      status: 'draft',
    });

    return request;
  }

  async update(id: string, data: Partial<PurchaseRequestDocument>) {
    const request = await PurchaseRequest.get(id);
    if (!request) throw new Error('Purchase request not found');
    
    if (['approved', 'rejected'].includes(request.status)) {
      throw new Error(`Cannot update request in ${request.status} status`);
    }

    const updated = await PurchaseRequest.update({ _id: id }, data);
    return updated;
  }

  async submit(id: string) {
    const request = await PurchaseRequest.get(id);
    if (!request) throw new Error('Purchase request not found');
    
    if (request.status !== 'draft') {
      throw new Error('Only draft requests can be submitted');
    }

    const updated = await PurchaseRequest.update({ _id: id }, { status: 'pending' });
    return updated;
  }

  async approve(id: string, userId: string) {
    const request = await PurchaseRequest.get(id);
    if (!request) throw new Error('Purchase request not found');
    
    if (request.status !== 'pending') {
      throw new Error('Only pending requests can be approved');
    }

    const updated = await PurchaseRequest.update({ _id: id }, { status: 'approved', approvedBy: userId });
    return updated;
  }

  async reject(id: string, reason: string, userId: string) {
    const request = await PurchaseRequest.get(id);
    if (!request) throw new Error('Purchase request not found');
    
    if (request.status !== 'pending') {
      throw new Error('Only pending requests can be rejected');
    }

    const updated = await PurchaseRequest.update({ _id: id }, { 
      status: 'rejected', 
      rejectionReason: reason,
      approvedBy: userId 
    });
    return updated;
  }

  async getStats() {
    // In-memory aggregation for DynamoDB
    const allRequests = await PurchaseRequest.scan().exec();
    
    const statusMap: Record<string, { count: number; totalValue: number }> = {};
    
    allRequests.forEach((req: any) => {
      const status = req.status || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, totalValue: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].totalValue += (req.estimatedCost || 0);
    });

    const stats = Object.keys(statusMap).map(status => ({
      _id: status,
      count: statusMap[status].count,
      totalValue: statusMap[status].totalValue,
    }));

    const total = stats.reduce((acc, curr) => acc + curr.count, 0);

    return {
      total,
      byStatus: stats,
    };
  }
}

export default new PurchaseRequestService();
