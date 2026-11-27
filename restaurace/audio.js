'use strict';

const restaurantAudio = (() => {
  const SoundContext = window.AudioContext || window.webkitAudioContext;
  const clips = {
    room: ['../audio/restaurant-bossa.mp3', .72],
    cabin: ['../audio/music.mp3', .32],
    click: ['../audio/click.mp3', .22],
    glass: ['../audio/kitchen-bell.mp3', .21],
    serve: ['../audio/kitchen-bell.mp3', .34],
    ding: ['../audio/ding.mp3', .28]
  };
  const files = new Map();
  const active = new Set();
  let context;
  let mixer;
  let scene = 'room';
  let music;
  let stream;

  function audible() { return balikSound.isPageActive() && !document.hidden; }

  function load(url) {
    if (!files.has(url)) {
      files.set(url, fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Sound failed to load');
          return response.arrayBuffer();
        }).then(bytes => context.decodeAudioData(bytes))
        .catch(() => { files.delete(url); return null; }));
    }
    return files.get(url);
  }

  function start(buffer, bus, level, loop = false) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain).connect(bus);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + (loop ? .25 : .012));
    active.add(source);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return source;
  }

  function stopMusic() {
    const previous = music?.source;
    music = undefined;
    previous?.stop();
  }

  function syncMusic() {
    if (!context || !audible() || scene === 'departing' || music) return;
    const [url, gain] = clips[scene];
    const pending = {};
    music = pending;
    load(url).then(buffer => {
      if (music !== pending) return;
      if (!buffer || !audible()) {
        music = undefined;
        return;
      }
      pending.source = start(buffer, mixer.music, gain, true);
    });
  }

  function pour(on) {
    if (!on) {
      stream?.stop();
      stream = undefined;
      return;
    }
    if (!context || !audible() || stream) return;
    const length = Math.floor(context.sampleRate * .55);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let smoothing = 0;
    for (let index = 0; index < length; index++) {
      smoothing = smoothing * .79 + (Math.random() * 2 - 1) * .21;
      data[index] = smoothing * (.7 + .3 * Math.sin(index / context.sampleRate * Math.PI * 36));
    }
    stream = start(buffer, mixer.effects, .10, true);
  }

  function stop() {
    music = stream = undefined;
    for (const source of active) source.stop();
  }

  function activate() {
    if (!SoundContext || !audible()) return;
    if (!context) {
      try { context = new SoundContext(); } catch { return; }
      mixer = balikSound.createMixer(context, stop);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    syncMusic();
  }

  function cue(name) {
    activate();
    if (!context || !audible()) return;
    const [url, gain] = clips[name];
    load(url).then(buffer => {
      if (buffer && audible()) start(buffer, mixer.effects, gain);
    });
  }

  document.addEventListener('click', activate, true);
  document.addEventListener('touchend', activate, {passive: true});
  document.addEventListener('keydown', activate, true);
  document.addEventListener('balik:elevator-audio', ({detail}) => {
    if (detail === scene) return;
    scene = detail;
    stopMusic();
    syncMusic();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (context) activate();
  });
  window.addEventListener('pageshow', event => { if (event.persisted && context) activate(); });
  document.addEventListener('DOMContentLoaded', () => {
    const credit = document.createElement('small');
    credit.textContent = 'Bossa Antigua · Kevin MacLeod (CC BY 4.0)';
    document.querySelector('#balik-menu .sound-settings')?.append(credit);
  }, {once: true});
  balikSound.bindSpeaker(document.querySelector('#sound-toggle'));

  return {cue, pour};
})();
