import fs from 'node:fs';
import {SIDE,TAU,TH,PART_DEPTH_SCALE,VOID,RP,PL,MUSIC_CUE_DIR,SOUND_CUE_DIR,MUSIC_CUES,SOUND_CUES} from './js/config.js';
import {Chart,PatternGenerator} from './js/PatternGenerator.js';
import {buildPathRegistry} from './js/Paths.js';

const pathCatalog=JSON.parse(fs.readFileSync('./js/SubData/Paths/catalog.json','utf8'));
const pathCatalogSchema=JSON.parse(fs.readFileSync('./js/SubData/Paths/catalog.schema.json','utf8'));
if(!pathCatalog.$schema||!pathCatalogSchema.properties?.$schema)throw new Error('Paths catalog and schema must declare compatible $schema metadata');
const pathDocuments=Object.fromEntries(pathCatalog.paths.map(entry=>[
  entry.file,JSON.parse(fs.readFileSync('./js/SubData/Paths/'+entry.file,'utf8'))
]));
const pathRegistry=buildPathRegistry(pathCatalog,pathDocuments);
const PATHS=pathRegistry.paths;
const LEVELS=PATHS.flatMap(path=>path.levels);
const joyPath=PATHS.find(path=>path.id==='path-of-joy');
const painPath=PATHS.find(path=>path.id==='path-of-pain');
if(!joyPath||joyPath.levels.length!==4)throw new Error('Path of Joy must contain the four initial levels');
if(!painPath||painPath.levels.length!==0)throw new Error('Path of Pain should be prepared but empty until new levels are authored');
if(joyPath.levels.some(level=>level.goalSeconds!==60))throw new Error('Every initial Path of Joy level must have a 60-second completion target');
if(joyPath.levels[0].wallThickness!==.075||joyPath.levels[1].wallThickness!==.08)throw new Error('The first two Path of Joy levels need their tuned wall thickness');
if(painPath.unlock?.type!=='complete-path'||painPath.unlock.pathId!=='path-of-joy'||painPath.unlock.minimumRunSeconds!==60)throw new Error('Path of Pain must unlock after every Path of Joy level is cleared for 60 seconds');

await PatternGenerator.loadCatalog();

// The catalog, each individual pattern JSON and Settings schema are the
// source of truth. Validate that every manifest entry resolves to a factory.
const patternCatalog=JSON.parse(fs.readFileSync('./js/SubData/PatternGenerator/catalog.json','utf8'));
const patternCatalogSchema=JSON.parse(fs.readFileSync('./js/SubData/PatternGenerator/pattern-catalog.schema.json','utf8'));
const patternDefinitionSchema=JSON.parse(fs.readFileSync('./js/SubData/PatternGenerator/pattern.schema.json','utf8'));
if(!patternCatalogSchema.properties?.$schema||!patternDefinitionSchema.properties?.$schema)throw new Error('Pattern JSON Schemas must allow their $schema metadata');
if(!patternCatalog.$schema)throw new Error('Pattern catalog must declare its JSON Schema');
if('normalWeights' in patternCatalog||'voidWeights' in patternCatalog)throw new Error('Pattern weights must live beside their pattern definitions');
for(const id of patternCatalog.patterns){
  const file=patternCatalog.definitionFiles[id];
  if(!file)throw new Error(`Pattern catalog has no file mapping for ${id}`);
  const definition=JSON.parse(fs.readFileSync(`./js/SubData/PatternGenerator/${file}`,'utf8'));
  if(definition.id!==id)throw new Error(`Pattern JSON id mismatch: ${id}`);
  if(!Number.isFinite(definition.weight)||!Number.isFinite(definition.voidWeight))throw new Error(`Pattern JSON is missing its selection weights: ${id}`);
  if(typeof PatternGenerator.PAT[id]!=='function')throw new Error(`Pattern JSON did not compile: ${id}`);
}
if(PatternGenerator.PAT.zig(0,1).length!==PatternGenerator.PAT.ladder(0,1).length)throw new Error('Zig alias must use the Ladder JSON definition');
if(PatternGenerator.PAT.pairs(0,1).length!==PatternGenerator.PAT.bat(0,1).length)throw new Error('Pairs alias must use the Bat JSON definition');
if(PatternGenerator.PAT.spin4(0,1).length!==12)throw new Error('Spin 4 JSON alias must repeat the 1-2-3 unit four times');

