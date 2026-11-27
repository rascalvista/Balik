'use strict';

function createPourGame(onFinished) {
  const panel = document.querySelector('#pour-panel');
  const hold = panel.querySelector('#pour-hold');
  const glass = panel.querySelector('.glass-meter');
  const feedback = panel.querySelector('.pour-message');
  const title = panel.querySelector('#pour-title');
  let order;
  let start;
  let animation;
  let pointer = null;
  let keyboard = false;

  function paint(value) {
    glass.style.setProperty('--fill', `${value}%`);
    glass.setAttribute('aria-valuenow', Math.round(value));
  }

  function level(now) {
    return Math.min(100, (now - start) / order.item.fillTime * 100);
  }

  function tick(now) {
    if (start === undefined) return;
    paint(level(now));
    animation = requestAnimationFrame(tick);
  }

  function begin() {
    feedback.textContent = '';
    start = performance.now();
    hold.classList.add('is-pouring');
    restaurantAudio.pour(true);
    animation = requestAnimationFrame(tick);
  }

  function cancel() {
    if (start !== undefined) {
      cancelAnimationFrame(animation);
      hold.classList.remove('is-pouring');
      restaurantAudio.pour(false);
      start = undefined;
    }
    pointer = null;
    keyboard = false;
  }

  function release() {
    const value = level(performance.now());
    const [low, high] = order.item.goal;
    cancel();
    paint(value);
    if (value >= low && value <= high) {
      const drink = order;
      const precise = Math.abs(value - (low + high) / 2) <= 3.5;
      panel.close();
      onFinished(drink, precise);
      return;
    }
    feedback.textContent = value < low ? 'Ještě trochu. Podrž tlačítko déle.' : 'Přelito. Příště pusť tlačítko dřív.';
  }

  hold.addEventListener('pointerdown', event => {
    if (event.button !== 0 || start !== undefined) return;
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
    if (event.repeat || start !== undefined) return;
    keyboard = true;
    begin();
  });
  hold.addEventListener('keyup', event => {
    if (!keyboard || !isHoldKey(event)) return;
    event.preventDefault();
    release();
  });
  hold.addEventListener('blur', cancel);
  hold.addEventListener('contextmenu', event => event.preventDefault());
  panel.querySelector('#pour-close').addEventListener('click', () => panel.close());
  panel.addEventListener('close', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });

  return {
    open(ticket) {
      order = ticket;
      const {name, color, goal: [low, high]} = order.item;
      title.textContent = name;
      glass.style.setProperty('--drink-color', color);
      glass.style.setProperty('--goal-low', `${low}%`);
      glass.style.setProperty('--goal-size', `${high - low}%`);
      paint(0);
      feedback.textContent = '';
      panel.showModal();
      hold.focus({preventScroll: true});
    },
    isOpen: () => panel.open,
    close() { if (panel.open) panel.close(); }
  };
}
