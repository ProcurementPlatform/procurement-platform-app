// One-off demo data seeder. Writes directly via DynamoDB PutItem (not through
// the services) so it has no dependency on the services being reachable.
// Safe to re-run — every item uses a fixed, deterministic _id (uuid v5 from a
// readable name) so re-running overwrites the same items instead of
// duplicating them.
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import bcrypt from "bcryptjs";
import { v5 as uuidv5 } from "uuid";

const REGION = "us-east-1";
const ENV = "prod";
const client = new DynamoDBClient({ region: REGION });

// Fixed namespace so id("x") is stable across re-runs.
const NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const id = (name) => uuidv5(name, NS);
// dynamoose stores Date-typed attributes as DynamoDB Number (epoch ms), not
// ISO strings — confirmed via a real read-time validation error when this
// was first seeded as strings ("Expected updatedAt to be of type date").
const now = Date.now();
const daysFromNow = (d) => Date.now() + d * 86400000;

// Table names are "prod-<Service>_<Model>".
const T = (service, model) => `${ENV}-${service}_${model}`;
async function putItem(tableName, item) {
  await client.send(new PutItemCommand({ TableName: tableName, Item: marshall(item, { removeUndefinedValues: true }) }));
}

async function main() {
  console.log("Seeding demo data into", REGION, ENV);

  // ---------------- Identity_User ----------------
  const pw = async (p) => bcrypt.hash(p, await bcrypt.genSalt(12));
  const users = {
    admin: { _id: id("user:admin"), email: "admin@procurement.com", password: await pw("admin123"), firstName: "Alex", lastName: "Admin", role: "admin", department: "Operations" },
    manager: { _id: id("user:manager"), email: "manager@procurement.com", password: await pw("manager123"), firstName: "Morgan", lastName: "Manager", role: "procurement_manager", department: "Procurement" },
    finance: { _id: id("user:finance"), email: "finance@procurement.com", password: await pw("finance123"), firstName: "Fiona", lastName: "Finance", role: "finance", department: "Finance" },
    auditor: { _id: id("user:auditor"), email: "auditor@procurement.com", password: await pw("auditor123"), firstName: "Avery", lastName: "Auditor", role: "auditor", department: "Compliance" },
  };
  for (const u of Object.values(users)) {
    await putItem(T("Identity", "User"), { ...u, isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now });
  }
  console.log("Users seeded:", Object.keys(users).join(", "));

  // ---------------- Procurement_Vendor ----------------
  const vendorDefs = [
    { key: "v1", name: "Acme Industrial Supplies", code: "VEN-1001", rating: 4.6, status: "active" },
    { key: "v2", name: "Northwind Office Solutions", code: "VEN-1002", rating: 4.2, status: "active" },
    { key: "v3", name: "Global Tech Components", code: "VEN-1003", rating: 3.8, status: "active" },
    { key: "v4", name: "Sterling Logistics Co", code: "VEN-1004", rating: 4.0, status: "active" },
    { key: "v5", name: "Pioneer Raw Materials", code: "VEN-1005", rating: 2.9, status: "pending" },
    { key: "v6", name: "Vertex Packaging Ltd", code: "VEN-1006", rating: 4.4, status: "active" },
    { key: "v7", name: "Redline Equipment Rentals", code: "VEN-1007", rating: 1.8, status: "blacklisted" },
    { key: "v8", name: "Summit Facilities Services", code: "VEN-1008", rating: 4.1, status: "active" },
  ];
  const vendors = {};
  for (const v of vendorDefs) {
    vendors[v.key] = id(`vendor:${v.key}`);
    await putItem(T("Procurement", "Vendor"), {
      _id: vendors[v.key],
      vendorName: v.name,
      vendorCode: v.code,
      contactPerson: v.name.split(" ")[0] + " Contact",
      email: v.code.toLowerCase() + "@example.com",
      phone: "+1-555-01" + v.key.slice(1).padStart(2, "0"),
      address: { street: "100 Market St", city: "Austin", state: "TX", country: "USA", zipCode: "73301" },
      taxId: "TAX-" + v.code,
      bankAccount: "ACCT-" + v.code,
      status: v.status,
      rating: v.rating,
      notes: "Seeded demo vendor.",
      activities: [{ action: "created", description: "Vendor onboarded", performedBy: users.admin._id, timestamp: now }],
      createdBy: users.admin._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Vendors seeded:", vendorDefs.length);

  // ---------------- Procurement_Contract ----------------
  const contractDefs = [
    { key: "c1", vendorKey: "v1", name: "Annual Industrial Supply Agreement", value: 480000, status: "active", expiryDays: 280 },
    { key: "c2", vendorKey: "v2", name: "Office Equipment Master Agreement", value: 95000, status: "active", expiryDays: 12 }, // near-expiry, for risk dashboards
    { key: "c3", vendorKey: "v3", name: "Component Supply Contract", value: 610000, status: "pending_renewal", expiryDays: 5 },
    { key: "c4", vendorKey: "v4", name: "Logistics Services Contract", value: 220000, status: "active", expiryDays: 150 },
    { key: "c5", vendorKey: "v7", name: "Equipment Rental Agreement", value: 60000, status: "terminated", expiryDays: -30 },
    { key: "c6", vendorKey: "v6", name: "Packaging Supply Contract", value: 130000, status: "expired", expiryDays: -10 },
  ];
  const contracts = {};
  for (const c of contractDefs) {
    contracts[c.key] = id(`contract:${c.key}`);
    await putItem(T("Procurement", "Contract"), {
      _id: contracts[c.key],
      contractName: c.name,
      vendor: vendors[c.vendorKey],
      contractNumber: "CTR-" + c.key.toUpperCase(),
      effectiveDate: daysFromNow(-365),
      expiryDate: daysFromNow(c.expiryDays),
      contractValue: c.value,
      status: c.status,
      description: `${c.name} — seeded demo contract.`,
      versions: [{ version: 1, documentUrl: "", uploadedAt: now, uploadedBy: users.admin._id }],
      createdBy: users.manager._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Contracts seeded:", contractDefs.length);

  // ---------------- Procurement_PurchaseRequest ----------------
  const prDefs = [
    { key: "pr1", title: "Replenish industrial fasteners", vendorKey: "v1", cost: 18500, status: "approved", priority: "medium" },
    { key: "pr2", title: "New office furniture batch", vendorKey: "v2", cost: 9200, status: "approved", priority: "low" },
    { key: "pr3", title: "Urgent server components", vendorKey: "v3", cost: 42000, status: "pending", priority: "urgent" },
    { key: "pr4", title: "Quarterly logistics top-up", vendorKey: "v4", cost: 15800, status: "approved", priority: "medium" },
    { key: "pr5", title: "Facility maintenance supplies", vendorKey: "v8", cost: 6700, status: "rejected", priority: "low" },
    { key: "pr6", title: "Packaging materials restock", vendorKey: "v6", cost: 21300, status: "draft", priority: "high" },
  ];
  const purchaseRequests = {};
  for (const p of prDefs) {
    purchaseRequests[p.key] = id(`pr:${p.key}`);
    await putItem(T("Procurement", "PurchaseRequest"), {
      _id: purchaseRequests[p.key],
      title: p.title,
      department: "Procurement",
      priority: p.priority,
      description: `${p.title} — seeded demo purchase request.`,
      estimatedCost: p.cost,
      vendor: vendors[p.vendorKey],
      status: p.status,
      requestedBy: users.manager._id,
      approvedBy: p.status === "approved" ? users.admin._id : undefined,
      rejectionReason: p.status === "rejected" ? "Budget constraints this quarter." : undefined,
      items: [{ name: p.title, description: p.title, quantity: 10, unitPrice: p.cost / 10 }],
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Purchase requests seeded:", prDefs.length);

  // ---------------- Procurement_PurchaseOrder ----------------
  const poDefs = [
    { key: "po1", prKey: "pr1", vendorKey: "v1", total: 18500, status: "completed" },
    { key: "po2", prKey: "pr2", vendorKey: "v2", total: 9200, status: "shipped" },
    { key: "po3", prKey: "pr4", vendorKey: "v4", total: 15800, status: "issued" },
    { key: "po4", prKey: null, vendorKey: "v3", total: 27500, status: "acknowledged" },
    { key: "po5", prKey: null, vendorKey: "v6", total: 13400, status: "draft" },
    { key: "po6", prKey: null, vendorKey: "v8", total: 5100, status: "cancelled" },
  ];
  const purchaseOrders = {};
  for (const p of poDefs) {
    purchaseOrders[p.key] = id(`po:${p.key}`);
    await putItem(T("Procurement", "PurchaseOrder"), {
      _id: purchaseOrders[p.key],
      poNumber: "PO-" + p.key.toUpperCase(),
      vendor: vendors[p.vendorKey],
      purchaseRequest: p.prKey ? purchaseRequests[p.prKey] : undefined,
      items: [{ name: "Line item", description: "Seeded order line", quantity: 5, unitPrice: p.total / 5, totalPrice: p.total }],
      subtotal: p.total,
      tax: Math.round(p.total * 0.08),
      totalAmount: Math.round(p.total * 1.08),
      status: p.status,
      orderDate: daysFromNow(-20),
      expectedDeliveryDate: daysFromNow(10),
      notes: "Seeded demo purchase order.",
      createdBy: users.manager._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Purchase orders seeded:", poDefs.length);

  // ---------------- Finance_Customer ----------------
  const customerDefs = [
    { key: "cu1", name: "BrightPath Retail Group", code: "CUST-2001" },
    { key: "cu2", name: "Meridian Healthcare Systems", code: "CUST-2002" },
    { key: "cu3", name: "Caldwell Manufacturing", code: "CUST-2003" },
    { key: "cu4", name: "Union Square Hospitality", code: "CUST-2004" },
  ];
  const customers = {};
  for (const c of customerDefs) {
    customers[c.key] = id(`customer:${c.key}`);
    await putItem(T("Finance", "Customer"), {
      _id: customers[c.key],
      customerCode: c.code,
      companyName: c.name,
      contactPerson: c.name.split(" ")[0] + " Contact",
      email: c.code.toLowerCase() + "@example.com",
      phone: "+1-555-02" + c.key.slice(2).padStart(2, "0"),
      gstin: "29ABCDE1234F1Z5",
      address: { street: "200 Commerce Ave", city: "Dallas", state: "TX", country: "India", zipCode: "75201" },
      paymentTerms: "Net 30",
      creditLimit: 500000,
      status: "active",
      industry: "Retail",
      createdBy: users.finance._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Customers seeded:", customerDefs.length);

  // ---------------- Finance_Invoice ----------------
  const invoiceDefs = [
    { key: "inv1", type: "VENDOR_INVOICE", vendorKey: "v1", poKey: "po1", contractKey: "c1", amount: 18500, status: "paid" },
    { key: "inv2", type: "VENDOR_INVOICE", vendorKey: "v2", poKey: "po2", contractKey: "c2", amount: 9200, status: "approved" },
    { key: "inv3", type: "VENDOR_INVOICE", vendorKey: "v3", poKey: "po4", contractKey: "c3", amount: 27500, status: "pending" },
    { key: "inv4", type: "VENDOR_INVOICE", vendorKey: "v4", poKey: "po3", contractKey: "c4", amount: 15800, status: "overdue" },
    { key: "inv5", type: "VENDOR_INVOICE", vendorKey: "v7", poKey: null, contractKey: "c5", amount: 60000, status: "disputed" },
    { key: "inv6", type: "CUSTOMER_INVOICE", customerKey: "cu1", amount: 84000, status: "paid" },
    { key: "inv7", type: "CUSTOMER_INVOICE", customerKey: "cu2", amount: 132000, status: "approved" },
    { key: "inv8", type: "CUSTOMER_INVOICE", customerKey: "cu3", amount: 47500, status: "overdue" },
    { key: "inv9", type: "CUSTOMER_INVOICE", customerKey: "cu4", amount: 21000, status: "pending" },
    { key: "inv10", type: "VENDOR_INVOICE", vendorKey: "v6", poKey: "po5", contractKey: "c6", amount: 13400, status: "cancelled" },
  ];
  const invoices = {};
  for (const inv of invoiceDefs) {
    invoices[inv.key] = id(`invoice:${inv.key}`);
    const isVendor = inv.type === "VENDOR_INVOICE";
    const gst = Math.round(inv.amount * 0.18);
    await putItem(T("Finance", "Invoice"), {
      _id: invoices[inv.key],
      invoiceNumber: "INV-" + inv.key.toUpperCase(),
      invoiceType: inv.type,
      vendorId: isVendor ? vendors[inv.vendorKey] : undefined,
      customerId: !isVendor ? customers[inv.customerKey] : undefined,
      partyName: isVendor ? vendorDefs.find((v) => v.key === inv.vendorKey).name : customerDefs.find((c) => c.key === inv.customerKey).name,
      partyGstin: "29ABCDE1234F1Z5",
      purchaseOrderId: inv.poKey ? purchaseOrders[inv.poKey] : undefined,
      contractId: inv.contractKey ? contracts[inv.contractKey] : undefined,
      poNumber: inv.poKey ? "PO-" + inv.poKey.toUpperCase() : undefined,
      issueDate: daysFromNow(-25),
      dueDate: daysFromNow(inv.status === "overdue" ? -5 : 20),
      lineItems: [
        {
          description: "Seeded line item",
          quantity: 1,
          unit: "unit",
          rate: inv.amount,
          taxableAmount: inv.amount,
          gstPercentage: 18,
          cgstAmount: gst / 2,
          sgstAmount: gst / 2,
          totalAmount: inv.amount + gst,
        },
      ],
      subTotal: inv.amount,
      totalCgst: gst / 2,
      totalSgst: gst / 2,
      totalIgst: 0,
      totalGst: gst,
      tdsPercentage: 0,
      tdsAmount: 0,
      grossAmount: inv.amount + gst,
      companyReceivable: !isVendor ? inv.amount + gst : 0,
      vendorPayable: isVendor ? inv.amount + gst : 0,
      totalAmount: inv.amount + gst,
      amount: inv.amount,
      tax: gst,
      status: inv.status,
      approvedBy: ["approved", "paid"].includes(inv.status) ? users.finance._id : undefined,
      approvedAt: ["approved", "paid"].includes(inv.status) ? now : undefined,
      paymentDate: inv.status === "paid" ? daysFromNow(-2) : undefined,
      paymentMethod: inv.status === "paid" ? "wire_transfer" : undefined,
      description: "Seeded demo invoice.",
      createdBy: users.finance._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Invoices seeded:", invoiceDefs.length);

  // ---------------- Finance_Payment ----------------
  const paymentDefs = [
    { key: "pay1", invKey: "inv1", vendorKey: "v1", amount: 18500 * 1.18, method: "wire_transfer", status: "completed" },
    { key: "pay2", invKey: "inv6", vendorKey: "v1", amount: 84000 * 1.18, method: "ach", status: "completed" },
    { key: "pay3", invKey: "inv2", vendorKey: "v2", amount: 9200 * 1.18, method: "check", status: "pending" },
    { key: "pay4", invKey: "inv4", vendorKey: "v4", amount: 15800 * 1.18, method: "wire_transfer", status: "failed" },
    { key: "pay5", invKey: "inv3", vendorKey: "v3", amount: 27500 * 1.18, method: "credit_card", status: "completed" },
    { key: "pay6", invKey: "inv5", vendorKey: "v7", amount: 60000 * 1.18, method: "wire_transfer", status: "reversed" },
  ];
  const payments = {};
  for (const p of paymentDefs) {
    payments[p.key] = id(`payment:${p.key}`);
    await putItem(T("Finance", "Payment"), {
      _id: payments[p.key],
      paymentReference: "PAY-" + p.key.toUpperCase(),
      invoice: invoices[p.invKey],
      vendor: vendors[p.vendorKey],
      amount: Math.round(p.amount),
      paymentMethod: p.method,
      paymentDate: daysFromNow(-3),
      status: p.status,
      notes: "Seeded demo payment.",
      processedBy: users.finance._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Payments seeded:", paymentDefs.length);

  // ---------------- Document_Document ----------------
  const docDefs = [
    { key: "doc1", category: "contract", relatedKey: contracts["c1"], name: "acme-contract-2026.pdf" },
    { key: "doc2", category: "contract", relatedKey: contracts["c3"], name: "global-tech-contract-2026.pdf" },
    { key: "doc3", category: "invoice", relatedKey: invoices["inv4"], name: "sterling-invoice-inv4.pdf" },
    { key: "doc4", category: "purchase_order", relatedKey: purchaseOrders["po4"], name: "po4-globaltech.pdf" },
    { key: "doc5", category: "vendor_certificate", relatedKey: vendors["v3"], name: "globaltech-iso-cert.pdf" },
  ];
  const documents = {};
  for (const d of docDefs) {
    documents[d.key] = id(`doc:${d.key}`);
    await putItem(T("Document", "Document"), {
      _id: documents[d.key],
      fileName: d.name,
      originalName: d.name,
      mimeType: "application/pdf",
      size: 245760,
      s3Key: `seed-demo/${d.name}`,
      s3Bucket: "procurement-documents-prod-08",
      category: d.category,
      relatedId: d.relatedKey,
      uploadedBy: users.admin._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Documents seeded:", docDefs.length);

  // ---------------- Document_AuditLog ----------------
  const auditDefs = [
    { action: "LOGIN", entity: "User", entityId: users.admin._id },
    { action: "CREATE", entity: "Vendor", entityId: vendors["v1"] },
    { action: "UPDATE", entity: "Contract", entityId: contracts["c2"] },
    { action: "APPROVE", entity: "PurchaseRequest", entityId: purchaseRequests["pr1"] },
    { action: "CREATE", entity: "Invoice", entityId: invoices["inv3"] },
  ];
  for (const a of auditDefs) {
    await putItem(T("Document", "AuditLog"), {
      _id: id(`audit:${a.entity}:${a.entityId}`),
      userId: users.admin._id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      details: { source: "seed-script" },
      ipAddress: "127.0.0.1",
      userAgent: "seed-script/1.0",
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Audit logs seeded:", auditDefs.length);

  // ---------------- Document_Notification ----------------
  const notifDefs = [
    { type: "contract_expiry", title: "Contract expiring soon", message: "Office Equipment Master Agreement expires in 12 days.", relatedId: contracts["c2"], relatedModel: "Contract", userId: users.manager._id },
    { type: "invoice_due", title: "Invoice overdue", message: "INV-INV4 is overdue.", relatedId: invoices["inv4"], relatedModel: "Invoice", userId: users.finance._id },
    { type: "vendor_approval", title: "Vendor pending approval", message: "Pioneer Raw Materials is pending approval.", relatedId: vendors["v5"], relatedModel: "Vendor", userId: users.admin._id },
    { type: "purchase_approval", title: "Purchase request needs approval", message: "Urgent server components request is pending.", relatedId: purchaseRequests["pr3"], relatedModel: "PurchaseRequest", userId: users.admin._id },
    { type: "system", title: "Welcome", message: "Demo environment seeded successfully.", relatedId: undefined, relatedModel: undefined, userId: users.admin._id },
  ];
  for (const n of notifDefs) {
    await putItem(T("Document", "Notification"), {
      _id: id(`notif:${n.title}`),
      title: n.title,
      message: n.message,
      type: n.type,
      userId: n.userId,
      isRead: false,
      relatedId: n.relatedId,
      relatedModel: n.relatedModel,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Notifications seeded:", notifDefs.length);

  // ---------------- AI_ContractAnalysis ----------------
  const caDefs = [
    { key: "ca1", docKey: "doc1", vendorName: "Acme Industrial Supplies", contractNo: "CTR-C1", value: 480000, riskLevel: "low", days: 280 },
    { key: "ca2", docKey: "doc2", vendorName: "Global Tech Components", contractNo: "CTR-C3", value: 610000, riskLevel: "high", days: 5 },
  ];
  for (const c of caDefs) {
    await putItem(T("AI", "ContractAnalysis"), {
      _id: id(`ca:${c.key}`),
      documentId: documents[c.docKey],
      vendorName: c.vendorName,
      contractNumber: c.contractNo,
      contractValue: c.value,
      effectiveDate: daysFromNow(-365),
      expiryDate: daysFromNow(c.days),
      keyTerms: [
        { label: "Payment Terms", value: "Net 30" },
        { label: "Renewal Notice", value: "60 days prior to expiry" },
      ],
      clauses: [
        { clauseType: "Termination", summary: "Either party may terminate with 30 days notice.", riskLevel: "low" },
        { clauseType: "Liability", summary: "Liability capped at contract value.", riskLevel: c.riskLevel },
      ],
      summary: `${c.vendorName} contract analyzed — overall risk ${c.riskLevel}.`,
      renewalRisk: { riskLevel: c.riskLevel, reasoning: c.riskLevel === "high" ? "Contract expires within days with no renewal initiated." : "Ample time remains before expiry.", daysToExpiry: c.days },
      analyzedBy: users.admin._id,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Contract analyses seeded:", caDefs.length);

  // ---------------- AI_InvoiceAnalysis ----------------
  const iaDefs = [
    { key: "ia1", invKey: "inv1", score: 8, level: "low", findings: [] },
    { key: "ia2", invKey: "inv3", score: 62, level: "medium", findings: [{ findingType: "missing_reference", severity: "medium", description: "Invoice lacks matching purchase order reference at submission time." }] },
    { key: "ia3", invKey: "inv4", score: 78, level: "high", findings: [{ findingType: "overbilling", severity: "high", description: "Billed amount exceeds PO value by 12%.", relatedEntityId: purchaseOrders["po3"] }] },
    { key: "ia4", invKey: "inv5", score: 94, level: "critical", findings: [{ findingType: "duplicate", severity: "high", description: "Potential duplicate of a previously paid invoice from a blacklisted vendor." }, { findingType: "contract_violation", severity: "high", description: "Vendor contract was terminated prior to invoice date." }] },
  ];
  for (const a of iaDefs) {
    await putItem(T("AI", "InvoiceAnalysis"), {
      _id: id(`ia:${a.key}`),
      invoiceId: invoices[a.invKey],
      riskScore: a.score,
      riskLevel: a.level,
      findings: a.findings,
      report: `Automated risk analysis completed — score ${a.score}/100 (${a.level}).`,
      recommendations: a.level === "low" ? ["No action required."] : ["Route to finance lead for manual review.", "Verify against original purchase order."],
      ruleEngineVersion: "v1",
      crossCheckedAgainst: { paymentIds: [] },
      analyzedBy: users.admin._id,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Invoice analyses seeded:", iaDefs.length);

  // ---------------- AI_Embedding ----------------
  for (const [i, docKey] of ["doc1", "doc2", "doc3"].entries()) {
    await putItem(T("AI", "Embedding"), {
      _id: id(`embed:${docKey}`),
      documentId: documents[docKey],
      category: docDefs.find((d) => d.key === docKey).category,
      relatedId: docDefs.find((d) => d.key === docKey).relatedKey,
      chunkIndex: 0,
      chunkText: "Seeded demo document text chunk for vector search.",
      embedding: Array.from({ length: 256 }, () => Math.random() * 2 - 1),
      tokenCount: 128,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Embeddings seeded: 3");

  // ---------------- AI_Feedback ----------------
  const fbDefs = [
    { feature: "contract", referenceId: id("ca:ca2"), rating: "up", comment: "Caught the renewal risk early, very useful." },
    { feature: "invoice", referenceId: id("ia:ia4"), rating: "up", comment: "Correctly flagged a blacklisted vendor invoice." },
    { feature: "chat", referenceId: undefined, rating: "down", comment: "Response was too generic." },
  ];
  for (const f of fbDefs) {
    await putItem(T("AI", "Feedback"), {
      _id: id(`feedback:${f.comment}`),
      feature: f.feature,
      referenceId: f.referenceId,
      userId: users.manager._id,
      rating: f.rating,
      comment: f.comment,
      context: {},
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log("Feedback seeded:", fbDefs.length);

  console.log("\nDone. Demo logins:");
  console.log("  admin@procurement.com / admin123");
  console.log("  manager@procurement.com / manager123");
  console.log("  finance@procurement.com / finance123");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
