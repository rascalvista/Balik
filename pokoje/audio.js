'use strict';

const roomsAudio = (() => {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const tracks = {room: ['../audio/reception-jazz.mp3', .24], cabin: ['../audio/music.mp3', .20]};
  const cues = {
    click: ['../audio/click.mp3', .28],
    fold: ['../audio/laundry-fold.mp3', .33],
    ding: ['../audio/ding.mp3', .34]
  };
  const buffers = new Map();
  const effects = new Set();
  const offsets = {room: 0, cabin: 0};
  let scene = 'room';
  let context;
  let mixer;
  let music;
  let effectGeneration = 0;

  function audible() { return balikSound.isPageActive() && !document.hidden; }

  function load(url) {
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url)
        .then(response => response.ok ? response.arrayBuffer() : null)
        .then(bytes => bytes ? context.decodeAudioData(bytes) : null)
        .catch(() => null)
        .then(buffer => {
          if (!buffer) buffers.delete(url);
          return buffer;
        }));
    }
    return buffers.get(url);
  }

  function play(buffer, bus, volume, loop = false, offset = 0) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain).connect(bus);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + (loop ? .18 : .01));
    source.onended = () => {
      effects.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start(now, offset);
    return source;
  }

  function stopMusic() {
    const previous = music;
    music = undefined;
    if (!previous?.source) return;
    const {name, source, start} = previous;
    offsets[name] = (offsets[name] + context.currentTime - start) % source.buffer.duration;
    source.stop();
  }

  function stopEffects() {
    effectGeneration++;
    for (const source of effects) source.stop();
    effects.clear();
  }

  function stop() {
    stopMusic();
    stopEffects();
  }

  function syncMusic() {
    if (!context || !audible() || music || !tracks[scene]) return;
    const request = {name: scene};
    const [url, volume] = tracks[scene];
    music = request;
    load(url).then(buffer => {
      if (music !== request) return;
      if (!buffer || !audible()) {
        music = undefined;
        return;
      }
      request.start = context.currentTime;
      request.source = play(buffer, mixer.music, volume, true, offsets[request.name] % buffer.duration);
    });
  }

  function activate() {
    if (!AudioEngine || !audible()) return;
    if (!context) {
      try { context = new AudioEngine(); } catch { return; }
      mixer = balikSound.createMixer(context, stop);
      // Fetch both loops in advance, but only the active scene can start one.
      for (const [url] of Object.values(tracks)) load(url);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    syncMusic();
  }

  function cue(name) {
    activate();
    if (!context || !audible() || scene === 'departing') return;
    const generation = effectGeneration;
    const [url, volume] = cues[name];
    load(url).then(buffer => {
      if (buffer && audible() && generation === effectGeneration) effects.add(play(buffer, mixer.effects, volume));
    });
  }

  document.addEventListener('touchend', activate, {capture: true, passive: true});
  document.addEventListener('click', activate, true);
  document.addEventListener('keydown', activate, true);
  document.addEventListener('balik:elevator-audio', ({detail}) => {
    if (detail === scene) return;
    stop();
    scene = detail;
    syncMusic();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (context) activate();
  });
  window.addEventListener('pageshow', event => { if (event.persisted && context) activate(); });
  balikSound.bindSpeaker(document.querySelector('#sound-toggle'));

  return {cue};
})();
