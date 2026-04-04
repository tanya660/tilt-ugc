import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

// ── Config — fill these in ──────────────────────────────────────────────────
const ADMIN_EMAIL = "tanya@tilt.app";
const EMAILJS_SERVICE_ID = "FILL_IN_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "FILL_IN_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "FILL_IN_PUBLIC_KEY";
const ADMIN_NOTIFY_EMAIL = "tanya@tilt.app";

// ── Constants ────────────────────────────────────────────────────────────────
const VIDEO_STYLES = ["Talking head","GRWM","Transition","Voice-over + b-roll","POV","Haul / unboxing","Day-in-the-life","Viral style"];
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
const STATUSES   = ["assigned","editing","first draft","second draft","approved","posted"];
const STATUS_COLORS = { "assigned":"#6B6B6B", "editing":"#D97706", "first draft":"#2563EB", "second draft":"#7C3AED", "approved":"#16A34A", "posted":"#16A34A" };
const STATUS_BADGE = {
  "assigned":     { bg:"#F5F5F5", color:"#6B6B6B" },
  "editing":      { bg:"#FEF3C7", color:"#D97706" },
  "first draft":  { bg:"#EFF6FF", color:"#2563EB" },
  "second draft": { bg:"#F5F3FF", color:"#7C3AED" },
  "approved":     { bg:"#F0FDF4", color:"#16A34A" },
  "posted":       { bg:"#16A34A", color:"#FFFFFF" },
};

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
const CHECK_COLORS = { Hook:"#E8C547", Delivery:"#2563EB", Production:"#D97706", Brand:"#16A34A", CTA:"#7C3AED" };

