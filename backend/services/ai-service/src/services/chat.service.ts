import { invokeChat, logger } from '@procurement/common';
import { IAuthPayload } from '@procurement/types';
import { resolveCallerScope, CallerScope } from './rbac-scope.service';
import { platformData } from './platform-data';

const CAP = 40; // cap each list to bound the prompt size

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  /**
   * Assemble a compact, role-scoped snapshot of procurement data and ask Nova
   * Pro to answer the user's question from it. Stateless — the client sends the
   * conversation history with each request. All data is fetched over REST from
   * the owning services (no in-process model access).
   */
  async chat(user: IAuthPayload, token: string, messages: ChatMessage[], structured: boolean) {
    const scope = await resolveCallerScope(user, token);

    // A vendor whose identity can't be resolved gets no data (fail closed).
    if (scope.isVendor && scope.unresolvedVendor) {
      return {
        reply:
          'Your account is not yet linked to a vendor profile, so I cannot access any procurement data for you. Please ask an administrator to link your account.',
        structuredData: undefined,
      };
    }

    const context = await this.buildContext(scope, token);

    const system =
      'You are ProcureFlow Copilot, an assistant for a procurement platform. ' +
      'Answer the user strictly from the JSON DATA snapshot provided below — do not invent vendors, invoices, amounts, or dates that are not in it. ' +
      'If the data does not contain the answer, say so plainly. Be concise and use INR (₹) for money. ' +
      (scope.isVendor ? 'This user is an external vendor and may only see their own records (already filtered). ' : '') +
      (structured
        ? 'Respond ONLY with valid minified JSON of the form {"answer": string, "items": array} where items is any tabular data supporting the answer. '
        : '') +
      '\n\nDATA:\n' +
      JSON.stringify(context);

    let raw: string;
    try {
      raw = await invokeChat(messages, system, 1200);
    } catch (err) {
      logger.error('Copilot Bedrock call failed: ' + (err as Error).message);
      throw new Error('The AI assistant is temporarily unavailable. Please try again.');
    }

    if (structured) {
      const parsed = this.safeParseJson(raw);
      if (parsed) {
        return { reply: typeof parsed.answer === 'string' ? parsed.answer : raw, structuredData: parsed };
      }
    }
    return { reply: raw, structuredData: undefined };
  }

  /** Gather a scoped, summarized snapshot of the data the Copilot can reason over. */
  private async buildContext(scope: CallerScope, token: string) {
    const now = Date.now();

    const [allInvoices, allPayments, allVendors, allPos, allContracts, allCustomers] = await Promise.all([
      platformData.invoices(token),
      platformData.payments(token),
      platformData.vendors(token),
      platformData.purchaseOrders(token),
      platformData.contracts(token),
      platformData.customers(token),
    ]);

    // Vendor scoping: a vendor sees only rows tied to their vendorId.
    const vendorId = scope.vendorId;
    const scopeInvoice = (i: any) => !scope.isVendor || i.vendorId === vendorId;
    const scopePo = (p: any) => !scope.isVendor || p.vendor === vendorId;
    const scopeContract = (c: any) => !scope.isVendor || c.vendor === vendorId;
    const scopePayment = (p: any) => !scope.isVendor || p.vendor === vendorId;
    const scopeVendorRow = (v: any) => !scope.isVendor || v._id === vendorId;

    const invoices = allInvoices.filter(scopeInvoice);
    const money = (i: any) => i.totalAmount ?? i.grossAmount ?? 0;

    const unpaidInvoices = invoices
      .filter((i: any) => ['pending', 'approved', 'overdue'].includes(i.status))
      .slice(0, CAP)
      .map((i: any) => ({ invoiceNumber: i.invoiceNumber, party: i.partyName, amount: money(i), status: i.status, dueDate: i.dueDate }));

    const overdueInvoices = invoices
      .filter((i: any) => i.status === 'overdue' || (i.status !== 'paid' && i.dueDate && new Date(i.dueDate).getTime() < now))
      .slice(0, CAP)
      .map((i: any) => ({ invoiceNumber: i.invoiceNumber, party: i.partyName, amount: money(i), dueDate: i.dueDate }));

    const customerInvoices = invoices
      .filter((i: any) => i.invoiceType === 'CUSTOMER_INVOICE')
      .slice(0, CAP)
      .map((i: any) => ({ invoiceNumber: i.invoiceNumber, customer: i.partyName, amount: money(i), status: i.status }));

    // "Pending payments" = approved invoices not yet paid.
    const pendingPayments = invoices
      .filter((i: any) => i.status === 'approved')
      .slice(0, CAP)
      .map((i: any) => ({ invoiceNumber: i.invoiceNumber, party: i.partyName, amount: money(i) }));

    const payments = allPayments.filter(scopePayment).slice(0, CAP)
      .map((p: any) => ({ ref: p.paymentReference, amount: p.amount, method: p.paymentMethod, status: p.status, date: p.paymentDate }));

    const purchaseOrders = allPos.filter(scopePo)
      .filter((p: any) => !['cancelled', 'draft'].includes(p.status))
      .slice(0, CAP)
      .map((p: any) => ({ poNumber: p.poNumber, amount: p.totalAmount, status: p.status, orderDate: p.orderDate }));

    const expiringContracts = allContracts.filter(scopeContract)
      .filter((c: any) => c.status === 'active' && c.expiryDate && new Date(c.expiryDate).getTime() - now < 30 * 86400000 && new Date(c.expiryDate).getTime() > now)
      .slice(0, CAP)
      .map((c: any) => ({ contractNumber: c.contractNumber, name: c.contractName, value: c.contractValue, expiryDate: c.expiryDate }));

    const vendors = allVendors.filter(scopeVendorRow).slice(0, CAP)
      .map((v: any) => ({ name: v.vendorName, code: v.vendorCode, status: v.status, rating: v.rating, email: v.email }));

    const customers = scope.isVendor ? [] : allCustomers.slice(0, CAP)
      .map((c: any) => ({ name: c.companyName, code: c.customerCode, status: c.status }));

    return {
      asOf: new Date().toISOString(),
      counts: {
        totalInvoices: invoices.length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        vendors: vendors.length,
        activePurchaseOrders: purchaseOrders.length,
        expiringContracts: expiringContracts.length,
      },
      unpaidInvoices,
      overdueInvoices,
      customerInvoices,
      pendingPayments,
      payments,
      purchaseOrders,
      expiringContracts,
      vendors,
      customers,
    };
  }

  private safeParseJson(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { /* ignore */ } }
      return null;
    }
  }
}

export default new ChatService();
