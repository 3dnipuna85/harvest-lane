export const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  : Math.floor(n).toLocaleString();

export const coinHTML = '<span class="coin-dot"></span>';
export const $ = (id: string) => document.getElementById(id)!;
