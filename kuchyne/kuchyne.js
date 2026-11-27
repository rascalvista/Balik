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
  const plateFocus = find('.plate-focus');
  const guideTarget = find('.guide-target');
  const cook = find('.cook');
  const cookCarry = find('.cook-carry');
  const preview = find('.recipe-preview');
  const kitchenLift = find('.kitchen-lift');
  const liftReturn = find('.lift-return');
  const handoff = find('.handoff');
  const action = find('.action');
  const actionLabel = find('.action-label');
  const actionGlyph = find('.action-glyph');
  const tickets = find('.tickets');
  const served = find('.served');
  const panel = find('#kitchen-panel');
  const panelTitle = find('#panel-title');
  const panelBody = find('.panel-body');
  const panelClose = find('.panel-close');
  const stick = find('.stick');
  const menuToggle = find('#balik-menu-toggle');
  const soundToggle = find('#sound-toggle');
  const statusName = find('.status-name');
  const statusMessage = find('.status-message');

  const ingredients = {
    egg: ['Vejce', 'raw-egg'], pasta: ['Těstoviny', 'pasta'], sauce: ['Omáčka', 'sauce'],
    water: ['Voda', 'water'], veg: ['Zelenina', 'tomato'], choppedVeg: ['Nakrájená zelenina', 'chopped-veg'],
    beef: ['Hovězí', 'beef'], spice: ['Koření', 'spice'], ham: ['Šunka', 'ham'], choppedHam: ['Nakrájená šunka', 'chopped-ham'],
    cheese: ['Sýr', 'cheese'], choppedCheese: ['Nakrájený sýr', 'chopped-cheese'],
    rice: ['Rýže', 'rice'], chicken: ['Kuřecí', 'chicken'], choppedChicken: ['Nakrájené kuřecí', 'chopped-chicken']
  };
  const chopped = {veg: 'choppedVeg', ham: 'choppedHam', chicken: 'choppedChicken', cheese: 'choppedCheese'};
  const prepNames = {choppedVeg: 'zeleninu', choppedHam: 'šunku', choppedChicken: 'kuřecí', choppedCheese: 'sýr'};
  const recipes = {
    egg: {name: 'Smažené vejce', art: 'fried-egg', base: ['egg'], seconds: 5, finish: []},
    pasta: {name: 'Špagety', art: 'spaghetti', base: ['pasta'], seconds: 12, finish: ['sauce'], limit: 150, pot: true},
    soup: {name: 'Zeleninová polévka', art: 'soup', base: ['water', 'choppedVeg'], seconds: 15, finish: [], limit: 175, pot: true},
    steak: {name: 'Steak', art: 'steak', base: ['beef'], seconds: 10, finish: ['spice'], limit: 150},
    omelet: {name: 'Omeleta', art: 'omelet', base: ['egg', 'choppedHam', 'choppedCheese'], seconds: 8, finish: [], limit: 185},
    risotto: {name: 'Kuřecí rizoto', art: 'risotto', base: ['rice', 'choppedChicken', 'veg'], seconds: 18, finish: [], limit: 210, pot: true}
  };
  const queue = ['egg', 'pasta', 'steak', 'soup', 'omelet', 'risotto'];
  const readyGrace = 45;
  const pantry = ['pasta', 'sauce', 'water', 'spice', 'rice'];
  const fridge = ['egg', 'veg', 'beef', 'ham', 'cheese', 'chicken'];
  const burnerRows = [41.2, 45.5, 49.7, 54];
  const stove = {type: 'stove', name: 'Sporák', x: 20.3, label: [10, 31]};
  const counters = [39.4, 46.1, 52.5].map((y, index) => ({type: 'plate', index, name: `Talíř ${index + 1}`, x: 76.6, y, label: [84, 58.7]}));
  const cuttingSides = [[48, 38.7, 4, 34], [48, 64.5, 0, 34], [32, 52.5, 2, 22], [65, 52.5, 6, 22]];
  const coachHome = [34, 72];
  const stations = [
    {type: 'stock', name: 'Špajz', items: pantry, x: 25, y: 32.9, label: [25, 27]},
    {type: 'stock', name: 'Lednice', items: fridge, x: 49.2, y: 33.4, label: [49.5, 12.4]},
    {type: 'serve', name: 'Výdej', x: 77.5, y: 32.7, label: [77.4, 24.6]},
    ...cuttingSides.map(([x, y, facing, reach]) => ({type: 'chop', name: 'Prkénko', x, y, facing, reach, label: [48, 57.8]})),
    {type: 'trash', name: 'Koš', x: 16, y: 75.5, label: [10, 69.4]},
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

  const stoveViews = burnerRows.map(y => {
    const pan = document.createElement('img');
    pan.className = 'burner-pan';
    pan.src = asset('pan');
    pan.alt = '';
    place(pan, 9.35, y);
    find('.kitchen-effects').append(pan);
    const view = effect(9.35, y);
    view.element.classList.add('stove-item');
    return {...view, vessel: pan};
  });
  const burnerButtons = burnerRows.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Plotýnka ${index + 1}`);
    const itemId = `burner-item-${index + 1}`;
    const statusId = `burner-status-${index + 1}`;
    button.setAttribute('aria-describedby', `${itemId} ${statusId}`);
    button.innerHTML = `<span class="burner-number">${index + 1}</span><span class="burner-item" id="${itemId}"></span><span class="burner-status" id="${statusId}"></span>`;
    button.addEventListener('click', () => selectBurner(index));
    burnerControls.append(button);
    return {button, item: button.querySelector('.burner-item'), status: button.lastElementChild};
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
  let guideStep;

  const viewport = window.visualViewport;
  const isZoomed = () => (viewport?.scale ?? 1) > 1.015;
  function syncZoom() { game.classList.toggle('is-zoomed', isZoomed()); }
  viewport?.addEventListener('resize', syncZoom);
  syncZoom();

  for (const surface of [game, panel]) {
    const taps = new Map();
    surface.addEventListener('touchstart', event => {
      for (const touch of event.changedTouches) {
        const button = touch.target.closest?.('button');
        taps.set(touch.identifier, {button, x: touch.clientX, y: touch.clientY});
      }
    }, {passive: true});
    surface.addEventListener('touchmove', event => {
      for (const touch of event.changedTouches) {
        const tap = taps.get(touch.identifier);
        if (tap && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 12) taps.delete(touch.identifier);
      }
    }, {passive: true});
    surface.addEventListener('touchend', event => {
      for (const touch of event.changedTouches) {
        const tap = taps.get(touch.identifier);
        taps.delete(touch.identifier);
        if (!tap || !event.cancelable || isZoomed()) continue;
        // Handle the tap once while suppressing Safari's synthesized tap and double-tap zoom.
        event.preventDefault();
        if (tap.button && !tap.button.disabled && tap.button.contains(document.elementFromPoint(touch.clientX, touch.clientY))) {
          tap.button.click();
        }
      }
    }, {passive: false});
    surface.addEventListener('touchcancel', event => {
      for (const touch of event.changedTouches) taps.delete(touch.identifier);
    }, {passive: true});
    surface.addEventListener('contextmenu', event => event.preventDefault());
    for (const type of ['gesturestart', 'gesturechange']) {
      surface.addEventListener(type, event => {
        // If the browser was already zoomed, allow the player to pinch back out.
        if (!isZoomed()) event.preventDefault();
      }, {passive: false});
    }
  }

  function item(kind) { return {kind}; }
  function dish(key, count = 0) { return {key, count}; }
  function picture(food) {
    if (food.burned) return 'burned';
    if (!food.key) return ingredients[food.kind][1];
    const art = recipes[food.key].art;
    return food.plated ? art : `${art}-cooking`;
  }
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

  function openPanel(title, closeLabel = 'Zavřít') {
    panelTitle.textContent = title;
    panelClose.textContent = closeLabel;
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

  function openCoach() {
    if (state.scene || state.reward) return;
    const canDemonstrate = !state.started;
    openPanel('Kuchtík', canDemonstrate ? 'Přeskočit ukázku' : 'Jdeme vařit');
    const text = document.createElement('p');
    text.className = 'cook-intro';
    const portrait = document.createElement('img');
    portrait.src = asset('cook');
    portrait.alt = '';
    text.append(portrait, canDemonstrate ? 'Ukážu ti, jak usmažit a vydat první vejce.' : 'Palcem táhni po levém ovladači. Šipka ti ukáže, kam jít.');
    const steps = document.createElement('ol');
    steps.className = 'cook-steps';
    for (const [icon, label] of [['raw-egg', 'Vezmi vejce'], ['pan', 'Usmaž ho'], ['fried-egg', 'Dej na talíř'], ['cloche', 'Odnes do výdeje']]) {
      const step = document.createElement('li');
      const image = document.createElement('img');
      image.src = asset(icon);
      image.alt = '';
      step.append(image, label);
      steps.append(step);
    }
    panelBody.append(text, steps);
    if (canDemonstrate) panelButton('Předveď mi to', runDemo).focus();
  }
  cook.addEventListener('click', openCoach);

  function viewRecipe(key) {
    if (state.scene || state.reward) return;
    const recipe = recipes[key];
    setPreview(key);
    openPanel(recipe.name);
    const list = document.createElement('ol');
    const prep = recipe.base.filter(kind => prepNames[kind]);
    for (const step of [
      ...prep.map(kind => `Na prkénku nakrájej ${prepNames[kind]} a pak surovinu zvedni.`),
      `Do ${recipe.pot ? 'hrnce' : 'pánve'} na volné plotýnce patří ${recipe.base.map(kind => ingredients[kind][0].toLowerCase()).join(' + ')}.`,
      `Po vložení poslední suroviny se spustí vaření. Po ${recipe.seconds} s jídlo zvedni.`,
      'Polož jídlo na prázdný talíř na pultu vpravo.',
      ...recipe.finish.map(kind => `K jídlu na talíři přidej ${kind === 'sauce' ? 'omáčku' : 'koření'}.`),
      'Zvedni talíř a polož ho do výdejního okénka.'
    ]) {
      const li = document.createElement('li');
      li.textContent = step;
      list.append(li);
    }
    panelBody.append(list);
  }

  function setPreview(key) {
    if (!key || preview.dataset.recipe === key) return;
    const recipe = recipes[key];
    preview.dataset.recipe = key;
    preview.setAttribute('aria-label', `Obrázkový recept – ${recipe.name}`);
    const ingredientsRow = [...recipe.base, ...recipe.finish].map(kind => {
      const [name, image] = ingredients[kind];
      return `<img src="${asset(image)}" alt="${name}">`;
    });
    const stages = [recipe.pot ? ['pot', 'Hrnec'] : ['pan', 'Pánev'], [recipe.art, 'Talíř'], ['cloche', 'Výdej']];
    preview.innerHTML = `<strong>${recipe.name}</strong><span class="recipe-preview-row">${ingredientsRow.join('')}</span>` +
      `<span class="recipe-preview-row">${stages.map(([image, name]) => `<img src="${asset(image)}" alt="${name}">`).join('<span class="recipe-arrow" aria-hidden="true">›</span>')}</span>`;
  }
  preview.addEventListener('click', () => {
    if (preview.dataset.recipe) viewRecipe(preview.dataset.recipe);
  });

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
    const duration = key === 'egg' ? 0 : recipe.limit * 1.5;
    return {key, duration, until: state.time + duration, wrapper, time: button.querySelector('.order-time'), fill: button.querySelector('.progress span')};
  }
  function refill() {
    const count = state.completed === 0 ? 1 : 2;
    while (state.orders.length < count && state.next < queue.length) {
      state.orders.push(openTicket(queue[state.next++]));
    }
    state.orders.forEach((order, index) => order.wrapper.classList.toggle('is-current', index === 0));
    if (!state.orders.some(order => order.key === preview.dataset.recipe)) setPreview(state.orders[0]?.key);
    served.innerHTML = `Vydáno <strong>${state.completed} / ${queue.length}</strong>`;
  }

  function moveItem(food, gesture, cue) {
    state.held = food;
    if (food?.key) setPreview(food.key);
    else if (food?.kind) {
      const possible = state.orders.find(({key}) => recipes[key].base.includes(food.kind) ||
        recipes[key].base.includes(chopped[food.kind]) || recipes[key].finish.includes(food.kind));
      setPreview(possible?.key);
    }
    state.gesture = {time: state.time, gesture};
    sound(cue);
  }
  function invalid(message) {
    say('Kuchyně', message);
    sound('error');
  }
  function completeDish(food) { return food.plated && !food.burned && food.count === recipes[food.key].finish.length; }
  function matchingRecipes(parts) {
    if (new Set(parts).size !== parts.length) return [];
    return state.orders.map(({key}) => [key, recipes[key]])
      .filter(([, recipe]) => parts.every(kind => recipe.base.includes(kind)));
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
          const advice = chopped[kind] ? 'Prkénko je uprostřed kuchyně.' : 'Postup najdeš klepnutím na objednávku.';
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
      state.chopping = {raw: state.held, food: item(chopped[state.held.kind]), until: state.time + 1.4};
      moveItem(null, 'chop', 'chop');
      say('Prkénko', 'Jakmile je zelený ukazatel plný, surovinu můžeš zvednout.');
    }];
  }

  function burnerAction(index) {
    const burner = state.burners[index];
    if (burner.key) {
      const food = {...dish(burner.key), burned: state.completed > 0 && state.time >= burner.until + readyGrace};
      if (burner.until > state.time) return ['Vaří se…', picture(food)];
      if (state.held) return ['Odlož', picture(food)];
      return ['Zvednout', picture(food), () => {
        state.burners[index] = {parts: []};
        moveItem(food, 'take', 'pickup');
        say('V ruce', food.burned ? 'Připálené jídlo. Vyhoď ho do koše.' : `${nameOf(food)} polož na prázdný talíř na pultu vpravo.`);
      }];
    }
    if (state.held) {
      const part = state.held.kind;
      return ['Položit', picture(state.held), () => {
        const parts = [...burner.parts, part];
        const matches = matchingRecipes(parts);
        if (!matches.length) return invalid('Tahle surovina se sem nehodí. Klepnutím na objednávku otevřeš recept.');
        moveItem(null, 'put', 'put');
        const ready = matches.find(([, recipe]) => recipe.base.length === parts.length);
        setPreview((ready ?? matches[0])[0]);
        if (ready) {
          const [key, recipe] = ready;
          state.burners[index] = {key, until: state.time + recipe.seconds, notified: false};
          say(`Plotýnka ${index + 1}`, `${recipe.name} se vaří. Mezitím můžeš připravit další objednávku.`);
        } else {
          burner.parts = parts;
          burner.pot = matches.every(([, recipe]) => recipe.pot);
          const missing = matches[0][1].base.filter(kind => !parts.includes(kind));
          say(`Plotýnka ${index + 1}`, `Ještě chybí ${missing.map(kind => ingredients[kind][0].toLowerCase()).join(' + ')}.`);
        }
      }];
    }
    if (!burner.parts.length) return ['Položit', 'pan'];
    return ['Zvednout', picture(item(burner.parts[burner.parts.length - 1])), () => {
      const food = item(burner.parts.pop());
      moveItem(food, 'take', 'pickup');
      say('V ruce', nameOf(food));
    }];
  }

  function plateAction(index) {
    const plate = state.plates[index];
    if (!plate && state.held?.key && !state.held.burned) return [state.held.plated ? 'Odložit' : 'Na talíř', recipes[state.held.key].art, () => {
      const food = state.held;
      state.plates[index] = {...food, plated: true};
      moveItem(null, 'put', 'put');
      const next = recipes[food.key].finish[food.count];
      say('Talíř', next ? `Ještě chybí ${ingredients[next][0].toLowerCase()}.` : 'Zvedni talíř a odnes ho do výdeje.');
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
    return ['Na talíř', 'cloche'];
  }

  function serve() {
    const food = state.held;
    if (food.key && !food.burned && !food.plated) return invalid('Nejdřív polož jídlo na talíř na pultu vpravo.');
    if (!completeDish(food)) return invalid('Tohle ještě není hotové jídlo.');
    const index = state.orders.findIndex(order => order.key === food.key);
    if (index < 0) return invalid('Tohle jídlo teď nemá žádnou objednávku.');
    state.orders[index].wrapper.remove();
    state.orders.splice(index, 1);
    state.completed++;
    moveItem(null, 'put', 'serve');
    say('Výdej', state.completed === 1 ? 'První jídlo je venku! Klepnutím na objednávku otevřeš další recept.' : `${nameOf(food)} vydáno.`);
    refill();
    if (state.completed === queue.length) runFinale();
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
    return ['Akce', 'cloche'];
  }

  function nearest() {
    let best = null;
    let shortest = Infinity;
    for (const station of stations) {
      const y = station === stove ? Math.min(58, Math.max(38, state.y)) : station.y;
      // The actor's position is at their feet. Align plate interactions with their hands.
      const dy = (state.y - y) * board.clientHeight / 100 - (station.type === 'plate' ? 24 : 0);
      const distance = Math.hypot((state.x - station.x) * board.clientWidth / 100, dy);
      const reach = station.reach ?? (station === stove ? 46 : station.type === 'plate' ? 25 : 34);
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
    const burner = state.burners[index];
    if (burner.key) setPreview(burner.key);
    else if (burner.parts.length) setPreview(matchingRecipes(burner.parts)[0]?.[0]);
    markBurner();
    refresh();
  }

  function updateGuide() {
    guideTarget.hidden = state.completed > 0;
    if (state.completed > 0) return;
    const held = state.held;
    const plated = state.plates.findIndex(food => food?.key === 'egg');
    const inPan = state.burners.findIndex(burner => burner.key === 'egg');
    let step, hint, x, y;
    if (held?.key === 'egg') {
      if (held.plated) [step, hint, x, y] = ['serve', 'Odnes talíř k výdeji nahoře vpravo.', 77.4, 23.5];
      else [step, hint, x, y] = ['plate', 'Polož vejce na volný talíř vpravo.', 87.3, counters[0].y - 3.6];
    } else if (plated >= 0) {
      [step, hint, x, y] = ['pickup', 'Zvedni talíř s vejcem.', 87.3, counters[plated].y - 3.6];
    } else if (inPan >= 0) {
      const ready = state.burners[inPan].until <= state.time;
      [step, hint, x, y] = [ready ? 'ready' : 'cooking', ready ? 'Vejce je hotové. Zvedni ho z pánve.' : 'Vejce se smaží. Počkej, až se ukáže Hotovo.', 5, burnerRows[inPan]];
    } else if (held?.kind === 'egg') {
      [step, hint, x, y] = ['stove', 'Dojdi ke sporáku vlevo a polož vejce na pánev.', 9.3, 38.2];
    } else {
      [step, hint, x, y] = ['fridge', 'Dojdi k lednici nahoře a zvedni vejce.', 49.5, 30.7];
    }
    if (step === guideStep) return;
    guideStep = step;
    place(guideTarget, x, y);
    say('Kuchtík', hint);
  }

  function refresh() {
    const station = nearest();
    if (station !== nearby) {
      nearby = station;
      stationLabel.hidden = !station;
      burnerControls.hidden = burnerFocus.hidden = station !== stove;
      plateFocus.hidden = station?.type !== 'plate';
      if (station?.type === 'plate') place(plateFocus, 87.3, station.y);
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
    updateGuide();
  }

  function showWork(view, food, text, mode = '') {
    const icon = view.element.classList.contains('has-pot') && food?.kind === 'water' ? 'water-in-pot' : food && picture(food);
    const source = icon ? asset(icon) : '';
    if (food && view.image.getAttribute('src') !== source) view.image.src = source;
    view.image.hidden = !food;
    if (view.time.textContent !== text) view.time.textContent = text;
    view.time.hidden = !text;
    view.element.hidden = !food && !text;
    if (view.element.dataset.mode !== mode) view.element.dataset.mode = mode;
  }
  function showBurnerStatus(index, name, text = '', mode = '') {
    const {button, item, status} = burnerButtons[index];
    if (item.textContent !== name) item.textContent = name;
    if (status.textContent !== text) status.textContent = text;
    if (button.dataset.mode !== mode) button.dataset.mode = mode;
  }
  function tickTimers() {
    for (const order of state.orders) {
      if (!order.duration) {
        if (order.time.textContent !== 'Zaučení') order.time.textContent = 'Zaučení';
        order.fill.style.width = '100%';
        continue;
      }
      if (state.time >= order.until) {
        order.until = state.time + order.duration;
        say('Objednávka', 'Čas vypršel. Objednávka se obnovila.');
      }
      const seconds = order.until - state.time;
      const percent = seconds / order.duration;
      const timer = timeText(seconds);
      if (order.time.textContent !== timer) order.time.textContent = timer;
      order.fill.style.width = `${percent * 100}%`;
      order.wrapper.classList.toggle('is-urgent', percent < .35);
    }
    state.burners.forEach((burner, index) => {
      const view = stoveViews[index];
      const pot = burner.key ? recipes[burner.key].pot : burner.parts.length && burner.pot;
      const vessel = asset(pot ? 'pot' : 'pan');
      if (view.vessel.getAttribute('src') !== vessel) view.vessel.src = vessel;
      view.vessel.classList.toggle('is-pot', Boolean(pot));
      view.element.classList.toggle('has-pot', Boolean(pot));
      if (!burner.key) {
        const latest = burner.parts[burner.parts.length - 1];
        showWork(view, latest ? item(latest) : null, '');
        showBurnerStatus(index, latest ? ingredients[latest][0] : 'Volná', latest ? 'Čeká' : '');
        return;
      }
      const remaining = burner.until - state.time;
      if (remaining > 0) {
        const time = timeText(remaining);
        showWork(view, dish(burner.key), time, 'cooking');
        showBurnerStatus(index, recipes[burner.key].name, time, 'cooking');
      } else if (state.completed > 0 && remaining <= -readyGrace) {
        showWork(view, {...dish(burner.key), burned: true}, '', 'burned');
        showBurnerStatus(index, recipes[burner.key].name, 'Připáleno', 'burned');
      } else {
        showWork(view, dish(burner.key), 'Hotovo', 'ready');
        showBurnerStatus(index, recipes[burner.key].name, 'Hotovo', 'ready');
        if (!burner.notified) {
          burner.notified = true;
          sound('ready');
        }
      }
    });
    state.plates.forEach((food, index) => showWork(plateViews[index], food, ''));
    const work = state.chopping;
    const cut = work ? Math.min(100, Math.round((1 - (work.until - state.time) / 1.4) * 100)) : 0;
    showWork(boardView, work && (state.time < work.until ? work.raw : work.food), work ? `${cut} %` : '', work ? 'ready' : '');
  }

  function useAction() {
    if (state.scene || state.reward || panel.open || find('#balik-menu')?.open) return;
    const station = nearest();
    const [, , callback] = details(station);
    if (!callback) return;
    state.started = true;
    state.facing = closestDirection(station);
    callback();
    if (state.scene) return;
    refresh();
    tickTimers();
  }
  action.addEventListener('click', useAction);

  function nearestAngle(dx, dy) { return (Math.round(Math.atan2(dx, -dy) / turn) + 8) % 8; }
  function closestDirection(station) {
    if (station === stove) return 6;
    if (station.type === 'plate') return 2;
    if (station.type === 'chop') return station.facing;
    if (station.type === 'trash') return 6;
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
    if (state.scene || state.reward || pointer !== undefined || event.button !== 0 || isZoomed()) return;
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
    if (state.scene || state.reward || panel.open || find('#balik-menu')?.open || event.ctrlKey || event.metaKey || event.altKey) return;
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

  const elevator = createElevatorPanel({
    floor: '1',
    destination: '2',
    onPress: () => sound('put'),
    onTravel() {
      openPanel('2 – Restaurace', 'Hotovo');
      const text = document.createElement('p');
      text.textContent = 'Tlačítko 2 je zacvaknuté v panelu. Kuchyně je hotová.';
      panelBody.append(text);
      liftReturn.hidden = true;
    }
  });
  liftReturn.addEventListener('click', () => elevator.open());

  function setScene(name) {
    state.scene = name;
    stopInput();
    game.classList.toggle('is-sequence', Boolean(name));
    menuToggle.disabled = Boolean(name);
    if (name) {
      stationLabel.hidden = plateFocus.hidden = burnerControls.hidden = burnerFocus.hidden = guideTarget.hidden = true;
    }
    nearby = undefined;
  }

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  function animatePosition(element, x, y, duration, easing = 'linear') {
    const animation = element.animate([
      {left: element.style.left, top: element.style.top},
      {left: `${x}%`, top: `${y}%`}
    ], {duration, easing});
    place(element, x, y);
    return animation.finished;
  }

  async function runPath(element, path, speed) {
    element.classList.add('is-running');
    for (const [x, y] of path) {
      const dx = (x - parseFloat(element.style.left)) * board.clientWidth / 100;
      const dy = (y - parseFloat(element.style.top)) * board.clientHeight / 100;
      if (Math.hypot(dx, dy) < 1) continue;
      if (element === actor) {
        const direction = nearestAngle(dx, dy);
        actor.dataset.facing = directionNames[direction];
        sprite.dataset.atlas = 'walk';
        sprite.style.backgroundPosition = `0% ${walkRows[direction] * 100 / 7}%`;
        state.x = x;
        state.y = y;
      }
      await animatePosition(element, x, y, Math.hypot(dx, dy) / speed * 1000);
    }
    element.classList.remove('is-running');
  }

  function holdForDemo(name) {
    cookCarry.hidden = !name;
    if (name) cookCarry.src = asset(name);
  }

  async function runDemo() {
    if (state.scene || state.started) return;
    panel.close();
    setScene('demo');
    const speed = 370;
    say('Kuchtík', '1. V lednici vezmu vejce.');
    await runPath(cook, [[27, 68], [27, 35], [49, 34]], speed);
    holdForDemo('raw-egg');
    sound('pickup');
    await pause(330);
    say('Kuchtík', '2. Na pánvi ho usmažím.');
    await runPath(cook, [[27, 35], [22, 43]], speed);
    holdForDemo();
    showWork(stoveViews[0], dish('egg'), 'Smaží se', 'cooking');
    sound('put');
    await pause(620);
    showWork(stoveViews[0], dish('egg'), 'Hotovo', 'ready');
    sound('ready');
    await pause(320);
    showWork(stoveViews[0], null, '');
    holdForDemo('fried-egg-cooking');
    say('Kuchtík', '3. Hotové vejce dám na talíř.');
    await runPath(cook, [[25, 35], [76.6, 35], [76.6, counters[0].y + 2400 / board.clientHeight]], speed);
    holdForDemo();
    showWork(plateViews[0], {...dish('egg'), plated: true}, '');
    sound('put');
    await pause(440);
    showWork(plateViews[0], null, '');
    holdForDemo('fried-egg');
    say('Kuchtík', '4. Talíř odnesu do výdeje.');
    await runPath(cook, [[77.5, 32.7]], speed);
    holdForDemo();
    sound('serve');
    await pause(380);
    say('Kuchtík', 'Pomoz mi se šesti jídly a dám ti tlačítko 2.');
    await runPath(cook, [[70, 35], [70, 69], [34, 69], coachHome], speed);
    setScene(null);
    guideStep = null;
    tickTimers();
    refresh();
    say('Kuchtík', 'Za šest jídel dostaneš tlačítko 2. Začni vejcem z lednice.');
  }

  async function runFinale() {
    setScene('finale');
    say('Kuchtík', 'Všech šest jídel je venku. Nesu ti tlačítko 2!');
    await runPath(cook, [[27, 68], [27, 35], [Math.min(73, state.x - 7), state.y + 5]], 350);

    say('Kuchtík', 'Díky za pomoc. Tady máš tlačítko 2.');
    place(handoff, parseFloat(cook.style.left) + 3, parseFloat(cook.style.top) - 24 * 100 / board.clientHeight);
    handoff.hidden = false;
    await animatePosition(handoff, state.x, state.y - 28 * 100 / board.clientHeight, 570, 'ease-in-out');
    sound('ready');
    await pause(430);
    handoff.hidden = true;

    preview.hidden = true;
    kitchenLift.hidden = false;
    await pause(160);
    kitchenLift.classList.add('is-open');
    sound('put');
    say('Kurýr', 'Výtah je otevřený. Zacvaknu tlačítko 2 do panelu.');
    await pause(360);
    await runPath(actor, [[71.5, 35], [71.5, 69], [50, 69], [50, 94]], 330);
    actor.hidden = true;
    state.reward = true;
    setScene(null);
    game.classList.add('is-finished');
    liftReturn.hidden = false;
    elevator.open();
  }

  function update(timestamp) {
    const delta = lastTime === undefined ? 0 : Math.min(.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    if (!state.scene && !state.reward && !document.hidden && !panel.open && !find('#balik-menu')?.open) {
      const direction = directionFromInput();
      if (state.started) state.time += delta;
      drawCourier(direction, delta);
      tickTimers();
      refresh();
    }
    requestAnimationFrame(update);
  }

  function reset() {
    if (state?.scene) return;
    stopInput();
    elevator.reset();
    guideStep = null;
    tickets.replaceChildren();
    state = {x: 50, y: 73.4, facing: 0, held: null, gesture: null, chopping: null, time: 0, started: false,
      completed: 0, next: 0, orders: [], selectedBurner: 0, burners: burnerRows.map(() => ({parts: []})), plates: counters.map(() => null), reward: false};
    game.classList.remove('is-finished');
    kitchenLift.classList.remove('is-open');
    kitchenLift.hidden = liftReturn.hidden = handoff.hidden = true;
    preview.hidden = actor.hidden = false;
    place(cook, ...coachHome);
    markBurner();
    refill();
    drawCourier(-1, 0);
    tickTimers();
    refresh();
    openCoach();
  }
  find('#reset').addEventListener('click', reset);
  reset();
  requestAnimationFrame(update);
})();
