(() => {
  'use strict';

  const find = selector => document.querySelector(selector);
  const asset = name => `art/${name}.png`;
  const game = find('.game');
  const board = find('.kitchen');
  const actor = find('.actor');
  const sprite = find('.player-sprite');
  const heldImage = find('.held');
  const stationLabel = find('.station');
  const burnerControls = find('.burner-controls');
  const burnerFocus = find('.burner-focus');
  const action = find('.action');
  const actionLabel = find('.action-label');
  const actionGlyph = find('.action-glyph');
  const tickets = find('.tickets');
  const served = find('.served');
  const panel = find('#kitchen-panel');
  const panelTitle = find('#panel-title');
  const panelBody = find('.panel-body');
  const stick = find('.stick');
  const menuToggle = find('#balik-menu-toggle');
  const soundToggle = find('#sound-toggle');
  const statusName = find('.status-name');
  const statusMessage = find('.status-message');

  const ingredients = {
    egg: ['Vejce', 'raw-egg'], pasta: ['Těstoviny', 'pasta'], sauce: ['Omáčka', 'sauce'],
    water: ['Voda', 'water'], veg: ['Zelenina', 'tomato'], choppedVeg: ['Nakrájená zelenina', 'tomato'],
    beef: ['Hovězí', 'beef'], spice: ['Koření', 'spice'], ham: ['Šunka', 'ham'], choppedHam: ['Nakrájená šunka', 'ham'],
    cheese: ['Sýr', 'cheese'], rice: ['Rýže', 'rice'], chicken: ['Kuřecí', 'chicken'], choppedChicken: ['Nakrájené kuřecí', 'chicken']
  };
  const chopped = {veg: 'choppedVeg', ham: 'choppedHam', chicken: 'choppedChicken'};
  const prepNames = {choppedVeg: 'zeleninu', choppedHam: 'šunku', choppedChicken: 'kuřecí'};
  const recipes = {
    egg: {name: 'Smažené vejce', art: 'fried-egg', base: ['egg'], seconds: 5, finish: [], limit: 110},
    pasta: {name: 'Špagety', art: 'spaghetti', base: ['pasta'], seconds: 12, finish: ['sauce'], limit: 150},
    soup: {name: 'Zeleninová polévka', art: 'soup', base: ['water', 'choppedVeg'], seconds: 15, finish: [], limit: 175},
    steak: {name: 'Steak', art: 'steak', base: ['beef'], seconds: 10, finish: ['spice'], limit: 150},
    omelet: {name: 'Omeleta', art: 'omelet', base: ['egg', 'choppedHam', 'cheese'], seconds: 8, finish: [], limit: 185},
    risotto: {name: 'Kuřecí rizoto', art: 'risotto', base: ['rice', 'choppedChicken', 'veg'], seconds: 18, finish: [], limit: 210}
  };
  const queue = ['egg', 'pasta', 'steak', 'soup', 'egg', 'omelet', 'pasta', 'risotto', 'steak', 'soup'];
  const pantry = ['pasta', 'sauce', 'water', 'spice', 'rice'];
  const fridge = ['egg', 'veg', 'beef', 'ham', 'cheese', 'chicken'];
  const burnerRows = [41.2, 45.5, 49.7, 54];
  const stove = {type: 'stove', name: 'Sporák', x: 20.3, label: [10, 31]};
  const counters = [39.4, 46.1, 52.5].map((y, index) => ({type: 'plate', index, name: 'Kompletační pult', x: 76.6, y, label: [84, 58.7]}));
  const stations = [
    {type: 'stock', name: 'Špajz', items: pantry, x: 25, y: 32.9, label: [25, 27]},
    {type: 'stock', name: 'Lednice', items: fridge, x: 49.2, y: 33.4, label: [49.5, 12.4]},
    {type: 'serve', name: 'Výdej', x: 77.5, y: 32.7, label: [77.4, 24.6]},
    {type: 'chop', name: 'Prkénko', x: 48, y: 38.7, label: [48, 57.8]},
    {type: 'chop', name: 'Prkénko', x: 48, y: 64.5, label: [48, 57.8]},
    {type: 'trash', name: 'Koš', x: 16, y: 75.5, label: [10, 69.4]},
    {type: 'finish', name: 'Výtah', x: 50, y: 74.8, label: [50, 81.2]},
    stove, ...counters
  ];
  const obstacles = [[2, 15.5, 29, 66.6], [34.4, 62, 40.2, 61.8], [80.2, 96.7, 32, 67.5], [4, 14.1, 71.3, 80.2], [29.8, 70, 77.1, 90]];
  const directionNames = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const walkRows = [4, 3, 2, 1, 0, 7, 6, 5];
  const actionRows = [2, 1, 1, 1, 0, 3, 3, 3];
  const turn = Math.PI / 4;
  const marks = directionNames.map((_, index) => {
    const mark = document.createElement('span');
    mark.className = 'stick-mark';
    mark.style.setProperty('--angle', `${index * 45}deg`);
    find('.stick-marks').append(mark);
    return mark;
  });

  function place(element, x, y) {
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;
  }

  function effect(x, y) {
    const element = document.createElement('div');
    element.className = 'work-item';
    place(element, x, y);
    const image = document.createElement('img');
    image.alt = '';
    const time = document.createElement('span');
    element.append(image, time);
    find('.kitchen-effects').append(element);
    return {element, image, time};
  }

  const stoveViews = burnerRows.map(y => effect(9.35, y));
  const burnerButtons = burnerRows.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Plotýnka ${index + 1}`);
    const statusId = `burner-status-${index + 1}`;
    button.setAttribute('aria-describedby', statusId);
    button.innerHTML = `<span class="burner-number">${index + 1}</span><span class="burner-status" id="${statusId}"></span>`;
    button.addEventListener('click', () => selectBurner(index));
    burnerControls.append(button);
    return {button, status: button.lastElementChild};
  });
  const plateViews = counters.map(station => effect(87.3, station.y));
  const boardView = effect(46, 45.3);
  const keys = new Set();
  let state;
  let nearby;
  let pointer;
  let touchDirection = -1;
  let lastTime;
  let lastAction;
  let entranceTimer;

  // Safari can dispatch native menu and pinch events in addition to pointer events.
  for (const type of ['contextmenu', 'gesturestart', 'gesturechange']) {
    game.addEventListener(type, event => event.preventDefault(), {passive: false});
  }

  function item(kind) { return {kind}; }
  function dish(key, count = 0) { return {key, count}; }
  function picture(food) { return food.burned ? 'burned' : food.key ? recipes[food.key].art : ingredients[food.kind][1]; }
  function nameOf(food) { return food.burned ? 'Připálené jídlo' : food.key ? recipes[food.key].name : ingredients[food.kind][0]; }
  function timeText(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function say(name, message) {
    statusName.textContent = name;
    statusMessage.textContent = message;
  }

  const SoundContext = window.AudioContext || window.webkitAudioContext;
  let context;
  let soundMixer;
  const cuePatterns = {
    pickup: [325, 494], put: [294], chop: [355, 250, 330],
    ready: [494, 660, 880], serve: [440, 554, 660], error: [170, 149]
  };
  function sound(cue) {
    if (!context || context.state !== 'running' || !balikSound.isPageActive()) return;
    cuePatterns[cue].forEach((pitch, index) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime + index * .075;
      tone.type = cue === 'chop' ? 'triangle' : 'sine';
      tone.frequency.value = pitch;
      gain.gain.setValueAtTime(.055, time);
      gain.gain.exponentialRampToValueAtTime(.001, time + .09);
      tone.connect(gain).connect(soundMixer.effects);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(time);
      tone.stop(time + .095);
    });
  }
  function unlockSound() {
    if (!SoundContext || !balikSound.isPageActive()) return;
    if (!context) {
      try { context = new SoundContext(); } catch { return; }
      soundMixer = balikSound.createMixer(context);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }
  document.addEventListener('pointerdown', unlockSound, true);
  document.addEventListener('pointerup', unlockSound, true);
  document.addEventListener('keydown', unlockSound, true);
  balikSound.bindSpeaker(soundToggle);

  function openPanel(title) {
    panelTitle.textContent = title;
    panelBody.replaceChildren();
    if (!panel.open) panel.showModal();
  }
  function panelButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    panelBody.append(button);
    return button;
  }
  function viewRecipe(key) {
    const recipe = recipes[key];
    openPanel(recipe.name);
    const list = document.createElement('ol');
    const prep = recipe.base.filter(kind => prepNames[kind]);
    for (const step of [
      ...prep.map(kind => `Na prkénku nakrájej ${prepNames[kind]} a pak surovinu zvedni.`),
      `Na volnou plotýnku polož v tomto pořadí: ${recipe.base.map(kind => ingredients[kind][0].toLowerCase()).join(' → ')}.`,
      `Stiskni Vařit. Po ${recipe.seconds} s jídlo zvedni.`,
      ...recipe.finish.map(kind => `Polož jídlo na kompletační pult a přidej: ${ingredients[kind][0].toLowerCase()}. Pak ho zvedni.`),
      'Hotové jídlo polož do výdejního okénka.'
    ]) {
      const li = document.createElement('li');
      li.textContent = step;
      list.append(li);
    }
    panelBody.append(list);
  }

  function openTicket(key) {
    const recipe = recipes[key];
    const wrapper = document.createElement('li');
    wrapper.className = 'ticket';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `${recipe.name} – recept`);
    button.innerHTML = `<img src="${asset(recipe.art)}" alt=""><span class="ticket-copy"><strong class="dish">${recipe.name}</strong><span class="order-time"></span></span><span class="progress"><span></span></span>`;
    button.addEventListener('click', () => viewRecipe(key));
    wrapper.append(button);
    tickets.append(wrapper);
    return {key, until: state.time + recipe.limit, wrapper, time: button.querySelector('.order-time'), fill: button.querySelector('.progress span')};
  }
  function refill() {
    const count = state.completed === 0 ? 1 : 3;
    while (state.orders.length < count && state.next < queue.length) {
      state.orders.push(openTicket(queue[state.next++]));
    }
    state.orders.forEach((order, index) => order.wrapper.classList.toggle('is-current', index === 0));
    served.innerHTML = `Vydáno <strong>${state.completed} / ${queue.length}</strong>`;
  }

  function moveItem(food, gesture, cue) {
    state.held = food;
    state.gesture = {time: state.time, gesture};
    sound(cue);
  }
  function invalid(message) {
    say('Kuchyně', message);
    sound('error');
  }
  function completeDish(food) { return food.key && !food.burned && food.count === recipes[food.key].finish.length; }
  function matchingRecipes(parts) {
    return Object.entries(recipes).filter(([, recipe]) =>
      parts.length <= recipe.base.length && parts.every((kind, index) => recipe.base[index] === kind));
  }

  function stockAction(station) {
    if (state.held) {
      if (!station.items.includes(state.held.kind)) return ['Odlož', 'cloche'];
      return ['Vrátit', picture(state.held), () => {
        say(station.name, `Vráceno. ${nameOf(state.held)} je zase na místě.`);
        moveItem(null, 'put', 'put');
      }];
    }
    return ['Zvednout', station.items === fridge ? 'raw-egg' : 'pasta', () => {
      openPanel(station.name);
      for (const kind of station.items) {
        const [name, art] = ingredients[kind];
        const option = panelButton(name, () => {
          panel.close();
          moveItem(item(kind), 'take', 'pickup');
          const advice = chopped[kind] ? 'Prkénko je uprostřed kuchyně.' : kind === 'egg' ? 'Polož ho na plotýnku a stiskni Vařit.' : 'Postup najdeš klepnutím na objednávku.';
          say(name, advice);
          refresh();
        });
        const image = document.createElement('img');
        image.src = asset(art);
        image.alt = '';
        option.prepend(image);
      }
    }];
  }

  function chopAction() {
    if (state.chopping) {
      if (state.time < state.chopping.until) return ['Krájení…', 'knife'];
      if (state.held) return ['Odlož', 'knife'];
      return ['Zvednout', picture(state.chopping.food), () => {
        const food = state.chopping.food;
        state.chopping = null;
        moveItem(food, 'take', 'pickup');
        say('V ruce', nameOf(food));
      }];
    }
    if (!state.held || !chopped[state.held.kind]) return ['Krájet', 'knife'];
    return ['Krájet', 'knife', () => {
      state.chopping = {food: item(chopped[state.held.kind]), until: state.time + 1.4};
      moveItem(null, 'chop', 'chop');
      say('Prkénko', 'Jakmile je zelený ukazatel plný, surovinu můžeš zvednout.');
    }];
  }

  function burnerAction(index) {
    const burner = state.burners[index];
    if (burner.key) {
      if (burner.until > state.time) return ['Vaří se…', recipes[burner.key].art];
      const burned = state.time >= burner.until + 21;
      if (state.held) return ['Odlož', burned ? 'burned' : recipes[burner.key].art];
      return ['Zvednout', burned ? 'burned' : recipes[burner.key].art, () => {
        const food = {...dish(burner.key), burned};
        state.burners[index] = {parts: []};
        moveItem(food, 'take', 'pickup');
        say('V ruce', burned ? 'Připálené jídlo. Vyhoď ho do koše.' : recipes[food.key].finish.length ? `${nameOf(food)} patří na kompletační pult.` : `${nameOf(food)} můžeš odnést do výdeje.`);
      }];
    }
    if (state.held) {
      const part = state.held.kind;
      return ['Položit', picture(state.held), () => {
        const parts = [...burner.parts, part];
        if (!matchingRecipes(parts).length) return invalid('Tahle surovina sem teď nepatří. Zkontroluj pořadí v receptu.');
        burner.parts = parts;
        moveItem(null, 'put', 'put');
        const ready = matchingRecipes(parts).some(([, recipe]) => recipe.base.length === parts.length);
        say(`Plotýnka ${index + 1}`, ready ? 'Stiskni Vařit, nebo přidej další surovinu podle receptu.' : 'Přines další surovinu podle receptu.');
      }];
    }
    const result = matchingRecipes(burner.parts).find(([, recipe]) => recipe.base.length === burner.parts.length);
    if (result) {
      const [key, recipe] = result;
      return ['Vařit', recipe.art, () => {
        state.burners[index] = {key, until: state.time + recipe.seconds, notified: false};
        state.gesture = {time: state.time, gesture: 'put'};
        say(`Plotýnka ${index + 1}`, `${recipe.name} se vaří. Mezitím můžeš připravit další objednávku.`);
        sound('put');
      }];
    }
    if (!burner.parts.length) return ['Položit', 'cloche'];
    return ['Zvednout', picture(item(burner.parts[burner.parts.length - 1])), () => {
      const food = item(burner.parts.pop());
      moveItem(food, 'take', 'pickup');
      say('V ruce', nameOf(food));
    }];
  }

  function plateAction(index) {
    const plate = state.plates[index];
    if (!plate && state.held?.key && !state.held.burned) return ['Položit', picture(state.held), () => {
      const food = state.held;
      state.plates[index] = food;
      moveItem(null, 'put', 'put');
      const next = recipes[food.key].finish[food.count];
      say('Kompletace', next ? `Přines: ${ingredients[next][0].toLowerCase()}.` : 'Jídlo je hotové. Zvedni ho a odnes do výdeje.');
    }];
    if (plate && !state.held) return ['Zvednout', picture(plate), () => {
      state.plates[index] = null;
      moveItem(plate, 'take', 'pickup');
      say('V ruce', nameOf(plate));
    }];
    const finish = plate && recipes[plate.key].finish[plate.count];
    if (finish && state.held?.kind === finish) return ['Přidat', picture(state.held), () => {
      plate.count++;
      moveItem(null, 'put', 'put');
      say('Kompletace', 'Jídlo je hotové. Zvedni ho a odnes do výdeje.');
    }];
    return ['Položit', 'cloche'];
  }

  function award() {
    openPanel('Tlačítko 2');
    const text = document.createElement('p');
    text.textContent = '„Dobrá práce, šéfe. Tady máš tlačítko do restaurace.“';
    panelBody.append(text);
    panelButton('Vzít tlačítko 2', () => {
      state.reward = true;
      panel.close();
      say('Výtah', 'Máš tlačítko 2 – Restaurace.');
      sound('ready');
      refresh();
    });
  }

  function serve() {
    const food = state.held;
    if (!completeDish(food)) return invalid('Tohle ještě není hotové jídlo.');
    const index = state.orders.findIndex(order => order.key === food.key);
    if (index < 0) return invalid('Tohle jídlo teď nemá žádnou objednávku.');
    state.orders[index].wrapper.remove();
    state.orders.splice(index, 1);
    state.completed++;
    moveItem(null, 'put', 'serve');
    say('Výdej', `${nameOf(food)} vydáno.`);
    refill();
    if (state.completed === queue.length) award();
  }

  function details(station) {
    if (!station) return ['Akce', 'cloche'];
    if (station.type === 'stock') return stockAction(station);
    if (station.type === 'chop') return chopAction();
    if (station === stove) return burnerAction(state.selectedBurner);
    if (station.type === 'plate') return plateAction(station.index);
    if (station.type === 'serve') return ['Položit', state.held ? picture(state.held) : 'cloche', state.held && serve];
    if (station.type === 'trash') return ['Vyhodit', 'burned', state.held && (() => {
      moveItem(null, 'put', 'put');
      say('Koš', 'Prázdné ruce. Můžeš pokračovat.');
    })];
    if (state.completed === queue.length && !state.reward) return ['Zvednout', 'cloche', award];
    if (state.reward) return ['Tlačítko 2', 'cloche', () => say('Výtah', 'Tlačítko 2 máš. Restaurace přijde v dalším patře.')];
    return ['Výtah', 'cloche', () => say('Šéfkuchař', `Za ${queue.length} vydaných jídel dostaneš tlačítko 2.`)];
  }

  function nearest() {
    let best = null;
    let shortest = Infinity;
    for (const station of stations) {
      const y = station === stove ? Math.min(58, Math.max(38, state.y)) : station.y;
      const distance = Math.hypot((state.x - station.x) * board.clientWidth / 100, (state.y - y) * board.clientHeight / 100);
      const reach = station === stove ? 46 : station.type === 'plate' ? 25 : 34;
      if (distance < shortest && distance < reach) {
        shortest = distance;
        best = station;
      }
    }
    return best;
  }

  function markBurner() {
    burnerButtons.forEach(({button}, index) => button.setAttribute('aria-pressed', String(index === state.selectedBurner)));
    place(burnerFocus, 9.35, burnerRows[state.selectedBurner]);
  }

  function selectBurner(index) {
    if (nearest() !== stove) return;
    state.selectedBurner = index;
    markBurner();
    refresh();
  }

  function refresh() {
    const station = nearest();
    if (station !== nearby) {
      nearby = station;
      stationLabel.hidden = !station;
      burnerControls.hidden = burnerFocus.hidden = station !== stove;
      if (station) {
        place(stationLabel, ...station.label);
        stationLabel.textContent = station.name;
      }
    }
    const [label, icon, callback] = details(station);
    const signature = `${label}/${icon}/${!!callback}`;
    if (signature !== lastAction) {
      actionLabel.textContent = label;
      actionGlyph.style.backgroundImage = `url('${asset(icon)}')`;
      action.disabled = !callback;
      lastAction = signature;
    }
    if (state.held) {
      const source = asset(picture(state.held));
      if (heldImage.getAttribute('src') !== source) heldImage.src = source;
      heldImage.hidden = false;
      const label = `Kurýr drží: ${nameOf(state.held)}`;
      if (actor.getAttribute('aria-label') !== label) actor.setAttribute('aria-label', label);
    } else {
      heldImage.hidden = true;
      if (actor.getAttribute('aria-label') !== 'Kurýr s volnýma rukama') actor.setAttribute('aria-label', 'Kurýr s volnýma rukama');
    }
  }

  function showWork(view, food, text, mode = '') {
    const source = food ? asset(picture(food)) : '';
    if (food && view.image.getAttribute('src') !== source) view.image.src = source;
    view.image.hidden = !food;
    if (view.time.textContent !== text) view.time.textContent = text;
    view.time.hidden = !text;
    view.element.hidden = !food && !text;
    if (view.element.dataset.mode !== mode) view.element.dataset.mode = mode;
  }
  function showBurnerStatus(index, text, mode = '') {
    const {button, status} = burnerButtons[index];
    if (status.textContent !== text) status.textContent = text;
    if (button.dataset.mode !== mode) button.dataset.mode = mode;
  }
  function tickTimers() {
    for (const order of state.orders) {
      if (state.time >= order.until) {
        order.until = state.time + recipes[order.key].limit;
        say('Objednávka', 'Čas vypršel. Objednávka se obnovila.');
      }
      const seconds = order.until - state.time;
      const percent = seconds / recipes[order.key].limit;
      const timer = timeText(seconds);
      if (order.time.textContent !== timer) order.time.textContent = timer;
      order.fill.style.width = `${percent * 100}%`;
      order.wrapper.classList.toggle('is-urgent', percent < .35);
    }
    state.burners.forEach((burner, index) => {
      if (!burner.key) {
        const latest = burner.parts[burner.parts.length - 1];
        showWork(stoveViews[index], latest ? item(latest) : null, '');
        showBurnerStatus(index, latest ? 'Suroviny' : 'Volná');
        return;
      }
      const remaining = burner.until - state.time;
      if (remaining > 0) {
        const time = timeText(remaining);
        showWork(stoveViews[index], dish(burner.key), time, 'cooking');
        showBurnerStatus(index, time, 'cooking');
      } else if (remaining <= -21) {
        showWork(stoveViews[index], {...dish(burner.key), burned: true}, '', 'burned');
        showBurnerStatus(index, 'Připáleno', 'burned');
      } else {
        showWork(stoveViews[index], dish(burner.key), 'Hotovo', 'ready');
        showBurnerStatus(index, 'Hotovo', 'ready');
        if (!burner.notified) {
          burner.notified = true;
          sound('ready');
        }
      }
    });
    state.plates.forEach((food, index) => showWork(plateViews[index], food, ''));
    const work = state.chopping;
    const cut = work ? Math.min(100, Math.round((1 - (work.until - state.time) / 1.4) * 100)) : 0;
    showWork(boardView, work?.food, work ? `${cut} %` : '', work ? 'ready' : '');
  }

  function useAction() {
    if (panel.open || find('#balik-menu')?.open) return;
    const station = nearest();
    const [, , callback] = details(station);
    if (!callback) return;
    state.started = true;
    state.facing = closestDirection(station);
    callback();
    refresh();
    tickTimers();
  }
  action.addEventListener('click', useAction);

  function nearestAngle(dx, dy) { return (Math.round(Math.atan2(dx, -dy) / turn) + 8) % 8; }
  function closestDirection(station) {
    if (station === stove) return 6;
    if (station.type === 'plate') return 2;
    if (station.type === 'chop') return state.y < 50 ? 4 : 0;
    if (station.type === 'trash') return 6;
    if (station.type === 'finish') return 4;
    return 0;
  }
  function sticks(index, x = 0, y = 0) {
    stick.style.setProperty('--stick-x', `${x}px`);
    stick.style.setProperty('--stick-y', `${y}px`);
    if (index < 0) delete stick.dataset.direction;
    else stick.dataset.direction = directionNames[index];
    marks.forEach((mark, step) => mark.classList.toggle('is-active', step === index));
  }
  function slide(event) {
    if (event.pointerId !== pointer) return;
    const bounds = stick.getBoundingClientRect();
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    const distance = Math.hypot(dx, dy);
    if (distance < 9) {
      touchDirection = -1;
      sticks(-1);
      return;
    }
    touchDirection = nearestAngle(dx, dy);
    const fraction = Math.min(1, bounds.width * .235 / distance);
    sticks(touchDirection, dx * fraction, dy * fraction);
  }
  function stopInput() {
    const captured = pointer;
    pointer = undefined;
    touchDirection = -1;
    keys.clear();
    sticks(-1);
    if (captured !== undefined && stick.hasPointerCapture(captured)) stick.releasePointerCapture(captured);
  }
  stick.addEventListener('pointerdown', event => {
    if (pointer !== undefined || event.button !== 0) return;
    pointer = event.pointerId;
    stick.setPointerCapture(pointer);
    slide(event);
  });
  stick.addEventListener('pointermove', slide);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, event => { if (event.pointerId === pointer) stopInput(); });
  }
  const walkKeys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'w', 'd', 's', 'a'];
  document.addEventListener('keydown', event => {
    if (panel.open || find('#balik-menu')?.open || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (walkKeys.includes(key)) {
      event.preventDefault();
      keys.add(key);
    } else if (/^[1-4]$/.test(key) && !event.repeat) {
      selectBurner(Number(key) - 1);
    } else if (key === 'e' && !event.repeat) {
      useAction();
    }
  });
  document.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener('blur', stopInput);
  window.addEventListener('pagehide', stopInput);
  menuToggle.addEventListener('click', stopInput);

  function directionFromInput() {
    if (touchDirection >= 0) return touchDirection;
    const [north, east, south, west] = walkKeys.slice(0, 4).map((key, index) => keys.has(key) || keys.has(walkKeys[index + 4]));
    const dx = Number(east) - Number(west);
    const dy = Number(south) - Number(north);
    return dx || dy ? nearestAngle(dx, dy) : -1;
  }
  function walkable(x, y) {
    return x >= 4 && x <= 96 && y >= 30.7 && y <= 88 &&
      !obstacles.some(([left, right, top, bottom]) => x > left && x < right && y > top && y < bottom);
  }
  function drawCourier(direction, delta) {
    if (direction >= 0) {
      state.started = true;
      state.facing = direction;
      const speed = Math.min(board.clientWidth * .43, 172) * delta;
      const nextX = state.x + Math.sin(direction * turn) * speed * 100 / board.clientWidth;
      const nextY = state.y - Math.cos(direction * turn) * speed * 100 / board.clientHeight;
      if (walkable(nextX, state.y)) state.x = nextX;
      if (walkable(state.x, nextY)) state.y = nextY;
    }
    const active = state.gesture;
    const elapsed = active ? state.time - active.time : 0;
    const animateGesture = active && direction < 0 && elapsed < (active.gesture === 'chop' ? 1.4 : .43);
    const diagonal = state.facing % 2 === 1;
    let row, frame, atlas;
    if (direction >= 0 || (!animateGesture && diagonal)) {
      atlas = 'walk';
      row = walkRows[state.facing];
      frame = direction >= 0 ? Math.floor(state.time * 13) % 8 : 0;
    } else {
      atlas = 'action';
      row = actionRows[state.facing];
      if (animateGesture && active.gesture === 'put') row += 4;
      frame = !animateGesture ? (state.held ? 7 : 0) : active.gesture === 'chop' ? 1 + Math.floor(elapsed * 16) % 4 : Math.min(7, Math.floor(elapsed * 19));
    }
    if (sprite.dataset.atlas !== atlas) sprite.dataset.atlas = atlas;
    sprite.style.backgroundPosition = `${frame * 100 / 7}% ${row * 100 / 7}%`;
    actor.dataset.facing = directionNames[state.facing];
    place(actor, state.x, state.y);
  }

  function update(timestamp) {
    const delta = lastTime === undefined ? 0 : Math.min(.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    if (!document.hidden && !panel.open && !find('#balik-menu')?.open) {
      const direction = directionFromInput();
      if (state.started) state.time += delta;
      drawCourier(direction, delta);
      tickTimers();
      refresh();
    }
    requestAnimationFrame(update);
  }

  function reset() {
    stopInput();
    clearTimeout(entranceTimer);
    tickets.replaceChildren();
    state = {x: 50, y: 73.4, facing: 0, held: null, gesture: null, chopping: null, time: 0, started: false,
      completed: 0, next: 0, orders: [], selectedBurner: 0, burners: burnerRows.map(() => ({parts: []})), plates: counters.map(() => null), reward: false};
    markBurner();
    refill();
    drawCourier(-1, 0);
    tickTimers();
    refresh();
    say('Kurýr', '„Dobře. Ale vařím naposledy.“');
    entranceTimer = setTimeout(() => {
      if (!state.held && state.completed === 0 && statusName.textContent === 'Kurýr') {
        say('První objednávka', 'Vezmi vejce z lednice. Klepnutím na objednávku otevřeš recept.');
      }
    }, 3900);
  }
  find('#reset').addEventListener('click', reset);
  reset();
  requestAnimationFrame(update);
})();
