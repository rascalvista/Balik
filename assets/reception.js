'use strict';

const reception = document.querySelector('main');
const find = selector => reception.querySelector(selector);
const cases = [...reception.querySelectorAll('.case')];
const clues = [...reception.querySelectorAll('.clue')];
const dialog = find('#dialog');
const modal = find('.modal');
const reward = find('.reward');
const lift = find('.elevator');
const sound = find('.sound');
const menu = find('.menu');
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
let muted = false;
let audioContext;

try {
  localStorage.setItem('balik.lastFloor', '0');
  muted = localStorage.getItem('balik.sound') === 'off';
} catch {}

function syncSound() {
  sound.style.background = muted ? '#0009' : 'transparent';
  sound.setAttribute('aria-pressed', String(!muted));
}

function beep(correct) {
  if (muted) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = correct ? 660 : 180;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(.08, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + .25);
    oscillator.start();
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
  phase = 'playing';
  current = drawPuzzle(hard ? decks.hard : decks.standard);
  renderClues();
  for (const suitcase of cases) {
    suitcase.disabled = false;
    suitcase.classList.remove('correct', 'wrong');
    suitcase.replaceChildren();
  }
  reward.hidden = lift.hidden = modal.hidden = true;
  const rules = hard ? hardRules : standardRules;
  if (hard) {
    dialog.textContent = '„' + rules + '“';
  } else if (retry) {
    dialog.textContent = '„Další trojice. ' + rules + '“';
  } else {
    dialog.textContent = '„Najděte mi doklady hosta. ' + rules + ' Za pomoc vám dám tlačítko č. 1.“';
  }
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

function show(text, actions) {
  modal.replaceChildren(document.createTextNode(text));
  for (const [label, activate] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', activate);
    modal.append(button);
  }
  modal.hidden = false;
}

difficulty.addEventListener('click', () => {
  hard = !hard;
  reception.classList.toggle('is-hard', hard);
  difficulty.textContent = hard ? 'Lehčí otázky' : 'Těžší hádanky';
  next();
});

reward.addEventListener('click', () => {
  if (phase !== 'correct') return;
  phase = 'rewarded';
  reward.hidden = true;
  lift.hidden = false;
  beep(true);
  dialog.textContent = '„Díky! Konečně do prvního patra.“';
});

lift.addEventListener('click', () => show('1 – Kuchyně odemčena.', [['Hrát znovu', () => next()]]));
find('.reset').addEventListener('click', () => next());
find('.back').addEventListener('click', () => {
  if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
  else location.href = '../';
});
sound.addEventListener('click', () => {
  muted = !muted;
  syncSound();
  try { localStorage.setItem('balik.sound', muted ? 'off' : 'on'); } catch {}
});

if (reception.hasAttribute('data-test')) {
  menu.addEventListener('click', () => show('BALÍK · testovací hádanky', [
    ['Pokračovat', () => { modal.hidden = true; }],
    ['Restartovat patro', () => next()],
    ['B2 · Garáže', () => { location.href = '../b2/'; }],
    ['B1 · Strojovna', () => { location.href = '../'; }],
    ['Hlavní obrazovka', () => { location.href = '../home.html'; }]
  ]));
} else {
  menu.hidden = true;
}

syncSound();
next();
