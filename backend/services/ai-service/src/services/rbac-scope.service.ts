import { IAuthPayload } from '@procurement/types';
import { platformData } from './platform-data';

// Resolves what data a given caller is allowed to see, so AI features never
// assemble context (or return analysis) from rows the caller shouldn't access.
//
// Only the `vendor` role is restricted to its own data; every other role is
// treated as having org-wide read for AI purposes. Vendor identity comes from
// the caller's own profile (Identity_User.vendorId, fetched over REST from
// identity-service). If unset we FAIL CLOSED — the vendor sees nothing.

export interface CallerScope {
  role: string;
  isVendor: boolean;
  vendorId?: string;
  unresolvedVendor: boolean;
}

export const resolveCallerScope = async (user: IAuthPayload, token: string): Promise<CallerScope> => {
  if (user.role !== 'vendor') {
    return { role: user.role, isVendor: false, unresolvedVendor: false };
  }

  let vendorId: string | undefined;
  try {
    const profile = await platformData.myProfile(token);
    vendorId = profile?.vendorId || undefined;
  } catch {
    vendorId = undefined;
  }

  return { role: user.role, isVendor: true, vendorId, unresolvedVendor: !vendorId };
};

export const canAccessVendorData = (scope: CallerScope, recordVendorId?: string): boolean => {
  if (!scope.isVendor) return true;
  if (scope.unresolvedVendor || !scope.vendorId) return false;
  return !!recordVendorId && recordVendorId === scope.vendorId;
};
