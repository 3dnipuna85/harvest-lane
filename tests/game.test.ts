import { beforeEach, describe, expect, it } from 'vitest';
import { clock } from '../src/game/clock';
import { buyMachine, buyPlot, gainXP, harvest, hire, inv, mTime, plant, plotCost, ripe, xpNeed } from '../src/game/economy';
import { on } from '../src/game/events';
import { canFill, deliver, fillOrders, skip } from '../src/game/orders';
import { sim } from '../src/game/sim';
import { fresh, migrate, setState, S, SAVE_VERSION } from '../src/game/state';

let t = 1_000_000;
beforeEach(() => {
  t = 1_000_000;
  clock.now = () => t;
  setState(fresh(t));
});

describe('new farm', () => {
  it('starts with 30 coins, 6 plots and 3 planted wheat', () => {
    expect(S.coins).toBe(30);
    expect(S.plots).toHaveLength(6);
    expect(S.plots.filter(p => p.crop === 'wheat')).toHaveLength(3);
    expect(S.version).toBe(SAVE_VERSION);
  });
});

describe('planting and harvesting', () => {
  it('charges the seed cost and ripens after the grow time', () => {
    expect(plant(3)).toBe(true);
    expect(S.coins).toBe(28);
    expect(ripe(S.plots[3])).toBe(false);
    t += 6000;
    expect(ripe(S.plots[3])).toBe(true);
  });

  it('plants the seed chosen at tap time, even after the selection changes', () => {
    S.coins = 100;
    S.sel = 'carrot';
    expect(plant(3, 'corn')).toBe(true);
    expect(S.plots[3].crop).toBe('corn');
  });

  it('refuses to plant without enough coins', () => {
    S.coins = 1;
    expect(plant(3)).toBe(false);
    expect(S.plots[3].crop).toBeNull();
  });

  it('harvest adds to the barn and gives XP, double on a lucky roll', () => {
    const n = harvest(1, () => 0.01);
    expect(n).toBe(2);
    expect(inv('wheat')).toBe(4);
    expect(S.xp).toBe(2);
    expect(S.plots[1].crop).toBeNull();
  });
});

describe('levels', () => {
  it('uses round(14 * level^1.55) and announces unlocks', () => {
    expect(xpNeed(1)).toBe(14);
    const seen: string[][] = [];
    const off = on('levelUp', e => seen.push(e.unlocked));
    gainXP(14);
    off();
    expect(S.level).toBe(2);
    expect(seen[0]).toContain('Bakery');
    expect(seen[0]).toContain('Farmhands');
  });
});

describe('purchases', () => {
  it('plot cost grows by 1.5x', () => {
    S.coins = 1000;
    expect(plotCost()).toBe(40);
    expect(buyPlot().ok).toBe(true);
    expect(plotCost()).toBe(60);
  });

  it('workshops and helpers respect level locks', () => {
    S.coins = 10000;
    expect(buyMachine('bakery')).toEqual({ ok: false, reason: 'locked' });
    expect(hire('farmhand')).toEqual({ ok: false, reason: 'locked' });
    S.level = 2;
    expect(buyMachine('bakery').ok).toBe(true);
    expect(hire('farmhand').ok).toBe(true);
  });
});

describe('workshops', () => {
  it('consume ingredients, run for their time, and output goods', () => {
    S.level = 2; S.coins = 500; buyMachine('bakery');
    S.inv.wheat = 3;
    sim(0.016);
    expect(inv('wheat')).toBe(0);
    expect(S.machines.bakery.job).not.toBeNull();
    t += mTime('bakery') * 1000;
    sim(0.016);
    expect(inv('bread')).toBe(1);
  });

  it('each upgrade level is 18% faster', () => {
    S.machines.bakery.lvl = 2;
    expect(mTime('bakery')).toBeCloseTo(8 * 0.82);
  });
});

describe('orders', () => {
  it('keeps three orders and pays on delivery', () => {
    fillOrders();
    expect(S.orders).toHaveLength(3);
    const o = S.orders[0];
    for (const [k, q] of Object.entries(o.items)) S.inv[k as keyof typeof S.inv] = q;
    expect(canFill(o)).toBe(true);
    const coins = S.coins;
    expect(deliver(0)).toBe(o);
    expect(S.coins).toBe(coins + o.coins);
    expect(S.orders).toHaveLength(3);
  });

  it('skipping has a 15s cooldown', () => {
    fillOrders();
    expect(skip(0)).toBe(true);
    expect(skip(1)).toBe(false);
    t += 15000;
    expect(skip(1)).toBe(true);
  });
});

describe('saves', () => {
  it('migrates an unversioned prototype save', () => {
    const old = { ...fresh(t), coins: 999 } as Record<string, unknown>;
    delete old.version;
    const s = migrate(JSON.parse(JSON.stringify(old)));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.coins).toBe(999);
    expect(Object.keys(s.machines)).toHaveLength(5);
  });

  it('falls back to a fresh farm for junk', () => {
    expect(migrate('nonsense').coins).toBe(30);
    expect(migrate(null).plots).toHaveLength(6);
  });
});