const settingsSchema=JSON.parse(fs.readFileSync('./js/SubData/Settings/settings.json','utf8'));
const settingsDefinitionSchema=JSON.parse(fs.readFileSync('./js/SubData/Settings/settings.schema.json','utf8'));
if(!settingsDefinitionSchema.properties?.$schema||!settingsSchema.$schema)throw new Error('Settings JSON must declare a schema that accepts its $schema metadata');
const settingIds=settingsSchema.groups.flatMap(group=>group.settings.map(setting=>setting.id));
for(const id of ['frameRate','modMenuEnabled','mapSpeed','playerSpeed','musicVolume','soundVolume']){
  if(!settingIds.includes(id))throw new Error(`Settings JSON is missing ${id}`);
}
const soundSetting=settingsSchema.groups.flatMap(group=>group.settings).find(setting=>setting.id==='soundVolume');
if(!soundSetting.disabled||soundSetting.status!=='WIP')throw new Error('Sound Volume must remain visibly marked as WIP');
if(settingIds.includes('vsync'))throw new Error('V-Sync must not be exposed as a Settings option');
const modSetting=settingsSchema.groups.flatMap(group=>group.settings).find(setting=>setting.id==='modMenuEnabled');
if(modSetting.label!=='Enable or Disable the Mods'||modSetting.description)throw new Error('Mods toggle copy must use the requested label without the old description');
if(settingsSchema.groups.some(group=>/\\.$/.test(group.description??'')||group.settings.some(setting=>/\\.$/.test(setting.description??''))))throw new Error('Settings copy must not end with full stops');

const settingsMarkup=fs.readFileSync('./js/SubData/Settings/settings.html','utf8');
const settingsStyles=fs.readFileSync('./js/SubData/Settings/settings.css','utf8');
const indexMarkup=fs.readFileSync('./index.html','utf8');
const settingsController=fs.readFileSync('./js/SettingsPanel.js','utf8');
const gameSource=fs.readFileSync('./js/Game.js','utf8');
const audioManagerSource=fs.readFileSync('./js/AudioManager.js','utf8');
const inputSource=fs.readFileSync('./js/Input.js','utf8');
if(!settingsMarkup.includes('role="dialog"')||!settingsMarkup.includes('data-settings-content'))throw new Error('Settings HTML dialog structure is incomplete');
if(settingsMarkup.includes('HEXBEAT / SYSTEM')||settingsMarkup.includes('Tune the experience. Keep the rhythm.'))throw new Error('Settings header must contain only the SETTINGS title');
if(!settingsStyles.includes('.hb-settings__dialog')||!settingsStyles.includes('@media'))throw new Error('Settings CSS is missing the dialog or responsive layout');
if(!settingsStyles.includes('.hb-settings button:focus-visible'))throw new Error('Settings controls need a visible keyboard focus style');
if(!settingsStyles.includes('steps(7,end)')||!settingsStyles.includes('background:transparent'))throw new Error('Settings opening animation must be raw 30 FPS steps with a transparent header');
if(!settingsController.includes('updateTheme()')||!settingsController.includes("setProperty('--hb-accent'"))throw new Error('Settings title accent must follow the active level palette');
if(!settingsMarkup.includes('tabindex="-1"'))throw new Error('The Settings scrim must not enter the keyboard tab order');
if(!settingsController.includes("event.key==='Tab'")||!settingsController.includes('this.previousFocus=document.activeElement')||!settingsController.includes('previousFocus.focus()'))throw new Error('Settings must trap and restore keyboard focus while modal');
if(!indexMarkup.includes('js/SubData/Settings/settings.css'))throw new Error('index.html does not load the Settings stylesheet');
if(!settingsController.includes("new URL('settings.json',base)")||!settingsController.includes("new URL('settings.html',base)"))throw new Error('Settings controller is not loading the HTML and JSON assets');
if(gameSource.includes("from './ModMenu.js'")||gameSource.includes('this.modMenu'))throw new Error('The old standalone Mod Menu is still wired into Game.js');

