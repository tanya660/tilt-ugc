import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

// ── Constants ────────────────────────────────────────────────────────────────
const VIDEO_STYLES = ["Talking head","GRWM","Transition","Voice-over + b-roll","POV","Haul / unboxing","Day-in-the-life"];
const HOOK_TEMPLATES = [
  "POV: you discovered Tilt and now you can't stop…",
  "I found the most [CATEGORY] pieces on Tilt",
  "Nobody talks about this — but Tilt has everything",
  "Wait — you're still not on Tilt?",
  "I gave myself a £50 budget on Tilt. Here's what happened.",
  "The honest truth about shopping on Tilt after 30 days",
];
const PLATFORMS  = ["TikTok","Instagram","YouTube","LinkedIn"];
const CATEGORIES = ["Y2K","Vintage","Streetwear","Luxury","—"];
const STATUSES   = ["not started","filming","editing","review","approved","posted"];
const STATUS_COLORS = { "not started":"#666", filming:"#E8C547", editing:"#F4A261", review:"#7EC8E3", approved:"#A8E6CF", posted:"#A8E6CF" };

const REVIEW_CHECKS = [
  { id:"hook_lands",     label:"Hook lands in first 3 seconds",         category:"Hook"       },
  { id:"pattern_int",    label:"Pattern interrupt present",              category:"Hook"       },
  { id:"energy",         label:"Energy is high & engaging",              category:"Delivery"   },
  { id:"face_visible",   label:"Face visible & expressive",              category:"Delivery"   },
  { id:"no_dead_air",    label:"No dead air / awkward pauses",           category:"Delivery"   },
  { id:"speaks_clearly", label:"Speaks clearly — no mumbling",           category:"Delivery"   },
  { id:"lighting_ok",    label:"Lighting clean & flattering",            category:"Production" },
  { id:"audio_clear",    label:"Audio clear — no echo or background",    category:"Production" },
  { id:"broll_good",     label:"B-roll / visuals on point",              category:"Production" },
  { id:"captions",       label:"Captions accurate & well timed",         category:"Production" },
  { id:"tilt_mention",   label:"Tilt mentioned naturally (not ad-read)", category:"Brand"      },
  { id:"tilt_timing",    label:"Tilt mentioned in first third",          category:"Brand"      },
  { id:"cta_clear",      label:"CTA is clear & compelling",              category:"CTA"        },
  { id:"correct_length", label:"Video length is optimal for platform",   category:"CTA"        },
];
const CHECK_CATS   = ["Hook","Delivery","Production","Brand","CTA"];
const CHECK_COLORS = { Hook:"#E8C547", Delivery:"#7EC8E3", Production:"#F4A261", Brand:"#A8E6CF", CTA:"#DDA0DD" };

// ── DB helpers ────────────────────────────────────────────────────────────────
// Convert snake_case DB rows → camelCase app objects
const mapCreator = r => r ? ({
  id: r.id, name: r.name, handle: r.handle, avatar: r.avatar,
  color: r.color, platform: r.platform, status: r.status,
  phone: r.phone||"", email: r.email||"", whatsapp: r.whatsapp||"",
  instagram: r.instagram||"", tiktok: r.tiktok||"",
  category: r.category||"", notes: r.notes||"",
  checkIns: r.check_ins||[],
}) : null;

const mapBrief = r => r ? ({
  id: r.id, title: r.title, product: r.product||"",
  mainBody: r.main_body||"", cta: r.cta||"", keyVisuals: r.key_visuals||"",
  videoStyle: r.video_style||"Talking head",
  inspirationUrl: r.inspiration_url||"", inspirationNote: r.inspiration_note||"",
  hooks: r.hooks||[], active: r.active,
  createdAt: r.created_at,
}) : null;

const mapVideo = r => r ? ({
  id: r.id, briefId: r.brief_id, creatorId: r.creator_id,
  title: r.title||"", hook: r.hook||"", mainBody: r.main_body||"",
  videoStyle: r.video_style||"", status: r.status||"not started",
  date: r.date||"", platform: r.platform||"TikTok",
  notes: r.notes||"", videoUrl: r.video_url||"",
  reviewChecks: r.review_checks||{}, reviewNote: r.review_note||"",
  score: r.score, reviewedAt: r.reviewed_at, liveAt: r.live_at,
}) : null;

