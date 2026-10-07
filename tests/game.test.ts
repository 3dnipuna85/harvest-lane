import { beforeEach, describe, expect, it } from 'vitest';
import { clock } from '../src/game/clock';
import { buyMachine, buyPlot, byStaff, gainXP, harvest, hire, inv, mTime, plant, plotCost, ripe, xpNeed } from '../src/game/economy';
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
  it('plot cost grows by 1.5x, and each new plot needs a level', () => {
    S.coins = 1000;
    expect(plotCost()).toBe(40);
    expect(buyPlot()).toMatchObject({ ok: false, reason: 'locked', lvl: 2 });
    S.level = 2;
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
    expect(Object.keys(s.machines)).toHaveLength(9);
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
    expect(migrate(JSON.parse(JSON.stringify(old))).stats).toEqual({ earned: 0, harvested: 0, orders: 0, trucks: 0, missed: 0, fish: 0, shop: 0, rotted: 0 });
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
    expect(buyLand()).toMatchObject({ ok: false, reason: 'mats' });
    S.inv = { plank: 60, brick: 25 };
    expect(buyLand()).toMatchObject({ ok: true, k: 0 });
    expect(S.inv.plank).toBe(40);
    expect(S.plots.length).toBe(32);
    expect(S.land).toBe(1);
    expect(buyLand()).toMatchObject({ ok: true, k: 1 });
    expect(buyLand()).toMatchObject({ ok: false, reason: 'max' });
    expect(migrate(JSON.parse(JSON.stringify(S))).land).toBe(2);
  });

  it('with all the land bought, riverside plots unlock with level', async () => {
    const eco = await import('../src/game/economy');
    S.level = 20; S.coins = 1e6;
    while (S.plots.length < 20) S.plots.push({ crop: null, at: 0 });
    S.inv = { plank: 1000, brick: 1000 };
    eco.buyLand(); eco.buyLand();
    expect(eco.plotSlot()).toBe('river');
    for (let k = 0; k < 3; k++) expect(eco.buyPlot().ok).toBe(true);
    expect(eco.buyPlot()).toMatchObject({ ok: false, reason: 'locked', lvl: 21 });
    S.level = 21;
    for (let k = 0; k < 3; k++) expect(eco.buyPlot().ok).toBe(true);
    expect(eco.buyPlot()).toMatchObject({ ok: false, reason: 'max' });
    expect(S.plots.length).toBe(50);
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

describe('manager plans for the truck', () => {
  it('plants what the next truck wants', async () => {
    const st = await import('../src/game/staff');
    S.level = 10; S.coins = 100000; S.inv = {};
    st.hireStaff('manager', 8, t);
    S.nextWants = { carrot: 6 };
    S.plots.forEach(p => { p.crop = null; p.at = 0; });
    expect(st.neededCrop()).toBe('carrot');
    st.staffWork(t, false); // away: the instant version plants
    expect(S.plots.filter(p => p.crop === 'carrot').length).toBe(6);
    expect(st.neededCrop()).toBeNull();
  });
});

describe('fisherman', () => {
  it('lands a catch every 15 seconds while hired, also while away', async () => {
    const st = await import('../src/game/staff');
    S.level = 5; S.coins = 100000; S.inv = {};
    st.hireStaff('fisher', 1, t);
    const sum = st.catchUp(t, t + 10 * 60_000);
    expect(sum.fish).toBeGreaterThanOrEqual(38);
    expect((S.inv.fish || 0) + (S.inv.crab || 0) + (S.inv.goldfish || 0)).toBe(sum.fish);
  });
});

describe('market town', () => {
  it('sells bigger pens up to the max', async () => {
    const tw = await import('../src/game/town');
    const an = await import('../src/game/animals');
    S.coins = 1_000_000; S.level = 10;
    expect(tw.maxAnimals('hen')).toBe(6);
    for (let i = 0; i < tw.MAX_PEN; i++) expect(tw.buyPen().ok).toBe(true);
    expect(tw.buyPen().ok).toBe(false);
    expect(tw.maxAnimals('hen')).toBe(6 + tw.MAX_PEN * tw.PEN_STEP);
    while (an.buyAnimal('hen').ok);
    expect(S.animals.hen.n).toBe(tw.maxAnimals('hen'));
    // a bigger herd survives a save and load
    expect(migrate(JSON.parse(JSON.stringify(S))).animals.hen.n).toBe(12);
  });

  it('fertilizer makes new crops ripen sooner', async () => {
    const tw = await import('../src/game/town');
    S.coins = 1000;
    expect(tw.buyBoost(t).ok).toBe(true);
    plant(3, 'wheat');
    t += 6000 * 0.76;
    expect(ripe(S.plots[3])).toBe(true);
    t += tw.BOOST_MIN * 60_000;
    plant(4, 'wheat');
    t += 6000 * 0.76;
    expect(ripe(S.plots[4])).toBe(false);
  });

  it('needs level 8 and 25,000 coins for a shop; the shopkeeper sells at town prices but keeps what trucks want', async () => {
    const tw = await import('../src/game/town');
    const st = await import('../src/game/staff');
    S.coins = 30000; S.level = 7;
    expect(tw.buyShop().ok).toBe(false);
    S.level = 8;
    expect(st.hireStaff('shopkeeper', 1, t).ok).toBe(false);
    expect(tw.buyShop().ok).toBe(true);
    expect(S.coins).toBe(5000);
    expect(st.hireStaff('shopkeeper', 1, t).ok).toBe(true);
    S.inv = { bread: 3, egg: 2 };
    S.nextWants = { bread: 2 };
    const coins = S.coins;
    const sum = st.catchUp(t, t + 60_000);
    expect(S.inv.bread).toBe(2);
    expect(S.inv.egg || 0).toBe(0);
    expect(sum.shop).toBe(S.coins - coins);
    expect(sum.shop).toBeGreaterThan(0);
  });
});

describe('harder economy', () => {
  it('levels past 5 need much more XP', () => {
    expect(xpNeed(3)).toBe(Math.round(14 * Math.pow(3, 1.55)));
    expect(xpNeed(20)).toBeGreaterThan(15 * Math.round(14 * Math.pow(20, 1.55)));
  });

  it('staff work earns coins but no XP; your own work does', async () => {
    const eco = await import('../src/game/economy');
    S.plots[0] = { crop: 'wheat', at: t - 60000 };
    S.plots[1] = { crop: 'wheat', at: t - 60000 };
    const xp = S.xp;
    eco.byStaff(() => harvest(0, () => 0.9));
    expect(S.xp).toBe(xp);
    harvest(1, () => 0.9);
    expect(S.xp).toBe(xp + 1);
  });

  it('flooding the market lowers the price, which recovers with time', async () => {
    const eco = await import('../src/game/economy');
    S.inv.egg = 200;
    const first = eco.sell('egg', 1);
    eco.sell('egg', 100);
    expect(eco.unitPrice('egg')).toBeLessThan(first);
    t += 2 * 60 * 60_000;
    expect(eco.unitPrice('egg')).toBe(first);
  });

  it('a truck the manager loads pays no tip', async () => {
    const eco = await import('../src/game/economy');
    const tr = await import('../src/game/trucks');
    S.truck = { ...tr.newTruck(t, () => 0.5), items: { wheat: 1 } };
    S.inv.wheat = 5;
    const r = eco.byStaff(() => tr.deliverTruck(t));
    expect(r!.tip).toBe(0);
  });
});

describe('rot and sickness', () => {
  it('a ripe crop left too long rots and yields nothing', async () => {
    const eco = await import('../src/game/economy');
    S.plots[3] = { crop: 'wheat', at: t };
    t += 6000 + eco.rotMs('wheat') - 1000;
    expect(eco.rotten(S.plots[3])).toBe(false);
    t += 2000;
    expect(eco.rotten(S.plots[3])).toBe(true);
    const before = inv('wheat');
    expect(harvest(3)).toBe(0);
    expect(inv('wheat')).toBe(before);
    expect(S.plots[3].crop).toBeNull();
    expect(S.stats.rotted).toBe(1);
  });

  it('an animal left hungry falls sick, refuses food, and the vet heals it', async () => {
    const an = await import('../src/game/animals');
    S.inv.wheat = 10; S.coins = 1000;
    expect(an.animalState('hen', 0)).toBe('hungry');
    t += an.SICK_AFTER_MS + 1;
    expect(an.animalState('hen', 0)).toBe('sick');
    expect(an.feedAnimal('hen', 0)).toBe('sick');
    expect(an.sickCount()).toBe(3);
    const r = an.healAll();
    expect(r.healed).toBe(3);
    expect(an.feedAnimal('hen', 0)).toBe('fed');
  });

  it('an animal keeper keeps them fed so none fall sick', async () => {
    const st = await import('../src/game/staff');
    const an = await import('../src/game/animals');
    S.level = 5; S.coins = 100000; S.inv.wheat = 500;
    st.hireStaff('keeper', 1, t);
    st.catchUp(t, t + 50 * 60_000);
    t += 50 * 60_000;
    expect(an.sickCount('hen')).toBe(0);
  });
});

describe('buyers want made goods', () => {
  it('asks for goods from a machine a level after it unlocks, even if you have none', async () => {
    const { newOrder } = await import('../src/game/orders');
    S.level = 2;
    for (let j = 0; j < 40; j++) expect(newOrder().items.bread).toBeUndefined();
    S.level = 3;
    let seen = false;
    for (let j = 0; j < 80; j++) if (newOrder().items.bread) seen = true;
    expect(seen).toBe(true);
  });

  it('from level 4 every order includes something made', async () => {
    const { newOrder } = await import('../src/game/orders');
    const { CROPS } = await import('../src/data/crops');
    S.level = 6;
    for (let j = 0; j < 60; j++) expect(Object.keys(newOrder().items).some(k => !(k in CROPS))).toBe(true);
  });

  it('trucks pay far more per coin of goods than of raw crops', async () => {
    const { newTruck } = await import('../src/game/trucks');
    const wheat = newTruck(t, Math.random, { wheat: 30 }), bread = newTruck(t, Math.random, { bread: 4 });
    // 30 wheat and 4 bread are about the same farm-gate value, but the bread pays roughly double.
    expect(bread.coins).toBeGreaterThan(wheat.coins * 1.6);
  });

  it('the manager plants wheat for bread a truck wants when you own a bakery', async () => {
    const { neededCrop } = await import('../src/game/staff');
    S.level = 5; S.coins = 1000; S.staff.manager = t + 3600_000;
    S.machines.bakery.owned = true;
    S.nextWants = { bread: 2 };
    expect(neededCrop()).toBe('wheat');
  });
});

describe('farm tiers and diamonds', () => {
  it('caps the level at the farm tier until the farm is upgraded', async () => {
    const { upgradeFarm, capped } = await import('../src/game/estate');
    S.level = 10; S.xp = 0;
    gainXP(1e7);
    expect(S.level).toBe(10);
    expect(capped()).toBe(true);
    expect(S.xp).toBe(xpNeed(10));
    S.coins = 9000; S.gems = 8;
    expect(upgradeFarm()).toEqual({ ok: false, reason: 'mats' });
    S.inv.plank = 12;
    expect(upgradeFarm()).toEqual({ ok: true, tier: 1 });
    expect(S.inv.plank).toBe(2);
    expect(S.coins).toBe(1000);
    // the XP saved at the cap levels up straight away, with its diamond
    expect(S.level).toBe(11);
    expect(S.gems).toBe(1);
  });

  it('refuses the upgrade without enough diamonds', async () => {
    const { upgradeFarm } = await import('../src/game/estate');
    S.coins = 1e6; S.gems = 3;
    expect(upgradeFarm()).toEqual({ ok: false, reason: 'gems' });
    expect(S.tier).toBe(0);
  });

  it('gives a diamond for each level-up', () => {
    gainXP(xpNeed(1));
    expect(S.level).toBe(2);
    expect(S.gems).toBe(1);
  });

  it('keeps old farms above the cap at their level', () => {
    const s = migrate({ ...JSON.parse(JSON.stringify(S)), level: 29, tier: undefined });
    expect(s.level).toBe(29);
    expect(s.tier).toBe(3);
  });
});

describe('idle helpers', () => {
  it('farmhands switch to the crop the barn is lowest on when the selected one is stocked', async () => {
    const { handSeed, BARN_ENOUGH } = await import('../src/game/staff');
    S.level = 7; S.coins = 1000; S.sel = 'strawberry';
    S.inv = { strawberry: BARN_ENOUGH + 5, wheat: 80, corn: 70, carrot: 3, tomato: 90 };
    expect(handSeed()).toBe('carrot');
  });

  it('sellers sell spare crops by default and say when they have nothing', async () => {
    const { sellersIdle, nextSale } = await import('../src/game/sim');
    S.sellers = 1; S.inv = { carrot: 40 };
    expect(S.sellCrops).toBe(true);
    expect(nextSale()).toBe('carrot');
    S.inv = { carrot: 5 };
    expect(sellersIdle()).toBe('empty');
  });

  it('old saves turn crop selling on', () => {
    const s = migrate({ ...JSON.parse(JSON.stringify(S)), version: 1, sellCrops: false });
    expect(s.sellCrops).toBe(true);
  });
});

describe('missed trucks', () => {
  it('charge a 10% cancellation fee when you were there to see it leave', async () => {
    const { newTruck, truckTick } = await import('../src/game/trucks');
    S.coins = 1000;
    S.truck = newTruck(t, Math.random, { wheat: 10 });
    const pay = S.truck.coins;
    t = S.truck.end + 100;
    truckTick(t);
    expect(S.truck).toBeNull();
    expect(S.coins).toBe(1000 - Math.round(pay * 0.1));
  });
});

describe('contract lorries', () => {
  it('come once you own a machine, ask only for its goods, and pay coins and diamonds', async () => {
    const { contractTick, deliverContract } = await import('../src/game/contracts');
    contractTick(t);
    expect(S.nextContract).toBe(0);
    S.machines.bakery.owned = true; S.level = 5;
    contractTick(t);
    t = S.nextContract + 1;
    contractTick(t);
    expect(S.contract).not.toBeNull();
    expect(Object.keys(S.contract!.items)).toEqual(['bread']);
    const need = S.contract!.items.bread!, pay = S.contract!.coins, gems = S.contract!.gems;
    expect(deliverContract(t)).toBeNull();
    S.inv.bread = need; S.coins = 0; S.gems = 0;
    expect(deliverContract(t)).not.toBeNull();
    expect(S.coins).toBe(pay);
    expect(S.gems).toBeGreaterThanOrEqual(gems);
    expect(pay).toBeGreaterThan(need * 30 * 3);
  });
});

describe('woods and quarry', () => {
  it('three chops fell a tree for logs, and the stump regrows', async () => {
    const { chopTree, plantSapling, TREE_REGROW_MS } = await import('../src/game/resources');
    expect(chopTree(0, t)).toBe('locked');
    S.level = 9;
    expect(chopTree(0, t)).toBe('hit');
    expect(chopTree(0, t)).toBe('hit');
    expect(chopTree(0, t, () => 0.9)).toBe('done');
    expect(S.inv.log).toBe(2);
    // a stump stays a stump until a sapling is planted
    expect(chopTree(0, t + 10 * TREE_REGROW_MS)).toBe('stump');
    S.coins = 0;
    expect(plantSapling(0, t)).toMatchObject({ ok: false, reason: 'coins' });
    S.coins = 1000;
    expect(plantSapling(0, t).ok).toBe(true);
    expect(chopTree(0, t)).toBe('regrowing');
    expect(chopTree(0, t + TREE_REGROW_MS)).toBe('hit');
  });

  it('making a workshop faster takes planks and bricks once the Woods are open', async () => {
    const eco = await import('../src/game/economy');
    S.level = 12; S.coins = 1e6;
    S.machines.bakery.owned = true;
    expect(eco.upgradeMachine('bakery')).toMatchObject({ ok: false, reason: 'mats' });
    S.inv = { plank: 30, brick: 6 };
    expect(eco.upgradeMachine('bakery').ok).toBe(true);
    expect(eco.upgradeMachine('bakery').ok).toBe(true);
    expect(S.inv).toMatchObject({ plank: 0, brick: 0 });
  });

  it('Pine Ridge and Hill Quarry open later; hill rocks are tougher and richer', async () => {
    const r = await import('../src/game/resources');
    S.level = 15;
    expect(r.chopTree(r.WOODS_TREES, t)).toBe('locked');
    S.level = 18;
    const i = r.QUARRY_ROCKS;
    for (let k = 0; k < r.HILL_HITS - 1; k++) expect(r.mineRock(i, t)).toBe('hit');
    expect(r.mineRock(i, t, () => 0.01)).toBe('done');
    expect(S.inv.stone).toBe(4);
    expect(S.gems).toBeGreaterThan(0);
  });

  it('four hits break a rock for stone', async () => {
    const { mineRock } = await import('../src/game/resources');
    S.level = 11;
    for (let k = 0; k < 3; k++) expect(mineRock(2, t)).toBe('hit');
    expect(mineRock(2, t, () => 0.9)).toBe('done');
    expect(S.inv.stone).toBe(2);
  });

  it('the lumberjack and quarry worker chop and dig while hired, without XP', async () => {
    const st = await import('../src/game/staff');
    S.coins = 1e6; S.level = 9;
    expect(st.hireStaff('miner', 1, t)).toMatchObject({ ok: false, reason: 'locked' });
    expect(st.hireStaff('lumberjack', 1, t).ok).toBe(true);
    S.level = 11;
    expect(st.hireStaff('miner', 1, t).ok).toBe(true);
    const xp = S.xp;
    const sum = st.catchUp(t, t + 10 * 60_000);
    expect(sum.logs).toBeGreaterThan(0);
    expect(sum.stone).toBeGreaterThan(0);
    expect(S.inv.log).toBe(sum.logs);
    expect(S.inv.stone).toBe(sum.stone);
    expect(S.xp).toBe(xp);
    // a felled tree regrows before he can chop it again: they work through the standing ones
    expect(S.woods.filter(x => x > t).length).toBeGreaterThan(1);
  });

  it('helpers never sell building materials', async () => {
    const { nextSale } = await import('../src/game/sim');
    S.sellers = 1; S.inv = { log: 50, plank: 20, brick: 9 };
    expect(nextSale()).toBeUndefined();
  });
});

describe('diamond shop', () => {
  it('swaps diamonds for coins, and refuses when short', async () => {
    const st = await import('../src/game/store');
    S.gems = 12; S.coins = 0; S.level = 10;
    expect(st.buyBag(0).ok).toBe(true);
    expect(S.gems).toBe(2);
    expect(S.coins).toBe(st.bagCoins(0));
    expect(st.buyBag(0)).toMatchObject({ ok: false, reason: 'gems', need: 8 });
  });

  it('Double XP doubles what you earn while it lasts', async () => {
    const st = await import('../src/game/store');
    S.gems = 20; S.level = 1; S.xp = 0;
    expect(st.buyXpBoost(t).ok).toBe(true);
    gainXP(3);
    expect(S.xp).toBe(6);
    clock.now = () => t + st.XP_BOOST_MIN * 60_000 + 1;
    gainXP(3);
    expect(S.xp).toBe(9);
  });

  it('a one-time pack can only be granted once', async () => {
    const st = await import('../src/game/store');
    S.gems = 0;
    expect(st.grantPack('starter', t)).toBe(true);
    expect(S.gems).toBe(250);
    expect(st.grantPack('starter', t)).toBe(false);
    expect(st.grantPack('handful', t)).toBe(true);
    expect(st.grantPack('handful', t)).toBe(true);
    expect(S.gems).toBe(570);
  });

  it('machines earn no XP by themselves', () => {
    S.level = 1; S.xp = 0;
    S.machines.bakery = { owned: true, lvl: 1, job: { start: t - 99999, end: t - 1 }, on: false };
    sim(0.1);
    expect(S.inv.bread).toBe(1);
    expect(S.xp).toBe(0);
  });
});

describe('level targets', () => {
  it('each level brings two targets and a timed challenge of different kinds', async () => {
    const g = await import('../src/game/goals');
    S.level = 5;
    g.goalsTick(t, () => 0);
    expect(S.goals!.lvl).toBe(5);
    expect(S.goals!.list).toHaveLength(3);
    expect(new Set(S.goals!.list.map(x => x.kind)).size).toBe(3);
    expect(S.goals!.list[2].until).toBe(t + g.timedMin(5) * 60_000);
    expect(S.goals!.list[2].gems).toBeGreaterThan(0);
  });

  it('your own work fills a target and pays; staff work does not', async () => {
    const g = await import('../src/game/goals');
    S.level = 5; S.gems = 0;
    g.goalsTick(t, () => 0);
    const harvest = S.goals!.list.findIndex(x => x.kind === 'harvest');
    expect(harvest).toBeGreaterThanOrEqual(0);
    const goal = S.goals!.list[harvest];
    byStaff(() => g.progress('harvest', 999, t));
    expect(goal.have).toBe(0);
    const coins = S.coins;
    g.progress('harvest', goal.n, t);
    expect(goal.state).toBe('done');
    expect(S.coins).toBe(coins + goal.coins);
  });

  it('a missed challenge is replaced after a wait, and a new level brings new targets', async () => {
    const g = await import('../src/game/goals');
    S.level = 5;
    g.goalsTick(t, () => 0);
    const until = S.goals!.list[2].until;
    g.goalsTick(until, () => 0);
    expect(S.goals!.list[2].state).toBe('failed');
    g.progress(S.goals!.list[2].kind, 999, until + 1);
    expect(S.goals!.list[2].have).toBe(0);
    g.goalsTick(until + g.FAILED_GAP_MS, () => 0);
    expect(S.goals!.list[2].state).toBe('open');
    S.level = 6;
    g.goalsTick(until + g.FAILED_GAP_MS + 1, () => 0);
    expect(S.goals!.lvl).toBe(6);
  });
});

describe('troubles', () => {
  it('heavy rain slows growing crops and rots ripe ones faster', async () => {
    const tr = await import('../src/game/troubles');
    S.level = 5;
    S.plots[0] = { crop: 'wheat', at: t - 1000 };
    S.plots[1] = { crop: 'wheat', at: t - 60_000 };
    tr.startTrouble('rain', t);
    tr.troubleTick(t - 4000);
    tr.troubleTick(t);
    expect(S.plots[0].at).toBe(t - 1000 + 2000);
    expect(S.plots[1].at).toBe(t - 60_000 - 8000);
  });

  it('in a dry spell only watered crops keep growing', async () => {
    const tr = await import('../src/game/troubles');
    S.level = 5;
    S.plots[0] = { crop: 'tomato', at: t - 1000 };
    S.plots[1] = { crop: 'tomato', at: t - 1000 };
    tr.startTrouble('dry', t);
    expect(tr.water(1)).toBe(true);
    expect(tr.water(1)).toBe(false);
    tr.troubleTick(t - 2000);
    tr.troubleTick(t);
    expect(S.plots[0].at).toBe(t + 1000);
    expect(S.plots[1].at).toBe(t - 1000);
    S.coins = 0;
    expect(tr.waterAll().ok).toBe(false);
  });

  it('crows eat crops unless shooed; the fox steals unless chased', async () => {
    const tr = await import('../src/game/troubles');
    S.level = 5;
    S.plots.forEach(p => { p.crop = null; });
    S.plots[0] = { crop: 'corn', at: t };
    S.plots[1] = { crop: 'corn', at: t };
    tr.startTrouble('crows', t, () => 0.3);
    const crows = S.trouble!.crows!.map(c => c.i);
    expect(crows.length).toBe(2);
    expect(tr.shooCrow(crows[0], t)).toBe(true);
    clock.now = () => t + tr.CROW_MS + 5000;
    tr.troubleTick(t + tr.CROW_MS + 5000);
    expect(S.plots[crows[0]].crop).toBe('corn');
    expect(S.plots[crows[1]].crop).toBeNull();
    expect(S.trouble).toBeNull();

    S.inv = { egg: 20, milk: 2 };
    tr.startTrouble('fox', t);
    tr.troubleTick(t + tr.FOX_MS);
    expect(S.inv.egg).toBe(14);
    expect(S.inv.milk).toBe(0);
    tr.startTrouble('fox', t);
    for (let k = 0; k < tr.FOX_HP; k++) tr.chaseFox(t);
    expect(S.trouble).toBeNull();
  });
});

describe('rewarded ads', () => {
  it('gives the reward and respects the daily limit', async () => {
    const ads = await import('../src/game/ads');
    const { live } = await import('../src/game/live');
    live.adCap = 2;
    S.ads = { day: '', n: 0 };
    const g = S.gems;
    expect(ads.grantAd('gems')).toBe(true);
    expect(S.gems).toBe(g + ads.AD_GEMS);
    expect(ads.adsLeft()).toBe(1);
    S.machines.bakery = { owned: true, lvl: 1, job: null, on: false };
    for (const k of Object.keys(S.machines) as (keyof typeof S.machines)[]) S.machines[k].job = null;
    expect(ads.grantAd('rush')).toBe(false); // nothing to rush, no ad spent
    expect(ads.grantAd('coins')).toBe(true);
    expect(ads.grantAd('gems')).toBe(false);
    S.ads = { day: '2000-01-01', n: 99 };
    expect(ads.adsLeft()).toBe(2); // a new day
    live.adCap = 10;
  });
});

describe('targets: skip the wait and double rewards', () => {
  it('a missed challenge waits 10 minutes unless you pay or watch an ad', async () => {
    const goals = await import('../src/game/goals');
    S.goals = null; S.level = 5;
    const t0 = Date.now();
    goals.goalsTick(t0);
    const ch = S.goals!.list[2];
    goals.goalsTick(ch.until + 1);
    expect(S.goals!.list[2].state).toBe('failed');
    expect(goals.challengeWait(ch.until + 1)).toBe(goals.FAILED_GAP_MS);
    S.gems = 1;
    expect(goals.skipWait('gems', ch.until + 2)).toBe(false);
    S.gems = 10;
    expect(goals.skipWait('gems', ch.until + 2)).toBe(true);
    expect(S.gems).toBe(10 - goals.SKIP_GEMS);
    expect(S.goals!.list[2].state).toBe('open');
  });
  it('a finished target can be doubled once', async () => {
    const goals = await import('../src/game/goals');
    S.goals = null; S.level = 5;
    goals.goalsTick(Date.now());
    const g = S.goals!.list[0];
    goals.progress(g.kind, g.n);
    expect(g.state).toBe('done');
    const c = S.coins;
    expect(goals.doubleGoal(0)).toBe(true);
    expect(S.coins).toBe(c + g.coins);
    expect(goals.doubleGoal(0)).toBe(false);
  });
});

describe('challenge: 5 more minutes', () => {
  it('only when nearly out of time and at least halfway, once', async () => {
    const goals = await import('../src/game/goals');
    S.goals = null; S.level = 5;
    const t0 = Date.now();
    goals.goalsTick(t0);
    const c = S.goals!.list[2];
    const late = c.until - 60_000;
    expect(goals.canExtend(late)).toBe(false); // not halfway yet
    c.have = Math.ceil(c.n / 2);
    expect(goals.canExtend(t0)).toBe(false); // plenty of time left
    S.gems = 5;
    const end = c.until;
    expect(goals.extendChallenge('gems', late)).toBe(true);
    expect(c.until).toBe(end + goals.EXTEND_MS);
    expect(S.gems).toBe(5 - goals.EXTEND_GEMS);
    expect(goals.canExtend(c.until - 60_000)).toBe(false);
  });
});

describe('rush levels', () => {
  it('every 5th level times the main targets; a missed one restarts', async () => {
    const goals = await import('../src/game/goals');
    S.goals = null; S.level = 4;
    const t0 = Date.now();
    goals.goalsTick(t0);
    expect(S.goals!.list[0].until).toBe(0);
    S.level = 10;
    goals.goalsTick(t0);
    const g = S.goals!.list[0];
    expect(g.until).toBe(t0 + 20 * 60_000);
    g.have = 2;
    goals.goalsTick(g.until + 1);
    expect(g.state).toBe('failed');
    expect(goals.restartTarget(0, 'wait', g.until + 2)).toBe(false);
    goals.goalsTick(g.retryAt! + 1);
    expect(g.state).toBe('open');
    expect(g.have).toBe(0);
  });
});

describe('building upgrades', () => {
  it('cost coins, diamonds and mats, unlock by level, and pay their perks', async () => {
    const b = await import('../src/game/buildings');
    const eco = await import('../src/game/economy');
    const an = await import('../src/game/animals');
    expect(b.upgradeBuilding('barn')).toEqual({ ok: false, reason: 'locked', lvl: 6 });
    S.level = 12; S.coins = 100_000; S.gems = 0;
    const before = eco.unitPrice('egg');
    expect(b.upgradeBuilding('barn')).toEqual({ ok: true, lvl: 1 });
    expect(S.coins).toBe(97_000);
    expect(eco.unitPrice('egg')).toBeGreaterThanOrEqual(before);
    expect(b.upgradeBuilding('barn')).toMatchObject({ ok: false, reason: 'gems' });
    S.gems = 50;
    expect(b.upgradeBuilding('barn')).toMatchObject({ ok: false, reason: 'mats' });
    S.inv.plank = 20; S.inv.brick = 10;
    expect(b.upgradeBuilding('barn')).toEqual({ ok: true, lvl: 2 });
    expect(S.inv.plank).toBe(0);
    expect(S.gems).toBe(40);
    expect(eco.barnPay()).toBeCloseTo(1.1);
    const slow = an.animalTime('cow');
    S.build.pens = 2;
    expect(an.animalTime('cow')).toBeCloseTo(slow * 0.85 * 0.85);
    // saves keep the levels, clamped
    expect(migrate(JSON.parse(JSON.stringify({ ...S, build: { barn: 9, pens: 2 } }))).build).toEqual({ barn: 3, pens: 2, house: 0 });
  });
});

describe('orchard and crystal cave', () => {
  it('open by level, give apples and crystals, then regrow', async () => {
    const a = await import('../src/game/areas');
    expect(a.pickApples(0, t)).toBe('locked');
    S.level = 27;
    expect(a.pickApples(0, t, () => 0.9)).toBe('done');
    expect(inv('apple')).toBe(3);
    expect(a.pickApples(0, t + 1000)).toBe('growing');
    expect(a.pickApples(0, t + a.APPLE_REGROW_MS)).toBe('done');
    for (let k = 1; k < a.CAVE_HITS; k++) expect(a.mineCrystal(0, t, () => 0)).toBe('hit');
    const gems = S.gems;
    expect(a.mineCrystal(0, t, () => 0)).toBe('done');
    expect(inv('crystal')).toBe(1);
    expect(inv('stone')).toBe(4);
    expect(S.gems).toBe(gems + 1);
    expect(a.mineCrystal(0, t + 1000)).toBe('growing');
  });
});
