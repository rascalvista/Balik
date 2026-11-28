(() => {
  'use strict';

  const capacity = 4;
  const originalLoads = 3;
  const loads = [
    [[2, 0, 1, 1], [2, 1, 0, 0], [0, 2, 2, 1], [], []],
    [[2, 1, 0, 3], [2, 2, 0, 2], [1, 3, 3, 3], [1, 0, 1, 0], [], []],
    [[0, 1, 2, 4], [4, 1, 2, 0], [2, 4, 1, 3], [1, 0, 3, 2], [3, 4, 3, 0], [], []],
    [[0, 0, 0, 4], [3, 2, 3, 4], [5, 2, 1, 1], [4, 5, 3, 1], [2, 1, 0, 5], [5, 2, 3, 4], [], []],
    [[4, 4, 3, 2], [5, 3, 1, 4], [5, 1, 5, 0], [3, 0, 2, 0], [0, 5, 2, 1], [1, 4, 2, 3], [], []],
    [[6, 5, 1, 3], [2, 0, 4, 4], [3, 2, 4, 5], [6, 5, 0, 4], [1, 2, 3, 0], [6, 1, 1, 3], [6, 5, 2, 0], [], []],
    [[0, 1, 0, 3], [5, 4, 2, 5], [1, 2, 7, 4], [5, 7, 2, 0], [6, 3, 4, 0], [7, 3, 2, 6], [4, 7, 5, 1], [1, 6, 6, 3], [], []]
  ];
  const towels = [
    {name: 'červená', mark: '◆'},
    {name: 'tyrkysová', mark: '●'},
    {name: 'zlatá', mark: '═'},
    {name: 'fialová', mark: '✦'},
    {name: 'zelená', mark: '▲'},
    {name: 'modrá', mark: '■'},
    {name: 'růžová', mark: '+'},
    {name: 'krémová', mark: '○'}
  ];
  const find = selector => document.querySelector(selector);
  const board = find('.laundry-board');
  const line = find('#laundry-line');
  const tally = find('#move-count');
  const setLabel = find('#set-label');
  const undo = find('#undo-sort');
  const resetSet = find('#reset-set');
  const next = find('#next-set');
  const run = balikProgress.load()?.run;
  const saveKey = 'balik.laundry-set.v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let set;
  let bins;
  let selection;
  let history;
  let phase;
  let animation;

  const elevator = createElevatorPanel({
    floor: '4',
    destination: '5',
    onPress: () => laundryAudio.cue('click')
  });

  function loadSet() {
    for (const key of ['sessionStorage', 'localStorage']) {
      try {
        const saved = JSON.parse(window[key].getItem(saveKey));
        if (saved?.run === run && Number.isInteger(saved.set) && saved.set >= 0 && saved.set <= loads.length) return saved;
      } catch {}
    }
    return {set: 0};
  }

  function saveSet(set) {
    const data = JSON.stringify({run, set, version: 2});
    try {
      localStorage.setItem(saveKey, data);
      try { sessionStorage.removeItem(saveKey); } catch {}
    } catch {
      try { sessionStorage.setItem(saveKey, data); } catch {}
    }
  }

  function tell(message) { line.textContent = message; }

  function sorted(bin) { return bin.length === capacity && bin.every(color => color === bin[0]); }

  function transferAmount(source, target) {
    if (!source.length || target.length === capacity) return 0;
    const color = source.at(-1);
    if (target.length && target.at(-1) !== color) return 0;
    let contiguous = 0;
    while (source[source.length - 1 - contiguous] === color) contiguous++;
    return Math.min(contiguous, capacity - target.length);
  }

  function hasUsefulMove() {
    return bins.some((source, from) => bins.some((target, to) => {
      if (from === to) return false;
      const count = transferAmount(source, target);
      return count > 0 && (target.length > 0 || count < source.length);
    }));
  }

  function foldedTowel(color) {
    const towel = document.createElement('span');
    towel.className = 'towel';
    towel.dataset.color = color;
    towel.textContent = towels[color].mark;
    return towel;
  }

  function render() {
    const controls = [...board.children];
    for (const [index, bin] of bins.entries()) {
      const button = controls[index];
      const active = index === selection;
      const target = selection !== null && !active && transferAmount(bins[selection], bin) > 0;
      button.classList.toggle('is-selected', active);
      button.classList.toggle('is-target', target);
      button.classList.toggle('is-sorted', sorted(bin));
      button.disabled = phase !== 'sorting';
      button.setAttribute('aria-pressed', String(active));
      const contents = bin.length ? bin.slice().reverse().map(color => towels[color].name).join(', ') : 'prázdný';
      button.setAttribute('aria-label', `Koš ${index + 1}, ${bin.length ? 'shora ' : ''}${contents}`);
      button.querySelector('.basket-towels').replaceChildren(...bin.map(foldedTowel));
    }
    tally.textContent = `Tahů: ${history.length}`;
    setLabel.textContent = `Várka ${set + 1} / ${loads.length}`;
    undo.disabled = !history.length || phase !== 'sorting';
    undo.hidden = resetSet.hidden = phase !== 'sorting';
    next.hidden = phase === 'sorting';
    next.textContent = phase === 'finished' ? 'Nastoupit do výtahu' : 'Další várka';
  }

  function createBaskets() {
    board.style.setProperty('--columns', Math.ceil(bins.length / 2));
    board.replaceChildren(...bins.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'laundry-basket';
      button.dataset.bin = index;
      const stack = document.createElement('span');
      stack.className = 'basket-towels';
      stack.setAttribute('aria-hidden', 'true');
      const number = document.createElement('span');
      number.className = 'basket-number';
      number.textContent = index + 1;
      number.setAttribute('aria-hidden', 'true');
      button.append(stack, number);
      return button;
    }));
  }

  function cancelAnimation() {
    if (!animation) return;
    animation.cancel();
    animation.effect.target.remove();
    animation = undefined;
  }

  function startSet(value, finished = false) {
    cancelAnimation();
    set = value;
    const load = loads[set];
    bins = finished ? load.map((_, index) =>
      index < load.length - 2 ? Array(capacity).fill(index) : []) : load.map(bin => bin.slice());
    history = [];
    selection = null;
    phase = finished ? 'finished' : 'sorting';
    createBaskets();
    render();
    if (finished) tell('Ručníky jsou roztříděné. Můžu nastoupit do výtahu.');
    else if (set === 0) tell('Klepni na koš a přesuň vrchní ručníky do prázdného koše nebo na stejnou barvu. Každý koš pojme čtyři.');
    else tell('Roztřiď další várku. Každá barva patří do vlastního koše.');
  }

  function finishSet() {
    if (set + 1 < loads.length) {
      phase = 'clear';
      saveSet(set + 1);
      tell('Várka je roztříděná. Můžu vzít další.');
      return;
    }
    phase = 'finished';
    saveSet(loads.length);
    balikProgress.collect('4');
    tell(balikProgress.isUnlocked('5')
      ? 'Všechny ručníky jsou roztříděné. Můžu zpátky do výtahu.'
      : 'Všechny ručníky jsou roztříděné. Tady je tlačítko 5 do bazénu!');
  }

  function animateTowelling(rect, colors, to) {
    if (!rect || reducedMotion.matches) return;
    const stack = board.children[to].querySelector('.basket-towels');
    const destination = stack.lastElementChild.getBoundingClientRect();
    const layer = document.createElement('span');
    layer.className = 'moving-towels';
    Object.assign(layer.style, {left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`});
    layer.append(...colors.slice().reverse().map(foldedTowel));
    document.body.append(layer);
    const dx = destination.x - rect.x;
    const dy = destination.y - rect.y;
    const flight = layer.animate([
      {transform: 'translate(0, 0)', opacity: 1},
      {transform: `translate(${dx / 2}px, ${dy / 2 - 24}px)`, opacity: 1},
      {transform: `translate(${dx}px, ${dy}px)`, opacity: .12}
    ], {duration: 220, easing: 'ease-out'});
    animation = flight;
    flight.finished.then(() => {
      layer.remove();
      if (animation === flight) animation = undefined;
    }).catch(() => {});
  }

  function choose(index) {
    if (phase !== 'sorting') return;
    const target = bins[index];
    if (selection === null || selection === index) {
      if (selection === index) {
        selection = null;
        tell('Vyber koš, ze kterého chceš přesouvat.');
      } else if (target.length) {
        selection = index;
        laundryAudio.cue('click');
        tell('Teď vyber prázdný koš nebo koš se stejnou barvou nahoře.');
      } else tell('Tenhle koš je prázdný. Vyber koš s ručníky.');
      render();
      return;
    }
    const origin = bins[selection];
    const amount = transferAmount(origin, target);
    if (!amount) {
      tell(target.length === capacity ? 'Tenhle koš je plný.' : 'Vrchní ručníky musí mít stejnou barvu.');
      return;
    }
    cancelAnimation();
    const source = board.children[selection].querySelector('.basket-towels');
    const bottom = source.children[origin.length - amount].getBoundingClientRect();
    const top = source.lastElementChild.getBoundingClientRect();
    const rect = {x: top.x, y: top.y, height: bottom.bottom - top.y, width: top.width};
    history.push(bins);
    const moved = origin.slice(-amount);
    bins = bins.map((bin, position) => {
      if (position === selection) return origin.slice(0, -amount);
      if (position === index) return [...target, ...moved];
      return bin;
    });
    selection = null;
    if (bins.every(bin => !bin.length || sorted(bin))) {
      finishSet();
      laundryAudio.cue('ding');
    } else {
      laundryAudio.cue('fold');
      if (!hasUsefulMove()) tell('Další přesun by už třídění neposunul. Vrať tah nebo začni várku znovu.');
      else tell(`${amount === 1 ? 'Ručník přeložen.' : 'Skupina přeložena.'} Vyber další koš.`);
    }
    render();
    animateTowelling(rect, moved, index);
  }

  board.addEventListener('click', event => {
    const button = event.target.closest('.laundry-basket');
    if (button) choose(Number(button.dataset.bin));
  });

  undo.addEventListener('click', () => {
    if (phase !== 'sorting' || !history.length) return;
    cancelAnimation();
    bins = history.pop();
    selection = null;
    tell('Tah vrácen.');
    render();
  });

  resetSet.addEventListener('click', () => startSet(set));
  next.addEventListener('click', () => {
    if (phase === 'finished') elevator.open();
    else if (phase === 'clear') startSet(set + 1);
  });
  find('#reset').addEventListener('click', () => {
    elevator.reset();
    saveSet(0);
    startSet(0);
  });

  const checkpoint = balikProgress.checkpoint('4');
  const {set: saved, version} = loadSet();
  const finished = saved === loads.length;
  // Earlier saves earned the elevator button after the first three loads.
  const earnedEarlier = !version && (checkpoint === 'carrying' || checkpoint === 'installed');
  const nextLoad = earnedEarlier ? originalLoads : saved;
  if (finished) balikProgress.collect('4');
  startSet(finished ? loads.length - 1 : nextLoad, finished);
})();
