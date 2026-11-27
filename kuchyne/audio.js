'use strict';

const kitchenAudio = (() => {
  const base = new URL('../audio/', document.currentScript.src);
  const SoundContext = window.AudioContext || window.webkitAudioContext;
  const clips = {
    room: {file: 'kitchen-rendezvous.mp3', channel: 'music', level: .21},
    cabin: {file: 'music.mp3', channel: 'music', level: .29},
    boil: {file: 'kitchen-boil.mp3', channel: 'effects', level: .31},
    fry: {file: 'kitchen-fry.mp3', channel: 'effects', level: .27},
    bell: {file: 'kitchen-bell.mp3', channel: 'effects', level: .43}
  };
  const tones = {
    pickup: [325, 494], put: [294], chop: [355, 250, 330], ready: [494, 660, 880], error: [170, 149]
  };
  const buffers = new Map();
  const voices = new Map();
  let context;
  let mixer;
  let scene = 'room';
  let boiling = false;
  let frying = false;

  function bufferFor(name) {
    if (!buffers.has(name)) {
      buffers.set(name, fetch(new URL(clips[name].file, base))
        .then(response => response.ok ? response.arrayBuffer() : null)
        .then(data => data ? context.decodeAudioData(data) : null)
        .catch(() => null));
    }
    return buffers.get(name);
  }

  function stop(name) {
    const voice = voices.get(name);
    voices.delete(name);
    voice?.source?.stop();
  }

  function stopClips() {
    for (const name of voices.keys()) stop(name);
  }

  function play(name, loop) {
    if (!context || !balikSound.isPageActive() || document.hidden || voices.has(name)) return;
    const voice = {};
    const clip = clips[name];
    voices.set(name, voice);
    bufferFor(name).then(buffer => {
      if (voices.get(name) !== voice) return;
      if (!buffer) {
        buffers.delete(name);
        voices.delete(name);
        return;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      source.loop = loop;
      source.connect(gain).connect(mixer[clip.channel]);
      gain.gain.setValueAtTime(loop ? 0 : clip.level, now);
      if (loop) gain.gain.linearRampToValueAtTime(clip.level, now + (clip.channel === 'music' ? .35 : .16));
      voice.source = source;
      source.onended = () => {
        if (voices.get(name) === voice) voices.delete(name);
        source.disconnect();
        gain.disconnect();
      };
      source.start(now);
    });
  }

  function syncScene() {
    if (!context) return;
    const audible = balikSound.isPageActive() && !document.hidden;
    const active = {room: audible && scene === 'room', cabin: audible && scene === 'cabin',
      boil: audible && scene === 'room' && boiling, fry: audible && scene === 'room' && frying};
    for (const [name, needed] of Object.entries(active)) {
      if (!needed) stop(name);
    }
    for (const [name, needed] of Object.entries(active)) {
      if (needed) play(name, true);
    }
  }

  function setHeat(hasPot, hasPan) {
    if (boiling === hasPot && frying === hasPan) return;
    boiling = hasPot;
    frying = hasPan;
    syncScene();
  }

  function cue(name) {
    if (!context || !balikSound.isPageActive() || document.hidden) return;
    if (name === 'serve') {
      stop('bell');
      play('bell', false);
      return;
    }
    for (const [index, pitch] of tones[name].entries()) {
      const source = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime + index * .075;
      source.type = name === 'chop' ? 'triangle' : 'sine';
      source.frequency.value = pitch;
      gain.gain.setValueAtTime(.055, time);
      gain.gain.exponentialRampToValueAtTime(.001, time + .09);
      source.connect(gain).connect(mixer.effects);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(time);
      source.stop(time + .095);
    }
  }

  function unlock() {
    if (!SoundContext || !balikSound.isPageActive()) return;
    if (!context) {
      try { context = new SoundContext(); } catch { return; }
      mixer = balikSound.createMixer(context, () => {
        stopClips();
        boiling = frying = false;
      });
      bufferFor('bell');
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    syncScene();
  }

  for (const type of ['pointerdown', 'pointerup', 'keydown']) document.addEventListener(type, unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopClips();
    else if (context) unlock();
  });
  document.addEventListener('balik:elevator-audio', ({detail}) => {
    scene = detail;
    syncScene();
  });
  window.addEventListener('pageshow', event => { if (event.persisted && context) unlock(); });
  document.addEventListener('DOMContentLoaded', () => {
    const credit = document.createElement('small');
    credit.textContent = 'Rendezvous · Shane Ivers (CC BY 4.0)';
    document.querySelector('#balik-menu .sound-settings')?.append(credit);
  }, {once: true});
  balikSound.bindSpeaker(document.querySelector('#sound-toggle'));
  return {cue, setHeat};
})();
