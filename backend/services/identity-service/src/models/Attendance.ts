import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface AttendanceDocument extends Item {
  _id: string;
  employeeId: string;
  employeeName: string;
  date: string;              // YYYY-MM-DD
  checkInTime?: Date;
  checkOutTime?: Date;
  checkInPhotoUrl?: string;  // S3 URL of selfie
  checkInPhotoKey?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInAddress?: string;
  status: 'present' | 'absent' | 'half_day' | 'wfh' | 'leave' | 'holiday';
  workingHours?: number;
  notes?: string;
  markedBy?: string;         // self or manager/admin
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    employeeId: {
      type: String,
      required: true,
      index: { name: 'attendanceEmployeeIndex', type: 'global' },
    },
    employeeName: { type: String, required: true },
    date: {
      type: String,
      required: true,
      index: { name: 'attendanceDateIndex', type: 'global' },
    },
    checkInTime:   { type: Date },
    checkOutTime:  { type: Date },
    checkInPhotoUrl:  { type: String },
    checkInPhotoKey:  { type: String },
    checkInLatitude:  { type: Number },
    checkInLongitude: { type: Number },
    checkInAddress:   { type: String },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'wfh', 'leave', 'holiday'],
      default: 'present',
    },
    workingHours: { type: Number },
    notes:        { type: String },
    markedBy:     { type: String },
  },
  { timestamps: true }
);

export const Attendance = dynamoose.model<AttendanceDocument>('HR_Attendance', attendanceSchema, {
  create: true,
});
