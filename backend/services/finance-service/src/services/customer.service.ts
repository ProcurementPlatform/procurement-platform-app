import { Customer, CustomerDocument } from '../models/Customer';
import { v4 as uuidv4 } from 'uuid';

const generateCustomerCode = () => `CUST-${Date.now().toString(36).toUpperCase()}`;

export class CustomerService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Customer.scan();

    if (query.status) {
      scanReq = scanReq.where('status').eq(query.status);
    }

    const all = await scanReq.exec();

    let filtered = [...all];
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.companyName?.toLowerCase().includes(s) ||
        c.customerCode?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.contactPerson?.toLowerCase().includes(s)
      );
    }

    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const customers = filtered.slice(skip, skip + limit);
    return { customers, total: filtered.length };
  }

  async findById(id: string) {
    const customer = await Customer.get(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async create(data: Partial<CustomerDocument>, userId: string) {
    const customerCode = generateCustomerCode();
    return await Customer.create({
      ...data,
      _id: uuidv4(),
      customerCode,
      createdBy: userId,
    });
  }

  async update(id: string, data: Partial<CustomerDocument>) {
    const customer = await Customer.get(id);
    if (!customer) throw new Error('Customer not found');
    return await Customer.update({ _id: id }, data);
  }

  async delete(id: string) {
    const customer = await Customer.get(id);
    if (!customer) throw new Error('Customer not found');
    await Customer.delete(id);
  }

  async getStats() {
    const all = await Customer.scan().exec();
    const active = all.filter((c: any) => c.status === 'active').length;
    return {
      total: all.length,
      active,
      inactive: all.length - active,
    };
  }
}

export default new CustomerService();