// Optional OGG assets and their semantic triggers are defined in SongData.
if(MUSIC_CUE_DIR!=='SongData/Music/'||SOUND_CUE_DIR!=='SongData/Sounds/')throw new Error('Audio cue directories changed unexpectedly');
if(MUSIC_CUES.join(',')!=='awesome,excellent,wonderful')throw new Error('Music cue manifest must contain the three voice announcements');
if(SOUND_CUES.join(',')!=='start,die,begin,gameover,menuchoose,menuselect,rankup')throw new Error('Sound cue manifest must include the rankup backing effect');
for(const path of ['./SongData/README.md','./SongData/Music/README.md','./SongData/Sounds/README.md','./js/SubData/Paths/README.md']){
  if(!fs.existsSync(path))throw new Error(`Missing audio asset instructions: ${path}`);
}
if(!fs.existsSync('./SongData/Sounds/rankup.ogg'))throw new Error('SongData/Sounds/rankup.ogg must be present for the synchronized callout bed');
for(const method of ['preloadCues()','playMusicCue(name)','playSound(name)','playTogether(entries)','playAnnouncement(name)','flushAnnouncements()','playSequence(entries)','cancelSequences()']){
  if(!audioManagerSource.includes(method))throw new Error(`AudioManager is missing ${method}`);
}
for(const cue of ['awesome','excellent','wonderful','rankup','start','die','begin','gameover','menuchoose','menuselect']){
  if(!audioManagerSource.includes(`'${cue}'`)&&!gameSource.includes(`'${cue}'`))throw new Error(`Audio cue ${cue} is not wired into the game`);
}
if(!gameSource.includes('elapsed>=30')||!gameSource.includes('elapsed>=60')||!gameSource.includes("playAnnouncement('wonderful')"))throw new Error('30s, 60s and new-best announcements are not wired correctly');
if(!gameSource.includes('progress.announcements')||!gameSource.includes("announced.includes('awesome')"))throw new Error('30s/60s announcements must persist as once-per-level callouts');
if(!audioManagerSource.includes("loadCue('sounds', 'rankup')")||!audioManagerSource.includes('backingGain.gain.value = .22')||!audioManagerSource.includes('backingSource.start(startAt)')||!audioManagerSource.includes('voiceSource.start(startAt)'))throw new Error('Sounds/rankup.ogg must be quieter than the voice and synchronized to the same start time');
if(!gameSource.includes('constructor(canvas,pathRegistry)')||!gameSource.includes('completedLevels')||!gameSource.includes('isLevelUnlocked'))throw new Error('Game progression must be driven by Paths and saved completion state');
if(!gameSource.includes('this.progress.completedLevels.push(key)'))throw new Error('Clearing a stage must persist its completion flag');
if(!gameSource.includes("level.chartMode==='authored'"))throw new Error('Path level charts should be beat-sensitive unless explicitly marked authored');
const rendererSource=fs.readFileSync('./js/Renderer.js','utf8');
if(!rendererSource.includes('drawPlayer(phi,this.p.w,turn)'))throw new Error('Player pointer colour must match the wall colour');
if(!rendererSource.includes('w.th??L.wallThickness??TH'))throw new Error('Renderer must use each Path level wall thickness');
if(!settingsController.includes('--hb-panel-top')||!settingsController.includes('--hb-panel-bottom')||!settingsStyles.includes('var(--hb-panel-top)'))throw new Error('Settings gradient must follow the current level palette');
const pathSource=fs.readFileSync('./js/Paths.js','utf8');
if(!pathSource.includes('loadPathRegistry()')||!pathSource.includes('buildPathRegistry'))throw new Error('Path JSON must be loaded through the dedicated Paths module');
const patternSource=fs.readFileSync('./js/PatternGenerator.js','utf8');
if(!patternSource.includes('const syncopation=')||!patternSource.includes('const density=')||!patternSource.includes('recentPatterns'))throw new Error('Pattern choice must use beat accents and recent-pattern variety');
const beatAnalyzerSource=fs.readFileSync('./js/BeatAnalyzer.js','utf8');
if(!beatAnalyzerSource.includes('subarray(startSample,endSample)')||!beatAnalyzerSource.includes('startSeconds+tempo.phase/fps'))throw new Error('Beat analysis must stay inside the played audio segment and retain its absolute offset');
const uiSource=fs.readFileSync('./js/UIRenderer.js','utf8');
if(!uiSource.includes('SELECT YOUR PATH')||!uiSource.includes('LOCKED')||!uiSource.includes('NEW LEVELS COMING SOON'))throw new Error('Path selector must show locked stages and the empty Path of Pain state');
if(!inputSource.includes("code==='PageUp'")||!inputSource.includes("code==='PageDown'"))throw new Error('Page Up / Page Down must navigate Paths');
const configSource=fs.readFileSync('./js/config.js','utf8');
if(configSource.includes('export const LEVELS'))throw new Error('Individual level data must live outside config.js');
if(!gameSource.includes("playSequence([['sounds', 'die'], ['sounds', 'gameover']])"))throw new Error('Death and Game Over voice must play sequentially');
if(!gameSource.includes("playTogether([['sounds', 'start'], ['sounds', 'begin']])"))throw new Error('Start and Begin must be scheduled together when a run starts');
if(!gameSource.includes("playSound('menuchoose')")||!gameSource.includes("playSound('menuselect')"))throw new Error('Menu confirmation and navigation sounds are not wired');
if(!inputSource.includes("code === 'KeyQ'")||!inputSource.includes("event.code === 'KeyE'"))throw new Error('Gameplay keyboard aliases must be released correctly');
if(settingsSchema.groups.find(group=>group.id==='audio').settings.find(setting=>setting.id==='soundVolume').description.includes('not implemented'))throw new Error('Sound Volume help text still claims that effects are not implemented');



// Chart retains each stage's data-driven base thickness.
const joyOneChart=new Chart([],0.5,0,120,60,1,joyPath.levels[0].wallThickness);
const joyTwoChart=new Chart([],0.5,0,120,60,1,joyPath.levels[1].wallThickness);
if(joyOneChart.wallThickness!==.075||joyTwoChart.wallThickness!==.08)throw new Error('Path wall thickness must survive chart construction');
const mask=gaps=>[0,1,2,3,4,5].map(sector=>!gaps.includes(sector));
for(const id of [100,105,110,115]){
  const json=JSON.parse(fs.readFileSync(`./MusicData/${id}.json`,'utf8'));
  const level=LEVELS.find(item=>item.id===id);
  const chart=Chart.fromJSON(json,level).randomized(level,0x123400+id);
  if(!chart.rows.length)throw new Error(`Chart ${id} is empty`);
  if(!chart.rows.every(row=>row.g.length&&row.w.length===6))throw new Error(`Chart ${id} contains invalid rows`);
}
const blocked=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
const open=new Chart([{t:10,g:[0],w:mask([0])}],.5,0,120,20,1);
if(!blocked.hit(10,SIDE/2)||open.hit(10,SIDE/2))throw new Error('Tip hitbox test failed');
const edgeContact=new Chart([{t:10,g:[0],w:mask([0])}],.5,0,120,20,1);
// At 59 degrees the tip remains inside open sector 0 while the arrow's flank
// grazes wall sector 1 just after the wall crosses the player's radial position.
if(edgeContact.collision(10.01,SIDE-Math.PI/180)?.type!=='side')throw new Error('Side scrape should be non-lethal contact');
if(edgeContact.hit(10.01,SIDE-Math.PI/180))throw new Error('Side scrape must not kill the player');

