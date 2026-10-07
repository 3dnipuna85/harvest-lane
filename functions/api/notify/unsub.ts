// The unsubscribe link in alert emails. Logic: src/server/notify.ts.
import { handleUnsub } from '../../../src/server/notify';
import type { Env } from '../../../src/server/payments';

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handleUnsub(request, env);
export const onRequestPost = onRequestGet;
