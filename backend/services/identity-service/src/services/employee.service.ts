import { Employee, EmployeeDocument } from '../models/Employee';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@procurement/common';
import { v4 as uuidv4 } from 'uuid';

const generateEmployeeId = async (): Promise<string> => {
  const all = await Employee.scan().exec();
  const num = String(all.length + 1).padStart(4, '0');
  return `EMP-${num}`;
};

export class EmployeeService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Employee.scan();
    if (query.status) scanReq = scanReq.where('status').eq(query.status);
    if (query.department) scanReq = scanReq.where('department').eq(query.department);

    const all = await scanReq.exec();
    let filtered = [...all];

    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter((e: any) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(s) ||
        e.email?.toLowerCase().includes(s) ||
        e.employeeId?.toLowerCase().includes(s) ||
        e.designation?.toLowerCase().includes(s)
      );
    }

    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { employees: filtered.slice(skip, skip + limit), total: filtered.length };
  }

  async findById(id: string) {
    const emp = await Employee.get(id);
    if (!emp) throw new Error('Employee not found');
    return emp;
  }

  async create(data: Partial<EmployeeDocument>, userId: string) {
    if (!data.email) throw new Error('Email is required');
    const existingUsers = await User.query('email').eq(data.email.toLowerCase()).exec();
    if (existingUsers && existingUsers.length > 0) {
      throw new Error('A user with this email address already exists');
    }

    const employeeId = await generateEmployeeId();
    const gross = (data.basicSalary || 0) + (data.hra || 0) + (data.transportAllowance || 0) + (data.otherAllowances || 0);
    const employeeUuid = uuidv4();

    // 1. Generate temporary credentials
    const tempPassword = `Temp@${Math.floor(100000 + Math.random() * 900000)}`;
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // 2. Create User account with same _id
    await User.create({
      _id: employeeUuid,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName || '',
      role: 'employee',
      department: data.department || 'General',
      isActive: true,
      mustChangePassword: true,
    } as any);

    // 3. Create Employee profile
    const employee = await Employee.create({
      ...data,
      _id: employeeUuid,
      employeeId,
      grossSalary: gross,
      createdBy: userId,
    });

    // 4. Send SES Email
    const emailSubject = 'Welcome to ProcureFlow - Your Temporary Credentials';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eeeeee; border-radius: 8px;">
        <h2 style="color: #6366f1; text-align: center;">Welcome to ProcureFlow!</h2>
        <p>Hello ${data.firstName},</p>
        <p>Your employee profile has been successfully created. Here are your temporary login credentials to access the portal:</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Portal URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost'}" style="color: #6366f1;">ProcureFlow Portal</a></p>
          <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${data.email.toLowerCase()}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #eeeeee; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
        </div>
        <p style="color: #ef4444; font-weight: bold;">Important: You will be required to change your password immediately upon your first login.</p>
        <p>Best regards,<br/>HR Operations Team</p>
      </div>
    `;
    try {
      await sendEmail(data.email.toLowerCase(), emailSubject, emailHtml);
    } catch (err) {
      console.error('Error sending credentials email:', err);
    }

    return employee;
  }

  async update(id: string, data: Partial<EmployeeDocument>) {
    const emp = await Employee.get(id);
    if (!emp) throw new Error('Employee not found');
    if (data.basicSalary !== undefined || data.hra !== undefined) {
      data.grossSalary = (data.basicSalary ?? emp.basicSalary) + (data.hra ?? emp.hra) + (data.transportAllowance ?? emp.transportAllowance) + (data.otherAllowances ?? emp.otherAllowances);
    }
    const updated = await Employee.update({ _id: id }, data);

    // Keep user's name updated in sync
    if (data.firstName || data.lastName || data.department) {
      try {
        const userUpdate: Record<string, any> = {};
        if (data.firstName) userUpdate.firstName = data.firstName;
        if (data.lastName) userUpdate.lastName = data.lastName;
        if (data.department) userUpdate.department = data.department;
        await User.update({ _id: id }, userUpdate);
      } catch (e) {
        console.error('Failed to sync user details:', e);
      }
    }
    return updated;
  }

  async delete(id: string) {
    const emp = await Employee.get(id);
    if (!emp) throw new Error('Employee not found');
    await Employee.delete(id);
    try {
      await User.delete(id);
    } catch (e) {
      console.error('Associated user delete failed or user does not exist:', e);
    }
  }

  async getStats() {
    const all = await Employee.scan().exec();
    const byDept: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalPayroll = 0;

    all.forEach((e: any) => {
      if (e.status === 'active') {
        byDept[e.department || 'Unknown'] = (byDept[e.department || 'Unknown'] || 0) + 1;
        byType[e.employmentType || 'full_time'] = (byType[e.employmentType || 'full_time'] || 0) + 1;
        totalPayroll += e.grossSalary || 0;
      }
    });

    return {
      total: all.length,
      active: all.filter((e: any) => e.status === 'active').length,
      inactive: all.filter((e: any) => e.status !== 'active').length,
      byDepartment: Object.entries(byDept).map(([dept, count]) => ({ dept, count })),
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      totalPayroll: Math.round(totalPayroll * 100) / 100,
    };
  }
}

export default new EmployeeService();
