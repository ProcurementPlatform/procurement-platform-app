import { Attendance, AttendanceDocument } from '../models/Attendance';
import { Employee } from '../models/Employee';
import { uploadToS3 } from '@procurement/common';
import { v4 as uuidv4 } from 'uuid';

export class AttendanceService {
  async checkIn(employeeId: string, data: {
    photoBase64?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    notes?: string;
  }) {
    const employee = await Employee.get(employeeId);
    if (!employee) throw new Error('Employee not found');

    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const existing = await Attendance.scan('employeeId').eq(employeeId)
      .and().where('date').eq(today).exec();
    if (existing.length > 0 && existing[0].checkInTime) {
      throw new Error('Already checked in today');
    }

    let photoUrl: string | undefined;
    let photoKey: string | undefined;

    if (data.photoBase64) {
      try {
        const buffer = Buffer.from(data.photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const key = `attendance/${employeeId}/${today}-checkin.jpg`;
        photoKey = await uploadToS3(buffer, key, 'image/jpeg');
        photoUrl = photoKey;
      } catch (_) {
        // S3 not available locally — proceed without photo storage
        photoUrl = data.photoBase64.substring(0, 100) + '...';
      }
    }

    if (existing.length > 0) {
      return await Attendance.update({ _id: existing[0]._id }, {
        checkInTime: new Date(),
        checkInPhotoUrl: photoUrl,
        checkInPhotoKey: photoKey,
        checkInLatitude: data.latitude,
        checkInLongitude: data.longitude,
        checkInAddress: data.address,
        status: 'present',
      });
    }

    return await Attendance.create({
      _id: uuidv4(),
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      date: today,
      checkInTime: new Date(),
      checkInPhotoUrl: photoUrl,
      checkInPhotoKey: photoKey,
      checkInLatitude: data.latitude,
      checkInLongitude: data.longitude,
      checkInAddress: data.address,
      status: 'present',
      notes: data.notes,
      markedBy: 'self',
    });
  }

  async checkOut(employeeId: string) {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.scan('employeeId').eq(employeeId)
      .and().where('date').eq(today).exec();
    if (!records.length) throw new Error('No check-in record found for today');
    const record = records[0];

    const checkIn = new Date(record.checkInTime!);
    const checkOut = new Date();
    const hours = (checkOut.getTime() - checkIn.getTime()) / 3600000;

    return await Attendance.update({ _id: record._id }, {
      checkOutTime: checkOut,
      workingHours: Math.round(hours * 100) / 100,
      status: hours < 4 ? 'half_day' : 'present',
    });
  }

  async getMyAttendance(employeeId: string, month?: number, year?: number) {
    const all = await Attendance.scan('employeeId').eq(employeeId).exec();
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return all.filter((r: any) => r.date?.startsWith(prefix));
    }
    return all.sort((a: any, b: any) => b.date.localeCompare(a.date));
  }

  async getAll(query: Record<string, any> = {}, skip = 0, limit = 50) {
    let scanReq = Attendance.scan();
    if (query.employeeId) scanReq = scanReq.where('employeeId').eq(query.employeeId);

    const all = await scanReq.exec();
    const filtered = all.sort((a: any, b: any) => b.date.localeCompare(a.date));
    return { records: filtered.slice(skip, skip + limit), total: filtered.length };
  }

  async getSummary(employeeId: string, month: number, year: number) {
    const records = await this.getMyAttendance(employeeId, month, year);
    const present = records.filter((r: any) => r.status === 'present').length;
    const absent = records.filter((r: any) => r.status === 'absent').length;
    const halfDay = records.filter((r: any) => r.status === 'half_day').length;
    const wfh = records.filter((r: any) => r.status === 'wfh').length;
    const leave = records.filter((r: any) => r.status === 'leave').length;
    const totalHours = records.reduce((s: number, r: any) => s + (r.workingHours || 0), 0);

    return { present, absent, halfDay, wfh, leave, totalHours: Math.round(totalHours * 100) / 100, total: records.length };
  }
}

export default new AttendanceService();
