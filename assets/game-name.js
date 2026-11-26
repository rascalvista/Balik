'use strict';

const gameName = /^en(?:-|$)/i.test(document.documentElement.lang) ? 'BALICZECH' : 'BALÍČEK';

document.title = document.title.replace(/^BALÍČEK/, gameName);
for (const wordmark of document.querySelectorAll('[data-game-name]')) {
  wordmark.textContent = gameName;
}
