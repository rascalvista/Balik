'use strict';

const elevatorFloors = [
  '3',  '9',
  '2',  '8',
  '1',  '7',
  '0',  '6',
  'B1', '5',
  'B2', '4'
];

function createElevatorPanel({floor, destination, onPress, onTravel}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'elevator-panel';
  dialog.setAttribute('aria-label', 'Výtah');
  dialog.innerHTML = `
    <div class="elevator-cabin">
      <div class="elevator-gate" aria-hidden="true"><div class="elevator-grille"></div></div>
      <div class="elevator-wall">
        <button type="button" class="elevator-close" aria-label="Zavřít panel výtahu">×</button>
        <div class="elevator-plate">
          <div class="elevator-display"></div>
          <div class="elevator-door-controls" role="group" aria-label="Dveře výtahu">
            <button type="button" class="floor-button elevator-door-open" aria-label="Otevřít dveře kabiny">
              <span class="door-chevrons" aria-hidden="true"></span>
            </button>
            <button type="button" class="floor-button elevator-door-shut" aria-label="Zavřít dveře kabiny">
              <span class="door-chevrons" aria-hidden="true"></span>
            </button>
          </div>
          <div class="elevator-buttons" role="group" aria-label="Patra"></div>
        </div>
        <p class="elevator-instruction" role="status"></p>
      </div>
    </div>`;
  const display = dialog.querySelector('.elevator-display');
  display.textContent = floor;
  display.setAttribute('aria-label', 'Aktuální patro ' + floor);
  const buttons = dialog.querySelector('.elevator-buttons');
  const instruction = dialog.querySelector('.elevator-instruction');
  const closePanel = dialog.querySelector('.elevator-close');
  const openDoor = dialog.querySelector('.elevator-door-open');
  const shutDoor = dialog.querySelector('.elevator-door-shut');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let installed = false;
  let traveling = false;
  let arrivalTimer;
  let target;

  for (const label of elevatorFloors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floor-button empty-slot';
    button.textContent = label;
    button.disabled = label !== destination;
    if (label === destination) target = button;
    if (label === floor) {
      button.setAttribute('aria-current', 'true');
      if (floor === 'B1') button.classList.remove('empty-slot');
    }
    buttons.append(button);
  }

  function updateTarget() {
    target.classList.toggle('empty-slot', !installed);
    target.setAttribute('aria-label', installed
      ? (destination === '0' ? 'Jet do přízemí' : 'Jet do ' + destination)
      : 'Zasadit tlačítko ' + destination);
    instruction.textContent = installed
      ? 'Stiskni ' + destination + '.'
      : 'Zasaď tlačítko ' + destination + ' do panelu.';
  }

  function setDoors(closed) {
    dialog.classList.toggle('doors-closed', closed);
    openDoor.disabled = !closed || traveling;
    shutDoor.disabled = closed || traveling;
  }

  function travel() {
    traveling = true;
    setDoors(true);
    dialog.classList.add('is-traveling');
    target.classList.add('is-selected');
    target.disabled = true;
    closePanel.disabled = true;
    instruction.textContent = 'Výtah jede do ' + (destination === '0' ? 'přízemí.' : destination + '.');
    arrivalTimer = setTimeout(() => {
      dialog.close();
      onTravel();
    }, reducedMotion.matches ? 0 : 1000);
  }

  target.addEventListener('click', () => {
    onPress();
    if (installed) {
      travel();
      return;
    }
    installed = true;
    updateTarget();
  });

  openDoor.addEventListener('click', () => {
    setDoors(false);
    shutDoor.focus();
    onPress();
  });
  shutDoor.addEventListener('click', () => {
    setDoors(true);
    openDoor.focus();
    onPress();
  });
  closePanel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    if (traveling) event.preventDefault();
  });

  updateTarget();
  document.body.append(dialog);

  return {
    open() {
      if (dialog.open || traveling) return;
      setDoors(false);
      dialog.showModal();
      target.focus();
    },
    reset() {
      clearTimeout(arrivalTimer);
      traveling = false;
      installed = false;
      if (dialog.open) dialog.close();
      dialog.classList.remove('is-traveling');
      target.classList.remove('is-selected');
      target.disabled = false;
      closePanel.disabled = false;
      setDoors(false);
      updateTarget();
    }
  };
}
