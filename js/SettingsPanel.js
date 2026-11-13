// Settings UI: JSON owns defaults/ranges, HTML owns structure, CSS owns presentation.
export class SettingsPanel{
  constructor(game){
    this.game=game;
    this.root=null;
    this.config=null;
    this.values={};
    this.activeGroup=null;
    this.isOpen=false;
    this.ready=this.mount();
  }

  async mount(){
    const base=new URL('./SubData/Settings/',import.meta.url);
    const [htmlResponse,jsonResponse]=await Promise.all([
      fetch(new URL('settings.html',base)),
      fetch(new URL('settings.json',base))
    ]);
    if(!htmlResponse.ok)throw new Error('Settings HTML could not be loaded');
    if(!jsonResponse.ok)throw new Error('Settings JSON could not be loaded');
    const [markup,config]=await Promise.all([htmlResponse.text(),jsonResponse.json()]);
    if(config.schemaVersion!==1||!Array.isArray(config.groups))throw new Error('Unsupported Settings schema');

    const template=document.createElement('template');
    template.innerHTML=markup.trim();
    this.root=template.content.firstElementChild;
    if(!this.root)throw new Error('Settings HTML has no root element');
    document.body.append(this.root);
    this.config=config;
    this.loadValues();
    this.render();
    this.bind();
    this.applyAll();
    return this;
  }

  allSettings(){
    return this.config.groups.flatMap(group=>group.settings);
  }

  loadValues(){
    const storageKey=this.config.storageKey;
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch(error){saved={};}
    for(const setting of this.allSettings()){
      this.values[setting.id]=Object.prototype.hasOwnProperty.call(saved,setting.id)
        ?saved[setting.id]:setting.default;
    }
    // Preserve pre-Settings Mod Menu values for existing players.
    if(!Object.prototype.hasOwnProperty.call(saved,'mapSpeed'))this.values.mapSpeed=this.game.mods.mapSpeed;
    if(!Object.prototype.hasOwnProperty.call(saved,'playerSpeed'))this.values.playerSpeed=this.game.mods.playerSpeed;
    if(!Object.prototype.hasOwnProperty.call(saved,'musicVolume'))this.values.musicVolume=this.game.audio.vol;
    this.values.mapSpeed=this.clampSetting('mapSpeed',this.values.mapSpeed);
    this.values.playerSpeed=this.clampSetting('playerSpeed',this.values.playerSpeed);
    this.values.musicVolume=this.clampSetting('musicVolume',this.values.musicVolume);
    const fps=this.setting('frameRate');
    if(!fps.options.includes(Number(this.values.frameRate)))this.values.frameRate=fps.default;
    this.persist();
  }

  setting(id){return this.allSettings().find(item=>item.id===id);}
  get(id){return this.values[id];}

  clampSetting(id,value){
    const definition=this.setting(id);
    if(!definition||!Number.isFinite(Number(value)))return definition?.default??value;
    return Math.min(definition.max,Math.max(definition.min,Number(value)));
  }

  persist(){
    try{localStorage.setItem(this.config.storageKey,JSON.stringify(this.values));}
    catch(error){console.warn('[HEXBEAT] Settings could not be saved:',error);}
  }

  render(){
    const nav=this.root.querySelector('[data-settings-nav]');
    const content=this.root.querySelector('[data-settings-content]');
    nav.replaceChildren();content.replaceChildren();
    for(let index=0;index<this.config.groups.length;index++){
      const group=this.config.groups[index];
      const tab=document.createElement('button');
      tab.type='button';tab.textContent=group.title;tab.dataset.settingsGroup=group.id;
      tab.setAttribute('aria-current',index===0?'page':'false');
      nav.append(tab);

      const section=document.createElement('section');
      section.className='hb-settings__section';section.dataset.settingsSection=group.id;
      section.hidden=index!==0;
      const heading=document.createElement('h2');heading.textContent=group.title;
      const description=document.createElement('p');description.className='hb-settings__section-description';
      description.textContent=group.description??'';
      section.append(heading,description);
      for(const definition of group.settings)section.append(this.renderSetting(definition));
      content.append(section);
    }
    this.activeGroup=this.config.groups[0]?.id??null;
    this.syncRows();
  }

