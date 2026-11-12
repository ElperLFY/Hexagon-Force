// Small live mod menu. It is DOM-based so sliders remain usable on touch screens.
export class ModMenu{
  constructor(game){
    this.game=game;this.open=false;
    this.root=document.createElement('div');
    this.root.id='hexbeat-mod-menu';
    this.root.style.cssText='position:fixed;right:14px;top:14px;z-index:20;color:#fff;font:700 11px Orbitron,Arial,sans-serif;user-select:none;pointer-events:none;';
    this.root.innerHTML=`
      <button data-action="toggle" style="pointer-events:auto;border:1px solid #777;background:rgba(0,0,0,.72);color:#fff;border-radius:8px;padding:9px 12px;font:900 11px Orbitron,Arial;cursor:pointer">MODS [M]</button>
      <section data-panel style="display:none;pointer-events:auto;width:min(280px,calc(100vw - 36px));box-sizing:border-box;margin-top:8px;padding:14px;border:1px solid rgba(255,255,255,.55);border-radius:12px;background:rgba(0,0,0,.92);box-shadow:0 8px 28px #0009">
        <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:12px">
          <span>HEXBEAT · MOD MENU</span><button data-action="close" aria-label="Close" style="border:0;background:none;color:#fff;font-size:18px;cursor:pointer">×</button>
        </header>
        <label style="display:block;margin:10px 0 5px">MAP SPEED <output data-value="mapSpeed">1.00×</output></label>
        <input data-mod="mapSpeed" type="range" min="0.50" max="2.50" step="0.05" value="1" style="width:100%;accent-color:#fff">
        <label style="display:block;margin:12px 0 5px">PLAYER SPEED <output data-value="playerSpeed">1.00×</output></label>
        <input data-mod="playerSpeed" type="range" min="0.50" max="2.50" step="0.05" value="1" style="width:100%;accent-color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <small style="opacity:.7">LIVE · M TO TOGGLE</small>
          <button data-action="reset" style="border:1px solid #aaa;background:#171717;color:#fff;border-radius:7px;padding:6px 10px;font:700 10px Orbitron,Arial;cursor:pointer">RESET</button>
        </div>
      </section>`;
    document.body.append(this.root);
    this.panel=this.root.querySelector('[data-panel]');
    this.root.querySelector('[data-action="toggle"]').addEventListener('click',()=>this.toggle());
    this.root.querySelector('[data-action="close"]').addEventListener('click',()=>this.setOpen(false));
    this.root.querySelector('[data-action="reset"]').addEventListener('click',()=>{
      this.game.setMod('mapSpeed',1);this.game.setMod('playerSpeed',1);this.sync();
    });
    for(const input of this.root.querySelectorAll('input')){
      input.addEventListener('input',()=>this.game.setMod(input.dataset.mod,Number(input.value)));
    }
    // Do not let UI gestures leak into the canvas controls.
    for(const type of ['pointerdown','pointerup','click','keydown','keyup']){
      this.root.addEventListener(type,event=>event.stopPropagation());
    }
    this.sync();
  }

  setOpen(value){
    this.open=!!value;
    this.panel.style.display=this.open?'block':'none';
    if(this.open){this.game.input.L=0;this.game.input.R=0;}
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
