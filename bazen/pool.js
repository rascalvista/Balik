(() => {
  'use strict';

  // Patrols contain inclusive endpoints and an initial step in the out-and-back cycle.
  const courses = [
    {
      map: [
        '...G.##',
        '.......',
        '.......',
        '..#..#.',
        '.......',
        '#......',
        '...S...'
      ],
      patrols: [[0, 4, 5, 4, 2], [1, 2, 6, 2, 7]]
    },
    {
      map: [
        '..#G.#.',
        '..#.##.',
        '.......',
        '#.#..#.',
        '...#...',
        '......#',
        '...S#..'
      ],
      patrols: [[0, 5, 5, 5, 4], [2, 2, 6, 2, 6], [1, 1, 1, 4, 4]]
    },
    {
      map: [
        '##.G..#',
        '#..#...',
        '#.#....',
        '.......',
        '..##..#',
        '......#',
        '.#.S##.'
      ],
      patrols: [[0, 5, 5, 5, 2], [1, 1, 1, 4, 2], [2, 3, 6, 3, 1], [5, 0, 5, 3, 4]]
    }
  ];
  const directions = {up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0], wait: [0, 0]};
  const keyboard = new Map([
    ['ArrowUp', 'up'], ['ArrowLeft', 'left'], ['ArrowDown', 'down'], ['ArrowRight', 'right'],
    ['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right'], [' ', 'wait']
  ]);
  const courierRows = {up: 2, right: 1, down: 0, left: 3};
  const find = selector => document.querySelector(selector);
  const grid = find('.pool-grid');
  const surface = find('.pool-tiles');
  const figures = find('.pool-tokens');
  const courseLabel = find('#course-label');
  const tally = find('#move-count');
  const line = find('#pool-line');
  const undo = find('#undo-turn');
  const tryAgain = find('#reset-course');
  const next = find('#next-course');
  const movement = find('.pool-steering');
  const tools = find('.pool-tools');
  const run = balikProgress.load()?.run;
  const storageKey = 'balik.pool-course.v1';
  const count = courses[0].map.length;

  let index;
  let tiles;
  let patrols;
  let swimmerTokens;
  let courier;
  let frame;
  let history;
  let phase;
  let touchStart;

  const elevator = createElevatorPanel({
    floor: '5',
    destination: '6',
    onPress: () => poolAudio.cue('click'),
    onTravel: () => find('#gym-preview').showModal()
  });

  function savedCourse() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.run === run && Number.isInteger(saved.index) && courses[saved.index]) return saved.index;
    } catch {}
    return 0;
  }

  function saveCourse(value) {
    try { localStorage.setItem(storageKey, JSON.stringify({run, index: value})); } catch {}
  }

  function keyFor(x,y) { return y * count + x; }
  function cellAt(x,y) { return tiles[keyFor(x,y)]; }

  function makePatrol([x, y, endX, endY, offset]) {
    const length = Math.abs(endX - x) + Math.abs(endY - y);
    const dx = Math.sign(endX - x);
    const dy = Math.sign(endY - y);
    return turn => {
      const time = (turn + offset) % (length * 2);
      const steps = Math.min(time, length * 2 - time);
      const sign = time < length ? 1 : -1;
      return {x: x + dx * steps, y: y + dy * steps, dx: dx * sign, dy: dy * sign};
    };
  }

  function position(token, x, y) {
    token.style.left = `${(x + .5) * 100 / count}%`;
    token.style.top = `${(y + .5) * 100 / count}%`;
  }

  function render() {
    const current = patrols.map(at => at(frame.turn));
    const following = patrols.map(at => at(frame.turn + 1));
    for (const [id, spot] of current.entries()) {
      const token = swimmerTokens[id];
      position(token, spot.x, spot.y);
      const rotation = Math.atan2(spot.dx, -spot.dy) * 180 / Math.PI;
      token.style.setProperty('--facing', `${rotation}deg`);
    }

    for (const tile of tiles) {
      const isCourier = tile.x === frame.x && tile.y === frame.y;
      const hasSwimmer = current.some(spot => spot.x === tile.x && spot.y === tile.y);
      const isNext = following.some(spot => spot.x === tile.x && spot.y === tile.y);
      const adjacent = Math.abs(tile.x - frame.x) + Math.abs(tile.y - frame.y) === 1;
      const playable = adjacent && tile.type !== '#' && phase === 'active';
      tile.button.disabled = !playable;
      tile.button.classList.toggle('is-next', isNext && phase !== 'finished');
      tile.button.classList.toggle('is-player', isCourier);
      const details = [
        tile.type === '#' ? 'bóje' : tile.type === 'G' ? 'výstup' : tile.type === 'S' ? 'start' : '',
        isCourier ? 'kurýr' : '', hasSwimmer ? 'plavec' : '', isNext ? 'příští tah plavce' : ''
      ].filter(Boolean).join(', ');
      tile.button.setAttribute('aria-label',
        `Řada ${tile.y + 1}, sloupec ${tile.x + 1}${details ? ', ' + details : ''}`);
    }

    position(courier, frame.x, frame.y);
    courier.firstElementChild.style.backgroundPosition = `0% ${courierRows[frame.facing] * 100 / 7}%`;
    courier.classList.toggle('is-hit', phase === 'collision');
    figures.classList.toggle('is-cleared', phase === 'finished');
    grid.classList.toggle('has-collision', phase === 'collision');
    for (const button of movement.querySelectorAll('button')) button.disabled = phase !== 'active';
    movement.hidden = phase === 'clear' || phase === 'finished';
    tools.hidden = movement.hidden;
    undo.disabled = history.length === 0;
    next.hidden = phase !== 'clear' && phase !== 'finished';
    next.textContent = phase === 'finished' ? 'Nastoupit do výtahu' : 'Další dráha';
    tally.textContent = `Tahů: ${frame.turn}`;
    courseLabel.textContent = `Dráha ${index + 1} / ${courses.length}`;
  }

  function tell(text) { line.textContent = text; }

  function setCourse(value, restored = false) {
    index = value;
    const {map, patrols: paths} = courses[index];
    patrols = paths.map(makePatrol);
    let start;
    let goal;
    surface.replaceChildren();
    figures.replaceChildren();
    tiles = map.flatMap((row,y) => Array.from(row, (type,x) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.className = 'pool-tile';
      button.dataset.x = x;
      button.dataset.y = y;
      if (type === 'S') { start = {x,y}; button.classList.add('is-start'); }
      if (type === 'G') { goal = {x,y}; button.classList.add('is-goal'); }
      if (type === '#') button.classList.add('has-buoy');
      surface.append(button);
      return {type,x,y,button};
    }));

    swimmerTokens = patrols.map(() => {
      const token = new Image();
      token.className = 'pool-token pool-swimmer';
      token.src = 'art/swimmer.webp';
      token.alt = '';
      figures.append(token);
      return token;
    });
    courier = document.createElement('span');
    courier.className = 'pool-token pool-courier';
    courier.append(document.createElement('i'));
    figures.append(courier);
    history = [];
    frame = {...(restored ? goal : start), turn: 0, facing: 'up'};
    phase = restored ? 'finished' : 'active';
    render();
    if (restored) tell('Zásilka je v suchu. U výstupu čeká výtah.');
    else if (index === 0) tell('Zásilka nesmí zmoknout. Dojeď k hornímu žebříku. Plavci se pohnou s každým tvým tahem.');
    else tell('Dostaň se k hornímu žebříku. Světlé značky ukazují, kam plavci pojedou.');
  }

  function blocked() { return Boolean(find('dialog[open]')); }

  function takeTurn(direction) {
    if (phase !== 'active' || blocked()) return;
    const [dx,dy] = directions[direction];
    const x = frame.x + dx;
    const y = frame.y + dy;
    if (x < 0 || x >= count || y < 0 || y >= count || cellAt(x,y).type === '#') {
      tell('Tudy to nepůjde. Zkus volné políčko.');
      return;
    }
    const collision = patrols.some(at => [at(frame.turn), at(frame.turn + 1)]
      .some(spot => spot.x === x && spot.y === y));
    history.push(frame);
    frame = {x,y,turn:frame.turn + 1,facing:direction === 'wait' ? frame.facing : direction};
    if (collision) {
      phase = 'collision';
      poolAudio.cue('splash');
      tell('Šplouch! Plavec zkřížil cestu. Vrať poslední tah nebo zkus dráhu znovu.');
    } else if (cellAt(x,y).type === 'G') {
      poolAudio.cue('ding');
      if (index + 1 === courses.length) {
        balikProgress.collect('5');
        phase = 'finished';
        tell('Balíček je suchý a všechny dráhy za mnou. Mám tlačítko 6!');
      } else {
        saveCourse(index + 1);
        phase = 'clear';
        tell('Dráha hotová. Můžu na další.');
      }
    } else {
      if (direction !== 'wait') poolAudio.cue('ripple');
      if (frame.turn === 1 || frame.turn === 2) tell('Sleduj světlé značky. Když plavec míří před tebe, můžeš počkat.');
    }
    render();
  }

  function rewind() {
    if (!history.length || blocked() || (phase !== 'active' && phase !== 'collision')) return;
    phase = 'active';
    frame = history.pop();
    tell('Tah vrácen. Najdi volnou cestu k žebříku.');
    render();
  }

  function tileDirection(x,y) {
    return Object.keys(directions).find(name => name !== 'wait'
      && frame.x + directions[name][0] === x && frame.y + directions[name][1] === y);
  }

  function directionForTile(target) {
    const cell = target?.closest('.pool-tile');
    if (!cell || !surface.contains(cell) || cell.disabled) return;
    return tileDirection(Number(cell.dataset.x), Number(cell.dataset.y));
  }

  surface.addEventListener('click', event => {
    const direction = directionForTile(event.target);
    if (direction) takeTurn(direction);
  });
  grid.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { touchStart = undefined; return; }
    const touch = event.changedTouches[0];
    touchStart = {x: touch.clientX, y: touch.clientY};
  }, {passive: true});
  grid.addEventListener('touchend', event => {
    const start = touchStart;
    touchStart = undefined;
    if (!start || event.touches.length || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    let direction;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 22) {
      direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    } else {
      direction = directionForTile(document.elementFromPoint(touch.clientX, touch.clientY));
    }
    if (direction) {
      event.preventDefault();
      takeTurn(direction);
    }
  }, {passive: false});
  grid.addEventListener('touchcancel', () => { touchStart = undefined; });

  function bindTap(button, action) {
    button.addEventListener('touchend', event => {
      if (button.disabled || event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      if (!button.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
      event.preventDefault();
      action();
    }, {passive: false});
    button.addEventListener('click', action);
  }

  for (const button of movement.querySelectorAll('button')) {
    bindTap(button, () => takeTurn(button.dataset.move));
  }
  document.addEventListener('keydown', event => {
    if (blocked() || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const move = keyboard.get(key);
    if (move && (key !== ' ' || !event.target.closest('button'))) {
      event.preventDefault();
      takeTurn(move);
    }
    if (key === 'z') rewind();
  });

  bindTap(undo, rewind);
  bindTap(tryAgain, () => setCourse(index));
  bindTap(next, () => {
    if (phase === 'finished') elevator.open();
    else if (phase === 'clear') setCourse(index + 1);
  });
  find('#reset').addEventListener('click', () => {
    elevator.reset();
    saveCourse(0);
    setCourse(0);
  });
  const checkpoint = balikProgress.checkpoint('5');
  const finished = checkpoint === 'carrying' || checkpoint === 'installed';
  setCourse(finished ? courses.length - 1 : savedCourse(), finished);
})();
