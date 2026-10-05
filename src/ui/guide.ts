import { charImg, iconHTML, uiImg } from './art';
import { $ } from './format';

const SEEN_KEY = 'harvest-lane-guide';

/** One page per part of the game, in the order a new player meets them. */
const PAGES: { pic: string; title: string; body: string }[] = [
  { pic: iconHTML('wheat'), title: 'Plant and harvest',
    body: 'Pick a seed in the bar at the bottom, then tap empty soil to plant it. When the crop is ripe, tap it to harvest. Everything you pick goes into your <b>Barn</b>. Don\'t leave ripe crops too long: after about 8 minutes they rot and give nothing.' },
  { pic: uiImg('book'), title: 'Fill orders',
    body: 'Open <b>Orders</b> to see what people want. Deliver the crops to earn coins and XP. Don\'t like an order? Tap <b>Skip</b> for a new one.' },
  { pic: '<span class="g-emoji">🚚</span>', title: 'Truck buyers',
    body: 'Trucks are your best customers and come every few minutes. The 🚚 pill at the top shows when the next truck comes and what it wants, so you can grow it in time. When the truck parks, tap it to load. Load it fast for a <b>tip</b>. If you\'re too late the driver leaves angry and your ★ stars drop. More stars means trucks pay more.' },
  { pic: uiImg('cow'), title: 'Animals',
    body: '🐔 Hens eat wheat and lay 🥚 eggs. 🐄 Cows eat corn and give 🥛 milk. 🐖 Pigs eat carrots and dig up 🍄 truffles. 🐑 Sheep eat corn and grow 🧶 wool. Tap an animal to feed it, and tap again when its product is ready. Or use <b>Feed and collect all</b> in the Animals tab. Buy more animals at the market in town. An animal left hungry for 30 minutes falls sick and stops producing until the <b>Vet Clinic</b> in town treats it.' },
  { pic: '<span class="g-emoji">🎣</span>', title: 'Fishing',
    body: 'Tap the river, or the 🎣 button, and your farmer walks down to the dock and casts. Watch the bobber. When it splashes and says <b>Tap now!</b>, tap quickly to reel in a 🐟 fish, a 🦀 crab, or if you\'re lucky a rare 🐠 golden fish. Tap too early and it swims away.' },
  { pic: uiImg('hammer'), title: 'Machines',
    body: 'Build a Bakery, Popcorn Pot, Juicer and more in <b>Machines</b>. They turn crops into goods that sell for much more than raw crops.' },
  { pic: charImg('girl-head'), title: 'Helpers',
    body: 'From level 2 you can hire <b>farmhands</b> who harvest and replant on their own. From level 3, <b>market sellers</b> sell your goods at the road cart while you farm.' },
  { pic: uiImg('nav-map'), title: 'Market Town',
    body: 'Tap <b>Town</b> in the bar at the bottom, or the signpost by the road, to drive to Market Town. Buy new animals and bigger pens at the <b>Animal Market</b>, and fertilizer for faster crops at the <b>General Store</b>. From level 8 you can buy <b>your own shop</b> and hire a shopkeeper to sell your goods for more. Your farm keeps working while you\'re in town.' },
  { pic: uiImg('star'), title: 'Grow your farm',
    body: 'Everything you do with your own hands earns XP (helpers earn coins, not XP). Selling lots of the same thing floods the market and its price drops for a while, so sell a mix. Each new level pays bonus coins and unlocks seeds, machines and animals. Buy more land with <b>New plot</b>.<br><br>Tips: drag to look around, and use + and − to zoom. Tap ? any time to read this again.' },
];

let box: HTMLElement | null = null;
let page = 0;

function draw() {
  if (!box) return;
  const p = PAGES[page], last = page === PAGES.length - 1;
  box.querySelector('.g-page')!.innerHTML = `
    <div class="g-pic">${p.pic}</div>
    <h3>${p.title}</h3>
    <p>${p.body}</p>`;
  box.querySelector('.g-dots')!.innerHTML = PAGES.map((_, i) => `<i class="${i === page ? 'on' : ''}" data-g="${i}"></i>`).join('');
  (box.querySelector('.g-back') as HTMLButtonElement).disabled = page === 0;
  box.querySelector('.g-next')!.textContent = last ? 'Let\'s farm!' : 'Next';
}

function close() {
  if (!box) return;
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ }
  const b = box; box = null;
  b.classList.add('out');
  setTimeout(() => b.remove(), 300);
}

export function openGuide(start = 0) {
  if (box) return;
  page = start;
  box = document.createElement('section');
  box.className = 'guide';
  box.innerHTML = `
    <div class="g-card board" role="dialog" aria-label="How to play">
      <h2 class="plank-title">How to play</h2>
      <button class="close" aria-label="Close">×</button>
      <div class="g-host">${charImg('oldfarmer')}<p class="lu-say">Howdy! Here's how the farm works.</p></div>
      <div class="g-page"></div>
      <div class="g-dots"></div>
      <div class="g-nav"><button class="btn alt g-back">Back</button><button class="btn gold g-next">Next</button></div>
    </div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => {
    const el = e.target as HTMLElement;
    if (el === box || el.closest('.close')) { close(); return; }
    if (el.closest('.g-back') && page > 0) { page--; draw(); }
    else if (el.closest('.g-next')) { if (page === PAGES.length - 1) close(); else { page++; draw(); } }
    else if (el.dataset.g) { page = +el.dataset.g; draw(); }
  });
  draw();
}

/** The ? button opens the guide; brand-new farmers see it once on their first visit. */
export function bindGuide(isNewFarm: boolean) {
  $('help').addEventListener('click', () => openGuide());
  let seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch { /* storage blocked */ }
  if (!seen && isNewFarm) setTimeout(() => openGuide(), 1200);
}
