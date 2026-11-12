// Slider del volume (DOM) in basso a sinistra. Salvato in localStorage; anche ↑ ↓ da tastiera.
export class VolumeControl{
 constructor(audio){
  const w=document.createElement('label');
  w.style.cssText="position:fixed;left:14px;bottom:14px;display:flex;gap:8px;align-items:center;padding:6px 12px;border-radius:99px;background:rgba(0,0,0,.5);color:#fff;font:900 11px Orbitron,'Trebuchet MS',sans-serif;user-select:none;z-index:5";
  w.innerHTML='VOL <input type="range" min="0" max="1" step="0.01" style="width:110px;accent-color:#fff">';
  const i=this.input=w.querySelector('input');i.value=audio.vol;
  i.addEventListener('input',()=>audio.setVolume(+i.value));
  i.addEventListener('change',()=>i.blur());
  for(const ev of ['pointerdown','keydown'])w.addEventListener(ev,e=>e.stopPropagation()); // non muove il gioco
  document.body.append(w)}
}
