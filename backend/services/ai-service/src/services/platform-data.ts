import { serviceGet, serviceList, logger } from '@procurement/common';

// Inter-service data access for the AI service.
//
// The AI service owns ONLY its own AI_* tables. Everything else (invoices, POs,
// contracts, vendors, payments, customers, documents, the caller's profile) is
// fetched over REST from the owning service, forwarding the end-user's token so
// the downstream service applies its own RBAC. Endpoints the caller's role can't
// access (e.g. payments for a non-finance user) fail soft and return [].

const BULK = 1000;

const softList = async (service: any, path: string, token: string, query?: any): Promise<any[]> => {
  try {
    return await serviceList(service, path, { token, query });
  } catch (err) {
    logger.warn(`AI platform-data: ${service}${path} unavailable for caller: ${(err as Error).message}`);
    return [];
  }
};
const softGet = async (service: any, path: string, token: string): Promise<any | null> => {
  try {
    return await serviceGet(service, path, { token });
  } catch {
    return null;
  }
};

export const platformData = {
  /** The caller's own profile (incl. vendorId) — any authenticated user can read this. */
  myProfile: (token: string) => softGet('identity', '/api/auth/profile', token),

  invoices: (token: string) => softList('finance', '/api/invoices', token, { limit: BULK }),
  invoice: (token: string, id: string) => softGet('finance', `/api/invoices/${id}`, token),
  payments: (token: string) => softList('finance', '/api/payments', token, { limit: BULK }),
  customers: (token: string) => softList('finance', '/api/customers', token, { limit: BULK }),

  vendors: (token: string) => softList('procurement', '/api/vendors', token, { limit: BULK }),
  purchaseOrders: (token: string) => softList('procurement', '/api/purchase-orders', token, { limit: BULK }),
  purchaseOrder: (token: string, id: string) => softGet('procurement', `/api/purchase-orders/${id}`, token),
  contracts: (token: string) => softList('procurement', '/api/contracts', token, { limit: BULK }),
  contract: (token: string, id: string) => softGet('procurement', `/api/contracts/${id}`, token),

  /** Returns { url, document } — url is a presigned S3 GET; ai-service downloads the file via that url. */
  documentDownload: (token: string, id: string) => softGet('document', `/api/documents/${id}/download`, token),
  documents: (token: string, query?: any) => softList('document', '/api/documents', token, query),
};

/** Download a file's text-bearing bytes from a presigned URL (no S3 client needed in ai-service). */
export const fetchFileBuffer = async (presignedUrl: string): Promise<Buffer> => {
  const res = await fetch(presignedUrl);
  if (!res.ok) throw new Error(`Failed to download document (${res.status})`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
};
