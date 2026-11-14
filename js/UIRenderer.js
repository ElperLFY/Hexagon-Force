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
    const path=g.activePath,levels=g.levels,L=levels[g.lv]??null;
    this.header(p,'PAGE UP / DOWN — PATH','ESC — MAIN MENU');
    this.text('SELECT YOUR PATH',W*.5,H*.075,U*.043,p.w);

    const pathCount=g.paths.length,pathGap=W*.02,pathWidth=W*.42;
    const pathStart=(W-(pathWidth*pathCount+pathGap*(pathCount-1)))/2;
    g.paths.forEach((item,index)=>{
      const x=pathStart+index*(pathWidth+pathGap),y=H*.12,h=H*.085;
      const unlocked=g.isPathUnlocked(item),selected=item.id===path.id,completed=g.isPathCompleted(item);
      const tint=selected?p.b1:unlocked?p.w:'#586174';
      this.panel(x,y,pathWidth,h,tint,selected?'rgba(0,0,0,.82)':'rgba(0,0,0,.62)',h*.16);
      this.text(item.title,x+pathWidth*.5,y+h*.4,U*.047,unlocked?p.p:'#9299a8');
      this.text(!unlocked?'LOCKED':completed?'CLEARED':item.levels.length?item.levels.length+' LEVELS':'COMING SOON',
        x+pathWidth*.5,y+h*.77,U*.025,selected?p.b2:p.w);
      if(!unlocked)this.text('🔒',x+pathWidth*.91,y+h*.49,U*.036,p.w);
    });

    if(!levels.length){
      this.ring(W*.5,H*.49,U*.3,now*.18,p.b1,Math.max(2,U*.01));
      this.text('PATH OF PAIN',W*.5,H*.38,U*.10,p.p);
      this.text('NEW LEVELS COMING SOON',W*.5,H*.51,U*.046,p.w);
      this.text('CLEAR PATH OF JOY TO UNLOCK THIS ROUTE',W*.5,H*.62,U*.029,p.w);
      this.text('SETTINGS  ·  M / S',W*.94,H*.94,U*.027,p.w,'right');
      if(g.msg)this.text(g.msg,W*.5,H*.975,U*.022,p.w);
      return;
    }

    this.text(path.title,W*.5,H*.245,U*.054,p.p);
    const count=levels.length,gap=W*.014,width=(W*.88-gap*(count-1))/count,start=(W-(width*count+gap*(count-1)))/2;
    levels.forEach((level,index)=>{
      const x=start+index*(width+gap),y=H*.30,h=H*.225;
      const unlocked=g.isLevelUnlocked(index,path),completed=g.isLevelCompleted(level.id,path),selected=index===g.lv;
      const stroke=selected?p.b1:completed?p.b2:unlocked?p.w:'#4d5565';
      this.panel(x,y,width,h,stroke,selected?'rgba(0,0,0,.85)':'rgba(0,0,0,.60)',h*.10);
      this.text(String(level.number??index+1).padStart(2,'0'),x+width*.5,y+h*.28,U*.105,unlocked?p.p:'#687184');
      this.text(unlocked?level.name:'LOCKED',x+width*.5,y+h*.60,U*(count>3?.024:.032),unlocked?p.w:'#9299a8');
      this.text(completed?'CLEARED':unlocked?'60s · SURVIVE':'🔒',x+width*.5,y+h*.83,U*.025,completed?p.b2:p.w);
      if(selected){
        this.c.save();this.c.globalAlpha=.65;this.c.fillStyle=p.b1;this.c.fillRect(x+width*.18,y+h*.95,width*.64,Math.max(2,U*.006));this.c.restore();
      }
    });

    this.ring(W*.78,H*.69,U*.43,now*.24,p.b1,Math.max(2,U*.009));
    this.ring(W*.78,H*.69,U*.32,-now*.17,p.w,Math.max(1,U*.004));
    const key=L?g.recordKey(L,path):'';
    const best=L?g.best[key]:null;
    this.text(L?('LEVEL '+String(L.number??g.lv+1).padStart(2,'0')+' · '+L.name):'NO LEVEL SELECTED',W*.07,H*.615,U*.047,p.p,'left');
    this.text(L?'BEST  '+timeLabel(best):'PATH IS READY FOR FUTURE LEVELS',W*.07,H*.675,U*.036,p.w,'left');
    const bx=W*.07,by=H*.65,bw=W*.38,bh=H*.092;
    this.panel(bx,by,bw,bh,p.b1,'rgba(0,0,0,.82)',bh*.18);
    this.text('START LEVEL',bx+bw*.5,by+bh*.5,U*.052,p.p);
    this.text('← / → LEVELS     PAGE UP / DOWN PATHS',W*.5,H*.875,U*.026,p.w);
    this.text('SETTINGS  ·  M / S',W*.94,H*.94,U*.027,p.w,'right');
    if(g.msg)this.text(g.msg,W*.5,H*.975,U*.022,p.w);
  }
  results(g,p,complete){
    const W=this.W,H=this.H,U=this.U,now=performance.now()/1000,L=g.level,cx=W*.55,cy=H*.51;
    this.ring(cx,cy,U*1.05,now*.28,p.b1,Math.max(2,U*.013));
    this.ring(cx,cy,U*.82,-now*.19,p.w,Math.max(1,U*.004));
    this.header(p,'TAB — HIGH SCORES','ESC — PATH SELECT');
    this.text('LEVEL '+String(L.number??g.lv+1).padStart(2,'0'),W*.055,H*.34,U*.125,p.p,'left');
    this.text(L.name,W*.065,H*.425,U*.045,p.w,'left');
    this.text(complete?'STAGE COMPLETE':'GAME OVER',W*.065,H*.55,U*.06,p.p,'left');
    const key=g.recordKey(L),last=g.lastScores?.[key],best=g.best?.[key],x=W*.58,w=W*.36,h=H*.115;
    this.panel(x,H*.32,w,h,p.b1,'rgba(0,0,0,.84)',h*.15);
    this.panel(x,H*.47,w,h,p.b1,'rgba(0,0,0,.84)',h*.15);
    this.text('LAST',x+w*.06,H*.377,U*.061,p.p,'left');
    this.text(timeLabel(last),x+w*.94,H*.377,U*.095,'#e4e4e4','right');
    this.text('BEST',x+w*.06,H*.527,U*.061,p.p,'left');
    this.text(timeLabel(best),x+w*.94,H*.527,U*.095,'#e4e4e4','right');

    const nextUnlocked=g.lv+1<g.levels.length&&g.isLevelUnlocked(g.lv+1);
    const nextPath=g.paths.find(path=>path.unlock?.type==='complete-path'&&path.unlock.pathId===g.activePath.id&&g.isPathUnlocked(path));
    const message=complete
      ?nextPath?'PATH OF PAIN UNLOCKED':nextUnlocked?'NEXT LEVEL UNLOCKED':'PATH CLEARED'
      :'ATTEMPT ENDED — TRY AGAIN';
    this.text(message,W*.5,H*.68,U*.045,p.b2);
    const by=H*.84,bw=Math.min(W*.55,U*2.25),bx=(W-bw)/2;
    this.panel(bx,by,bw,H*.10,p.b1,'rgba(0,0,0,.86)',H*.025);
    this.text(complete?(nextUnlocked?'ENTER — NEXT LEVEL':'ENTER — CONTINUE'):'ENTER — RETRY',W*.5,by+H*.05,U*.052,p.p);
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
      return {path: path?.title??'',name:level.name,best:g.best[g.recordKey(level,path)]};
    }).filter(row=>Number.isFinite(row.best)).sort((a,b)=>b.best-a.best);
    if(!entries.length)this.text('NO RECORDS YET',W*.5,H*.69,U*.043,p.w);
    else entries.slice(0,5).forEach((row,i)=>{
      const y=H*(.68+i*.055);
      this.text(row.path+' · '+row.name,W*.31,y,U*.031,p.w,'left');
      this.text(timeLabel(row.best),W*.69,y,U*.038,p.p,'right');
    });
    this.text('TAB / ESC — CLOSE',W*.5,H*.94,U*.036,p.w);
    c.restore();
  }
  loading(g,p){
    const W=this.W,H=this.H,U=this.U;this.header(p);
    this.ring(W*.5,H*.45,U*.28,performance.now()/1000*.8,p.b1,Math.max(2,U*.012));
    this.text('ANALYSING AUDIO',W*.5,H*.76,U*.065,p.p);this.text('PLEASE WAIT',W*.5,H*.83,U*.035,p.w);
  }
}
