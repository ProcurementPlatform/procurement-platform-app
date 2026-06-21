import { Payment, PaymentDocument } from '../models/Payment';
import { Invoice } from '../models/Invoice';
import { generatePaymentReference } from '@procurement/utils';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Payment.scan();

    if (query.status) scanReq = scanReq.where('status').eq(query.status);
    if (query.vendor) scanReq = scanReq.where('vendor').eq(query.vendor);

    const allPayments = await scanReq.exec();

    // Manual sort and pagination
    allPayments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const payments = allPayments.slice(skip, skip + limit);
    const total = allPayments.length;

    return { payments, total };
  }

  async findById(id: string) {
    const payment = await Payment.get(id);

    if (!payment) throw new Error('Payment not found');
    return payment;
  }

  async processPayment(data: { invoiceId: string; paymentMethod: string; notes?: string }, userId: string) {
    const invoice = await Invoice.get(data.invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    
    if (invoice.status !== 'approved') {
      throw new Error(`Cannot pay invoice in ${invoice.status} status. Must be approved first.`);
    }

    const vendorId = (invoice as any).vendorId || invoice.vendor;
    if (!vendorId) {
      throw new Error('This invoice has no associated vendor and cannot be recorded as a vendor payment.');
    }

    const payment = await Payment.create({
      _id: uuidv4(),
      paymentReference: generatePaymentReference(),
      invoice: invoice._id,
      vendor: vendorId,
      amount: invoice.totalAmount,
      paymentMethod: data.paymentMethod as any,
      notes: data.notes || '',
      processedBy: userId,
    });

    // Update invoice status
    await Invoice.update({ _id: data.invoiceId }, {
      status: 'paid',
      paymentDate: new Date(),
      paymentMethod: data.paymentMethod
    });

    return payment;
  }

  async getStats() {
    const allPayments = await Payment.scan().exec();
    
    const statusMap: Record<string, { count: number; totalValue: number }> = {};
    
    allPayments.forEach((p: any) => {
      const status = p.status || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, totalValue: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].totalValue += (p.amount || 0);
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

export default new PaymentService();
