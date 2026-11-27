(() => {
  'use strict';

  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const trackUrl = new URL('../audio/title-rocknroll.mp3', document.currentScript.src);
  let context;
  let mixer;
  let track;
  let source;

  function stop() {
    if (!source) return;
    source.stop();
    source.disconnect();
    source = undefined;
  }

  function loadTrack() {
    track ??= fetch(trackUrl)
      .then(response => {
        if (!response.ok) throw new Error('Title music failed to load');
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(error => {
        track = undefined;
        throw error;
      });
    return track;
  }

  function canPlay() {
    return balikSound.isPageActive() && !document.hidden && !source;
  }

  function play() {
    if (!AudioEngine || !canPlay()) return;
    if (!context) {
      context = new AudioEngine();
      mixer = balikSound.createMixer(context, stop);
    }

    const ready = context.state === 'running' ? Promise.resolve() : context.resume();
    Promise.all([ready, loadTrack()]).then(([, buffer]) => {
      if (!canPlay() || context.state !== 'running') return;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(mixer.music);
      source.start();
    }).catch(() => {});
  }

  document.addEventListener('click', play, true);
  document.addEventListener('touchend', play, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (context) play();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && context) play();
  });
})();
