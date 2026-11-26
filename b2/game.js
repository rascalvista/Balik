'use strict';

const fleet = [
  {length: 2, axis: 'h', image: 'car-00.png'},
  {length: 2, axis: 'v', image: 'car-01.png'},
  {length: 3, axis: 'v', image: 'car-02.png'},
  {length: 2, axis: 'v', image: 'car-03.png'},
  {length: 2, axis: 'v', image: 'car-04.png'},
  {length: 2, axis: 'v', image: 'car-05.png'},
  {length: 2, axis: 'v', image: 'car-06.png'},
  {length: 2, axis: 'h', image: 'car-07.png'},
  {length: 2, axis: 'v', image: 'car-04.png'},
  {length: 2, axis: 'v', image: 'car-01.png'},
  {length: 2, axis: 'h', image: 'car-10.png'},
  {length: 2, axis: 'h', image: 'car-07.png'},
  {length: 2, axis: 'v', image: 'car-06.png'},
  {length: 2, axis: 'v', image: 'car-03.png'}
];
// A is the red car. Each letter occupies the cells of one vehicle from the fleet.
const parkingLayouts = [
  ['.KK.BN', 'DFHHBN', 'DFEJAA', '.GEJ.C', 'MGI..C', 'M.ILLC'],
  ['IGELLF', 'IGEM.F', '.C.MAA', 'DCBJN.', 'DCBJN.', 'HH..KK'],
  ['EKKM.J', 'E.IM.J', 'CBIAAF', 'CBLLNF', 'C.D.NG', '..DHHG'],
  ['.KK.E.', 'D...EF', 'DIJAAF', 'CIJGHH', 'CNMG.B', 'CNMLLB'],
  ['J.LLFN', 'JGB.FN', '.GBEAA', 'CI.EKK', 'CID..M', 'C.DHHM'],
  ['.NHHBI', 'FNGDBI', 'F.GDAA', 'ECMJKK', 'ECMJ..', '.C..LL'],
  ['LL..F.', 'MIBNF.', 'MIBNAA', 'DGC..E', 'DGCJ.E', 'KKCJHH'],
  ['FN.HHE', 'FNBLLE', 'C.BGAA', 'C..GI.', 'CJMDI.', '.JMDKK'],
  ['.HH.FB', 'DI.CFB', 'DIMCAA', '.GMCKK', 'JGN..E', 'J.NLLE'],
  ['GN.KKE', 'GNIM.E', '.CIMAA', 'DCJB..', 'DCJBF.', 'HHLLF.'],
  ['..HHNI', 'DG.FNI', 'DGMFAA', 'CBM.KK', 'CBE..J', 'C.ELLJ'],
  ['HHFDEG', 'JIFDEG', 'JI.BAA', 'MKKBCN', 'M...CN', '.LL.C.']
];
const vehicleLabels = 'ABCDEFGHIJKLMN';
const parkingDeckKey = 'balik.parkingDeck.v1';
const board = {x: 188, y: 76, cell: 36, size: 6};
const targetCar = 0;
const door = {x: 44, y: 93, width: 46, height: 50};
const carInset = 3;
const laneLeft = 109;
const exitDistance = (board.x - laneLeft) / board.cell;
const laneTop = board.y + 2 * board.cell;
const parkedMessage = 'Ve výtahu chybí všechna tlačítka. Portýr říkal, že správce má vždycky jedno rezervní v kufru auta. ' +
  'Jenže auta jsou tak těsně zaparkovaná, že kufr nejde otevřít. A já strašně spěchám! ' +
  'Odsuň ostatní auta a vyjeď červeným vozem doleva.';

const canvas = document.getElementById('parking');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const message = document.getElementById('message');
const count = document.getElementById('count');
const undo = document.getElementById('undo');
const reset = document.getElementById('reset');
const trunk = document.getElementById('trunk');
const pickup = document.getElementById('pickup');
const elevatorEntry = document.getElementById('elevator-entry');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const panel = createElevatorPanel({
  floor: 'B2',
  destination: 'B1',
  onPress: () => garageAudio.play('click'),
  onTravel: () => window.location.assign('../')
});

