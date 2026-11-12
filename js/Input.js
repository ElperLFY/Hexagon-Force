// Tastiera e touch. Tiene lo stato di sinistra/destra e inoltra le azioni al Game.
export class Input{
 constructor(g){this.L=0;this.R=0;
  addEventListener('keydown',e=>{const c=e.code;
   if(g.state==='gate'){g.confirm();return}
   if(c==='ArrowLeft'||c==='KeyA'){this.L=1;g.nav(-1)}
   if(c==='ArrowRight'||c==='KeyD'){this.R=1;g.nav(1)}
   if((c==='Space'||c==='Enter')&&g.state!=='play'){e.preventDefault();document.activeElement?.blur?.();g.confirm()} // blur: uno slider/bottone col focus non deve rubare lo spazio
   if(c==='KeyM'&&g.state==='menu')g.modMenu.toggle();
   if(c==='ArrowUp')g.changeVolume(.05);
   if(c==='ArrowDown')g.changeVolume(-.05);
   if(c==='KeyJ')g.exportChart();
   if(c==='Escape')g.modMenu.open?g.modMenu.setOpen(false):g.back()});
  addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')this.L=0;if(e.code==='ArrowRight'||e.code==='KeyD')this.R=0});
  addEventListener('pointerdown',e=>{const fx=e.clientX/innerWidth,fy=e.clientY/innerHeight;
   if(g.state==='play'){fx<.5?this.L=1:this.R=1}else g.pointer(fx,fy)});
  addEventListener('pointerup',()=>{this.L=this.R=0})}
}
