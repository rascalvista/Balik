'use strict';

const poolAudio = (() => {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const tracks = {
    room: ['../audio/pool-chee-zee-beach.mp3', .57],
    cabin: ['../audio/music.mp3', .32]
  };
  const effects = {
    ripple: ['../audio/drop.mp3', .22],
    splash: ['../audio/pool-splash.mp3', .48],
    ding: ['../audio/ding.mp3', .30],
    click: ['../audio/click.mp3', .27]
  };
  const buffers = new Map();
  let context;
  let mixer;
  let scene = 'room';
  let music;

  function audible() { return balikSound.isPageActive() && !document.hidden; }

  function load(file) {
    if (!buffers.has(file)) {
      buffers.set(file, fetch(file)
        .then(response => response.ok ? response.arrayBuffer() : null)
        .then(bytes => bytes ? context.decodeAudioData(bytes) : null)
        .catch(() => null)
        .then(buffer => {
          if (!buffer) buffers.delete(file);
          return buffer;
        }));
    }
    return buffers.get(file);
  }

  function play(buffer, bus, volume, loop) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain).connect(bus);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + (loop ? .32 : .008));
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
    return source;
  }

  function stopMusic() {
    const source = music?.source;
    music = undefined;
    source?.stop();
  }

  function syncMusic() {
    if (!context || !audible() || scene === 'departing' || music) return;
    const [file, volume] = tracks[scene];
    const pending = {};
    music = pending;
    load(file).then(buffer => {
      if (music !== pending) return;
      if (buffer && audible()) pending.source = play(buffer, mixer.music, volume, true);
      else music = undefined;
    });
  }

  function unlock() {
    if (!AudioEngine || !audible()) return;
    if (!context) {
      try { context = new AudioEngine(); } catch { return; }
      mixer = balikSound.createMixer(context, stopMusic);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    syncMusic();
  }

  function cue(type) {
    unlock();
    if (!context || !audible()) return;
    const [file, volume] = effects[type];
    load(file).then(buffer => {
      if (buffer && audible()) play(buffer, mixer.effects, volume, false);
    });
  }

  document.addEventListener('click', unlock, true);
  document.addEventListener('touchend', unlock, {passive: true});
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('balik:elevator-audio', ({detail}) => {
    if (detail === scene) return;
    scene = detail;
    stopMusic();
    syncMusic();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMusic();
    else if (context) unlock();
  });
  window.addEventListener('pageshow', event => { if (event.persisted && context) unlock(); });
  document.addEventListener('DOMContentLoaded', () => {
    const credit = document.createElement('small');
    credit.textContent = 'Chee Zee Beach · Kevin MacLeod (CC BY 4.0)';
    document.querySelector('#balik-menu .sound-settings')?.append(credit);
  }, {once: true});
  balikSound.bindSpeaker(document.querySelector('#sound-toggle'));

  return {cue};
})();
