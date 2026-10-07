// The store's contact address, shown on every info page. Change it here only.
var CONTACT_EMAIL = '';
document.querySelectorAll('[data-email]').forEach(function (el) {
  if (CONTACT_EMAIL) { el.innerHTML = '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>'; }
});
