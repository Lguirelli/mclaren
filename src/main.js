(() => {
  const chapters = [...document.querySelectorAll('.chapter')];
  const pictures = [...document.querySelectorAll('.scene-frame')];
  const links = [...document.querySelectorAll('.chapter-nav a')];
  const button = document.querySelector('#motion-toggle');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = preference.matches, scheduled = false, anchors = [];
  function measure() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    anchors = chapters.map((section,i)=>i===0?0:Math.min(max,section.offsetTop+section.offsetHeight/2-innerHeight/2));
  }
  function update() {
    scheduled = false;
    let progress = chapters.length-1;
    for(let i=0;i<anchors.length-1;i++)if(scrollY<=anchors[i+1]){progress=i+Math.max(0,Math.min(1,(scrollY-anchors[i])/Math.max(1,anchors[i+1]-anchors[i])));break;}
    const current = Math.round(progress), left = Math.floor(progress), next = Math.min(left+1,pictures.length-1);
    // Crossfades use ordinary images; no 3D context, shader or canvas is created.
    const available = index => pictures[index].complete && pictures[index].naturalWidth>0;
    let a = reduced ? current : left, b = reduced ? current : next;
    if(!available(a))a=pictures.findIndex((_,i)=>available(i));
    if(!available(b))b=a;
    pictures.forEach((picture,i)=>{picture.style.opacity=i===a?1:i===b?progress-left:0;});
    document.body.style.setProperty('--copy-side',String((1-Math.cos(progress*Math.PI))/2));
    links.forEach((link,i)=>i===current?link.setAttribute('aria-current','step'):link.removeAttribute('aria-current'));
    document.querySelector('#chapter-label').textContent=String(current+1).padStart(2,'0')+' — '+chapters[current].dataset.chapter;
    const ratio=Math.max(0,Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)));
    document.querySelector('.scroll-progress span').style.transform='scaleX('+ratio+')';
  }
  function request(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  function setMotion(){document.body.classList.toggle('reduced-motion',reduced);document.documentElement.style.scrollBehavior=reduced?'auto':'smooth';button.setAttribute('aria-pressed',String(reduced));button.textContent=reduced?'Ativar movimento':'Reduzir movimento';request();}
  if('IntersectionObserver' in window){
    document.body.classList.add('motion-enabled');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('is-visible');}),{threshold:.08});
    chapters.forEach(chapter=>{chapter.querySelectorAll('.reveal').forEach((el,i)=>el.style.setProperty('--delay',i*140+'ms'));observer.observe(chapter.querySelector('.chapter-copy'));});
  }
  pictures.forEach(picture=>{picture.addEventListener('load',request);picture.addEventListener('error',request);});
  button.addEventListener('click',()=>{reduced=!reduced;setMotion();});
  if(preference.addEventListener)preference.addEventListener('change',()=>{reduced=preference.matches;setMotion();});
  window.addEventListener('scroll',request,{passive:true});
  window.addEventListener('resize',()=>{measure();request();});
  if(document.fonts)document.fonts.ready.then(()=>{measure();request();});
  measure();setMotion();
})();
