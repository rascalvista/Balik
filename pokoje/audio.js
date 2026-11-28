'use strict';

const roomsAudio = (() => {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const room = new Audio('../audio/reception-jazz.mp3');
  const cabin = new Audio('../audio/music.mp3');
  const tracks = {room, cabin};
  const cues = {
    click: [new Audio('../audio/click.mp3'), .28],
    fold: [new Audio('../audio/laundry-fold.mp3'), .33],
    ding: [new Audio('../audio/ding.mp3'), .34]
  };
  let scene = 'room';
  let context;

  function stop() {
    room.pause();
    cabin.pause();
    Object.values(cues).forEach(([cue]) => cue.pause());
  }

  function sync() {
    for (const [name, track] of Object.entries(tracks)) {
      if (name === scene && balikSound.isPageActive() && !document.hidden) track.play().catch(() => {});
      else track.pause();
    }
  }

  function connect(audio, output, volume, loop = false) {
    const gain = context.createGain();
    gain.gain.value = volume;
    audio.loop = loop;
    context.createMediaElementSource(audio).connect(gain).connect(output);
  }

  function unlock() {
    if (!AudioEngine || !balikSound.isPageActive() || document.hidden) return;
    if (!context) {
      try { context = new AudioEngine(); } catch { return; }
      const mixer = balikSound.createMixer(context, stop);
      connect(room, mixer.music, .24, true);
      connect(cabin, mixer.music, .30, true);
      Object.values(cues).forEach(([cue, volume]) => connect(cue, mixer.effects, volume));
      sync();
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }

  function cue(name) {
    unlock();
    if (!context || !balikSound.isPageActive() || document.hidden) return;
    const [audio] = cues[name];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  document.addEventListener('click', unlock, true);
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('balik:elevator-audio', ({detail}) => {
    if (detail === scene) return;
    scene = detail;
    if (context) sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (context) { unlock(); sync(); }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && context) { unlock(); sync(); }
  });
  balikSound.bindSpeaker(document.querySelector('#sound-toggle'));

  return {cue};
})();
