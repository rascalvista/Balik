'use strict';

const balikSound = (() => {
  const key = 'balik.audio';
  const channels = {music: 'Hudba', effects: 'Efekty'};
  const listeners = new Set();

  function read() {
    const defaults = {music: 100, effects: 100, muted: false};
    try {
      defaults.muted = localStorage.getItem('balik.sound') === 'off';
      const stored = JSON.parse(localStorage.getItem(key));
      for (const channel of Object.keys(channels)) {
        if (Number.isFinite(stored?.[channel])) {
          defaults[channel] = Math.min(100, Math.max(0, stored[channel]));
        }
      }
      if (typeof stored?.muted === 'boolean') defaults.muted = stored.muted;
    } catch {}
    return defaults;
  }

  let settings = read();

  function subscribe(listener) {
    listeners.add(listener);
    listener(settings);
  }

  function update(changes) {
    settings = {...settings, ...changes};
    try {
      localStorage.setItem(key, JSON.stringify(settings));
      localStorage.setItem('balik.sound', settings.muted ? 'off' : 'on');
    } catch {}
    listeners.forEach(listener => listener(settings));
  }

  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      settings = read();
      listeners.forEach(listener => listener(settings));
    }
  });

  function toggleMute() {
    update({muted: !settings.muted});
  }

  function bindSpeaker(button, {painted = false} = {}) {
    subscribe(({muted}) => {
      if (painted) button.style.backgroundColor = muted ? '#0009' : 'transparent';
      else button.textContent = muted ? '🔇' : '🔈';
      button.title = muted ? 'Zapnout zvuk' : 'Ztlumit zvuk';
      button.setAttribute('aria-pressed', String(!muted));
    });
    button.addEventListener('click', toggleMute);
  }

  function createMixer(context) {
    const mixer = {};
    for (const channel of Object.keys(channels)) {
      const gain = context.createGain();
      const level = state => state.muted ? 0 : state[channel] / 100;
      gain.gain.value = level(settings);
      gain.connect(context.destination);
      subscribe(state => gain.gain.setTargetAtTime(level(state), context.currentTime, .025));
      mixer[channel] = gain;
    }
    return mixer;
  }

  function mountSettings(container) {
    for (const [channel, title] of Object.entries(channels)) {
      const label = document.createElement('label');
      label.className = 'sound-level';
      const name = document.createElement('span');
      const value = document.createElement('output');
      const input = document.createElement('input');
      name.textContent = title;
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.setAttribute('aria-label', title);
      label.append(name, value, input);
      container.append(label);
      input.addEventListener('input', () => update({[channel]: input.valueAsNumber}));
      subscribe(state => {
        input.value = state[channel];
        value.textContent = state[channel] + ' %';
      });
    }

    const enabled = document.createElement('label');
    enabled.className = 'sound-enabled';
    const input = document.createElement('input');
    input.type = 'checkbox';
    enabled.append(input, 'Zapnout zvuk');
    container.prepend(enabled);
    input.addEventListener('change', () => update({muted: !input.checked}));
    subscribe(({muted}) => { input.checked = !muted; });
  }

  return {bindSpeaker, createMixer, mountSettings, toggleMute};
})();
