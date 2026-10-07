import { hands } from '../game/economy';
import { on } from '../game/events';
import { $ } from './format';
import {
  prefs, setMusic, setSfx, thunder, sfxBell, sfxCatch, sfxChop, sfxClink, sfxTimber, sfxCluck, sfxGem, sfxHarvest, sfxLevelUp, sfxMoo, sfxPlant, sfxSplash, sfxThud,
} from './sound';

/** Game events → sound effects, and the sound settings pop-up. Staff work stays quiet so a busy farm isn't noisy. */
export function bindSfx() {
  on('plant', () => { if (!hands.staff) sfxPlant(); });
  // Sound travels slower than light: the closer the strike, the sooner the thunder.
  on('lightning', ({ near }) => {
    setTimeout(() => thunder(near), 250 + (1 - near) * 2200);
    const el = document.createElement('div');
    el.className = 'skyflash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  });
  on('harvest', () => { if (!hands.staff) sfxHarvest(); });
  on('machineDone', () => sfxBell());
  on('animalCollect', ({ kind }) => { if (!hands.staff) (kind === 'cow' ? sfxMoo : sfxCluck)(); });
  on('fishBite', () => sfxSplash());
  on('fishCaught', ({ byPlayer }) => { if (byPlayer) sfxCatch(); });
  on('levelUp', () => sfxLevelUp());
  on('farmUpgrade', () => sfxLevelUp());
  on('gems', () => sfxGem());
  on('cropRotted', () => sfxThud());
  on('treeChop', () => { if (!hands.staff) sfxChop(); });
  on('treeFelled', () => { if (!hands.staff) sfxTimber(); });
  on('saplingPlanted', () => { if (!hands.staff) sfxPlant(); });
  on('rockHit', () => { if (!hands.staff) sfxClink(); });
  on('rockBroken', () => { if (!hands.staff) { sfxClink(); sfxThud(); } });

  const box = $('soundBox');
  const sync = () => {
    ($('musicOn') as HTMLInputElement).checked = prefs.music;
    ($('sfxOn') as HTMLInputElement).checked = prefs.sfx;
    $('soundBtn').textContent = prefs.music || prefs.sfx ? '🔊' : '🔇';
  };
  sync();
  $('soundBtn').addEventListener('click', e => { e.stopPropagation(); box.hidden = !box.hidden; });
  $('musicOn').addEventListener('change', e => { setMusic((e.target as HTMLInputElement).checked); sync(); });
  $('sfxOn').addEventListener('change', e => { setSfx((e.target as HTMLInputElement).checked); sync(); });
  document.addEventListener('pointerdown', e => { if (!box.hidden && !box.contains(e.target as Node) && e.target !== $('soundBtn')) box.hidden = true; });
}
