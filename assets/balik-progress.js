'use strict';

const balikProgress = (() => {
  const base = new URL('../', document.currentScript.src);
  const key = 'balik.progress.v1';
  const floors = [
    {id: 'B2', name: 'Garáže', path: 'b2/'},
    {id: 'B1', name: 'Strojovna', path: 'b1/'},
    {id: '0', name: 'Recepce', path: 'recepce/'},
    {id: '1', name: 'Kuchyně', path: 'kuchyne/'},
    {id: '2', name: 'Restaurace'}
  ];
  const indexOf = id => floors.findIndex(floor => floor.id === id);

  function read(store) {
    try {
      const saved = JSON.parse(window[store].getItem(key));
      if (typeof saved?.run === 'string' &&
          Number.isInteger(saved.highest) && saved.highest >= 0 && saved.highest < floors.length &&
          Number.isInteger(saved.last) && saved.last >= 0 && saved.last <= saved.highest && floors[saved.last].path &&
          typeof saved.hasButton === 'boolean') return saved;
    } catch {}
    return null;
  }

  const load = () => read('sessionStorage') ?? read('localStorage');

  function save(progress) {
    const data = JSON.stringify(progress);
    try {
      localStorage.setItem(key, data);
      try { sessionStorage.removeItem(key); } catch {}
      return true;
    } catch {
      try {
        sessionStorage.setItem(key, data);
        return true;
      } catch {
        return false;
      }
    }
  }

  const room = document.documentElement.dataset.balikFloor;
  const roomIndex = indexOf(room);
  const run = load()?.run;
  const home = base.href;

  function canEnter(progress, index) {
    return Boolean(progress && floors[index]?.path && index <= progress.highest);
  }

  function enter() {
    const progress = load();
    if (!canEnter(progress, roomIndex)) {
      document.documentElement.style.visibility = 'hidden';
      location.replace(home);
      return;
    }
    if (progress.run !== run) {
      location.reload();
      return;
    }
    if (progress.last !== roomIndex) save({...progress, last: roomIndex});
  }

  if (room) {
    enter();
    window.addEventListener('pageshow', event => {
      if (event.persisted) enter();
    });
    window.addEventListener('storage', event => {
      if ((event.key === key || event.key === null) && load()?.run !== run) enter();
    });
  }

  function checkpoint(id) {
    const progress = load();
    const index = indexOf(id);
    if (!canEnter(progress, index)) return 'locked';
    if (index < progress.highest) return 'installed';
    return progress.hasButton ? 'carrying' : 'playing';
  }

  return {
    home,
    floors,
    load,
    checkpoint,
    floorUrl: id => new URL(floors[indexOf(id)].path, base).href,
    canVisit: id => canEnter(load(), indexOf(id)),
    isUnlocked(id) {
      const index = indexOf(id);
      return index >= 0 && index <= (load()?.highest ?? -1);
    },
    start() {
      return save({run: crypto.randomUUID(), highest: 0, last: 0, hasButton: false});
    },
    collect(id) {
      const progress = load();
      if (progress?.run !== run || indexOf(id) !== progress?.highest) return;
      save({...progress, hasButton: true});
    },
    install(id, destination) {
      const progress = load();
      const index = indexOf(id);
      if (progress?.run !== run || !progress?.hasButton ||
          index !== progress.highest || indexOf(destination) !== index + 1) return false;
      return save({...progress, highest: index + 1, hasButton: false});
    }
  };
})();
