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

describe('profile stats', () => {
  it('counts lifetime coins, harvests and orders, and old saves start at zero', () => {
    harvest(1, () => 0.01);
    expect(S.stats.harvested).toBe(2);
    fillOrders();
    const o = S.orders[0];
    for (const [k, q] of Object.entries(o.items)) S.inv[k as keyof typeof S.inv] = q;
    deliver(0);
    expect(S.stats.orders).toBe(1);
    expect(S.stats.earned).toBe(o.coins);
    const { stats: _drop, ...old } = S;
    expect(migrate(JSON.parse(JSON.stringify(old))).stats).toEqual({ earned: 0, harvested: 0, orders: 0, trucks: 0, missed: 0, fish: 0 });
  });
});

describe('truck buyers', () => {
  it('arrives on schedule, pays a tip when loaded early, and raises reputation', async () => {
    const { truckTick, deliverTruck } = await import('../src/game/trucks');
    truckTick(t);
    expect(S.truck).toBeNull();
    t = S.nextTruck;
    truckTick(t);
    const k = S.truck!;
    expect(k).toBeTruthy();
    expect(deliverTruck(t)).toBeNull();
    for (const [i, q] of Object.entries(k.items)) S.inv[i as keyof typeof S.inv] = q;
    const coins = S.coins, rep = S.rep;
    const r = deliverTruck(t + 1000)!;
    expect(r.tip).toBeGreaterThan(0);
    expect(S.coins).toBe(coins + r.coins + r.tip);
    expect(S.rep).toBeGreaterThan(rep);
    expect(S.truck).toBeNull();
    expect(S.stats.trucks).toBe(1);
  });

  it('leaves angry when time runs out, but not for time spent away from the game', async () => {
    const { truckTick } = await import('../src/game/trucks');
    const { on } = await import('../src/game/events');
    let missed = 0;
    const off = on('truckMissed', () => { missed++; });
    t = S.nextTruck; truckTick(t);
    t = S.truck!.end + 100; truckTick(t);
    expect(missed).toBe(1);
    expect(S.rep).toBe(2);
    t = S.nextTruck; truckTick(t);
    t = S.truck!.end + 3_600_000; truckTick(t);
    expect(missed).toBe(1);
    expect(S.rep).toBe(2);
    off();
  });
});

describe('animals', () => {
  it('eat feed, make their product over time, and old saves get starter herds', async () => {
    const A = await import('../src/game/animals');
    S.inv.wheat = 0;
    expect(A.feedAnimal('hen', 0, t)).toBe('nofeed');
    S.inv.wheat = 5;
    expect(A.feedAnimal('hen', 0, t)).toBe('fed');
    expect(S.inv.wheat).toBe(4);
    expect(A.collectAnimal('hen', 0, t + 1000)).toBe(false);
    expect(A.collectAnimal('hen', 0, t + 20_000)).toBe(true);
    expect(S.inv.egg).toBe(1);
    expect(A.feedAnimal('cow', 0, t)).toBe('locked');
    const { animals: _a, ...old } = S;
    expect(migrate(JSON.parse(JSON.stringify(old))).animals.hen.n).toBe(3);
  });

  it('shows the next truck order ahead of time and the truck brings exactly that', async () => {
    const { truckTick } = await import('../src/game/trucks');
    truckTick(t);
    const wants = { ...S.nextWants };
    expect(Object.keys(wants).length).toBeGreaterThan(0);
    t = S.nextTruck; truckTick(t);
    expect(S.truck!.items).toEqual(wants);
  });
});

describe('buyers only ask for products you have made', () => {
  it('skips animal products until one is collected', async () => {
    const { newOrder } = await import('../src/game/orders');
    S.level = 6; S.animals.pig.n = 1;
    for (let j = 0; j < 200; j++) expect(newOrder().items.truffle).toBeUndefined();
    S.made.truffle = 1;
    let seen = false;
    for (let j = 0; j < 400 && !seen; j++) seen = !!newOrder().items.truffle;
    expect(seen).toBe(true);
  });
  it('drops a queued truck preview for an unmade product on load', () => {
    const m = migrate({ ...fresh(), nextWants: { truffle: 2 }, made: undefined });
    expect(m.nextWants).toBeNull();
  });
});

