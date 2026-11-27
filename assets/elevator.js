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
  let traveling = false;
  let arrivalTimer;
  const floorButtons = new Map();

  function setAudioScene(scene) {
    document.dispatchEvent(new CustomEvent('balik:elevator-audio', {detail: scene}));
  }

  for (const label of elevatorFloors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floor-button empty-slot';
    button.textContent = label;
    if (label === floor) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => pressFloor(label, button));
    floorButtons.set(label, button);
    buttons.append(button);
  }

  function syncButtons() {
    const checkpoint = balikProgress.checkpoint(floor);
    for (const [label, button] of floorButtons) {
      const pending = label === destination && checkpoint === 'carrying';
      const installed = balikProgress.isUnlocked(label);
      button.classList.toggle('empty-slot', !installed);
      const futureFloor = label === '2' && floor !== '1';
      button.disabled = traveling || label === floor || futureFloor || (!pending && !installed);
      button.setAttribute('aria-label', pending ? 'Zasadit tlačítko ' + label : futureFloor && installed
        ? '2 · Restaurace se připravuje' : label === floor
        ? 'Aktuální patro ' + label
        : installed ? (label === '0' ? 'Jet do přízemí' : 'Jet do ' + label) : 'Zamčené patro ' + label);
    }
    instruction.textContent = checkpoint === 'carrying'
      ? 'Zasaď tlačítko ' + destination + ' do panelu.'
      : 'Vyber patro.';
  }

  function setDoors(closed) {
    dialog.classList.toggle('doors-closed', closed);
    openDoor.disabled = !closed || traveling;
    shutDoor.disabled = closed || traveling;
  }

  function travel(label, button) {
    traveling = true;
    setDoors(true);
    syncButtons();
    dialog.classList.add('is-traveling');
    button.classList.add('is-selected');
    closePanel.disabled = true;
    instruction.textContent = 'Výtah jede do ' + (label === '0' ? 'přízemí.' : label + '.');
    arrivalTimer = setTimeout(() => {
      if (balikProgress.canVisit(label)) {
        setAudioScene('departing');
        location.replace(balikProgress.floorUrl(label));
        return;
      }
      traveling = false;
      button.classList.remove('is-selected');
      dialog.classList.remove('is-traveling');
      closePanel.disabled = false;
      dialog.close();
      setAudioScene('room');
      onTravel?.();
    }, reducedMotion.matches ? 0 : 1000);
  }

  function pressFloor(label, button) {
    onPress();
    if (button.classList.contains('empty-slot')) {
      if (balikProgress.isUnlocked(label) || balikProgress.install(floor, label)) {
        syncButtons();
        instruction.textContent = 'Stiskni ' + label + '.';
      } else {
        instruction.textContent = 'Postup se nepodařilo uložit. Otevři hru z hlavní obrazovky.';
      }
      return;
    }
    if (balikProgress.isUnlocked(label)) travel(label, button);
  }

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
  dialog.addEventListener('close', () => {
    if (!dialog.open && !traveling) setAudioScene('room');
  });
  dialog.addEventListener('cancel', event => {
    if (traveling) event.preventDefault();
  });

  document.body.append(dialog);

  return {
    open() {
      if (dialog.open || traveling) return;
      syncButtons();
      setDoors(false);
      dialog.showModal();
      setAudioScene('cabin');
      const next = floorButtons.get(destination);
      (next.disabled ? closePanel : next).focus();
    },
    reset() {
      clearTimeout(arrivalTimer);
      traveling = false;
      if (dialog.open) dialog.close();
      setAudioScene('room');
      dialog.classList.remove('is-traveling');
      buttons.querySelector('.is-selected')?.classList.remove('is-selected');
      closePanel.disabled = false;
      setDoors(false);
      syncButtons();
    }
  };
}
