(() => {
  'use strict';

  const base = new URL('../', document.currentScript.src);
  const brand = typeof gameName === 'string' ? gameName : 'BALÍČEK';
  const currentFloor = document.querySelector('main').dataset.floor;
  const toggle = document.getElementById('balik-menu-toggle');
  const reset = document.getElementById('reset');
  const floors = [
    ['B2', 'Garáže', 'b2/'],
    ['B1', 'Strojovna', ''],
    ['0', 'Recepce (test)', 'recepce-test/']
  ];

  const dialog = document.createElement('dialog');
  dialog.id = 'balik-menu';
  dialog.setAttribute('aria-labelledby', 'balik-menu-title');
  dialog.innerHTML = `
    <h2 id="balik-menu-title">${brand}</h2>
    <button type="button" data-continue>Pokračovat ve hře</button>
    <button type="button" data-reset>Restartovat patro</button>
    <fieldset class="sound-settings"><legend>Zvuk</legend></fieldset>
    <small>Testovací režim · patra bez zámků</small>
    <div data-floors></div>
    <a data-home>Hlavní obrazovka</a>
  `;

  dialog.querySelector('[data-home]').href = new URL('home.html', base);
  const floorLinks = dialog.querySelector('[data-floors]');
  for (const [id, name, path] of floors) {
    const link = document.createElement('a');
    link.href = new URL(path, base);
    link.textContent = id + ' · ' + name;
    if (id === currentFloor) link.setAttribute('aria-current', 'page');
    floorLinks.append(link);
  }
  try { localStorage.setItem('balik.lastFloor', currentFloor); } catch {}

  document.body.append(dialog);
  balikSound.mountSettings(dialog.querySelector('.sound-settings'));
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-continue]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-reset]').addEventListener('click', () => {
    dialog.close();
    reset.click();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => toggle.focus({preventScroll: true}));
})();
