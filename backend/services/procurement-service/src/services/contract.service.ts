import { Contract, ContractDocument } from '../models/Contract';
import { generateContractNumber } from '@procurement/utils';
import { v4 as uuidv4 } from 'uuid';

export class ContractService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Contract.scan();

    if (query.status) {
      scanReq = scanReq.where('status').eq(query.status);
    }
    if (query.vendor) {
      scanReq = scanReq.where('vendor').eq(query.vendor);
    }

    const allContracts = await scanReq.exec();

    // In-memory filter for text search
    let filtered = [...allContracts];
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((c: any) => 
        (c.contractName && c.contractName.toLowerCase().includes(search)) ||
        (c.contractNumber && c.contractNumber.toLowerCase().includes(search))
      );
    }

    // Manual sort and pagination
    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const contracts = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return { contracts, total };
  }

  async findById(id: string) {
    const contract = await Contract.get(id);

    if (!contract) throw new Error('Contract not found');
    return contract;
  }

  async create(data: Partial<ContractDocument>, userId: string) {
    const contractNumber = generateContractNumber();
    
    const contractData: any = {
      ...data,
      _id: uuidv4(),
      contractNumber,
      createdBy: userId,
    };

    if (data.documentUrl) {
      contractData.versions = [{
        version: 1,
        documentUrl: data.documentUrl,
        uploadedBy: userId,
        uploadedAt: new Date()
      }];
    }

    const contract = await Contract.create(contractData);
    return contract;
  }

  async update(id: string, data: Partial<ContractDocument>, userId: string) {
    const contract = await Contract.get(id);
    if (!contract) throw new Error('Contract not found');

    const newVersions = [...(contract.versions || [])];
    if (data.documentUrl && data.documentUrl !== contract.documentUrl) {
      const newVersion = newVersions.length + 1;
      newVersions.push({
        version: newVersion,
        documentUrl: data.documentUrl,
        uploadedBy: userId,
        uploadedAt: new Date(),
      });
    }

    const updated = await Contract.update({ _id: id }, { ...data, versions: newVersions });
    return updated;
  }

  async getExpiring(days = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const allContracts = await Contract.scan().where('status').eq('active').exec();
    
    const expiring = allContracts.filter((c: any) => {
      const expiry = new Date(c.expiryDate);
      return expiry <= targetDate && expiry >= new Date();
    });

    expiring.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    return expiring;
  }

  async getStats() {
    // In-memory aggregation for DynamoDB
    const allContracts = await Contract.scan().exec();
    
    const statusMap: Record<string, { count: number; totalValue: number }> = {};
    
    allContracts.forEach((c: any) => {
      const status = c.status || 'unknown';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, totalValue: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].totalValue += (c.contractValue || 0);
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

export default new ContractService();