// Optional Part depth must be shared by the collision geometry.
const thinPart=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
const deepPart=new Chart([{t:10,g:[1],w:mask([1]),th:.4}],.5,0,120,20,1);
if(thinPart.hit(10.2,SIDE/2))throw new Error('Legacy TH should not reach the player yet');
if(!deepPart.hit(10.2,SIDE/2))throw new Error('Custom Part depth must extend the collision wall');
if(!deepPart.hit(10.35,SIDE/2))throw new Error('Thick Part must remain collidable until its outer edge clears the Pointer');
if(deepPart.collision(10.5,SIDE/2)!==null)throw new Error('A wall hidden behind the player hitbox must not create a phantom collision');
if(deepPart.collision(10.54,SIDE/2)!==null)throw new Error('A wall fully inside the hub must not create a phantom collision');

// Spin family: 2/3/4 variants repeat the same three-position 1-2-3 motif.
for(const [name,repetitions] of [['spin2',2],['spin3',3],['spin4',4]]){
  const events=PatternGenerator.PAT[name](0,1);
  if(events.length!==repetitions*3)throw new Error(`${name} repetition count mismatch`);
  for(let i=0;i<events.length;i++){
    const expected=[0,1,3][i%3];
    if(((events[i][1][0]%6)+6)%6!==expected)throw new Error(`${name} must repeat the 1-2-3 sector sequence`);
  }
}

// Ladder: one composite Part for two continuous opposing rails, then
// eight evenly spaced mirrored rung-pairs. Same-time rails must not be fed
// to reachability repair as two sequential rows.
for(let start=0;start<6;start++)for(const direction of [-1,1]){
  const ladder=PatternGenerator.PAT.ladder(start,direction);
  if(ladder.length!==9)throw new Error('Ladder must contain one composite rail row and eight rungs');
  const rails=ladder[0];
  const railOpenings=rails[1].map(value=>((value%6)+6)%6);
  const railWalls=[0,1,2,3,4,5].filter(sector=>!railOpenings.includes(sector));
  if(rails[0]!==0||railOpenings.length!==4||rails[2]!==6.22||rails[3]!==0)throw new Error('Ladder rail Part must be one continuous opposing pair');
  if(railWalls.length!==2||((railWalls[0]-railWalls[1]+6)%6)!==3)throw new Error('Ladder rails must occupy opposite sectors');
  if(ladder.slice(1).some((event,index)=>event[1].length!==4||event[2]!==.22||Math.abs(event[0]-(.75+index*.75))>1e-9))throw new Error('Ladder rungs must preserve the two rail sectors and use identical spacing and thickness');
  for(let i=1;i<ladder.length;i++){
    const openings=ladder[i][1].map(value=>((value%6)+6)%6);
    if(openings.length!==4||!railWalls.every(sector=>openings.includes(sector)))throw new Error('Each Ladder rung must leave both persistent rail sectors open in its own row');
    const combinedOpen=railOpenings.filter(sector=>openings.includes(sector) &&
      !railWalls.includes(sector));
    const rungOpen=railOpenings.length===4
      ?ladder[0][1].map(value=>((value%6)+6)%6).filter(sector=>openings.includes(sector)&&
        !railWalls.includes(sector))
      :[];
    const sharedOpen=ladder[0][1].map(value=>((value%6)+6)%6)
      .filter(sector=>openings.includes(sector)&&!railWalls.includes(sector));
    if(sharedOpen.length!==2||((sharedOpen[0]-sharedOpen[1]+6)%6)!==3)throw new Error('The overlapping rail and rung rows must retain two opposite playable openings');
  }
  const ladderRows=ladder.map(([beat,gaps,span,routeSpan])=>({
    t:beat*.5,g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
    w:mask(gaps),...(span>0?{th:span*.5*(routeSpan===0?1:PART_DEPTH_SCALE)}:{}),
    ...(routeSpan!=null?{routeDepth:routeSpan*.5}:{})
  }));
  if(ladderRows[0].routeDepth!==0)throw new Error('Persistent Ladder rails must not consume the rung-to-rung route-change window');
}
// A multi-beat Ladder is one atomic pattern. Random-section boundaries
// must not re-mirror its later Parts independently (RGB's section is only 4 beats).
const ladderEvents=PatternGenerator.PAT.ladder(0,1);
const ladderDuration=6.22*(60/140);
const ladderChart=new Chart(ladderEvents.map(([beat,gaps,span,routeSpan])=>({
  t:beat*(60/140),g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
  w:mask(gaps),motifId:'ladder-atomic-test',motifName:'ladder',
  motifStart:0,motifEnd:ladderDuration,
  ...(span>0?{th:1.3*span*(60/140)*(routeSpan===0?1:PART_DEPTH_SCALE)}:{}),
  ...(routeSpan!=null?{routeDepth:routeSpan*(60/140)}:{})
})),60/140,0,140,30,1.3);
const ladderRandomized=ladderChart.randomized({...LEVELS.find(level=>level.id===115),offset:0,randomSectionBeats:4},0xB1A1);
const transformedRows=ladderRandomized.rows;
const matchesSingleTransform=[...Array(6).keys()].some(offset=>
  [false,true].some(mirror=>ladderEvents.every(([beat,gaps],index)=>{
    const expected=gaps.map(value=>((mirror?-value:value)+offset+600)%6).sort((a,b)=>a-b);
    const actual=transformedRows[index].g.slice().sort((a,b)=>a-b);
    return expected.length===actual.length&&expected.every((value,i)=>value===actual[i]);
  }))
);
if(!matchesSingleTransform)throw new Error('Ladder Parts were not kept under one atomic mirror/rotation transform');
const transformedRailWalls=[0,1,2,3,4,5].filter(sector=>!transformedRows[0].g.includes(sector));
if(transformedRailWalls.length!==2||((transformedRailWalls[0]-transformedRailWalls[1]+6)%6)!==3)throw new Error('Atomic randomization must preserve two continuous opposing rails');
for(const row of transformedRows.slice(1)){
  if(!transformedRailWalls.every(sector=>row.g.includes(sector)))throw new Error('A Ladder rung row must leave both long rail sectors open so the rails remain continuous');
  const rungWalls=[0,1,2,3,4,5].filter(sector=>!row.g.includes(sector));
  if(rungWalls.length!==2)throw new Error('Each Ladder rung must draw exactly one mirrored wall pair');
  if(transformedRailWalls.some(sector=>rungWalls.includes(sector)))throw new Error('A rung must not interrupt either persistent rail');
}
const expectedRailDepth=1.3*(60/140)*6.22;
if(Math.abs(transformedRows[0].th-expectedRailDepth)>1e-8)throw new Error('Ladder rail wall must keep its complete multi-beat radial depth');

