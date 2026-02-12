// Play a short celebratory ping on mobile devices
function playPing() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const now = ac.currentTime;

    // Two-tone ping: quick rising notes
    [880, 1318].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });

    // Close context after sounds finish
    setTimeout(() => ac.close(), 500);
  } catch (e) {
    // AudioContext not available - silently ignore
  }
}

export function initConfetti(id="confetti") {
  const canvas = document.getElementById(id);
  if (!canvas) return { burst:()=>{} };

  const ctx = canvas.getContext("2d");
  let pieces = [], raf = null;

  function resize(){
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth*dpr;
    canvas.height = innerHeight*dpr;
    canvas.style.width = innerWidth+"px";
    canvas.style.height = innerHeight+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener("resize", resize);
  resize();

  function tick(t){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces = pieces.filter(p=>{
      if(t>p.end) return false;
      p.vy += p.g/60;
      p.x+=p.vx/60; p.y+=p.vy/60; p.r+=p.vr/60;
      ctx.save();
      ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0,(p.end-t)/300);
      ctx.fillStyle=p.c;
      ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);
      ctx.restore();
      return true;
    });
    if(pieces.length) raf=requestAnimationFrame(tick);
    else raf=null;
  }

  function burst({x=innerWidth/2,y=innerHeight/2,count=120}={}){
    playPing();
    const now=performance.now();
    const colors=["#6ee7b7","#a5b4fc","#e8ecff","#fda4af","#fde68a"];
    for(let i=0;i<count;i++){
      const a=-Math.PI/2+(Math.random()-0.5)*Math.PI;
      const v=400+Math.random()*600;
      pieces.push({
        x,y,
        vx:Math.cos(a)*v, vy:Math.sin(a)*v,
        g:900, s:4+Math.random()*5,
        r:Math.random()*6, vr:(Math.random()-0.5)*10,
        end:now+900+Math.random()*500,
        c:colors[(Math.random()*colors.length)|0]
      });
    }
    if(!raf) raf=requestAnimationFrame(tick);
  }

  return { burst };
}
