// The game checks in with when its next alerts are due. Logic: src/server/notify.ts.
import { handleSave } from '../../../src/server/notify';
import type { Env } from '../../../src/server/payments';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleSave(request, env);
