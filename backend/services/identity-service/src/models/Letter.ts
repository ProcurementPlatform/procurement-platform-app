import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';
import { v4 as uuidv4 } from 'uuid';

export type LetterType = 'offer' | 'experience' | 'relieving' | 'internship_certificate';

export interface LetterDocument extends Item {
  _id: string;
  letterNumber: string;
  letterType: LetterType;
  employeeId?: string;
  employeeName: string;
  designation: string;
  department?: string;

  // For offer letter
  ctcAnnual?: number;
  joiningDate?: Date;

  // For experience / relieving
  joiningDateActual?: Date;
  lastWorkingDate?: Date;

  // For internship
  internProject?: string;
  internDurationMonths?: number;
  internFromDate?: Date;
  internToDate?: Date;
  internPerformance?: string;
  mentorName?: string;

  issuedDate: Date;
  issuedBy: string;
  status: 'draft' | 'issued';
  pdfUrl?: string;
  pdfKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const letterSchema = new dynamoose.Schema(
  {
    _id: { type: String, hashKey: true, default: () => uuidv4() },
    letterNumber: {
      type: String,
      required: true,
      index: { name: 'letterNumberIndex', type: 'global' },
    },
    letterType: {
      type: String,
      enum: ['offer', 'experience', 'relieving', 'internship_certificate'],
      required: true,
      index: { name: 'letterTypeIndex', type: 'global' },
    },
    employeeId:   { type: String, index: { name: 'letterEmployeeIndex', type: 'global' } },
    employeeName: { type: String, required: true },
    designation:  { type: String, required: true },
    department:   { type: String },
    ctcAnnual:    { type: Number },
    joiningDate:  { type: Date },
    joiningDateActual: { type: Date },
    lastWorkingDate:   { type: Date },
    internProject:        { type: String },
    internDurationMonths: { type: Number },
    internFromDate:       { type: Date },
    internToDate:         { type: Date },
    internPerformance:    { type: String },
    mentorName:           { type: String },
    issuedDate:  { type: Date, required: true, default: () => new Date() },
    issuedBy:    { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'issued'],
      default: 'issued',
      index: { name: 'letterStatusIndex', type: 'global' },
    },
    pdfUrl:  { type: String },
    pdfKey:  { type: String },
    notes:   { type: String },
  },
  { timestamps: true }
);

export const Letter = dynamoose.model<LetterDocument>('HR_Letter', letterSchema, {
  create: true,
});
