import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/data/store';

describe('store info pages', () => {
  it('the public pricing page lists every pack at its real price', () => {
    const html = readFileSync(new URL('../public/pricing.html', import.meta.url), 'utf8');
    for (const p of PACKS) {
      expect(html).toContain(`<tr><td>${p.name}</td><td>${p.gems.toLocaleString('en-US')} diamonds`);
      expect(html).toContain(`US$${p.usd}</td>`);
    }
  });
});
