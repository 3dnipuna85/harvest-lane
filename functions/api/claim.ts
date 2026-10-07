// The game collects paid packs here. The logic lives in src/server/payments.ts.
import { handleClaim, type Env } from '../../src/server/payments';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleClaim(request, env);
