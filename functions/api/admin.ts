// The admin page's server. The logic lives in src/server/admin.ts.
import { handleAdmin } from '../../src/server/admin';
import type { Env } from '../../src/server/payments';

export const onRequest = ({ request, env }: { request: Request; env: Env }) => handleAdmin(request, env);
