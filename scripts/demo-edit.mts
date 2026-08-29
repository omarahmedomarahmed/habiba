/**
 * Cut the raw capture into a demo video people will actually watch.
 *
 *   npx tsx scripts/demo-video.mts && npx tsx scripts/demo-edit.mts
 *
 * `demo-video.mts` produces evidence: a screen recording and ten stills, in
 * order, of the real product. This produces the film — mockup frame, camera
 * moves, punch-ins on the details that carry the argument, typography, cuts.
 *
 * ## Why this renders to a canvas instead of driving a video editor
 *
 * There is no usable ffmpeg here. The only build on the box is the one
 * Playwright bundles, which is stripped to a webm muxer with no encoders in
 * it: it can wrap frames it is handed, and it cannot cut, scale, dissolve or
 * re-encode anything. Every conventional route — concat filters, xfade,
 * zoompan, a frame sequence piped to libx264 — needs an encoder that is not
 * installed and cannot be installed.
 *
 * What *is* installed is a browser. So the edit is composited frame by frame
 * onto a 1920x1080 canvas and captured with MediaRecorder straight off
 * `captureStream`, which is a real VP9 encoder that ships inside Chromium.
 * The canvas is the timeline, this file is the edit decision list, and the
 * output is a finished film rather than a screen recording with captions
 * stuck on it.
 *
 * Two consequences worth knowing before changing anything here:
 *
 *   The stills are served over HTTP, not read from `file://`. A canvas that
 *   has drawn a cross-origin image is tainted, and `captureStream` on a
 *   tainted canvas throws — so a one-line static server is load-bearing.
 *
 *   Capture is real-time. MediaRecorder timestamps by wall clock, so the
 *   timeline is driven from `performance.now()` rather than a frame counter:
 *   if a frame runs long the motion stays in sync with the clock and the film
 *   stays the right length, instead of quietly stretching.
 *
 * ## The edit
 *
 * Scenes are declared in TIMELINE below and every one of them is a real
 * screenshot of the running product. The only synthetic pixels in the whole
 * film are the frame around the screenshots and the words on top of them.
 * Nothing is a mockup of a feature that does not exist, which is the entire
 * reason the capture script drives the live site rather than a fixture.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, createWriteStream } from "node:fs";
import { globSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const OUT = process.env.DEMO_OUT ?? "demo-output";
const FILE = join(OUT, "24therapy-demo-edit.webm");
const W = 1920;
const H = 1080;

/* ------------------------------------------------------------------ shots */

/**
 * `focus` and `crop` are in image-normalised coordinates (0..1 of the still),
 * so they survive a re-shoot at a different resolution. `focus` draws an
 * attention ring on the shot; `crop` is what the following punch-in frames.
 * They are deliberately the same rectangle wherever both appear — the ring
 * tells you where to look and the cut takes you there.
 */