  renderSetting(definition){
    const row=document.createElement('div');
    row.className='hb-setting';
    row.dataset.settingRow=definition.id;
    if(definition.disabled)row.classList.add('is-disabled');

    const copy=document.createElement('div');
    const title=document.createElement('label');
    title.className='hb-setting__title';title.textContent=definition.label;
    title.htmlFor='hb-setting-'+definition.id;
    const description=document.createElement('span');
    description.className='hb-setting__description';description.textContent=definition.description??'';
    copy.append(title,description);

    const control=document.createElement('div');
    control.className='hb-setting__control';
    const id='hb-setting-'+definition.id;
    const value=this.values[definition.id];

    if(definition.type==='select'){
      const select=document.createElement('select');
      select.id=id;select.dataset.setting=definition.id;
      for(const optionValue of definition.options??[]){
        const option=document.createElement('option');
        option.value=String(optionValue);
        option.textContent=optionValue+' '+(definition.unit??'');
        select.append(option);
      }
      select.value=String(value);
      control.append(select);
    }else if(definition.type==='range'){
      const range=document.createElement('input');
      range.type='range';range.id=id;range.dataset.setting=definition.id;
      range.min=String(definition.min);range.max=String(definition.max);range.step=String(definition.step??.01);
      range.value=String(value);
      const output=document.createElement('output');
      output.className='hb-setting__value';output.dataset.settingValue=definition.id;
      output.textContent=this.formatValue(definition,value);
      control.append(range,output);
    }else if(definition.type==='toggle'){
      const label=document.createElement('label');
      label.className='hb-setting__toggle';label.htmlFor=id;
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';checkbox.id=id;checkbox.dataset.setting=definition.id;
      checkbox.checked=Boolean(value);
      const track=document.createElement('span');track.className='hb-setting__toggle-track';
      label.append(checkbox,track);control.append(label);
    }else if(definition.type==='status'){
      const status=document.createElement('span');
      status.className='hb-setting__status';status.textContent=definition.display??String(value).toUpperCase();
      control.append(status);
    }
    if(definition.status){
      const badge=document.createElement('span');
      badge.className='hb-setting__status'+(definition.status==='WIP'?' hb-setting__status--wip':'');
      badge.textContent=definition.status;control.append(badge);
    }
    if(definition.disabled){
      for(const field of control.querySelectorAll('input,select'))field.disabled=true;
    }
    row.append(copy,control);
    return row;
  }

  formatValue(definition,value){
    if(definition.displayAsPercent)return Math.round(Number(value)*100)+'%';
    const amount=Number(value);
    return (Number.isFinite(amount)?amount.toFixed(2):String(value))+(definition.unit??'');
  }

  bind(){
    const root=this.root;
    root.addEventListener('click',event=>{
      const close=event.target.closest('[data-settings-close]');
      if(close){event.preventDefault();this.close();return;}
      const reset=event.target.closest('[data-settings-reset]');
      if(reset){this.reset();return;}
      const tab=event.target.closest('[data-settings-group]');
      if(tab)this.activateGroup(tab.dataset.settingsGroup);
    });
    root.addEventListener('input',event=>{
      const field=event.target.closest('[data-setting]');
      if(!field||field.disabled)return;
      const definition=this.setting(field.dataset.setting);
      if(definition?.type==='range')this.setValue(definition.id,Number(field.value));
    });
    root.addEventListener('change',event=>{
      const field=event.target.closest('[data-setting]');
      if(!field||field.disabled)return;
      const definition=this.setting(field.dataset.setting);
      if(definition?.type==='select')this.setValue(definition.id,Number(field.value));
      else if(definition?.type==='toggle')this.setValue(definition.id,field.checked);
      else if(definition?.type==='range')this.setValue(definition.id,Number(field.value));
    });
    root.addEventListener('pointerdown',event=>event.stopPropagation());
    root.addEventListener('pointerup',event=>event.stopPropagation());
    root.addEventListener('click',event=>event.stopPropagation());
    root.addEventListener('keydown',event=>{
      if(event.code==='Escape'){
        event.preventDefault();event.stopPropagation();this.close();return;
      }
      event.stopPropagation();
    });
    root.addEventListener('keyup',event=>event.stopPropagation());
  }

