(() => {
  'use strict';

  const find = selector => document.querySelector(selector);
  const board = find('.bistro');
  const tickets = find('.restaurant-tickets');
  const tally = find('#tally');
  const waiter = find('.waiter');
  const sprite = find('.waiter-sprite');
  const itemInHand = find('.waiter-item');
  const liftDoors = find('.bistro-lift');
  const liftSign = find('[data-station="lift"]');
  const line = find('#restaurant-line');
  const stick = find('.service-stick');
  const action = find('.service-action');
  const actionName = find('.action-name');
  const actionSpot = find('.action-spot');
  const menu = find('#balik-menu-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const meal = (name, art) => ({name, art, station: 'pass'});
  const layer = (name, color, goal, fillTime, tail) => ({name, color, goal, fillTime, tail});
  const drink = (name, ...layers) => ({name, color: layers[0].color, layers, station: 'bar'});
  const tables = [
    {name: 'Stůl 1', x: 20.2, y: 57.8, patience: 52, items: [
      meal('Špagety', 'spaghetti.png'),
      drink('Citronáda', layer('Citronáda', '#d98e30', [73, 87], 2190, 11))
    ]},
    {name: 'Stůl 2', x: 49.7, y: 57.8, patience: 60, items: [
      drink('Malinovka', layer('Malinovka', '#b84660', [73, 86], 2130, 13)),
      meal('Steak', 'steak.png')
    ]},
    {name: 'Stůl 3', x: 79.7, y: 57.8, patience: 67, items: [
      meal('Rizoto', 'risotto.png'),
      drink('Ledový čaj', layer('Ledový čaj', '#9c552e', [76, 88], 1980, 9))
    ]},
    {name: 'Stůl 4', x: 31.2, y: 83.8, patience: 72, items: [
      meal('Zeleninová polévka', 'soup.png'),
      drink('Broskvový fizz', layer('Broskvový fizz', '#cf7840', [72, 86], 1950, 14))
    ]},
    {name: 'Stůl 5', x: 68.7, y: 83.8, patience: 82, items: [
      drink('Hotelová limonáda',
        layer('Malinový sirup', '#ac3158', [38, 49], 2070, 9),
        layer('Citrusová soda', '#e9ae42', [77, 89], 1910, 13)),
      meal('Omeleta', 'omelet.png')
    ]}
  ];
  const pass = {name: 'Výdej', x: 28, y: 34.3, sign: find('[data-station="pass"]')};
  const bar = {name: 'Bar', x: 72, y: 37, sign: find('[data-station="bar"]')};
  const lift = {name: 'Výtah', x: 49.7, y: 70.5, sign: liftSign};
  // Coordinates are percentages of the bistro. Collisions use the courier's feet.
  const furniture = [
    [15.2, 25.4, 34.5, 54.8], [44.6, 54.8, 34.5, 54.8], [74.8, 85, 34.5, 54.8],
    [26, 36.5, 61.5, 80], [63.4, 74, 61.5, 80], [38.1, 61.9, 73, 100]
  ];
  const directionRows = [4, 3, 2, 1, 0, 7, 6, 5];
  const turn = Math.PI / 4;
  const walkKeys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'w', 'd', 's', 'a'];
  const keys = new Set();
  const total = tables.reduce((count, table) => count + table.items.length, 0);
  const marks = directionRows.map((_, index) => {
    const mark = document.createElement('i');
    mark.style.setProperty('--angle', `${index * 45}deg`);
    stick.firstElementChild.append(mark);
    return mark;
  });

  let state;
  let rendered = [];
  let time;
  let pointer = null;
  let touchDirection = -1;
  let nearby;
  let doorTimer;

  function place(element, x, y) {
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;
  }

  for (const [index, table] of tables.entries()) {
    const sign = document.createElement('span');
    sign.className = 'table-marker';
    sign.textContent = index + 1;
    place(sign, table.x, table.y - 3.6);
    find('.table-markers').append(sign);
    table.sign = sign;
  }

  const pourGame = createPourGame((order, precise) => {
    carry(order);
    restaurantAudio.cue('glass');
    say(`${precise ? 'Perfektně nalito! ' : ''}${order.item.name} patří ke stolu ${order.table + 1}.`);
  });

  const elevator = createElevatorPanel({
    floor: '2',
    destination: '3',
    onPress: () => restaurantAudio.cue('click')
  });

  function say(message) { line.textContent = message; }

  function itemIcon(item) {
    const icon = document.createElement('span');
    icon.className = `item-icon is-${item.art ? 'food' : 'drink'}`;
    icon.setAttribute('aria-hidden', 'true');
    if (item.art) {
      const image = new Image();
      image.src = '../kuchyne/art/' + item.art;
      image.alt = '';
      icon.append(image);
    } else icon.style.setProperty('--drink-color', item.color);
    return icon;
  }

  function orderFor(table, step, delay = 0) {
    const item = tables[table].items[step];
    if (!item) return null;
    const opens = state.elapsed + delay;
    return {table, item, opens, deadline: opens + tables[table].patience, step};
  }

  function isActive(order) {
    return order && order.opens <= state.elapsed && state.elapsed < order.deadline;
  }

  function nextOrder(station) {
    const options = state.orders.filter(order => isActive(order) && (!station || order.item.station === station));
    return options.find(order => order.table === state.selected) ??
      options.reduce((first, order) => !first || order.deadline < first.deadline ? order : first, undefined);
  }

  function renderTickets() {
    tickets.replaceChildren();
    tally.textContent = `${state.served} / ${total}`;
    rendered = tables.map((table, index) => {
      const order = state.orders[index];
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ticket-card';
      button.disabled = !isActive(order);
      button.setAttribute('aria-pressed', order && index === state.selected ? 'true' : 'false');
      const item = document.createElement('span');
      item.className = 'ticket-item';
      const label = document.createElement('small');
      label.className = 'ticket-table';
      label.textContent = table.name;
      item.append(label, order ? ' ' + order.item.name : ' Obslouženo');
      if (order) button.append(itemIcon(order.item));
      else button.append(document.createElement('span'));
      button.append(item);
      let bar;
      let clock;
      if (order) {
        clock = document.createElement('span');
        clock.className = 'ticket-clock';
        button.append(clock);
        const timer = document.createElement('span');
        timer.className = 'ticket-timer';
        timer.setAttribute('aria-hidden', 'true');
        bar = document.createElement('i');
        timer.append(bar);
        button.append(timer);
      }
      row.append(button);
      tickets.append(row);
      button.addEventListener('click', () => {
        if (state.held) {
          say(`${state.held.item.name} patří ke stolu ${state.held.table + 1}.`);
          return;
        }
        state.selected = index;
        renderSelection();
        say(`Stůl ${index + 1} si objednal ${order.item.name.toLocaleLowerCase('cs')}. ${order.item.station === 'bar' ? 'Připrav drink u baru.' : 'Vyzvedni jídlo u výdeje.'}`);
      });
      return {button, bar, clock};
    });
    renderSelection();
    updateTimers();
  }

  function renderSelection() {
    for (const [index, {button}] of rendered.entries()) {
      button.setAttribute('aria-pressed', String(Boolean(isActive(state.orders[index]) && state.selected === index)));
    }
    const order = state.held ?? nextOrder();
    pass.sign.classList.toggle('is-target', !state.held && order?.item.station === 'pass');
    bar.sign.classList.toggle('is-target', !state.held && order?.item.station === 'bar');
    lift.sign.classList.toggle('is-target', state.done);
    for (const [index, table] of tables.entries()) {
      table.sign.classList.toggle('is-target', state.held?.table === index);
    }
  }

  function secondsUntil(order) {
    return Math.max(0, Math.ceil(order.deadline - state.elapsed));
  }

  function updateTimers() {
    let selectionChanged = false;
    for (const [index, order] of state.orders.entries()) {
      if (!order) continue;
      const {button, bar, clock} = rendered[index];
      const active = order.opens <= state.elapsed;
      const remaining = order.deadline - state.elapsed;
      const ratio = active ? Math.max(0, remaining / tables[index].patience) : 0;
      bar.style.transform = `scaleX(${ratio.toFixed(3)})`;
      button.classList.toggle('is-late', active && remaining <= 12);
      const label = active ? `${secondsUntil(order)} s` : `Za ${Math.ceil(order.opens - state.elapsed)} s`;
      if (clock.textContent !== label) clock.textContent = label;
      if (button.disabled === active) {
        button.disabled = !active;
        selectionChanged = true;
      }
      if (pourGame.isPreparing(order)) pourGame.updateTime(secondsUntil(order));
    }
    if (selectionChanged) renderSelection();
  }

  function replaceExpiredOrders() {
    const expired = state.orders.filter(order => order && order.deadline <= state.elapsed);
    if (!expired.length) return;
    state.missed += expired.length;
    for (const order of expired) {
      state.orders[order.table] = orderFor(order.table, order.step, 5);
      if (pourGame.isPreparing(order)) pourGame.close();
      if (state.held === order) carry(null);
    }
    renderTickets();
    const tableNumber = expired[0].table + 1;
    say(expired.length === 1 ? `Stůl ${tableNumber} má po termínu. Za chvíli si objedná znovu.`
      : 'Několik stolů má po termínu. Objednávky se za chvíli obnoví.');
  }

  function carry(order) {
    state.held = order;
    itemInHand.replaceChildren();
    itemInHand.hidden = !order;
    if (order) itemInHand.append(itemIcon(order.item));
    waiter.setAttribute('aria-label', order ? `Kurýr nese ${order.item.name} ke stolu ${order.table + 1}` : 'Kurýr');
    renderSelection();
    refreshAction();
  }

  function serve(tableIndex) {
    const order = state.held;
    if (!order || order.table !== tableIndex) {
      say(order ? `Tohle patří ke stolu ${order.table + 1}.` : `Vyzvedni objednávku pro stůl ${tableIndex + 1}.`);
      return;
    }
    state.served++;
    state.orders[tableIndex] = orderFor(tableIndex, order.step + 1);
    state.selected = state.orders.reduce((first, ticket) => isActive(ticket) && (!first || ticket.deadline < first.deadline) ? ticket : first, undefined)?.table;
    carry(null);
    renderTickets();
    restaurantAudio.cue('serve');
    if (state.served === total) {
      balikProgress.collect('2');
      const result = state.missed ? `Nedoručených v termínu: ${state.missed}.` : 'Všechno včas!';
      complete(`Všech ${total} objednávek je u hostů. ${result} Mám tlačítko 3 — teď k výtahu.`);
    } else {
      say(`${order.item.name} doručeno. Host děkuje!`);
    }
  }

  function complete(message) {
    state.done = true;
    liftSign.hidden = false;
    renderSelection();
    refreshAction();
    say(message);
  }

  function enterLift() {
    if (doorTimer !== undefined) return;
    liftDoors.hidden = false;
    requestAnimationFrame(() => { if (!liftDoors.hidden) liftDoors.classList.add('is-open'); });
    restaurantAudio.cue('ding');
    doorTimer = setTimeout(() => {
      stopInput();
      doorTimer = undefined;
      elevator.open();
    }, reducedMotion.matches ? 0 : 360);
  }

  function interact() {
    if (blocked() || action.disabled || !nearby) return;
    if (nearby === lift) {
      enterLift();
      return;
    }
    state.started = true;
    const station = nearby === pass ? 'pass' : nearby === bar ? 'bar' : undefined;
    if (!station) {
      serve(tables.indexOf(nearby));
      return;
    }
    if (state.held) {
      carry(null);
      say('Objednávku můžeš vyzvednout znovu.');
      return;
    }
    const order = nextOrder(station);
    if (!order) return;
    state.selected = order.table;
    renderSelection();
    if (station === 'bar') {
      stopInput();
      pourGame.open(order);
      pourGame.updateTime(secondsUntil(order));
      return;
    }
    carry(order);
    restaurantAudio.cue('click');
    say(`${order.item.name} patří ke stolu ${order.table + 1}.`);
  }

  function refreshAction() {
    const choices = state.done ? [lift] : [pass, bar, ...tables];
    let closest;
    let limit = 8.4;
    for (const spot of choices) {
      const distance = Math.hypot((spot.x - state.x) * 1.5, spot.y - state.y);
      if (distance < limit) {
        closest = spot;
        limit = distance;
      }
    }
    nearby = closest;
    let caption = 'Akce';
    if (nearby === lift) caption = 'Nastoupit';
    else if (nearby === pass) caption = state.held ? 'Odložit' : nextOrder('pass') ? 'Vzít jídlo' : 'Bez jídel';
    else if (nearby === bar) caption = state.held ? 'Odložit' : nextOrder('bar') ? 'Připravit drink' : 'Bez drinků';
    else if (nearby) caption = 'Obsloužit';
    const name = nearby?.name ?? (state.done ? 'Přistup k výtahu' : 'Přistup ke stanovišti');
    if (actionName.textContent !== caption) actionName.textContent = caption;
    if (actionSpot.textContent !== name) actionSpot.textContent = name;
    action.disabled = !nearby || caption === 'Bez jídel' || caption === 'Bez drinků';
  }

  function blocked() {
    return document.hidden || pourGame.isOpen() || Boolean(find('dialog[open]'));
  }

  function nearestAngle(dx, dy) { return (Math.round(Math.atan2(dx, -dy) / turn) + 8) % 8; }

  function showStick(direction, dx = 0, dy = 0) {
    stick.style.setProperty('--stick-x', `${dx}px`);
    stick.style.setProperty('--stick-y', `${dy}px`);
    marks.forEach((mark, index) => mark.classList.toggle('is-active', index === direction));
  }

  function slide(event) {
    if (event.pointerId !== pointer) return;
    const rect = stick.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy);
    touchDirection = distance < 7 ? -1 : nearestAngle(dx, dy);
    const reach = Math.min(1, rect.width * .25 / Math.max(distance, 1));
    showStick(touchDirection, touchDirection < 0 ? 0 : dx * reach, touchDirection < 0 ? 0 : dy * reach);
  }

  function stopInput() {
    const id = pointer;
    pointer = null;
    touchDirection = -1;
    keys.clear();
    showStick(-1);
    if (id !== null && stick.hasPointerCapture(id)) stick.releasePointerCapture(id);
  }

  stick.addEventListener('pointerdown', event => {
    if (blocked() || pointer !== null || event.button !== 0) return;
    pointer = event.pointerId;
    stick.setPointerCapture(pointer);
    slide(event);
  });
  stick.addEventListener('pointermove', slide);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, event => { if (event.pointerId === pointer) stopInput(); });
  }
  for (const element of [stick, board]) {
    element.addEventListener('contextmenu', event => event.preventDefault());
  }

  function key(event) { return event.key.length === 1 ? event.key.toLowerCase() : event.key; }

  document.addEventListener('keydown', event => {
    if (blocked() || event.ctrlKey || event.metaKey || event.altKey) return;
    const name = key(event);
    if (walkKeys.includes(name)) {
      event.preventDefault();
      keys.add(name);
    } else if (name === 'e' && !event.repeat) {
      event.preventDefault();
      interact();
    }
  });
  document.addEventListener('keyup', event => keys.delete(key(event)));
  document.addEventListener('visibilitychange', () => {
    time = undefined;
    if (document.hidden) stopInput();
  });
  window.addEventListener('blur', stopInput);
  window.addEventListener('pagehide', stopInput);
  menu.addEventListener('click', stopInput);
  action.addEventListener('click', interact);

  function direction() {
    if (touchDirection >= 0) return touchDirection;
    const [north, east, south, west] = walkKeys.slice(0, 4).map((name, index) => keys.has(name) || keys.has(walkKeys[index + 4]));
    const dx = Number(east) - Number(west);
    const dy = Number(south) - Number(north);
    return dx || dy ? nearestAngle(dx, dy) : -1;
  }

  function walkable(x, y) {
    return x >= 5 && x <= 95 && y >= (x >= 51 ? 34.1 : 29.8) && y <= 90 &&
      !furniture.some(([left, right, top, bottom]) => x > left && x < right && y > top && y < bottom);
  }

  function drawCourier(delta, moving) {
    if (moving >= 0) {
      const angle = moving * turn;
      const x = state.x + Math.sin(angle) * 30 * delta;
      const y = state.y - Math.cos(angle) * 45 * delta;
      const oldX = state.x;
      const oldY = state.y;
      if (walkable(x, state.y)) state.x = x;
      if (walkable(state.x, y)) state.y = y;
      if (oldX !== state.x || oldY !== state.y) state.step += delta * 12;
      state.facing = moving;
    } else state.step = 0;
    waiter.toggleAttribute('data-west', state.facing >= 5);
    sprite.style.backgroundPosition = `${Math.floor(state.step) % 8 * 100 / 7}% ${directionRows[state.facing] * 100 / 7}%`;
    place(waiter, state.x, state.y);
  }

  function update(timestamp) {
    const elapsed = time === undefined ? 0 : (timestamp - time) / 1000;
    time = timestamp;
    const canMove = !blocked();
    if (canMove) {
      const moving = direction();
      if (moving >= 0 && !state.done) state.started = true;
      drawCourier(Math.min(.047, elapsed), moving);
      refreshAction();
    }
    if (state.started && !state.done && (canMove || (pourGame.isOpen() && !document.hidden))) {
      state.elapsed += elapsed;
      replaceExpiredOrders();
      updateTimers();
    }
    requestAnimationFrame(update);
  }

  function reset(resume = false) {
    clearTimeout(doorTimer);
    doorTimer = undefined;
    stopInput();
    pourGame.close();
    elevator.reset();
    liftDoors.hidden = liftSign.hidden = true;
    liftDoors.classList.remove('is-open');
    state = {x: 38, y: 57.6, facing: 0, step: 0, elapsed: 0, held: null, orders: [], selected: 0,
      served: 0, missed: 0, started: false, done: false};
    const checkpoint = resume ? balikProgress.checkpoint('2') : 'playing';
    if (checkpoint === 'carrying' || checkpoint === 'installed') {
      state.x = lift.x;
      state.y = lift.y;
      state.served = total;
      state.orders = tables.map(() => null);
      complete(checkpoint === 'carrying' ? 'Mám tlačítko 3. Zacvaknu ho ve výtahu.' : 'Hosté jsou obsloužení. Můžu zpátky do výtahu.');
    } else {
      state.orders = tables.map((_, index) => orderFor(index, 0, index * 3));
      say('Deset objednávek za tlačítko 3. Čas běží od prvního pohybu. Začnu špagetami pro stůl 1.');
    }
    carry(null);
    renderTickets();
    drawCourier(0, -1);
  }

  find('#reset').addEventListener('click', () => reset());
  reset(true);
  requestAnimationFrame(update);
})();