function placeControl(button, {x, y, width, height}) {
  Object.assign(button.style, {
    left: (x / canvas.width * 100) + '%',
    top: (y / canvas.height * 100) + '%',
    width: (width / canvas.width * 100) + '%',
    height: (height / canvas.height * 100) + '%'
  });
}

placeControl(trunk, {x: laneLeft, y: laneTop, width: board.cell, height: board.cell});
placeControl(pickup, {
  x: laneLeft + carInset, y: laneTop + carInset,
  width: board.cell - 2 * carInset, height: board.cell - 2 * carInset
});
placeControl(elevatorEntry, door);

const parkingDeck = restoreParkingDeck();
let vehicles;
let positions;
let visual;
let history;
let phase = 'parking';
let drag = null;
let snap = null;
let exitStarted = 0;
let doorStarted = null;
let frame = null;
let floorTexture;

function requestDraw() {
  if (frame === null) frame = requestAnimationFrame(draw);
}

function loadImage(filename) {
  const image = new Image();
  image.addEventListener('load', requestDraw, {once: true});
  image.src = 'assets/' + filename;
  return image;
}

const background = loadImage('garage-background.png');
const carImages = fleet.map(vehicle => loadImage(vehicle.image));

function restoreParkingDeck() {
  const isLayout = index => Number.isInteger(index) && index >= 0 && index < parkingLayouts.length;
  try {
    const saved = JSON.parse(localStorage.getItem(parkingDeckKey));
    if (isLayout(saved?.last) && Array.isArray(saved.remaining) &&
        saved.remaining.every(index => isLayout(index) && index !== saved.last) &&
        new Set(saved.remaining).size === saved.remaining.length) {
      return saved;
    }
  } catch {}
  return {remaining: [], last: null};
}

function drawParkingLayout() {
  if (!parkingDeck.remaining.length) {
    const shuffled = parkingLayouts.map((_, index) => index);
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const top = shuffled.length - 1;
    if (shuffled[top] === parkingDeck.last) {
      const swapIndex = Math.floor(Math.random() * top);
      [shuffled[top], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[top]];
    }
    parkingDeck.remaining = shuffled;
  }

  const index = parkingDeck.remaining.pop();
  parkingDeck.last = index;
  try { localStorage.setItem(parkingDeckKey, JSON.stringify(parkingDeck)); } catch {}
  const diagram = parkingLayouts[index].join('');
  return fleet.map((vehicle, index) => {
    const cell = diagram.indexOf(vehicleLabels[index]);
    return {...vehicle, x: cell % board.size, y: Math.floor(cell / board.size)};
  });
}

function carRect(index, offset) {
  const vehicle = vehicles[index];
  return vehicle.axis === 'h'
    ? {x: offset, y: vehicle.y, width: vehicle.length, height: 1}
    : {x: vehicle.x, y: offset, width: 1, height: vehicle.length};
}

function canPlace(index, offset) {
  if (offset < 0 || offset + vehicles[index].length > board.size) return false;
  const box = carRect(index, offset);
  return positions.every((current, other) => {
    if (other === index) return true;
    const occupied = carRect(other, current);
    return box.x + box.width <= occupied.x || occupied.x + occupied.width <= box.x ||
      box.y + box.height <= occupied.y || occupied.y + occupied.height <= box.y;
  });
}