// ── DB helpers ───────────────────────────────────────────────────────────────
const mapCreator = r => r ? ({
  id: r.id, name: r.name, handle: r.handle, avatar: r.avatar,
  color: r.color, platform: r.platform, status: r.status,
  phone: r.phone||"", email: r.email||"", whatsapp: r.whatsapp||"",
  instagram: r.instagram||"", tiktok: r.tiktok||"",
  category: r.category||"", notes: r.notes||"",
  checkIns: r.check_ins||[], authEmail: r.auth_email||"",
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
  videoStyle: r.video_style||"", status: r.status||"assigned",
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

const mapBriefIdea = r => r ? ({
  id: r.id, creatorId: r.creator_id, title: r.title,
  description: r.description||"", status: r.status||"pending",
  createdAt: r.created_at,
}) : null;

// ── StatusBadge component ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { bg:"#F5F5F5", color:"#6B6B6B" };
  return <span style={{ display:"inline-block", padding:"4px 8px", borderRadius:100, fontSize:11, fontWeight:500, fontFamily:"'Inter',sans-serif", background:s.bg, color:s.color, textTransform:"capitalize", lineHeight:1 }}>{status}</span>;
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,       setSession]       = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [userRole,      setUserRole]      = useState(null);
  const [currentCreator,setCurrentCreator]= useState(null);

  const [view,          setView]          = useState("dashboard");
  const [creators,      setCreators]      = useState([]);
  const [briefs,        setBriefs]        = useState([]);
  const [videos,        setVideos]        = useState([]);
  const [tips,          setTips]          = useState([]);
  const [briefIdeas,    setBriefIdeas]    = useState([]);
  const [activeBrief,   setActiveBrief]   = useState(null);
  const [reviewing,     setReviewing]     = useState(null);
  const [loaded,        setLoaded]        = useState(false);
  const [toast,         setToast]         = useState(null);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setUserRole(null); setCurrentCreator(null); setLoaded(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data once signed in ──
  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: c }, { data: b }, { data: v }, { data: t }, { data: bi }] = await Promise.all([
        supabase.from("creators").select("*").order("created_at"),
        supabase.from("briefs").select("*").order("created_at", { ascending: false }),
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("tips").select("*").order("created_at", { ascending: false }),
        supabase.from("brief_ideas").select("*").order("created_at", { ascending: false }),
      ]);
      setCreators((c||[]).map(mapCreator));
      setBriefs((b||[]).map(mapBrief));
      setVideos((v||[]).map(mapVideo));
      setTips((t||[]).map(mapTip));
      setBriefIdeas((bi||[]).map(mapBriefIdea));
      setLoaded(true);
    })();
  }, [session]);

  // ── Determine role once data is loaded ──
  useEffect(() => {
    if (!session || !loaded) return;
    const email = session.user.email;
    if (email === ADMIN_EMAIL) { setUserRole("admin"); return; }
    const match = creators.find(c => c.authEmail === email);
    if (match) { setUserRole("creator"); setCurrentCreator(match); }
    else { setUserRole("unknown"); }
  }, [session, loaded, creators]);

  const signIn = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setUserRole(null); setLoaded(false); };
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Creator ops ──
  const addCreator = async (data) => {
    const { data: row } = await supabase.from("creators").insert([data]).select().single();
    if (row) setCreators(prev => [...prev, mapCreator(row)]);
  };
  const updateCreator = async (id, patch) => {
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
    if (patch.authEmail !== undefined) dbPatch.auth_email  = patch.authEmail;
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
  const updateBrief = async (data) => {
    const dbRow = {
      title: data.title, product: data.product, main_body: data.mainBody,
      cta: data.cta, key_visuals: data.keyVisuals, video_style: data.videoStyle,
      inspiration_url: data.inspirationUrl, inspiration_note: data.inspirationNote,
      hooks: data.hooks, active: data.active,
    };
    await supabase.from("briefs").update(dbRow).eq("id", data.id);
    setBriefs(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
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
  const deleteVideo = async (id) => {
    await supabase.from("videos").delete().eq("id", id);
    setVideos(prev => prev.filter(v => v.id !== id));
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

  // ── Brief idea ops ──
  const addBriefIdea = async (data) => {
    const dbRow = { id: data.id, creator_id: data.creatorId, title: data.title, description: data.description, status: "pending" };
    const { data: row } = await supabase.from("brief_ideas").insert([dbRow]).select().single();
    if (row) setBriefIdeas(prev => [mapBriefIdea(row), ...prev]);
  };
  const updateBriefIdea = async (id, patch) => {
    const dbPatch = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    await supabase.from("brief_ideas").update(dbPatch).eq("id", id);
    setBriefIdeas(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  // ── Derived ──
  const todayStr    = new Date().toISOString().split("T")[0];
  const todayVideos = videos.filter(v => v.date === todayStr);
  const postedToday = todayVideos.filter(v => v.status === "posted").length;
  const totalPosted = videos.filter(v => v.status === "posted").length;
  const totalVideos = videos.length;
  const totalDue    = creators.filter(c => c.status === "active").length * 5;
  const inProgress  = videos.filter(v => !["assigned","posted"].includes(v.status)).length;
  const completion  = totalVideos > 0 ? Math.round((totalPosted / totalVideos) * 100) : 0;

  // ── Render gates ──
  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen onSignIn={signIn} />;
  if (!loaded) return <LoadingScreen />;
  if (userRole === "unknown") return <AccessDenied onSignOut={signOut} />;
  if (userRole === "creator" && currentCreator) {
    return <CreatorPortal creator={currentCreator} videos={videos.filter(v => v.creatorId === currentCreator.id)} briefs={briefs} briefIdeas={briefIdeas.filter(i => i.creatorId === currentCreator.id)} addBriefIdea={addBriefIdea} updateVideo={updateVideo} session={session} onSignOut={signOut} showToast={showToast} toast={toast} />;
  }

  if (reviewing) {
    const vid = videos.find(v => v.id === reviewing);
    if (!vid) { setReviewing(null); return null; }
    return <ReviewRoom vid={vid} creators={creators} briefs={briefs} updateVideo={updateVideo} onClose={() => setReviewing(null)} showToast={showToast} session={session} onSignOut={signOut} />;
  }

  // ── Admin shell ──
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", color:"#111111" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#FAFAFA}::-webkit-scrollbar-thumb{background:#E5E5E5;border-radius:2px}
        input,textarea,select{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;border-radius:6px;padding:8px 12px;font-family:'Inter',sans-serif;font-size:13px;outline:none;width:100%;transition:border-color 0.15s}
        input:focus,textarea:focus,select:focus{outline:2px solid #111111;outline-offset:1px;border-color:#111111}
        input::placeholder,textarea::placeholder{color:#A0A0A0}
        button{cursor:pointer;font-family:'Inter',sans-serif}
        .nav-link{background:none;border:none;color:#6B6B6B;font-size:13px;font-weight:400;padding:14px 12px;border-bottom:2px solid transparent;transition:all 0.15s;margin-bottom:-1px}
        .nav-link:hover{color:#111111}
        .nav-link.active{color:#111111;font-weight:500;border-bottom-color:#111111}
        .btn-primary{background:#111111;color:#FFFFFF;border:none;padding:8px 16px;border-radius:6px;font-weight:500;font-size:13px;transition:opacity 0.15s;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-primary:hover{opacity:0.85}
        .btn-ghost{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;padding:7px 16px;border-radius:6px;font-size:13px;transition:all 0.15s;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-ghost:hover{border-color:#CCCCCC;background:#FAFAFA}
        .btn-danger{background:#FFFFFF;border:1px solid #FECACA;color:#DC2626;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-danger:hover{background:#FEF2F2}
        .btn-success{background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-success:hover{background:#DCFCE7}
        .card{background:#FFFFFF;border:1px solid #E5E5E5;border-radius:8px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .tag{display:inline-block;padding:4px 8px;border-radius:100px;font-size:11px;font-weight:500;background:#F5F5F5;color:#6B6B6B}
        .stat-num{font-family:'Inter',sans-serif;font-weight:700;font-size:36px;line-height:1}
        .field-label{font-size:11px;color:#A0A0A0;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;font-weight:500}
        .section-label{font-size:11px;color:#A0A0A0;letter-spacing:0.08em;text-transform:uppercase;font-weight:500}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        .fade{animation:fadeUp 0.2s ease both}
      `}</style>

      {/* ── Top nav ── */}
      <div style={{ borderBottom:"1px solid #E5E5E5", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, background:"#FFFFFF", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          <span style={{ fontWeight:700, fontSize:15, color:"#111111", letterSpacing:"-0.02em" }}>Tilt UGC</span>
          <div style={{ display:"flex", gap:0 }}>
            {[["dashboard","Dashboard"],["briefs","Briefs"],["board","Video Board"],["creators","Creators"],["strategy","Strategy"]].map(([v,l]) => (
              <button key={v} className={`nav-link${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {session?.user?.user_metadata?.avatar_url && <img src={session.user.user_metadata.avatar_url} style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #E5E5E5" }} alt="" />}
          <span style={{ fontSize:13, color:"#111111" }}>{session?.user?.user_metadata?.full_name || session?.user?.email}</span>
          <button onClick={signOut} style={{ background:"none", border:"none", fontSize:13, color:"#6B6B6B", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>
        {view==="dashboard" && <Dashboard creators={creators} videos={videos} briefs={briefs} briefIdeas={briefIdeas} updateBriefIdea={updateBriefIdea} totalDue={totalDue} postedToday={postedToday} totalPosted={totalPosted} totalVideos={totalVideos} inProgress={inProgress} completion={completion} todayVideos={todayVideos} todayStr={todayStr} setView={setView} setReviewing={setReviewing}/>}
        {view==="briefs"    && <Briefs briefs={briefs} addBrief={addBrief} deleteBrief={deleteBrief} updateBrief={updateBrief} creators={creators} videos={videos} addVideos={addVideos} showToast={showToast} activeBrief={activeBrief} setActiveBrief={setActiveBrief}/>}
        {view==="board"     && <VideoBoard videos={videos} updateVideo={updateVideo} deleteVideo={deleteVideo} creators={creators} briefs={briefs} showToast={showToast} setReviewing={setReviewing}/>}
        {view==="creators"  && <Creators creators={creators} addCreator={addCreator} updateCreator={updateCreator} videos={videos} showToast={showToast}/>}
        {view==="strategy"  && <Strategy creators={creators} videos={videos} briefs={briefs} tips={tips} addTip={addTip} deleteTip={deleteTip} showToast={showToast}/>}
      </div>

      {toast && <div style={{ position:"fixed", bottom:24, right:24, background:"#111111", color:"#FFFFFF", padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:500, zIndex:999, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>{toast}</div>}
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onSignIn }) {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", maxWidth:360, padding:40 }}>
        <div style={{ fontWeight:600, fontSize:24, color:"#111111", marginBottom:8, letterSpacing:"-0.02em" }}>Tilt UGC</div>
        <p style={{ fontSize:14, color:"#6B6B6B", marginBottom:40, lineHeight:1.6 }}>Creator management platform</p>
        <button onClick={onSignIn} style={{ display:"inline-flex", alignItems:"center", gap:10, background:"#111111", color:"#FFFFFF", border:"none", borderRadius:8, padding:"12px 28px", fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", transition:"opacity 0.15s" }} onMouseOver={e=>e.currentTarget.style.opacity="0.85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// ── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'Inter',sans-serif", color:"#A0A0A0", fontSize:13, letterSpacing:"0.05em", background:"#FFFFFF" }}>
      Loading…
    </div>
  );
}

// ── Access Denied ────────────────────────────────────────────────────────────
function AccessDenied({ onSignOut }) {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", maxWidth:400, padding:40 }}>
        <div style={{ fontWeight:600, fontSize:24, color:"#111111", marginBottom:8 }}>Tilt UGC</div>
        <div style={{ fontSize:14, color:"#6B6B6B", marginBottom:32, lineHeight:1.6 }}>You don't have access. Contact Tilt.</div>
        <button onClick={onSignOut} className="btn-ghost" style={{ fontSize:13 }}>Sign out</button>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ creators, videos, briefs, briefIdeas, updateBriefIdea, totalDue, postedToday, totalPosted, totalVideos, inProgress, completion, todayVideos, todayStr, setView, setReviewing }) {
  const [view, setDashView] = useState("total");
  const activeBriefs   = briefs.filter(b => b.active);
  const pendingReview  = todayVideos.filter(v => v.status === "first draft" || v.status === "second draft");
  const todayPosted    = todayVideos.filter(v => v.status === "posted").length;
  const todayActive    = todayVideos.filter(v => v.status !== "posted").length;
  const todayCompletion= totalDue > 0 ? Math.round((todayPosted/totalDue)*100) : 0;
  const pendingIdeas   = briefIdeas.filter(i => i.status === "pending");

  const stats = view === "total" ? [
    { label:"Total posted",    val:totalPosted,   sub:`of ${totalVideos} assigned` },
    { label:"In progress",     val:inProgress,    sub:"across all briefs" },
    { label:"Pending review",  val:pendingReview.length, sub:"need your eyes" },
    { label:"Completion rate", val:`${completion}%`, sub:"posted vs assigned" },
  ] : [
    { label:"Posted today",    val:todayPosted,   sub:`of ${totalDue} due` },
    { label:"Active today",    val:todayActive,   sub:"in pipeline today" },
    { label:"Pending review",  val:pendingReview.length, sub:"need your eyes" },
    { label:"Today target",    val:`${todayCompletion}%`, sub:"daily completion" },
  ];

  return (
    <div className="fade">
      <div style={{ marginBottom:24, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontWeight:600, fontSize:22, color:"#111111" }}>
            Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}
          </h1>
          <p style={{ color:"#6B6B6B", fontSize:13, marginTop:4 }}>Here's your content pipeline overview.</p>
        </div>
        <div style={{ display:"flex", gap:0, border:"1px solid #E5E5E5", borderRadius:8, overflow:"hidden" }}>
          {[["total","All time"],["today","Today"]].map(([v,l]) => (
            <button key={v} onClick={() => setDashView(v)} style={{ background:view===v?"#111111":"#FFFFFF", color:view===v?"#FFFFFF":"#6B6B6B", border:"none", padding:"6px 16px", fontSize:12, fontFamily:"'Inter',sans-serif", cursor:"pointer", fontWeight:view===v?500:400, transition:"all 0.15s" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label} className="card">
            <div className="section-label" style={{ marginBottom:8 }}>{s.label}</div>
            <div className="stat-num" style={{ color:"#111111" }}>{s.val}</div>
            <div style={{ fontSize:12, color:"#A0A0A0", marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="section-label" style={{ marginBottom:16 }}>Creator progress — all time</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {creators.filter(c => c.status==="active").map(cr => {
            const allMine   = videos.filter(v => v.creatorId===cr.id);
            const posted    = allMine.filter(v => v.status==="posted").length;
            const total     = allMine.length;
            const pct       = total > 0 ? Math.round((posted/total)*100) : 0;
            const todayMine = todayVideos.filter(v => v.creatorId===cr.id);
            return (
              <div key={cr.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr.color, flexShrink:0, fontWeight:600 }}>{cr.avatar}</div>
                <div style={{ fontSize:13, color:"#111111", minWidth:100 }}>{cr.name}</div>
                <div style={{ flex:1, height:4, background:"#F5F5F5", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:cr.color, borderRadius:2, transition:"width 0.4s" }}/>
                </div>
                <div style={{ fontSize:12, color:"#6B6B6B", minWidth:60, textAlign:"right" }}>{posted}/{total}</div>
                <div style={{ display:"flex", gap:4 }}>
                  {todayMine.slice(0,5).map((vid,i) => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLORS[vid.status]||"#E5E5E5" }} title={vid.status}/>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingReview.length > 0 && (
        <div className="card" style={{ marginBottom:16, borderColor:"#FED7AA" }}>
          <div className="section-label" style={{ marginBottom:12, color:"#D97706" }}>Needs your review now</div>
          {pendingReview.map(vid => {
            const cr = creators.find(c => c.id===vid.creatorId);
            return (
              <div key={vid.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #F5F5F5" }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:cr?.color+"15", border:`1px solid ${cr?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:cr?.color, fontWeight:600 }}>{cr?.avatar}</div>
                <span style={{ fontSize:13, color:"#111111", flex:1 }}>{vid.hook}</span>
                <span style={{ fontSize:12, color:"#6B6B6B" }}>{cr?.name}</span>
                <button className="btn-primary" style={{ fontSize:12, padding:"5px 12px" }} onClick={() => setReviewing(vid.id)}>Review</button>
              </div>
            );
          })}
        </div>
      )}

      {pendingIdeas.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="section-label" style={{ marginBottom:12 }}>Brief ideas from creators</div>
          {pendingIdeas.map(idea => {
            const cr = creators.find(c => c.id === idea.creatorId);
            return (
              <div key={idea.id} style={{ padding:"12px 0", borderBottom:"1px solid #F5F5F5", display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#111111", marginBottom:2 }}>{idea.title}</div>
                  {idea.description && <div style={{ fontSize:12, color:"#6B6B6B", lineHeight:1.5, marginBottom:4 }}>{idea.description}</div>}
                  <div style={{ fontSize:11, color:"#A0A0A0" }}>{cr?.name} · {new Date(idea.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button className="btn-success" style={{ fontSize:11, padding:"5px 12px" }} onClick={() => updateBriefIdea(idea.id, { status:"approved" })}>Approve</button>
                  <button className="btn-danger" style={{ fontSize:11, padding:"5px 12px" }} onClick={() => updateBriefIdea(idea.id, { status:"rejected" })}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div className="card" style={{ cursor:"pointer" }} onClick={() => setView("briefs")}>
          <div className="section-label" style={{ marginBottom:8 }}>Active briefs</div>
          {activeBriefs.length===0 ? <p style={{color:"#A0A0A0",fontSize:13}}>No active briefs — create one</p> : activeBriefs.slice(0,3).map(b => (
            <div key={b.id} style={{ padding:"8px 0", borderBottom:"1px solid #F5F5F5", fontSize:13 }}>
              <span style={{color:"#111111"}}>{b.title}</span>
              <span style={{color:"#A0A0A0",marginLeft:8,fontSize:11}}>{b.hooks?.length||0} hooks</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ cursor:"pointer" }} onClick={() => setView("board")}>
          <div className="section-label" style={{ marginBottom:8 }}>Video pipeline today</div>
          {STATUSES.map(status => {
            const count = todayVideos.filter(v => v.status===status).length;
            return count>0 ? (
              <div key={status} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:13}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:STATUS_COLORS[status],flexShrink:0}}/>
                <span style={{color:"#6B6B6B",textTransform:"capitalize"}}>{status}</span>
                <span style={{marginLeft:"auto",color:"#111111",fontWeight:500}}>{count}</span>
              </div>
            ) : null;
          })}
          {todayVideos.length===0 && <p style={{color:"#A0A0A0",fontSize:13}}>No videos due today</p>}
        </div>
      </div>
    </div>
  );
}

// ── Briefs ────────────────────────────────────────────────────────────────────
function Briefs({ briefs, addBrief, deleteBrief, updateBrief, creators, videos, addVideos, showToast, activeBrief, setActiveBrief }) {
  const [showForm,    setShowForm]    = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [editingBrief, setEditingBrief] = useState(null);
  const [editForm,    setEditForm]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [form, setForm] = useState({ title:"", product:"", mainBody:"", cta:"", keyVisuals:"", videoStyle:"Talking head", inspirationUrl:"", inspirationNote:"", hooks:["","","","",""], active:true });

  const createBrief = async () => {
    if (!form.title) return;
    const brief = { ...form, id: Date.now().toString(), createdAt: new Date().toISOString(), hooks: form.hooks.filter(Boolean) };
    await addBrief(brief);
    setShowForm(false);
    setForm({ title:"", product:"", mainBody:"", cta:"", keyVisuals:"", videoStyle:"Talking head", inspirationUrl:"", inspirationNote:"", hooks:["","","","",""], active:true });
    showToast("Brief created");
  };

  const startEdit = (b, e) => {
    e.stopPropagation();
    const paddedHooks = [...(b.hooks||[])];
    while (paddedHooks.length < 5) paddedHooks.push("");
    setEditForm({ ...b, hooks: paddedHooks });
    setEditingBrief(b.id);
  };

  const saveEdit = async (e) => {
    e.stopPropagation();
    if (!editForm.title) return;
    const updated = { ...editForm, hooks: editForm.hooks.filter(Boolean) };
    await updateBrief(updated);
    setEditingBrief(null);
    setEditForm(null);
    showToast("Brief updated");
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingBrief(null);
    setEditForm(null);
  };

  const assignBrief = async (brief, creatorId, date) => {
    const creator = creators.find(c => c.id===creatorId);
    const filledHooks = brief.hooks.filter(h => h && h.trim() !== "");
    const newVideos = filledHooks.map((hook,i) => ({
      id: `${Date.now()}-${i}`, briefId: brief.id, creatorId,
      title: `${brief.title} — ${creator?.name}`, hook: hook,
      mainBody: brief.mainBody, videoStyle: brief.videoStyle,
      status: "assigned", date: date||new Date().toISOString().split("T")[0],
      platform: creator?.platform||"TikTok", notes:"", videoUrl:"", reviewChecks:{}, reviewNote:"",
    }));
    await addVideos(newVideos);
    setAssignModal(null);
    showToast(`Assigned ${newVideos.length} video${newVideos.length!==1?"s":""} to ${creator?.name}`);
  };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ fontWeight:600, fontSize:22, color:"#111111" }}>Content Briefs</h2><p style={{ color:"#6B6B6B", fontSize:13, marginTop:3 }}>Create briefs with hooks, body, visuals — assign to creators</p></div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New Brief</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="section-label" style={{ marginBottom:16 }}>New brief</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div><div className="field-label">Brief title</div><input placeholder="e.g. Y2K week" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))}/></div>
            <div><div className="field-label">Product / category</div><input placeholder="e.g. Y2K finds on Tilt" value={form.product} onChange={e => setForm(f => ({...f,product:e.target.value}))}/></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div><div className="field-label">Video delivery</div><select value={form.videoStyle} onChange={e => setForm(f => ({...f,videoStyle:e.target.value}))}>{VIDEO_STYLES.map(s => <option key={s}>{s}</option>)}</select></div>
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
              <div className="field-label" style={{ marginBottom:0 }}>Hooks (up to 5)</div>
              <button className="btn-ghost" style={{ fontSize:11, padding:"3px 8px" }} onClick={() => setForm(f => ({...f,hooks:HOOK_TEMPLATES.slice(0,5)}))}>Auto-fill</button>
            </div>
            {form.hooks.map((h,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ fontSize:11, color:"#A0A0A0", minWidth:20, fontWeight:500 }}>H{i+1}</div>
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
        <div style={{ position:"relative", marginBottom:4 }}>
          <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#A0A0A0", pointerEvents:"none" }}>⌕</div>
          <input placeholder="Search briefs — title, hooks, body…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:32 }}/>
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#A0A0A0", fontSize:14, cursor:"pointer", lineHeight:1 }}>✕</button>}
        </div>

        {(() => {
          const q = search.toLowerCase().trim();
          const filtered = q ? briefs.filter(b =>
            b.title?.toLowerCase().includes(q) ||
            b.product?.toLowerCase().includes(q) ||
            b.mainBody?.toLowerCase().includes(q) ||
            b.cta?.toLowerCase().includes(q) ||
            b.videoStyle?.toLowerCase().includes(q) ||
            (b.hooks||[]).some(h => h?.toLowerCase().includes(q))
          ) : briefs;
          if (filtered.length === 0) return <div style={{ color:"#A0A0A0", fontSize:13, textAlign:"center", padding:"30px 0" }}>{q ? `No briefs matching "${q}"` : "No briefs yet."}</div>;
          return filtered.map(b => (
          <div key={b.id} className="card" style={{ cursor:"pointer", borderColor: editingBrief===b.id ? "#111111" : activeBrief?.id===b.id?"#111111":"#E5E5E5" }} onClick={() => editingBrief!==b.id && setActiveBrief(activeBrief?.id===b.id?null:b)}>

            {editingBrief===b.id && editForm ? (
              <div onClick={e => e.stopPropagation()}>
                <div className="section-label" style={{ marginBottom:14 }}>Editing brief</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div><div className="field-label">Brief title</div><input value={editForm.title} onChange={e => setEditForm(f => ({...f,title:e.target.value}))}/></div>
                  <div><div className="field-label">Product / category</div><input value={editForm.product||""} onChange={e => setEditForm(f => ({...f,product:e.target.value}))}/></div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div><div className="field-label">Video delivery</div><select value={editForm.videoStyle||"Talking head"} onChange={e => setEditForm(f => ({...f,videoStyle:e.target.value}))}>{VIDEO_STYLES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><div className="field-label">Inspiration link</div><input value={editForm.inspirationUrl||""} onChange={e => setEditForm(f => ({...f,inspirationUrl:e.target.value}))}/></div>
                </div>
                {editForm.inspirationUrl && <div style={{ marginBottom:12 }}><div className="field-label">What to take from this</div><input value={editForm.inspirationNote||""} onChange={e => setEditForm(f => ({...f,inspirationNote:e.target.value}))}/></div>}
                <div style={{ marginBottom:12 }}><div className="field-label">Main body script</div><textarea rows={4} value={editForm.mainBody||""} onChange={e => setEditForm(f => ({...f,mainBody:e.target.value}))} style={{resize:"vertical"}}/></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                  <div><div className="field-label">CTA</div><input value={editForm.cta||""} onChange={e => setEditForm(f => ({...f,cta:e.target.value}))}/></div>
                  <div><div className="field-label">Key visuals / b-roll</div><input value={editForm.keyVisuals||""} onChange={e => setEditForm(f => ({...f,keyVisuals:e.target.value}))}/></div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div className="field-label" style={{ marginBottom:8 }}>Hooks (up to 5)</div>
                  {editForm.hooks.map((h,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <div style={{ fontSize:11, color:"#A0A0A0", minWidth:20, fontWeight:500 }}>H{i+1}</div>
                      <input placeholder={`Hook ${i+1}…`} value={h} onChange={e => { const hooks=[...editForm.hooks]; hooks[i]=e.target.value; setEditForm(f => ({...f,hooks})); }}/>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-primary" style={{ fontSize:12 }} onClick={saveEdit}>Save changes</button>
                  <button className="btn-ghost" style={{ fontSize:12 }} onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:500, fontSize:14, color:"#111111" }}>{b.title}</span>
                      {b.product && <span className="tag">{b.product}</span>}
                      {b.videoStyle && <span className="tag" style={{ color:"#2563EB", background:"#EFF6FF" }}>{b.videoStyle}</span>}
                      {(() => {
                        const briefVids = videos.filter(v => v.briefId === b.id);
                        if (briefVids.length === 0) return <span className="tag">not started</span>;
                        const allPosted = briefVids.every(v => v.status === "posted");
                        if (allPosted) return <span className="tag" style={{ color:"#16A34A", background:"#F0FDF4" }}>complete</span>;
                        return <span className="tag" style={{ color:"#D97706", background:"#FEF3C7" }}>in progress</span>;
                      })()}
                    </div>
                    <div style={{ fontSize:12, color:"#6B6B6B" }}>{b.hooks?.length||0} hooks · {new Date(b.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={e => startEdit(b, e)}>Edit</button>
                    <button className="btn-primary" style={{ fontSize:12, padding:"5px 12px" }} onClick={e => { e.stopPropagation(); setAssignModal(b); }}>Assign</button>
                    <button className="btn-ghost" style={{ fontSize:12, padding:"5px 12px", color:"#A0A0A0" }} onClick={e => { e.stopPropagation(); deleteBrief(b.id); }}>Delete</button>
                  </div>
                </div>
                {activeBrief?.id===b.id && (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #F5F5F5" }}>
                    {b.inspirationUrl && <div style={{ marginBottom:14, padding:"10px 12px", background:"#FAFAFA", borderRadius:8, border:"1px solid #E5E5E5" }}><div className="field-label">Inspiration</div><a href={b.inspirationUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563EB", textDecoration:"none" }}>{b.inspirationUrl}</a>{b.inspirationNote && <div style={{ fontSize:12, color:"#6B6B6B", marginTop:4 }}>{b.inspirationNote}</div>}</div>}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                      <div><div className="section-label" style={{ marginBottom:6 }}>Main body</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{b.mainBody||"—"}</div></div>
                      <div>
                        <div className="section-label" style={{ marginBottom:4 }}>Video delivery</div><div style={{ fontSize:13, color:"#2563EB", marginBottom:10 }}>{b.videoStyle||"—"}</div>
                        <div className="section-label" style={{ marginBottom:4 }}>CTA</div><div style={{ fontSize:13, color:"#6B6B6B", marginBottom:10 }}>{b.cta||"—"}</div>
                        <div className="section-label" style={{ marginBottom:4 }}>Key visuals</div><div style={{ fontSize:13, color:"#6B6B6B" }}>{b.keyVisuals||"—"}</div>
                      </div>
                    </div>
                    <div className="section-label" style={{ marginBottom:8 }}>Hooks</div>
                    {(b.hooks||[]).map((h,i) => <div key={i} style={{ display:"flex", gap:10, marginBottom:6 }}><span style={{ fontSize:11, color:"#E8C547", minWidth:20, fontWeight:600 }}>H{i+1}</span><span style={{ fontSize:13, color:"#111111", lineHeight:1.5 }}>{h}</span></div>)}
                  </div>
                )}
              </>
            )}
          </div>
          ));
        })()}
      </div>
      {assignModal && <AssignModal brief={assignModal} creators={creators} onAssign={assignBrief} onClose={() => setAssignModal(null)}/>}
    </div>
  );
}

function AssignModal({ brief, creators, onAssign, onClose }) {
  const [creatorId, setCreatorId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div className="card" style={{ width:400 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:600, fontSize:16, marginBottom:16, color:"#111111" }}>Assign brief</div>
        <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:4 }}>{brief.title}</div>
        {brief.videoStyle && <div style={{ fontSize:12, color:"#2563EB", marginBottom:16 }}>Style: {brief.videoStyle}</div>}
        <div style={{ marginBottom:12 }}><div className="field-label">Creator</div><select value={creatorId} onChange={e => setCreatorId(e.target.value)}><option value="">— Choose —</option>{creators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}</select></div>
        <div style={{ marginBottom:20 }}><div className="field-label">Due date</div><input type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
        <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={() => creatorId && onAssign(brief,creatorId,date)} style={{ opacity:creatorId?1:0.5 }}>Assign {brief.hooks?.filter(h=>h&&h.trim()).length||0} videos</button><button className="btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ── Video Board ──────────────────────────────────────────────────────────────
function VideoBoard({ videos, updateVideo, deleteVideo, creators, briefs, showToast, setReviewing }) {
  const [filter,     setFilter]     = useState("all");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [editingId,  setEditingId]  = useState(null);
  const [dragId,     setDragId]     = useState(null);
  const [dragOver,   setDragOver]   = useState(null);

  const filtered = videos.filter(v => {
    if (filter !== "all" && v.creatorId !== filter) return false;
    if (dateFilter && v.date !== dateFilter) return false;
    return true;
  });
  const grouped = STATUSES.reduce((acc,s) => { acc[s]=filtered.filter(v => v.status===s); return acc; }, {});

  const formatDate = (d) => {
    if (!d) return "";
    const diff = Math.ceil((new Date(d) - new Date(todayStr)) / (1000*60*60*24));
    if (diff === 0) return "due today";
    if (diff === 1) return "due tomorrow";
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    return `due ${new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}`;
  };
  const dateColor = (d) => {
    if (!d) return "#A0A0A0";
    const diff = Math.ceil((new Date(d) - new Date(todayStr)) / (1000*60*60*24));
    if (diff < 0) return "#DC2626";
    if (diff === 0) return "#D97706";
    return "#6B6B6B";
  };

  const onDragStart = (e, vidId) => { setDragId(vidId); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, status) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(status); };
  const onDrop = (e, status) => { e.preventDefault(); if (dragId && status) { updateVideo(dragId, { status }); showToast(`Moved to ${status}`); } setDragId(null); setDragOver(null); };
  const onDragEnd = () => { setDragId(null); setDragOver(null); };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ fontWeight:600, fontSize:22, color:"#111111" }}>Video Board</h2><p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Drag cards between columns to update status</p></div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width:"auto" }}/>
        <button className={dateFilter===todayStr?"btn-primary":"btn-ghost"} onClick={() => setDateFilter(todayStr)} style={{ fontSize:12, padding:"6px 12px" }}>Today</button>
        <button className={dateFilter===""?"btn-primary":"btn-ghost"} onClick={() => setDateFilter("")} style={{ fontSize:12, padding:"6px 12px" }}>All dates</button>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:"auto" }}>
          <option value="all">All creators</option>
          {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize:12, color:"#A0A0A0" }}>{filtered.length} video{filtered.length!==1?"s":""}</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {STATUSES.map(status => (
          <div
            key={status}
            style={{ background:dragOver===status?"#F0FDF4":"#F7F7F7", border:`1px solid ${dragOver===status?"#BBF7D0":"#E5E5E5"}`, borderRadius:8, padding:12, transition:"all 0.15s", minHeight:120 }}
            onDragOver={e => onDragOver(e, status)}
            onDrop={e => onDrop(e, status)}
            onDragLeave={() => setDragOver(null)}
          >
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <StatusBadge status={status} />
              <span style={{ marginLeft:"auto", fontSize:12, color:"#A0A0A0", fontWeight:500 }}>{grouped[status]?.length||0}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(grouped[status]||[]).map(vid => {
                const creator  = creators.find(c => c.id===vid.creatorId);
                const brief    = briefs.find(b => b.id===vid.briefId);
                const isEditing = editingId===vid.id;
                const isDragging = dragId===vid.id;
                return (
                  <div
                    key={vid.id}
                    draggable={!isEditing}
                    onDragStart={e => onDragStart(e, vid.id)}
                    onDragEnd={onDragEnd}
                    className="card"
                    style={{ padding:12, borderColor:isEditing?"#111111":"#E5E5E5", opacity:isDragging?0.4:1, cursor:isEditing?"default":"grab", transition:"opacity 0.15s" }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:creator?.color+"15", border:`1px solid ${creator?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:creator?.color, fontWeight:600 }}>{creator?.avatar}</div>
                      <span style={{ fontSize:12, color:"#6B6B6B" }}>{creator?.name}</span>
                      <span className="tag" style={{ marginLeft:"auto", fontSize:10 }}>{vid.platform}</span>
                    </div>
                    <div style={{ fontSize:13, color:"#111111", marginBottom:4, lineHeight:1.4 }}>{vid.hook}</div>
                    {vid.videoStyle && <div style={{ fontSize:11, color:"#2563EB", marginBottom:3 }}>{vid.videoStyle}</div>}
                    {brief && <div style={{ fontSize:11, color:"#A0A0A0", marginBottom:3 }}>{brief.title}</div>}
                    {vid.date && <div style={{ fontSize:11, color:dateColor(vid.date), marginBottom:8 }}>{formatDate(vid.date)}</div>}

                    {isEditing ? (
                      <div>
                        <div style={{ marginBottom:6 }}><div style={{ fontSize:11, color:"#A0A0A0", marginBottom:3 }}>Video / Drive link</div><input placeholder="https://…" value={vid.videoUrl||""} onChange={e => updateVideo(vid.id,{videoUrl:e.target.value})} style={{ fontSize:12 }}/></div>
                        <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#A0A0A0", marginBottom:3 }}>Notes</div><textarea rows={2} value={vid.notes||""} onChange={e => updateVideo(vid.id,{notes:e.target.value})} style={{ fontSize:12, resize:"none" }}/></div>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => { setEditingId(null); showToast("Saved"); }}>Done</button>
                          <button className="btn-danger" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => { if(window.confirm("Delete this video?")) { deleteVideo(vid.id); showToast("Deleted"); } }}>Delete</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        <button className="btn-ghost" style={{ fontSize:11, padding:"4px 10px", flex:1 }} onClick={() => setEditingId(vid.id)}>Edit</button>
                        {(status==="first draft"||status==="second draft") && <button className="btn-primary" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => setReviewing(vid.id)}>Review</button>}
                      </div>
                    )}
                  </div>
                );
              })}
              {(grouped[status]||[]).length===0 && (
                <div style={{ fontSize:12, color: dragOver===status?"#16A34A":"#A0A0A0", textAlign:"center", padding:"16px 0", border:`2px dashed ${dragOver===status?"#BBF7D0":"#E5E5E5"}`, borderRadius:6, transition:"all 0.15s" }}>
                  {dragOver===status ? "drop here" : "—"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Review Room ──────────────────────────────────────────────────────────────
function ReviewRoom({ vid, creators, briefs, updateVideo, onClose, showToast, session, onSignOut }) {
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
    showToast(type==="approve" ? "Approved" : "Revision requested");
  };

  const failedLabels = REVIEW_CHECKS.filter(c => checks[c.id]===false).map(c => `✗ ${c.label}`);
  const slackMsg = decision==="approve"
    ? `✅ *${vid.hook}* — APPROVED\nCreator: ${cr?.name} (${cr?.handle})\nScore: ${score}/100\nReady to post. Tag @tilt_brand.${reviewNote?"\n\n"+reviewNote:""}`
    : `🔄 *${vid.hook}* — NEEDS REVISION\nCreator: ${cr?.name}\nScore: ${score}/100\n\n${failedLabels.join("\n")}${reviewNote?"\n\nNotes: "+reviewNote:""}`;

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", color:"#111111" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input,textarea,select{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;border-radius:6px;padding:8px 12px;font-family:'Inter',sans-serif;font-size:13px;outline:none;width:100%}
        input:focus,textarea:focus{outline:2px solid #111111;outline-offset:1px;border-color:#111111}
        input::placeholder,textarea::placeholder{color:#A0A0A0}
        .btn-primary{background:#111111;color:#FFFFFF;border:none;padding:8px 16px;border-radius:6px;font-weight:500;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-ghost{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-ghost:hover{border-color:#CCCCCC;background:#FAFAFA}
        .btn-danger{background:#FFFFFF;border:1px solid #FECACA;color:#DC2626;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
        .btn-success{background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:'Inter',sans-serif}
      `}</style>
      <div style={{ borderBottom:"1px solid #E5E5E5", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:52, background:"#FFFFFF", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button className="btn-ghost" style={{ fontSize:13, padding:"6px 12px" }} onClick={onClose}>← Back</button>
          <div style={{ width:1, height:20, background:"#E5E5E5" }}/>
          <div style={{ width:28, height:28, borderRadius:"50%", background:cr?.color+"15", border:`1px solid ${cr?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr?.color, fontWeight:600 }}>{cr?.avatar}</div>
          <div><span style={{ fontSize:13, color:"#111111", fontWeight:500 }}>{vid.hook}</span><span style={{ fontSize:12, color:"#6B6B6B", marginLeft:8 }}>{cr?.name}</span></div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ position:"relative", width:40, height:40 }}>
            <svg width="40" height="40" style={{ transform:"rotate(-90deg)" }}><circle cx="20" cy="20" r="15" fill="none" stroke="#F5F5F5" strokeWidth="3"/><circle cx="20" cy="20" r="15" fill="none" stroke={score>=80?"#16A34A":score>=50?"#D97706":"#DC2626"} strokeWidth="3" strokeDasharray={`${(score/100)*94} 94`} strokeLinecap="round"/></svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:score>=80?"#16A34A":score>=50?"#D97706":"#DC2626", fontWeight:600 }}>{score}</div>
          </div>
          {!decision && <><button className="btn-danger" onClick={() => handleDecision("revision")}>Request revision</button><button className="btn-success" onClick={() => handleDecision("approve")}>Approve</button></>}
          {decision && <span style={{ fontSize:12, padding:"4px 12px", borderRadius:100, background:decision==="approve"?"#F0FDF4":"#FEF2F2", color:decision==="approve"?"#16A34A":"#DC2626", fontWeight:500 }}>{decision==="approve"?"Approved":"Revision sent"}</span>}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", minHeight:"calc(100vh - 52px)" }}>
        <div style={{ padding:24, borderRight:"1px solid #E5E5E5", overflowY:"auto" }}>
          {brief && <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, padding:"10px 14px", marginBottom:14 }}><div style={{ fontSize:11, color:"#A0A0A0", marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>Brief</div><div style={{ fontSize:13, color:"#6B6B6B" }}>{brief.title}</div>{brief.videoStyle && <div style={{ fontSize:12, color:"#2563EB", marginTop:2 }}>Style: {brief.videoStyle}</div>}{brief.inspirationUrl && <a href={brief.inspirationUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563EB", textDecoration:"none", display:"block", marginTop:4 }}>View inspiration →</a>}</div>}
          <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, overflow:"hidden", marginBottom:16 }}>
            {driveUrl ? (<div style={{ position:"relative", paddingBottom:"56.25%" }}><iframe src={driveUrl.replace("/view","/preview")} style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }} allowFullScreen/></div>) : (<div style={{ height:220, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><div style={{ fontSize:28, opacity:.2 }}>▶</div><div style={{ fontSize:13, color:"#A0A0A0" }}>Paste Drive link below</div></div>)}
            <div style={{ padding:"10px 14px", borderTop:"1px solid #E5E5E5", display:"flex", gap:8, alignItems:"center" }}><input placeholder="Google Drive / video link" style={{ flex:1, fontSize:12 }} value={driveUrl} onChange={e => setDriveUrl(e.target.value)} onBlur={e => updateVideo(vid.id,{videoUrl:e.target.value})}/>{driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563EB", whiteSpace:"nowrap", textDecoration:"none" }}>Open ↗</a>}</div>
          </div>
          <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, padding:"12px 14px", marginBottom:16 }}><div style={{ fontSize:11, color:"#A0A0A0", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>Feedback notes</div><textarea rows={4} placeholder="Overall thoughts, what needs to change…" value={reviewNote} onChange={e => setReviewNote(e.target.value)} style={{ resize:"none", fontSize:13 }}/></div>
          {decision && <div style={{ background:"#FAFAFA", border:`1px solid ${decision==="approve"?"#BBF7D0":"#FECACA"}`, borderRadius:8, padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><div style={{ fontSize:11, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>Slack message</div><button className="btn-ghost" style={{ fontSize:11, padding:"3px 8px" }} onClick={() => { navigator.clipboard.writeText(slackMsg); showToast("Copied"); }}>Copy</button></div><div style={{ fontFamily:"monospace", fontSize:12, color:"#6B6B6B", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{slackMsg}</div></div>}
        </div>
        <div style={{ padding:"20px", overflowY:"auto", background:"#FAFAFA" }}>
          <div style={{ fontSize:11, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, marginBottom:4 }}>Review checklist</div>
          <div style={{ fontSize:12, color:"#A0A0A0", marginBottom:14 }}>Tap ✓ pass · ✗ fail · again to clear</div>
          {CHECK_CATS.map(cat => (
            <div key={cat} style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:CHECK_COLORS[cat], letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500, marginBottom:6, paddingLeft:8, borderLeft:`2px solid ${CHECK_COLORS[cat]}` }}>{cat}</div>
              {REVIEW_CHECKS.filter(c => c.category===cat).map(item => {
                const val = checks[item.id];
                return (
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 8px", borderRadius:6, background:val===true?"#F0FDF4":val===false?"#FEF2F2":"transparent" }}>
                    <button onClick={() => toggleCheck(item.id,true)} style={{ width:22, height:22, borderRadius:4, border:`1px solid ${val===true?"#16A34A":"#E5E5E5"}`, background:val===true?"#DCFCE7":"transparent", color:val===true?"#16A34A":"#A0A0A0", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>✓</button>
                    <button onClick={() => toggleCheck(item.id,false)} style={{ width:22, height:22, borderRadius:4, border:`1px solid ${val===false?"#DC2626":"#E5E5E5"}`, background:val===false?"#FEE2E2":"transparent", color:val===false?"#DC2626":"#A0A0A0", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>✗</button>
                    <span style={{ fontSize:12, color:val===true?"#16A34A":val===false?"#DC2626":"#6B6B6B", flex:1, lineHeight:1.3 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ background:"#FFFFFF", border:"1px solid #E5E5E5", borderRadius:8, padding:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
              <div><div style={{ fontSize:18, color:"#16A34A", fontWeight:600 }}>{passCount}</div><div style={{ fontSize:11, color:"#A0A0A0" }}>passed</div></div>
              <div><div style={{ fontSize:18, color:"#DC2626", fontWeight:600 }}>{failCount}</div><div style={{ fontSize:11, color:"#A0A0A0" }}>failed</div></div>
              <div><div style={{ fontSize:18, color:"#A0A0A0", fontWeight:600 }}>{REVIEW_CHECKS.length-passCount-failCount}</div><div style={{ fontSize:11, color:"#A0A0A0" }}>skipped</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Creators ─────────────────────────────────────────────────────────────────
function Creators({ creators, addCreator, updateCreator, videos, showToast }) {
  const [showAdd,    setShowAdd]    = useState(false);
  const [profileId,  setProfileId]  = useState(null);
  const [form, setForm] = useState({ name:"", handle:"", platform:"TikTok" });

  const handleAdd = async () => {
    if (!form.name) return;
    const initials = form.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
    const colors   = ["#E8C547","#2563EB","#D97706","#16A34A","#7C3AED","#DC2626","#0891B2"];
    const c = { id:Date.now().toString(), ...form, avatar:initials, color:colors[creators.length%colors.length], status:"active", phone:"", email:"", whatsapp:"", instagram:"", tiktok:"", category:"", notes:"", checkIns:[] };
    await supabase.from("creators").insert([{ id:c.id, name:c.name, handle:c.handle, avatar:c.avatar, color:c.color, platform:c.platform, status:c.status, phone:"", email:"", whatsapp:"", instagram:"", tiktok:"", category:"", notes:"", check_ins:[], auth_email:"" }]);
    await addCreator(c);
    setShowAdd(false);
    setForm({ name:"", handle:"", platform:"TikTok" });
    showToast("Creator added");
  };

  if (profileId) {
    const cr = creators.find(c => c.id===profileId);
    if (!cr) { setProfileId(null); return null; }
    return <CreatorProfile cr={cr} updateCreator={updateCreator} videos={videos} onClose={() => setProfileId(null)} showToast={showToast}/>;
  }

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ fontWeight:600, fontSize:22, color:"#111111" }}>Creators</h2><p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Manage your roster of {creators.length} creators</p></div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add creator</button>
      </div>
      {showAdd && (
        <div className="card" style={{ marginBottom:16 }}>
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
                <div style={{ width:44, height:44, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:cr.color, fontWeight:600, flexShrink:0 }}>{cr.avatar}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, color:"#111111", fontWeight:500 }}>{cr.name}</div>
                  <div style={{ fontSize:12, color:"#6B6B6B" }}>{cr.category||cr.platform}{cr.instagram?` · ${cr.instagram}`:""}{cr.tiktok?` · ${cr.tiktok}`:""}</div>
                </div>
                <div style={{ width:8, height:8, borderRadius:"50%", background:cr.status==="active"?"#16A34A":"#A0A0A0" }}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                {[{val:todayVids.length,lbl:"today",color:cr.color},{val:posted,lbl:"posted",color:"#111111"},{val:myVideos.length,lbl:"total",color:"#111111"}].map(s => (
                  <div key={s.lbl} style={{ background:"#FAFAFA", borderRadius:6, padding:"8px 10px", textAlign:"center", border:"1px solid #E5E5E5" }}>
                    <div style={{ fontSize:16, fontWeight:600, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:11, color:"#A0A0A0" }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {cr.phone && <a href={`tel:${cr.phone}`} style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#F5F5F5", color:"#6B6B6B", textDecoration:"none" }}>📞 {cr.phone}</a>}
                {cr.whatsapp && <a href={`https://wa.me/${cr.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#F0FDF4", color:"#16A34A", textDecoration:"none" }}>WhatsApp</a>}
                {cr.instagram && <a href={`https://instagram.com/${cr.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#F5F3FF", color:"#7C3AED", textDecoration:"none" }}>IG {cr.instagram}</a>}
                {cr.tiktok && <a href={`https://tiktok.com/@${cr.tiktok.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#EFF6FF", color:"#2563EB", textDecoration:"none" }}>TT {cr.tiktok}</a>}
                {lastCheckIn && <span style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#F5F5F5", color:"#6B6B6B" }}>Check-in: {new Date(lastCheckIn.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button className="btn-primary" style={{ fontSize:12, padding:"6px 12px", flex:1 }} onClick={() => setProfileId(cr.id)}>View profile</button>
                <button className="btn-ghost" style={{ fontSize:12, padding:"6px 10px" }} onClick={() => updateCreator(cr.id, { status: cr.status==="active"?"inactive":"active" })}>
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

// ── Creator Profile ──────────────────────────────────────────────────────────
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
    showToast("Saved");
  };

  const addCheckIn = async () => {
    if (!newCheckIn.notes.trim()) return;
    const updated = [...(cr.checkIns||[]), { ...newCheckIn, id:Date.now().toString() }];
    await updateCreator(cr.id, { checkIns: updated });
    setShowCheckInForm(false);
    setNewCheckIn({ date:new Date().toISOString().split("T")[0], type:"weekly-call", notes:"" });
    showToast("Check-in logged");
  };

  const TABS = [["contact","Contact"],["comms","Comms log"],["performance","Performance"],["notes","Notes"]];
  const CHECK_IN_TYPES = ["daily-message","weekly-call","monthly-1-1","feedback-call","ad-hoc"];

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
        <button className="btn-ghost" style={{ fontSize:12 }} onClick={onClose}>← All creators</button>
        <div style={{ width:40, height:40, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:cr.color, fontWeight:600 }}>{cr.avatar}</div>
        <div>
          <div style={{ fontSize:18, color:"#111111", fontWeight:600 }}>{cr.name}</div>
          <div style={{ fontSize:12, color:"#6B6B6B" }}>{cr.category||cr.platform}{cr.instagram?` · IG ${cr.instagram}`:""}{cr.tiktok?` · TT ${cr.tiktok}`:""}</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {cr.phone && <a href={`tel:${cr.phone}`} style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#FAFAFA", color:"#6B6B6B", border:"1px solid #E5E5E5", textDecoration:"none" }}>📞 Call</a>}
          {cr.whatsapp && <a href={`https://wa.me/${cr.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#F0FDF4", color:"#16A34A", border:"1px solid #BBF7D0", textDecoration:"none" }}>WhatsApp</a>}
          {cr.email && <a href={`mailto:${cr.email}`} style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#FAFAFA", color:"#6B6B6B", border:"1px solid #E5E5E5", textDecoration:"none" }}>✉ Email</a>}
          {cr.instagram && <a href={`https://instagram.com/${cr.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#F5F3FF", color:"#7C3AED", border:"1px solid #E9D5FF", textDecoration:"none" }}>Instagram</a>}
          {cr.tiktok && <a href={`https://tiktok.com/@${cr.tiktok.replace("@","")}`} target="_blank" rel="noreferrer" style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#EFF6FF", color:"#2563EB", border:"1px solid #BFDBFE", textDecoration:"none" }}>TikTok</a>}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[{label:"Videos posted",val:posted,color:"#16A34A"},{label:"Total assigned",val:myVideos.length,color:"#111111"},{label:"Avg review score",val:avgScore?`${avgScore}/100`:"—",color:"#E8C547"},{label:"Check-ins",val:cr.checkIns?.length||0,color:"#2563EB"}].map(s => (
          <div key={s.label} className="card" style={{ padding:"12px 14px" }}>
            <div className="section-label" style={{ marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:0, marginBottom:20, borderBottom:"1px solid #E5E5E5" }}>
        {TABS.map(([v,l]) => <button key={v} className={`nav-link${tab===v?" active":""}`} style={{ fontSize:13 }} onClick={() => setTab(v)}>{l}</button>)}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
          {tab==="contact" && !editing && <button className="btn-ghost" style={{ fontSize:12 }} onClick={() => setEditing(true)}>Edit profile</button>}
          {tab==="contact" && editing && <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:12 }} onClick={saveEdits}>Save</button><button className="btn-ghost" style={{ fontSize:12 }} onClick={() => { setDraft({...cr}); setEditing(false); }}>Cancel</button></div>}
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
            { label:"Auth email",      field:"authEmail", placeholder:"creator's Google login email" },
          ].map(({ label, field, placeholder, href, type, options }) => (
            <div key={field} className="card" style={{ padding:"14px 16px" }}>
              <div className="field-label" style={{ marginBottom:6 }}>{label}</div>
              {editing ? (
                type==="select" ?
                  <select value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}>{options.map(o => <option key={o}>{o}</option>)}</select> :
                  <input placeholder={placeholder} value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}/>
              ) : (
                cr[field] ?
                  (href ? <a href={href(cr[field])} style={{ fontSize:13, color:"#2563EB", textDecoration:"none" }}>{cr[field]}</a> : <div style={{ fontSize:13, color:"#111111" }}>{cr[field]}</div>) :
                  <div style={{ fontSize:13, color:"#A0A0A0", fontStyle:"italic" }}>Not set — click Edit profile</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="comms" && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:8, color:"#111111" }}>Communication rhythm</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { type:"Daily (async)", desc:"WhatsApp or Slack DM. Brief confirmation, quick flags. Voice notes work best.", color:"#E8C547" },
                { type:"Weekly (15 min)", desc:"Monday check-in. Last week's numbers, this week's hooks, any blockers.", color:"#2563EB" },
                { type:"Monthly (30 min)", desc:"Proper 1-to-1. Broader feedback, their growth. This is what prevents churn.", color:"#16A34A" },
              ].map(r => (
                <div key={r.type} style={{ background:"#FAFAFA", border:`1px solid #E5E5E5`, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:12, color:r.color, fontWeight:600, marginBottom:4 }}>{r.type}</div>
                  <div style={{ fontSize:12, color:"#6B6B6B", lineHeight:1.5 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div className="section-label">Check-in log ({cr.checkIns?.length||0})</div>
            <button className="btn-primary" style={{ fontSize:12, padding:"5px 12px" }} onClick={() => setShowCheckInForm(!showCheckInForm)}>+ Log check-in</button>
          </div>
          {showCheckInForm && (
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><div className="field-label">Date</div><input type="date" value={newCheckIn.date} onChange={e => setNewCheckIn(n => ({...n,date:e.target.value}))}/></div>
                <div><div className="field-label">Type</div><select value={newCheckIn.type} onChange={e => setNewCheckIn(n => ({...n,type:e.target.value}))}>{CHECK_IN_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ marginBottom:10 }}><div className="field-label">Notes</div><textarea rows={3} placeholder="What did you cover? Any action points?" value={newCheckIn.notes} onChange={e => setNewCheckIn(n => ({...n,notes:e.target.value}))} style={{ resize:"none" }}/></div>
              <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:12 }} onClick={addCheckIn}>Save</button><button className="btn-ghost" style={{ fontSize:12 }} onClick={() => setShowCheckInForm(false)}>Cancel</button></div>
            </div>
          )}
          {(cr.checkIns||[]).length===0 && !showCheckInForm && <div style={{ color:"#A0A0A0", fontSize:13, textAlign:"center", padding:"30px 0" }}>No check-ins logged yet</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...(cr.checkIns||[])].reverse().map(ci => (
              <div key={ci.id} className="card" style={{ padding:"12px 14px", borderLeft:`3px solid ${ci.type==="monthly-1-1"?"#16A34A":ci.type==="weekly-call"?"#2563EB":"#E8C547"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:12, color:"#111111", fontWeight:500 }}>{new Date(ci.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
                  <span className="tag" style={{ fontSize:10 }}>{ci.type.replace(/-/g," ")}</span>
                </div>
                <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.6 }}>{ci.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="performance" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {myVideos.length===0 && <div style={{ color:"#A0A0A0", fontSize:13, textAlign:"center", padding:"40px 0" }}>No videos assigned yet</div>}
          {myVideos.slice().reverse().map(v => (
            <div key={v.id} className="card" style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:"#111111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.hook}</div>
                <div style={{ fontSize:12, color:"#6B6B6B", marginTop:2 }}>{v.date} · {v.platform}{v.videoStyle?` · ${v.videoStyle}`:""}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                {v.score && <div style={{ fontSize:12, color:v.score>=80?"#16A34A":v.score>=50?"#D97706":"#DC2626", fontWeight:500 }}>{v.score}/100</div>}
                <StatusBadge status={v.status} />
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
            <button className="btn-primary" style={{ fontSize:13 }} onClick={() => { updateCreator(cr.id, { notes:draft.notes }); showToast("Notes saved"); }}>Save notes</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Strategy ─────────────────────────────────────────────────────────────────
function Strategy({ creators, videos, briefs, tips, addTip, deleteTip, showToast }) {
  const [tab, setTab] = useState("why");
  const tabs = [["why","Why this system"],["playbook","Daily playbook"],["hooks","Hook science"],["scale","How to scale"],["tips","Creator tips"]];
  return (
    <div className="fade">
      <div style={{ marginBottom:24 }}><h2 style={{ fontWeight:600, fontSize:22, color:"#111111" }}>Strategy & Playbook</h2><p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Built from r/ClaudeAI · r/marketing · r/startups</p></div>
      <div style={{ display:"flex", gap:0, marginBottom:20, borderBottom:"1px solid #E5E5E5" }}>
        {tabs.map(([v,l]) => <button key={v} className={`nav-link${tab===v?" active":""}`} style={{ fontSize:13 }} onClick={() => setTab(v)}>{l}</button>)}
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
        {label && <span style={{ fontSize:10, padding:"3px 8px", borderRadius:100, background:labelColor+"15", color:labelColor, letterSpacing:"0.06em", fontWeight:500 }}>{label}</span>}
        <span style={{ fontSize:14, fontWeight:500, color:"#111111" }}>{title}</span>
      </div>
      <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7 }}>{children}</div>
    </div>
  );
}

function StrategyWhy({ creators }) {
  const n = creators.filter(c => c.status==="active").length;
  return (
    <div>
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontWeight:600, fontSize:18, marginBottom:8, color:"#111111" }}>The volume-first UGC model</div>
        <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7 }}>Reddit's top UGC threads agree: the #1 mistake brands make is betting on 1–2 hero videos. The algorithm rewards <strong style={{ color:"#111111" }}>volume + variation</strong>. With {n} creators × 5 videos = <strong style={{ color:"#E8C547" }}>{n*5} videos/day</strong>, you run a natural split-test on hooks every 24 hours.</div>
      </div>
      <Block title="Same body, different hook — the split-test engine" label="CORE PRINCIPLE" labelColor="#E8C547">The main body script is your proven message. The hook (first 3 seconds) determines whether someone stops scrolling. Keeping the body identical and varying only the hook gives you a clean A/B test every day.</Block>
      <Block title="Why 5 videos per creator?" label="FROM r/STARTUPS" labelColor="#2563EB">Founders report that posting frequency under 3 videos/day per account leads to stagnant reach. 5 is the sweet spot — enough to test variations, not so many the algorithm deprioritises the account.</Block>
      <Block title="Why multiple creators for the same brief?" label="FROM r/MARKETING" labelColor="#D97706">Different creators attract different audiences. Same brief across all creators = audience diversification for free.</Block>
      <Block title="UGC builds trust that ads can't buy" label="REDDIT CONSENSUS" labelColor="#16A34A">UGC converts 4–6× better than polished brand ads. Your daily videos function as both ads and social proof simultaneously.</Block>
    </div>
  );
}

function StrategyPlaybook() {
  const steps = [
    { time:"8:00am", action:"Morning brief",    detail:"Lock the day's brief. All creators have their assignments.",                              why:"Creators need hooks before they start. Ambiguity kills momentum.",                      color:"#E8C547" },
    { time:"9:00am", action:"Creators film",    detail:"Each creator films 5 hook variations back-to-back using the same body.",                  why:"Batch filming = performance mode once, not resetting 5 times.",                        color:"#D97706" },
    { time:"12:00pm",action:"Editing window",   detail:"Only the hook section changes per version — body is one edit applied to all.",            why:"One body edit = 80% done. Five hook edits on top = marginal extra time.",              color:"#2563EB" },
    { time:"2:00pm", action:"Review & approve", detail:"Review all videos using the checklist. Approve or request revision.",                     why:"Central approval prevents off-brand content going live.",                               color:"#16A34A" },
    { time:"3–7pm",  action:"Staggered posting",detail:"Creators post throughout peak hours — NOT all at once.",                                   why:"Staggering prevents the algorithm treating you as a bot.",                             color:"#7C3AED" },
    { time:"8:00pm", action:"Daily debrief",    detail:"Check which hooks are getting the most views/saves in first 2 hours.",                    why:"Hour 1–2 signal predicts total reach. This is how you compound results.",              color:"#E8C547" },
  ];
  return (
    <div>
      <div className="card" style={{ marginBottom:20 }}><div style={{ fontWeight:600, fontSize:16, marginBottom:4, color:"#111111" }}>Daily operating rhythm</div><div style={{ fontSize:13, color:"#6B6B6B" }}>Creators × 5 videos · staggered posting</div></div>
      {steps.map((s,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:s.color+"15", border:`1px solid ${s.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:s.color, fontWeight:600, flexShrink:0 }}>{i+1}</div>
            {i<steps.length-1 && <div style={{ width:1, flex:1, background:"#E5E5E5", margin:"4px 0" }}/>}
          </div>
          <div className="card" style={{ marginBottom:10, marginLeft:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}><span style={{ fontSize:12, color:s.color, fontWeight:500 }}>{s.time}</span><span style={{ fontSize:13, fontWeight:500, color:"#111111" }}>{s.action}</span></div>
            <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:8, lineHeight:1.5 }}>{s.detail}</div>
            <div style={{ fontSize:12, color:"#6B6B6B", background:"#FAFAFA", padding:"8px 10px", borderRadius:6, borderLeft:`2px solid ${s.color}` }}><strong style={{ color:"#111111" }}>Why: </strong>{s.why}</div>
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
      <div className="card" style={{ marginBottom:20 }}><div style={{ fontWeight:600, fontSize:16, marginBottom:6, color:"#111111" }}>Hook science — the first 3 seconds</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7 }}>The hook is the <strong style={{ color:"#E8C547" }}>only part of your video that earns the watch</strong>. 70% of your testing effort should go on hooks, not production quality.</div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {frameworks.map((f,i) => (
          <div key={i} className="card">
            <div style={{ fontSize:14, color:"#111111", fontWeight:600, marginBottom:6 }}>{f.name}</div>
            <div style={{ fontSize:13, color:"#A0A0A0", marginBottom:8, fontStyle:"italic" }}>{f.template}</div>
            <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:10, lineHeight:1.6 }}>{f.why}</div>
            <div style={{ background:"#F0FDF4", borderRadius:6, padding:"8px 12px", fontSize:12, color:"#16A34A", borderLeft:"2px solid #16A34A" }}><strong style={{ color:"#111111" }}>Example: </strong>{f.example}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyScale() {
  const phases = [
    { phase:"Phase 1", title:"Prove the system (weeks 1–4)",       color:"#E8C547", steps:["Run 1 brief per week. Track which hook type wins.","Identify your best-performing creator per platform.","Don't change the body script — only iterate hooks based on data.","Build a hook leaderboard — 1 winner per week minimum."] },
    { phase:"Phase 2", title:"Double down on winners (weeks 5–8)", color:"#2563EB", steps:["Take your top 3 hooks — give each creator a variation of those.","Introduce platform-specific brief variations: TikTok hooks ≠ Instagram.","Start a second brief track: awareness (TOFU) vs conversion (BOFU).","Add a creator who specialises in the format that's working."] },
    { phase:"Phase 3", title:"Scale to machine (month 3+)",        color:"#D97706", steps:["Build a hook vault — every winner goes in. Rotate every 4–6 weeks.","Use Claude to generate 20 hook variations per brief — you pick the best 5.","Amplify: take top 2 organic videos each week and run as paid dark posts.","Whitelisting: creators post from their accounts, brand boosts with spend.","Track LTV by hook type: which hooks attract buyers vs watchers?"] },
  ];
  return (
    <div>
      <div className="card" style={{ marginBottom:20 }}><div style={{ fontWeight:600, fontSize:16, marginBottom:6, color:"#111111" }}>Long-term scaling roadmap</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7 }}>From r/startups: "The brands winning at UGC aren't creating better content — they're creating faster feedback loops."</div></div>
      {phases.map((p,i) => (
        <div key={i} className="card" style={{ marginBottom:12, borderLeft:`3px solid ${p.color}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}><span style={{ fontSize:10, padding:"3px 8px", borderRadius:100, background:p.color+"15", color:p.color, fontWeight:500 }}>{p.phase}</span><span style={{ fontSize:14, fontWeight:500, color:"#111111" }}>{p.title}</span></div>
          {p.steps.map((s,j) => <div key={j} style={{ display:"flex", gap:8, fontSize:13, color:"#6B6B6B", lineHeight:1.5, marginBottom:6 }}><span style={{ color:p.color, flexShrink:0 }}>→</span><span>{s}</span></div>)}
        </div>
      ))}
      <div className="card">
        <div style={{ fontSize:14, color:"#111111", marginBottom:8, fontWeight:600 }}>The optimisation checklist (run every Friday)</div>
        {["Which hook type got the highest watch-time this week?","Which creator drove the most profile visits or link clicks?","Which platform had the lowest CAC from UGC?","Is the main body script still converting — or is it time to refresh?","Are any creators declining in reach? (platform suppression — common after day 60)"].map((q,i) => (
          <div key={i} style={{ display:"flex", gap:8, fontSize:13, color:"#6B6B6B", padding:"5px 0", borderBottom:"1px solid #F5F5F5" }}><span style={{ color:"#A0A0A0" }}>□</span><span>{q}</span></div>
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
  const CAT_C    = { Delivery:"#2563EB", Hook:"#E8C547", Lighting:"#D97706", Audio:"#7C3AED", Editing:"#16A34A", Brand:"#E8C547", Platform:"#2563EB", Mindset:"#16A34A" };

  const handleAdd = async () => {
    if (!form.title) return;
    await addTip({ ...form, id:Date.now().toString(), createdAt:new Date().toISOString() });
    setShowAdd(false);
    setForm({ title:"", category:"Delivery", body:"", videoUrl:"", isLesson:false });
    showToast("Tip added");
  };

  return (
    <div>
      <div className="card" style={{ marginBottom:20 }}><div style={{ fontWeight:600, fontSize:18, marginBottom:6, color:"#111111" }}>Creator lessons & key tips</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7 }}>Add video advice and lessons here. New creators are sent to this section during onboarding.</div></div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}><button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add tip / lesson</button></div>
      {showAdd && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="section-label" style={{ marginBottom:14 }}>New tip or lesson</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><div className="field-label">Title</div><input placeholder="e.g. How to open with energy" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))}/></div>
            <div><div className="field-label">Category</div><select value={form.category} onChange={e => setForm(f => ({...f,category:e.target.value}))}>{TIP_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:10 }}><div className="field-label">Teaching / advice</div><textarea rows={4} placeholder="What should creators know, do, or avoid?" value={form.body} onChange={e => setForm(f => ({...f,body:e.target.value}))} style={{ resize:"vertical" }}/></div>
          <div style={{ marginBottom:14 }}><div className="field-label">Video reference link (optional)</div><input placeholder="https://… paste a video that shows this in action" value={form.videoUrl} onChange={e => setForm(f => ({...f,videoUrl:e.target.value}))}/></div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:18, height:18, borderRadius:4, border:`1px solid ${form.isLesson?"#111111":"#E5E5E5"}`, background:form.isLesson?"#111111":"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} onClick={() => setForm(f => ({...f,isLesson:!f.isLesson}))}>
              {form.isLesson && <span style={{ fontSize:11, color:"#FFFFFF" }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:"#6B6B6B" }}>Mark as required lesson</span>
          </div>
          <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={handleAdd}>Save</button><button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button></div>
        </div>
      )}
      {tips.filter(t => t.isLesson).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div className="section-label" style={{ marginBottom:10, color:"#E8C547" }}>Required lessons</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{tips.filter(t => t.isLesson).map(tip => <TipCard key={tip.id} tip={tip} active={active} setActive={setActive} deleteTip={deleteTip} CAT_C={CAT_C}/>)}</div>
        </div>
      )}
      <div className="section-label" style={{ marginBottom:10 }}>All tips {tips.length > 0 && `(${tips.length})`}</div>
      {tips.length===0 && <div style={{ color:"#A0A0A0", fontSize:13, textAlign:"center", padding:"40px 0" }}>No tips yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{tips.filter(t => !t.isLesson).map(tip => <TipCard key={tip.id} tip={tip} active={active} setActive={setActive} deleteTip={deleteTip} CAT_C={CAT_C}/>)}</div>
    </div>
  );
}

function TipCard({ tip, active, setActive, deleteTip, CAT_C }) {
  const col = CAT_C[tip.category]||"#6B6B6B";
  return (
    <div className="card" style={{ cursor:"pointer", borderLeft:`3px solid ${col}`, borderColor:active===tip.id?col:"#E5E5E5" }} onClick={() => setActive(active===tip.id?null:tip.id)}>
      <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"space-between" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
            <span style={{ fontSize:13, color:"#111111", fontWeight:500 }}>{tip.title}</span>
            {tip.isLesson && <span className="tag" style={{ background:"#FEF3C7", color:"#D97706" }}>Required</span>}
          </div>
          <div style={{ display:"flex", gap:8, fontSize:12 }}>
            <span style={{ color:col, fontWeight:500 }}>{tip.category}</span>
            <span style={{ color:"#A0A0A0" }}>{new Date(tip.createdAt).toLocaleDateString()}</span>
            {tip.videoUrl && <span style={{ color:"#6B6B6B" }}>· Video ref</span>}
          </div>
        </div>
        <button style={{ background:"none", border:"none", color:"#A0A0A0", fontSize:12, padding:"2px 6px", cursor:"pointer" }} onClick={e => { e.stopPropagation(); deleteTip(tip.id); }}>✕</button>
      </div>
      {active===tip.id && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F5F5F5" }}>
          <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7, marginBottom:tip.videoUrl?12:0, whiteSpace:"pre-wrap" }}>{tip.body}</div>
          {tip.videoUrl && <a href={tip.videoUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:"#2563EB", textDecoration:"none", padding:"6px 12px", border:"1px solid #BFDBFE", borderRadius:6, background:"#EFF6FF" }}>▶ Watch reference video</a>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CREATOR PORTAL ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function CreatorPortal({ creator, videos, briefs, briefIdeas, addBriefIdea, updateVideo, session, onSignOut, showToast, toast }) {
  const [tab, setTab] = useState("dashboard");

  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"◉" },
    { id:"videos",    label:"Videos",    icon:"▶" },
    { id:"ideas",     label:"Ideas",     icon:"💡" },
  ];

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", color:"#111111", paddingBottom:80 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input,textarea,select{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;border-radius:6px;padding:8px 12px;font-family:'Inter',sans-serif;font-size:14px;outline:none;width:100%}
        input:focus,textarea:focus{outline:2px solid #111111;outline-offset:1px;border-color:#111111}
        input::placeholder,textarea::placeholder{color:#A0A0A0}
        button{cursor:pointer;font-family:'Inter',sans-serif}
        .btn-primary{background:#111111;color:#FFFFFF;border:none;padding:10px 20px;border-radius:6px;font-weight:500;font-size:14px;cursor:pointer;font-family:'Inter',sans-serif;width:100%}
        .btn-primary:hover{opacity:0.85}
        .btn-ghost{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;padding:9px 16px;border-radius:6px;font-size:14px;cursor:pointer;font-family:'Inter',sans-serif;width:100%}
        .btn-ghost:hover{background:#FAFAFA}
        .card{background:#FFFFFF;border:1px solid #E5E5E5;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .tag{display:inline-block;padding:4px 8px;border-radius:100px;font-size:11px;font-weight:500;background:#F5F5F5;color:#6B6B6B}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        .fade{animation:fadeUp 0.2s ease both}
      `}</style>

      <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 20px" }}>
        {tab==="dashboard" && <CreatorDashboard creator={creator} videos={videos} briefs={briefs} addBriefIdea={addBriefIdea} showToast={showToast} session={session} onSignOut={onSignOut} />}
        {tab==="videos"    && <CreatorVideos creator={creator} videos={videos} briefs={briefs} updateVideo={updateVideo} showToast={showToast} />}
        {tab==="ideas"     && <CreatorIdeas creator={creator} briefIdeas={briefIdeas} addBriefIdea={addBriefIdea} showToast={showToast} />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#FFFFFF", borderTop:"1px solid #E5E5E5", height:60, display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
        <div style={{ display:"flex", maxWidth:520, width:"100%", justifyContent:"space-around" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"8px 16px", cursor:"pointer", color:tab===t.id?"#111111":"#A0A0A0", fontFamily:"'Inter',sans-serif" }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:11, fontWeight:tab===t.id?600:400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && <div style={{ position:"fixed", bottom:72, left:"50%", transform:"translateX(-50%)", background:"#111111", color:"#FFFFFF", padding:"10px 20px", borderRadius:8, fontSize:13, fontWeight:500, zIndex:999, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>{toast}</div>}
    </div>
  );
}

// ── Creator Dashboard ────────────────────────────────────────────────────────
function CreatorDashboard({ creator, videos, briefs, addBriefIdea, showToast, session, onSignOut }) {
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title:"", description:"" });
  const [ideaSubmitted, setIdeaSubmitted] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const wkStart = weekStart.toISOString().split("T")[0];
  const wkEnd = weekEnd.toISOString().split("T")[0];

  const weekVideos = videos.filter(v => v.date >= wkStart && v.date <= wkEnd);
  const weekBriefIds = [...new Set(weekVideos.map(v => v.briefId))];
  const weekBriefs = weekBriefIds.map(id => {
    const brief = briefs.find(b => b.id === id);
    const bVideos = weekVideos.filter(v => v.briefId === id);
    return { brief, videos: bVideos };
  }).filter(b => b.brief);

  const [expandedBrief, setExpandedBrief] = useState(null);

  const submitIdea = async () => {
    if (!ideaForm.title.trim()) return;
    await addBriefIdea({ id: Date.now().toString(), creatorId: creator.id, title: ideaForm.title, description: ideaForm.description });
    // Send email via EmailJS
    if (window.emailjs) {
      try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          creator_name: creator.name,
          idea_title: ideaForm.title,
          idea_description: ideaForm.description,
          to_email: ADMIN_NOTIFY_EMAIL,
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) { /* email send failed silently */ }
    }
    setIdeaSubmitted(true);
    setIdeaForm({ title:"", description:"" });
    showToast("Idea submitted!");
  };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontWeight:700, fontSize:26, color:"#111111" }}>Hey {creator.name.split(" ")[0]} 👋</div>
        <button onClick={onSignOut} style={{ background:"none", border:"none", fontSize:13, color:"#6B6B6B", cursor:"pointer" }}>Sign out</button>
      </div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:28 }}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Your briefs this week</div>
        {weekBriefs.length === 0 && <div className="card" style={{ textAlign:"center", color:"#A0A0A0", fontSize:13, padding:24 }}>No briefs assigned this week</div>}
        {weekBriefs.map(({ brief, videos: bVids }) => (
          <div key={brief.id} className="card" style={{ marginBottom:8, cursor:"pointer" }} onClick={() => setExpandedBrief(expandedBrief===brief.id?null:brief.id)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <div style={{ fontWeight:500, fontSize:14, color:"#111111" }}>{brief.title}</div>
              <span style={{ fontSize:16, color:"#A0A0A0", transform:expandedBrief===brief.id?"rotate(180deg)":"rotate(0)", transition:"transform 0.15s" }}>▾</span>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {brief.videoStyle && <span className="tag" style={{ background:"#EFF6FF", color:"#2563EB" }}>{brief.videoStyle}</span>}
              <span className="tag">{bVids.length} hook{bVids.length!==1?"s":""}</span>
              {bVids[0]?.date && <span style={{ fontSize:11, color:"#6B6B6B" }}>Due {new Date(bVids[0].date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
            </div>
            {expandedBrief===brief.id && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F5F5F5" }}>
                {brief.mainBody && <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.6, marginBottom:12, whiteSpace:"pre-wrap" }}>{brief.mainBody}</div>}
                {brief.cta && <div style={{ fontSize:12, color:"#111111", marginBottom:8 }}><strong>CTA:</strong> {brief.cta}</div>}
                <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Hooks</div>
                {bVids.map((v,i) => (
                  <div key={v.id} style={{ display:"flex", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, color:"#E8C547", fontWeight:600, minWidth:20 }}>H{i+1}</span>
                    <span style={{ fontSize:13, color:"#111111", lineHeight:1.5 }}>{v.hook}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ textAlign:"center" }}>
        <div style={{ fontSize:14, fontWeight:500, color:"#111111", marginBottom:4 }}>Got a brief idea?</div>
        <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:12 }}>Submit ideas for new briefs</div>
        <button className="btn-primary" style={{ width:"auto", display:"inline-block", padding:"10px 24px" }} onClick={() => { setShowIdeaModal(true); setIdeaSubmitted(false); }}>Submit idea →</button>
      </div>

      {showIdeaModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(2px)" }} onClick={() => setShowIdeaModal(false)}>
          <div className="card" style={{ width:"100%", maxWidth:440 }} onClick={e => e.stopPropagation()}>
            {ideaSubmitted ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
                <div style={{ fontSize:16, fontWeight:600, color:"#111111", marginBottom:4 }}>Idea submitted!</div>
                <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:16 }}>We'll review it and get back to you.</div>
                <button className="btn-ghost" style={{ width:"auto", display:"inline-block" }} onClick={() => setShowIdeaModal(false)}>Close</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight:600, fontSize:16, marginBottom:16 }}>Submit a brief idea</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Idea title</div>
                  <input placeholder="e.g. Summer vintage haul" value={ideaForm.title} onChange={e => setIdeaForm(f => ({...f,title:e.target.value}))} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Description (optional)</div>
                  <textarea rows={4} placeholder="Describe your idea — what's the angle, why would it work?" value={ideaForm.description} onChange={e => setIdeaForm(f => ({...f,description:e.target.value}))} style={{ resize:"vertical" }} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-primary" onClick={submitIdea}>Submit</button>
                  <button className="btn-ghost" onClick={() => setShowIdeaModal(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creator Videos ───────────────────────────────────────────────────────────
function CreatorVideos({ creator, videos, briefs, updateVideo, showToast }) {
  const [linkModal, setLinkModal] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");

  const assigned = videos.filter(v => v.status === "assigned");
  const inProduction = videos.filter(v => ["editing","first draft","second draft"].includes(v.status));
  const posted = videos.filter(v => v.status === "posted" || v.status === "approved");

  const [openSections, setOpenSections] = useState({ assigned:true, production:true, posted:false });
  const toggle = (s) => setOpenSections(prev => ({...prev,[s]:!prev[s]}));

  const moveToProduction = async (id) => {
    await updateVideo(id, { status:"editing" });
    showToast("Moved to In Production");
  };

  const submitLink = async () => {
    if (!linkUrl.trim() || !linkModal) return;
    await updateVideo(linkModal, { videoUrl:linkUrl, status:"posted" });
    setLinkModal(null);
    setLinkUrl("");
    showToast("TikTok link submitted!");
  };

  return (
    <div className="fade">
      <div style={{ fontWeight:700, fontSize:22, color:"#111111", marginBottom:4 }}>Your Videos</div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>{videos.length} total</div>

      {/* Assigned */}
      <div style={{ marginBottom:20 }}>
        <button onClick={() => toggle("assigned")} style={{ background:"none", border:"none", display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 0", cursor:"pointer" }}>
          <span style={{ fontSize:14, color:openSections.assigned?"#111111":"#6B6B6B", transform:openSections.assigned?"rotate(90deg)":"rotate(0)", transition:"transform 0.15s", display:"inline-block" }}>▶</span>
          <span style={{ fontSize:14, fontWeight:600, color:"#111111" }}>Assigned</span>
          <span className="tag" style={{ marginLeft:4 }}>{assigned.length}</span>
        </button>
        {openSections.assigned && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
            {assigned.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", padding:"12px 0", textAlign:"center" }}>No assigned videos</div>}
            {assigned.map(vid => {
              const brief = briefs.find(b => b.id === vid.briefId);
              const [expanded, setExpanded] = useState(false);
              return (
                <div key={vid.id} className="card">
                  <div style={{ fontSize:14, color:"#111111", fontWeight:500, marginBottom:4, lineHeight:1.4, cursor:"pointer" }} onClick={() => setExpanded(!expanded)}>{vid.hook}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                    {brief && <span className="tag">{brief.title}</span>}
                    {vid.date && <span style={{ fontSize:11, color:"#6B6B6B" }}>Due {new Date(vid.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
                  </div>
                  {expanded && vid.mainBody && (
                    <div style={{ paddingTop:8, borderTop:"1px solid #F5F5F5", marginBottom:8 }}>
                      <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.6, whiteSpace:"pre-wrap", marginBottom:4 }}>{vid.mainBody}</div>
                      {brief?.cta && <div style={{ fontSize:12, color:"#111111" }}><strong>CTA:</strong> {brief.cta}</div>}
                    </div>
                  )}
                  <button className="btn-primary" style={{ fontSize:13 }} onClick={() => moveToProduction(vid.id)}>Move to In Production</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* In Production */}
      <div style={{ marginBottom:20 }}>
        <button onClick={() => toggle("production")} style={{ background:"none", border:"none", display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 0", cursor:"pointer" }}>
          <span style={{ fontSize:14, color:openSections.production?"#111111":"#6B6B6B", transform:openSections.production?"rotate(90deg)":"rotate(0)", transition:"transform 0.15s", display:"inline-block" }}>▶</span>
          <span style={{ fontSize:14, fontWeight:600, color:"#111111" }}>In Production</span>
          <span className="tag" style={{ marginLeft:4 }}>{inProduction.length}</span>
        </button>
        {openSections.production && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
            {inProduction.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", padding:"12px 0", textAlign:"center" }}>No videos in production</div>}
            {inProduction.map(vid => {
              const brief = briefs.find(b => b.id === vid.briefId);
              return (
                <div key={vid.id} className="card">
                  <div style={{ fontSize:14, color:"#111111", fontWeight:500, marginBottom:4, lineHeight:1.4 }}>{vid.hook}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                    {brief && <span className="tag">{brief.title}</span>}
                    <StatusBadge status={vid.status} />
                  </div>
                  <button className="btn-primary" style={{ fontSize:13 }} onClick={() => { setLinkModal(vid.id); setLinkUrl(vid.videoUrl||""); }}>Submit TikTok Link</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Posted */}
      <div style={{ marginBottom:20 }}>
        <button onClick={() => toggle("posted")} style={{ background:"none", border:"none", display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 0", cursor:"pointer" }}>
          <span style={{ fontSize:14, color:openSections.posted?"#111111":"#6B6B6B", transform:openSections.posted?"rotate(90deg)":"rotate(0)", transition:"transform 0.15s", display:"inline-block" }}>▶</span>
          <span style={{ fontSize:14, fontWeight:600, color:"#111111" }}>Posted</span>
          <span className="tag" style={{ marginLeft:4, background:"#16A34A", color:"#FFFFFF" }}>{posted.length}</span>
        </button>
        {openSections.posted && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
            {posted.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", padding:"12px 0", textAlign:"center" }}>No posted videos yet</div>}
            {posted.map(vid => {
              const brief = briefs.find(b => b.id === vid.briefId);
              return (
                <div key={vid.id} className="card">
                  <div style={{ fontSize:14, color:"#111111", fontWeight:500, marginBottom:4, lineHeight:1.4 }}>{vid.hook}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:vid.videoUrl?8:0 }}>
                    {brief && <span className="tag">{brief.title}</span>}
                    <StatusBadge status={vid.status} />
                  </div>
                  {vid.videoUrl && <a href={vid.videoUrl} target="_blank" rel="noreferrer" style={{ display:"inline-block", fontSize:13, color:"#2563EB", textDecoration:"none", fontWeight:500, marginTop:4 }}>View on TikTok →</a>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link submit modal */}
      {linkModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(2px)" }} onClick={() => setLinkModal(null)}>
          <div className="card" style={{ width:"100%", maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:600, fontSize:16, marginBottom:16, color:"#111111" }}>Submit TikTok Link</div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>TikTok URL</div>
              <input placeholder="https://tiktok.com/@…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn-primary" onClick={submitLink}>Submit</button>
              <button className="btn-ghost" onClick={() => setLinkModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creator Ideas ────────────────────────────────────────────────────────────
function CreatorIdeas({ creator, briefIdeas, addBriefIdea, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", description:"" });

  const submit = async () => {
    if (!form.title.trim()) return;
    await addBriefIdea({ id: Date.now().toString(), creatorId: creator.id, title: form.title, description: form.description });
    if (window.emailjs) {
      try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          creator_name: creator.name,
          idea_title: form.title,
          idea_description: form.description,
          to_email: ADMIN_NOTIFY_EMAIL,
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) { /* silent */ }
    }
    setForm({ title:"", description:"" });
    setShowForm(false);
    showToast("Idea submitted!");
  };

  const IDEA_STATUS_STYLE = {
    pending:  { bg:"#FEF3C7", color:"#D97706" },
    approved: { bg:"#F0FDF4", color:"#16A34A" },
    rejected: { bg:"#FEF2F2", color:"#DC2626" },
  };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontWeight:700, fontSize:22, color:"#111111" }}>Your Ideas</div>
        <button className="btn-primary" style={{ width:"auto", padding:"8px 16px", fontSize:13 }} onClick={() => setShowForm(!showForm)}>+ New idea</button>
      </div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>{briefIdeas.length} submitted</div>

      {showForm && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Idea title</div>
            <input placeholder="e.g. Summer vintage haul" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} />
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Description (optional)</div>
            <textarea rows={4} placeholder="Describe your idea…" value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} style={{ resize:"vertical" }} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn-primary" onClick={submit}>Submit</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {briefIdeas.length === 0 && !showForm && (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <div style={{ fontSize:32, marginBottom:8, opacity:0.3 }}>💡</div>
          <div style={{ fontSize:14, color:"#6B6B6B", marginBottom:16 }}>No ideas submitted yet</div>
          <button className="btn-primary" style={{ width:"auto", display:"inline-block", padding:"10px 24px" }} onClick={() => setShowForm(true)}>Submit your first idea</button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {briefIdeas.map(idea => {
          const st = IDEA_STATUS_STYLE[idea.status] || IDEA_STATUS_STYLE.pending;
          return (
            <div key={idea.id} className="card">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontWeight:500, fontSize:14, color:"#111111" }}>{idea.title}</div>
                <span style={{ display:"inline-block", padding:"4px 8px", borderRadius:100, fontSize:11, fontWeight:500, background:st.bg, color:st.color, textTransform:"capitalize", flexShrink:0 }}>{idea.status}</span>
              </div>
              {idea.description && <div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.5, marginBottom:4 }}>{idea.description}</div>}
              <div style={{ fontSize:11, color:"#A0A0A0" }}>{new Date(idea.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
