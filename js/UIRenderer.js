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
    const h=Math.max(28,this.H*.06);
    this.panel(0,0,this.W*.39,h,p.b1,'rgba(0,0,0,.78)',h*.18);
    this.panel(this.W*.61,0,this.W*.39,h,p.b1,'rgba(0,0,0,.78)',h*.18);
    this.text(left,this.W*.02,h*.49,Math.min(this.U*.075,this.W*.023),p.p,'left');
    this.text(right,this.W*.98,h*.49,Math.min(this.U*.075,this.W*.023),p.p,'right');
  }
  title(g,p){
    const c=this.c,W=this.W,H=this.H,U=this.U,now=performance.now()/1000,L=g.level;
    this.header(p,'TAB — HIGH SCORES','ESC — QUIT');
    this.ring(W*.5,H*.43,U*.76,now*.22,p.b1,Math.max(2,U*.012));
    this.ring(W*.5,H*.43,U*.59,-now*.31,p.w,Math.max(1,U*.004));
    c.save();c.globalAlpha=.14;
    this.polygon([[0,H*.18],[W*.28,H*.18],[W*.5,H*.5],[W*.19,H*.83],[0,H*.83]],p.b1);
    this.polygon([[W,H*.18],[W*.72,H*.18],[W*.5,H*.5],[W*.81,H*.83],[W,H*.83]],p.b1);
    c.restore();
    this.text('HEXBEAT',W*.5,H*.235,U*.31,p.p);
    this.text('RHYTHM SURVIVAL',W*.5,H*.315,U*.052,p.w);
    this.text('CURRENT PATH: '+(g.activePath?.title??'PATH OF JOY'),W*.5,H*.385,U*.032,p.w);
    this.text('LEVEL '+String(g.lv+1).padStart(2,'0')+'   /   '+L.name,W*.5,H*.49,U*.047,p.p);
    const bw=Math.min(W*.34,U*1.55),bh=H*.105,bx=(W-bw)/2,by=H*.61;
    this.panel(bx,by,bw,bh,p.b1,'rgba(0,0,0,.76)',bh*.22);
    this.text('START GAME',W*.5,by+bh*.5,U*.075,p.p);
    this.chevron(W*.15,by+bh*.5,U*.095,-1,p.p);this.chevron(W*.85,by+bh*.5,U*.095,1,p.p);
    this.text('PRESS SPACE TO SELECT',W*.5,H*.79,U*.047,p.w);
    this.text('← / →  CHANGE SHOWCASE',W*.5,H*.86,U*.031,p.w);
    this.text('SETTINGS  ·  M / S',W*.5,H*.93,U*.027,p.w);
    if(g.msg)this.text(g.msg,W*.5,H*.975,U*.022,p.w);
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
    const W=this.W,H=this.H,U=this.U,now=performance.now()/1000,L=g.level,cx=W*.55,cy=H*.51;
    this.ring(cx,cy,U*1.05,now*.28,p.b1,Math.max(2,U*.013));
    this.ring(cx,cy,U*.82,-now*.19,p.w,Math.max(1,U*.004));
    this.header(p,'TAB — HIGH SCORES','ESC — STAGE SELECT');
    this.text('LEVEL '+String(g.lv+1).padStart(2,'0'),W*.055,H*.36,U*.142,p.p,'left');
    this.text(L.name,W*.065,H*.445,U*.05,p.w,'left');
    this.ring(W*.418,H*.385,U*.12,-now*.72,p.b1,Math.max(2,U*.018));
    this.text(complete?'STAGE COMPLETED':'GAME OVER',W*.065,H*.575,U*.063,p.p,'left');
    const key=g.recordKey(L,g.activePath);
    const last=g.lastScores?.[key]??Math.max(0,(g.tF||0)-L.offset),best=g.best[key],x=W*.58,w=W*.36,h=H*.115;
    this.panel(x,H*.34,w,h,p.b1,'rgba(0,0,0,.84)',h*.15);this.panel(x,H*.49,w,h,p.b1,'rgba(0,0,0,.84)',h*.15);
    this.text('LAST',x+w*.06,H*.397,U*.061,p.p,'left');this.text(timeLabel(last),x+w*.94,H*.397,U*.095,'#e4e4e4','right');
    this.text('BEST',x+w*.06,H*.547,U*.061,p.p,'left');this.text(timeLabel(best),x+w*.94,H*.547,U*.095,'#e4e4e4','right');
    const by=H*.86,bw=Math.min(W*.48,U*2.05),bx=(W-bw)/2;
    this.panel(bx,by,bw,H*.10,p.b1,'rgba(0,0,0,.86)',H*.025);
    this.text(complete?'PRESS SPACE TO CONTINUE':'PRESS SPACE TO RETRY',W*.5,by+H*.05,U*.061,p.p);
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