  activateGroup(id){
    this.activeGroup=id;
    for(const tab of this.root.querySelectorAll('[data-settings-group]')){
      tab.setAttribute('aria-current',tab.dataset.settingsGroup===id?'page':'false');
    }
    for(const section of this.root.querySelectorAll('[data-settings-section]')){
      section.hidden=section.dataset.settingsSection!==id;
    }
  }

  setValue(id,value){
    const definition=this.setting(id);
    if(!definition||definition.disabled||definition.type==='status')return;
    if(definition.type==='range')value=this.clampSetting(id,value);
    if(definition.type==='select'&&!definition.options.includes(value))return;
    if(definition.type==='toggle')value=Boolean(value);
    this.values[id]=value;
    this.persist();

    if(id==='frameRate')this.game.frameRateCap=value;
    if(id==='musicVolume'){
      this.game.audio.setVolume(value);
      if(this.game.volUI?.input)this.game.volUI.input.value=String(value);
    }
    if(id==='mapSpeed'||id==='playerSpeed')this.applyModifiers();
    if(id==='modMenuEnabled')this.applyModifiers();
    this.syncRows();
  }

  applyModifiers(){
    const enabled=this.values.modMenuEnabled!==false;
    this.game.mods.mapSpeed=enabled?this.values.mapSpeed:1;
    this.game.mods.playerSpeed=enabled?this.values.playerSpeed:1;
    try{localStorage.setItem('hxm',JSON.stringify(this.game.mods));}catch(error){}
  }

  applyAll(){
    this.game.frameRateCap=Number(this.values.frameRate)||60;
    this.game.audio.setVolume(Number(this.values.musicVolume));
    if(this.game.volUI?.input)this.game.volUI.input.value=String(this.values.musicVolume);
    this.applyModifiers();
  }

  syncRows(){
    for(const definition of this.allSettings()){
      const row=this.root.querySelector('[data-setting-row="'+definition.id+'"]');
      const field=this.root.querySelector('[data-setting="'+definition.id+'"]');
      const output=this.root.querySelector('[data-setting-value="'+definition.id+'"]');
      if(field){
        if(definition.type==='range'||definition.type==='select')field.value=String(this.values[definition.id]);
        if(definition.type==='toggle')field.checked=Boolean(this.values[definition.id]);
      }
      if(output)output.textContent=this.formatValue(definition,this.values[definition.id]);
      if(row&&definition.requires){
        const disabled=this.values[definition.requires]!==true;
        row.classList.toggle('is-disabled',disabled);
        const input=row.querySelector('input,select');
        if(input)input.disabled=disabled;
      }
    }
  }

  syncMusicVolume(value){
    if(!this.config)return;
    this.values.musicVolume=this.clampSetting('musicVolume',value);
    this.persist();this.syncRows();
  }

  reset(){
    for(const definition of this.allSettings())this.values[definition.id]=definition.default;
    this.persist();this.applyAll();this.syncRows();
  }

  async open(){
    await this.ready;
    if(!this.root)return;
    if(this.isOpen)return;
    this.isOpen=true;
    this.game.uiOverlay='settings';
    this.root.hidden=false;
    this.root.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>this.root?.classList.add('is-open'));
    this.root.querySelector('.hb-settings__close')?.focus();
  }

  close(){
    if(!this.root||!this.isOpen)return;
    this.isOpen=false;
    this.game.uiOverlay=null;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden','true');
    const root=this.root;
    setTimeout(()=>{if(!this.isOpen)root.hidden=true;},260);
  }

  async toggle(){
    if(this.isOpen)this.close();
    else await this.open();
  }
}
