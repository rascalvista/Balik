'use strict';

const vehicles = [
  {x: 4, y: 2, length: 2, axis: 'h', image: 'car-00.png'},
  {x: 4, y: 0, length: 2, axis: 'v', image: 'car-01.png'},
  {x: 5, y: 3, length: 3, axis: 'v', image: 'car-02.png'},
  {x: 0, y: 1, length: 2, axis: 'v', image: 'car-03.png'},
  {x: 2, y: 2, length: 2, axis: 'v', image: 'car-04.png'},
  {x: 1, y: 1, length: 2, axis: 'v', image: 'car-05.png'},
  {x: 1, y: 3, length: 2, axis: 'v', image: 'car-06.png'},
  {x: 2, y: 1, length: 2, axis: 'h', image: 'car-07.png'},
  {x: 2, y: 4, length: 2, axis: 'v', image: 'car-04.png'},
  {x: 3, y: 2, length: 2, axis: 'v', image: 'car-01.png'},
  {x: 1, y: 0, length: 2, axis: 'h', image: 'car-10.png'},
  {x: 3, y: 5, length: 2, axis: 'h', image: 'car-07.png'},
  {x: 0, y: 4, length: 2, axis: 'v', image: 'car-06.png'},
  {x: 5, y: 0, length: 2, axis: 'v', image: 'car-03.png'}
];
const board = {x: 156, y: 64, cell: 40, size: 6};
const targetCar = 0;
const carInset = 3;
const exitDistance = 2;
const laneLeft = board.x - exitDistance * board.cell;
const laneTop = board.y + vehicles[targetCar].y * board.cell;
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
const use = document.getElementById('use');
const nextLevel = document.getElementById('next-level');
Object.assign(trunk.style, {
  left: (laneLeft / canvas.width * 100) + '%',
  top: (laneTop / canvas.height * 100) + '%',
  width: (board.cell / canvas.width * 100) + '%',
  height: (board.cell / canvas.height * 100) + '%'
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let positions;
let visual;
let history;
let phase = 'parking';
let drag = null;
let snap = null;
let exitStarted = 0;
let frame = null;

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
const carImages = vehicles.map(vehicle => loadImage(vehicle.image));

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
  use.hidden = phase !== 'button';
  nextLevel.hidden = phase !== 'done';
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
  positions = vehicles.map(vehicle => vehicle.axis === 'h' ? vehicle.x : vehicle.y);
  visual = positions.slice();
  history = [];
  phase = 'parking';
  snap = null;
  exitStarted = 0;
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
  phase = 'button';
  garageAudio.play('trunk');
  message.textContent = 'Tlačítko B1! Tak konečně.';
  updateControls();
  use.focus({preventScroll: true});
  requestDraw();
});
use.addEventListener('click', () => {
  if (phase !== 'button') return;
  phase = 'done';
  garageAudio.play('ding');
  message.textContent = 'B1 odemčeno. Tak snad už mě nikdo nezdrží!';
  updateControls();
  nextLevel.focus({preventScroll: true});
  requestDraw();
});

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

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (background.naturalWidth) {
    context.drawImage(background, 0, 0);
    // Reuse the floor markings from the supplied garage art at the larger scale.
    context.drawImage(background, 109, 148, 105, 32, laneLeft, laneTop, board.x - laneLeft, board.cell);
    const boardSide = board.size * board.cell;
    context.drawImage(background, 214, 88, 180, 180, board.x, board.y, boardSide, boardSide);
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
  if (phase === 'button') {
    context.fillStyle = '#e4bd60';
    context.fillRect(laneLeft + 10, laneTop + 11, 16, 16);
    context.fillStyle = '#202a33';
    context.font = '10px monospace';
    context.fillText('B1', laneLeft + 12, laneTop + 23);
  }
  if (snap || phase === 'exiting') requestDraw();
}

resetPuzzle();
