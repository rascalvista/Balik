'use strict';

const reception = document.querySelector('main');
const find = selector => reception.querySelector(selector);
const cases = [...reception.querySelectorAll('.case')];
const clues = [...reception.querySelectorAll('.clue')];
const dialog = find('#dialog');
const reward = find('.reward');
const lift = find('.elevator');
const sound = find('.sound');
const difficulty = find('#difficulty');

const decks = {
  standard: {puzzles: receptionPuzzles.standard, queue: [], last: null},
  hard: {puzzles: receptionPuzzles.hard, queue: [], last: null}
};
const standardRules = 'Alespoň jeden výrok je pravdivý a alespoň jeden nepravdivý. Doklady jsou jen v jednom kufru.';
const hardRules = 'Doklady jsou v jediném kufru. Alespoň jeden kufr má dvě pravdy a alespoň jeden dvě lži.';
let hard = false;
let current;
let phase;
let retryTimer;
const SoundContext = window.AudioContext || window.webkitAudioContext;
let audioContext;
let soundMixer;
const musicBuffers = new Map();
let musicVoice;
let audioScene = 'room';
const tones = new Set();
const elevator = createElevatorPanel({
  floor: '0',
  destination: '1',
  onPress: () => beep(true)
});

function stopMusic() {
  const voice = musicVoice;
  musicVoice = null;
  voice?.source?.stop();
}

function startMusic() {
  if (!audioContext || musicVoice || audioScene === 'departing' || !balikSound.isPageActive()) return;
  const inCabin = audioScene === 'cabin';
  const file = inCabin ? '../audio/music.mp3' : '../audio/reception-jazz.mp3';
  const voice = {};
  musicVoice = voice;
  if (!musicBuffers.has(file)) {
    musicBuffers.set(file, fetch(file)
      .then(response => {
        if (!response.ok) throw new Error('Music failed to load');
        return response.arrayBuffer();
      })
      .then(bytes => audioContext.decodeAudioData(bytes))
      .catch(() => {
        musicBuffers.delete(file);
        return null;
      }));
  }

  musicBuffers.get(file).then(buffer => {
    if (musicVoice !== voice) return;
    if (!buffer) {
      musicVoice = null;
      return;
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(soundMixer.music);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(inCabin ? .32 : .24, now + .45);
    voice.source = source;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(now);
  });
}

document.addEventListener('balik:elevator-audio', ({detail}) => {
  if (audioScene === detail) return;
  audioScene = detail;
  stopMusic();
  startMusic();
});

function activateAudio() {
  if (!balikSound.isPageActive()) return;
  if (!audioContext) {
    audioContext = new SoundContext();
    soundMixer = balikSound.createMixer(audioContext, () => {
      stopMusic();
      for (const tone of tones) tone.stop();
    });
  }
  if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
  startMusic();
}

function beep(correct) {
  if (!audioContext || !balikSound.isPageActive()) return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(soundMixer.effects);
    oscillator.frequency.value = correct ? 660 : 180;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(.08, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + .25);
    oscillator.onended = () => {
      tones.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    tones.add(oscillator);
    oscillator.stop(now + .26);
  } catch {}
}

function drawPuzzle(deck) {
  if (!deck.queue.length) {
    deck.queue = deck.puzzles.slice();
    const lastIndex = deck.queue.length - 1;
    for (let i = lastIndex; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck.queue[i], deck.queue[j]] = [deck.queue[j], deck.queue[i]];
    }
    if (deck.queue[lastIndex] === deck.last) {
      deck.queue.unshift(deck.queue.pop());
    }
  }
  deck.last = deck.queue.pop();
  return deck.last;
}

function renderClues() {
  current[0].forEach((statements, index) => {
    const [upper, lower] = clues[index].children;
    upper.firstElementChild.hidden = !hard;
    upper.lastElementChild.textContent = hard ? statements[0] : statements;
    lower.lastElementChild.textContent = hard ? statements[1] : '';
    lower.hidden = !hard;
  });
}

function next(retry = false) {
  clearTimeout(retryTimer);
  dialog.dataset.dialogueVoice = 'receptionist';
  phase = 'playing';
  elevator.reset();
  current = drawPuzzle(hard ? decks.hard : decks.standard);
  renderClues();
  for (const suitcase of cases) {
    suitcase.disabled = false;
    suitcase.classList.remove('correct', 'wrong');
    suitcase.replaceChildren();
  }
  reward.hidden = lift.hidden = true;
  const rules = hard ? hardRules : standardRules;
  if (hard) {
    dialog.textContent = '„' + rules + '“';
  } else if (retry) {
    dialog.textContent = '„Další trojice. ' + rules + '“';
  } else {
    dialog.textContent = '„Najděte mi doklady hosta. ' + rules + ' Za pomoc vám dám tlačítko č. 1.“';
  }
  startMusic();
}

cases.forEach((suitcase, index) => {
  suitcase.addEventListener('click', () => {
    if (phase !== 'playing') return;
    for (const option of cases) option.disabled = true;
    const correct = index === current[1];
    phase = correct ? 'correct' : 'retry';
    beep(correct);
    suitcase.classList.add(correct ? 'correct' : 'wrong');
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = correct ? 'DOKLADY' : 'BEZ DOKLADŮ';
    suitcase.append(tag);
    if (correct) {
      dialog.textContent = '„Výborně, to jsou ony! Jak jsem slíbila, tady máte náhradní tlačítko.“';
      reward.hidden = false;
    } else {
      dialog.textContent = '„Tady nejsou. Máme tu ještě další nevydané zásilky. Zkusíme další trojici.“';
      retryTimer = setTimeout(() => next(true), 2300);
    }
  });
});

difficulty.addEventListener('click', () => {
  hard = !hard;
  reception.classList.toggle('is-hard', hard);
  difficulty.textContent = hard ? 'Lehčí otázky' : 'Těžší hádanky';
  next();
});

function showLift(message) {
  phase = 'rewarded';
  for (const suitcase of cases) suitcase.disabled = true;
  reward.hidden = true;
  lift.hidden = false;
  dialog.dataset.dialogueVoice = 'courier';
  dialog.textContent = message;
}

reward.addEventListener('click', () => {
  if (phase !== 'correct') return;
  balikProgress.collect('0');
  beep(true);
  showLift('„Díky! Konečně do prvního patra.“');
});

lift.addEventListener('click', () => {
  if (phase === 'rewarded') elevator.open();
});
find('.reset').addEventListener('click', () => next());
find('.back').addEventListener('click', () => {
  stopMusic();
  location.href = balikProgress.home;
});
if (SoundContext) document.addEventListener('click', activateAudio, true);
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  if (audioContext) activateAudio();
});
balikSound.bindSpeaker(sound, {painted: true});
next();
const checkpoint = balikProgress.checkpoint('0');
if (checkpoint === 'carrying' || checkpoint === 'installed') {
  showLift(checkpoint === 'carrying'
    ? '„Mám tlačítko 1. Zacvaknu ho ve výtahu.“'
    : '„Doklady jsou předané. Výtahem můžu dál.“');
}
