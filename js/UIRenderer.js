// Canvas UI for HEXBEAT: title, stage select, results and the explicitly-WIP leaderboard.
const timeLabel=value=>{
  if(!Number.isFinite(value)||value<0)return '--:--';
  const minutes=Math.floor(value/60);
  const seconds=Math.floor(value%60).toString().padStart(2,'0');
  return minutes+':'+seconds;
};
export class UIRenderer{
  constructor(renderer){this.r=renderer;}
  get c(){return this.r.c;} get W(){return this.r.W;} get H(){return this.r.H;} get U(){return this.r.U;}
  text(s,x,y,size,color,align='center'){this.r.text(String(s),x,y,size,color,align);}
  polygon(points,fill,stroke=null,width=1){
    const c=this.c;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  panel(x,y,w,h,color,fill='rgba(0,0,0,.78)',cut=18){
    this.polygon([[x+cut,y],[x+w-cut,y],[x+w,y+h],[x+cut*.65,y+h],[x,y]],fill,color,Math.max(2,this.U*.006));
  }
  ring(x,y,r,angle,color,width){
    const c=this.c;c.save();c.translate(x,y);c.rotate(angle);c.beginPath();
    for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,px=Math.cos(a)*r,py=Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}
    c.closePath();c.strokeStyle=color;c.lineWidth=width;c.stroke();
    c.beginPath();c.arc(0,0,r*.73,0,Math.PI*2);c.strokeStyle=color;c.globalAlpha=.28;c.lineWidth=Math.max(1,width*.45);c.stroke();c.globalAlpha=1;
    for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;c.beginPath();c.arc(Math.cos(a)*r,Math.sin(a)*r,width*1.1,0,Math.PI*2);c.fillStyle=color;c.fill();}
    c.restore();
  }
  chevron(x,y,size,direction,color){
    this.polygon(direction<0
      ?[[x+size*.38,y-size],[x-size*.38,y],[x+size*.38,y+size],[x+size*.08,y+size],[x-size*.72,y],[x+size*.08,y-size]]
      :[[x-size*.38,y-size],[x+size*.38,y],[x-size*.38,y+size],[x-size*.08,y+size],[x+size*.72,y],[x-size*.08,y-size]],color);
  }
  header(p,left='TAB — HIGH SCORES',right='ESC — STAGE SELECT'){
    const W=this.W,h=Math.max(28,this.H*.06),sideWidth=Math.min(W*.43,this.U*1.55),inset=Math.max(W*.02,this.U*.08);
    this.panel(0,0,sideWidth,h,p.b1,'rgba(0,0,0,.78)',h*.18);
    this.mirroredPanel(W-sideWidth,0,sideWidth,h,p.b1,'rgba(0,0,0,.78)',h*.18);
    const size=Math.min(this.U*.095,W*.027);
    this.text(left,inset,h*.49,size,p.p,'left');
    this.text(right,W-inset,h*.49,size,p.p,'right');
  }
  title(g,p){
    const c=this.c,W=this.W,H=this.H,U=this.U;
    // Neutral, geometric title backdrop matching the supplied menu reference.
    c.save();
    c.fillStyle='#252525';
    c.fillRect(0,0,W,H);
    this.polygon([[0,0],[W*.30,0],[W*.46,H],[0,H]],'#292929');
    this.polygon([[W*.30,0],[W*.72,0],[W*.58,H],[W*.46,H]],'#242424');
    this.polygon([[W*.72,0],[W,H*.22],[W,H],[W*.58,H]],'#2b2b2b');
    c.restore();

    const neutral={b1:'#858585',b2:'#b0b0b0',w:'#999999',p:'#f5f5f5'};
    // Only the right-hand quit plaque belongs on the title screen.
    this.mirroredPanel(W*.78,0,W*.22,H*.06,neutral.b1,'#555555',H*.018);
    this.text('ESC — QUIT',W*.985,H*.03,Math.min(U*.075,W*.023),neutral.p,'right');

    this.text('SUPER',W*.5,H*.30,U*.31,neutral.p);
    this.text('HEXAGON',W*.5,H*.445,U*.215,neutral.p);

    const buttonY=H*.62,buttonH=H*.085,buttonW=W*.31,buttonX=(W-buttonW)/2;
    // Large side controls are visual level arrows; level browsing begins after Space.
    const arrowW=W*.16,arrowH=H*.14,arrowY=H*.59,arrowCut=U*.07;
    this.panel(W*.08,arrowY,arrowW,arrowH,'#858585','#555555',arrowCut);
    this.mirroredPanel(W*.76,arrowY,arrowW,arrowH,'#858585','#555555',arrowCut);
    this.chevron(W*.16,arrowY+arrowH*.5,U*.082,-1,'#050505');
    this.chevron(W*.84,arrowY+arrowH*.5,U*.082,1,'#050505');
    this.panel(buttonX,buttonY,buttonW,buttonH,'#999999','#555555',H*.025);
    this.text('START GAME',W*.5,buttonY+buttonH*.5,U*.071,'#d8d8d8');
    this.text('PRESS SPACE TO SELECT',W*.5,H*.835,U*.050,neutral.p);
    if(g.msg)this.text(g.msg,W*.5,H*.965,U*.022,neutral.p);
  }
  selection(g,p){
    const W=this.W,H=this.H,U=this.U,now=performance.now()/1000;
    const L=g.levels[g.lv]??null;
    this.header(p,'TAB — HIGH SCORES','ESC — MAIN MENU');
    this.ring(W*.73,H*.49,U*.79,now*.32,p.b1,Math.max(2,U*.013));
    this.ring(W*.73,H*.49,U*.62,-now*.21,p.w,Math.max(1,U*.005));
    this.text('CURRENT PATH: '+(g.activePath?.title??'PATH OF JOY'),W*.07,H*.125,U*.043,p.w,'left');
    this.text('STAGE SELECT',W*.07,H*.2,U*.095,p.p,'left');

    if(!L){
      this.text('NEW LEVELS COMING SOON',W*.075,H*.42,U*.052,'#858b98','left');
      this.text('PATH OF PAIN',W*.075,H*.49,U*.038,'#858b98','left');
      this.text('ESC — BACK',W*.07,H*.94,U*.03,p.w,'left');
      this.text('SETTINGS  ·  M / S',W*.94,H*.94,U*.027,p.w,'right');
      if(g.msg)this.text(g.msg,W*.5,H*.975,U*.022,'#858b98');
      return;
    }

    const unlocked=g.isLevelUnlocked(g.lv,g.activePath);
    const levelColor=unlocked?p.p:'#858b98';
    const detailColor=unlocked?p.w:'#858b98';
    this.text('LEVEL '+String(g.lv+1).padStart(2,'0'),W*.07,H*.37,U*.145,levelColor,'left');
    this.text(unlocked?L.name:'LOCKED',W*.075,H*.46,U*.048,detailColor,'left');
    this.panel(W*.07,H*.56,W*.38,H*.105,unlocked?p.b1:'#747b88','rgba(0,0,0,.78)',H*.02);
    this.text(unlocked?'START STAGE':'LOCKED',W*.26,H*.612,U*.061,detailColor);
    this.chevron(W*.065,H*.615,U*.065,-1,p.w);
    this.chevron(W*.47,H*.615,U*.065,1,p.w);
    const key=g.recordKey(L,g.activePath);
    this.text('BEST  '+timeLabel(unlocked?g.best[key]:null),W*.26,H*.735,U*.043,detailColor);
    this.text(unlocked?'PRESS SPACE TO PLAY':'COMPLETE THE PREVIOUS LEVEL',W*.26,H*.84,U*.04,detailColor);
    this.text('A / D  ·  ← / →  CHANGE LEVEL',W*.26,H*.885,U*.028,p.w);
    this.text('ESC — BACK',W*.07,H*.94,U*.03,p.w,'left');
    this.text('SETTINGS  ·  M / S',W*.94,H*.94,U*.027,p.w,'right');
    if(g.msg)this.text(g.msg,W*.5,H*.975,U*.022,'#858b98');
  }
  results(g,p,complete){
    const W=this.W,H=this.H,U=this.U,L=g.level,goal=Math.round(L.goalSeconds??60);
    const key=g.recordKey(L,g.activePath);
    const last=g.lastScores?.[key]??Math.max(0,(g.tF||0)-L.offset);
    const best=g.best[key];
    const panelFill='rgba(0,0,0,.91)';
    this.header(p,'TAB — HIGH SCORES','ESC — STAGE SELECT');

    // Main stage banner.
    const leftY=H*.326,leftH=H*.30,leftW=W*.53;
    this.panel(0,leftY,leftW,H*.30,p.b1,panelFill,H*.045);
    this.text('LEVEL '+String(L.number??g.lv+1),W*.018,H*.407,U*.172,p.p,'left');
    this.text(L.name,W*.075,H*.475,U*.082,p.p,'left');
    this.text('NEXT LEVEL AT',W*.18,H*.545,U*.080,p.p);
    this.text(goal+' SECONDS',W*.18,H*.595,U*.080,p.p);

    // Level emblem and the small player marker.
    const triX=W*.405,triY=H*.418,triR=U*.052;
    this.polygon([
      [triX,triY-triR],
      [triX+triR*.94,triY+triR*.72],
      [triX-triR*.94,triY+triR*.72]
    ],null,p.b1,Math.max(3,U*.006));
    const playerX=W*.772,playerY=H*.445,playerR=U*.023;
    this.polygon([
      [playerX,playerY-playerR],
      [playerX+playerR*.76,playerY+playerR*.62],
      [playerX-playerR*.76,playerY+playerR*.62]
    ],p.b1);

    // Matched right-hand strips. Both use the mirrored cut geometry.
    const rightX=W*.54,rightW=W-rightX,stripH=H*.105;
    this.mirroredPanel(rightX,H*.326,rightW,stripH,p.b1,panelFill,H*.026);
    this.mirroredPanel(rightX,H*.515,rightW,stripH,p.b1,panelFill,H*.026);
    this.text('LAST',rightX+W*.026,H*.385,U*.090,p.p,'left');
    this.text(Number.isFinite(last)?last.toFixed(2):'--.--',W*.966,H*.385,U*.175,'#dedede','right');
    this.text('BEST',rightX+W*.026,H*.574,U*.090,p.p,'left');
    this.text(Number.isFinite(best)?best.toFixed(2):'--.--',W*.966,H*.574,U*.175,'#dedede','right');

    const by=H*.928,bw=Math.min(W*.53,U*2.95),bh=H*.075,bx=(W-bw)/2;
    this.panel(bx,by,bw,bh,p.b1,panelFill,H*.025);
    this.text(complete?'PRESS SPACE TO CONTINUE':'PRESS SPACE TO RETRY',W*.5,by+bh*.53,U*.090,p.p);
    if(g.msg)this.text(g.msg,W*.5,H*.985,U*.022,p.w);
  }
  leaderboard(g,p){
    const c=this.c,W=this.W,H=this.H,U=this.U,now=performance.now()/1000;
    c.save();c.fillStyle='rgba(0,0,0,.9)';c.fillRect(0,0,W,H);
    this.ring(W*.5,H*.46,U*.78,now*.2,p.b1,Math.max(2,U*.01));
    this.text('HIGH SCORES',W*.5,H*.18,U*.16,p.p);
    this.panel(W*.35,H*.25,W*.3,H*.065,p.b1,'rgba(0,0,0,.92)',H*.012);
    this.text('WORK IN PROGRESS',W*.5,H*.282,U*.045,p.w);
    this.text('GLOBAL LEADERBOARD',W*.25,H*.40,U*.055,p.p);
    this.text('FRIENDS LEADERBOARD',W*.75,H*.40,U*.055,p.p);
    this.text('ONLINE SCORES — NOT CONNECTED',W*.25,H*.47,U*.031,p.w);
    this.text('FRIEND LIST — NOT CONNECTED',W*.75,H*.47,U*.031,p.w);
    this.text('PERSONAL RECORDS',W*.5,H*.59,U*.058,p.p);
    const entries=g.allLevels.map(level=>{
      const path=g.paths.find(item=>item.levels.some(entry=>entry.id===level.id));
      return {name:level.name,best:g.best[g.recordKey(level,path)],path:path?.title??''};
    }).filter(row=>Number.isFinite(row.best)).sort((a,b)=>a.best-b.best);
    if(!entries.length)this.text('NO RECORDS YET',W*.5,H*.69,U*.043,p.w);
    else entries.slice(0,5).forEach((row,i)=>{const y=H*(.68+i*.055);this.text(row.path+' · '+row.name,W*.31,y,U*.031,p.w,'left');this.text(timeLabel(row.best),W*.69,y,U*.038,p.p,'right');});
    this.text('TAB / ESC — CLOSE',W*.5,H*.94,U*.036,p.w);
    c.restore();
  }
  loading(g,p){
    const W=this.W,H=this.H,U=this.U;this.header(p);
    this.ring(W*.5,H*.45,U*.28,performance.now()/1000*.8,p.b1,Math.max(2,U*.012));
    this.text('ANALYSING AUDIO',W*.5,H*.76,U*.065,p.p);this.text('PLEASE WAIT',W*.5,H*.83,U*.035,p.w);
  }
}
