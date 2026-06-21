import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export interface PayslipDocument extends Item {
  _id: string;
  payslipNumber: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  month: number;              // 1-12
  year: number;
  payPeriod: string;          // "June 2025"
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays: number;            // Loss of Pay

  // Earnings
  basicSalary: number;
  hra: number;
  transportAllowance: number;
  otherAllowances: number;
  arrears: number;
  grossEarnings: number;

  // Deductions
  pfEmployee: number;         // 12% of basic
  pfEmployer: number;         // 12% of basic (for reference)
  esicEmployee: number;       // 0.75% of gross
  esicEmployer: number;       // 3.25% of gross
  tds: number;
  lop: number;                // Loss of Pay deduction
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netSalary: number;
  amountInWords: string;

  // Bank
  bankName?: string;
  accountNumber?: string;

  // Status
  status: 'draft' | 'generated' | 'paid';
  paidDate?: Date;
  pdfUrl?: string;
  pdfKey?: string;

  generatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const payslipSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    payslipNumber: {
      type: String,
      required: true,
      index: { name: 'payslipNumberIndex', type: 'global' },
    },
    employeeId: {
      type: String,
      required: true,
      index: { name: 'payslipEmployeeIndex', type: 'global' },
    },
    employeeName:  { type: String, required: true },
    designation:   { type: String, default: '' },
    department:    { type: String, default: '' },
    month:         { type: Number, required: true },
    year:          { type: Number, required: true },
    payPeriod:     { type: String, required: true },
    workingDays:   { type: Number, default: 26 },
    presentDays:   { type: Number, default: 0 },
    leaveDays:     { type: Number, default: 0 },
    lopDays:       { type: Number, default: 0 },
    basicSalary:         { type: Number, default: 0 },
    hra:                 { type: Number, default: 0 },
    transportAllowance:  { type: Number, default: 0 },
    otherAllowances:     { type: Number, default: 0 },
    arrears:             { type: Number, default: 0 },
    grossEarnings:       { type: Number, default: 0 },
    pfEmployee:          { type: Number, default: 0 },
    pfEmployer:          { type: Number, default: 0 },
    esicEmployee:        { type: Number, default: 0 },
    esicEmployer:        { type: Number, default: 0 },
    tds:                 { type: Number, default: 0 },
    lop:                 { type: Number, default: 0 },
    otherDeductions:     { type: Number, default: 0 },
    totalDeductions:     { type: Number, default: 0 },
    netSalary:           { type: Number, default: 0 },
    amountInWords:       { type: String, default: '' },
    bankName:      { type: String },
    accountNumber: { type: String },
    status: {
      type: String,
      enum: ['draft', 'generated', 'paid'],
      default: 'generated',
      index: { name: 'payslipStatusIndex', type: 'global' },
    },
    paidDate: { type: Date },
    pdfUrl:   { type: String },
    pdfKey:   { type: String },
    generatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Payslip = dynamoose.model<PayslipDocument>('HR_Payslip', payslipSchema, {
  create: true,
});
