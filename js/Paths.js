const hsl=(h,s,l)=>`hsl(${((h%360)+360)%360},${s}%,${l}%)`;

export function createPalette(definition){
  if(!definition||typeof definition.type!=='string')throw new Error('Each Path level needs a palette definition');
  switch(definition.type){
    case 'sweep':
      return (time=0)=>{
        let phase=(Math.max(0,time)/(definition.period||30))%2;
        if(phase>1)phase=2-phase;
        const hue=(definition.hueStart??120)+((definition.hueEnd??0)-(definition.hueStart??120))*phase;
        return {
          b1:hsl(hue,definition.saturation??62,definition.lightness??64),
          b2:hsl(hue,definition.saturation??62,(definition.lightness??64)-7),
          w:hsl(hue,definition.saturation??70,definition.wallLightness??22),
          p:hsl(hue,definition.saturation??40,definition.foregroundLightness??96)
        };
      };
    case 'pair':
      return (_time=0,inverted=false)=>inverted&&definition.inverted
        ?{...definition.inverted}:{...definition.normal};
    case 'fixed':
      return ()=>({b1:definition.b1,b2:definition.b2,w:definition.w,p:definition.p});
    case 'rgb':
      return (time=0)=>{
        const t=Math.max(0,time);
        const curveSeconds=definition.curveSeconds??120;
        const s=Math.min(t,curveSeconds);
        const hue=((definition.hueRate??10)*t+(definition.curve??25)*s*s/curveSeconds+
          (definition.linearAfter??50)*(t-s)+(definition.hueStart??25))%360;
        return {
          b1:hsl(hue,definition.saturation??62,definition.lightness??64),
          b2:hsl(hue+30,definition.saturation??62,(definition.lightness??64)-7),
          w:hsl(hue,definition.saturation??70,definition.wallLightness??22),
          p:hsl(hue,definition.saturation??40,definition.foregroundLightness??96)
        };
      };
    default:
      throw new Error('Unsupported Path palette type: '+definition.type);
  }
}

export function buildPathRegistry(catalog,documents){
  if(catalog?.schemaVersion!==1||!Array.isArray(catalog.paths)||!catalog.paths.length){
    throw new Error('Invalid Paths catalog');
  }
  const seen=new Set();
  const paths=catalog.paths.map(entry=>{
    if(!entry?.id||!entry?.file||seen.has(entry.id))throw new Error('Invalid or duplicated Path catalog entry');
    seen.add(entry.id);
    const definition=documents[entry.file];
    if(!definition||definition.schemaVersion!==1||definition.id!==entry.id||!Array.isArray(definition.levels)){
      throw new Error('Path definition does not match catalog: '+entry.id);
    }
    const levelIds=new Set();
    const levels=definition.levels.map(level=>{
      if(!Number.isInteger(level.id)||!level.name||levelIds.has(level.id))throw new Error('Invalid or duplicated level in '+entry.id);
      levelIds.add(level.id);
      if(!(level.goalSeconds>0)||!(level.wallThickness>0)||!(level.speed>0))throw new Error('Invalid level timing or geometry in '+entry.id);
      return {...level,pal:createPalette(level.palette)};
    });
    return {...definition,levels};
  });
  const defaultPathId=seen.has(catalog.defaultPath)?catalog.defaultPath:paths[0].id;
  return {defaultPathId,paths};
}

export async function loadPathRegistry(){
  const base=new URL('./SubData/Paths/',import.meta.url);
  const catalogResponse=await fetch(new URL('catalog.json',base));
  if(!catalogResponse.ok)throw new Error('Paths catalog could not be loaded');
  const catalog=await catalogResponse.json();
  const documents=Object.fromEntries(await Promise.all(catalog.paths.map(async entry=>{
    const response=await fetch(new URL(entry.file,base));
    if(!response.ok)throw new Error('Path could not be loaded: '+entry.file);
    return [entry.file,await response.json()];
  })));
  return buildPathRegistry(catalog,documents);
}
