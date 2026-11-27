(() => {
  'use strict';

  const brand = typeof gameName === 'string' ? gameName : 'BALÍČEK';
  const currentFloor = document.documentElement.dataset.balikFloor;
  const home = balikProgress.home;

  function makePanel(id, title, content, actionLabel = 'Zavřít') {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = 'hotel-menu';
    dialog.setAttribute('aria-labelledby', id + '-title');
    dialog.innerHTML = `
      <header class="hotel-menu-header">
        <h2 id="${id}-title">${title}</h2>
        <button type="button" class="hotel-menu-close" aria-label="${actionLabel}" data-close>×</button>
      </header>
      <div class="hotel-menu-content">${content}</div>
    `;
    dialog.querySelectorAll('[data-close]').forEach(button => {
      button.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    document.body.append(dialog);
    return dialog;
  }

  function opener(button, dialog, beforeOpen) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => {
      beforeOpen?.();
      dialog.showModal();
    });
    dialog.addEventListener('close', () => button.focus({preventScroll: true}));
  }

  function renderFloors(list, start) {
    const progress = balikProgress.load();
    const lastFloor = balikProgress.floors[progress?.last]?.id;
    list.replaceChildren();
    for (const {id, name, path} of balikProgress.floors) {
      const available = balikProgress.canVisit(id);
      const startsGame = !progress && id === 'B2';
      const entry = document.createElement('li');
      const control = document.createElement(startsGame ? 'button' : available && id !== currentFloor ? 'a' : 'div');
      control.className = 'hotel-floor';
      const badge = document.createElement('span');
      badge.className = 'hotel-floor-badge';
      badge.textContent = id;
      const label = document.createElement('span');
      label.textContent = name;
      const status = document.createElement('small');
      control.append(badge, label, status);
      if (id === currentFloor) {
        control.setAttribute('aria-current', 'page');
        status.textContent = 'Tady jsi';
      } else if (available) {
        control.href = balikProgress.floorUrl(id);
        status.textContent = !currentFloor && id === lastFloor ? 'Naposledy' : '›';
      } else if (startsGame) {
        control.type = 'button';
        control.addEventListener('click', start);
        status.textContent = 'Začít';
      } else {
        control.classList.add('hotel-floor-locked');
        status.textContent = !path && balikProgress.isUnlocked(id) ? 'Připravuje se' : 'Zamčeno';
      }
      entry.append(control);
      list.append(entry);
    }
  }

  function mountSound(dialog) {
    balikSound.mountSettings(dialog.querySelector('.sound-settings'));
  }

  if (currentFloor) {
    const level = balikProgress.floors.find(({id}) => id === currentFloor);
    const menu = makePanel('balik-menu', 'Nabídka hry', `
      <div class="hotel-menu-brand">
        <span class="game-brand game-brand--floor">
          <img class="game-brand-parcel" src="${new URL('assets/brand-parcel.png', home)}" width="120" height="101" alt="">
          <span class="game-brand-name">${brand}</span>
        </span>
        <span class="hotel-menu-level">${level.id} · ${level.name}</span>
      </div>
      <button type="button" class="hotel-action hotel-primary" data-close autofocus>Pokračovat ve hře</button>
      <div class="hotel-menu-actions">
        <button type="button" class="hotel-action" data-reset>Restartovat patro</button>
        <a class="hotel-action" href="${home}">Hlavní obrazovka</a>
      </div>
      <fieldset class="sound-settings"><legend>Zvuk</legend></fieldset>
      <h3>Patra hotelu</h3>
      <ul class="hotel-floor-list" data-floors></ul>
    `, 'Zavřít nabídku hry');
    mountSound(menu);
    opener(document.getElementById('balik-menu-toggle'), menu, () => renderFloors(menu.querySelector('[data-floors]')));
    menu.querySelector('[data-reset]').addEventListener('click', () => {
      menu.close();
      document.getElementById('reset').click();
    });
    return;
  }

  const newGame = document.getElementById('new');
  const resume = document.getElementById('resume');
  const message = document.getElementById('home-status');
  const floorlist = makePanel('floorlist', 'Výběr patra', '<ul class="hotel-floor-list"></ul>');
  const settings = makePanel('prefs', 'Nastavení', '<fieldset class="sound-settings"><legend>Zvuk</legend></fieldset>');
  const confirm = makePanel('new-game', 'Začít novou hru?', `
    <p>Uložený postup se přepíše a začneš znovu v garážích.</p>
    <div class="hotel-menu-actions">
      <button type="button" class="hotel-action" data-close autofocus>Zpět</button>
      <button type="button" class="hotel-action hotel-primary" data-start>Začít znovu</button>
    </div>
  `);
  mountSound(settings);

  function start() {
    if (balikProgress.start()) {
      location.assign(balikProgress.floorUrl('B2'));
      return;
    }
    floorlist.close();
    confirm.close();
    message.textContent = 'Prohlížeč nepovoluje uložit postup. Povol úložiště a zkus to znovu.';
  }

  function showResume() {
    resume.disabled = !balikProgress.load();
  }
  showResume();
  window.addEventListener('pageshow', showResume);
  window.addEventListener('storage', showResume);
  newGame.addEventListener('click', () => {
    const progress = balikProgress.load();
    if (progress && (progress.highest > 0 || progress.hasButton)) confirm.showModal();
    else start();
  });
  newGame.setAttribute('aria-haspopup', 'dialog');
  confirm.addEventListener('close', () => newGame.focus({preventScroll: true}));
  confirm.querySelector('[data-start]').addEventListener('click', start);
  resume.addEventListener('click', () => {
    const floor = balikProgress.floors[balikProgress.load()?.last];
    if (floor) location.assign(balikProgress.floorUrl(floor.id));
  });
  opener(document.getElementById('floors'), floorlist, () => renderFloors(floorlist.querySelector('ul'), start));
  opener(document.getElementById('settings'), settings);
})();