function movementBounds(index) {
  let low = positions[index];
  let high = low;
  while (canPlace(index, low - 1)) low--;
  while (canPlace(index, high + 1)) high++;
  return {low, high};
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function updateControls() {
  count.textContent = 'Tahů: ' + history.length;
  undo.disabled = phase !== 'parking' || !history.length || Boolean(drag || snap);
  trunk.hidden = phase !== 'trunk';
  pickup.hidden = phase !== 'pickup';
  elevatorEntry.hidden = phase !== 'elevator';
}

function endDrag() {
  const previous = drag;
  drag = null;
  canvas.classList.remove('dragging');
  if (previous && canvas.hasPointerCapture(previous.pointerId)) {
    canvas.releasePointerCapture(previous.pointerId);
  }
}

function resetPuzzle() {
  garageAudio.stopEffects();
  endDrag();
  vehicles = drawParkingLayout();
  positions = vehicles.map(vehicle => vehicle.axis === 'h' ? vehicle.x : vehicle.y);
  visual = positions.slice();
  history = [];
  phase = 'parking';
  snap = null;
  exitStarted = 0;
  doorStarted = null;
  panel.reset();
  message.textContent = parkedMessage;
  updateControls();
  requestDraw();
}

function checkExit() {
  if (positions[targetCar] === 0) {
    exitStarted = performance.now();
    phase = 'exiting';
    garageAudio.play('roll', reducedMotion.matches ? .26 : .65);
  }
  updateControls();
}

canvas.addEventListener('pointerdown', event => {
  if (phase !== 'parking' || snap || drag || event.button !== 0) return;
  const pointer = point(event);
  const column = (pointer.x - board.x) / board.cell;
  const row = (pointer.y - board.y) / board.cell;
  const index = positions.findIndex((offset, car) => {
    const rect = carRect(car, offset);
    return column >= rect.x && column < rect.x + rect.width &&
      row >= rect.y && row < rect.y + rect.height;
  });
  if (index === -1) return;
  const axis = vehicles[index].axis === 'h' ? 'x' : 'y';
  drag = {
    index, axis, pointerId: event.pointerId,
    start: pointer[axis], base: positions[index], ...movementBounds(index)
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  updateControls();
});

function movePointer(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const {index, axis, start, base, low, high} = drag;
  const offset = base + (point(event)[axis] - start) / board.cell;
  visual[index] = Math.max(low, Math.min(high, offset));
  requestDraw();
}

canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  movePointer(event);
  const {index} = drag;
  const offset = Math.round(visual[index]);
  if (offset !== positions[index]) {
    history.push(positions.slice());
    positions[index] = offset;
    if (index !== targetCar || offset !== 0) garageAudio.play('roll', .26);
  }
  endDrag();
  if (visual[index] === offset || reducedMotion.matches) {
    visual[index] = offset;
    checkExit();
  } else {
    snap = {index, from: visual[index], to: offset, start: performance.now()};
    updateControls();
  }
  requestDraw();
});

function cancelPointer(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  visual[drag.index] = positions[drag.index];
  endDrag();
  updateControls();
  requestDraw();
}

canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);

undo.addEventListener('click', () => {
  if (undo.disabled) return;
  positions = history.pop();
  visual = positions.slice();
  garageAudio.play('click');
  updateControls();
  requestDraw();
});
reset.addEventListener('click', resetPuzzle);
trunk.addEventListener('click', () => {
  if (phase !== 'trunk') return;
  phase = 'pickup';
  garageAudio.play('trunk');
  message.textContent = 'Tlačítko B1! Vyzvedni ho z kufru.';
  updateControls();
  pickup.focus({preventScroll: true});
});
pickup.addEventListener('click', () => {
  if (phase !== 'pickup') return;
  phase = 'opening';
  doorStarted = performance.now();
  garageAudio.play('ding');
  message.textContent = 'Mám tlačítko B1. Výtah se otevírá.';
  updateControls();
  requestDraw();
});
elevatorEntry.addEventListener('click', () => {
  if (phase === 'elevator') panel.open();
});

function drawDoors(progress) {
  const {x, y, width, height} = door;
  const half = width / 2;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = '#111d29';
  context.fillRect(x, y, width, height);
  context.fillStyle = '#243444';
  context.fillRect(x + 4, y + 4, width - 8, height - 12);
  context.fillStyle = '#56616a';
  context.fillRect(x + 5, y + height - 8, width - 10, 2);
  context.fillStyle = '#313b48';
  context.fillRect(x, y + height - 6, width, 6);
  const travel = Math.round(progress * half);
  if (travel < half) {
    context.drawImage(background, x, y, half, height, x - travel, y, half, height);
    context.drawImage(background, x + half, y, half, height, x + half + travel, y, half, height);
  }
  context.restore();
}

