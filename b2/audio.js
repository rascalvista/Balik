'use strict';

const garageAudio = (() => {
  const sounds = {
    music: {file: 'assets/garage.mp3', level: .17},
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

  function stop(name) {
    const voice = voices.get(name);
    voices.delete(name);
    if (voice?.source) voice.source.stop();
  }

  function play(name, duration) {
    if (!context) return;
    stop(name);
    const sound = sounds[name];
    const loop = name === 'music';
    const voice = {};
    voices.set(name, voice);

    if (!buffers.has(name)) {
      buffers.set(name, fetch(sound.file).then(response => {
        return response.ok ? response.arrayBuffer() : null;
      }).then(bytes => bytes ? context.decodeAudioData(bytes) : null).catch(() => null));
    }
    buffers.get(name).then(buffer => {
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
      gain.gain.linearRampToValueAtTime(sound.level, time + (loop ? .45 : .015));
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

  function activate() {
    if (!context) {
      context = new AudioContext();
      mixer = balikSound.createMixer(context);
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    if (!voices.has('music')) play('music');
  }

  function stopEffects() {
    for (const name of voices.keys()) {
      if (name !== 'music') stop(name);
    }
  }

  if (AudioContext) {
    const stage = document.querySelector('main');
    document.getElementById('parking').addEventListener('pointerup', activate, true);
    stage.addEventListener('click', activate, true);
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
