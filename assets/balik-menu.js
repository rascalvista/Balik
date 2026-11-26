(()=>{'use strict';
function init(){
const brand = typeof gameName === 'string' ? gameName : 'BALÍČEK';
const root=new URL('../',document.currentScript?.src||location.href); 
const script=document.querySelector('script[src*="balik-menu.js"]');
const base=script?new URL('../',script.src):new URL('https://rascalvista.github.io/Balik/');
const here=location.pathname.replace(/index\.html$/,'').replace(/\/$/,'');
const floors=[['B2','Garáže','b2/'],['B1','Strojovna',''],['0','Recepce (test)','recepce-test/']];
const style=document.createElement('style');style.textContent=`
#balik-menu-toggle{position:absolute;top:10px;right:10px;z-index:40;width:44px;height:44px;min-height:44px;padding:0;border:2px solid #d5a967;border-radius:10px;background:#241a16;color:#ffdb9c;font:bold 25px/1 monospace;box-shadow:0 2px 5px #0008;cursor:pointer}
#balik-menu{box-sizing:border-box;width:min(92vw,380px);max-height:88dvh;overflow:auto;padding:20px;border:2px solid #d5a967;border-radius:12px;background:#211a18;color:#f5d6a0;font:16px/1.35 system-ui,sans-serif;box-shadow:0 12px 40px #000b}
#balik-menu::backdrop{background:#09080bd9}
#balik-menu h2{margin:0 0 16px;text-align:center;letter-spacing:.13em;color:#ffce72;font-size:26px}
#balik-menu button,#balik-menu a{box-sizing:border-box;display:block;width:100%;min-height:44px;margin:7px 0;padding:10px 12px;border:1px solid #a87b46;border-radius:7px;background:#382a22;color:#ffe1a7;text-align:left;font:bold 15px/1.35 system-ui;text-decoration:none;cursor:pointer}
#balik-menu button:disabled{opacity:.45;cursor:default}
#balik-menu small{display:block;color:#bfae95;margin:14px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
#balik-menu [aria-current=page]{border-color:#ffcf74;background:#594126}
`;document.head.append(style);
const d=document.createElement('dialog');d.id='balik-menu';d.setAttribute('aria-label','Menu hry '+brand);
d.innerHTML='<h2>'+brand+'</h2><button data-act="continue">Pokračovat ve hře</button><button data-act="reset">Restartovat patro</button><button data-act="sound">Zvuk</button><small>Testovací režim · patra bez zámků</small><div data-floors></div><small>Hlavní obrazovka</small><a data-home>Hlavní obrazovka</a>';
d.querySelector('[data-home]').href=new URL('home.html',base);
for(const [id,name,path] of floors){const url=new URL(path,base);const current=url.pathname.replace(/\/$/,'')===here;const el=document.createElement('a');el.textContent=id+' · '+name;el.href=url.href;if(current){el.setAttribute('aria-current','page');try{localStorage.setItem('balik.lastFloor',id)}catch{}}d.querySelector('[data-floors]').append(el)}
document.body.append(d);
const toggle=document.createElement('button');toggle.id='balik-menu-toggle';toggle.type='button';toggle.textContent='☰';toggle.setAttribute('aria-label','Otevřít menu hry');
const header=document.querySelector('header');const stage=document.querySelector('.stage-frame main')||document.querySelector('main')||document.body;
if(header){toggle.style.position='static';toggle.style.flex='0 0 44px';header.append(toggle)}else{if(getComputedStyle(stage).position==='static')stage.style.position='relative';stage.append(toggle)}
const sound=document.getElementById('sound-toggle');try{if(localStorage.getItem('balik.sound')==='off'&&sound?.getAttribute('aria-pressed')!=='false')sound?.click();sound?.addEventListener('click',()=>{try{localStorage.setItem('balik.sound',sound.getAttribute('aria-pressed')==='false'?'off':'on')}catch{}})}catch{};const soundMenu=d.querySelector('[data-act=sound]');function sync(){soundMenu.textContent='Zvuk: '+(sound?.getAttribute('aria-pressed')==='false'?'vypnutý':'zapnutý');soundMenu.disabled=!sound}
toggle.onclick=()=>{sync();d.showModal()};d.querySelector('[data-act=continue]').onclick=()=>d.close();d.querySelector('[data-act=reset]').onclick=()=>{d.close();document.getElementById('reset')?.click()};soundMenu.onclick=()=>{sound?.click();sync()};d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});d.addEventListener('close',()=>toggle.focus({preventScroll:true}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();