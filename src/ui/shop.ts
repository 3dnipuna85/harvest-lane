import { PACKS } from '../data/store';
import { now } from '../game/clock';
import { save, S } from '../game/state';
import { BAGS, bagCoins, buyBag, buyXpBoost, canBuyPack, grantPack, running, rushMachines, RUSH_GEMS, testShop, XP_BOOST_GEMS, XP_BOOST_MIN, xpBoosted, type SpendResult } from '../game/store';
import { uiImg } from './art';
import { adCoins, adsLeft, adUseful, AD_GEMS, grantAd, growing, type AdReward } from '../game/ads';
import { adsAvailable, showRewarded } from './ads';
import { checkoutUrl, claimSoon, markCheckout, packLink, testPay } from './payments';
import { gemHTML } from './estate';
import { coinHTML, fmt } from './format';
import { hms } from './staff';
import { shakeScene, toast } from './toasts';

/** The Diamond Shop panel: spend diamonds on coins and boosts, and (once payments are connected) buy diamond packs. */

const usd = (n: number) => '$' + n.toFixed(2);
/** The pack waiting for a second tap to confirm a test purchase. */
let armed = '';
let armTimer = 0;
/** An ad is playing. */
let adBusy = false;

export function shopPanel() {
  const test = testShop(), t = now();
  claimSoon();
  const bags = BAGS.map((b, i) => `<div class="card shopitem"><div class="big">${uiImg('coin')}</div><div class="grow"><div class="ttl">${b.name}</div>
      <div class="sub">${coinHTML}<b>${fmt(bagCoins(i))}</b> coins</div></div>
      <button class="btn gold" data-act="bag" data-i="${i}">${gemHTML()}${b.gems}</button></div>`).join('');
  const boost = `<div class="card shopitem"><div class="big">${uiImg('star')}</div><div class="grow"><div class="ttl">Double XP · ${XP_BOOST_MIN} min</div>
      <div class="sub">${xpBoosted(t) ? `<b class="capnote">On now · ${hms(S.xpBoost - t)} left</b>` : 'Every XP you earn counts twice. Level up faster.'}</div></div>
      <button class="btn gold" data-act="xpboost">${xpBoosted(t) ? '+' : ''}${gemHTML()}${XP_BOOST_GEMS}</button></div>`;
  const rush = `<div class="card shopitem"><div class="big">⏩</div><div class="grow"><div class="ttl">Rush the workshops</div>
      <div class="sub">${running().length ? `Finish all ${running().length} running jobs right now.` : 'Nothing is cooking right now.'}</div></div>
      <button class="btn gold" data-act="rush" ${running().length ? '' : 'disabled'}>${gemHTML()}${RUSH_GEMS}</button></div>`;
  const packs = PACKS.map(p => {
    const owned = !canBuyPack(p.id), extras = [p.coins ? `${coinHTML}${fmt(p.coins)}` : '', p.xpMin ? `${p.xpMin} min Double XP` : ''].filter(Boolean).join(' + ');
    const btn = owned ? '<span class="small">Bought</span>'
      : test ? `<button class="btn ${armed === p.id ? 'red' : 'gold'}" data-act="pack" data-k="${p.id}">${armed === p.id ? 'Tap again (test, free)' : usd(p.usd)}</button>`
        : packLink(p) ? `<a class="btn gold" href="${checkoutUrl(p)}" target="_blank" rel="noopener" data-act="checkout">${usd(p.usd)}</a>`
      : `<button class="btn" disabled>${usd(p.usd)} · soon</button>`;
    return `<div class="card shopitem pack ${p.once ? 'starter' : ''}"><div class="big">${uiImg(p.coins ? 'gift' : 'gem')}</div><div class="grow">
      <div class="ttl">${p.name} ${p.tag ? `<span class="packtag">${p.tag}</span>` : ''}</div>
      <div class="sub">${gemHTML()}<b>${fmt(p.gems)}</b> diamonds${extras ? ' + ' + extras : ''}</div></div>${btn}</div>`;
  }).join('');
  const adRow = (r: AdReward, art: string, ttl: string, sub: string) => `<div class="card shopitem"><div class="big">${art}</div><div class="grow"><div class="ttl">${ttl}</div><div class="sub">${sub}</div></div>
      <button class="btn alt" data-act="ad" data-k="${r}" ${adsLeft(t) && adUseful(r, t) && !adBusy ? '' : 'disabled'}>📺 Watch</button></div>`;
  const ads = adsAvailable() ? `<div class="shophead">Free with an ad · ${adsLeft(t)} left today</div>
    ${adRow('gems', uiImg('gem'), `${AD_GEMS} diamonds`, 'Watch a short video ad.')}
    ${adRow('coins', uiImg('coin'), `${fmt(adCoins())} coins`, 'Watch a short video ad.')}
    ${adRow('rush', '⏩', 'Finish the workshops', running().length ? `All ${running().length} running jobs, done now.` : 'Nothing is cooking right now.')}
    ${adRow('grow', '🌱', 'Grow my crops now', growing(t) ? `${growing(t)} growing crops ripen at once.` : 'Nothing is growing right now.')}` : '';
  return `<div class="list">
    <div class="card gembank"><div class="big">${uiImg('gem')}</div><div class="grow"><div class="ttl">You have ${fmt(S.gems)} diamonds</div>
      <div class="sub">Earn them free: one every level-up, from fast truck loads, shop sales and the contract lorry.</div></div></div>
    ${ads}
    <div class="shophead">Spend diamonds</div>${boost}${rush}${bags}
    <div class="shophead">Get more diamonds</div>
    ${test ? '<div class="testnote">TEST MODE: purchases are free and nothing is charged. Turn it off with ?testshop=0</div>' : ''}
    ${packs}
    ${PACKS.some(p => packLink(p)) && !test ? '<div class="testnote paynote">Payments are handled by Lemon Squeezy in a new tab. Your diamonds arrive here a few seconds after paying. Not there? Keep this page open, or reopen this shop.</div>' : ''}
    <div class="townintro">Prices in US dollars. Everything in the game can be earned by playing; packs just get you there faster. <a href="/refunds" target="_blank">Refunds</a> · <a href="/terms" target="_blank">Terms</a> · <a href="/contact" target="_blank">Help</a>${testPay() ? ' <b>TEST PAYMENTS: use Lemon Squeezy test cards only. Turn off with ?testpay=0</b>' : ''}${test || PACKS.some(p => packLink(p)) ? '' : ' Real-money packs are coming soon.'}</div></div>`;
}

