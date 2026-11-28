'use strict';

function createPourGame(onFinished) {
  const panel = document.querySelector('#pour-panel');
  const hold = panel.querySelector('#pour-hold');
  const glass = panel.querySelector('.glass-meter');
  const feedback = panel.querySelector('.pour-message');
  const title = panel.querySelector('#pour-title');
  const layerLabel = panel.querySelector('#pour-layer');
  const deadline = panel.querySelector('#pour-time');
  const settlingTime = 480;
  let order;
  let layerIndex;
  let lowerLayer;
  let amount;
  let start;
  let settling;
  let animation;
  let overflow;
  let pointer = null;
  let keyboard = false;

  function layer() { return order.item.layers[layerIndex]; }

  function paint(value) {
    const visible = Math.min(100, value);
    glass.style.setProperty('--fill', `${visible}%`);
    glass.setAttribute('aria-valuenow', Math.round(visible));
  }

  function showLayer() {
    const {name, color, goal: [low, high]} = layer();
    const layers = order.item.layers;
    layerLabel.textContent = layers.length > 1 ? `${layerIndex + 1} / ${layers.length} · ${name}` : '';
    glass.style.setProperty('--drink-color', color);
    glass.style.setProperty('--base-color', layerIndex ? layers[layerIndex - 1].color : 'transparent');
    glass.style.setProperty('--base-fill', `${lowerLayer}%`);
    glass.style.setProperty('--goal-low', `${low}%`);
    glass.style.setProperty('--goal-size', `${high - low}%`);
  }

  function resetGlass() {
    layerIndex = 0;
    lowerLayer = amount = 0;
    overflow = false;
    showLayer();
    paint(0);
  }

  function level(now) {
    return Math.min(100, amount + (now - start) / layer().fillTime * 100);
  }

  function judge() {
    const [low, high] = layer().goal;
    if (amount < low) {
      feedback.textContent = 'Ještě trochu. Můžeš dolít krátkým stiskem.';
      return;
    }
    if (amount > high) {
      overflow = true;
      feedback.textContent = 'Přelito. Zkus to znovu a pusť tlačítko dřív.';
      return;
    }
    if (layerIndex + 1 < order.item.layers.length) {
      lowerLayer = amount;
      layerIndex++;
      showLayer();
      feedback.textContent = `První vrstva hotová. Teď ${layer().name.toLocaleLowerCase('cs')}.`;
      return;
    }
    const drink = order;
    const precise = Math.abs(amount - (low + high) / 2) <= 3;
    panel.close();
    onFinished(drink, precise);
  }

  function tick(now) {
    if (start !== undefined) {
      paint(level(now));
    } else if (settling) {
      const portion = Math.min(1, Math.max(0, (now - settling.at) / settlingTime));
      paint(settling.from + settling.tail * (1 - (1 - portion) ** 2));
      if (portion >= 1) {
        amount = settling.from + settling.tail;
        settling = undefined;
        hold.classList.remove('is-settling');
        hold.textContent = 'Podrž pro nalévání';
        restaurantAudio.pour(false);
        judge();
        return;
      }
    } else return;
    animation = requestAnimationFrame(tick);
  }

  function begin() {
    if (overflow) resetGlass();
    feedback.textContent = '';
    start = performance.now();
    hold.classList.add('is-pouring');
    restaurantAudio.pour(true);
    animation = requestAnimationFrame(tick);
  }

  function cancel() {
    cancelAnimationFrame(animation);
    hold.classList.remove('is-pouring', 'is-settling');
    hold.textContent = 'Podrž pro nalévání';
    if (start !== undefined || settling) restaurantAudio.pour(false);
    start = settling = undefined;
    pointer = null;
    keyboard = false;
    if (panel.open) paint(amount);
  }

  function release() {
    const now = performance.now();
    settling = {at: now, from: level(now), tail: layer().tail * Math.min(1, (now - start) / 360)};
    start = undefined;
    pointer = null;
    keyboard = false;
    hold.classList.remove('is-pouring');
    hold.classList.add('is-settling');
    hold.textContent = 'Dotéká…';
    feedback.textContent = 'Počkej, až se hladina ustálí.';
  }

  hold.addEventListener('pointerdown', event => {
    if (event.button !== 0 || start !== undefined || settling) return;
    pointer = event.pointerId;
    hold.setPointerCapture(pointer);
    begin();
  });
  hold.addEventListener('pointerup', event => {
    if (pointer === event.pointerId) release();
  });
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    hold.addEventListener(eventName, event => {
      if (pointer === event.pointerId) cancel();
    });
  }

  function isHoldKey(event) { return event.key === ' ' || event.key === 'Enter'; }

  hold.addEventListener('keydown', event => {
    if (!isHoldKey(event)) return;
    event.preventDefault();
    if (event.repeat || start !== undefined || settling) return;
    keyboard = true;
    begin();
  });
  hold.addEventListener('keyup', event => {
    if (!keyboard || !isHoldKey(event)) return;
    event.preventDefault();
    release();
  });
  hold.addEventListener('blur', () => { if (start !== undefined) cancel(); });
  hold.addEventListener('contextmenu', event => event.preventDefault());
  panel.querySelector('#pour-close').addEventListener('click', () => panel.close());
  panel.addEventListener('close', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });

  return {
    open(ticket) {
      order = ticket;
      title.textContent = order.item.name;
      resetGlass();
      feedback.textContent = '';
      panel.showModal();
      hold.focus({preventScroll: true});
    },
    updateTime(seconds) {
      const text = `Zbývá ${seconds} s`;
      if (deadline.textContent !== text) deadline.textContent = text;
      deadline.classList.toggle('is-late', seconds <= 12);
    },
    isOpen: () => panel.open,
    isPreparing: ticket => panel.open && order === ticket,
    close() { if (panel.open) { cancel(); panel.close(); } }
  };
}