// Ladder keeps a four-motif safety corridor. Stair 1 may occur inside it,
// but a C/Spin or Solo single-opening pattern may not follow the Ladder yet.
const transitionProbe=new PatternGenerator({...LEVELS.find(level=>level.id===110),seed:0xA771});
transitionProbe.pool=()=>['ladder','solo','stair','solo2','dwhirl','solo3','alt3','stair1'];
const receivedPools=[];
let transitionPick=0;
const forcedTransitionNames=['ladder','solo3','stair1','alt3','solo3','solo'];
transitionProbe.choose=names=>{
  receivedPools.push([...names]);
  return forcedTransitionNames[Math.min(transitionPick++,forcedTransitionNames.length-1)];
};
const transitionRows=transitionProbe.generate(()=>1,60/140,0,35);
if(receivedPools.length<6)throw new Error('Pattern generator did not schedule four post-Ladder exit motifs');
const ladderExitPools=receivedPools.slice(1,5);
for(const pool of ladderExitPools){
  if(pool.some(name=>!PatternGenerator.POST_LADDER.includes(name)))throw new Error('Post-Ladder selector included a pattern outside the four-motif safe corridor');
  if(pool.includes('solo')||pool.includes('stair')||pool.includes('tripleC')||pool.includes('whirl')||pool.includes('multiC')||pool.includes('stair2')||pool.includes('t321')||pool.includes('spin2')||pool.includes('spin3')||pool.includes('spin4')||pool.includes('rain')||pool.includes('doubleC'))throw new Error('A single-opening C/Spin pattern may not occur in the four-motif Ladder exit corridor');
}
if(ladderExitPools[3].some(name=>!PatternGenerator.POST_LADDER_FINAL.includes(name)))throw new Error('The final Ladder exit motif must have three openings, so Stair 1 is never followed directly by a C');
if(!receivedPools[5].includes('solo')||!receivedPools[5].includes('stair'))throw new Error('Normal pattern pool should resume after the four-motif Ladder exit corridor');
const ladderStart=transitionRows.find(row=>row.motifName==='ladder')?.motifStart;
const ladderEnd=transitionRows.find(row=>row.motifName==='ladder')?.motifEnd;
const exitMotifs=transitionRows.filter(row=>['solo3','alt3','stair1'].includes(row.motifName));
const normalSolo=transitionRows.find(row=>row.motifName==='solo');
const exitEnd=Math.max(...exitMotifs.map(row=>row.motifEnd));
if(!(Number.isFinite(ladderStart)&&Number.isFinite(ladderEnd)&&exitMotifs.length&&normalSolo?.motifStart>=exitEnd))throw new Error('Four-motif Ladder exit overlaps or returns to the normal pool too early');

