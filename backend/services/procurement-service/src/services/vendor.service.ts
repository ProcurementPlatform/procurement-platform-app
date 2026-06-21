import { Vendor, VendorDocument } from '../models/Vendor';
import { generateVendorCode } from '@procurement/utils';
import { v4 as uuidv4 } from 'uuid';

export class VendorService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Vendor.scan();

    if (query.status) {
      scanReq = scanReq.where('status').eq(query.status);
    }

    const allVendors = await scanReq.exec();
    
    // In-memory text search fallback for DynamoDB
    let filtered = [...allVendors];
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((v: any) => 
        (v.vendorName && v.vendorName.toLowerCase().includes(search)) || 
        (v.vendorCode && v.vendorCode.toLowerCase().includes(search)) ||
        (v.email && v.email.toLowerCase().includes(search))
      );
    }

    // Manual sort and pagination
    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const vendors = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return { vendors, total };
  }

  async findById(id: string) {
    const vendor = await Vendor.get(id);

    if (!vendor) throw new Error('Vendor not found');
    return vendor;
  }

  async create(data: Partial<VendorDocument>, userId: string) {
    const vendorCode = generateVendorCode();
    const vendor = await Vendor.create({
      ...data,
      _id: uuidv4(),
      vendorCode,
      createdBy: userId,
      activities: [
        {
          action: 'created',
          description: 'Vendor record created',
          performedBy: userId,
          timestamp: new Date()
        },
      ],
    });

    return vendor;
  }

  async update(id: string, data: Partial<VendorDocument>, userId: string) {
    const vendor = await Vendor.get(id);
    if (!vendor) throw new Error('Vendor not found');

    const updatedFields = Object.keys(data).filter(key => key !== 'activities');

    const newActivities = [
      ...(vendor.activities || []),
      {
        action: 'updated',
        description: `Updated fields: ${updatedFields.join(', ')}`,
        performedBy: userId,
        timestamp: new Date()
      }
    ];

    const updated = await Vendor.update({ _id: id }, { ...data, activities: newActivities });
    return updated;
  }

  async delete(id: string) {
    const vendor = await Vendor.get(id);
    if (!vendor) throw new Error('Vendor not found');
    await Vendor.delete(id);
    return vendor;
  }

  async getStats() {
    // In-memory aggregation for DynamoDB
    const allVendors = await Vendor.scan().exec();
    
    const statusMap: Record<string, { count: number }> = {};
    
    allVendors.forEach((v: any) => {
      const status = v.status || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0 };
      }
      statusMap[status].count += 1;
    });

    const stats = Object.keys(statusMap).map(status => ({
      _id: status,
      count: statusMap[status].count,
    }));

    const total = stats.reduce((acc, curr) => acc + curr.count, 0);

    return {
      total,
      byStatus: stats,
    };
  }
}

export default new VendorService();