export const shopSignature = () => [S.gems, S.coins >= 0 && S.level, xpBoosted(), running().length, armed, adsLeft(), adBusy, adsAvailable(), growing() > 0, S.bought.join(','), Math.floor((S.xpBoost - now()) / 60000)].join('|');

function said(r: SpendResult, ok: string) {
  if (r.ok) { toast(ok); return; }
  if (r.reason === 'gems') toast(`You need ${r.need} more diamonds.`);
  shakeScene();
}

export function shopAction(a: string, k: string, i: number) {
  if (a === 'bag') { const c = bagCoins(i); said(buyBag(i), `+${fmt(c)} coins!`); }
  else if (a === 'xpboost') said(buyXpBoost(), `Double XP is on for ${hms(S.xpBoost - now())}.`);
  else if (a === 'rush') said(rushMachines(), 'The workshops finished everything. ⏩');
  else if (a === 'checkout') markCheckout();
  else if (a === 'ad') {
    if (adBusy) return true;
    adBusy = true;
    showRewarded(k).then(ok => {
      adBusy = false;
      if (ok === 'none') toast('No ad is available right now. Try again in a little while.');
      else if (!ok) toast('Watch the ad to the end to get the reward.');
      else if (grantAd(k as AdReward)) toast(k === 'gems' ? `+${AD_GEMS} diamonds! Thanks for watching.` : k === 'coins' ? 'Coins added! Thanks for watching.' : k === 'rush' ? 'The workshops finished everything. ⏩' : 'Your crops are ripe! 🌱');
      save();
    });
  }
  else if (a === 'pack') {
    if (!testShop()) return true;
    clearTimeout(armTimer);
    if (armed !== k) { armed = k; armTimer = window.setTimeout(() => { armed = ''; }, 4000); return true; }
    armed = '';
    if (grantPack(k)) toast(`Test purchase: ${PACKS.find(p => p.id === k)!.name} added. No money was charged.`);
  } else return false;
  return true;
}

