// Called every few minutes by the cron Worker to send alerts that are due. Logic: src/server/notify.ts.
import { handleRun } from '../../../src/server/notify';
import type { Env } from '../../../src/server/payments';

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handleRun(request, env);
