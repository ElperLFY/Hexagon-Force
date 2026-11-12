// Mod menu: a DOM drop-down that slides in from the top of the screen while you are in the menu.
// It is a difficulty multiplier, nothing else:
//   MAP SPEED    scales how fast the walls travel (higher = less time to react = harder)
//   PLAYER SPEED scales how fast the arrow turns   (higher = easier)
// Open it with the tab at the top or with M; Esc closes it; Space still plays the selected level.
const HANDLE=34; // px of the tab that stays visible when the panel is rolled up
const KEYS_FOR_GAME=['Space','Enter','Escape','KeyM']; // these keys must reach the game even if a slider has focus

export class ModMenu{
  constructor(game){
    this.game=game;this.open=false;this.shown=null;
    const root=this.root=document.createElement('div');
    root.id='hexbeat-mod-menu';
    root.style.cssText=`position:fixed;left:50%;top:0;z-index:20;display:none;box-sizing:border-box;width:min(340px,calc(100vw - 24px));`
      +`transform:translate(-50%,calc(-100% + ${HANDLE}px));transition:transform .38s cubic-bezier(.2,.8,.2,1);`
      +`color:#fff;font:700 11px Orbitron,Arial,sans-serif;user-select:none;pointer-events:none`;
    root.innerHTML=`
      <section data-panel inert style="pointer-events:auto;box-sizing:border-box;padding:16px 16px 14px;background:rgba(0,0,0,.94);border:1px solid rgba(255,255,255,.5);border-top:0;border-radius:0 0 14px 14px;box-shadow:0 10px 30px #000a">
        <header style="margin-bottom:6px;font-size:12px">HEXBEAT · MOD MENU</header>
        <label style="display:block;margin:12px 0 5px">MAP SPEED <output data-value="mapSpeed" style="float:right">1.00×</output></label>
        <input data-mod="mapSpeed" type="range" min="0.50" max="2.50" step="0.05" value="1" style="width:100%;margin:0;accent-color:#fff">
        <label style="display:block;margin:14px 0 5px">PLAYER SPEED <output data-value="playerSpeed" style="float:right">1.00×</output></label>
        <input data-mod="playerSpeed" type="range" min="0.50" max="2.50" step="0.05" value="1" style="width:100%;margin:0;accent-color:#fff">
        <p style="margin:14px 0 0;font-size:9px;line-height:1.6;opacity:.65">WALLS FASTER = HARDER · ARROW FASTER = EASIER<br>SAVED · SPACE TO PLAY</p>
        <div style="text-align:right;margin-top:8px">
          <button data-action="reset" style="border:1px solid #aaa;background:#171717;color:#fff;border-radius:7px;padding:6px 10px;font:700 10px Orbitron,Arial;cursor:pointer">RESET</button>
        </div>
      </section>
      <button data-action="toggle" style="pointer-events:auto;display:block;margin:0 auto;height:${HANDLE}px;padding:0 18px;border:1px solid rgba(255,255,255,.5);border-top:0;border-radius:0 0 10px 10px;background:rgba(0,0,0,.82);color:#fff;font:900 11px Orbitron,Arial;cursor:pointer"></button>`;
    document.body.append(root);

    this.panel=root.querySelector('[data-panel]');
    this.handle=root.querySelector('[data-action="toggle"]');
    this.handle.addEventListener('click',()=>{this.toggle();this.handle.blur();});
    root.querySelector('[data-action="reset"]').addEventListener('click',e=>{
      this.game.setMod('mapSpeed',1);this.game.setMod('playerSpeed',1);this.sync();e.currentTarget.blur();
    });
    for(const input of root.querySelectorAll('input')){
      input.addEventListener('input',()=>{this.game.setMod(input.dataset.mod,Number(input.value));this.sync();});
      input.addEventListener('change',()=>input.blur()); // so Space/arrows go back to the game
    }
    // UI gestures must not leak into the canvas controls (except the keys listed above).
    for(const type of ['pointerdown','pointerup','click','keyup'])root.addEventListener(type,e=>e.stopPropagation());
    root.addEventListener('keydown',e=>{if(!KEYS_FOR_GAME.includes(e.code))e.stopPropagation();});
    this.sync();this.setOpen(false);
  }

  // Called every frame by the game: the tab only exists while in the menu.
  show(on){
    if(on===this.shown)return;
    this.shown=on;
    this.root.style.display=on?'block':'none';
    if(!on)this.setOpen(false);
  }

  setOpen(value){
    this.open=!!value;
    this.root.style.transform=this.open?'translate(-50%,0)':`translate(-50%,calc(-100% + ${HANDLE}px))`;
    this.panel.inert=!this.open; // keep the rolled-up sliders out of the tab order
    this.handle.textContent=this.open?'▲ CLOSE [M]':'▼ MODS [M]';
    if(this.open&&this.game.input){this.game.input.L=0;this.game.input.R=0;}
  }

  toggle(){this.setOpen(!this.open);}

  sync(){
    const mods=this.game.mods;
    for(const name of ['mapSpeed','playerSpeed']){
      const input=this.root.querySelector(`[data-mod="${name}"]`);
      const output=this.root.querySelector(`[data-value="${name}"]`);
      if(input)input.value=String(mods[name]);
      if(output)output.textContent=mods[name].toFixed(2)+'×';
    }
  }
}
