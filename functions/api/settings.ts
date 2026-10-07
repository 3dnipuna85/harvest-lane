// Public game settings (no secrets). The logic lives in src/server/admin.ts.
import { publicSettings } from '../../src/server/admin';
import type { Env } from '../../src/server/payments';

export const onRequestGet = ({ env }: { env: Env }) => publicSettings(env);