describe('fishing', () => {
  it('bites after the wait, catches during the bite, misses when early or late', async () => {
    const f = await import('../src/game/fishing');
    f.resetFishing();
    expect(f.cast(t, () => 0)).toBe(true);
    expect(f.reel(t + 100)).toBeNull(); // too early
    expect(f.line.state).toBe('idle');
    f.cast(t, () => 0);
    f.fishTick(t + 2600);
    expect(f.line.state).toBe('bite');
    expect(f.reel(t + 3000, () => 0.1)).toBe('fish');
    expect(inv('fish')).toBe(1);
    expect(S.made.fish).toBe(1);
    expect(S.stats.fish).toBe(1);
    f.cast(t, () => 0);
    f.fishTick(t + 2600);
    f.fishTick(t + 2600 + 2000); // waited too long
    expect(f.line.state).toBe('idle');
    f.cast(t, () => 0); f.fishTick(t + 2600);
    expect(f.reel(t + 2700, () => 0.99)).toBe('goldfish');
  });
});

describe('land', () => {
  it('needs a full home field, the level and the coins, then adds 12 plots', async () => {
    const { buyLand } = await import('../src/game/economy');
    S.level = 20; S.coins = 1e6;
    expect(buyLand()).toMatchObject({ ok: false, reason: 'field' });
    while (S.plots.length < 20) S.plots.push({ crop: null, at: 0 });
    S.level = 3;
    expect(buyLand()).toMatchObject({ ok: false, reason: 'locked' });
    S.level = 20; S.coins = 100;
    expect(buyLand()).toMatchObject({ ok: false, reason: 'coins' });
    S.coins = 1e6;
    expect(buyLand()).toMatchObject({ ok: true, k: 0 });
    expect(S.plots.length).toBe(32);
    expect(S.land).toBe(1);
    expect(buyLand()).toMatchObject({ ok: true, k: 1 });
    expect(buyLand()).toMatchObject({ ok: false, reason: 'max' });
    expect(migrate(JSON.parse(JSON.stringify(S))).land).toBe(2);
  });
});

describe('paid staff', () => {
  it('charges up front, works ripe crops while away, and stops when the contract ends', async () => {
    const st = await import('../src/game/staff');
    S.level = 10; S.coins = 100;
    expect(st.hireStaff('manager', 1)).toMatchObject({ ok: false, reason: 'coins' });
    S.coins = 100000;
    const before = S.coins;
    expect(st.hireStaff('manager', 1, t).ok).toBe(true);
    expect(S.coins).toBe(before - st.termCost('manager', 1));
    S.plots.forEach(p => { p.crop = 'wheat'; p.at = t; });
    const sum = st.catchUp(t, t + 3 * 3600_000);
    // wheat grows in seconds, so an hour of manager work is many harvests, and nothing after the hour
    expect(sum.crops).toBeGreaterThan(S.plots.length * 10);
    const after = st.catchUp(t + 2 * 3600_000, t + 3 * 3600_000);
    expect(after.crops).toBe(0);
  });
  it('helpers stop when wages cannot be paid', async () => {
    const st = await import('../src/game/staff');
    S.farmhands = 2; S.coins = 0;
    st.payWages(3600);
    expect(st.unpaid).toBe(true);
    S.coins = 10000;
    st.payWages(60);
    expect(st.unpaid).toBe(false);
  });
});

describe('manager runs the crew', () => {
  it('re-hires the keeper and sells spare crops for wages', async () => {
    const st = await import('../src/game/staff');
    S.level = 10; S.coins = 100000;
    st.hireStaff('manager', 8, t);
    st.hireStaff('keeper', 1, t);
    const end = S.staff.keeper;
    st.staffWork(end - 60_000, true);
    expect(S.staff.keeper).toBe(end + 3600_000);
    S.coins = 0; S.farmhands = 3; S.inv.wheat = 500;
    st.payWages(3600);
    expect(st.unpaid).toBe(false);
    expect(inv('wheat')).toBeLessThan(500);
    expect(inv('wheat')).toBeGreaterThanOrEqual(10);
  });
});
