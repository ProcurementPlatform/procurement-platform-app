// Generates real PDFs with genuine text content, so AI contract analysis /
// PDF indexing has something real to parse instead of a 404. Requires pdfkit
// as a one-off dev tool (not a project dependency):
//   npm install pdfkit --no-save
// Output goes to ./seed-pdfs (gitignored) — upload manually, e.g.:
//   aws s3 cp seed-pdfs/<file> s3://procurement-documents-prod-08/seed-demo/<file>
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync, readFileSync } from "fs";
import pdfParse from "pdf-parse";

const docs = {
  "acme-contract-2026.pdf": [
    "ANNUAL INDUSTRIAL SUPPLY AGREEMENT",
    "Contract Number: CTR-C1",
    "Vendor: Acme Industrial Supplies (VEN-1001)",
    "Contract Value: USD 480,000",
    "Effective Date: 2025-06-27   Expiry Date: 2027-04-07",
    "",
    "1. TERMINATION: Either party may terminate this agreement with 30",
    "days written notice. No penalty applies for termination for",
    "convenience after the first 90 days.",
    "",
    "2. LIABILITY: Liability under this agreement is capped at the total",
    "contract value. Neither party is liable for indirect or consequential",
    "damages.",
    "",
    "3. PAYMENT TERMS: Net 30 from invoice date. Late payments accrue",
    "1.5% monthly interest.",
    "",
    "4. RENEWAL: This contract auto-renews for successive 1-year terms",
    "unless either party gives 60 days notice prior to expiry.",
  ],
  "global-tech-contract-2026.pdf": [
    "COMPONENT SUPPLY CONTRACT",
    "Contract Number: CTR-C3",
    "Vendor: Global Tech Components (VEN-1003)",
    "Contract Value: USD 610,000",
    "Effective Date: 2025-06-27   Expiry Date: 2026-06-27",
    "Status: PENDING RENEWAL - EXPIRES IN 5 DAYS",
    "",
    "1. TERMINATION: Either party may terminate with 30 days notice.",
    "",
    "2. LIABILITY: Liability is capped at contract value. This clause",
    "carries elevated risk due to the vendor's below-average reliability",
    "rating (3.8/5) and the imminent expiry with no renewal initiated.",
    "",
    "3. PAYMENT TERMS: Net 30 from invoice date.",
    "",
    "4. RENEWAL: No automatic renewal clause. Requires active renegotiation",
    "before the expiry date or the agreement lapses.",
  ],
  "sterling-invoice-inv4.pdf": [
    "VENDOR INVOICE",
    "Invoice Number: INV-INV4",
    "Vendor: Sterling Logistics Co (VEN-1004)",
    "Related PO: PO-PO3   Related Contract: CTR-C4",
    "Amount: USD 15,800 + 18% GST = USD 18,644",
    "Status: OVERDUE",
    "Due Date: 2026-06-16 (past due)",
    "",
    "Line item: Quarterly logistics services - Q2 2026",
    "Quantity: 1   Rate: USD 15,800",
  ],
  "po4-globaltech.pdf": [
    "PURCHASE ORDER",
    "PO Number: PO-PO4",
    "Vendor: Global Tech Components (VEN-1003)",
    "Status: ACKNOWLEDGED",
    "Total Amount: USD 29,700",
    "Expected Delivery: 10 days from order date",
    "",
    "Line item: Server components - seeded demo order line",
    "Quantity: 5",
  ],
  "globaltech-iso-cert.pdf": [
    "VENDOR CERTIFICATION",
    "Vendor: Global Tech Components (VEN-1003)",
    "Certificate Type: ISO 9001:2015 Quality Management",
    "Status: Active",
    "Issued by: Seeded Demo Certification Body",
    "Certificate Number: CERT-VEN1003-2026",
    "Valid From: 2025-01-01   Valid Until: 2027-12-31",
    "Scope: Manufacturing and supply of electronic components.",
  ],
};

mkdirSync("./seed-pdfs", { recursive: true });

// The deployed ai-service bundles a very old pdf-parse (pdf.js v1.10.100,
// ~2017) that intermittently fails with "bad XRef entry" on otherwise valid
// PDFs (flaky at the byte level, not content-dependent — confirmed by the
// same file passing/failing across runs with no input change). Generating
// with compress:false avoids most cases; the rest get caught and retried
// here by re-parsing with the exact same library the real service uses.
async function generateOnce(name, lines) {
  const path = `./seed-pdfs/${name}`;
  const doc = new PDFDocument({ margin: 50, compress: false });
  const stream = createWriteStream(path);
  doc.pipe(stream);
  doc.font("Helvetica");
  lines.forEach((line, i) => {
    doc.fontSize(i === 0 ? 14 : 11).text(line);
  });
  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return path;
}

for (const [name, lines] of Object.entries(docs)) {
  let ok = false;
  for (let attempt = 1; attempt <= 10 && !ok; attempt++) {
    const path = await generateOnce(name, lines);
    try {
      await pdfParse(readFileSync(path));
      ok = true;
      console.log(`Generated ${name} (verified parseable, attempt ${attempt})`);
    } catch (e) {
      if (attempt === 10) throw new Error(`${name} never produced a parseable PDF after 10 attempts: ${e.message}`);
    }
  }
}