const TIMELINE = [
  { kind: "title", dur: 4.0 },

  {
    kind: "shot",
    layout: "a",
    img: "01-home-globe.png",
    url: "24therapy.com",
    dur: 5.0,
    kb: [1.035, 1.0],
    title: "The homepage is the board",
    sub: "Every card is a licensed clinician who is online this minute.",
    focus: { x: 0.1, y: 0.12, w: 0.19, h: 0.045 },
  },
  {
    kind: "detail",
    img: "01-home-globe.png",
    dur: 3.6,
    crop: { cx: 0.19, cy: 0.15, z: 0.46 },
    label: "A live count, not a claim",
    sub: "It is a query against who is actually reachable, right now.",
  },

  {
    kind: "shot",
    layout: "b",
    img: "03-filter-arabic.png",
    url: "24therapy.com",
    dur: 5.2,
    kb: [1.0, 1.035],
    title: "Filter by language first",
    sub:
      "Because language is the first thing that rules a clinician out. " +
      "The whole product runs in Arabic too — right to left, throughout.",
  },
  {
    kind: "shot",
    layout: "a",
    img: "04-radar-board.png",
    url: "24therapy.com/radar",
    dur: 4.4,
    kb: [1.03, 1.0],
    title: "The full board",
    sub: "Country, language, and what you need help with.",
  },

  {
    kind: "shot",
    layout: "a",
    img: "05-booking-sheet.png",
    url: "24therapy.com/radar",
    dur: 4.8,
    kb: [1.0, 1.035],
    title: "Pick someone",
    sub: "They are held for you the moment you open the sheet.",
    focus: { x: 0.355, y: 0.345, w: 0.29, h: 0.1 },
  },
  {
    kind: "detail",
    img: "05-booking-sheet.png",
    dur: 4.0,
    crop: { cx: 0.5, cy: 0.395, z: 0.44 },
    label: "Sixty seconds, held",
    sub: "They show as busy to everyone else, and are released if you walk away.",
  },

  {
    kind: "shot",
    layout: "b",
    img: "06-booking-name.png",
    url: "24therapy.com/radar",
    dur: 4.8,
    kb: [1.0, 1.03],
    title: "A first name. That is the form.",
    sub: "No account. No insurance. No waiting list. Email is optional, and only for the receipt.",
  },

  { kind: "statement", dur: 2.8, line: "One question before you go in." },

  {
    kind: "shot",
    layout: "a",
    img: "08-consent-question.png",
    url: "24therapy.com/join",
    anchor: 0.5,
    dur: 4.8,
    kb: [1.035, 1.0],
    title: "Recording is opt-in",
    sub: "Asked once, per session, in words a person can actually read.",
    focus: { x: 0.36, y: 0.485, w: 0.28, h: 0.19 },
  },
  {
    kind: "detail",
    img: "08-consent-question.png",
    dur: 4.0,
    crop: { cx: 0.5, cy: 0.58, z: 0.42 },
    label: "Saying no changes nothing else",
    sub: "The session runs exactly the same. The clinician writes their notes by hand.",
  },

  {
    kind: "shot",
    layout: "a",
    img: "10-patient-room.png",
    url: "24therapy.com/join",
    dur: 4.4,
    kb: [1.03, 1.0],
    title: "And you are in",
    sub: "Under two minutes from the homepage, with no account created at any point.",
    focus: { x: 0.64, y: 0.01, w: 0.25, h: 0.33 },
  },
  {
    kind: "detail",
    img: "10-patient-room.png",
    dur: 4.4,
    crop: { cx: 0.766, cy: 0.175, z: 0.5 },
    label: "The rating is anonymous",
    sub: "The clinician sees the stars and the words. Never who wrote them.",
  },

  {
    kind: "statement",
    dur: 4.2,
    line: "Meanwhile, the session documents itself.",
    bullets: [
      "Live transcript, with speaker labels",
      "SOAP note inside a minute of the session ending",
      "Crisis language flagged while it is still being said",
    ],
  },

  { kind: "outro", dur: 5.0 },
] as const;

/** Cut style between each pair of scenes, cycled. */
const TRANSITIONS = ["punch", "push", "dissolve", "wipe"] as const;
const XDUR = 0.42;

/* ------------------------------------------------------------- the page */

