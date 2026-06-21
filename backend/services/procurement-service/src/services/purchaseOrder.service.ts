import { PurchaseOrder, PurchaseOrderDocument } from '../models/PurchaseOrder';
import { generatePoNumber } from '@procurement/utils';
import { v4 as uuidv4 } from 'uuid';

export class PurchaseOrderService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = PurchaseOrder.scan();

    if (query.status) {
      scanReq = scanReq.where('status').eq(query.status);
    }
    if (query.vendor) {
      scanReq = scanReq.where('vendor').eq(query.vendor);
    }

    const allOrders = await scanReq.exec();

    // In-memory filter for PO number
    let filtered = [...allOrders];
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((o: any) => 
        (o.poNumber && o.poNumber.toLowerCase().includes(search))
      );
    }

    // Manual sort and pagination
    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const orders = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return { orders, total };
  }

  async findById(id: string) {
    const order = await PurchaseOrder.get(id);

    if (!order) throw new Error('Purchase order not found');
    return order;
  }

  async create(data: Partial<PurchaseOrderDocument>, userId: string) {
    const poNumber = generatePoNumber();
    
    let subtotal = 0;
    if (data.items && data.items.length > 0) {
      data.items = data.items.map(item => {
        const totalPrice = item.quantity * item.unitPrice;
        subtotal += totalPrice;
        return { ...item, totalPrice };
      });
    }

    const tax = data.tax || 0;
    const totalAmount = subtotal + tax;

    const order = await PurchaseOrder.create({
      ...data,
      _id: uuidv4(),
      poNumber,
      subtotal,
      totalAmount,
      createdBy: userId,
    });

    return order;
  }

  async update(id: string, data: Partial<PurchaseOrderDocument>) {
    const order = await PurchaseOrder.get(id);
    if (!order) throw new Error('Purchase order not found');

    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error(`Cannot update order in ${order.status} status`);
    }

    if (data.items) {
      let subtotal = 0;
      data.items = data.items.map(item => {
        const totalPrice = item.quantity * item.unitPrice;
        subtotal += totalPrice;
        return { ...item, totalPrice };
      });
      data.subtotal = subtotal;
      data.totalAmount = subtotal + (data.tax !== undefined ? data.tax : order.tax);
    } else if (data.tax !== undefined) {
      data.totalAmount = order.subtotal + data.tax;
    }

    const updated = await PurchaseOrder.update({ _id: id }, data);
    return updated;
  }

  async getStats() {
    // In-memory aggregation for DynamoDB
    const allOrders = await PurchaseOrder.scan().exec();
    
    const statusMap: Record<string, { count: number; totalValue: number }> = {};
    
    allOrders.forEach((o: any) => {
      const status = o.status || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, totalValue: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].totalValue += (o.totalAmount || 0);
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

export default new PurchaseOrderService();
