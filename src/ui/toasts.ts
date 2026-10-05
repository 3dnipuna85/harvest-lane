import { $ } from './format';

/** Floating text that rises and fades at a page position. */
export function fx(x: number, y: number, text: string, cls = '') {
  const e = document.createElement('div');
  e.className = 'fx ' + cls;
  e.textContent = text;
  e.style.left = x + 'px';
  e.style.top = y + 'px';
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 950);
}

export function toast(msg: string, cls: '' | 'lv' = '') {
  const box = $('toasts'), e = document.createElement('div');
  e.className = 'toast ' + cls;
  e.textContent = msg;
  box.appendChild(e);
  while (box.children.length > 3) box.firstChild!.remove();
  setTimeout(() => e.remove(), cls === 'lv' ? 3800 : 2200);
}

export function shakeScene() {
  const w = $('sceneWrap');
  w.classList.remove('shake');
  void w.offsetWidth;
  w.classList.add('shake');
}
