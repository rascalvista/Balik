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
  let pageActive = true;
  let dialogue;
  let introLine;

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

  window.addEventListener('pagehide', () => { pageActive = false; });
  window.addEventListener('pageshow', event => {
    pageActive = true;
    if (event.persisted) {
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

  function speak(text, speaker = 'courier') {
    const line = {text: text.trim(), speaker};
    if (!line.text) return;
    if (dialogue) dialogue(line);
    else introLine = line;
  }

  function connectDialogue(context, output) {
    const elements = document.querySelectorAll('[data-dialogue-voice]');
    const pitches = {courier: 157, receptionist: 226, cook: 189};
    const vowels = [[440, 1610], [530, 1150], [380, 2080], [700, 1250], [410, 840]];
    const melody = [0, 3, 1, 5, 2, -1, 2, -2];
    let voice;
    let pending;
    let spoken;
    let spokenAt = -Infinity;

    function stop() {
      pending = null;
      if (!voice) return;
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setValueAtTime(0, context.currentTime);
      voice.source.stop();
      voice = null;
    }

    function play(line) {
      if (!pageActive || document.hidden || settings.muted || settings.effects === 0) return;
      if (context.state !== 'running') {
        pending = line;
        return;
      }
      if (spoken === line.text && context.currentTime - spokenAt < .3) return;
      stop();
      spoken = line.text;
      spokenAt = context.currentTime;

      // Short, voiced syllables with moving vowel resonances. The text only shapes the cadence.
      const letters = line.text.match(/[\p{L}\d]/gu) ?? ['a'];
      const count = Math.min(melody.length, Math.max(2, Math.ceil(letters.length / 6)));
      const base = pitches[line.speaker] ?? pitches.courier;
      const source = context.createOscillator();
      const gain = context.createGain();
      const bands = vowels[0].map(() => context.createBiquadFilter());
      source.type = 'triangle';
      bands.forEach((band, index) => {
        band.type = 'bandpass';
        band.Q.value = index ? 2 : 1.35;
        source.connect(band).connect(gain);
      });
      gain.connect(output);
      const now = context.currentTime + .018;
      let at = now;
      gain.gain.value = 0;
      for (let index = 0; index < count; index++) {
        const letter = letters[Math.floor(index * letters.length / count)].codePointAt(0);
        const vowel = vowels[letter % vowels.length];
        const duration = .065 + (letter % 4) * .011;
        const pitch = base * 2 ** ((melody[index] + letter % 3 - 1) / 12);
        source.frequency.setValueAtTime(pitch, at);
        source.frequency.linearRampToValueAtTime(pitch * (index === count - 1 ? .84 : 1.04), at + duration);
        bands.forEach((band, formant) => band.frequency.setValueAtTime(vowel[formant], at));
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(.18, at + .014);
        gain.gain.linearRampToValueAtTime(.085, at + duration * .62);
        gain.gain.linearRampToValueAtTime(0, at + duration);
        at += duration + (index === 2 ? .05 : .022);
      }
      const playing = {gain, source};
      voice = playing;
      source.onended = () => {
        if (voice === playing) voice = null;
        source.disconnect();
        bands.forEach(band => band.disconnect());
        gain.disconnect();
      };
      source.start(now);
      source.stop(at);
    }

    dialogue = play;
    context.addEventListener('statechange', () => {
      if (pending && context.state === 'running') {
        const line = pending;
        pending = null;
        play(line);
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    for (const element of elements) {
      const readLine = () => speak(element.textContent, element.dataset.dialogueVoice);
      new MutationObserver(readLine).observe(element, {childList: true, characterData: true, subtree: true});
    }
    if (introLine) {
      play(introLine);
      introLine = undefined;
    } else if (elements.length) {
      speak(elements[0].textContent, elements[0].dataset.dialogueVoice);
    }
    return stop;
  }

  function createMixer(context, stopSounds) {
    const mixer = {};
    for (const channel of Object.keys(channels)) {
      const gain = context.createGain();
      const level = state => state.muted ? 0 : state[channel] / 100;
      gain.gain.value = level(settings);
      gain.connect(context.destination);
      subscribe(state => {
        if (pageActive) gain.gain.setTargetAtTime(level(state), context.currentTime, .025);
      });
      mixer[channel] = gain;
    }
    const stopDialogue = connectDialogue(context, mixer.effects);
    window.addEventListener('pagehide', () => {
      // Silence the outputs immediately, even if Safari suspends asynchronously.
      const now = context.currentTime;
      for (const gain of Object.values(mixer)) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      }
      stopDialogue();
      stopSounds?.();
      if (context.state !== 'closed') context.suspend().catch(() => {});
    });
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

  return {bindSpeaker, createMixer, isPageActive: () => pageActive, mountSettings, speak, toggleMute};
})();
