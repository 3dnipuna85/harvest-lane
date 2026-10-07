// Sends a friend invite email. The logic lives in src/server/invite.ts.
import { handleInvite } from '../../src/server/invite';
import type { Env } from '../../src/server/payments';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleInvite(request, env);
