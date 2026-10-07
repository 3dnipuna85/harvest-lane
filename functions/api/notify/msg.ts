// The service worker asks what a push notification was about. Logic: src/server/notify.ts.
import { handleMsg } from '../../../src/server/notify';
import type { Env } from '../../../src/server/payments';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleMsg(request, env);
