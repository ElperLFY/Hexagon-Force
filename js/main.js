import {Game} from './Game.js';
import {loadPathRegistry} from './Paths.js';

const canvas=document.getElementById('c');
try{
  const pathRegistry=await loadPathRegistry();
  new Game(canvas,pathRegistry);
}catch(error){
  console.error('[HEXBEAT] Could not load Path data:',error);
  const context=canvas.getContext('2d');
  canvas.width=innerWidth*(devicePixelRatio||1);
  canvas.height=innerHeight*(devicePixelRatio||1);
  context.fillStyle='#080b14';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle='#f3f7ff';
  context.font='bold 18px sans-serif';
  context.textAlign='center';
  context.fillText('PATH DATA ERROR',canvas.width/2,canvas.height/2-12);
  context.font='13px sans-serif';
  context.fillText('Check js/SubData/Paths',canvas.width/2,canvas.height/2+18);
}
