import { MACHINES, type MachineId } from '../data/machines';
import { capped } from '../game/estate';
import { HILL_LVL, QUARRY_LVL, RIDGE_LVL, WOODS_LVL } from '../game/resources';
import { save, S, visiting } from '../game/state';
import { SHOP_LVL } from '../game/town';
import { focusOn } from '../scene/camera';
import { inTown } from '../scene/mode';
import { charImg, uiImg } from './art';
import { coinHTML, fmt } from './format';

/**
 * "What to do now" windows: when something new opens up, a farmer explains exactly what to do next, step by
 * step, with a goal to aim for. Each one shows once per farm (S.tips).
 */
interface Tip { id: string; when: () => boolean; title: string; art: string; steps: string[]; goal: string; look?: [number, number] }

const machineTip = (id: MachineId, steps: string[], goal: string): Tip => ({
  id, when: () => S.level >= MACHINES[id].lvl, title: `New workshop: ${MACHINES[id].name}`, art: uiImg('hammer'),
  steps: [`Build the ${MACHINES[id].name} in the Machines tab for ${coinHTML}${fmt(MACHINES[id].cost)}.`, ...steps], goal,
});

const TIPS: Tip[] = [
  machineTip('bakery', ['Feed it 3 wheat and it bakes bread on its own.', 'From level 3, buyers start asking for bread, and they pay much more for it than for wheat.'], 'Goal: bake 5 bread.'),
  {
    id: 'shop', when: () => S.level >= SHOP_LVL, title: 'Your own shop in town', art: '🏪',
    steps: ['Drive to Market Town with the Town button.', 'Buy the empty shop, then hire a shopkeeper.', 'The shopkeeper sells your goods for 50% more, and sometimes finds a 💎 diamond in the till.'],
    goal: 'Goal: save up for the shop and open it.',
  },
  {
    id: 'cap', when: () => capped(), title: 'Your farm needs an upgrade', art: uiImg('nav-build'),
    steps: ['Your level is at the top for this kind of farm.', 'Tap your level badge or 💎 to open Farm Upgrades.', 'Upgrades cost coins, diamonds and building materials like planks and bricks.'],
    goal: 'Goal: collect everything on the upgrade card.',
  },
  {
    id: 'woods', when: () => S.level >= WOODS_LVL, title: 'The Woods are open! 🌲', art: uiImg('log'), look: [-9.4, -13],
    steps: ['Drag the view up past the barn to the forest behind the fence.', 'Tap a tree 3 times to chop it down for logs. Then tap the stump to plant a sapling: a new tree grows in 4 minutes.', `Build a Sawmill to turn 2 logs into planks. Farm upgrades need planks!`, 'Tired arms? Hire a Lumberjack in Helpers to chop for you.'],
    goal: 'Goal: chop 10 logs and make your first planks.',
  },
  {
    id: 'quarry', when: () => S.level >= QUARRY_LVL, title: 'The Quarry is open! ⛏️', art: uiImg('stone'), look: [11.3, -13],
    steps: ['The Quarry is behind the fence on the right, past the workshops.', 'Tap a rock 4 times to break it for stone. New rocks are dug out in 5 minutes.', 'Build a Stonecutter to turn stone into bricks for farm upgrades.', 'Tired arms? Hire a Quarry worker in Helpers to dig for you.'],
    goal: 'Goal: mine 10 stone and make 5 bricks.',
  },
  {
    id: 'ridge', when: () => S.level >= RIDGE_LVL, title: 'You found Pine Ridge! 🌲', art: uiImg('log'), look: [-18.3, -13.5],
    steps: ['A new forest, past the Woods on the far left.', 'Six more trees to chop, and saplings to plant on the stumps.', 'More trees means more logs and planks for your farm upgrades.'],
    goal: 'Goal: chop a tree on Pine Ridge.',
  },
  {
    id: 'hill', when: () => S.level >= HILL_LVL, title: 'You found Hill Quarry! ⛏️', art: uiImg('stone'), look: [18, -13.4],
    steps: ['A new stone pit, past the Quarry on the far right.', 'Hill rocks are tough (5 hits) but give more stone.', 'Miners say there are diamonds in these hills… 💎'],
    goal: 'Goal: break a rock on Hill Quarry.',
  },
  machineTip('dairy', ['It turns 3 milk into a wheel of cheese.', 'Keep your cows fed: no milk, no cheese!', 'The Estate upgrade needs 10 cheese.'], 'Goal: make 3 cheese.'),
  machineTip('apiary', ['The bees turn 3 strawberries into a jar of honey.', 'Honey is the most valuable thing on the farm.', 'The Grand Estate upgrade needs 20 honey.'], 'Goal: fill 5 jars of honey.'),
];

let box: HTMLElement | null = null;
/** Give the player a breather between tips. */
let quietUntil = 0;

function show(t: Tip) {
  box = document.createElement('section');
  box.className = 'levelup tipsbox';
  const art = t.art.startsWith('<') ? t.art : `<span class="tip-emoji">${t.art}</span>`;
  box.innerHTML = `<div class="lu-card-main board tip-card">
      <h2 class="plank-title">What to do now</h2>
      <div class="tip-head">${art}<b>${t.title}</b></div>
      <ol class="tip-steps">${t.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <div class="tip-goal">${charImg('oldfarmer', 'face')}<span>${t.goal}</span></div>
      <div class="row tip-btns">${t.look ? '<button class="btn alt tip-look">Show me</button>' : ''}<button class="btn gold tip-ok">Got it!</button></div>
    </div>`;
  document.body.appendChild(box);
  const close = () => { const b = box!; b.classList.add('out'); box = null; quietUntil = Date.now() + 30_000; setTimeout(() => b.remove(), 300); };
  box.querySelector('.tip-ok')!.addEventListener('click', close, { once: true });
  box.querySelector('.tip-look')?.addEventListener('click', () => { close(); focusOn(t.look![0], t.look![1]); }, { once: true });
  S.tips.push(t.id);
  save();
}

/** Check now and then for a new tip, waiting until no other pop-up is open. */
export function bindTips() {
  setInterval(() => {
    if (box || Date.now() < quietUntil || visiting || inTown() || document.querySelector('.levelup, .guide')) return;
    const t = TIPS.find(x => !S.tips.includes(x.id) && x.when());
    if (t) show(t);
  }, 2500);
}