const mapTip = r => r ? ({
  id: r.id, title: r.title, category: r.category||"Delivery",
  body: r.body||"", videoUrl: r.video_url||"",
  isLesson: r.is_lesson||false, createdAt: r.created_at,
}) : null;

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,          setView]          = useState("dashboard");
  const [creators,      setCreators]      = useState([]);
  const [briefs,        setBriefs]        = useState([]);
  const [videos,        setVideos]        = useState([]);
  const [tips,          setTips]          = useState([]);
  const [activeBrief,   setActiveBrief]   = useState(null);
  const [reviewing,     setReviewing]     = useState(null);
  const [loaded,        setLoaded]        = useState(false);
  const [toast,         setToast]         = useState(null);

  // Load all data from Supabase on mount
  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: b }, { data: v }, { data: t }] = await Promise.all([
        supabase.from("creators").select("*").order("created_at"),
        supabase.from("briefs").select("*").order("created_at", { ascending: false }),
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("tips").select("*").order("created_at", { ascending: false }),
      ]);
      setCreators((c||[]).map(mapCreator));
      setBriefs((b||[]).map(mapBrief));
      setVideos((v||[]).map(mapVideo));
      setTips((t||[]).map(mapTip));
      setLoaded(true);
    })();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Creator ops ──
  const addCreator = async (data) => {
    const { data: row } = await supabase.from("creators").insert([data]).select().single();
    if (row) setCreators(prev => [...prev, mapCreator(row)]);
  };
  const updateCreator = async (id, patch) => {
    // Convert camelCase patch to snake_case for DB
    const dbPatch = {};
    if (patch.name      !== undefined) dbPatch.name       = patch.name;
    if (patch.handle    !== undefined) dbPatch.handle      = patch.handle;
    if (patch.phone     !== undefined) dbPatch.phone       = patch.phone;
    if (patch.email     !== undefined) dbPatch.email       = patch.email;
    if (patch.whatsapp  !== undefined) dbPatch.whatsapp    = patch.whatsapp;
    if (patch.instagram !== undefined) dbPatch.instagram   = patch.instagram;
    if (patch.tiktok    !== undefined) dbPatch.tiktok      = patch.tiktok;
    if (patch.category  !== undefined) dbPatch.category    = patch.category;
    if (patch.notes     !== undefined) dbPatch.notes       = patch.notes;
    if (patch.status    !== undefined) dbPatch.status      = patch.status;
    if (patch.checkIns  !== undefined) dbPatch.check_ins   = patch.checkIns;
    await supabase.from("creators").update(dbPatch).eq("id", id);
    setCreators(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  // ── Brief ops ──
  const addBrief = async (data) => {
    const dbRow = {
      id: data.id, title: data.title, product: data.product,
      main_body: data.mainBody, cta: data.cta, key_visuals: data.keyVisuals,
      video_style: data.videoStyle, inspiration_url: data.inspirationUrl,
      inspiration_note: data.inspirationNote, hooks: data.hooks, active: data.active,
    };
    const { data: row } = await supabase.from("briefs").insert([dbRow]).select().single();
    if (row) setBriefs(prev => [mapBrief(row), ...prev]);
  };
  const deleteBrief = async (id) => {
    await supabase.from("briefs").delete().eq("id", id);
    setBriefs(prev => prev.filter(b => b.id !== id));
  };

  // ── Video ops ──
  const addVideos = async (newVideos) => {
    const dbRows = newVideos.map(v => ({
      id: v.id, brief_id: v.briefId, creator_id: v.creatorId,
      title: v.title, hook: v.hook, main_body: v.mainBody,
      video_style: v.videoStyle, status: v.status, date: v.date,
      platform: v.platform, notes: v.notes, video_url: v.videoUrl,
      review_checks: v.reviewChecks||{}, review_note: v.reviewNote||"",
    }));
    const { data: rows } = await supabase.from("videos").insert(dbRows).select();
    if (rows) setVideos(prev => [...(rows.map(mapVideo)), ...prev]);
  };
  const updateVideo = async (id, patch) => {
    const dbPatch = {};
    if (patch.status       !== undefined) dbPatch.status        = patch.status;
    if (patch.videoUrl     !== undefined) dbPatch.video_url     = patch.videoUrl;
    if (patch.notes        !== undefined) dbPatch.notes         = patch.notes;
    if (patch.reviewChecks !== undefined) dbPatch.review_checks = patch.reviewChecks;
    if (patch.reviewNote   !== undefined) dbPatch.review_note   = patch.reviewNote;
    if (patch.score        !== undefined) dbPatch.score         = patch.score;
    if (patch.reviewedAt   !== undefined) dbPatch.reviewed_at   = patch.reviewedAt;
    if (patch.liveAt       !== undefined) dbPatch.live_at       = patch.liveAt;
    await supabase.from("videos").update(dbPatch).eq("id", id);
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  };

  // ── Tip ops ──
  const addTip = async (data) => {
    const dbRow = {
      id: data.id, title: data.title, category: data.category,
      body: data.body, video_url: data.videoUrl, is_lesson: data.isLesson,
    };
    const { data: row } = await supabase.from("tips").insert([dbRow]).select().single();
    if (row) setTips(prev => [mapTip(row), ...prev]);
  };
  const deleteTip = async (id) => {
    await supabase.from("tips").delete().eq("id", id);
    setTips(prev => prev.filter(t => t.id !== id));
  };

  const todayStr    = new Date().toISOString().split("T")[0];
  const todayVideos = videos.filter(v => v.date === todayStr);
  const postedToday = todayVideos.filter(v => v.status === "posted").length;
  const totalDue    = creators.filter(c => c.status === "active").length * 5;
  const inProgress  = todayVideos.filter(v => !["not started","posted"].includes(v.status)).length;

  if (!loaded) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Mono',monospace", color:"#E8C547", fontSize:12, letterSpacing:"0.1em", background:"#0A0A0A" }}>
      LOADING…
    </div>
  );

  if (reviewing) {
    const vid = videos.find(v => v.id === reviewing);
    if (!vid) { setReviewing(null); return null; }
    return <ReviewRoom vid={vid} creators={creators} briefs={briefs} updateVideo={updateVideo} onClose={() => setReviewing(null)} showToast={showToast}/>;
  }

  return (
    <div style={{ fontFamily:"'DM Mono','Fira Mono',monospace", background:"#0A0A0A", minHeight:"100vh", color:"#E8E8E0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
        input,textarea,select{background:#111;border:1px solid #2A2A2A;color:#E8E8E0;border-radius:6px;padding:8px 12px;font-family:inherit;font-size:13px;outline:none;width:100%;transition:border-color 0.15s}
        input:focus,textarea:focus,select:focus{border-color:#E8C547}
        button{cursor:pointer;font-family:inherit}
        .nav-btn{background:none;border:none;color:#666;font-size:12px;padding:8px 16px;border-radius:4px;transition:all 0.15s;letter-spacing:0.08em;text-transform:uppercase}
        .nav-btn:hover{color:#E8E8E0;background:#1A1A1A}
        .nav-btn.active{color:#E8C547;background:#1A1A1A}
        .btn-primary{background:#E8C547;color:#0A0A0A;border:none;padding:8px 18px;border-radius:6px;font-weight:500;font-size:13px;transition:opacity 0.15s;cursor:pointer}
        .btn-primary:hover{opacity:0.88}
        .btn-ghost{background:none;border:1px solid #2A2A2A;color:#999;padding:7px 16px;border-radius:6px;font-size:12px;transition:all 0.15s;cursor:pointer}
        .btn-ghost:hover{border-color:#444;color:#E8E8E0}
        .btn-green{background:#1A3A2A;border:1px solid #2A5A3A;color:#A8E6CF;padding:7px 16px;border-radius:6px;font-size:12px;cursor:pointer}
        .btn-green:hover{background:#1F4A35}
        .card{background:#111;border:1px solid #1E1E1E;border-radius:10px;padding:20px}
        .tag{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;letter-spacing:0.04em;background:#1A1A1A;color:#888;border:1px solid #252525}
        .stat-num{font-family:'Archivo Black',sans-serif;font-size:36px;line-height:1}
        .field-label{font-size:10px;color:#555;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        .fade{animation:fadeUp 0.2s ease both}
      `}</style>

      <div style={{ borderBottom:"1px solid #1A1A1A", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, background:"#0A0A0A", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          <span style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:15, color:"#E8C547", letterSpacing:"-0.02em" }}>UGC OS</span>
          <div style={{ display:"flex", gap:2 }}>
            {[["dashboard","Dashboard"],["briefs","Briefs"],["board","Video Board"],["creators","Creators"],["strategy","Strategy"]].map(([v,l]) => (
              <button key={v} className={`nav-btn${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <span style={{ fontSize:12, color:"#444" }}>{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</span>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>
        {view==="dashboard" && <Dashboard creators={creators} videos={videos} briefs={briefs} totalDue={totalDue} postedToday={postedToday} inProgress={inProgress} todayVideos={todayVideos} todayStr={todayStr} setView={setView} setReviewing={setReviewing}/>}
        {view==="briefs"    && <Briefs briefs={briefs} addBrief={addBrief} deleteBrief={deleteBrief} creators={creators} addVideos={addVideos} showToast={showToast} activeBrief={activeBrief} setActiveBrief={setActiveBrief}/>}
        {view==="board"     && <VideoBoard videos={videos} updateVideo={updateVideo} creators={creators} briefs={briefs} showToast={showToast} setReviewing={setReviewing}/>}
        {view==="creators"  && <Creators creators={creators} addCreator={addCreator} updateCreator={updateCreator} videos={videos} showToast={showToast}/>}
        {view==="strategy"  && <Strategy creators={creators} videos={videos} briefs={briefs} tips={tips} addTip={addTip} deleteTip={deleteTip} showToast={showToast}/>}
      </div>

      {toast && <div style={{ position:"fixed", bottom:24, right:24, background:"#E8C547", color:"#0A0A0A", padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:500, zIndex:999 }}>{toast}</div>}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ creators, videos, briefs, totalDue, postedToday, inProgress, todayVideos, setView, setReviewing }) {
  const activeBriefs  = briefs.filter(b => b.active);
  const completion    = totalDue > 0 ? Math.round((postedToday/totalDue)*100) : 0;
  const pendingReview = todayVideos.filter(v => v.status === "review");

  return (
    <div className="fade">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:28, letterSpacing:"-0.03em" }}>
          Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"} 👋
        </h1>
        <p style={{ color:"#666", fontSize:13, marginTop:4 }}>Here's your content pipeline for today.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Posted today",   val:postedToday,       sub:`of ${totalDue} due`,   accent:"#A8E6CF" },
          { label:"In progress",    val:inProgress,        sub:"filming / editing",    accent:"#E8C547" },
          { label:"Pending review", val:pendingReview.length, sub:"need your eyes",    accent:"#F4A261" },
          { label:"Completion",     val:`${completion}%`,  sub:"daily target",         accent:"#7EC8E3" },
        ].map(s => (
          <div key={s.label} className="card">
            <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{s.label}</div>
            <div className="stat-num" style={{ color:s.accent }}>{s.val}</div>
            <div style={{ fontSize:11, color:"#444", marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:16 }}>Creator progress — today</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {creators.filter(c => c.status==="active").map(cr => {
            const mine   = todayVideos.filter(v => v.creatorId===cr.id);
            const posted = mine.filter(v => v.status==="posted").length;
            const pct    = Math.round((posted/5)*100);
            return (
              <div key={cr.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:cr.color+"22", border:`1px solid ${cr.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr.color, flexShrink:0 }}>{cr.avatar}</div>
                <div style={{ fontSize:13, color:"#ccc", minWidth:100 }}>{cr.name}</div>
                <div style={{ flex:1, height:4, background:"#1A1A1A", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:cr.color, borderRadius:2, transition:"width 0.4s" }}/>
                </div>
                <div style={{ fontSize:12, color:"#555", minWidth:40, textAlign:"right" }}>{posted}/5</div>
                <div style={{ display:"flex", gap:4 }}>
                  {[0,1,2,3,4].map(i => { const vid=mine[i]; return <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:vid?STATUS_COLORS[vid.status]:"#1E1E1E", border:"1px solid #2A2A2A" }} title={vid?.status||"not assigned"}/>; })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingReview.length > 0 && (
        <div className="card" style={{ marginBottom:16, borderColor:"#F4A26133" }}>
          <div style={{ fontSize:11, color:"#F4A261", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>Needs your review now</div>
          {pendingReview.map(vid => {
            const cr = creators.find(c => c.id===vid.creatorId);
            return (
              <div key={vid.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #1A1A1A" }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:cr?.color+"22", border:`1px solid ${cr?.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:cr?.color }}>{cr?.avatar}</div>
                <span style={{ fontSize:13, color:"#E8E8E0", flex:1 }}>{vid.hook}</span>
                <span style={{ fontSize:11, color:"#555" }}>{cr?.name}</span>
                <button className="btn-primary" style={{ fontSize:11, padding:"5px 12px" }} onClick={() => setReviewing(vid.id)}>Review →</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div className="card" style={{ cursor:"pointer" }} onClick={() => setView("briefs")}>
          <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Active briefs</div>
          {activeBriefs.length===0 ? <p style={{color:"#444",fontSize:13}}>No active briefs — create one</p> : activeBriefs.slice(0,3).map(b => (
            <div key={b.id} style={{ padding:"8px 0", borderBottom:"1px solid #1A1A1A", fontSize:13 }}>
              <span style={{color:"#E8E8E0"}}>{b.title}</span>
              <span style={{color:"#444",marginLeft:8,fontSize:11}}>{b.hooks?.length||0} hooks</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ cursor:"pointer" }} onClick={() => setView("board")}>
          <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Video pipeline today</div>
          {Object.entries(STATUS_COLORS).map(([status,color]) => {
            const count = todayVideos.filter(v => v.status===status).length;
            return count>0 ? (
              <div key={status} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:13}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
                <span style={{color:"#888",textTransform:"capitalize"}}>{status}</span>
                <span style={{marginLeft:"auto",color:"#E8E8E0"}}>{count}</span>
              </div>
            ) : null;
          })}
          {todayVideos.length===0 && <p style={{color:"#444",fontSize:13}}>No videos assigned today</p>}
        </div>
      </div>
    </div>
  );
}

// ── Briefs ────────────────────────────────────────────────────────────────────
function Briefs({ briefs, addBrief, deleteBrief, creators, addVideos, showToast, activeBrief, setActiveBrief }) {
  const [showForm,    setShowForm]    = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [form, setForm] = useState({ title:"", product:"", mainBody:"", cta:"", keyVisuals:"", videoStyle:"Talking head", inspirationUrl:"", inspirationNote:"", hooks:["","","","",""], active:true });

  const createBrief = async () => {
    if (!form.title) return;
    const brief = { ...form, id: Date.now().toString(), createdAt: new Date().toISOString(), hooks: form.hooks.filter(Boolean) };
    await addBrief(brief);
    setShowForm(false);
    setForm({ title:"", product:"", mainBody:"", cta:"", keyVisuals:"", videoStyle:"Talking head", inspirationUrl:"", inspirationNote:"", hooks:["","","","",""], active:true });
    showToast("Brief created ✓");
  };

  const assignBrief = async (brief, creatorId, date) => {
    const creator = creators.find(c => c.id===creatorId);
    const newVideos = brief.hooks.slice(0,5).map((hook,i) => ({
      id: `${Date.now()}-${i}`, briefId: brief.id, creatorId,
      title: `${brief.title} — ${creator?.name}`, hook: hook||`Hook ${i+1}`,
      mainBody: brief.mainBody, videoStyle: brief.videoStyle,
      status: "not started", date: date||new Date().toISOString().split("T")[0],
      platform: creator?.platform||"TikTok", notes:"", videoUrl:"", reviewChecks:{}, reviewNote:"",
    }));
    while (newVideos.length < 5) newVideos.push({ ...newVideos[0], id:`${Date.now()}-x${newVideos.length}`, hook:`Variation ${newVideos.length+1}` });
    await addVideos(newVideos.slice(0,5));
    setAssignModal(null);
    showToast(`Assigned 5 videos to ${creator?.name} ✓`);
  };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:22, letterSpacing:"-0.02em" }}>Content Briefs</h2><p style={{ color:"#555", fontSize:12, marginTop:3 }}>Create briefs with hooks, body, visuals — assign to creators</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New Brief</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20, borderColor:"#E8C54733" }}>
          <div style={{ fontSize:12, color:"#E8C547", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:16 }}>New brief</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div><div className="field-label">Brief title</div><input placeholder="e.g. Y2K week" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))}/></div>
            <div><div className="field-label">Product / category</div><input placeholder="e.g. Y2K finds on Tilt" value={form.product} onChange={e => setForm(f => ({...f,product:e.target.value}))}/></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div><div className="field-label">Video style</div><select value={form.videoStyle} onChange={e => setForm(f => ({...f,videoStyle:e.target.value}))}>{VIDEO_STYLES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><div className="field-label">Inspiration link</div><input placeholder="https://tiktok.com/@… or instagram.com/p/…" value={form.inspirationUrl} onChange={e => setForm(f => ({...f,inspirationUrl:e.target.value}))}/></div>
          </div>
          {form.inspirationUrl && <div style={{ marginBottom:12 }}><div className="field-label">What to take from this</div><input placeholder="e.g. Match this energy, replicate hook style…" value={form.inspirationNote} onChange={e => setForm(f => ({...f,inspirationNote:e.target.value}))}/></div>}
          <div style={{ marginBottom:12 }}><div className="field-label">Main body script</div><textarea rows={4} placeholder="Core script — include where Tilt gets mentioned…" value={form.mainBody} onChange={e => setForm(f => ({...f,mainBody:e.target.value}))} style={{resize:"vertical"}}/></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div><div className="field-label">CTA</div><input placeholder="e.g. Link in bio — search Tilt now" value={form.cta} onChange={e => setForm(f => ({...f,cta:e.target.value}))}/></div>
            <div><div className="field-label">Key visuals / b-roll</div><input placeholder="e.g. Close-up of item, mirror shot" value={form.keyVisuals} onChange={e => setForm(f => ({...f,keyVisuals:e.target.value}))}/></div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div className="field-label" style={{ marginBottom:0 }}>Hooks (5 variations)</div>
              <button className="btn-ghost" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => setForm(f => ({...f,hooks:HOOK_TEMPLATES.slice(0,5)}))}>Auto-fill</button>
            </div>
            {form.hooks.map((h,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ fontSize:11, color:"#555", minWidth:20 }}>H{i+1}</div>
                <input placeholder={`Hook ${i+1} — first 3 seconds…`} value={h} onChange={e => { const hooks=[...form.hooks]; hooks[i]=e.target.value; setForm(f => ({...f,hooks})); }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn-primary" onClick={createBrief}>Save brief</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {briefs.length===0 && <div style={{ color:"#444", fontSize:14, textAlign:"center", padding:"40px 0" }}>No briefs yet.</div>}
        {briefs.map(b => (
          <div key={b.id} className="card" style={{ cursor:"pointer", borderColor:activeBrief?.id===b.id?"#E8C54755":"#1E1E1E" }} onClick={() => setActiveBrief(activeBrief?.id===b.id?null:b)}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:500, fontSize:14, color:"#E8E8E0" }}>{b.title}</span>
                  {b.product && <span className="tag">{b.product}</span>}
                  {b.videoStyle && <span className="tag" style={{ color:"#7EC8E3", borderColor:"#7EC8E333" }}>{b.videoStyle}</span>}
                  <span className="tag" style={{ color:b.active?"#A8E6CF":"#666" }}>{b.active?"active":"inactive"}</span>
                </div>
                <div style={{ fontSize:12, color:"#555" }}>{b.hooks?.length||0} hooks · {new Date(b.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button className="btn-ghost" style={{ fontSize:11 }} onClick={e => { e.stopPropagation(); setAssignModal(b); }}>Assign →</button>
                <button className="btn-ghost" style={{ fontSize:11, color:"#555" }} onClick={e => { e.stopPropagation(); deleteBrief(b.id); }}>Delete</button>
              </div>
            </div>
            {activeBrief?.id===b.id && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #1A1A1A" }}>
                {b.inspirationUrl && <div style={{ marginBottom:14, padding:"10px 12px", background:"#0D0D0D", borderRadius:8, border:"1px solid #1A1A1A" }}><div className="field-label">Inspiration</div><a href={b.inspirationUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#7EC8E3", textDecoration:"none" }}>{b.inspirationUrl}</a>{b.inspirationNote && <div style={{ fontSize:12, color:"#888", marginTop:4 }}>{b.inspirationNote}</div>}</div>}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                  <div><div style={{ fontSize:11, color:"#555", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Main body</div><div style={{ fontSize:13, color:"#999", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{b.mainBody||"—"}</div></div>
                  <div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>Style</div><div style={{ fontSize:13, color:"#7EC8E3", marginBottom:10 }}>{b.videoStyle||"—"}</div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>CTA</div><div style={{ fontSize:13, color:"#999", marginBottom:10 }}>{b.cta||"—"}</div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>Key visuals</div><div style={{ fontSize:13, color:"#999" }}>{b.keyVisuals||"—"}</div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:"#555", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Hooks</div>
                {(b.hooks||[]).map((h,i) => <div key={i} style={{ display:"flex", gap:10, marginBottom:6 }}><span style={{ fontSize:11, color:"#E8C547", minWidth:20 }}>H{i+1}</span><span style={{ fontSize:13, color:"#ccc", lineHeight:1.5 }}>{h}</span></div>)}
              </div>
            )}
          </div>
        ))}
      </div>
      {assignModal && <AssignModal brief={assignModal} creators={creators} onAssign={assignBrief} onClose={() => setAssignModal(null)}/>}
    </div>
  );
}

function AssignModal({ brief, creators, onAssign, onClose }) {
  const [creatorId, setCreatorId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div className="card" style={{ width:400, borderColor:"#2A2A2A" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:16, marginBottom:16 }}>Assign brief</div>
        <div style={{ fontSize:13, color:"#888", marginBottom:4 }}>{brief.title}</div>
        {brief.videoStyle && <div style={{ fontSize:12, color:"#7EC8E3", marginBottom:16 }}>Style: {brief.videoStyle}</div>}
        <div style={{ marginBottom:12 }}><div className="field-label">Creator</div><select value={creatorId} onChange={e => setCreatorId(e.target.value)}><option value="">— Choose —</option>{creators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}</select></div>
        <div style={{ marginBottom:20 }}><div className="field-label">Due date</div><input type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
        <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={() => creatorId && onAssign(brief,creatorId,date)} style={{ opacity:creatorId?1:0.5 }}>Assign 5 videos</button><button className="btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ── Video Board ───────────────────────────────────────────────────────────────
function VideoBoard({ videos, updateVideo, creators, briefs, showToast, setReviewing }) {
  const [filter,     setFilter]     = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [editingId,  setEditingId]  = useState(null);

  const filtered = videos.filter(v => {
    if (filter !== "all" && v.creatorId !== filter) return false;
    if (dateFilter && v.date !== dateFilter) return false;
    return true;
  });
  const grouped = STATUSES.reduce((acc,s) => { acc[s]=filtered.filter(v => v.status===s); return acc; }, {});

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div><h2 style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:22, letterSpacing:"-0.02em" }}>Video Board</h2><p style={{ fontSize:12, color:"#555", marginTop:3 }}>Track every video from brief to posted</p></div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width:"auto" }}/>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:"auto" }}><option value="all">All creators</option>{creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn-ghost" onClick={() => setDateFilter("")} style={{ fontSize:11 }}>All dates</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {STATUSES.map(status => (
          <div key={status} style={{ background:"#0D0D0D", border:"1px solid #181818", borderRadius:8, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:STATUS_COLORS[status] }}/>
              <span style={{ fontSize:11, color:"#888", textTransform:"capitalize", letterSpacing:"0.06em" }}>{status}</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:"#444" }}>{grouped[status]?.length||0}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(grouped[status]||[]).map(vid => {
                const creator = creators.find(c => c.id===vid.creatorId);
                const brief   = briefs.find(b => b.id===vid.briefId);
                const isEditing = editingId===vid.id;
                return (
                  <div key={vid.id} className="card" style={{ padding:12, borderColor:isEditing?"#E8C54744":"#1A1A1A" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:creator?.color+"22", border:`1px solid ${creator?.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:creator?.color }}>{creator?.avatar}</div>
                      <span style={{ fontSize:11, color:"#888" }}>{creator?.name}</span>
                      <span className="tag" style={{ marginLeft:"auto", fontSize:10 }}>{vid.platform}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#E8E8E0", marginBottom:4, lineHeight:1.4 }}>{vid.hook}</div>
                    {vid.videoStyle && <div style={{ fontSize:10, color:"#7EC8E3", marginBottom:4 }}>{vid.videoStyle}</div>}
                    {brief && <div style={{ fontSize:10, color:"#444", marginBottom:8 }}>{brief.title}</div>}
                    {isEditing ? (
                      <div>
                        <div style={{ marginBottom:6 }}><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Status</div><select value={vid.status} onChange={e => updateVideo(vid.id,{status:e.target.value})} style={{ fontSize:11 }}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div style={{ marginBottom:6 }}><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Video / Drive link</div><input placeholder="https://…" value={vid.videoUrl||""} onChange={e => updateVideo(vid.id,{videoUrl:e.target.value})} style={{ fontSize:11 }}/></div>
                        <div style={{ marginBottom:8 }}><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Notes</div><textarea rows={2} value={vid.notes||""} onChange={e => updateVideo(vid.id,{notes:e.target.value})} style={{ fontSize:11, resize:"none" }}/></div>
                        <button className="btn-ghost" style={{ fontSize:10, padding:"4px 10px" }} onClick={() => { setEditingId(null); showToast("Saved ✓"); }}>Done</button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        <button className="btn-ghost" style={{ fontSize:10, padding:"3px 8px", flex:1 }} onClick={() => setEditingId(vid.id)}>Edit</button>
                        {status==="review" && <button className="btn-primary" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => setReviewing(vid.id)}>Review →</button>}
                        <select value={vid.status} onChange={e => { updateVideo(vid.id,{status:e.target.value}); showToast("Updated ✓"); }} style={{ fontSize:10, padding:"3px 6px", width:"auto", flex:1 }}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                      </div>
                    )}
                  </div>
                );
              })}
              {(grouped[status]||[]).length===0 && <div style={{ fontSize:11, color:"#333", textAlign:"center", padding:"12px 0" }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Review Room ───────────────────────────────────────────────────────────────
function ReviewRoom({ vid, creators, briefs, updateVideo, onClose, showToast }) {
  const cr    = creators.find(c => c.id===vid.creatorId);
  const brief = briefs.find(b => b.id===vid.briefId);
  const [checks,     setChecks]     = useState(vid.reviewChecks||{});
  const [reviewNote, setReviewNote] = useState(vid.reviewNote||"");
  const [driveUrl,   setDriveUrl]   = useState(vid.videoUrl||"");
  const [decision,   setDecision]   = useState(null);

  const passCount = REVIEW_CHECKS.filter(c => checks[c.id]===true).length;
  const failCount = REVIEW_CHECKS.filter(c => checks[c.id]===false).length;
  const score = Math.round((passCount/REVIEW_CHECKS.length)*100);
  const toggleCheck = (id,val) => setChecks(prev => ({...prev,[id]:prev[id]===val?undefined:val}));

  const handleDecision = async (type) => {
    const status = type==="approve" ? "approved" : "needs_revision";
    await updateVideo(vid.id, { status, reviewChecks:checks, reviewNote, videoUrl:driveUrl, reviewedAt:new Date().toISOString(), score });
    setDecision(type);
    showToast(type==="approve" ? "Approved ✓" : "Revision requested ✓");
  };

  const failedLabels = REVIEW_CHECKS.filter(c => checks[c.id]===false).map(c => `✗ ${c.label}`);
  const slackMsg = decision==="approve"
    ? `✅ *${vid.hook}* — APPROVED\nCreator: ${cr?.name} (${cr?.handle})\nScore: ${score}/100\nReady to post. Tag @tilt_brand.${reviewNote?"\n\n"+reviewNote:""}`
    : `🔄 *${vid.hook}* — NEEDS REVISION\nCreator: ${cr?.name}\nScore: ${score}/100\n\n${failedLabels.join("\n")}${reviewNote?"\n\nNotes: "+reviewNote:""}`;

  return (
    <div style={{ fontFamily:"'DM Mono','Fira Mono',monospace", background:"#0A0A0A", minHeight:"100vh", color:"#E8E8E0" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,textarea,select{background:#111;border:1px solid #2A2A2A;color:#E8E8E0;border-radius:6px;padding:8px 12px;font-family:inherit;font-size:12px;outline:none;width:100%}input:focus,textarea:focus{border-color:#E8C547}.btn-primary{background:#E8C547;color:#0A0A0A;border:none;padding:8px 18px;border-radius:6px;font-weight:500;font-size:12px;cursor:pointer}.btn-ghost{background:none;border:1px solid #2A2A2A;color:#999;padding:7px 16px;border-radius:6px;font-size:11px;cursor:pointer}.btn-ghost:hover{border-color:#444;color:#E8E8E0}.btn-danger{background:none;border:1px solid #5A2020;color:#E05555;padding:7px 16px;border-radius:6px;font-size:11px;cursor:pointer}.btn-green{background:#1A3A2A;border:1px solid #2A5A3A;color:#A8E6CF;padding:7px 16px;border-radius:6px;font-size:11px;cursor:pointer}`}</style>
      <div style={{ borderBottom:"1px solid #1C1C1C", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:52, background:"#0A0A0A", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button className="btn-ghost" onClick={onClose}>← Back</button>
          <div style={{ width:1, height:20, background:"#1C1C1C" }}/>
          <div style={{ width:28, height:28, borderRadius:"50%", background:cr?.color+"22", border:`1px solid ${cr?.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr?.color }}>{cr?.avatar}</div>
          <div><span style={{ fontSize:13, color:"#E8E8E0", fontWeight:500 }}>{vid.hook}</span><span style={{ fontSize:10, color:"#444", marginLeft:8 }}>{cr?.name}</span></div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ position:"relative", width:40, height:40 }}>
            <svg width="40" height="40" style={{ transform:"rotate(-90deg)" }}><circle cx="20" cy="20" r="15" fill="none" stroke="#1A1A1A" strokeWidth="3"/><circle cx="20" cy="20" r="15" fill="none" stroke={score>=80?"#A8E6CF":score>=50?"#E8C547":"#E05555"} strokeWidth="3" strokeDasharray={`${(score/100)*94} 94`} strokeLinecap="round"/></svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:score>=80?"#A8E6CF":score>=50?"#E8C547":"#E05555", fontWeight:500 }}>{score}</div>
          </div>
          {!decision && <><button className="btn-danger" onClick={() => handleDecision("revision")}>Request revision</button><button className="btn-green" onClick={() => handleDecision("approve")}>Approve ✓</button></>}
          {decision && <span style={{ fontSize:12, padding:"4px 12px", borderRadius:100, background:decision==="approve"?"#1A3A2A":"#3A1A1A", color:decision==="approve"?"#A8E6CF":"#E05555" }}>{decision==="approve"?"Approved":"Revision sent"}</span>}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", minHeight:"calc(100vh - 52px)" }}>
        <div style={{ padding:24, borderRight:"1px solid #141414", overflowY:"auto" }}>
          {brief && <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:8, padding:"10px 14px", marginBottom:14 }}><div style={{ fontSize:10, color:"#555", marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>Brief</div><div style={{ fontSize:12, color:"#888" }}>{brief.title}</div>{brief.videoStyle && <div style={{ fontSize:11, color:"#7EC8E3", marginTop:2 }}>Style: {brief.videoStyle}</div>}{brief.inspirationUrl && <a href={brief.inspirationUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#7EC8E366", textDecoration:"none", display:"block", marginTop:4 }}>View inspiration →</a>}</div>}
          <div style={{ background:"#0A0A0A", border:"1px solid #1A1A1A", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
            {driveUrl ? (<div style={{ position:"relative", paddingBottom:"56.25%" }}><iframe src={driveUrl.replace("/view","/preview")} style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }} allowFullScreen/></div>) : (<div style={{ height:220, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><div style={{ fontSize:28, opacity:.2 }}>▶</div><div style={{ fontSize:12, color:"#333" }}>Paste Drive link below</div></div>)}
            <div style={{ padding:"10px 14px", borderTop:"1px solid #141414", display:"flex", gap:8, alignItems:"center" }}><input placeholder="Google Drive / video link" style={{ flex:1, fontSize:11 }} value={driveUrl} onChange={e => setDriveUrl(e.target.value)} onBlur={e => updateVideo(vid.id,{videoUrl:e.target.value})}/>{driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#7EC8E3", whiteSpace:"nowrap", textDecoration:"none" }}>Open ↗</a>}</div>
          </div>
          <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:8, padding:"12px 14px", marginBottom:16 }}><div style={{ fontSize:10, color:"#555", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Feedback notes</div><textarea rows={4} placeholder="Overall thoughts, what needs to change…" value={reviewNote} onChange={e => setReviewNote(e.target.value)} style={{ resize:"none", fontSize:12 }}/></div>
          {decision && <div style={{ background:"#0D0D0D", border:`1px solid ${decision==="approve"?"#2A5A3A":"#5A2A2A"}`, borderRadius:8, padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><div style={{ fontSize:10, color:"#555", letterSpacing:"0.06em", textTransform:"uppercase" }}>Slack message</div><button className="btn-ghost" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => { navigator.clipboard.writeText(slackMsg); showToast("Copied ✓"); }}>Copy</button></div><div style={{ fontFamily:"monospace", fontSize:11, color:"#888", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{slackMsg}</div></div>}
        </div>
        <div style={{ padding:"20px", overflowY:"auto", background:"#080808" }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Review checklist</div>
          <div style={{ fontSize:11, color:"#333", marginBottom:14 }}>Tap ✓ pass · ✗ fail · again to clear</div>
          {CHECK_CATS.map(cat => (
            <div key={cat} style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:CHECK_COLORS[cat], letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6, paddingLeft:8, borderLeft:`2px solid ${CHECK_COLORS[cat]}` }}>{cat}</div>
              {REVIEW_CHECKS.filter(c => c.category===cat).map(item => {
                const val = checks[item.id];
                return (
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 8px", borderRadius:6, background:val===true?"#0A1A0A":val===false?"#1A0A0A":"transparent" }}>
                    <button onClick={() => toggleCheck(item.id,true)} style={{ width:22, height:22, borderRadius:4, border:`1px solid ${val===true?"#A8E6CF":"#2A2A2A"}`, background:val===true?"#A8E6CF22":"transparent", color:val===true?"#A8E6CF":"#333", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>✓</button>
                    <button onClick={() => toggleCheck(item.id,false)} style={{ width:22, height:22, borderRadius:4, border:`1px solid ${val===false?"#E05555":"#2A2A2A"}`, background:val===false?"#E0555522":"transparent", color:val===false?"#E05555":"#333", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>✗</button>
                    <span style={{ fontSize:12, color:val===true?"#A8E6CF":val===false?"#E05555":"#888", flex:1, lineHeight:1.3 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:8, padding:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
              <div><div style={{ fontSize:18, color:"#A8E6CF", fontWeight:500 }}>{passCount}</div><div style={{ fontSize:10, color:"#444" }}>passed</div></div>
              <div><div style={{ fontSize:18, color:"#E05555", fontWeight:500 }}>{failCount}</div><div style={{ fontSize:10, color:"#444" }}>failed</div></div>
              <div><div style={{ fontSize:18, color:"#555", fontWeight:500 }}>{REVIEW_CHECKS.length-passCount-failCount}</div><div style={{ fontSize:10, color:"#444" }}>skipped</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Creators ──────────────────────────────────────────────────────────────────
function Creators({ creators, addCreator, updateCreator, videos, showToast }) {
  const [showAdd,    setShowAdd]    = useState(false);
  const [profileId,  setProfileId]  = useState(null);
  const [form, setForm] = useState({ name:"", handle:"", platform:"TikTok" });

  const handleAdd = async () => {
    if (!form.name) return;
    const initials = form.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
    const colors   = ["#E8C547","#7EC8E3","#F4A261","#A8E6CF","#DDA0DD","#FF8FAB","#C0F0C0"];
    const c = { id:Date.now().toString(), ...form, avatar:initials, color:colors[creators.length%colors.length], status:"active", phone:"", email:"", whatsapp:"", instagram:"", tiktok:"", category:"", notes:"", checkIns:[] };
    // DB expects snake_case
    await supabase.from("creators").insert([{ id:c.id, name:c.name, handle:c.handle, avatar:c.avatar, color:c.color, platform:c.platform, status:c.status, phone:"", email:"", whatsapp:"", instagram:"", tiktok:"", category:"", notes:"", check_ins:[] }]);
    await addCreator(c);
    setShowAdd(false);
    setForm({ name:"", handle:"", platform:"TikTok" });
    showToast("Creator added ✓");
  };

  if (profileId) {
    const cr = creators.find(c => c.id===profileId);
    if (!cr) { setProfileId(null); return null; }
    return <CreatorProfile cr={cr} updateCreator={updateCreator} videos={videos} onClose={() => setProfileId(null)} showToast={showToast}/>;
  }

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:22, letterSpacing:"-0.02em" }}>Creators</h2><p style={{ fontSize:12, color:"#555", marginTop:3 }}>Manage your roster of {creators.length} creators</p></div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add creator</button>
      </div>
      {showAdd && (
        <div className="card" style={{ marginBottom:16, borderColor:"#E8C54733" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div><div className="field-label">Name</div><input placeholder="Name" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))}/></div>
            <div><div className="field-label">Handle</div><input placeholder="@handle" value={form.handle} onChange={e => setForm(f => ({...f,handle:e.target.value}))}/></div>
            <div><div className="field-label">Platform</div><select value={form.platform} onChange={e => setForm(f => ({...f,platform:e.target.value}))}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select></div>
            <button className="btn-primary" onClick={handleAdd}>Add</button>
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12 }}>
        {creators.map(cr => {
          const myVideos  = videos.filter(v => v.creatorId===cr.id);
          const posted    = myVideos.filter(v => v.status==="posted").length;
          const todayVids = myVideos.filter(v => v.date===new Date().toISOString().split("T")[0]);
          const lastCheckIn = cr.checkIns?.slice(-1)[0];
          return (
            <div key={cr.id} className="card">
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:cr.color+"22", border:`1px solid ${cr.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:cr.color, fontWeight:500, flexShrink:0 }}>{cr.avatar}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, color:"#E8E8E0", fontWeight:500 }}>{cr.name}</div>
                  <div style={{ fontSize:12, color:"#555" }}>{cr.category||cr.platform}{cr.instagram?` · ${cr.instagram}`:""}{cr.tiktok?` · ${cr.tiktok}`:""}</div>
                </div>
                <div style={{ width:8, height:8, borderRadius:"50%", background:cr.status==="active"?"#A8E6CF":"#555" }}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                {[{val:todayVids.length,lbl:"today",color:cr.color},{val:posted,lbl:"posted",color:"#E8E8E0"},{val:myVideos.length,lbl:"total",color:"#E8E8E0"}].map(s => (
                  <div key={s.lbl} style={{ background:"#0D0D0D", borderRadius:6, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:500, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:10, color:"#444" }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {cr.phone && <a href={`tel:${cr.phone}`} style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:"#1A1A1A", color:"#888", border:"1px solid #252525", textDecoration:"none" }}>📞 {cr.phone}</a>}
                {cr.whatsapp && <a href={`https://wa.me/${cr.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:"#1A2A1A", color:"#A8E6CF", border:"1px solid #2A4A2A", textDecoration:"none" }}>WhatsApp</a>}
                {cr.instagram && <a href={`https://instagram.com/${cr.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:"#2A1A2A", color:"#DDA0DD", border:"1px solid #4A2A4A", textDecoration:"none" }}>IG {cr.instagram}</a>}
                {cr.tiktok && <a href={`https://tiktok.com/@${cr.tiktok.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:"#1A2A2A", color:"#7EC8E3", border:"1px solid #2A4A4A", textDecoration:"none" }}>TT {cr.tiktok}</a>}
                {lastCheckIn && <span style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:"#1A1A2A", color:"#666", border:"1px solid #2A2A3A" }}>Check-in: {new Date(lastCheckIn.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button className="btn-primary" style={{ fontSize:11, padding:"6px 12px", flex:1 }} onClick={() => setProfileId(cr.id)}>View profile →</button>
                <button className="btn-ghost" style={{ fontSize:11, padding:"6px 10px" }} onClick={() => updateCreator(cr.id, { status: cr.status==="active"?"inactive":"active" })}>
                  {cr.status==="active"?"Pause":"Activate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Creator Profile ───────────────────────────────────────────────────────────
function CreatorProfile({ cr, updateCreator, videos, onClose, showToast }) {
  const [tab,     setTab]     = useState("contact");
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({ ...cr });
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState({ date:new Date().toISOString().split("T")[0], type:"weekly-call", notes:"" });

  const myVideos = videos.filter(v => v.creatorId===cr.id);
  const posted   = myVideos.filter(v => v.status==="posted").length;
  const avgScore = myVideos.filter(v => v.score).length > 0 ? Math.round(myVideos.filter(v => v.score).reduce((a,v) => a+v.score, 0) / myVideos.filter(v => v.score).length) : null;

  const saveEdits = async () => {
    await updateCreator(cr.id, draft);
    setEditing(false);
    showToast("Saved ✓");
  };

  const addCheckIn = async () => {
    if (!newCheckIn.notes.trim()) return;
    const updated = [...(cr.checkIns||[]), { ...newCheckIn, id:Date.now().toString() }];
    await updateCreator(cr.id, { checkIns: updated });
    setShowCheckInForm(false);
    setNewCheckIn({ date:new Date().toISOString().split("T")[0], type:"weekly-call", notes:"" });
    showToast("Check-in logged ✓");
  };

  const TABS = [["contact","Contact"],["comms","Comms log"],["performance","Performance"],["notes","Notes"]];
  const CHECK_IN_TYPES = ["daily-message","weekly-call","monthly-1-1","feedback-call","ad-hoc"];

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
        <button className="btn-ghost" style={{ fontSize:11 }} onClick={onClose}>← All creators</button>
        <div style={{ width:40, height:40, borderRadius:"50%", background:cr.color+"22", border:`1px solid ${cr.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:cr.color, fontWeight:500 }}>{cr.avatar}</div>
        <div>
          <div style={{ fontSize:18, color:"#E8E8E0", fontFamily:"'Archivo Black',sans-serif", letterSpacing:"-0.01em" }}>{cr.name}</div>
          <div style={{ fontSize:12, color:"#555" }}>{cr.category||cr.platform}{cr.instagram?` · IG ${cr.instagram}`:""}{cr.tiktok?` · TT ${cr.tiktok}`:""}</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {cr.phone && <a href={`tel:${cr.phone}`} style={{ fontSize:11, padding:"6px 12px", borderRadius:6, background:"#1A1A1A", color:"#888", border:"1px solid #252525", textDecoration:"none" }}>📞 Call</a>}
          {cr.whatsapp && <a href={`https://wa.me/${cr.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"6px 12px", borderRadius:6, background:"#1A2A1A", color:"#A8E6CF", border:"1px solid #2A4A2A", textDecoration:"none" }}>WhatsApp</a>}
          {cr.email && <a href={`mailto:${cr.email}`} style={{ fontSize:11, padding:"6px 12px", borderRadius:6, background:"#1A1A1A", color:"#888", border:"1px solid #252525", textDecoration:"none" }}>✉ Email</a>}
          {cr.instagram && <a href={`https://instagram.com/${cr.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"6px 12px", borderRadius:6, background:"#2A1A2A", color:"#DDA0DD", border:"1px solid #4A2A4A", textDecoration:"none" }}>Instagram</a>}
          {cr.tiktok && <a href={`https://tiktok.com/@${cr.tiktok.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"6px 12px", borderRadius:6, background:"#1A2A2A", color:"#7EC8E3", border:"1px solid #2A4A4A", textDecoration:"none" }}>TikTok</a>}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[{label:"Videos posted",val:posted,color:"#A8E6CF"},{label:"Total assigned",val:myVideos.length,color:"#E8E8E0"},{label:"Avg review score",val:avgScore?`${avgScore}/100`:"—",color:"#E8C547"},{label:"Check-ins",val:cr.checkIns?.length||0,color:"#7EC8E3"}].map(s => (
          <div key={s.label} className="card" style={{ padding:"12px 14px" }}>
            <div style={{ fontSize:10, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontFamily:"'Archivo Black',sans-serif", color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid #1A1A1A", paddingBottom:12 }}>
        {TABS.map(([v,l]) => <button key={v} className={`nav-btn${tab===v?" active":""}`} onClick={() => setTab(v)}>{l}</button>)}
        <div style={{ marginLeft:"auto" }}>
          {tab==="contact" && !editing && <button className="btn-ghost" style={{ fontSize:11 }} onClick={() => setEditing(true)}>Edit profile</button>}
          {tab==="contact" && editing && <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:11 }} onClick={saveEdits}>Save</button><button className="btn-ghost" style={{ fontSize:11 }} onClick={() => { setDraft({...cr}); setEditing(false); }}>Cancel</button></div>}
        </div>
      </div>

      {tab==="contact" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            { label:"Phone number",    field:"phone",     placeholder:"+44 7700 000000",   href:v=>`tel:${v}` },
            { label:"WhatsApp number", field:"whatsapp",  placeholder:"+44 7700 000000"  },
            { label:"Email address",   field:"email",     placeholder:"creator@email.com", href:v=>`mailto:${v}` },
            { label:"Instagram handle",field:"instagram", placeholder:"@handle",          href:v=>`https://instagram.com/${v.replace("@","")}` },
            { label:"TikTok handle",   field:"tiktok",    placeholder:"@handle",          href:v=>`https://tiktok.com/@${v.replace("@","")}` },
            { label:"Category",        field:"category",  type:"select", options:CATEGORIES },
          ].map(({ label, field, placeholder, href, type, options }) => (
            <div key={field} className="card" style={{ padding:"14px 16px" }}>
              <div className="field-label" style={{ marginBottom:6 }}>{label}</div>
              {editing ? (
                type==="select" ?
                  <select value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}>{options.map(o => <option key={o}>{o}</option>)}</select> :
                  <input placeholder={placeholder} value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}/>
              ) : (
                cr[field] ?
                  (href ? <a href={href(cr[field])} style={{ fontSize:13, color:"#7EC8E3", textDecoration:"none" }}>{cr[field]}</a> : <div style={{ fontSize:13, color:"#E8E8E0" }}>{cr[field]}</div>) :
                  <div style={{ fontSize:12, color:"#333", fontStyle:"italic" }}>Not set — click Edit profile</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="comms" && (
        <div>
          <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:16, marginBottom:16 }}>
            <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:14, marginBottom:8, color:"#E8C547" }}>Communication rhythm</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { type:"Daily (async)", desc:"WhatsApp or Slack DM. Brief confirmation, quick flags. Voice notes work best.", color:"#E8C547" },
                { type:"Weekly (15 min)", desc:"Monday check-in. Last week's numbers, this week's hooks, any blockers.", color:"#7EC8E3" },
                { type:"Monthly (30 min)", desc:"Proper 1-to-1. Broader feedback, their growth. This is what prevents churn.", color:"#A8E6CF" },
              ].map(r => (
                <div key={r.type} style={{ background:"#111", border:`1px solid ${r.color}22`, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:11, color:r.color, fontWeight:500, marginBottom:4 }}>{r.type}</div>
                  <div style={{ fontSize:11, color:"#666", lineHeight:1.5 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase" }}>Check-in log ({cr.checkIns?.length||0})</div>
            <button className="btn-primary" style={{ fontSize:11, padding:"5px 12px" }} onClick={() => setShowCheckInForm(!showCheckInForm)}>+ Log check-in</button>
          </div>
          {showCheckInForm && (
            <div className="card" style={{ marginBottom:12, borderColor:"#E8C54733" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><div className="field-label">Date</div><input type="date" value={newCheckIn.date} onChange={e => setNewCheckIn(n => ({...n,date:e.target.value}))}/></div>
                <div><div className="field-label">Type</div><select value={newCheckIn.type} onChange={e => setNewCheckIn(n => ({...n,type:e.target.value}))}>{CHECK_IN_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ marginBottom:10 }}><div className="field-label">Notes</div><textarea rows={3} placeholder="What did you cover? Any action points?" value={newCheckIn.notes} onChange={e => setNewCheckIn(n => ({...n,notes:e.target.value}))} style={{ resize:"none" }}/></div>
              <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:11 }} onClick={addCheckIn}>Save</button><button className="btn-ghost" style={{ fontSize:11 }} onClick={() => setShowCheckInForm(false)}>Cancel</button></div>
            </div>
          )}
          {(cr.checkIns||[]).length===0 && !showCheckInForm && <div style={{ color:"#333", fontSize:13, textAlign:"center", padding:"30px 0" }}>No check-ins logged yet</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...(cr.checkIns||[])].reverse().map(ci => (
              <div key={ci.id} className="card" style={{ padding:"12px 14px", borderLeft:`3px solid ${ci.type==="monthly-1-1"?"#A8E6CF":ci.type==="weekly-call"?"#7EC8E3":"#E8C54744"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#E8C547" }}>{new Date(ci.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:"#1A1A1A", color:"#888", border:"1px solid #252525" }}>{ci.type.replace(/-/g," ")}</span>
                </div>
                <div style={{ fontSize:13, color:"#999", lineHeight:1.6 }}>{ci.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="performance" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {myVideos.length===0 && <div style={{ color:"#333", fontSize:13, textAlign:"center", padding:"40px 0" }}>No videos assigned yet</div>}
          {myVideos.slice().reverse().map(v => (
            <div key={v.id} className="card" style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:"#E8E8E0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.hook}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{v.date} · {v.platform}{v.videoStyle?` · ${v.videoStyle}`:""}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                {v.score && <div style={{ fontSize:12, color:v.score>=80?"#A8E6CF":v.score>=50?"#E8C547":"#E05555" }}>{v.score}/100</div>}
                <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLORS[v.status] }}/>
                <span style={{ fontSize:11, color:"#555", textTransform:"capitalize" }}>{v.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="notes" && (
        <div className="card">
          <div className="field-label" style={{ marginBottom:8 }}>Creator notes — visible only to you</div>
          <textarea rows={12} placeholder="Strengths, weaknesses, what motivates them, equipment, past issues, anything useful…" value={draft.notes||""} onChange={e => setDraft(d => ({...d,notes:e.target.value}))} style={{ resize:"vertical", fontSize:13, lineHeight:1.7 }}/>
          <div style={{ marginTop:10 }}>
            <button className="btn-primary" style={{ fontSize:12 }} onClick={() => { updateCreator(cr.id, { notes:draft.notes }); showToast("Notes saved ✓"); }}>Save notes</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Strategy ──────────────────────────────────────────────────────────────────
function Strategy({ creators, videos, briefs, tips, addTip, deleteTip, showToast }) {
  const [tab, setTab] = useState("why");
  const tabs = [["why","Why this system"],["playbook","Daily playbook"],["hooks","Hook science"],["scale","How to scale"],["tips","Creator tips"]];
  return (
    <div className="fade">
      <div style={{ marginBottom:24 }}><h2 style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:22, letterSpacing:"-0.02em" }}>Strategy & Playbook</h2><p style={{ fontSize:12, color:"#555", marginTop:3 }}>Built from r/ClaudeAI · r/marketing · r/startups</p></div>
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid #1A1A1A", paddingBottom:12, flexWrap:"wrap" }}>
        {tabs.map(([v,l]) => <button key={v} className={`nav-btn${tab===v?" active":""}`} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      {tab==="why"      && <StrategyWhy creators={creators}/>}
      {tab==="playbook" && <StrategyPlaybook/>}
      {tab==="hooks"    && <StrategyHooks/>}
      {tab==="scale"    && <StrategyScale/>}
      {tab==="tips"     && <CreatorTips tips={tips} addTip={addTip} deleteTip={deleteTip} showToast={showToast}/>}
    </div>
  );
}

function Block({ title, label, labelColor, children }) {
  return (
    <div className="card" style={{ marginBottom:12, borderLeft:`3px solid ${labelColor||"#E8C547"}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        {label && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, background:labelColor+"22", color:labelColor, letterSpacing:"0.06em" }}>{label}</span>}
        <span style={{ fontSize:14, fontWeight:500, color:"#E8E8E0" }}>{title}</span>
      </div>
      <div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>{children}</div>
    </div>
  );
}

function StrategyWhy({ creators }) {
  const n = creators.filter(c => c.status==="active").length;
  return (
    <div>
      <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:20, marginBottom:20 }}>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, marginBottom:8, color:"#E8C547" }}>The volume-first UGC model</div>
        <div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>Reddit's top UGC threads agree: the #1 mistake brands make is betting on 1–2 hero videos. The algorithm rewards <strong style={{ color:"#E8E8E0" }}>volume + variation</strong>. With {n} creators × 5 videos = <strong style={{ color:"#E8C547" }}>{n*5} videos/day</strong>, you run a natural split-test on hooks every 24 hours.</div>
      </div>
      <Block title="Same body, different hook — the split-test engine" label="CORE PRINCIPLE" labelColor="#E8C547">The main body script is your proven message. The hook (first 3 seconds) determines whether someone stops scrolling. Keeping the body identical and varying only the hook gives you a clean A/B test every day.</Block>
      <Block title="Why 5 videos per creator?" label="FROM r/STARTUPS" labelColor="#7EC8E3">Founders report that posting frequency under 3 videos/day per account leads to stagnant reach. 5 is the sweet spot — enough to test variations, not so many the algorithm deprioritises the account.</Block>
      <Block title="Why multiple creators for the same brief?" label="FROM r/MARKETING" labelColor="#F4A261">Different creators attract different audiences. Same brief across all creators = audience diversification for free.</Block>
      <Block title="UGC builds trust that ads can't buy" label="REDDIT CONSENSUS" labelColor="#A8E6CF">UGC converts 4–6× better than polished brand ads. Your daily videos function as both ads and social proof simultaneously.</Block>
    </div>
  );
}

function StrategyPlaybook() {
  const steps = [
    { time:"8:00am", action:"Morning brief",    detail:"Lock the day's brief. All creators have their assignments.",                              why:"Creators need hooks before they start. Ambiguity kills momentum.",                      color:"#E8C547" },
    { time:"9:00am", action:"Creators film",    detail:"Each creator films 5 hook variations back-to-back using the same body.",                  why:"Batch filming = performance mode once, not resetting 5 times.",                        color:"#F4A261" },
    { time:"12:00pm",action:"Editing window",   detail:"Only the hook section changes per version — body is one edit applied to all.",            why:"One body edit = 80% done. Five hook edits on top = marginal extra time.",              color:"#7EC8E3" },
    { time:"2:00pm", action:"Review & approve", detail:"Review all videos using the checklist. Approve or request revision.",                     why:"Central approval prevents off-brand content going live.",                               color:"#A8E6CF" },
    { time:"3–7pm",  action:"Staggered posting",detail:"Creators post throughout peak hours — NOT all at once.",                                   why:"Staggering prevents the algorithm treating you as a bot.",                             color:"#DDA0DD" },
    { time:"8:00pm", action:"Daily debrief",    detail:"Check which hooks are getting the most views/saves in first 2 hours.",                    why:"Hour 1–2 signal predicts total reach. This is how you compound results.",              color:"#E8C547" },
  ];
  return (
    <div>
      <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:20, marginBottom:20 }}><div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:16, marginBottom:4 }}>Daily operating rhythm</div><div style={{ fontSize:12, color:"#555" }}>Creators × 5 videos · staggered posting</div></div>
      {steps.map((s,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:s.color+"22", border:`1px solid ${s.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:s.color, fontWeight:500, flexShrink:0 }}>{i+1}</div>
            {i<steps.length-1 && <div style={{ width:1, flex:1, background:"#1A1A1A", margin:"4px 0" }}/>}
          </div>
          <div className="card" style={{ marginBottom:10, marginLeft:12, borderColor:"#1A1A1A" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}><span style={{ fontSize:11, color:s.color }}>{s.time}</span><span style={{ fontSize:13, fontWeight:500, color:"#E8E8E0" }}>{s.action}</span></div>
            <div style={{ fontSize:13, color:"#999", marginBottom:8, lineHeight:1.5 }}>{s.detail}</div>
            <div style={{ fontSize:12, color:"#555", background:"#0D0D0D", padding:"8px 10px", borderRadius:6, borderLeft:`2px solid ${s.color}44` }}><strong style={{ color:"#888" }}>Why: </strong>{s.why}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StrategyHooks() {
  const frameworks = [
    { name:"The POV hook",        template:"POV: you discovered [X] and now…",          why:"Creates instant identification. POV hooks outperform direct-address by ~40% on TikTok.", example:"POV: you found Tilt and now you can't shop anywhere else" },
    { name:"The result hook",     template:"I tried [X] for [N] days. Here's what happened.", why:"Promise of a story arc — viewer commits because they want the result.",               example:"I shopped only Tilt for 30 days. Here's the honest truth." },
    { name:"The secret hook",     template:"Nobody talks about this — but [X]…",          why:"FOMO + exclusivity. Gets high share rates.",                                             example:"Nobody talks about this — but Tilt has the best Y2K pieces right now" },
    { name:"The pattern interrupt",template:"Wait — you're still not [doing X]?",         why:"Breaks the scroll with a direct challenge. Creates mild FOMO.",                          example:"Wait — you're still not checking Tilt for vintage finds?" },
    { name:"The honest review",   template:"The honest truth about [X] after [N] days",   why:"'Honest' framing makes claims more believable.",                                         example:"The honest truth about buying pre-loved on Tilt" },
  ];
  return (
    <div>
      <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:20, marginBottom:20 }}><div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:16, marginBottom:6 }}>Hook science — the first 3 seconds</div><div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>The hook is the <strong style={{ color:"#E8C547" }}>only part of your video that earns the watch</strong>. 70% of your testing effort should go on hooks, not production quality.</div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {frameworks.map((f,i) => (
          <div key={i} className="card">
            <div style={{ fontSize:13, color:"#E8C547", fontFamily:"'Archivo Black',sans-serif", marginBottom:6 }}>{f.name}</div>
            <div style={{ fontSize:12, color:"#666", marginBottom:8, fontStyle:"italic" }}>{f.template}</div>
            <div style={{ fontSize:13, color:"#999", marginBottom:10, lineHeight:1.6 }}>{f.why}</div>
            <div style={{ background:"#0D0D0D", borderRadius:6, padding:"8px 12px", fontSize:12, color:"#A8E6CF", borderLeft:"2px solid #A8E6CF44" }}><strong style={{ color:"#666" }}>Example: </strong>{f.example}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyScale() {
  const phases = [
    { phase:"Phase 1", title:"Prove the system (weeks 1–4)",       color:"#E8C547", steps:["Run 1 brief per week. Track which hook type wins.","Identify your best-performing creator per platform.","Don't change the body script — only iterate hooks based on data.","Build a hook leaderboard — 1 winner per week minimum."] },
    { phase:"Phase 2", title:"Double down on winners (weeks 5–8)", color:"#7EC8E3", steps:["Take your top 3 hooks — give each creator a variation of those.","Introduce platform-specific brief variations: TikTok hooks ≠ Instagram.","Start a second brief track: awareness (TOFU) vs conversion (BOFU).","Add a creator who specialises in the format that's working."] },
    { phase:"Phase 3", title:"Scale to machine (month 3+)",        color:"#F4A261", steps:["Build a hook vault — every winner goes in. Rotate every 4–6 weeks.","Use Claude to generate 20 hook variations per brief — you pick the best 5.","Amplify: take top 2 organic videos each week and run as paid dark posts.","Whitelisting: creators post from their accounts, brand boosts with spend.","Track LTV by hook type: which hooks attract buyers vs watchers?"] },
  ];
  return (
    <div>
      <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:20, marginBottom:20 }}><div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:16, marginBottom:6 }}>Long-term scaling roadmap</div><div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>From r/startups: "The brands winning at UGC aren't creating better content — they're creating faster feedback loops."</div></div>
      {phases.map((p,i) => (
        <div key={i} className="card" style={{ marginBottom:12, borderLeft:`3px solid ${p.color}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}><span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, background:p.color+"22", color:p.color }}>{p.phase}</span><span style={{ fontSize:14, fontWeight:500, color:"#E8E8E0" }}>{p.title}</span></div>
          {p.steps.map((s,j) => <div key={j} style={{ display:"flex", gap:8, fontSize:13, color:"#888", lineHeight:1.5, marginBottom:6 }}><span style={{ color:p.color, flexShrink:0 }}>→</span><span>{s}</span></div>)}
        </div>
      ))}
      <div className="card" style={{ borderColor:"#E8C54733" }}>
        <div style={{ fontSize:13, color:"#E8C547", marginBottom:8, fontWeight:500 }}>The optimisation checklist (run every Friday)</div>
        {["Which hook type got the highest watch-time this week?","Which creator drove the most profile visits or link clicks?","Which platform had the lowest CAC from UGC?","Is the main body script still converting — or is it time to refresh?","Are any creators declining in reach? (platform suppression — common after day 60)"].map((q,i) => (
          <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#666", padding:"5px 0", borderBottom:"1px solid #141414" }}><span style={{ color:"#333" }}>□</span><span>{q}</span></div>
        ))}
      </div>
    </div>
  );
}

function CreatorTips({ tips, addTip, deleteTip, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ title:"", category:"Delivery", body:"", videoUrl:"", isLesson:false });
  const [active,  setActive]  = useState(null);
  const TIP_CATS = ["Delivery","Hook","Lighting","Audio","Editing","Brand","Platform","Mindset"];
  const CAT_C    = { Delivery:"#7EC8E3", Hook:"#E8C547", Lighting:"#F4A261", Audio:"#DDA0DD", Editing:"#A8E6CF", Brand:"#E8C547", Platform:"#7EC8E3", Mindset:"#A8E6CF" };

  const handleAdd = async () => {
    if (!form.title) return;
    await addTip({ ...form, id:Date.now().toString(), createdAt:new Date().toISOString() });
    setShowAdd(false);
    setForm({ title:"", category:"Delivery", body:"", videoUrl:"", isLesson:false });
    showToast("Tip added ✓");
  };

  return (
    <div>
      <div style={{ background:"#0D0D0D", border:"1px solid #1A1A1A", borderRadius:10, padding:20, marginBottom:20 }}><div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, marginBottom:6, color:"#E8C547" }}>Creator lessons & key tips</div><div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>Add video advice and lessons here. New creators are sent to this section during onboarding.</div></div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}><button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add tip / lesson</button></div>
      {showAdd && (
        <div className="card" style={{ marginBottom:16, borderColor:"#E8C54733" }}>
          <div style={{ fontSize:11, color:"#E8C547", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>New tip or lesson</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><div className="field-label">Title</div><input placeholder="e.g. How to open with energy" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))}/></div>
            <div><div className="field-label">Category</div><select value={form.category} onChange={e => setForm(f => ({...f,category:e.target.value}))}>{TIP_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:10 }}><div className="field-label">Teaching / advice</div><textarea rows={4} placeholder="What should creators know, do, or avoid?" value={form.body} onChange={e => setForm(f => ({...f,body:e.target.value}))} style={{ resize:"vertical" }}/></div>
          <div style={{ marginBottom:14 }}><div className="field-label">Video reference link (optional)</div><input placeholder="https://… paste a video that shows this in action" value={form.videoUrl} onChange={e => setForm(f => ({...f,videoUrl:e.target.value}))}/></div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:18, height:18, borderRadius:4, border:`1px solid ${form.isLesson?"#E8C547":"#333"}`, background:form.isLesson?"#E8C54722":"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} onClick={() => setForm(f => ({...f,isLesson:!f.isLesson}))}>
              {form.isLesson && <span style={{ fontSize:11, color:"#E8C547" }}>✓</span>}
            </div>
            <span style={{ fontSize:12, color:"#777" }}>Mark as required lesson</span>
          </div>
          <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={handleAdd}>Save</button><button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button></div>
        </div>
      )}
      {tips.filter(t => t.isLesson).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#E8C547", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Required lessons</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{tips.filter(t => t.isLesson).map(tip => <TipCard key={tip.id} tip={tip} active={active} setActive={setActive} deleteTip={deleteTip} CAT_C={CAT_C}/>)}</div>
        </div>
      )}
      <div style={{ fontSize:11, color:"#555", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>All tips {tips.length > 0 && `(${tips.length})`}</div>
      {tips.length===0 && <div style={{ color:"#333", fontSize:13, textAlign:"center", padding:"40px 0" }}>No tips yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{tips.filter(t => !t.isLesson).map(tip => <TipCard key={tip.id} tip={tip} active={active} setActive={setActive} deleteTip={deleteTip} CAT_C={CAT_C}/>)}</div>
    </div>
  );
}

function TipCard({ tip, active, setActive, deleteTip, CAT_C }) {
  const col = CAT_C[tip.category]||"#888";
  return (
    <div className="card" style={{ cursor:"pointer", borderLeft:`3px solid ${col}`, borderColor:active===tip.id?`${col}55`:"#1E1E1E" }} onClick={() => setActive(active===tip.id?null:tip.id)}>
      <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"space-between" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
            <span style={{ fontSize:13, color:"#E8E8E0", fontWeight:500 }}>{tip.title}</span>
            {tip.isLesson && <span style={{ fontSize:10, padding:"2px 6px", borderRadius:4, background:"#E8C54722", color:"#E8C547", border:"1px solid #E8C54733" }}>Required</span>}
          </div>
          <div style={{ display:"flex", gap:8, fontSize:11 }}>
            <span style={{ color:col }}>{tip.category}</span>
            <span style={{ color:"#444" }}>{new Date(tip.createdAt).toLocaleDateString()}</span>
            {tip.videoUrl && <span style={{ color:"#555" }}>· Video ref</span>}
          </div>
        </div>
        <button style={{ background:"none", border:"none", color:"#333", fontSize:11, padding:"2px 6px", cursor:"pointer" }} onClick={e => { e.stopPropagation(); deleteTip(tip.id); }}>✕</button>
      </div>
      {active===tip.id && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1A1A1A" }}>
          <div style={{ fontSize:13, color:"#999", lineHeight:1.7, marginBottom:tip.videoUrl?12:0, whiteSpace:"pre-wrap" }}>{tip.body}</div>
          {tip.videoUrl && <a href={tip.videoUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:"#7EC8E3", textDecoration:"none", padding:"6px 12px", border:"1px solid #7EC8E333", borderRadius:6, background:"#7EC8E308" }}>▶ Watch reference video</a>}
        </div>
      )}
    </div>
  );
}