// Solo is two same-lane C Parts, so the corridor stays aligned through both hits.
const soloEvents=PatternGenerator.PAT.solo(2);
if(soloEvents.length!==2||soloEvents[0][1][0]!==soloEvents[1][1][0]||soloEvents[0][0]!==0||soloEvents[1][0]!==1)throw new Error('Solo must repeat the same single-hole Part twice');
if(soloEvents.some(event=>Math.abs(event[2]*PART_DEPTH_SCALE-.198)>1e-9))throw new Error('Solo Part wall depth must use the reduced thickness scale');

// Bat uses the same two-pattern multi-opening exit rule as Ladder:
// do not follow its opposite-lane sequence immediately with a single C/Spin.
const batProbe=new PatternGenerator({...LEVELS.find(level=>level.id===105),seed:0xBA71});
batProbe.pool=()=>['bat','solo','stair','solo2','dwhirl','spin4','solo3','alt3'];
const batPools=[];
let batPick=0;
const forcedBatNames=['bat','solo3','alt3','spin4'];
batProbe.choose=names=>{
  batPools.push([...names]);
  return forcedBatNames[Math.min(batPick++,forcedBatNames.length-1)];
};
const batRows=batProbe.generate(()=>1,60/129,0,45);
if(batPools.length<4)throw new Error('Pattern generator did not schedule two post-Bat exit patterns');
for(const pool of batPools.slice(1,3)){
  if(pool.some(name=>!PatternGenerator.POST_BAT.includes(name)))throw new Error('Post-Bat selector included a pattern outside the safe multi-opening preset');
  if(pool.includes('solo')||pool.includes('stair')||pool.includes('whirl')||pool.includes('spin4'))throw new Error('A single-opening C/Spin pattern may not occur in the two-pattern Bat exit preset');
}
if(!batPools[3].includes('spin4')||!batPools[3].includes('solo'))throw new Error('Normal pool should resume after the two-pattern Bat exit preset');
const batEnd=batRows.find(row=>row.motifName==='bat')?.motifEnd;
const batExit=batRows.find(row=>row.motifName==='solo3')?.motifStart;
if(!(Number.isFinite(batEnd)&&batExit>=batEnd))throw new Error('Post-Bat exit overlaps the Bat phrase');

// Motif grouping metadata must survive export/import so later randomization
// cannot split a phrase at a section boundary.
const roundTrip=Chart.fromJSON(ladderChart.toJSON(),LEVELS.find(level=>level.id===115));
if(roundTrip.rows.some(row=>row.motifId!=='ladder-atomic-test'||row.motifName!=='ladder'))throw new Error('Atomic pattern metadata did not survive chart serialization');

// Time-expanded reachability audit. Treat every wall as active for the exact
// interval during which its radial span crosses the pointer radius. The pointer
// can rotate at the game's real maximum turn rate; an 8.5-degree body clearance
// is reserved beside every blocked sector. This catches patterns that have
// individually valid rows but no continuous path through their combined walls.
function hasPlayablePath(rows,speed,turnRate=8.5,dt=1/60){
  const bins=720,margin=8.5*Math.PI/180,offset=PL.tip-RP;
  const depth=row=>row.th??TH;
  const start=Math.min(...rows.map(row=>row.t-offset/speed))-dt;
  const end=Math.max(...rows.map(row=>row.t+(depth(row)-offset)/speed))+dt;
  const steps=Math.floor(turnRate*dt*bins/TAU+1e-9);
  const sectors=new Uint8Array(bins),local=new Float64Array(bins);
  for(let i=0;i<bins;i++){
    const angle=i*TAU/bins;
    sectors[i]=Math.floor(angle/SIDE);
    local[i]=angle-sectors[i]*SIDE;
  }
  let reachable=new Uint8Array(bins).fill(1);
  const expanded=new Uint8Array(bins),next=new Uint8Array(bins);
  const prefix=new Int32Array(bins+1);
  for(let time=start;time<=end+dt*.25;time+=dt){
    const blocked=new Uint8Array(6);
    for(const row of rows){
      const d=depth(row);
      const enters=row.t-offset/speed,leaves=row.t+(d-offset)/speed;
      if(time<enters-1e-9||time>leaves+1e-9)continue;
      for(let sector=0;sector<6;sector++)if(!row.g.includes(sector))blocked[sector]=1;
    }
    prefix[0]=0;
    for(let i=0;i<bins;i++)prefix[i+1]=prefix[i]+reachable[i];
    let any=false;
    for(let i=0;i<bins;i++){
      const lo=i-steps,hi=i+steps;
      let count;
      if(lo<0)count=prefix[hi+1]+prefix[bins]-prefix[bins+lo];
      else if(hi>=bins)count=prefix[bins]-prefix[lo]+prefix[hi-bins+1];
      else count=prefix[hi+1]-prefix[lo];
      const sector=sectors[i],left=blocked[(sector+5)%6],right=blocked[(sector+1)%6];
      const safe=!blocked[sector]&&!(left&&local[i]<margin)&&!(right&&SIDE-local[i]<margin);
      next[i]=safe&&count>0?1:0;
      if(next[i])any=true;
    }
    if(!any){
      const closed=Array.from(blocked).map((value,index)=>value?index:null).filter(value=>value!==null);
      return {ok:false,time,closed};
    }
    reachable.set(next);
  }
  return {ok:true};
}

