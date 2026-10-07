import { CROPS, CROP_IDS } from '../data/crops';
import { MACHINES, MACHINE_IDS } from '../data/machines';
import { earn } from '../game/economy';
import { charImg, iconHTML, uiImg } from './art';
import { $, coinHTML, fmt } from './format';
import { adsLeft, useAdView } from '../game/ads';
import { adsAvailable, showInterstitial, watchFor } from './ads';
import { toast } from './toasts';

/** Coins handed out with each level: grows with the level reached. */
export const levelBonus = (level: number) => 25 * level;

const queue: number[] = [];
let box: HTMLElement | null = null;

function unlocks(level: number) {
  const out: string[] = [];
  for (const k of CROP_IDS) if (CROPS[k].lvl === level) out.push(`<div class="lu-card">${iconHTML(k)}<b>${CROPS[k].name}</b><span>New seed</span></div>`);
  for (const k of MACHINE_IDS) if (MACHINES[k].lvl === level) out.push(`<div class="lu-card">${iconHTML(MACHINES[k].out)}<b>${MACHINES[k].name}</b><span>New building</span></div>`);
  if (level === 2) out.push(`<div class="lu-card">${charImg('girl-head')}<b>Farmhands</b><span>Hire helpers</span></div>`);
  if (level === 3) out.push(`<div class="lu-card">${charImg('baker')}<b>Market sellers</b><span>Sell at the cart</span></div>`);
  out.push(`<div class="lu-card">${uiImg('gem')}<b>1 diamond</b><span>For farm upgrades</span></div>`);
  return out;
}

/** Coins that burst out of the popup and fly into the coin counter. */
function coinShower(from: DOMRect, n: number) {
  const to = $('coinPill').getBoundingClientRect();
  const tx = to.left + 20, ty = to.top + to.height / 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'lu-coin';
    c.innerHTML = coinHTML;
    const sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 90;
    c.style.left = sx + 'px'; c.style.top = sy + 'px';
    document.body.appendChild(c);
    c.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1.2)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(.6)`, opacity: 1 },
    ], { duration: 900 + Math.random() * 300, delay: i * 35, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).onfinish = () => c.remove();
  }
}

function confetti(host: HTMLElement) {
  const cols = ['#f2c94c', '#e2463a', '#6cc04a', '#4fa3e0', '#ff8fbf', '#ffffff'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.className = 'lu-conf';
    p.style.background = cols[i % cols.length];
    p.style.left = 50 + (Math.random() - 0.5) * 20 + '%';
    host.appendChild(p);
    const dx = (Math.random() - 0.5) * 900, dy = 300 + Math.random() * 500;
    p.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${-200 - Math.random() * 200}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
    ], { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
  }
}

function show(level: number) {
  const bonus = levelBonus(level), cards = unlocks(level);
  box = document.createElement('section');
  box.className = 'levelup';
  box.innerHTML = `
    <div class="lu-rays"></div>
    <div class="lu-card-main board">
      <h2 class="plank-title">Level up!</h2>
      <div class="lu-star">${uiImg('star', 'lu-star-img')}<b>${level}</b></div>
      <div class="lu-hero">${charImg('oldfarmer')}<p class="lu-say">Great work, farmer!</p></div>
      ${cards.length ? `<div class="lu-unlocks"><p>Unlocked</p><div class="lu-row">${cards.join('')}</div></div>` : ''}
      <div class="lu-bonus">${coinHTML}<b>+${fmt(bonus)}</b> level bonus</div>
      <div class="lu-btns">${adsAvailable() && adsLeft() > 0 ? '<button class="btn alt lu-x2">📺 Collect ×2</button>' : ''}<button class="btn gold lu-go">Collect</button></div>
    </div>`;
  document.body.appendChild(box);
  confetti(box);
  box.querySelectorAll<HTMLElement>('.lu-card').forEach((c, i) => { c.style.animationDelay = 0.55 + i * 0.15 + 's'; });
  const go = box.querySelector<HTMLButtonElement>('.lu-go')!;
  go.focus({ preventScroll: true });
  let paid = bonus;
  // Optional: watch an ad to double the level bonus.
  box.querySelector<HTMLButtonElement>('.lu-x2')?.addEventListener('click', ev => {
    const b = ev.currentTarget as HTMLButtonElement;
    watchFor('level-bonus', () => useAdView(), `Level bonus doubled: +${fmt(bonus * 2)} coins!`, toast).then(ok => {
      if (!ok) return;
      paid = bonus * 2;
      b.remove();
      go.click();
    });
  });
  go.addEventListener('click', () => {
    coinShower(box!.querySelector('.lu-bonus')!.getBoundingClientRect(), paid > bonus ? 28 : 16);
    setTimeout(() => earn(paid), 900);
    box!.classList.add('out');
    const b = box!;
    box = null;
    // A short ad break after the last level-up in a row (if ads are on; ui/ads.ts limits how often).
    setTimeout(() => { b.remove(); if (queue.length) show(queue.shift()!); else setTimeout(() => showInterstitial('level-up'), 1200); }, 350);
  }, { once: true });
}

/** Celebrate a new level. Several level-ups in a row queue up one after another. */
export function celebrateLevel(level: number) {
  if (box) queue.push(level);
  else show(level);
}
