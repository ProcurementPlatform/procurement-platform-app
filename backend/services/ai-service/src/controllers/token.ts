import { IAuthenticatedRequest } from '@procurement/types';

/** Extract the caller's bearer token so it can be forwarded on inter-service calls. */
export const callerToken = (req: IAuthenticatedRequest): string => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // Fall back to the cookie the gateway/services also accept.
  return (req as any).cookies?.token || '';
};
