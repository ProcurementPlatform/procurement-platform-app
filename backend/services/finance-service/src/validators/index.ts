import Joi from 'joi';

const lineItemSchema = Joi.object({
  description: Joi.string().required(),
  hsnSacCode: Joi.string().allow('', null),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string().allow('', null).default('Nos'),
  rate: Joi.number().min(0).required(),
  discount: Joi.number().min(0).max(100).default(0),
  gstPercentage: Joi.number().min(0).default(18),
  taxableAmount: Joi.number().min(0).default(0),
  cgstAmount: Joi.number().min(0).default(0),
  sgstAmount: Joi.number().min(0).default(0),
  igstAmount: Joi.number().min(0).default(0),
  totalAmount: Joi.number().min(0).default(0),
});

export const invoiceSchema = Joi.object({
  // New rich invoice fields
  invoiceType: Joi.string().valid('CUSTOMER_INVOICE', 'VENDOR_INVOICE').default('VENDOR_INVOICE'),
  vendorId: Joi.string().allow('', null),
  customerId: Joi.string().allow('', null),
  partyName: Joi.string().required(),
  partyGstin: Joi.string().allow('', null),
  partyPan: Joi.string().allow('', null),
  partyAddress: Joi.string().allow('', null),

  // References
  purchaseOrderId: Joi.string().allow('', null),
  contractId: Joi.string().allow('', null),
  poNumber: Joi.string().allow('', null),

  // Dates
  issueDate: Joi.date().default(() => new Date()),
  dueDate: Joi.date().required(),

  // Place of supply (for CGST/SGST vs IGST)
  placeOfSupply: Joi.string().allow('', null),

  // Line items
  lineItems: Joi.array().items(lineItemSchema).min(1).required(),

  // TDS
  tdsPercentage: Joi.number().min(0).max(100).default(0),

  // Bank details (for PDF)
  bankName: Joi.string().allow('', null),
  accountNumber: Joi.string().allow('', null),
  ifscCode: Joi.string().allow('', null),
  accountHolder: Joi.string().allow('', null),
  upiId: Joi.string().allow('', null),

  // Notes
  description: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  termsAndConditions: Joi.string().allow('', null),

  // Legacy fields (backward compatibility)
  vendor: Joi.string().allow('', null),
  purchaseOrder: Joi.string().allow('', null),
  contract: Joi.string().allow('', null),
  amount: Joi.number().min(0),
  tax: Joi.number().min(0),
  documentUrl: Joi.string().allow('', null),
});

export const paymentSchema = Joi.object({
  invoiceId: Joi.string().required(),
  paymentMethod: Joi.string().valid('wire_transfer', 'check', 'ach', 'credit_card').required(),
  notes: Joi.string().allow(''),
});
