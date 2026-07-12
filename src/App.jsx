/**
 * My Records — Cover Flow
 * ① velocity-linked scroll
 * ② record-rack spine view (VinylSpine for far albums)
 * ③ Space Silver background
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

const SEED = [
  {id:1,  artist:"Miles Davis",    album:"Kind of Blue",               genre:"Jazz",        color:"#091c2e"},
  {id:2,  artist:"Pink Floyd",     album:"The Dark Side of the Moon",  genre:"Rock",        color:"#13082a"},
  {id:3,  artist:"Daft Punk",      album:"Random Access Memories",     genre:"Electronic",  color:"#241200"},
  {id:4,  artist:"Nina Simone",    album:"I Put a Spell on You",       genre:"Jazz",        color:"#0c1c0d"},
  {id:5,  artist:"The Beatles",    album:"Abbey Road",                 genre:"Rock",        color:"#160d05"},
  {id:6,  artist:"Radiohead",      album:"OK Computer",                genre:"Alternative", color:"#0a1520"},
  {id:7,  artist:"Kendrick Lamar", album:"To Pimp a Butterfly",        genre:"Hip-Hop",     color:"#0d0d00"},
  {id:8,  artist:"Fleetwood Mac",  album:"Rumours",                    genre:"Rock",        color:"#1a0a12"},
  {id:9,  artist:"John Coltrane",  album:"A Love Supreme",             genre:"Jazz",        color:"#040c18"},
  {id:10, artist:"Massive Attack", album:"Mezzanine",                  genre:"Electronic",  color:"#04040e"},
];
const GENRES = ["All","Jazz","Rock","Electronic","Alternative","Hip-Hop","Classical","Pop","R&B","Folk"];

function lighten(hex, amt) {
  try {
    const n = parseInt(hex.replace("#",""),16);
    return `rgb(${Math.min(255,(n>>16)+amt)},${Math.min(255,((n>>8)&0xff)+amt)},${Math.min(255,(n&0xff)+amt)})`;
  } catch { return "#888"; }
}
function randomColor() { return `hsl(${(Math.random()*360)|0},40%,10%)`; }

// ─── Physics hook ─────────────────────────────────────────────────────────────
function useCoverFlow(count, STEP) {
  const posRef   = useRef(0);
  const velRef   = useRef(0);
  const phaseRef = useRef("idle");
  const rafRef   = useRef(null);
  const dragX0   = useRef(0);
  const dragP0   = useRef(0);
  const vSamples = useRef([]);

  const containerRef        = useRef(null);
  const [disp,   setDisp]   = useState(0);
  const [active, setActive] = useState(0);

  const maxPos = useCallback(() => Math.max(0,(count-1)*STEP), [count, STEP]);

  function rbClamp(p) {
    const lo=0, hi=maxPos();
    if (p<lo) return lo - Math.pow(lo-p, 0.72);
    if (p>hi) return hi + Math.pow(p-hi, 0.72);
    return p;
  }

  const cancel = () => { cancelAnimationFrame(rafRef.current); rafRef.current=null; };

  const springTo = useCallback((rawIdx) => {
    const idx    = Math.max(0, Math.min(count-1, Math.round(rawIdx)));
    const target = idx * STEP;
    phaseRef.current = "spring";
    const K=0.12, D=0.72;
    cancel();
    let lastMs = performance.now();
    function tick(nowMs) {
      const delta = Math.min(nowMs-lastMs, 64); lastMs=nowMs;
      const steps = Math.round(delta/16.67)||1;
      for (let i=0;i<steps;i++) {
        const d = posRef.current-target;
        velRef.current += -K*d - D*velRef.current;
        posRef.current += velRef.current;
      }
      setDisp(posRef.current);
      setActive(Math.round(Math.max(0,Math.min(maxPos(),posRef.current))/STEP));
      if (Math.abs(posRef.current-target)<0.3 && Math.abs(velRef.current)<0.15) {
        posRef.current=target; velRef.current=0; phaseRef.current="idle";
        setDisp(target); setActive(idx);
      } else {
        rafRef.current=requestAnimationFrame(tick);
      }
    }
    rafRef.current=requestAnimationFrame(tick);
  }, [count, STEP]); // eslint-disable-line

  const startMomentum = useCallback(() => {
    phaseRef.current="momentum";
    const FRICTION=0.93;
    cancel();
    let lastMs=performance.now();
    function tick(nowMs) {
      const delta=Math.min(nowMs-lastMs,64); lastMs=nowMs;
      const steps=Math.round(delta/16.67)||1;
      for (let i=0;i<steps;i++) {
        velRef.current*=FRICTION;
        posRef.current+=velRef.current;
        const lo=0, hi=maxPos();
        if (posRef.current<lo){posRef.current=lo;velRef.current*=-0.08;}
        if (posRef.current>hi){posRef.current=hi;velRef.current*=-0.08;}
      }
      setDisp(posRef.current);
      if (Math.abs(velRef.current)<0.5) {
        springTo(Math.round(posRef.current/STEP));
      } else {
        rafRef.current=requestAnimationFrame(tick);
      }
    }
    rafRef.current=requestAnimationFrame(tick);
  }, [STEP, springTo]); // eslint-disable-line

  const onDown = useCallback((cx) => {
    cancel(); phaseRef.current="drag"; velRef.current=0;
    dragX0.current=cx; dragP0.current=posRef.current;
    vSamples.current=[{px:cx, ms:performance.now()}];
  }, []);

  const onMove = useCallback((cx) => {
    if (phaseRef.current!=="drag") return;
    const now=performance.now();
    vSamples.current.push({px:cx,ms:now});
    vSamples.current=vSamples.current.filter(s=>now-s.ms<80);
    posRef.current=rbClamp(dragP0.current-(cx-dragX0.current));
    setDisp(posRef.current);
    setActive(Math.round(Math.max(0,Math.min(maxPos(),posRef.current))/STEP));
  }, [STEP]); // eslint-disable-line

  const onUp = useCallback(() => {
    if (phaseRef.current!=="drag") return;
    const s=vSamples.current;
    let vel=0;
    if (s.length>=2) {
      const now=performance.now();
      let wSum=0, vSum=0;
      for (let i=1;i<s.length;i++) {
        const dt=s[i].ms-s[i-1].ms;
        if (dt<=0) continue;
        const v=-(s[i].px-s[i-1].px)/dt;
        const age=now-s[i].ms;
        const w=Math.max(0,1-age/80);
        vSum+=v*w; wSum+=w;
      }
      if (wSum>0) vel=vSum/wSum;
    }
    vSamples.current=[];
    const pxPerFrame = vel * 16.67;
    const MAX = STEP * (count-1);
    velRef.current = Math.max(-MAX, Math.min(MAX, pxPerFrame));
    const lo=0, hi=maxPos();
    if (posRef.current<lo||posRef.current>hi) {
      velRef.current=0;
      springTo(posRef.current<lo?0:count-1);
      return;
    }
    if (Math.abs(velRef.current)<0.5) {
      springTo(Math.round(posRef.current/STEP));
    } else {
      startMomentum();
    }
  }, [STEP, count, springTo, startMomentum]); // eslint-disable-line

  const snapTo = useCallback((idx) => {
    velRef.current=0; springTo(idx);
  }, [springTo]);

  useEffect(() => {
    const safe=Math.max(0,Math.min(count-1,Math.round(posRef.current/STEP)));
    posRef.current=safe*STEP; velRef.current=0;
    setDisp(posRef.current); setActive(safe);
  }, [count, STEP]);

  useEffect(() => {
    const el=containerRef.current; if(!el) return;
    const td=e=>onDown(e.touches[0].clientX);
    const tm=e=>{e.preventDefault();onMove(e.touches[0].clientX);};
    const tu=()=>onUp();
    el.addEventListener("touchstart",td,{passive:true});
    el.addEventListener("touchmove",tm,{passive:false});
    el.addEventListener("touchend",tu);
    return()=>{
      el.removeEventListener("touchstart",td);
      el.removeEventListener("touchmove",tm);
      el.removeEventListener("touchend",tu);
    };
  }, [onDown,onMove,onUp]);

  return {
    containerRef, disp, active, snapTo,
    onMouseDown:e=>{e.preventDefault();onDown(e.clientX);},
    onMouseMove:e=>onMove(e.clientX),
    onMouseUp:()=>onUp(),
  };
}

// ─── Record SVG Logo ──────────────────────────────────────────────────────────
function RecordLogo({ size=32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{flexShrink:0}}>
      <defs>
        <radialGradient id="rlbg" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#282828"/><stop offset="100%" stopColor="#0c0c0c"/>
        </radialGradient>
        <radialGradient id="rllbl" cx="42%" cy="38%">
          <stop offset="0%" stopColor="#e8523a"/><stop offset="100%" stopColor="#8b1c0c"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#rlbg)"/>
      {[27,23,19,15,11,8].map(r=>(
        <circle key={r} cx="32" cy="32" r={r} stroke="#1d1d1d" strokeWidth="0.85" fill="none"/>
      ))}
      <path d="M13 13 A25 25 0 0 1 51 17" stroke="rgba(255,255,255,0.055)"
        strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="9.5" fill="url(#rllbl)"/>
      <line x1="26" y1="31" x2="38" y2="31" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9"/>
      <line x1="27" y1="34" x2="37" y2="34" stroke="rgba(255,255,255,0.13)" strokeWidth="0.75"/>
      <circle cx="32" cy="32" r="2.3" fill="#090909"/>
      <circle cx="32" cy="32" r="30" stroke="#2e2e2e" strokeWidth="0.7" fill="none"/>
    </svg>
  );
}

// ─── Vinyl Spine ──────────────────────────────────────────────────────────────
const SPINE_THRESHOLD = 1.4;
const SPINE_W = 18;

function VinylSpine({ album, sign, ITEM_W, scale, opacity, zIndex, lateral }) {
  const h = ITEM_W * scale;
  const w = SPINE_W * scale;
  const edgeColor  = lighten(album.color||"#111", 18);
  const labelColor = lighten(album.color||"#111", 35);
  return (
    <div style={{
      position:"absolute", left:"50%", top:"50%",
      width:w, height:h,
      transform:`translateX(calc(-50% + ${lateral}px)) translateY(-54%)`,
      opacity, zIndex, willChange:"transform,opacity",
    }}>
      <div style={{
        width:"100%", height:"100%",
        background:`linear-gradient(${sign>0?"to left":"to right"},
          ${edgeColor} 0%, ${lighten(album.color||"#111",8)} 35%, ${album.color||"#111"} 100%)`,
        borderRadius:sign>0?"2px 0 0 2px":"0 2px 2px 0",
        boxShadow:sign>0
          ?`-2px 4px 18px rgba(0,0,0,0.7),inset -1px 0 0 rgba(255,255,255,0.06)`
          :`2px 4px 18px rgba(0,0,0,0.7),inset 1px 0 0 rgba(255,255,255,0.06)`,
        position:"relative", overflow:"hidden",
      }}>
        <div style={{
          position:"absolute", left:"50%", top:"50%",
          transform:"translateX(-50%) translateY(-50%) rotate(90deg)",
          whiteSpace:"nowrap",
          fontSize:Math.max(7, 9*scale), fontWeight:600,
          color:"rgba(255,255,255,0.55)", letterSpacing:"0.04em",
          maxWidth:h*0.8, overflow:"hidden", textOverflow:"ellipsis",
          textShadow:"0 1px 3px rgba(0,0,0,0.8)", pointerEvents:"none",
        }}>{album.album}</div>
        <div style={{position:"absolute",top:"12%",left:0,right:0,height:"4%",minHeight:2,background:labelColor,opacity:0.7}}/>
        <div style={{position:"absolute",top:"15%",left:0,right:0,height:"2%",minHeight:1,background:"rgba(255,255,255,0.12)"}}/>
      </div>
    </div>
  );
}

// ─── Album Card ───────────────────────────────────────────────────────────────
function AlbumCard({ album, rawOffset, ITEM_W, onClick }) {
  const sign = rawOffset < 0 ? -1 : 1;
  const abs  = Math.abs(rawOffset);
  if (abs > 5) return null;

  const scale   = Math.max(0.64, 1 - abs * 0.22);
  const opacity = Math.max(0, 1 - abs * 0.26);
  const zIndex  = (200 - abs * 20) | 0;
  const lateral = sign * (abs < 0.001 ? 0 : Math.pow(abs, 0.60) * ITEM_W * 0.50);

  if (abs > SPINE_THRESHOLD) {
    return (
      <VinylSpine
        album={album} sign={sign}
        ITEM_W={ITEM_W} scale={scale} opacity={opacity*0.9} zIndex={zIndex}
        lateral={lateral}
      />
    );
  }

  const rotY    = -sign * Math.min(68, abs * 82);
  const isCenter = abs < 0.07;
  const shadow  = isCenter
    ? "0 44px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)"
    : "0 14px 48px rgba(0,0,0,0.55)";

  return (
    <div onClick={onClick} style={{
      position:"absolute", left:"50%", top:"50%",
      width:ITEM_W, height:ITEM_W,
      transform:`translateX(calc(-50% + ${lateral}px)) translateY(-54%) rotateY(${rotY}deg) scale(${scale})`,
      transformOrigin:"center center",
      opacity, zIndex, willChange:"transform,opacity",
      cursor:abs>0.3?"pointer":"default",
    }}>
      <div style={{
        width:"100%", height:"100%", borderRadius:5, overflow:"hidden",
        boxShadow:shadow, background:album.color||"#111", position:"relative",
      }}>
        {album.artwork
          ? <img src={album.artwork} alt={album.album} draggable={false}
              style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          : <PlaceholderArt album={album}/>
        }
        {isCenter && (
          <div style={{position:"absolute",inset:0,borderRadius:5,pointerEvents:"none",
            background:"linear-gradient(155deg,rgba(255,255,255,0.09) 0%,transparent 42%,rgba(0,0,0,0.15) 100%)"}}/>
        )}
      </div>
      <Reflection album={album} abs={abs} ITEM_W={ITEM_W}/>
    </div>
  );
}

function PlaceholderArt({ album }) {
  return (
    <div style={{
      width:"100%",height:"100%",padding:20,boxSizing:"border-box",
      background:`radial-gradient(ellipse at 35% 25%,${lighten(album.color||"#222",55)},${album.color||"#111"})`,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",
    }}>
      <RecordLogo size={48}/>
      <div style={{color:"rgba(255,255,255,0.88)",fontSize:13,fontWeight:700,
        fontFamily:"Georgia,serif",lineHeight:1.35,marginTop:12}}>{album.album}</div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,marginTop:5}}>{album.artist}</div>
    </div>
  );
}

function Reflection({ album, abs, ITEM_W }) {
  const op=Math.max(0,0.38-abs*0.16);
  if (op<0.02) return null;
  return (
    <div style={{
      position:"absolute",top:"100%",left:0,right:0,height:ITEM_W*0.32,
      overflow:"hidden",opacity:op,transform:"scaleY(-1)",
      maskImage:"linear-gradient(to bottom,rgba(0,0,0,0.45) 0%,transparent 75%)",
      WebkitMaskImage:"linear-gradient(to bottom,rgba(0,0,0,0.45) 0%,transparent 75%)",
      pointerEvents:"none",borderRadius:"0 0 5px 5px",
    }}>
      {album.artwork
        ? <img src={album.artwork} alt="" draggable={false}
            style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transform:"scaleY(-1)"}}/>
        : <div style={{width:"100%",height:"100%",
            background:`radial-gradient(ellipse at 35% 70%,${lighten(album.color||"#222",40)},${album.color||"#111"})`}}/>
      }
    </div>
  );
}

// ─── Dot bar ──────────────────────────────────────────────────────────────────
function DotBar({ total, active, snapTo }) {
  const SHOW=Math.min(total,11), half=(SHOW/2)|0;
  const start=Math.max(0,Math.min(active-half,total-SHOW));
  return (
    <div style={{display:"flex",justifyContent:"center",gap:5,padding:"5px 24px 8px",position:"relative",zIndex:10}}>
      {Array.from({length:Math.min(SHOW,total)},(_,i)=>start+i).map(i=>(
        <div key={i} onClick={()=>snapTo(i)} style={{
          width:i===active?22:5,height:5,borderRadius:3,
          background:i===active?"rgba(0,0,0,0.55)":"rgba(0,0,0,0.2)",
          cursor:"pointer",
          transition:"width 0.24s cubic-bezier(0.34,1.56,0.64,1),background 0.18s",
        }}/>
      ))}
    </div>
  );
}

// ─── Record Rack ──────────────────────────────────────────────────────────────
function RecordRack({ ITEM_W }) {
  return (
    <>
      <div style={{
        position:"absolute",left:0,right:0,pointerEvents:"none",
        top:"50%",transform:`translateY(${ITEM_W*0.47}px)`,
        height:6,
        background:"linear-gradient(to bottom,#b0b0b2,#8a8a8c)",
        boxShadow:"0 2px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.5)",
      }}/>
      <div style={{
        position:"absolute",left:0,right:0,pointerEvents:"none",
        top:"50%",transform:`translateY(${ITEM_W*0.47+6}px)`,
        height:14,
        background:"linear-gradient(to bottom,#7a7a7c,#606062)",
        boxShadow:"0 6px 20px rgba(0,0,0,0.35)",
      }}/>
    </>
  );
}

// ─── Cover Flow Stage ─────────────────────────────────────────────────────────
function CoverFlowStage({ albums, ITEM_W, STEP, containerRef, disp, active, snapTo,
                           onMouseDown, onMouseMove, onMouseUp }) {
  const current=albums[active]||albums[0];
  return (
    <>
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{flex:1,position:"relative",overflow:"hidden",
          cursor:"grab",perspective:1100,perspectiveOrigin:"50% 50%"}}
      >
        {albums.length===0
          ? <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
              justifyContent:"center",color:"rgba(0,0,0,0.3)",fontSize:14}}>
              アルバムがありません
            </div>
          : albums.map((al,i)=>{
              const rawOffset=(i*STEP-disp)/STEP;
              return (
                <AlbumCard key={al.id} album={al} rawOffset={rawOffset} ITEM_W={ITEM_W}
                  onClick={()=>{if(Math.abs(rawOffset)>0.3)snapTo(i);}}/>
              );
            })
        }
        <RecordRack ITEM_W={ITEM_W}/>
      </div>

      {current && (
        <div style={{textAlign:"center",padding:"8px 24px 2px",position:"relative",zIndex:10}}>
          <div style={{color:"#1c1c1e",fontSize:16,fontWeight:700,letterSpacing:-0.3}}>{current.album}</div>
          <div style={{color:"rgba(0,0,0,0.45)",fontSize:12,marginTop:3}}>
            {current.artist}
            <span style={{marginLeft:8,background:"rgba(0,0,0,0.08)",borderRadius:8,
              padding:"1px 8px",fontSize:10,fontWeight:600,letterSpacing:0.6,color:"rgba(0,0,0,0.5)"}}>
              {current.genre}
            </span>
          </div>
        </div>
      )}
      <DotBar total={albums.length} active={active} snapTo={snapTo}/>
    </>
  );
}

// ─── Artist list ──────────────────────────────────────────────────────────────
function ArtistList({ albums, onSelect }) {
  const artists=useMemo(()=>{
    const map={};
    albums.forEach(a=>{(map[a.artist]=map[a.artist]||[]).push(a);});
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
      .map(([name,albs])=>({name,albums:albs}));
  },[albums]);

  if (!artists.length)
    return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
      color:"rgba(0,0,0,0.3)",fontSize:14}}>アーティストがありません</div>;

  return (
    <div style={{flex:1,overflowY:"auto",padding:"8px 18px 24px",scrollbarWidth:"none"}}>
      {artists.map(a=>(
        <div key={a.name} onClick={()=>onSelect(a)}
          style={{display:"flex",alignItems:"center",gap:14,padding:"11px 14px",marginBottom:6,
            borderRadius:12,background:"rgba(255,255,255,0.45)",
            border:"1px solid rgba(255,255,255,0.7)",backdropFilter:"blur(8px)",
            cursor:"pointer",transition:"background 0.13s",
            boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.65)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.45)"}
        >
          <div style={{position:"relative",width:54,height:54,flexShrink:0}}>
            {a.albums.slice(0,3).reverse().map((al,i)=>(
              <div key={al.id} style={{
                position:"absolute",left:i*5,top:i*4,width:54-i*5,height:54-i*4,
                borderRadius:6,overflow:"hidden",background:al.color||"#222",
                border:"1px solid rgba(255,255,255,0.15)",boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
              }}>
                {al.artwork
                  ? <img src={al.artwork} alt="" draggable={false}
                      style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <div style={{width:"100%",height:"100%",background:al.color||"#333"}}/>
                }
              </div>
            ))}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#1c1c1e",fontSize:15,fontWeight:600,letterSpacing:-0.2,
              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</div>
            <div style={{color:"rgba(0,0,0,0.4)",fontSize:12,marginTop:2}}>
              {a.albums.length}枚 · {[...new Set(a.albums.map(x=>x.genre))].join("、")}
            </div>
          </div>
          <div style={{color:"rgba(0,0,0,0.2)",fontSize:20}}>›</div>
        </div>
      ))}
    </div>
  );
}

function ArtistDetail({ artist, onBack }) {
  const ITEM_W=200, STEP=222;
  const cf=useCoverFlow(artist.albums.length,STEP);
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 20px 4px",zIndex:10,position:"relative"}}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.8)",
          color:"#1c1c1e",borderRadius:20,padding:"5px 14px",fontSize:12,cursor:"pointer",
          backdropFilter:"blur(8px)",
        }}>‹ 戻る</button>
        <div style={{color:"#1c1c1e",fontSize:15,fontWeight:700}}>{artist.name}</div>
        <div style={{color:"rgba(0,0,0,0.35)",fontSize:12}}>{artist.albums.length}枚</div>
      </div>
      <CoverFlowStage
        albums={artist.albums} ITEM_W={ITEM_W} STEP={STEP}
        containerRef={cf.containerRef} disp={cf.disp} active={cf.active} snapTo={cf.snapTo}
        onMouseDown={cf.onMouseDown} onMouseMove={cf.onMouseMove} onMouseUp={cf.onMouseUp}
      />
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────
// 外部API不使用・完全ローカル動作
// アーティスト名・アルバム名・ジャンルを手入力 + 画像ファイル選択
function AddModal({ onClose, onAdd }) {
  const [artist,  setArtist] = useState("");
  const [album,   setAlbum]  = useState("");
  const [genre,   setGenre]  = useState("Rock");
  const [artwork, setArtwork]= useState(null); // objectURL
  const [artName, setArtName]= useState("");
  const fileRef = useRef(null);

  const IS = {
    width:"100%", background:"rgba(255,255,255,0.82)",
    border:"1px solid rgba(0,0,0,0.13)", borderRadius:10,
    padding:"11px 14px", color:"#1c1c1e", fontSize:15,
    boxSizing:"border-box", outline:"none", fontFamily:"inherit",
  };
  const LS = {
    color:"rgba(0,0,0,0.4)", fontSize:10, marginBottom:6,
    letterSpacing:1.2, textTransform:"uppercase", display:"block",
  };

  const handleFile = (file) => {
    if (!file) return;
    setArtwork(URL.createObjectURL(file));
    setArtName(file.name);
  };

  const handleAdd = () => {
    if (!artist.trim() || !album.trim()) return;
    onAdd({ artist, album, genre, artwork, color: randomColor() });
    onClose();
  };

  const canAdd = artist.trim() && album.trim();

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(140,140,148,0.55)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(22px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"rgba(246,246,250,0.98)", border:"1px solid rgba(255,255,255,0.92)",
        borderRadius:22, padding:28, width:350, maxWidth:"92vw",
        boxShadow:"0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <h2 style={{margin:"0 0 22px", color:"#1c1c1e", fontSize:18, fontWeight:600}}>
          アルバムを追加
        </h2>

        {/* アーティスト */}
        <div style={{marginBottom:14}}>
          <span style={LS}>アーティスト名</span>
          <input
            value={artist} onChange={e => setArtist(e.target.value)}
            placeholder="例: Miles Davis" style={IS} autoFocus
            onKeyDown={e => e.key === "Enter" && document.getElementById("mr-album-input")?.focus()}
          />
        </div>

        {/* アルバム名 */}
        <div style={{marginBottom:14}}>
          <span style={LS}>アルバム名</span>
          <input
            id="mr-album-input"
            value={album} onChange={e => setAlbum(e.target.value)}
            placeholder="例: Kind of Blue" style={IS}
          />
        </div>

        {/* ジャンル */}
        <div style={{marginBottom:18}}>
          <span style={LS}>ジャンル</span>
          <select value={genre} onChange={e => setGenre(e.target.value)}
            style={{...IS, appearance:"none", WebkitAppearance:"none", cursor:"pointer"}}>
            {GENRES.filter(g => g !== "All").map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* ジャケット画像 */}
        <div style={{marginBottom:24}}>
          <span style={LS}>ジャケット画像（任意）</span>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
            onChange={e => handleFile(e.target.files[0])} />

          {artwork ? (
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <img src={artwork} alt="" style={{
                width:64, height:64, objectFit:"cover", borderRadius:8, flexShrink:0,
                boxShadow:"0 3px 12px rgba(0,0,0,0.2)",
              }}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{
                  color:"rgba(0,0,0,0.5)", fontSize:11, marginBottom:7,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>{artName}</div>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding:"6px 14px", background:"rgba(0,0,0,0.06)",
                  border:"1px solid rgba(0,0,0,0.13)", borderRadius:8,
                  fontSize:12, cursor:"pointer", color:"#1c1c1e",
                }}>変更</button>
                <button onClick={() => { setArtwork(null); setArtName(""); }} style={{
                  marginLeft:8, padding:"6px 14px", background:"transparent",
                  border:"1px solid rgba(0,0,0,0.1)", borderRadius:8,
                  fontSize:12, cursor:"pointer", color:"rgba(0,0,0,0.4)",
                }}>削除</button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{
              width:"100%", padding:"14px",
              background:"rgba(0,0,0,0.03)", border:"2px dashed rgba(0,0,0,0.14)",
              borderRadius:12, color:"rgba(0,0,0,0.38)", fontSize:14,
              cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", gap:8,
            }}>
              <span style={{fontSize:20}}>🖼</span>
              画像ファイルを選択
            </button>
          )}
        </div>

        {/* ボタン */}
        <div style={{display:"flex", gap:10}}>
          <button onClick={onClose} style={{
            flex:1, padding:"12px", background:"rgba(0,0,0,0.05)",
            border:"1px solid rgba(0,0,0,0.1)", borderRadius:11,
            color:"rgba(0,0,0,0.5)", cursor:"pointer", fontSize:14,
          }}>キャンセル</button>
          <button onClick={handleAdd} disabled={!canAdd} style={{
            flex:2, padding:"12px",
            background: canAdd ? "#1c1c1e" : "rgba(0,0,0,0.06)",
            border:"none", borderRadius:11,
            color: canAdd ? "#fff" : "rgba(0,0,0,0.22)",
            cursor: canAdd ? "pointer" : "default",
            fontSize:15, fontWeight:600,
          }}>追加</button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [albums,    setAlbums]    = useState(()=>SEED.map(a=>({...a,artwork:null})));
  const [tab,       setTab]       = useState("album");
  const [genre,     setGenre]     = useState("All");
  const [showAdd,   setShowAdd]   = useState(false);
  const [selArtist, setSelArtist] = useState(null);

  // アートワークはユーザーが追加時に設定する（外部API不使用）

  const visible=genre==="All"?albums:albums.filter(a=>a.genre===genre);
  const ITEM_W=220, STEP=242;
  const cf=useCoverFlow(visible.length,STEP);

  return (
    <div style={{
      width:"100vw",height:"100vh",overflow:"hidden",
      display:"flex",flexDirection:"column",
      background:"linear-gradient(160deg,#d4d4d8 0%,#b8b8be 30%,#a8a8b0 55%,#bcbcc4 80%,#d0d0d6 100%)",
      userSelect:"none",
      fontFamily:"-apple-system,'Helvetica Neue',sans-serif",
    }}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,
        backgroundImage:`repeating-linear-gradient(90deg,transparent 0px,rgba(255,255,255,0.03) 1px,transparent 2px,transparent 4px)`}}/>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,
        background:"radial-gradient(ellipse 120% 100% at 50% 0%,rgba(255,255,255,0.18) 0%,transparent 65%)"}}/>

      {/* Header */}
      <div style={{position:"relative",zIndex:20,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"14px 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <RecordLogo size={30}/>
          <span style={{color:"#1c1c1e",fontSize:17,fontWeight:700,letterSpacing:-0.5}}>My Records</span>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.4)",borderRadius:22,padding:3,
          border:"1px solid rgba(255,255,255,0.7)",backdropFilter:"blur(8px)"}}>
          {[{id:"album",l:"アルバム"},{id:"artist",l:"アーティスト"}].map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setSelArtist(null);}} style={{
              padding:"5px 16px",borderRadius:18,border:"none",
              background:tab===t.id?"rgba(255,255,255,0.8)":"transparent",
              color:tab===t.id?"#1c1c1e":"rgba(0,0,0,0.4)",
              fontSize:12,cursor:"pointer",fontWeight:tab===t.id?600:400,transition:"all 0.15s",
              boxShadow:tab===t.id?"0 1px 3px rgba(0,0,0,0.12)":"none",
            }}>{t.l}</button>
          ))}
        </div>
        <button onClick={()=>setShowAdd(true)} style={{
          width:34,height:34,borderRadius:"50%",
          background:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.8)",
          color:"#1c1c1e",fontSize:20,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,
          backdropFilter:"blur(8px)",boxShadow:"0 1px 4px rgba(0,0,0,0.12)",
        }}>+</button>
      </div>

      {/* Genre chips */}
      <div style={{position:"relative",zIndex:20,display:"flex",gap:7,padding:"10px 20px",
        overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {GENRES.map(g=>(
          <button key={g} onClick={()=>setGenre(g)} style={{
            padding:"4px 13px",borderRadius:14,border:"none",whiteSpace:"nowrap",
            background:genre===g?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.3)",
            outline:genre===g?"1px solid rgba(255,255,255,0.9)":"none",
            color:genre===g?"#1c1c1e":"rgba(0,0,0,0.4)",
            fontSize:11,cursor:"pointer",fontWeight:genre===g?700:400,
            letterSpacing:0.4,transition:"all 0.14s",backdropFilter:"blur(4px)",
            boxShadow:genre===g?"0 1px 4px rgba(0,0,0,0.1)":"none",
          }}>{g}</button>
        ))}
      </div>

      {/* Content */}
      {tab==="album" && (
        <CoverFlowStage
          albums={visible} ITEM_W={ITEM_W} STEP={STEP}
          containerRef={cf.containerRef} disp={cf.disp} active={cf.active} snapTo={cf.snapTo}
          onMouseDown={cf.onMouseDown} onMouseMove={cf.onMouseMove} onMouseUp={cf.onMouseUp}
        />
      )}
      {tab==="artist" && !selArtist && (
        <ArtistList albums={visible} onSelect={setSelArtist}/>
      )}
      {tab==="artist" && selArtist && (
        <ArtistDetail artist={selArtist} onBack={()=>setSelArtist(null)}/>
      )}

      {/* Bottom bar */}
      <div style={{position:"relative",zIndex:20,display:"flex",alignItems:"center",
        justifyContent:"center",gap:12,padding:"4px 20px 18px"}}>
        <button onClick={()=>{
          if(tab!=="album") return;
          const id=visible[cf.active]?.id;
          if(id) setAlbums(p=>p.filter(a=>a.id!==id));
        }} style={{padding:"7px 18px",borderRadius:18,
          background:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.7)",
          color:"#c0392b",fontSize:12,cursor:"pointer",letterSpacing:0.3,backdropFilter:"blur(8px)"}}>
          🗑 削除
        </button>
        <div style={{padding:"7px 18px",borderRadius:18,
          background:"rgba(255,255,255,0.35)",border:"1px solid rgba(255,255,255,0.6)",
          color:"rgba(0,0,0,0.4)",fontSize:12,backdropFilter:"blur(8px)"}}>
          {albums.length} 枚
        </div>
      </div>

      {showAdd && (
        <AddModal onClose={()=>setShowAdd(false)}
          onAdd={a=>setAlbums(p=>[...p,{...a,id:Date.now()}])}/>
      )}

      <style>{`
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        ::-webkit-scrollbar{display:none;}
        button:active{opacity:0.75;}
      `}</style>
    </div>
  );
}
