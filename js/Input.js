// Keyboard, pointer and touch controls for HEXBEAT screens and gameplay.
export class Input {
  constructor(game) {
    this.L = 0;
    this.R = 0;
    addEventListener('keydown', event => {
      const code = event.code;
      // A modal Settings screen owns keyboard input; don't let Tab open scores
      // or menu shortcuts leak through if focus reaches the document.
      if (game.uiOverlay === 'settings') {
        if (code === 'Escape' && !event.repeat) {
          event.preventDefault();
          game.settingsPanel.close();
        }
        return;
      }
      if (code === 'Tab' && game.state !== 'play' && game.state !== 'load') {
        event.preventDefault();
        game.toggleHighScores();
        return;
      }
      if (code === 'Escape') {
        if (event.repeat) return;
        else if (game.uiOverlay === 'scores') game.toggleHighScores();
        else if (game.state === 'gate') game.quit();
        else game.back(); // In play: abandon this run and return to stage select.
        return;
      }
      if ((code === 'KeyM' || code === 'KeyS') &&
          game.state !== 'play' && game.state !== 'load') {
        game.toggleSettings();
        return;
      }
      if (game.state === 'gate') {
        if (code === 'ArrowLeft' || code === 'KeyA') game.nav(-1);
        else if (code === 'ArrowRight' || code === 'KeyD') game.nav(1);
        else if (code === 'Space' || code === 'Enter') {
          event.preventDefault(); document.activeElement?.blur?.(); game.confirm();
        }
        return;
      }
      if (game.state === 'menu') {
        if (code === 'ArrowLeft' || code === 'KeyA') { game.nav(-1); return; }
        if (code === 'ArrowRight' || code === 'KeyD') { game.nav(1); return; }
        if (code === 'Space' || code === 'Enter') {
          event.preventDefault(); document.activeElement?.blur?.(); game.confirm(); return;
        }
        if (code === 'ArrowUp') game.changeVolume(.05);
        if (code === 'ArrowDown') game.changeVolume(-.05);
        if (code === 'KeyJ') game.exportChart();
        return;
      }
      if (game.state === 'play') {
        if (code === 'ArrowLeft' || code === 'KeyA') this.L = 1;
        if (code === 'ArrowRight' || code === 'KeyD') this.R = 1;
        return;
      }
      if ((game.state === 'dead' || game.state === 'win') &&
          (code === 'Space' || code === 'Enter')) {
        event.preventDefault(); game.confirm();
      }
    });
    addEventListener('keyup', event => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.L = 0;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.R = 0;
    });
    addEventListener('pointerdown', event => {
      const x = event.clientX / innerWidth;
      const y = event.clientY / innerHeight;
      if (game.state === 'play') { x < .5 ? this.L = 1 : this.R = 1; }
      else game.pointer(x, y);
    });
    addEventListener('pointerup', () => { this.L = 0; this.R = 0; });
    addEventListener('pointercancel', () => { this.L = 0; this.R = 0; });
  }
}