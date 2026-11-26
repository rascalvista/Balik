'use strict';

const garageAudio = (() => {
  const sounds = {
    music: {file: 'assets/garage.mp3', level: .09},
    elevator: {file: '../audio/music.mp3', level: .32},
    roll: {file: '../audio/motor.mp3', level: .21},
    click: {file: '../audio/click.mp3', level: .24},
    trunk: {file: '../audio/valve.mp3', level: .32},
    ding: {file: '../audio/ding.mp3', level: .29}
  };
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const toggle = document.getElementById('sound-toggle');
  const buffers = new Map();
  const voices = new Map();
  let context;
  let mixer;
  let scene = 'room';

  function stop(name) {
    const voice = voices.get(name);
    voices.delete(name);
    if (voice?.source) voice.source.stop();
  }

  function getBuffer(name) {
    const sound = sounds[name];
    if (!buffers.has(name)) {
      buffers.set(name, fetch(sound.file).then(response => {
        return response.ok ? response.arrayBuffer() : null;
      }).then(bytes => bytes ? context.decodeAudioData(bytes) : null).catch(() => null));
    }
    return buffers.get(name);
  }

  function play(name, duration) {
    if (!context || !balikSound.isPageActive()) return;
    stop(name);
    const sound = sounds[name];
    const loop = name === 'music' || name === 'elevator';
    const voice = {};
    voices.set(name, voice);

    getBuffer(name).then(buffer => {
      if (voices.get(name) !== voice) return;
      if (!buffer) {
        voices.delete(name);
        return;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      const time = context.currentTime;
      source.buffer = buffer;
      source.loop = loop;
      source.connect(gain);
      gain.connect(mixer[loop ? 'music' : 'effects']);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(sound.level, time + (name === 'music' ? .45 : loop ? .2 : .015));
      voice.source = source;
      source.onended = () => {
        if (voices.get(name) === voice) voices.delete(name);
        source.disconnect();
        gain.disconnect();
      };
      if (duration !== undefined) {
        gain.gain.setValueAtTime(sound.level, time + duration - .04);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        source.start(time, 0, duration);
      } else {
        source.start(time);
      }
    });
  }

  function playSceneMusic() {
    const track = scene === 'cabin' ? 'elevator' : 'music';
    if (scene !== 'departing' && !voices.has(track)) play(track);
  }

  function stopAllSounds() {
    for (const name of voices.keys()) stop(name);
  }

  function activate() {
    if (!context) {
      context = new AudioContext();
      mixer = balikSound.createMixer(context, stopAllSounds);
      getBuffer('elevator');
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    playSceneMusic();
  }

  function stopEffects() {
    for (const name of voices.keys()) {
      if (name !== 'music' && name !== 'elevator') stop(name);
    }
  }

  document.addEventListener('balik:elevator-audio', ({detail}) => {
    if (scene === detail) return;
    scene = detail;
    if (scene === 'departing') {
      stopAllSounds();
    } else {
      stop(scene === 'cabin' ? 'music' : 'elevator');
      playSceneMusic();
    }
  });

  if (AudioContext) {
    document.getElementById('parking').addEventListener('pointerup', activate, true);
    document.addEventListener('click', activate, true);
    // Handle touch directly so a completed drag cannot suppress the next sound toggle.
    toggle.addEventListener('touchend', event => {
      if (event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      if (!toggle.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
      event.preventDefault();
      activate();
      balikSound.toggleMute();
    }, {passive: false});
  } else {
    toggle.disabled = true;
  }

  balikSound.bindSpeaker(toggle);
  return {play, stopEffects};
})();
