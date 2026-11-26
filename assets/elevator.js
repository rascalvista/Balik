'use strict';

function createElevatorPanel({floor, destination, onInstall, onTravel}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'elevator-panel';
  dialog.setAttribute('aria-labelledby', 'elevator-title');
  dialog.innerHTML = `
    <div class="elevator-heading">
      <h2 id="elevator-title">Výtah</h2>
      <button type="button" class="elevator-close" aria-label="Zavřít panel výtahu">×</button>
    </div>
    <div class="elevator-display"></div>
    <div class="elevator-buttons" role="group" aria-label="Patra"></div>
    <p class="elevator-instruction" role="status"></p>`;
  const display = dialog.querySelector('.elevator-display');
  display.textContent = floor;
  display.setAttribute('aria-label', 'Aktuální patro ' + floor);
  const buttons = dialog.querySelector('.elevator-buttons');
  const instruction = dialog.querySelector('.elevator-instruction');
  let installed = false;
  let target;

  for (const label of ['0', 'B1', 'B2']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floor-button empty-slot';
    button.textContent = label;
    if (label === destination) {
      target = button;
    } else {
      button.disabled = true;
      if (label === 'B1' && floor === 'B1') {
        button.classList.remove('empty-slot');
        button.setAttribute('aria-current', 'true');
      }
    }
    buttons.append(button);
  }

  function update() {
    target.classList.toggle('empty-slot', !installed);
    target.setAttribute('aria-label', installed
      ? (destination === '0' ? 'Jet do přízemí' : 'Jet do ' + destination)
      : 'Zasadit tlačítko ' + destination);
    instruction.textContent = installed
      ? 'Stiskni ' + destination + '.'
      : 'Zasaď tlačítko ' + destination + ' do volného místa.';
  }

  target.addEventListener('click', () => {
    if (installed) {
      dialog.close();
      onTravel();
      return;
    }
    installed = true;
    update();
    onInstall();
  });

  dialog.querySelector('.elevator-close').addEventListener('click', () => dialog.close());
  update();
  document.body.append(dialog);

  return {
    open() {
      if (dialog.open) return;
      dialog.showModal();
      target.focus();
    },
    reset() {
      if (dialog.open) dialog.close();
      installed = false;
      update();
    }
  };
}
