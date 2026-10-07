// Lemon Squeezy order webhook. The logic lives in src/server/payments.ts.
import { handleWebhook, webhookHealth, type Env } from '../../src/server/payments';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleWebhook(request, env);
export const onRequestGet = ({ env }: { env: Env }) => webhookHealth(env);
