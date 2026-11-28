(() => {
  'use strict';

  const find = selector => document.querySelector(selector);
  const board = find('.room-map');
  const tiles = find('.room-tiles');
  const threads = find('.room-routes');
  const walkers = find('.room-walkers');
  const line = find('#room-line');
  const walkLabel = find('#walk-label');
  const routeCount = find('#route-count');
  const undo = find('#undo-route');
  const resetWalk = find('#reset-walk');
  const nextWalk = find('#next-walk');
  const edit = find('.room-edit');
  const lift = find('#hall-lift');
  const reward = find('.room-reward');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const elevator = createElevatorPanel({floor: '3', destination: '4', onPress: () => roomsAudio.cue('click')});
  const run = balikProgress.load()?.run ?? null;
  const storageKey = 'balik.room-walk.v1';
  const xmlns = 'http://www.w3.org/2000/svg';
  const uniforms = [
    ['■', 'tyrkysový čtverec', '#81dfd1', 0],
    ['◆', 'růžový kosočtverec', '#f193a8', -13],
    ['●', 'zlatý kruh', '#f5cb72', 14],
    ['▲', 'zelený trojúhelník', '#b6da86', -19],
    ['✦', 'fialová hvězda', '#c6abf1', 20],
    ['✚', 'modrý kříž', '#8ebeff', 8],
    ['☾', 'oranžový měsíc', '#f9a572', -8]
  ];
  const prompts = [
    '„Já se s ní na chodbě nepotkám!“ Spoj každý vozík se dveřmi se stejným symbolem.',
    'Větší patro, stejná dohoda. Každá pokojská potřebuje vlastní cestu.',
    'Nech volný průchod i kolegyním. Některá zkratka je může zablokovat.',
    'Jedna pokojská: „Já si klidně zajdu, hlavně když mi uhne.“',
    'Poslední obchůzka. Až bude prádlo na vozících, půjde do prádelny.'
  ];
  const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

  let round;
  let side;
  let pairs;
  let endpoints;
  let cells;
  let routes;
  let drawn;
  let phase;
  let history;
  let focusCell;
  let stroke;
  let conflict;
  let animations = [];

  function readWalk() {
    for (const store of ['sessionStorage', 'localStorage']) {
      try {
        const saved = JSON.parse(window[store].getItem(storageKey));
        if (saved?.run === run && Number.isInteger(saved.round) && saved.round >= 0 &&
            saved.round <= roomLayouts.length) return saved.round;
      } catch {}
    }
    return 0;
  }

  function saveWalk(position) {
    const data = JSON.stringify({run, round: position});
    try {
      localStorage.setItem(storageKey, data);
      try { sessionStorage.removeItem(storageKey); } catch {}
    } catch {
      try { sessionStorage.setItem(storageKey, data); } catch {}
    }
  }

  function say(message) {
    if (line.textContent !== message) line.textContent = message;
  }

  function cellX(cell) { return cell % side; }
  function cellY(cell) { return Math.floor(cell / side); }
  function fromGrid([column, row]) { return (row - 1) * side + column - 1; }
  function adjacent(a, b) { return Math.abs(cellX(a) - cellX(b)) + Math.abs(cellY(a) - cellY(b)) === 1; }
  function completed(index) {
    const path = routes[index];
    return path.length > 1 && pairs[index].includes(path.at(-1));
  }

  function putFocus(cell, moveFocus = false) {
    cells[focusCell]?.setAttribute('tabindex', '-1');
    focusCell = cell;
    cells[cell].tabIndex = 0;
    if (moveFocus) cells[cell].focus({preventScroll: true});
  }

  function paint() {
    const claims = new Map();
    for (const [index, path] of routes.entries()) {
      drawn[index].setAttribute('points', path.map(cell => (cellX(cell) + .5) + ',' + (cellY(cell) + .5)).join(' '));
      drawn[index].classList.toggle('is-current', stroke?.index === index);
      path.forEach(cell => claims.set(cell, index));
    }
    for (const [cell, tile] of cells.entries()) {
      const owner = endpoints.get(cell) ?? claims.get(cell);
      const color = uniforms[owner]?.[2] ?? '';
      tile.classList.toggle('is-threaded', claims.has(cell));
      tile.style.setProperty('--pair-ink', color);
    }
    const count = routes.filter((_, index) => completed(index)).length;
    const status = `Trasy ${phase === 'finished' ? pairs.length : count} / ${pairs.length}`;
    if (routeCount.textContent !== status) routeCount.textContent = status;
    undo.disabled = phase !== 'drawing' || !history.length || Boolean(stroke);
    resetWalk.disabled = phase !== 'drawing' || !routes.some(path => path.length);
  }

  function makeCell(cell) {
    const tile = document.createElement('button');
    const index = endpoints.get(cell);
    tile.type = 'button';
    tile.className = 'room-cell';
    tile.tabIndex = -1;
    tile.dataset.cell = cell;
    let label = `Chodba, řádek ${cellY(cell) + 1}, sloupec ${cellX(cell) + 1}`;
    if (index !== undefined) {
      const cart = pairs[index][0] === cell;
      const [symbol, name, , tint] = uniforms[index];
      const endpoint = document.createElement('span');
      const art = new Image();
      const mark = document.createElement('span');
      endpoint.className = 'room-endpoint ' + (cart ? 'cart' : 'door');
      endpoint.style.setProperty('--uniform-tint', tint + 'deg');
      art.src = cart ? 'art/cart.webp' : 'art/door.webp';
      art.alt = '';
      art.draggable = false;
      mark.className = 'room-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = symbol;
      endpoint.append(art, mark);
      tile.append(endpoint);
      label = (cart ? 'Pokojská u vozíku, ' : 'Dveře, ') + name + ', ' + label.toLocaleLowerCase('cs');
    }
    tile.setAttribute('aria-label', label);
    return tile;
  }

  function startWalk(position) {
    endStroke(false);
    animations.forEach(animation => animation.cancel());
    animations = [];
    const finished = position === roomLayouts.length;
    round = finished ? position - 1 : position;
    const layout = roomLayouts[round];
    side = layout.size;
    pairs = layout.pairs.map(pair => pair.map(fromGrid));
    endpoints = new Map(pairs.flatMap((pair, index) => pair.map(cell => [cell, index])));
    routes = pairs.map(() => []);
    history = [];
    focusCell = undefined;
    conflict = undefined;
    phase = finished ? 'finished' : 'drawing';
    board.style.setProperty('--rooms-side', side);
    board.classList.remove('is-walking');
    board.inert = finished;
    threads.setAttribute('viewBox', `0 0 ${side} ${side}`);
    cells = Array.from({length: side * side}, (_, cell) => makeCell(cell));
    drawn = uniforms.slice(0, pairs.length).map(([, , color]) => {
      const element = document.createElementNS(xmlns, 'polyline');
      element.classList.add('room-route');
      element.style.setProperty('--pair-ink', color);
      return element;
    });
    tiles.replaceChildren(...cells);
    threads.replaceChildren(...drawn);
    walkers.replaceChildren();
    putFocus(pairs[0][0]);
    walkLabel.textContent = `Obchůzka ${round + 1} / ${roomLayouts.length}`;
    edit.hidden = finished;
    nextWalk.hidden = !finished;
    nextWalk.textContent = finished ? 'Nastoupit do výtahu' : 'Další obchůzka';
    lift.hidden = reward.hidden = !finished;
    say(finished ? '„Všechno prádlo je na vozících. Tady je tlačítko 4, jedeme do prádelny.“' : prompts[round]);
    paint();
  }

  function startStroke(cell, pointer, at) {
    if (stroke || phase !== 'drawing') return false;
    const index = endpoints.get(cell) ?? routes.findIndex(path => path.includes(cell));
    if (index < 0) return false;
    const before = routes[index];
    stroke = {index, before, pointer, at};
    routes[index] = endpoints.has(cell) ? [cell] : before.slice(0, before.indexOf(cell) + 1);
    if (conflict) {
      conflict.classList.remove('is-conflict');
      conflict = undefined;
      say(prompts[round]);
    }
    putFocus(cell, pointer === undefined);
    paint();
    return true;
  }

  function enterCell(cell) {
    const {index} = stroke;
    const path = routes[index];
    if (!adjacent(path.at(-1), cell)) return false;
    const back = path.indexOf(cell);
    if (back >= 0) path.splice(back + 1);
    else {
      if (completed(index)) return false;
      const other = endpoints.get(cell);
      const blocked = (other !== undefined && other !== index) ||
        routes.some((route, owner) => owner !== index && route.includes(cell));
      if (blocked) {
        if (conflict !== cells[cell] || !conflict.classList.contains('is-conflict')) {
          conflict?.classList.remove('is-conflict');
          conflict = cells[cell];
          conflict.classList.add('is-conflict');
          say('„Tudy nejdu. Potkala bych kolegyni.“');
        }
        return false;
      }
      path.push(cell);
    }
    if (conflict) {
      conflict.classList.remove('is-conflict');
      conflict = undefined;
      say(prompts[round]);
    }
    paint();
    return true;
  }

  function endStroke(commit) {
    if (!stroke) return;
    const {index, before, pointer} = stroke;
    stroke = undefined;
    if (pointer !== undefined && board.hasPointerCapture(pointer)) board.releasePointerCapture(pointer);
    if (!commit) routes[index] = before;
    else if (before.length !== routes[index].length || before.some((cell, step) => cell !== routes[index][step])) {
      history.push({index, before});
      if (completed(index)) roomsAudio.cue('click');
    }
    paint();
    if (commit && routes.every((_, index) => completed(index))) finishWalk();
  }

  function point(event) {
    const rect = board.getBoundingClientRect();
    const x = (event.clientX - rect.left) * side / rect.width;
    const y = (event.clientY - rect.top) * side / rect.height;
    return x >= 0 && x < side && y >= 0 && y < side ? [x, y] : null;
  }

  function trace(from, to) {
    const [x1, y1] = to.map(Math.floor);
    if (!from) {
      enterCell(y1 * side + x1);
      return;
    }
    let [x, y] = from.map(Math.floor);
    const [dx, dy] = to.map((value, axis) => value - from[axis]);
    // Walk through each cell boundary in pointer order, including fast swipes.
    while (x !== x1 || y !== y1) {
      const tx = x === x1 ? Infinity : (x + Number(dx > 0) - from[0]) / dx;
      const ty = y === y1 ? Infinity : (y + Number(dy > 0) - from[1]) / dy;
      if (tx <= ty) x += Math.sign(dx);
      else y += Math.sign(dy);
      enterCell(y * side + x);
    }
  }

  board.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const at = point(event);
    if (!at) return;
    if (event.pointerType !== 'touch') event.preventDefault();
    const cell = Math.floor(at[1]) * side + Math.floor(at[0]);
    if (startStroke(cell, event.pointerId, at)) board.setPointerCapture(event.pointerId);
  });
  function movePointer(event) {
    if (stroke?.pointer !== event.pointerId) return;
    const position = point(event);
    if (position) trace(stroke.at, position);
    stroke.at = position;
  }
  board.addEventListener('pointermove', movePointer);
  board.addEventListener('pointerup', event => {
    if (stroke?.pointer !== event.pointerId) return;
    movePointer(event);
    endStroke(true);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    board.addEventListener(type, event => {
      if (stroke?.pointer === event.pointerId) endStroke(false);
    });
  }
  board.addEventListener('contextmenu', event => event.preventDefault());
  board.addEventListener('click', event => {
    const tile = event.target.closest('.room-cell');
    if (event.detail || !tile || phase !== 'drawing') return;
    if (stroke?.pointer !== undefined) return;
    if (stroke) endStroke(true);
    else startStroke(Number(tile.dataset.cell));
  });
  board.addEventListener('keydown', event => {
    if (phase !== 'drawing' || stroke?.pointer !== undefined) return;
    if (event.key === 'Escape' && stroke) {
      event.preventDefault();
      endStroke(false);
    }
    if (!Object.hasOwn(arrows, event.key)) return;
    event.preventDefault();
    const [dx, dy] = arrows[event.key];
    const x = cellX(focusCell) + dx;
    const y = cellY(focusCell) + dy;
    if (x < 0 || x >= side || y < 0 || y >= side) return;
    const cell = y * side + x;
    if (!stroke || enterCell(cell)) putFocus(cell, true);
  });

  function showObchuzka(path, index) {
    // Each housekeeper walks from the cart to the room, then brings the linen back.
    const fromCart = path[0] === pairs[index][0] ? path : [...path].reverse();
    const steps = [...fromCart, fromCart.at(-1), ...fromCart.slice(0, -1).reverse()];
    const actor = new Image();
    actor.src = 'art/maid.webp';
    actor.className = 'room-walker';
    actor.alt = '';
    actor.style.setProperty('--uniform-tint', uniforms[index][3] + 'deg');
    walkers.append(actor);
    return actor.animate(steps.map(cell => ({
      left: (cellX(cell) + .5) / side * 100 + '%',
      top: (cellY(cell) + .62) / side * 100 + '%'
    })), {duration: (steps.length - 1) * 85, fill: 'both'});
  }

  async function finishWalk() {
    phase = 'walking';
    board.inert = true;
    paint();
    say('Pokojské vyrážejí pro prádlo.');
    const next = round + 1;
    const finished = next === roomLayouts.length;
    saveWalk(next);
    if (finished) balikProgress.collect('3');
    if (!reduced.matches) {
      board.classList.add('is-walking');
      const walking = routes.map(showObchuzka);
      animations = walking;
      try { await Promise.all(walking.map(animation => animation.finished)); }
      catch { return; }
    }
    board.classList.remove('is-walking');
    walkers.replaceChildren();
    animations = [];
    roomsAudio.cue(finished ? 'ding' : 'fold');
    phase = finished ? 'finished' : 'clear';
    edit.hidden = true;
    nextWalk.hidden = false;
    nextWalk.textContent = finished ? 'Nastoupit do výtahu' : 'Další obchůzka';
    lift.hidden = reward.hidden = !finished;
    say(finished ? '„Všechno prádlo je na vozících. Tady je tlačítko 4, jedeme do prádelny.“'
      : 'Prádlo je na vozících. A ani jednou se nepotkaly.');
    nextWalk.focus({preventScroll: true});
  }

  function bindControl(button, action) {
    button.addEventListener('click', action);
    // A tap right after dragging on the rug can lose its synthesized click.
    button.addEventListener('touchend', event => {
      if (button.disabled || !event.cancelable || event.touches.length || event.changedTouches.length !== 1) return;
      const {clientX, clientY} = event.changedTouches[0];
      if (!button.contains(document.elementFromPoint(clientX, clientY))) return;
      event.preventDefault();
      action();
    }, {passive: false});
  }

  bindControl(undo, () => {
    if (!history.length || stroke || phase !== 'drawing') return;
    const {index, before} = history.pop();
    routes[index] = before;
    conflict?.classList.remove('is-conflict');
    conflict = undefined;
    say(prompts[round]);
    paint();
  });
  bindControl(resetWalk, () => startWalk(round));
  bindControl(nextWalk, () => {
    if (phase === 'finished') elevator.open();
    else if (phase === 'clear') {
      startWalk(round + 1);
      putFocus(pairs[0][0], true);
    }
  });
  bindControl(lift, () => elevator.open());
  find('#balik-menu-toggle').addEventListener('click', () => endStroke(false));
  find('#reset').addEventListener('click', () => {
    elevator.reset();
    saveWalk(0);
    startWalk(0);
  });

  const saved = readWalk();
  if (saved === roomLayouts.length) balikProgress.collect('3');
  startWalk(saved);
})();
