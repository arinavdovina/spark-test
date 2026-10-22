const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (menuButton && nav) {
  const closeMenu = () => {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open', !isOpen);
  });

  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeMenu();
  });
}

const hero = document.querySelector('.hero');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (hero && !reducedMotion) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    hero.style.setProperty('--mx', x.toFixed(3));
    hero.style.setProperty('--my', y.toFixed(3));
  });
}

/* Circular Carousel, adapted for this static conference website from React Bits.
 * Copyright (c) 2026 David Haz. See REACT-BITS-LICENSE.md.
 * Uses the cylinder geometry, curved strips, nearest-turn targeting and spring settling.
 */
(() => {
  const section = document.querySelector('.speakers');
  const grid = section.querySelector('.people-grid');
  const originalCards = [...grid.querySelectorAll('.person-card')];
  const order = ['Мария Никитина', 'Татьяна Суслова', 'Татьяна Фанштейн', 'Владимир Скворцов', 'Елена Паремская', 'Татьяна Еремеева', 'Наташа Потапова', 'Арина Вдовина', 'Оксана Рябцева'];
  const cards = order.map(name => originalCards.find(card => card.querySelector('h3').textContent === name));
  const slots = ['10:00–10:30','10:30–11:00','11:00–11:30','12:00–12:30','12:30–13:00','13:00–13:30','15:00–15:40','15:45–16:15','16:15–17:00'];
  const root = document.createElement('div');
  root.className = 'speaker-carousel';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'карусель');
  root.setAttribute('aria-label', 'Выбор спикера');
  root.innerHTML = `<div class="carousel-viewport" tabindex="0" aria-label="Фотографии спикеров. Используйте стрелки влево и вправо."><div class="carousel-camera"><div class="carousel-ring"></div></div></div><div class="carousel-controls"><p>Потяните за фото или выберите спикера</p><div class="carousel-navigation"><button type="button" class="carousel-prev" aria-label="Предыдущий спикер">←</button><span class="carousel-count" aria-live="polite" aria-atomic="true"></span><button type="button" class="carousel-next" aria-label="Следующий спикер">→</button></div></div><div class="speaker-picker" aria-label="Все спикеры"></div>`;
  grid.before(root);
  const viewport = root.querySelector('.carousel-viewport');
  const camera = root.querySelector('.carousel-camera');
  const ring = root.querySelector('.carousel-ring');
  const picker = root.querySelector('.speaker-picker');
  const count = cards.length, step = 360 / count, width = 260, height = 330;
  const radius = count * (width + 32) / (2 * Math.PI);
  let angle = 0, target = 0, velocity = 0, raf = 0, last = 0, active = -1, fit = 1, press = null, suppressClick = false;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const portraits = [], choices = [];
  cards.forEach((card, index) => {
    grid.append(card);
    card.id = `speaker-${index}`;
    const photo = card.querySelector('img');
    const portrait = document.createElement('button');
    portrait.type = 'button';
    portrait.className = 'carousel-portrait';
    portrait.setAttribute('aria-label', order[index]);
    portrait.setAttribute('aria-controls', card.id);
    portrait.tabIndex = -1;
    portrait.style.transform = `rotateY(${index * step}deg) translateZ(${radius}px)`;
    // Eight overlapping curved strips keep the portraits on the cylinder surface.
    for (let tile = 0; tile < 8; tile++) {
      const start = tile * width / 8 - (tile > 0 ? 1.25 : 0);
      const end = (tile + 1) * width / 8 + (tile < 7 ? 1.25 : 0);
      const alpha = ((start + end) / 2 - width / 2) / radius;
      const strip = document.createElement('span');
      strip.className = 'portrait-strip';
      strip.style.cssText = `width:${end-start}px;height:${height}px;left:${-(end-start)/2}px;top:${-height/2}px;transform:translate3d(${radius*Math.sin(alpha)}px,0,${-radius*(1-Math.cos(alpha))}px) rotateY(${alpha*180/Math.PI}deg)`;
      const img = photo.cloneNode();
      img.alt = ''; img.loading = 'eager'; img.draggable = false;
      img.style.cssText = `width:${width}px;height:${height}px;max-width:none;left:${-start}px;object-position:center 22%`;
      strip.append(img); portrait.append(strip);
    }
    portrait.addEventListener('click', () => { if (!suppressClick) focusIndex(index); });
    ring.append(portrait); portraits.push(portrait);
    const choice = document.createElement('button');
    choice.type = 'button'; choice.textContent = order[index];
    choice.setAttribute('aria-controls', card.id);
    choice.addEventListener('click', () => focusIndex(index));
    picker.append(choice); choices.push(choice);
    const slot = document.createElement('p'); slot.className = 'speaker-slot';
    slot.textContent = `07 ноября · ${slots[index]}`;
    card.querySelector('.person-copy').prepend(slot);
  });
  function select(index) {
    if (index === active) return;
    active = index;
    cards.forEach((card, i) => { card.hidden = i !== index; });
    choices.forEach((choice, i) => choice.setAttribute('aria-pressed', String(i === index)));
    portraits.forEach((portrait, i) => portrait.setAttribute('aria-pressed', String(i === index)));
    root.querySelector('.carousel-count').textContent = `${String(index+1).padStart(2,'0')} / 09 · ${order[index]}`;
  }
  function render() {
    ring.style.transform = `rotateY(${angle}deg)`;
    portraits.forEach((portrait,i) => {
      const facing = Math.cos((i*step+angle)*Math.PI/180);
      portrait.style.setProperty('--shade', (.66*Math.pow((1-facing)/2,1.25)).toFixed(3));
    });
    select(((Math.round(-angle/step)%count)+count)%count);
  }
  function frame(now) {
    raf=0;
    const dt=last ? Math.min((now-last)/1000,.05) : 1/60; last=now;
    if (!press && target !== null) {
      if (motion.matches) { angle=target; velocity=0; }
      else {
        let remaining=dt;
        while(remaining>0) {
          const h=Math.min(remaining,1/240);
          velocity+=(118*(target-angle)-2*Math.sqrt(118)*velocity)*h;
          angle+=velocity*h; remaining-=h;
        }
      }
      if (Math.abs(target-angle)<.004 && Math.abs(velocity)<.03) { angle=target; target=null; velocity=0; }
    }
    render();
    if (target!==null && !press) raf=requestAnimationFrame(frame); else last=0;
  }
  function wake() { if (!raf) raf=requestAnimationFrame(frame); }
  function focusIndex(index) {
    target=-index*step;
    target+=360*Math.round((angle-target)/360);
    wake();
  }
  function stepBy(delta) { target=(target??Math.round(angle/step)*step)-delta*step; wake(); }
  function measure() {
    fit=Math.min(1,viewport.clientWidth/1050);
    // On phones, crop the sides instead of shrinking the central portrait to a thumbnail.
    fit=Math.max(.74,fit);
    camera.style.transform=`scale(${fit}) translateZ(${-radius}px) rotateX(-5deg)`;
    render();
  }
  new ResizeObserver(measure).observe(viewport);
  root.querySelector('.carousel-prev').addEventListener('click',()=>stepBy(-1));
  root.querySelector('.carousel-next').addEventListener('click',()=>stepBy(1));
  viewport.addEventListener('keydown',event=>{
    if(event.key==='ArrowRight') stepBy(1);
    else if(event.key==='ArrowLeft') stepBy(-1);
    else if(event.key==='Home') focusIndex(0);
    else if(event.key==='End') focusIndex(count-1);
    else return;
    event.preventDefault();
  });
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    suppressClick=false; target=null; velocity=0;
    press={id:event.pointerId,x:event.clientX,y:event.clientY,angle,moved:false};
  });
  viewport.addEventListener('pointermove',event=>{
    if(!press || press.id!==event.pointerId)return;
    const dx=event.clientX-press.x,dy=event.clientY-press.y;
    if(!press.moved){
      if(Math.abs(dx)<5)return;
      if(Math.abs(dy)>Math.abs(dx)*1.2){press=null;target=Math.round(angle/step)*step;wake();return;}
      press.moved=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');
    }
    angle=press.angle+dx*180/(Math.PI*radius*fit);render();
  });
  function release(event){
    if(!press || press.id!==event.pointerId)return;
    suppressClick=press.moved;press=null;viewport.classList.remove('is-dragging');
    target=Math.round(angle/step)*step;wake();
  }
  viewport.addEventListener('pointerup',release);
  viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('lostpointercapture',release);
  let wheelTimer;
  viewport.addEventListener('wheel',event=>{
    if(Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;
    event.preventDefault();target=null;angle-=event.deltaX*180/(Math.PI*radius*fit);render();
    clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{target=Math.round(angle/step)*step;wake();},140);
  },{passive:false});
  document.querySelectorAll('[data-speaker-name]').forEach(link=>link.addEventListener('click',()=>{
    focusIndex(order.indexOf(link.dataset.speakerName));
  }));
  section.classList.add('has-carousel');
  measure();
})();
