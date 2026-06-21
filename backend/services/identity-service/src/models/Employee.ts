import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface EmployeeDocument extends Item {
  _id: string;
  employeeId: string;           // EMP-0001
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  joiningDate: Date;
  leavingDate?: Date;
  status: 'active' | 'inactive' | 'resigned' | 'terminated';

  // Salary
  basicSalary: number;
  hra: number;
  transportAllowance: number;
  otherAllowances: number;
  grossSalary: number;

  // Tax IDs
  pan?: string;
  aadhar?: string;
  uan?: string;        // PF UAN number
  esicNumber?: string;

  // Bank
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolder?: string;

  // Reporting
  reportingManagerId?: string;
  reportingManagerName?: string;

  // Personal
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  emergencyContact?: string;

  // Documents
  profilePhotoUrl?: string;
  offerLetterUrl?: string;
  idProofUrl?: string;

  // Meta
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    employeeId: {
      type: String,
      required: true,
      index: { name: 'employeeIdIndex', type: 'global' },
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      index: { name: 'employeeEmailIndex', type: 'global' },
    },
    phone: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    joiningDate: { type: Date, required: true },
    leavingDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'inactive', 'resigned', 'terminated'],
      default: 'active',
      index: { name: 'employeeStatusIndex', type: 'global' },
    },
    basicSalary:         { type: Number, default: 0 },
    hra:                 { type: Number, default: 0 },
    transportAllowance:  { type: Number, default: 0 },
    otherAllowances:     { type: Number, default: 0 },
    grossSalary:         { type: Number, default: 0 },
    pan:          { type: String },
    aadhar:       { type: String },
    uan:          { type: String },
    esicNumber:   { type: String },
    bankName:      { type: String },
    accountNumber: { type: String },
    ifscCode:      { type: String },
    accountHolder: { type: String },
    reportingManagerId:   { type: String },
    reportingManagerName: { type: String },
    dateOfBirth:  { type: Date },
    gender:       { type: String, enum: ['male', 'female', 'other'] },
    address:      { type: String },
    emergencyContact: { type: String },
    profilePhotoUrl:  { type: String },
    offerLetterUrl:   { type: String },
    idProofUrl:       { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Employee = dynamoose.model<EmployeeDocument>('HR_Employee', employeeSchema, {
  create: true,
});