// The full Ladder + two-motif exit + first normal C transition must remain
// continuously traversable as a single time-expanded sequence.
const ladderExitAudit=hasPlayablePath(transitionRows,LEVELS.find(level=>level.id===110).speed);
if(!ladderExitAudit.ok)throw new Error(`Ladder exit preset is unplayable at t=${ladderExitAudit.time.toFixed(3)}s`);

// Review every pattern in every stage, in both movement directions, after the
// same deterministic orientation/randomization and reachability repair used in runs.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  for(const name of Object.keys(PatternGenerator.PAT)){
    for(const direction of [-1,1]){
      const events=PatternGenerator.PAT[name](0,direction,()=>.37);
      const rows=events.map(([beat,gaps,span=0])=>({
        t:beat*(60/level.bpm),
        g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
        w:mask(gaps),
        ...(span>0?{th:Math.max(TH,level.speed*level.beatDur*span)}:{})
      }));
      const chart=new Chart(rows,60/level.bpm,0,level.bpm,60,level.speed)
        .randomized({...level,offset:0},0x51A7+id+direction);
      const result=hasPlayablePath(chart.rows,level.speed);
      if(!result.ok)throw new Error(
        `Unplayable pattern ${name} in stage ${id}, direction ${direction}, t=${result.time.toFixed(3)}, blocked=${result.closed.join(',')}`
      );
    }
  }
}

// Audit actual Void sequences too, including pattern-to-pattern transitions.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  for(const seed of [0xA11CE,0xBADC0DE]){
    const generator=new PatternGenerator({...level,seed});
    const rows=generator.generateVoid(0,32,60/level.bpm,0,0,null);
    const result=hasPlayablePath(rows,level.speed,8.5,.05);
    if(!result.ok)throw new Error(
      `Unplayable generated Void sequence in stage ${id}, seed ${seed}, t=${result.time.toFixed(3)}, blocked=${result.closed.join(',')}`
    );
  }
}

// Blu/RGB must continue generating through zero-intensity music bars.
for(const id of [110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const beatDur=60/(level.bpm??120);
  const continuous=new PatternGenerator({...level,seed:1200+id}).generate(()=>0,beatDur,0,100);
  if(continuous.length<20)throw new Error(`Stage ${id} leaves silent pattern gaps on quiet audio`);
  const maxGapBeats=Math.max(...continuous.slice(1).map((row,index)=>(row.t-continuous[index].t)/beatDur));
  // A Triple C needs 2.5 beats for its three-sector jump. Reject skipped bars,
  // not legitimate internal movement intervals of a pattern.
  if(maxGapBeats>3.1)throw new Error(`Stage ${id} generator leaves a ${maxGapBeats.toFixed(2)}-beat interruption on quiet audio`);
}

// The Void chooser alternates multi-lane motifs with other families, so it
// cannot degenerate into an indefinitely repeated single-opening C sequence.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const generator=new PatternGenerator({...level,seed:0xD00D+id});
  let seed=0xA55A+id;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const choices=Array.from({length:18},()=>generator.chooseVoid(random));
  const multi=name=>['solo2','solo3','alt3','bat','dwhirl','stair1','rain','doubleC'].includes(name);
  let previousPattern=null,previousMulti=null,ladderExitRemaining=0,batExitRemaining=0;
  for(let choiceIndex=0;choiceIndex<choices.length;choiceIndex++){
    const name=choices[choiceIndex];
    const enteringLadder=previousPattern==='ladder'||previousPattern==='zig';
    const enteringBat=previousPattern==='bat'||previousPattern==='pairs';
    const inLadderExit=enteringLadder||ladderExitRemaining>0;
    const inBatExit=enteringBat||batExitRemaining>0;
    if(inLadderExit){
      if(!PatternGenerator.POST_LADDER.includes(name))throw new Error(`Void post-Ladder preset failed in stage ${id}`);
      if(ladderExitRemaining===1&&!PatternGenerator.POST_LADDER_FINAL.includes(name))throw new Error(`Void final post-Ladder motif must have three openings in stage ${id}`);
      if(enteringLadder)ladderExitRemaining=3;
      else ladderExitRemaining=Math.max(0,ladderExitRemaining-1);
    }else if(inBatExit){
      if(!PatternGenerator.POST_BAT.includes(name))throw new Error(`Void post-Bat preset failed in stage ${id}`);
    }else if(previousMulti!==null&&multi(name)===previousMulti){
      throw new Error(`Void pattern variety failed in stage ${id}: ${choices.slice(0,choiceIndex+1).join(' -> ')} (previousMulti=${previousMulti}, currentMulti=${multi(name)}, ladderExit=${ladderExitRemaining}, batExit=${batExitRemaining})`);
    }

    // Both exit states can overlap (for example, Bat may be the first of
    // Ladder's two exit motifs). Update their counters independently.
    if(enteringBat)batExitRemaining=1;
    else if(batExitRemaining>0)batExitRemaining--;
    if(name==='bat'||name==='pairs')batExitRemaining=2;
    if(name==='ladder'||name==='zig')ladderExitRemaining=4;
    previousPattern=name;
    previousMulti=multi(name);
  }
  if(new Set(choices).size<6)throw new Error(`Void pool lacks diversity in stage ${id}`);
}

