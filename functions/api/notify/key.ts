// The public Web Push key. Logic: src/server/notify.ts.
import { handleKey } from '../../../src/server/notify';
import type { Env } from '../../../src/server/payments';

export const onRequestGet = ({ env }: { env: Env }) => handleKey(env);