function drawParkingLines() {
  if (!floorTexture) {
    // Mirror a strip of the original bare asphalt to hide its smaller grid.
    const sample = document.createElement('canvas');
    const width = 24;
    const height = 92;
    sample.width = width * 2;
    sample.height = height;
    const texture = sample.getContext('2d');
    texture.fillStyle = '#253441';
    texture.fillRect(0, 0, sample.width, sample.height);
    texture.drawImage(background, 117, 190, width, height, 0, 0, width, height);
    texture.translate(sample.width, 0);
    texture.scale(-1, 1);
    texture.drawImage(background, 117, 190, width, height, 0, 0, width, height);
    floorTexture = context.createPattern(sample, 'repeat');
  }

  const side = board.cell * board.size;
  const bottom = board.y + side;
  context.fillStyle = floorTexture;
  context.fillRect(board.x, board.y, side, side);
  context.fillRect(laneLeft, laneTop, board.x - laneLeft, board.cell);

  context.fillStyle = '#8797a186';
  for (let i = 0; i <= board.size; i++) {
    const y = board.y + i * board.cell;
    context.fillRect(board.x, y, side, 1);
    const x = board.x + i * board.cell;
    if (i === 0) {
      context.fillRect(x, board.y, 1, laneTop - board.y);
      context.fillRect(x, laneTop + board.cell, 1, bottom - laneTop - board.cell);
    } else {
      context.fillRect(x, board.y, 1, side);
    }
  }
  context.fillStyle = '#c3a568a6';
  const laneLength = board.x - laneLeft;
  context.fillRect(laneLeft, laneTop, laneLength, 1);
  context.fillRect(laneLeft, laneTop + board.cell, laneLength, 1);
}

function draw(time) {
  frame = null;
  if (snap) {
    const progress = Math.min(1, Math.max(0, (time - snap.start) / 140));
    visual[snap.index] = snap.from + (snap.to - snap.from) * progress;
    if (progress === 1) {
      snap = null;
      checkExit();
    }
  }

  let carOffset = visual[targetCar];
  if (phase !== 'parking') {
    const duration = reducedMotion.matches ? 1 : 650;
    const progress = Math.min(1, Math.max(0, (time - exitStarted) / duration));
    carOffset = -exitDistance * progress;
    if (phase === 'exiting' && progress === 1) {
      phase = 'trunk';
      message.textContent = 'Auto je venku. Otevři zvýrazněný kufr.';
      updateControls();
      trunk.focus({preventScroll: true});
    }
  }

  let doorProgress = 0;
  if (doorStarted !== null) {
    const duration = reducedMotion.matches ? 1 : 760;
    doorProgress = Math.min(1, Math.max(0, (time - doorStarted) / duration));
    if (phase === 'opening' && doorProgress === 1) {
      phase = 'elevator';
      message.textContent = 'Nastup do výtahu a zasaď tlačítko B1.';
      updateControls();
      elevatorEntry.focus({preventScroll: true});
    }
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (background.complete && background.naturalWidth) {
    context.drawImage(background, 0, 0);
    if (doorProgress > 0) drawDoors(doorProgress);
    drawParkingLines();
  }
  for (const [index, image] of carImages.entries()) {
    if (!image.naturalWidth) continue;
    const rect = carRect(index, index === targetCar ? carOffset : visual[index]);
    context.drawImage(image,
      Math.round(board.x + rect.x * board.cell + carInset),
      Math.round(board.y + rect.y * board.cell + carInset),
      rect.width * board.cell - 2 * carInset,
      rect.height * board.cell - 2 * carInset
    );
  }
  if (snap || phase === 'exiting' || phase === 'opening') requestDraw();
}

resetPuzzle();