const g=new PatternGenerator({...LEVELS[3],seed:90210,speed:1.7,turnRate:7.4});
const voidRows=[];
let chunkStart=60.1,previousVoidRow=null;
for(let chunk=0;chunk<3;chunk++){
  const chunkRows=g.generateVoid(chunkStart,8,60/116,0,60.1,previousVoidRow);
  if(!chunkRows.length)throw new Error('Void generation returned an empty chunk');
  if(previousVoidRow){
    const previousClear=previousVoidRow.t+(previousVoidRow.th??TH)/1.7;
    const seamGap=chunkRows[0].t-previousClear;
    if(seamGap<-.01||seamGap>.55*(60/116))throw new Error(`Void chunk seam contains an interruption (${seamGap.toFixed(3)}s)`);
  }
  voidRows.push(...chunkRows);
  previousVoidRow=chunkRows[chunkRows.length-1];
  chunkStart=g.voidNext;
}
const expectedEnd=60.1+24*4*(60/116);
if(voidRows.length<30||!voidRows.every((row,index)=>index===0||row.t>=voidRows[index-1].t)||g.voidNext<expectedEnd)throw new Error(`Void generation coverage failed: rows=${voidRows.length}, last=${voidRows.at(-1)?.t?.toFixed(2)}, next=${g.voidNext.toFixed(2)}, expectedEnd=${expectedEnd.toFixed(2)}`);
if(voidRows[0].g.length<2)throw new Error('Hypermode must not start with a single-opening C Part');

// Endless run: authored rows are cut at the void start, generation continues for minutes, stays sorted,
// stays bounded in memory and every row (chunk seams included) is reachable from the previous one.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const json=JSON.parse(fs.readFileSync(`./MusicData/${id}.json`,'utf8'));
  const run=Chart.fromJSON(json,level).randomized(level,4242+id).endless(level,4242+id,level.offset+VOID.start);
  if(!(run.voidStart>=level.offset+VOID.start&&run.voidStart<level.offset+VOID.start+run.beatDur+1e-6))throw new Error(`Void start of ${id} is not snapped to the beat after ${VOID.start}s`);
  if(run.voidSide!==1&&run.voidSide!==-1)throw new Error('Void side must be -1 or 1');
  if(run.dur!==Infinity)throw new Error('Endless chart must never finish');
  const all=[];let kept=0;
  for(let t=level.offset;t<level.offset+600;t+=.5){ // 10 minutes of play, one frame every half second
    run.ensure(t);
    if(run.rows.length>1200)throw new Error(`Chart ${id} grows without bound`);
    for(const row of run.rows)if(!all.some(r=>r.t===row.t))all.push(row);
  }
  all.sort((a,b)=>a.t-b.t);
  const speed=level.speed||1,stepTime=SIDE/(level.turnRate??6.4),reaction=level.reactionMargin??.04;
  const dist=(a,b)=>{const m=((a-b)%6+6)%6;return Math.min(m,6-m)};
  all.forEach((row,i)=>{
    if(row.t<run.voidStart)kept++;
    if(!row.g.length||row.w.length!==6)throw new Error(`Chart ${id}: invalid void row at ${row.t}`);
    if(i===0)return;
    const prev=all[i-1];
    const previousDepth=prev.routeDepth??prev.th??TH;
    const steps=Math.min(3,Math.max(0,Math.floor(Math.max(0,row.t-prev.t-previousDepth/speed-reaction)/stepTime)));
    const from=prev.route!=null&&prev.g.includes(prev.route)?prev.route:prev.g[0];
    const distance=Math.min(...row.g.map(candidate=>dist(from,candidate)));
    if(prev.routeReachable===false||distance>steps)throw new Error(
      `Chart ${id}: row at ${row.t.toFixed(2)}s is unreachable; prev=${JSON.stringify({t:prev.t,g:prev.g,route:prev.route,routeReachable:prev.routeReachable,routeDepth:prev.routeDepth,th:prev.th,motif:prev.motifName,motifId:prev.motifId})}; row=${JSON.stringify({t:row.t,g:row.g,route:row.route,routeDepth:row.routeDepth,th:row.th,motif:row.motifName,motifId:row.motifId})}; dt=${(row.t-prev.t).toFixed(3)}; steps=${steps}; distance=${distance}`
    );
  });
  if(!kept)throw new Error(`Chart ${id}: authored rows before the void are gone`);
  if(all.every(r=>r.t<run.voidStart+60))throw new Error(`Chart ${id}: void generated nothing`);
  // ModMenu map speed only changes how fast a wall travels, never when it reaches the arrow: the hit timing stays on the beat.
  const probe=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
  if(!probe.hit(10,SIDE/2,1)||!probe.hit(10,SIDE/2,2.5))throw new Error('Map speed must not change the wall-at-tip timing');
}
console.log('HEXBEAT VOID smoke test: OK');
