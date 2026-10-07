// Fills in the live store details (support email, pack prices) that the owner sets on the admin page.
(function () {
  function money(n) { return Number(n).toFixed(2); }
  fetch('/api/settings').then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
    if (!s) return;
    if (s.supportEmail) {
      document.querySelectorAll('[data-email]').forEach(function (el) {
        var a = document.createElement('a');
        a.href = 'mailto:' + s.supportEmail; a.textContent = s.supportEmail;
        el.textContent = ''; el.appendChild(a);
      });
    }
    document.querySelectorAll('tr[data-pack]').forEach(function (tr) {
      var o = (s.packs || {})[tr.getAttribute('data-pack')] || {};
      if (o.off) { tr.remove(); return; }
      if (o.usd) tr.querySelector('.u').textContent = money(o.usd);
      if (o.gems) tr.querySelector('.g').textContent = Number(o.gems).toLocaleString('en-US');
    });
  }).catch(function () {});
})();