function pageHtml(timeline: unknown, transitions: unknown, xdur: number) {
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:#000;overflow:hidden}
    canvas{display:block}
  </style><canvas id="c" width="${W}" height="${H}"></canvas><script>
const W=${W}, H=${H};
const TIMELINE=${JSON.stringify(timeline)};
const TRANSITIONS=${JSON.stringify(transitions)};
const XDUR=${xdur};

const NAVY='#0A2342', DEEP='#04101F', TEAL='#2EC4B6', ICE='#C9DCEF',
      WHITE='#FFFFFF', MUTED='#8098B4', PANE='#0E2337';
const SANS='"Liberation Sans", Arial, Helvetica, sans-serif';
const f=(w,s)=>w+' '+s+'px '+SANS;

const easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOut=t=>1-Math.pow(1-t,3);
const clamp=(t,a,b)=>Math.max(a,Math.min(b,t));
const lerp=(a,b,t)=>a+(b-a)*t;
/** 0 before \`from\`, 1 after \`to\`, eased between. */
const seg=(p,from,to)=>easeOut(clamp((p-from)/(to-from),0,1));

function rr(x,y,w,h,r){
  const c=arguments[5]||CTX; c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}

/** Wrap to a width and return the lines, so callers can measure before drawing. */
function wrap(c,text,maxW){
  const words=String(text).split(' '); const lines=[]; let line='';
  for(const w of words){
    const t=line?line+' '+w:w;
    if(c.measureText(t).width>maxW && line){lines.push(line);line=w;} else line=t;
  }
  if(line)lines.push(line);
  return lines;
}
function para(c,text,x,y,maxW,lh,align){
  c.textAlign=align||'left';
  const lines=wrap(c,text,maxW);
  lines.forEach((l,i)=>c.fillText(l,x,y+i*lh));
  return lines.length*lh;
}

/* ---- background ------------------------------------------------------- */
function backdrop(c,t){
  c.fillStyle=DEEP; c.fillRect(0,0,W,H);
  const gx=W*0.5+Math.sin(t*0.22)*260, gy=H*0.42+Math.cos(t*0.17)*160;
  const g=c.createRadialGradient(gx,gy,0,gx,gy,980);
  g.addColorStop(0,'rgba(46,196,182,0.16)');
  g.addColorStop(0.45,'rgba(31,94,255,0.07)');
  g.addColorStop(1,'rgba(4,16,31,0)');
  c.fillStyle=g; c.fillRect(0,0,W,H);
  c.fillStyle='rgba(201,220,239,0.045)';
  for(let x=40;x<W;x+=48) for(let y=40;y<H;y+=48){ c.fillRect(x,y,1.6,1.6); }
}

/* ---- brand furniture -------------------------------------------------- */
function mark(c,x,y,s,radius){
  rr(x,y,s,s,radius===undefined?s*0.24:radius,c);
  c.fillStyle=TEAL; c.fill();
  c.fillStyle=NAVY; c.font=f(800,s*0.5); c.textAlign='center'; c.textBaseline='middle';
  c.fillText('24',x+s/2,y+s/2+s*0.02);
  c.textBaseline='alphabetic';
}
function watermark(c,a){
  c.save(); c.globalAlpha=a;
  mark(c,72,H-104,34);
  c.fillStyle='rgba(201,220,239,0.72)'; c.font=f(600,20); c.textAlign='left';
  c.fillText('24Therapy',118,H-80);
  c.restore();
}

/* ---- the browser mockup ----------------------------------------------- */
function chrome(c,x,y,w,h,url){
  c.save();
  c.shadowColor='rgba(0,0,0,0.55)'; c.shadowBlur=64; c.shadowOffsetY=26;
  rr(x,y,w,h,18,c); c.fillStyle=PANE; c.fill();
  c.restore();

  const bar=46;
  c.save(); rr(x,y,w,h,18,c); c.clip();
  c.fillStyle='#14304A'; c.fillRect(x,y,w,bar);
  c.restore();

  const dots=['#FF5F57','#FEBC2E','#28C840'];
  dots.forEach((col,i)=>{
    c.beginPath(); c.arc(x+26+i*22,y+bar/2,6.5,0,Math.PI*2);
    c.fillStyle=col; c.fill();
  });

  const pw=Math.min(420,w*0.42), px=x+w/2-pw/2, py=y+bar/2-13;
  rr(px,py,pw,26,13,c); c.fillStyle='#0B2338'; c.fill();
  // padlock, drawn rather than typed: the emoji font renders it in colour.
  c.strokeStyle='#7EA2C4'; c.lineWidth=1.6;
  c.beginPath(); c.arc(px+22,py+11,3.6,Math.PI,0); c.stroke();
  rr(px+17.5,py+11,9,8,2,c); c.fillStyle='#7EA2C4'; c.fill();
  c.fillStyle='#9DB6D0'; c.font=f(400,14); c.textAlign='left';
  c.fillText(url,px+36,py+18);
  return bar;
}

/**
 * Draw a still inside the mockup with a slow push, cover-cropped.
 *
 * Two things here are not decoration. The pan is clamped to the slack the
 * zoom actually created — at scale 1.0 a cover crop has none, and drifting
 * anyway slides the screenshot off its own frame and shows a strip of empty
 * pane down one edge. And the vertical crop is anchored to the top rather
 * than centred, because every one of these pages puts its header on the first
 * row: centre the crop and a 6% zoom cuts the site's navigation in half, which
 * reads as a broken render rather than a camera move.
 */
function screen(c,img,x,y,w,h,k,drift,anchor){
  c.save(); rr(x,y,w,h,10,c); c.clip();
  const cover=Math.max(w/img.width,h/img.height)*k;
  const dw=img.width*cover, dh=img.height*cover;
  const slackX=Math.max(0,(dw-w)/2), slackY=Math.max(0,dh-h);
  const dx=x+(w-dw)/2+clamp(drift||0,-1,1)*slackX;
  const dy=y-slackY*(anchor===undefined?0:anchor);
  c.drawImage(img,dx,dy,dw,dh);
  c.restore();
  return {dx,dy,dw,dh};
}

/** Pulsing ring over a normalised rect of the drawn image. */
function ring(c,box,r,p){
  if(p<=0)return;
  const x=box.dx+r.x*box.dw, y=box.dy+r.y*box.dh;
  const w=r.w*box.dw, h=r.h*box.dh;
  const grow=(1-easeOut(clamp(p*1.6,0,1)))*26;
  const pulse=0.55+0.45*Math.sin(p*Math.PI*3.2);
  c.save();
  c.strokeStyle='rgba(46,196,182,'+(0.35+0.5*pulse)+')';
  c.lineWidth=3.5;
  c.shadowColor='rgba(46,196,182,0.75)'; c.shadowBlur=22;
  rr(x-grow-8,y-grow-8,w+grow*2+16,h+grow*2+16,14,c); c.stroke();
  c.restore();
}

/* ---- scenes ------------------------------------------------------------ */

function sceneTitle(c,p,t){
  backdrop(c,t);
  const cx=W/2;
  const a=seg(p,0.02,0.30);
  c.save(); c.globalAlpha=a;
  const s=lerp(0.86,1,easeOut(clamp(p/0.30,0,1)));
  c.translate(cx,300); c.scale(s,s); c.translate(-cx,-300);
  mark(c,cx-52,290,104,26);
  c.restore();

  c.globalAlpha=seg(p,0.14,0.40);
  c.fillStyle=ICE; c.font=f(600,22); c.textAlign='center';
  c.setLineDash([]);
  c.fillText('2 4 T H E R A P Y',cx,456);

  c.globalAlpha=seg(p,0.26,0.58);
  c.fillStyle=WHITE; c.font=f(800,74); c.textAlign='center';
  const rise=lerp(26,0,seg(p,0.26,0.58));
  c.fillText('Talk to a real therapist',cx,586+rise);
  c.fillText('in the next sixty seconds.',cx,672+rise);

  c.globalAlpha=seg(p,0.46,0.78);
  c.fillStyle=MUTED; c.font=f(400,26);
  c.fillText('An on-demand therapy marketplace with a clinical AI copilot in every session.',cx,752+rise);
  c.globalAlpha=1;
}

function sceneShot(c,sc,p,t,imgs){
  backdrop(c,t);
  const img=imgs[sc.img];
  const k=lerp(sc.kb[0],sc.kb[1],easeIO(clamp(p,0,1.15)));
  const inA=seg(p,0,0.16);

  if(sc.layout==='a'){
    const w=1240, h=Math.round(w/1.6)+46, x=(W-w)/2, y=54;
    c.save(); c.globalAlpha=inA;
    c.translate(0,lerp(22,0,inA));
    const bar=chrome(c,x,y,w,h,sc.url);
    const box=screen(c,img,x,y+bar,w,h-bar,k,Math.sin(t*0.3)*0.6,sc.anchor);
    if(sc.focus) ring(c,box,sc.focus,clamp((p-0.5)/0.5,0,1));
    c.restore();

    const ty=y+h+62;
    c.globalAlpha=seg(p,0.10,0.34);
    c.fillStyle=WHITE; c.font=f(800,42); c.textAlign='center';
    c.fillText(sc.title,W/2,ty);
    c.globalAlpha=seg(p,0.18,0.44);
    c.fillStyle=MUTED; c.font=f(400,24);
    para(c,sc.sub,W/2,ty+42,1180,32,'center');
    c.globalAlpha=1;
  }else{
    const w=1000, h=Math.round(w/1.6)+46, x=W-w-96, y=(H-h)/2;
    c.save(); c.globalAlpha=inA;
    c.translate(lerp(26,0,inA),0);
    const bar=chrome(c,x,y,w,h,sc.url);
    const box=screen(c,img,x,y+bar,w,h-bar,k,0,sc.anchor);
    if(sc.focus) ring(c,box,sc.focus,clamp((p-0.5)/0.5,0,1));
    c.restore();

    const tx=110, maxW=660;
    c.textAlign='left';
    c.globalAlpha=seg(p,0.10,0.34);
    c.fillStyle=WHITE; c.font=f(800,52);
    const lines=wrap(c,sc.title,maxW);
    let ty=H/2-70-(lines.length-1)*30;
    lines.forEach((l,i)=>c.fillText(l,tx+lerp(24,0,seg(p,0.10,0.34)),ty+i*60));
    c.globalAlpha=seg(p,0.20,0.48);
    c.fillStyle=MUTED; c.font=f(400,25);
    para(c,sc.sub,tx,ty+lines.length*60+22,maxW,36,'left');
    c.globalAlpha=1;
  }
  watermark(c,0.5*inA);
}

function sceneDetail(c,sc,p,t,imgs){
  const img=imgs[sc.img];
  const z=lerp(sc.crop.z*1.14,sc.crop.z,easeIO(clamp(p,0,1.1)));
  const sw=img.width*z, sh=sw*(H/W);
  let sx=img.width*sc.crop.cx-sw/2, sy=img.height*sc.crop.cy-sh/2;
  sx=clamp(sx,0,Math.max(0,img.width-sw));
  sy=clamp(sy,0,Math.max(0,img.height-sh));

  c.fillStyle=DEEP; c.fillRect(0,0,W,H);
  c.save(); c.globalAlpha=seg(p,0,0.10);
  c.drawImage(img,sx,sy,sw,sh,0,0,W,H);
  c.restore();

  /*
   * The label goes in a card, not on a gradient.
   *
   * A soft scrim is enough over a photograph and is not enough over a
   * screenshot: these frames are full of the product's own text at the exact
   * size and weight of the caption, so a wash just produced two paragraphs
   * interleaved. An opaque card is the only thing that reliably separates our
   * words from theirs.
   */
  c.fillStyle='rgba(4,16,31,0.34)'; c.fillRect(0,0,W,H);
  const vg=c.createRadialGradient(W/2,H/2,H*0.34,W/2,H/2,H*0.95);
  vg.addColorStop(0,'rgba(4,16,31,0)'); vg.addColorStop(1,'rgba(4,16,31,0.72)');
  c.fillStyle=vg; c.fillRect(0,0,W,H);

  const a=seg(p,0.10,0.36);
  c.save(); c.globalAlpha=a; c.translate(0,lerp(22,0,a));

  c.font=f(400,25);
  const subLines=wrap(c,sc.sub,940);
  const cardH=150+subLines.length*34;
  const cardY=H-cardH-72;
  c.save();
  c.shadowColor='rgba(0,0,0,0.6)'; c.shadowBlur=48; c.shadowOffsetY=18;
  rr(96,cardY,1032,cardH,18,c); c.fillStyle='#051322'; c.fill();
  c.restore();

  c.textAlign='left';
  c.fillStyle=TEAL; c.font=f(700,19);
  c.fillText('D E T A I L',144,cardY+50);
  c.fillStyle=WHITE; c.font=f(800,50);
  c.fillText(sc.label,144,cardY+112);
  c.fillStyle=ICE; c.font=f(400,25);
  subLines.forEach((l,i)=>c.fillText(l,144,cardY+160+i*34));
  c.restore();
  c.globalAlpha=1;
}

function sceneStatement(c,sc,p,t){
  backdrop(c,t);
  const a=seg(p,0.04,0.34);
  c.textAlign='center';
  c.save(); c.globalAlpha=a; c.translate(0,lerp(18,0,a));
  c.fillStyle=WHITE; c.font=f(800,64);
  const hasB=!!sc.bullets;
  c.fillText(sc.line,W/2,hasB?496:H/2+18);
  c.restore();

  if(hasB){
    // Measure first: a bullet list centred by eye drifts off the title above it.
    c.font=f(400,30);
    const widest=Math.max.apply(null,sc.bullets.map(b=>c.measureText(b).width));
    const tx=W/2-(widest+34)/2+34;
    sc.bullets.forEach((b,i)=>{
      const ba=seg(p,0.26+i*0.11,0.52+i*0.11);
      c.save(); c.globalAlpha=ba; c.translate(0,lerp(16,0,ba));
      const y=612+i*80;
      c.beginPath(); c.arc(tx-24,y-10,7,0,Math.PI*2);
      c.fillStyle=TEAL; c.fill();
      c.fillStyle=ICE; c.font=f(400,30); c.textAlign='left';
      c.fillText(b,tx,y);
      c.restore();
    });
  }
  c.globalAlpha=1;
}

function sceneOutro(c,p,t){
  backdrop(c,t);
  const cx=W/2;
  const a=seg(p,0.02,0.28);
  c.save(); c.globalAlpha=a;
  c.translate(0,lerp(18,0,a));
  mark(c,cx-52,348,104,26);
  c.restore();

  c.globalAlpha=seg(p,0.16,0.44);
  c.fillStyle=WHITE; c.font=f(800,58); c.textAlign='center';
  c.fillText('Care in a minute. Notes for free.',cx,564);

  c.globalAlpha=seg(p,0.30,0.58);
  c.fillStyle=TEAL; c.font=f(700,34);
  c.fillText('habiba-zeta.vercel.app',cx,642);

  c.globalAlpha=seg(p,0.44,0.72);
  c.fillStyle=MUTED; c.font=f(400,23);
  c.fillText('Pre-launch  ·  MVP live in production  ·  Every frame in this film is the running product.',cx,712);
  c.globalAlpha=1;
}

function render(c,sc,tl,tAbs,imgs){
  const p=tl/sc.dur;
  if(sc.kind==='title')return sceneTitle(c,p,tAbs);
  if(sc.kind==='shot')return sceneShot(c,sc,p,tAbs,imgs);
  if(sc.kind==='detail')return sceneDetail(c,sc,p,tAbs,imgs);
  if(sc.kind==='statement')return sceneStatement(c,sc,p,tAbs);
  return sceneOutro(c,p,tAbs);
}

/* ---- transitions ------------------------------------------------------- */
function composite(main,A,B,kind,p){
  const e=easeIO(p);
  main.clearRect(0,0,W,H);
  main.fillStyle=DEEP; main.fillRect(0,0,W,H);
  if(kind==='dissolve'){
    main.globalAlpha=1; main.drawImage(A,0,0);
    main.globalAlpha=e; main.drawImage(B,0,0); main.globalAlpha=1;
  }else if(kind==='push'){
    main.drawImage(A,-W*e,0);
    main.drawImage(B,W*(1-e),0);
  }else if(kind==='punch'){
    main.globalAlpha=1-e;
    main.save(); const s=1+0.06*e;
    main.translate(W/2,H/2); main.scale(s,s); main.translate(-W/2,-H/2);
    main.drawImage(A,0,0); main.restore();
    main.globalAlpha=e;
    main.save(); const s2=1.08-0.08*e;
    main.translate(W/2,H/2); main.scale(s2,s2); main.translate(-W/2,-H/2);
    main.drawImage(B,0,0); main.restore();
    main.globalAlpha=1;
  }else{ // wipe: a teal edge sweeps the incoming frame in
    main.drawImage(A,0,0);
    const x=W*e;
    main.save(); main.beginPath(); main.rect(0,0,x,H); main.clip();
    main.drawImage(B,0,0); main.restore();
    const g=main.createLinearGradient(x-90,0,x+10,0);
    g.addColorStop(0,'rgba(46,196,182,0)');
    g.addColorStop(1,'rgba(46,196,182,0.9)');
    main.fillStyle=g; main.fillRect(x-90,0,100,H);
  }
}

/* ---- schedule ---------------------------------------------------------- */
const SCHED=[]; let cur=0;
TIMELINE.forEach((sc,i)=>{
  SCHED.push({t:'s',start:cur,dur:sc.dur,i});
  cur+=sc.dur;
  if(i<TIMELINE.length-1){
    SCHED.push({t:'x',start:cur,dur:XDUR,i,kind:TRANSITIONS[i%TRANSITIONS.length]});
    cur+=XDUR;
  }
});
const TOTAL=cur;

const cv=document.getElementById('c');
const CTX=cv.getContext('2d',{alpha:false});
const mk=()=>{const o=document.createElement('canvas');o.width=W;o.height=H;return o;};
const ca=mk(), cb=mk();
const cactx=ca.getContext('2d',{alpha:false}), cbctx=cb.getContext('2d',{alpha:false});

function loadAll(names){
  return Promise.all(names.map(n=>new Promise((res,rej)=>{
    const im=new Image(); im.onload=()=>res([n,im]); im.onerror=()=>rej(new Error(n)); im.src='/'+n;
  }))).then(pairs=>Object.fromEntries(pairs));
}

/** Draw exactly the frame the film shows at \`t\`, without recording it.
 *
 * A MediaRecorder webm carries no seek index, so seeking the finished file
 * lands on frame zero every time — which is how a first pass at reviewing
 * this looked like fifteen scenes of empty background. Frames get checked
 * here, at the source, where the time is an argument. */
window.__frame=async function(names,t){
  window.__imgs=window.__imgs||await loadAll(names);
  const imgs=window.__imgs;
  const s=SCHED.find(s=>t>=s.start&&t<s.start+s.dur)||SCHED[SCHED.length-1];
  if(s.t==='s'){ render(CTX,TIMELINE[s.i],t-s.start,t,imgs); }
  else{
    const a=TIMELINE[s.i], b=TIMELINE[s.i+1];
    render(cactx,a,a.dur+(t-s.start),t,imgs);
    render(cbctx,b,(t-s.start)-XDUR,t,imgs);
    composite(CTX,ca,cb,s.kind,(t-s.start)/s.dur);
  }
  CTX.fillStyle='rgba(201,220,239,0.14)'; CTX.fillRect(0,H-4,W,4);
  CTX.fillStyle=TEAL; CTX.fillRect(0,H-4,W*(t/TOTAL),4);
  return {scene:s.t==='s'?TIMELINE[s.i].kind:'transition:'+s.kind,total:TOTAL};
};

window.__run=async function(names){
  const imgs=await loadAll(names);

  const stream=cv.captureStream(30);
  const chunks=[];
  const rec=new MediaRecorder(stream,{
    mimeType:'video/webm;codecs=vp9', videoBitsPerSecond:8000000,
  });
  rec.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  const done=new Promise(r=>{ rec.onstop=r; });

  // One frame before recording starts, so the film never opens on black.
  render(CTX,TIMELINE[0],0,0,imgs);
  rec.start();
  const t0=performance.now();

  await new Promise(resolve=>{
    function frame(){
      const t=(performance.now()-t0)/1000;
      if(t>=TOTAL){ resolve(); return; }
      const seg=SCHED.find(s=>t>=s.start&&t<s.start+s.dur)||SCHED[SCHED.length-1];
      if(seg.t==='s'){
        render(CTX,TIMELINE[seg.i],t-seg.start,t,imgs);
      }else{
        const a=TIMELINE[seg.i], b=TIMELINE[seg.i+1];
        render(cactx,a,a.dur+(t-seg.start),t,imgs);
        render(cbctx,b,(t-seg.start)-XDUR,t,imgs);
        composite(CTX,ca,cb,seg.kind,(t-seg.start)/seg.dur);
      }
      // progress hairline
      CTX.fillStyle='rgba(201,220,239,0.14)'; CTX.fillRect(0,H-4,W,4);
      CTX.fillStyle=TEAL; CTX.fillRect(0,H-4,W*(t/TOTAL),4);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  rec.stop();
  await done;
  const buf=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());
  const CH=512*1024;
  for(let i=0;i<buf.length;i+=CH){
    let s=''; const part=buf.subarray(i,i+CH);
    for(let j=0;j<part.length;j+=8192){
      s+=String.fromCharCode.apply(null,part.subarray(j,j+8192));
    }
    await window.__chunk(btoa(s));
  }
  return {bytes:buf.length,seconds:TOTAL};
};
</script>`;
}

/* ------------------------------------------------------------------ main */

const MIME: Record<string, string> = { ".png": "image/png", ".webm": "video/webm" };

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const names = TIMELINE.filter((s): s is Extract<typeof s, { img: string }> => "img" in s).map(
    (s) => s.img,
  );
  const unique = [...new Set(names)];
  const missing = unique.filter((n) => !existsSync(join(OUT, n)));
  if (missing.length > 0) {
    console.error(`Missing stills: ${missing.join(", ")}`);
    console.error("Run `npx tsx scripts/demo-video.mts` first.");
    process.exit(1);
  }

  /*
   * Same-origin, purely so the canvas stays untainted. A `file://` page can
   * draw a `file://` image, but Chromium treats it as cross-origin and
   * `captureStream` then throws SecurityError on the first frame.
   */
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(TIMELINE, TRANSITIONS, XDUR));
      return;
    }
    const file = join(OUT, path.replace(/^\/+/, ""));
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const executablePath = globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome").sort().at(-1);
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--autoplay-policy=no-user-gesture-required", "--disable-frame-rate-limit"],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error") console.log("  browser:", m.text()); });

  const out = createWriteStream(FILE);
  let written = 0;
  await page.exposeFunction("__chunk", (b64: string) => {
    const buf = Buffer.from(b64, "base64");
    written += buf.length;
    out.write(buf);
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });

  const seconds = TIMELINE.reduce((n, s) => n + s.dur, 0) + (TIMELINE.length - 1) * XDUR;

  /*
   * DEMO_STILLS=1.8,6,10.5 renders those frames to PNG and stops. This is how
   * the edit gets reviewed: the finished webm cannot be seeked, so looking at
   * the film means looking at it here, before it is encoded.
   */
  if (process.env.DEMO_STILLS) {
    const dir = join(OUT, "frames");
    mkdirSync(dir, { recursive: true });
    for (const raw of process.env.DEMO_STILLS.split(",")) {
      const t = Number(raw.trim());
      const info = await page.evaluate(
        ([n, tt]) =>
          (window as unknown as { __frame(n: string[], t: number): Promise<{ scene: string }> })
            .__frame(n as string[], tt as number),
        [unique, t] as const,
      );
      const file = join(dir, `t${t.toFixed(1).padStart(5, "0")}.png`);
      await page.locator("#c").screenshot({ path: file });
      console.log(`  ${file}  ${info.scene}`);
    }
    await browser.close();
    server.close();
    out.end();
    return;
  }

  console.log(`\n▸ compositing ${TIMELINE.length} scenes — ${seconds.toFixed(1)}s, real time`);

  const result = await page.evaluate(
    (n) => (window as unknown as { __run(n: string[]): Promise<unknown> }).__run(n),
    unique,
  );

  await new Promise<void>((r) => out.end(r));
  await browser.close();
  server.close();

  const kb = (written / 1024 / 1024).toFixed(1);
  console.log(`\n✓ ${FILE} — ${kb} MB, ${seconds.toFixed(1)}s, 1920x1080 VP9`);
  console.log(`  ${JSON.stringify(result)}`);
}

void main();
