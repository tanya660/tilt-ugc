import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

// ── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "tanya@tilt.app";
const EMAILJS_SERVICE_ID = "FILL_IN_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "FILL_IN_TEMPLATE_ID";
const EMAILJS_INVOICE_TEMPLATE_ID = "FILL_IN_INVOICE_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "FILL_IN_PUBLIC_KEY";
const ADMIN_NOTIFY_EMAIL = "tanya@tilt.app";
const GOOGLE_SCRIPT_URL = "FILL_IN_APPS_SCRIPT_URL";

// ── Constants ────────────────────────────────────────────────────────────────
const DELIVERY_STYLES = ["Talking head","Green screen","Overlaid text","GRWM","Transition","Voice-over + b-roll","POV","Haul / unboxing","Day-in-the-life","Viral style"];
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const getMondayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
};

const formatDateShort = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short" }) : "";

// ── DB mappers ───────────────────────────────────────────────────────────────
const mapCreator = r => r ? ({
  id: r.id, name: r.name, handle: r.handle, avatar: r.avatar,
  color: r.color, platform: r.platform, status: r.status,
  phone: r.phone||"", email: r.email||"", whatsapp: r.whatsapp||"",
  instagram: r.instagram||"", tiktok: r.tiktok||"",
  category: r.category||"", notes: r.notes||"",
  checkIns: r.check_ins||[], authEmail: r.auth_email||"",
  ratePerVideo: r.rate_per_video||0, bankDetails: r.bank_details||"",
}) : null;

const mapVideo = r => r ? ({
  id: r.id,
  videoId: r.video_id||"",
  briefId: r.brief_id||"",
  creatorId: r.creator_id,
  title: r.title||"",
  hook: r.hook||"",
  script: r.script || r.main_body || "",
  cta: r.cta||"",
  delivery: r.delivery || r.video_style || "",
  status: r.status||"assigned",
  date: r.date||"",
  dueDate: r.due_date||"",
  assignedDate: r.assigned_date||"",
  platform: r.platform||"TikTok",
  notes: r.notes||"",
  videoUrl: r.video_url||"",
  reviewChecks: r.review_checks||{},
  reviewNote: r.review_note||"",
  score: r.score,
  reviewedAt: r.reviewed_at,
  liveAt: r.live_at,
  invoiced: r.invoiced||false,
  postedDate: r.posted_date||"",
}) : null;

const mapBriefIdea = r => r ? ({
  id: r.id, creatorId: r.creator_id, title: r.title,
  description: r.description||"", status: r.status||"pending",
  createdAt: r.created_at,
}) : null;

const mapBonus = r => r ? ({
  id: r.id, creatorId: r.creator_id, weekStart: r.week_start,
  amount: r.amount||100, assignedAt: r.assigned_at,
}) : null;

// ── Shared components ────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { bg:"#F5F5F5", color:"#6B6B6B" };
  return <span style={{ display:"inline-block", padding:"4px 8px", borderRadius:100, fontSize:11, fontWeight:500, fontFamily:"'Inter',sans-serif", background:s.bg, color:s.color, textTransform:"capitalize", lineHeight:1 }}>{status}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ROOT APP ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth state ──
  const [session,        setSession]        = useState(null);
  const [authLoading,    setAuthLoading]    = useState(true);
  const [userRole,       setUserRole]       = useState(null);
  const [currentCreator, setCurrentCreator] = useState(null);

  // ── App state ──
  const [view,           setView]           = useState("dashboard");
  const [creators,       setCreators]       = useState([]);
  const [videos,         setVideos]         = useState([]);
  const [briefIdeas,     setBriefIdeas]     = useState([]);
  const [bonuses,        setBonuses]        = useState([]);
  const [reviewing,      setReviewing]      = useState(null);
  const [loaded,         setLoaded]         = useState(false);
  const [toast,          setToast]          = useState(null);
  const [previewCreator, setPreviewCreator] = useState(null);

  // ── Auth lifecycle ──
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

  // ── Load data ──
  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: c }, { data: v }, { data: bi }, { data: bo }] = await Promise.all([
        supabase.from("creators").select("*").order("created_at"),
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("brief_ideas").select("*").order("created_at", { ascending: false }),
        supabase.from("creator_bonuses").select("*").order("assigned_at", { ascending: false }),
      ]);
      setCreators((c||[]).map(mapCreator));
      setVideos((v||[]).map(mapVideo));
      setBriefIdeas((bi||[]).map(mapBriefIdea));
      setBonuses((bo||[]).map(mapBonus));
      setLoaded(true);
    })();
  }, [session]);

  // ── Determine role ──
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
    if (patch.name         !== undefined) dbPatch.name          = patch.name;
    if (patch.handle       !== undefined) dbPatch.handle        = patch.handle;
    if (patch.phone        !== undefined) dbPatch.phone         = patch.phone;
    if (patch.email        !== undefined) dbPatch.email         = patch.email;
    if (patch.whatsapp     !== undefined) dbPatch.whatsapp      = patch.whatsapp;
    if (patch.instagram    !== undefined) dbPatch.instagram     = patch.instagram;
    if (patch.tiktok       !== undefined) dbPatch.tiktok        = patch.tiktok;
    if (patch.category     !== undefined) dbPatch.category      = patch.category;
    if (patch.notes        !== undefined) dbPatch.notes         = patch.notes;
    if (patch.status       !== undefined) dbPatch.status        = patch.status;
    if (patch.checkIns     !== undefined) dbPatch.check_ins     = patch.checkIns;
    if (patch.authEmail    !== undefined) dbPatch.auth_email    = patch.authEmail;
    if (patch.ratePerVideo !== undefined) dbPatch.rate_per_video= patch.ratePerVideo;
    if (patch.bankDetails  !== undefined) dbPatch.bank_details  = patch.bankDetails;
    await supabase.from("creators").update(dbPatch).eq("id", id);
    setCreators(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  // ── Video ops ──
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
    if (patch.invoiced     !== undefined) dbPatch.invoiced      = patch.invoiced;
    if (patch.postedDate   !== undefined) dbPatch.posted_date   = patch.postedDate;
    await supabase.from("videos").update(dbPatch).eq("id", id);
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  };
  const deleteVideo = async (id) => {
    await supabase.from("videos").delete().eq("id", id);
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  // ── Brief idea ops ──
  const addBriefIdea = async (data) => {
    const dbRow = { id: data.id, creator_id: data.creatorId, title: data.title, description: data.description, status: "pending" };
    const { data: row } = await supabase.from("brief_ideas").insert([dbRow]).select().single();
    if (row) setBriefIdeas(prev => [mapBriefIdea(row), ...prev]);
  };
  const updateBriefIdea = async (id, patch) => {
    if (patch.status !== undefined) await supabase.from("brief_ideas").update({ status: patch.status }).eq("id", id);
    setBriefIdeas(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  // ── Bonus ops ──
  const addBonus = async (data) => {
    const dbRow = { id: data.id, creator_id: data.creatorId, week_start: data.weekStart, amount: data.amount };
    const { data: row } = await supabase.from("creator_bonuses").insert([dbRow]).select().single();
    if (row) setBonuses(prev => [mapBonus(row), ...prev]);
  };

  // ── Batch invoice ──
  const markVideosInvoiced = async (videoIds) => {
    await supabase.from("videos").update({ invoiced: true }).in("id", videoIds);
    setVideos(prev => prev.map(v => videoIds.includes(v.id) ? { ...v, invoiced: true } : v));
  };

  // ── Google Sheets sync ──
  const [syncing, setSyncing] = useState(false);

  const syncFromSheets = async () => {
    if (GOOGLE_SCRIPT_URL === "FILL_IN_APPS_SCRIPT_URL") { showToast("Set GOOGLE_SCRIPT_URL first"); return; }
    setSyncing(true);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const { rows } = await res.json();
      if (!rows || rows.length === 0) { showToast("No rows found in sheet"); setSyncing(false); return; }

      const existingIds = new Set(videos.map(v => v.videoId).filter(Boolean));
      const newRows = rows.filter(r => r.videoId && r.creator && r.hook && !existingIds.has(r.videoId));

      if (newRows.length === 0) { showToast("Already in sync"); setSyncing(false); return; }

      const dbRows = [];
      for (const r of newRows) {
        const cr = creators.find(c => c.name.toLowerCase() === r.creator.toLowerCase());
        if (!cr) continue;
        dbRows.push({
          id: r.videoId + "-" + Date.now() + "-" + Math.random().toString(36).slice(2,6),
          video_id: r.videoId,
          creator_id: cr.id,
          delivery: r.delivery || "",
          hook: r.hook,
          script: r.script || "",
          cta: r.cta || "",
          due_date: r.dueDate || null,
          assigned_date: r.assignedDate || new Date().toISOString().split("T")[0],
          status: "assigned",
          video_url: "",
          platform: "TikTok",
        });
      }

      if (dbRows.length > 0) {
        const { data: inserted } = await supabase.from("videos").insert(dbRows).select();
        if (inserted) setVideos(prev => [...inserted.map(mapVideo), ...prev]);
        showToast(`Synced ${dbRows.length} new video${dbRows.length !== 1 ? "s" : ""} from Sheets`);
      } else {
        showToast("No matching creators found for new rows");
      }
    } catch (err) {
      showToast("Sync failed — check script URL");
    }
    setSyncing(false);
  };

  const updateSheetStatus = async (videoId, status) => {
    if (!videoId || GOOGLE_SCRIPT_URL === "FILL_IN_APPS_SCRIPT_URL") return;
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ video_id: videoId, status }),
      });
    } catch (e) { /* silent — sheet sync is best-effort */ }
  };

  // Wrap updateVideo to also sync sheet
  const updateVideoAndSheet = async (id, patch) => {
    await updateVideo(id, patch);
    if (patch.status) {
      const vid = videos.find(v => v.id === id);
      if (vid?.videoId) updateSheetStatus(vid.videoId, patch.status);
    }
  };

  // ── Derived ──
  const todayStr    = new Date().toISOString().split("T")[0];
  const todayVideos = videos.filter(v => (v.dueDate || v.date) === todayStr);
  const totalPosted = videos.filter(v => v.status === "posted").length;
  const totalVideos = videos.length;
  const inProgress  = videos.filter(v => !["assigned","posted"].includes(v.status)).length;
  const completion  = totalVideos > 0 ? Math.round((totalPosted / totalVideos) * 100) : 0;

  // ── Render gates ──
  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen onSignIn={signIn} />;
  if (!loaded) return <LoadingScreen />;
  if (userRole === "unknown") return <AccessDenied onSignOut={signOut} />;

  // ── Creator portal ──
  if (userRole === "creator" && currentCreator) {
    return <CreatorPortal creator={currentCreator} videos={videos.filter(v => v.creatorId === currentCreator.id)} briefIdeas={briefIdeas.filter(i => i.creatorId === currentCreator.id)} bonuses={bonuses} addBriefIdea={addBriefIdea} updateVideo={updateVideoAndSheet} markVideosInvoiced={markVideosInvoiced} session={session} onSignOut={signOut} showToast={showToast} toast={toast} />;
  }

  // ── Admin: preview mode ──
  if (previewCreator) {
    const pc = creators.find(c => c.id === previewCreator);
    if (pc) {
      return (
        <div style={{ fontFamily:"'Inter',sans-serif" }}>
          <div style={{ background:"#111111", color:"#FFFFFF", padding:"8px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:13 }}>
            <span>Previewing as <strong>{pc.name}</strong> (read-only)</span>
            <button onClick={() => setPreviewCreator(null)} style={{ background:"#FFFFFF", color:"#111111", border:"none", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:500, cursor:"pointer" }}>Exit preview</button>
          </div>
          <CreatorPortal creator={pc} videos={videos.filter(v => v.creatorId === pc.id)} briefIdeas={briefIdeas.filter(i => i.creatorId === pc.id)} bonuses={bonuses} addBriefIdea={addBriefIdea} updateVideo={updateVideoAndSheet} markVideosInvoiced={markVideosInvoiced} session={session} onSignOut={() => setPreviewCreator(null)} showToast={showToast} toast={toast} readOnly />
        </div>
      );
    }
  }

  // ── Admin: review room ──
  if (reviewing) {
    const vid = videos.find(v => v.id === reviewing);
    if (!vid) { setReviewing(null); return null; }
    return <ReviewRoom vid={vid} creators={creators} updateVideo={updateVideoAndSheet} onClose={() => setReviewing(null)} showToast={showToast} />;
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
        .stat-num{font-weight:700;font-size:36px;line-height:1}
        .field-label{font-size:11px;color:#A0A0A0;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;font-weight:500}
        .section-label{font-size:11px;color:#A0A0A0;letter-spacing:0.08em;text-transform:uppercase;font-weight:500}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        .fade{animation:fadeUp 0.2s ease both}
      `}</style>

      {/* Top nav */}
      <div style={{ borderBottom:"1px solid #E5E5E5", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, background:"#FFFFFF", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          <span style={{ fontWeight:700, fontSize:15, color:"#111111", letterSpacing:"-0.02em" }}>Tilt UGC</span>
          <div style={{ display:"flex", gap:0 }}>
            {[["dashboard","Dashboard"],["board","Video Board"],["creators","Creators"],["invoicing","Invoicing"]].map(([v,l]) => (
              <button key={v} className={`nav-link${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Preview as creator dropdown */}
          <select value="" onChange={e => { if (e.target.value) setPreviewCreator(e.target.value); }} style={{ width:"auto", fontSize:12, color:"#6B6B6B", border:"1px solid #E5E5E5", borderRadius:6, padding:"4px 8px", background:"#FAFAFA" }}>
            <option value="">Preview portal…</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {session?.user?.user_metadata?.avatar_url && <img src={session.user.user_metadata.avatar_url} style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #E5E5E5" }} alt="" />}
          <span style={{ fontSize:13, color:"#111111" }}>{session?.user?.user_metadata?.full_name || session?.user?.email}</span>
          <button onClick={signOut} style={{ background:"none", border:"none", fontSize:13, color:"#6B6B6B", cursor:"pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>
        {view==="dashboard" && <Dashboard creators={creators} videos={videos} briefIdeas={briefIdeas} updateBriefIdea={updateBriefIdea} totalPosted={totalPosted} totalVideos={totalVideos} inProgress={inProgress} completion={completion} todayVideos={todayVideos} todayStr={todayStr} setView={setView} setReviewing={setReviewing} syncFromSheets={syncFromSheets} syncing={syncing}/>}
        {view==="board"     && <VideoBoard videos={videos} updateVideo={updateVideoAndSheet} deleteVideo={deleteVideo} creators={creators} showToast={showToast} setReviewing={setReviewing}/>}
        {view==="creators"  && <Creators creators={creators} addCreator={addCreator} updateCreator={updateCreator} videos={videos} bonuses={bonuses} addBonus={addBonus} showToast={showToast}/>}
        {view==="invoicing" && <AdminInvoicing creators={creators} videos={videos} bonuses={bonuses} showToast={showToast}/>}
      </div>

      {toast && <div style={{ position:"fixed", bottom:24, right:24, background:"#111111", color:"#FFFFFF", padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:500, zIndex:999, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>{toast}</div>}
    </div>
  );
}

// ── Auth screens ─────────────────────────────────────────────────────────────
function LoginScreen({ onSignIn }) {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", maxWidth:360, padding:40 }}>
        <div style={{ fontWeight:600, fontSize:24, color:"#111111", marginBottom:8 }}>Tilt UGC</div>
        <p style={{ fontSize:14, color:"#6B6B6B", marginBottom:40, lineHeight:1.6 }}>Creator management platform</p>
        <button onClick={onSignIn} style={{ display:"inline-flex", alignItems:"center", gap:10, background:"#111111", color:"#FFFFFF", border:"none", borderRadius:8, padding:"12px 28px", fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'Inter',sans-serif", color:"#A0A0A0", fontSize:13, background:"#FFFFFF" }}>Loading…</div>;
}

function AccessDenied({ onSignOut }) {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", maxWidth:400, padding:40 }}>
        <div style={{ fontWeight:600, fontSize:24, color:"#111111", marginBottom:8 }}>Tilt UGC</div>
        <div style={{ fontSize:14, color:"#6B6B6B", marginBottom:32, lineHeight:1.6 }}>You don't have access. Contact Tilt.</div>
        <button onClick={onSignOut} className="btn-ghost">Sign out</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function Dashboard({ creators, videos, briefIdeas, updateBriefIdea, totalPosted, totalVideos, inProgress, completion, todayVideos, todayStr, setView, setReviewing, syncFromSheets, syncing }) {
  const [timeView, setTimeView] = useState("total");
  const pendingReview  = todayVideos.filter(v => v.status === "first draft" || v.status === "second draft");
  const todayPosted    = todayVideos.filter(v => v.status === "posted").length;
  const todayActive    = todayVideos.filter(v => v.status !== "posted").length;
  const pendingIdeas   = briefIdeas.filter(i => i.status === "pending");

  const stats = timeView === "total" ? [
    { label:"Total posted",    val:totalPosted,   sub:`of ${totalVideos} assigned` },
    { label:"In progress",     val:inProgress,    sub:"across all videos" },
    { label:"Pending review",  val:pendingReview.length, sub:"need your eyes" },
    { label:"Completion rate", val:`${completion}%`, sub:"posted vs assigned" },
  ] : [
    { label:"Posted today",    val:todayPosted,   sub:"completed today" },
    { label:"Active today",    val:todayActive,   sub:"in pipeline today" },
    { label:"Pending review",  val:pendingReview.length, sub:"need your eyes" },
    { label:"Due today",       val:todayVideos.length, sub:"total due" },
  ];

  return (
    <div className="fade">
      <div style={{ marginBottom:24, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontWeight:600, fontSize:22 }}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}</h1>
          <p style={{ color:"#6B6B6B", fontSize:13, marginTop:4 }}>Here's your content pipeline overview.</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={syncFromSheets} disabled={syncing} style={{ background:"#FFFFFF", border:"1px solid #E5E5E5", borderRadius:8, padding:"6px 14px", fontSize:12, fontFamily:"'Inter',sans-serif", cursor:"pointer", color:syncing?"#A0A0A0":"#111111", fontWeight:500, transition:"all 0.15s" }}>{syncing ? "Syncing…" : "Sync from Sheets"}</button>
          <div style={{ display:"flex", gap:0, border:"1px solid #E5E5E5", borderRadius:8, overflow:"hidden" }}>
            {[["total","All time"],["today","Today"]].map(([v,l]) => (
              <button key={v} onClick={() => setTimeView(v)} style={{ background:timeView===v?"#111111":"#FFFFFF", color:timeView===v?"#FFFFFF":"#6B6B6B", border:"none", padding:"6px 16px", fontSize:12, fontFamily:"'Inter',sans-serif", cursor:"pointer", fontWeight:timeView===v?500:400 }}>{l}</button>
            ))}
          </div>
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

      {/* Creator progress */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="section-label" style={{ marginBottom:16 }}>Creator progress — all time</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {creators.filter(c => c.status==="active").map(cr => {
            const allMine = videos.filter(v => v.creatorId===cr.id);
            const posted  = allMine.filter(v => v.status==="posted").length;
            const total   = allMine.length;
            const pct     = total > 0 ? Math.round((posted/total)*100) : 0;
            const todayMine = todayVideos.filter(v => v.creatorId===cr.id);
            return (
              <div key={cr.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr.color, fontWeight:600, flexShrink:0 }}>{cr.avatar}</div>
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

      {/* Pending review */}
      {pendingReview.length > 0 && (
        <div className="card" style={{ marginBottom:16, borderColor:"#FED7AA" }}>
          <div className="section-label" style={{ marginBottom:12, color:"#D97706" }}>Needs your review now</div>
          {pendingReview.map(vid => {
            const cr = creators.find(c => c.id===vid.creatorId);
            return (
              <div key={vid.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #F5F5F5" }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:cr?.color+"15", border:`1px solid ${cr?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:cr?.color, fontWeight:600 }}>{cr?.avatar}</div>
                <span style={{ fontSize:12, color:"#6B6B6B", fontWeight:500, minWidth:56 }}>{vid.videoId || "—"}</span>
                <span style={{ fontSize:13, color:"#111111", flex:1 }}>{vid.hook}</span>
                <span style={{ fontSize:12, color:"#6B6B6B" }}>{cr?.name}</span>
                <button className="btn-primary" style={{ fontSize:12, padding:"5px 12px" }} onClick={() => setReviewing(vid.id)}>Review</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Brief ideas from creators */}
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
                  <div style={{ fontSize:11, color:"#A0A0A0" }}>{cr?.name} · {formatDateShort(idea.createdAt)}</div>
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

      {/* Video pipeline today */}
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
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN: VIDEO BOARD ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function VideoBoard({ videos, updateVideo, deleteVideo, creators, showToast, setReviewing }) {
  const [filter, setFilter] = useState("all");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [editingId, setEditingId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const filtered = videos.filter(v => {
    if (filter !== "all" && v.creatorId !== filter) return false;
    if (dateFilter && (v.dueDate || v.date) !== dateFilter) return false;
    return true;
  });
  const grouped = STATUSES.reduce((acc,s) => { acc[s]=filtered.filter(v => v.status===s); return acc; }, {});

  const formatDue = (d) => {
    const due = d;
    if (!due) return "";
    const diff = Math.ceil((new Date(due) - new Date(todayStr)) / (1000*60*60*24));
    if (diff === 0) return "due today";
    if (diff === 1) return "due tomorrow";
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    return `due ${formatDateShort(due)}`;
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
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontWeight:600, fontSize:22 }}>Video Board</h2>
        <p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Drag cards between columns to update status</p>
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
          <div key={status} style={{ background:dragOver===status?"#F0FDF4":"#F7F7F7", border:`1px solid ${dragOver===status?"#BBF7D0":"#E5E5E5"}`, borderRadius:8, padding:12, transition:"all 0.15s", minHeight:120 }}
            onDragOver={e => onDragOver(e, status)} onDrop={e => onDrop(e, status)} onDragLeave={() => setDragOver(null)}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <StatusBadge status={status} />
              <span style={{ marginLeft:"auto", fontSize:12, color:"#A0A0A0", fontWeight:500 }}>{grouped[status]?.length||0}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(grouped[status]||[]).map(vid => {
                const creator = creators.find(c => c.id===vid.creatorId);
                const isEditing = editingId===vid.id;
                const isDragging = dragId===vid.id;
                const due = vid.dueDate || vid.date;
                return (
                  <div key={vid.id} draggable={!isEditing} onDragStart={e => onDragStart(e, vid.id)} onDragEnd={onDragEnd}
                    className="card" style={{ padding:12, borderColor:isEditing?"#111111":"#E5E5E5", opacity:isDragging?0.4:1, cursor:isEditing?"default":"grab" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:creator?.color+"15", border:`1px solid ${creator?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:creator?.color, fontWeight:600 }}>{creator?.avatar}</div>
                      <span style={{ fontSize:12, color:"#6B6B6B" }}>{creator?.name}</span>
                      {vid.videoId && <span className="tag" style={{ marginLeft:"auto", fontSize:10, fontWeight:600 }}>{vid.videoId}</span>}
                    </div>
                    <div style={{ fontSize:13, color:"#111111", marginBottom:4, lineHeight:1.4 }}>{vid.hook}</div>
                    {vid.delivery && <div style={{ fontSize:11, color:"#2563EB", marginBottom:3 }}>{vid.delivery}</div>}
                    {due && <div style={{ fontSize:11, color:dateColor(due), marginBottom:8 }}>{formatDue(due)}</div>}
                    {isEditing ? (
                      <div>
                        <div style={{ marginBottom:6 }}><div style={{ fontSize:10, color:"#A0A0A0", marginBottom:3 }}>Video / TikTok link</div><input placeholder="https://…" value={vid.videoUrl||""} onChange={e => updateVideo(vid.id,{videoUrl:e.target.value})} style={{ fontSize:12 }}/></div>
                        <div style={{ marginBottom:8 }}><div style={{ fontSize:10, color:"#A0A0A0", marginBottom:3 }}>Notes</div><textarea rows={2} value={vid.notes||""} onChange={e => updateVideo(vid.id,{notes:e.target.value})} style={{ fontSize:12, resize:"none" }}/></div>
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
                <div style={{ fontSize:12, color:dragOver===status?"#16A34A":"#A0A0A0", textAlign:"center", padding:"16px 0", border:`2px dashed ${dragOver===status?"#BBF7D0":"#E5E5E5"}`, borderRadius:6 }}>
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

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN: REVIEW ROOM ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ReviewRoom({ vid, creators, updateVideo, onClose, showToast }) {
  const cr = creators.find(c => c.id===vid.creatorId);
  const [checks, setChecks] = useState(vid.reviewChecks||{});
  const [reviewNote, setReviewNote] = useState(vid.reviewNote||"");
  const [driveUrl, setDriveUrl] = useState(vid.videoUrl||"");
  const [decision, setDecision] = useState(null);

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
    ? `✅ *${vid.videoId || vid.hook}* — APPROVED\nCreator: ${cr?.name} (${cr?.handle})\nScore: ${score}/100\nReady to post.${reviewNote?"\n\n"+reviewNote:""}`
    : `🔄 *${vid.videoId || vid.hook}* — NEEDS REVISION\nCreator: ${cr?.name}\nScore: ${score}/100\n\n${failedLabels.join("\n")}${reviewNote?"\n\nNotes: "+reviewNote:""}`;

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#FFFFFF", minHeight:"100vh", color:"#111111" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input,textarea{background:#FFFFFF;border:1px solid #E5E5E5;color:#111111;border-radius:6px;padding:8px 12px;font-family:'Inter',sans-serif;font-size:13px;outline:none;width:100%}input:focus,textarea:focus{outline:2px solid #111111;outline-offset:1px}input::placeholder,textarea::placeholder{color:#A0A0A0}`}</style>
      <div style={{ borderBottom:"1px solid #E5E5E5", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:52, background:"#FFFFFF", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onClose} style={{ background:"#FFFFFF", border:"1px solid #E5E5E5", borderRadius:6, padding:"6px 12px", fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif", color:"#111111" }}>← Back</button>
          <div style={{ width:1, height:20, background:"#E5E5E5" }}/>
          <div style={{ width:28, height:28, borderRadius:"50%", background:cr?.color+"15", border:`1px solid ${cr?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:cr?.color, fontWeight:600 }}>{cr?.avatar}</div>
          <div>
            {vid.videoId && <span style={{ fontSize:12, color:"#6B6B6B", marginRight:8, fontWeight:600 }}>{vid.videoId}</span>}
            <span style={{ fontSize:13, color:"#111111", fontWeight:500 }}>{vid.hook}</span>
            <span style={{ fontSize:12, color:"#6B6B6B", marginLeft:8 }}>{cr?.name}</span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ position:"relative", width:40, height:40 }}>
            <svg width="40" height="40" style={{ transform:"rotate(-90deg)" }}><circle cx="20" cy="20" r="15" fill="none" stroke="#F5F5F5" strokeWidth="3"/><circle cx="20" cy="20" r="15" fill="none" stroke={score>=80?"#16A34A":score>=50?"#D97706":"#DC2626"} strokeWidth="3" strokeDasharray={`${(score/100)*94} 94`} strokeLinecap="round"/></svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:score>=80?"#16A34A":score>=50?"#D97706":"#DC2626", fontWeight:600 }}>{score}</div>
          </div>
          {!decision && <><button onClick={() => handleDecision("revision")} style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", padding:"7px 16px", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Request revision</button><button onClick={() => handleDecision("approve")} style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#16A34A", padding:"7px 16px", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Approve</button></>}
          {decision && <span style={{ fontSize:12, padding:"4px 12px", borderRadius:100, background:decision==="approve"?"#F0FDF4":"#FEF2F2", color:decision==="approve"?"#16A34A":"#DC2626", fontWeight:500 }}>{decision==="approve"?"Approved":"Revision sent"}</span>}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", minHeight:"calc(100vh - 52px)" }}>
        <div style={{ padding:24, borderRight:"1px solid #E5E5E5", overflowY:"auto" }}>
          {/* Video details */}
          {(vid.script || vid.delivery || vid.cta) && (
            <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
              {vid.delivery && <div style={{ fontSize:12, color:"#2563EB", marginBottom:4 }}>Delivery: {vid.delivery}</div>}
              {vid.script && <><div style={{ fontSize:11, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500, marginBottom:4, marginTop:8 }}>Script</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{vid.script}</div></>}
              {vid.cta && <><div style={{ fontSize:11, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500, marginBottom:4, marginTop:8 }}>CTA</div><div style={{ fontSize:13, color:"#111111" }}>{vid.cta}</div></>}
            </div>
          )}
          {/* Video embed */}
          <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, overflow:"hidden", marginBottom:16 }}>
            {driveUrl ? (<div style={{ position:"relative", paddingBottom:"56.25%" }}><iframe src={driveUrl.replace("/view","/preview")} style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }} allowFullScreen/></div>) : (<div style={{ height:220, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><div style={{ fontSize:28, opacity:.2 }}>▶</div><div style={{ fontSize:13, color:"#A0A0A0" }}>Paste video link below</div></div>)}
            <div style={{ padding:"10px 14px", borderTop:"1px solid #E5E5E5", display:"flex", gap:8, alignItems:"center" }}><input placeholder="Video / Drive / TikTok link" style={{ flex:1, fontSize:12 }} value={driveUrl} onChange={e => setDriveUrl(e.target.value)} onBlur={() => updateVideo(vid.id,{videoUrl:driveUrl})}/>{driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563EB", whiteSpace:"nowrap", textDecoration:"none" }}>Open ↗</a>}</div>
          </div>
          {/* Notes */}
          <div style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, padding:"12px 14px", marginBottom:16 }}><div style={{ fontSize:11, color:"#A0A0A0", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>Feedback notes</div><textarea rows={4} placeholder="Overall thoughts, what needs to change…" value={reviewNote} onChange={e => setReviewNote(e.target.value)} style={{ resize:"none", fontSize:13 }}/></div>
          {/* Slack message */}
          {decision && <div style={{ background:"#FAFAFA", border:`1px solid ${decision==="approve"?"#BBF7D0":"#FECACA"}`, borderRadius:8, padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><div style={{ fontSize:11, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:500 }}>Slack message</div><button onClick={() => { navigator.clipboard.writeText(slackMsg); showToast("Copied"); }} style={{ background:"#FFFFFF", border:"1px solid #E5E5E5", borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy</button></div><div style={{ fontFamily:"monospace", fontSize:12, color:"#6B6B6B", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{slackMsg}</div></div>}
        </div>
        {/* Checklist */}
        <div style={{ padding:20, overflowY:"auto", background:"#FAFAFA" }}>
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

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN: CREATORS ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function Creators({ creators, addCreator, updateCreator, videos, bonuses, addBonus, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [form, setForm] = useState({ name:"", handle:"", platform:"TikTok" });
  const [bonusCreator, setBonusCreator] = useState("");

  const thisMonday = getMondayOfWeek(new Date());
  const thisWeekBonus = bonuses.find(b => b.weekStart === thisMonday);

  const handleAdd = async () => {
    if (!form.name) return;
    const initials = form.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
    const colors = ["#E8C547","#2563EB","#D97706","#16A34A","#7C3AED","#DC2626","#0891B2"];
    const c = { id:Date.now().toString(), ...form, avatar:initials, color:colors[creators.length%colors.length], status:"active", phone:"", email:"", whatsapp:"", instagram:"", tiktok:"", category:"", notes:"", checkIns:[], auth_email:"", rate_per_video:0, bank_details:"" };
    await supabase.from("creators").insert([c]);
    await addCreator(c);
    setShowAdd(false);
    setForm({ name:"", handle:"", platform:"TikTok" });
    showToast("Creator added");
  };

  const assignBonus = async () => {
    if (!bonusCreator) return;
    await addBonus({ id: Date.now().toString(), creatorId: bonusCreator, weekStart: thisMonday, amount: 100 });
    const cr = creators.find(c => c.id === bonusCreator);
    setBonusCreator("");
    showToast(`£100 bonus assigned to ${cr?.name}`);
  };

  if (profileId) {
    const cr = creators.find(c => c.id===profileId);
    if (!cr) { setProfileId(null); return null; }
    return <CreatorProfile cr={cr} updateCreator={updateCreator} videos={videos} onClose={() => setProfileId(null)} showToast={showToast}/>;
  }

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div><h2 style={{ fontWeight:600, fontSize:22 }}>Creators</h2><p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Manage your roster of {creators.length} creators</p></div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add creator</button>
      </div>

      {/* Weekly bonus */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="section-label" style={{ marginBottom:12 }}>Weekly bonus — week of {formatDateShort(thisMonday)}</div>
        {thisWeekBonus ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, color:"#111111" }}>£{thisWeekBonus.amount} bonus assigned to <strong>{creators.find(c => c.id===thisWeekBonus.creatorId)?.name}</strong></span>
            <span className="tag" style={{ background:"#F0FDF4", color:"#16A34A" }}>Assigned</span>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8, alignItems:"end" }}>
            <div style={{ flex:1 }}>
              <div className="field-label">Assign £100 bonus to</div>
              <select value={bonusCreator} onChange={e => setBonusCreator(e.target.value)}>
                <option value="">— Choose creator —</option>
                {creators.filter(c => c.status==="active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={assignBonus} style={{ opacity:bonusCreator?1:0.5 }}>Assign £100 bonus</button>
          </div>
        )}
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
          const myVideos = videos.filter(v => v.creatorId===cr.id);
          const posted = myVideos.filter(v => v.status==="posted").length;
          const todayVids = myVideos.filter(v => (v.dueDate||v.date)===new Date().toISOString().split("T")[0]);
          return (
            <div key={cr.id} className="card">
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:cr.color, fontWeight:600, flexShrink:0 }}>{cr.avatar}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, color:"#111111", fontWeight:500 }}>{cr.name}</div>
                  <div style={{ fontSize:12, color:"#6B6B6B" }}>{cr.category||cr.platform}{cr.ratePerVideo ? ` · £${cr.ratePerVideo}/video` : ""}</div>
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
  const [tab, setTab] = useState("contact");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...cr });
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState({ date:new Date().toISOString().split("T")[0], type:"weekly-call", notes:"" });

  const myVideos = videos.filter(v => v.creatorId===cr.id);
  const posted = myVideos.filter(v => v.status==="posted").length;
  const avgScore = myVideos.filter(v => v.score).length > 0 ? Math.round(myVideos.filter(v => v.score).reduce((a,v) => a+v.score, 0) / myVideos.filter(v => v.score).length) : null;

  const saveEdits = async () => { await updateCreator(cr.id, draft); setEditing(false); showToast("Saved"); };
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
          <div style={{ fontSize:18, fontWeight:600 }}>{cr.name}</div>
          <div style={{ fontSize:12, color:"#6B6B6B" }}>{cr.category||cr.platform}{cr.ratePerVideo ? ` · £${cr.ratePerVideo}/video` : ""}</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" }}>
          {cr.phone && <a href={`tel:${cr.phone}`} style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#FAFAFA", color:"#6B6B6B", border:"1px solid #E5E5E5", textDecoration:"none" }}>📞 Call</a>}
          {cr.whatsapp && <a href={`https://wa.me/${cr.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize:12, padding:"6px 12px", borderRadius:6, background:"#F0FDF4", color:"#16A34A", border:"1px solid #BBF7D0", textDecoration:"none" }}>WhatsApp</a>}
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
          {tab==="contact" && !editing && <button className="btn-ghost" style={{ fontSize:12 }} onClick={() => { setDraft({...cr}); setEditing(true); }}>Edit profile</button>}
          {tab==="contact" && editing && <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:12 }} onClick={saveEdits}>Save</button><button className="btn-ghost" style={{ fontSize:12 }} onClick={() => { setDraft({...cr}); setEditing(false); }}>Cancel</button></div>}
        </div>
      </div>

      {tab==="contact" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            { label:"Phone number",    field:"phone",        placeholder:"+44 7700 000000",   href:v=>`tel:${v}` },
            { label:"WhatsApp number", field:"whatsapp",     placeholder:"+44 7700 000000" },
            { label:"Email address",   field:"email",        placeholder:"creator@email.com", href:v=>`mailto:${v}` },
            { label:"Instagram handle",field:"instagram",    placeholder:"@handle",           href:v=>`https://instagram.com/${v.replace("@","")}` },
            { label:"TikTok handle",   field:"tiktok",       placeholder:"@handle",           href:v=>`https://tiktok.com/@${v.replace("@","")}` },
            { label:"Category",        field:"category",     type:"select", options:CATEGORIES },
            { label:"Auth email",      field:"authEmail",    placeholder:"Google login email" },
            { label:"Rate per video (£)", field:"ratePerVideo", placeholder:"25", type:"number" },
            { label:"Payment details", field:"bankDetails",  placeholder:"Bank name, sort code, account number or PayPal", type:"textarea" },
          ].map(({ label, field, placeholder, href, type, options }) => (
            <div key={field} className="card" style={{ padding:"14px 16px", gridColumn: type==="textarea"?"1 / -1":"auto" }}>
              <div className="field-label" style={{ marginBottom:6 }}>{label}</div>
              {editing ? (
                type==="select" ? <select value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}>{options.map(o => <option key={o}>{o}</option>)}</select> :
                type==="number" ? <input type="number" step="0.01" placeholder={placeholder} value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:parseFloat(e.target.value)||0}))}/> :
                type==="textarea" ? <textarea rows={3} placeholder={placeholder} value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))} style={{ resize:"vertical" }}/> :
                <input placeholder={placeholder} value={draft[field]||""} onChange={e => setDraft(d => ({...d,[field]:e.target.value}))}/>
              ) : (
                cr[field] ? (href ? <a href={href(cr[field])} style={{ fontSize:13, color:"#2563EB", textDecoration:"none" }}>{cr[field]}</a> : <div style={{ fontSize:13, color:"#111111" }}>{type==="number" ? `£${cr[field]}` : String(cr[field])}</div>) :
                <div style={{ fontSize:13, color:"#A0A0A0", fontStyle:"italic" }}>Not set</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="comms" && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:8 }}>Communication rhythm</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { type:"Daily (async)", desc:"WhatsApp or Slack DM. Brief confirmation, quick flags.", color:"#E8C547" },
                { type:"Weekly (15 min)", desc:"Monday check-in. Last week's numbers, this week's hooks.", color:"#2563EB" },
                { type:"Monthly (30 min)", desc:"Proper 1-to-1. Broader feedback, their growth.", color:"#16A34A" },
              ].map(r => (
                <div key={r.type} style={{ background:"#FAFAFA", border:"1px solid #E5E5E5", borderRadius:8, padding:"10px 12px" }}>
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
              <div style={{ marginBottom:10 }}><div className="field-label">Notes</div><textarea rows={3} placeholder="What did you cover?" value={newCheckIn.notes} onChange={e => setNewCheckIn(n => ({...n,notes:e.target.value}))} style={{ resize:"none" }}/></div>
              <div style={{ display:"flex", gap:6 }}><button className="btn-primary" style={{ fontSize:12 }} onClick={addCheckIn}>Save</button><button className="btn-ghost" style={{ fontSize:12 }} onClick={() => setShowCheckInForm(false)}>Cancel</button></div>
            </div>
          )}
          {(cr.checkIns||[]).length===0 && !showCheckInForm && <div style={{ color:"#A0A0A0", fontSize:13, textAlign:"center", padding:"30px 0" }}>No check-ins logged yet</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...(cr.checkIns||[])].reverse().map(ci => (
              <div key={ci.id} className="card" style={{ padding:"12px 14px", borderLeft:`3px solid ${ci.type==="monthly-1-1"?"#16A34A":ci.type==="weekly-call"?"#2563EB":"#E8C547"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:500 }}>{new Date(ci.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>
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
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {v.videoId && <span style={{ fontSize:12, color:"#6B6B6B", fontWeight:600 }}>{v.videoId}</span>}
                  <span style={{ fontSize:13, color:"#111111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.hook}</span>
                </div>
                <div style={{ fontSize:12, color:"#6B6B6B", marginTop:2 }}>{v.dueDate || v.date} · {v.platform}{v.delivery?` · ${v.delivery}`:""}</div>
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
          <textarea rows={12} placeholder="Strengths, weaknesses, what motivates them…" value={draft.notes||""} onChange={e => setDraft(d => ({...d,notes:e.target.value}))} style={{ resize:"vertical", fontSize:13, lineHeight:1.7 }}/>
          <div style={{ marginTop:10 }}><button className="btn-primary" style={{ fontSize:13 }} onClick={() => { updateCreator(cr.id, { notes:draft.notes }); showToast("Notes saved"); }}>Save notes</button></div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN: INVOICING ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function AdminInvoicing({ creators, videos, bonuses, showToast }) {
  const [filter, setFilter] = useState("all");
  const now = new Date();
  const thisMonday = getMondayOfWeek(now);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

  // Per-creator invoice data
  const activeCreators = creators.filter(c => c.status === "active");
  const creatorData = activeCreators.map(cr => {
    const myVideos = videos.filter(v => v.creatorId === cr.id);
    const invoiceable = myVideos.filter(v =>
      v.status === "posted" && v.videoUrl && !v.invoiced &&
      v.postedDate && new Date(v.postedDate) >= sevenDaysAgo
    );
    const invoiced = myVideos.filter(v => v.invoiced);
    const rate = cr.ratePerVideo || 0;
    const bonus = bonuses.find(b => b.creatorId === cr.id && b.weekStart === thisMonday);
    const pendingTotal = (invoiceable.length * rate) + (bonus ? bonus.amount : 0);
    const totalPaid = invoiced.length * rate;
    return { cr, invoiceable, invoiced, rate, bonus, pendingTotal, totalPaid, totalVideos: myVideos.length, posted: myVideos.filter(v => v.status === "posted").length };
  });

  const totalPending = creatorData.reduce((sum, d) => sum + d.pendingTotal, 0);
  const totalInvoiceable = creatorData.reduce((sum, d) => sum + d.invoiceable.length, 0);
  const totalInvoiced = creatorData.reduce((sum, d) => sum + d.invoiced.length, 0);
  const totalPaidOut = creatorData.reduce((sum, d) => sum + d.totalPaid, 0);

  const filtered = filter === "all" ? creatorData : creatorData.filter(d => d.cr.id === filter);

  return (
    <div className="fade">
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontWeight:600, fontSize:22 }}>Invoicing</h2>
        <p style={{ fontSize:13, color:"#6B6B6B", marginTop:3 }}>Track payments and outstanding invoices across creators</p>
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Pending this week", val:`£${totalPending.toFixed(2)}`, sub:`${totalInvoiceable} videos`, color: totalPending > 0 ? "#D97706" : "#111111" },
          { label:"Total invoiced", val:totalInvoiced, sub:"videos paid for" },
          { label:"Total paid out", val:`£${totalPaidOut.toFixed(2)}`, sub:"all time" },
          { label:"Active creators", val:activeCreators.length, sub:`${activeCreators.filter(c => c.ratePerVideo > 0).length} with rates set` },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="section-label" style={{ marginBottom:8 }}>{s.label}</div>
            <div className="stat-num" style={{ color: s.color || "#111111" }}>{s.val}</div>
            <div style={{ fontSize:12, color:"#A0A0A0", marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ marginBottom:16 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:"auto" }}>
          <option value="all">All creators</option>
          {activeCreators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Per-creator breakdown */}
      {filtered.map(({ cr, invoiceable, invoiced, rate, bonus, pendingTotal }) => (
        <div key={cr.id} className="card" style={{ marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:cr.color+"15", border:`1px solid ${cr.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:cr.color, fontWeight:600, flexShrink:0 }}>{cr.avatar}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:500 }}>{cr.name}</div>
              <div style={{ fontSize:12, color:"#6B6B6B" }}>{rate > 0 ? `£${rate}/video` : "No rate set"}</div>
            </div>
            {pendingTotal > 0 && <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#D97706" }}>£{pendingTotal.toFixed(2)}</div>
              <div style={{ fontSize:11, color:"#A0A0A0" }}>pending</div>
            </div>}
            {pendingTotal === 0 && <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:13, color:"#16A34A", fontWeight:500 }}>All clear</div>
            </div>}
          </div>

          {/* Invoiceable videos */}
          {invoiceable.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:500, color:"#D97706", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Awaiting invoice ({invoiceable.length})</div>
              {invoiceable.map(v => (
                <div key={v.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F5F5F5", fontSize:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontWeight:600, color:"#6B6B6B" }}>{v.videoId || "—"}</span>
                    <span style={{ color:"#111111" }}>{(v.hook||"").slice(0,40)}{(v.hook||"").length>40?"…":""}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {v.postedDate && <span style={{ color:"#A0A0A0", fontSize:11 }}>{formatDateShort(v.postedDate)}</span>}
                    <span style={{ fontWeight:500 }}>£{rate.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {bonus && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F5F5F5", fontSize:12, color:"#16A34A" }}>
                  <span style={{ fontWeight:500 }}>Performance bonus</span>
                  <span style={{ fontWeight:500 }}>£{bonus.amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Recently invoiced */}
          {invoiced.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:500, color:"#16A34A", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Invoiced ({invoiced.length})</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {invoiced.slice(0,10).map(v => (
                  <span key={v.id} style={{ fontSize:11, padding:"3px 8px", borderRadius:100, background:"#F0FDF4", color:"#16A34A" }}>{v.videoId || v.id.slice(0,8)}</span>
                ))}
                {invoiced.length > 10 && <span style={{ fontSize:11, color:"#A0A0A0", padding:"3px 4px" }}>+{invoiced.length - 10} more</span>}
              </div>
            </div>
          )}

          {invoiceable.length === 0 && invoiced.length === 0 && (
            <div style={{ fontSize:12, color:"#A0A0A0" }}>No invoice activity yet</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CREATOR PORTAL ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function CreatorPortal({ creator, videos, briefIdeas, bonuses, addBriefIdea, updateVideo, markVideosInvoiced, session, onSignOut, showToast, toast, readOnly }) {
  const [tab, setTab] = useState("dashboard");
  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"◉" },
    { id:"videos",    label:"Videos",    icon:"▶" },
    { id:"invoice",   label:"Invoice",   icon:"£" },
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
        {tab==="dashboard" && <CreatorDashboard creator={creator} videos={videos} addBriefIdea={addBriefIdea} showToast={showToast} session={session} onSignOut={onSignOut} readOnly={readOnly} />}
        {tab==="videos"    && <CreatorVideos creator={creator} videos={videos} updateVideo={updateVideo} showToast={showToast} readOnly={readOnly} />}
        {tab==="invoice"   && <CreatorInvoice creator={creator} videos={videos} bonuses={bonuses} markVideosInvoiced={markVideosInvoiced} showToast={showToast} readOnly={readOnly} />}
        {tab==="ideas"     && <CreatorIdeas creator={creator} briefIdeas={briefIdeas} addBriefIdea={addBriefIdea} showToast={showToast} readOnly={readOnly} />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#FFFFFF", borderTop:"1px solid #E5E5E5", height:60, display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
        <div style={{ display:"flex", maxWidth:520, width:"100%", justifyContent:"space-around" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"8px 16px", color:tab===t.id?"#111111":"#A0A0A0" }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:11, fontWeight:tab===t.id?600:400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && <div style={{ position:"fixed", bottom:72, left:"50%", transform:"translateX(-50%)", background:"#111111", color:"#FFFFFF", padding:"10px 20px", borderRadius:8, fontSize:13, fontWeight:500, zIndex:999 }}>{toast}</div>}
    </div>
  );
}

// ── Creator Dashboard ────────────────────────────────────────────────────────
function CreatorDashboard({ creator, videos, addBriefIdea, showToast, session, onSignOut, readOnly }) {
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title:"", description:"" });
  const [ideaSubmitted, setIdeaSubmitted] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const wkStart = weekStart.toISOString().split("T")[0];
  const wkEnd = weekEnd.toISOString().split("T")[0];

  const weekVideos = videos.filter(v => {
    const d = v.dueDate || v.assignedDate || v.date;
    return d && d >= wkStart && d <= wkEnd;
  });

  const assigned = weekVideos.filter(v => v.status === "assigned").length;
  const inProd = weekVideos.filter(v => !["assigned","posted"].includes(v.status)).length;
  const posted = weekVideos.filter(v => v.status === "posted").length;

  const submitIdea = async () => {
    if (!ideaForm.title.trim()) return;
    await addBriefIdea({ id: Date.now().toString(), creatorId: creator.id, title: ideaForm.title, description: ideaForm.description });
    if (window.emailjs) {
      try { await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { creator_name: creator.name, idea_title: ideaForm.title, idea_description: ideaForm.description, to_email: ADMIN_NOTIFY_EMAIL }, EMAILJS_PUBLIC_KEY); } catch (e) {}
    }
    setIdeaSubmitted(true);
    setIdeaForm({ title:"", description:"" });
    showToast("Idea submitted!");
  };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontWeight:700, fontSize:26 }}>Hey {creator.name.split(" ")[0]} 👋</div>
        <button onClick={onSignOut} style={{ background:"none", border:"none", fontSize:13, color:"#6B6B6B", cursor:"pointer" }}>{readOnly ? "Exit" : "Sign out"}</button>
      </div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>

      {/* Week summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:24 }}>
        {[{val:assigned,lbl:"Assigned",color:"#6B6B6B"},{val:inProd,lbl:"In progress",color:"#D97706"},{val:posted,lbl:"Posted",color:"#16A34A"}].map(s => (
          <div key={s.lbl} className="card" style={{ textAlign:"center", padding:12 }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:"#A0A0A0" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* This week's videos */}
      <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Your videos this week</div>
      {weekVideos.length === 0 && <div className="card" style={{ textAlign:"center", color:"#A0A0A0", fontSize:13, padding:24, marginBottom:24 }}>No videos assigned this week</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
        {weekVideos.map(vid => (
          <div key={vid.id} className="card" style={{ padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontWeight:600, fontSize:13 }}>{vid.videoId || vid.hook?.slice(0,30)}</span>
              <StatusBadge status={vid.status} />
            </div>
            <div style={{ fontSize:12, color:"#6B6B6B" }}>{vid.hook?.slice(0,60)}{vid.hook?.length>60?"…":""}</div>
            {(vid.dueDate || vid.date) && <div style={{ fontSize:11, color:"#A0A0A0", marginTop:4 }}>Due {formatDateShort(vid.dueDate || vid.date)}</div>}
          </div>
        ))}
      </div>

      {/* Brief idea CTA */}
      {!readOnly && (
        <div className="card" style={{ textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Got a brief idea?</div>
          <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:12 }}>Submit ideas for new content</div>
          <button className="btn-primary" style={{ width:"auto", display:"inline-block", padding:"10px 24px" }} onClick={() => { setShowIdeaModal(true); setIdeaSubmitted(false); }}>Submit idea →</button>
        </div>
      )}

      {showIdeaModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setShowIdeaModal(false)}>
          <div className="card" style={{ width:"100%", maxWidth:440 }} onClick={e => e.stopPropagation()}>
            {ideaSubmitted ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>Idea submitted!</div>
                <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:16 }}>We'll review it and get back to you.</div>
                <button className="btn-ghost" style={{ width:"auto", display:"inline-block" }} onClick={() => setShowIdeaModal(false)}>Close</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight:600, fontSize:16, marginBottom:16 }}>Submit a brief idea</div>
                <div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Idea title</div><input placeholder="e.g. Summer vintage haul" value={ideaForm.title} onChange={e => setIdeaForm(f => ({...f,title:e.target.value}))} /></div>
                <div style={{ marginBottom:16 }}><div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Description (optional)</div><textarea rows={4} placeholder="Describe your idea…" value={ideaForm.description} onChange={e => setIdeaForm(f => ({...f,description:e.target.value}))} style={{ resize:"vertical" }} /></div>
                <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={submitIdea}>Submit</button><button className="btn-ghost" onClick={() => setShowIdeaModal(false)}>Cancel</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creator Videos ───────────────────────────────────────────────────────────
function CreatorVideos({ creator, videos, updateVideo, showToast, readOnly }) {
  const [expandedId, setExpandedId] = useState(null);
  const [linkModal, setLinkModal] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");

  const assigned = videos.filter(v => v.status === "assigned");
  const inProd = videos.filter(v => ["editing","first draft","second draft","approved"].includes(v.status));
  const posted = videos.filter(v => v.status === "posted");

  const [openSections, setOpenSections] = useState({ assigned:true, production:true, posted:false });
  const toggle = (s) => setOpenSections(prev => ({...prev,[s]:!prev[s]}));

  const startProduction = async (id) => {
    await updateVideo(id, { status:"editing" });
    showToast("Moved to In Production");
  };

  const submitLink = async () => {
    if (!linkUrl.trim() || !linkModal) return;
    await updateVideo(linkModal, { videoUrl:linkUrl, status:"posted", postedDate:new Date().toISOString() });
    setLinkModal(null);
    setLinkUrl("");
    showToast("TikTok link submitted!");
  };

  const VideoCard = ({ vid, actions }) => {
    const expanded = expandedId === vid.id;
    return (
      <div className="card" style={{ padding:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, cursor:"pointer" }} onClick={() => setExpandedId(expanded ? null : vid.id)}>
          <span style={{ fontWeight:600, fontSize:14 }}>{vid.videoId || "—"}</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <StatusBadge status={vid.status} />
            <span style={{ fontSize:16, color:"#A0A0A0", transform:expanded?"rotate(180deg)":"rotate(0)", transition:"transform 0.15s", display:"inline-block" }}>▾</span>
          </div>
        </div>
        {(vid.dueDate || vid.date) && <div style={{ fontSize:11, color:"#6B6B6B", marginBottom:4 }}>Due {formatDateShort(vid.dueDate || vid.date)}</div>}
        {expanded && (
          <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #F5F5F5" }}>
            {vid.delivery && <div style={{ marginBottom:8 }}><span className="tag" style={{ background:"#EFF6FF", color:"#2563EB" }}>{vid.delivery}</span></div>}
            <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>Hook</div>
            <div style={{ fontSize:15, fontWeight:600, color:"#111111", lineHeight:1.5, marginBottom:12 }}>{vid.hook}</div>
            {vid.script && <><div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>Script</div><div style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7, whiteSpace:"pre-wrap", marginBottom:12 }}>{vid.script}</div></>}
            {vid.cta && <><div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>CTA</div><div style={{ fontSize:13, color:"#111111", marginBottom:12 }}>{vid.cta}</div></>}
          </div>
        )}
        {actions && !readOnly && <div style={{ marginTop:8 }}>{actions}</div>}
      </div>
    );
  };

  const Section = ({ id, label, count, children, countColor }) => (
    <div style={{ marginBottom:20 }}>
      <button onClick={() => toggle(id)} style={{ background:"none", border:"none", display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 0" }}>
        <span style={{ fontSize:14, color:openSections[id]?"#111111":"#6B6B6B", transform:openSections[id]?"rotate(90deg)":"rotate(0)", transition:"transform 0.15s", display:"inline-block" }}>▶</span>
        <span style={{ fontSize:14, fontWeight:600 }}>{label}</span>
        <span className="tag" style={{ marginLeft:4, ...(countColor ? { background:countColor, color:"#FFFFFF" } : {}) }}>{count}</span>
      </button>
      {openSections[id] && <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>{children}</div>}
    </div>
  );

  return (
    <div className="fade">
      <div style={{ fontWeight:700, fontSize:22, marginBottom:4 }}>Your Videos</div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>{videos.length} total</div>

      <Section id="assigned" label="Assigned" count={assigned.length}>
        {assigned.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", textAlign:"center", padding:12 }}>No assigned videos</div>}
        {assigned.map(vid => <VideoCard key={vid.id} vid={vid} actions={<button className="btn-primary" style={{ fontSize:13 }} onClick={() => startProduction(vid.id)}>Start production</button>} />)}
      </Section>

      <Section id="production" label="In Production" count={inProd.length}>
        {inProd.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", textAlign:"center", padding:12 }}>No videos in production</div>}
        {inProd.map(vid => <VideoCard key={vid.id} vid={vid} actions={<button className="btn-primary" style={{ fontSize:13 }} onClick={() => { setLinkModal(vid.id); setLinkUrl(vid.videoUrl||""); }}>Submit TikTok Link</button>} />)}
      </Section>

      <Section id="posted" label="Posted" count={posted.length} countColor="#16A34A">
        {posted.length === 0 && <div style={{ fontSize:13, color:"#A0A0A0", textAlign:"center", padding:12 }}>No posted videos yet</div>}
        {posted.map(vid => (
          <div key={vid.id} className="card" style={{ padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontWeight:600, fontSize:14 }}>{vid.videoId || "—"}</span>
              <StatusBadge status="posted" />
            </div>
            <div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>{vid.hook?.slice(0,60)}</div>
            {vid.videoUrl && <a href={vid.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize:13, color:"#2563EB", textDecoration:"none", fontWeight:500 }}>View on TikTok →</a>}
          </div>
        ))}
      </Section>

      {linkModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setLinkModal(null)}>
          <div className="card" style={{ width:"100%", maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:600, fontSize:16, marginBottom:16 }}>Submit TikTok Link</div>
            <div style={{ marginBottom:16 }}><div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>TikTok URL</div><input placeholder="https://tiktok.com/@…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} /></div>
            <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={submitLink}>Submit</button><button className="btn-ghost" onClick={() => setLinkModal(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creator Invoice ──────────────────────────────────────────────────────────
function CreatorInvoice({ creator, videos, bonuses, markVideosInvoiced, showToast, readOnly }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const invoiceable = videos.filter(v =>
    v.status === "posted" &&
    v.videoUrl &&
    !v.invoiced &&
    v.postedDate && new Date(v.postedDate) >= sevenDaysAgo
  );

  const rate = creator.ratePerVideo || 0;
  const subtotal = invoiceable.length * rate;

  // Check for bonus this week
  const thisMonday = getMondayOfWeek(now);
  const bonus = bonuses.find(b => b.creatorId === creator.id && b.weekStart === thisMonday);
  const bonusAmount = bonus ? bonus.amount : 0;
  const total = subtotal + bonusAmount;

  // Invoice period
  const earliestAssigned = invoiceable.reduce((min, v) => {
    const d = v.assignedDate || v.date;
    return d && (!min || d < min) ? d : min;
  }, null);
  const periodStart = earliestAssigned || now.toISOString().split("T")[0];
  const periodEndDate = new Date(periodStart); periodEndDate.setDate(periodEndDate.getDate() + 7);
  const periodEnd = periodEndDate.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const sendInvoice = async () => {
    if (invoiceable.length === 0 || readOnly) return;
    setSending(true);

    const lines = invoiceable.map(v =>
      `${v.videoId || v.id} — "${(v.hook||"").slice(0,50)}${(v.hook||"").length>50?"…":""}" — £${rate.toFixed(2)}`
    ).join("\n");
    const bonusLine = bonusAmount > 0 ? `\nPerformance bonus (week of ${formatDateShort(thisMonday)}): £${bonusAmount.toFixed(2)}` : "";

    // Send email via EmailJS
    if (window.emailjs) {
      try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_INVOICE_TEMPLATE_ID, {
          creator_name: creator.name,
          invoice_date: todayStr,
          invoice_period: `${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)}`,
          line_items: lines + bonusLine,
          total: `£${total.toFixed(2)}`,
          bank_details: creator.bankDetails || "Not provided",
          to_email: ADMIN_NOTIFY_EMAIL,
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) { /* silent */ }
    }

    // Mark as invoiced
    await markVideosInvoiced(invoiceable.map(v => v.id));

    setSending(false);
    setSent(true);
    showToast("Invoice sent!");
  };

  // Already-invoiced history
  const invoiced = videos.filter(v => v.invoiced);

  return (
    <div className="fade">
      <div style={{ fontWeight:700, fontSize:22, marginBottom:4 }}>Invoice</div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>
        {rate > 0 ? `£${rate} per video` : "Rate not set — contact admin"}
      </div>

      {sent ? (
        <div className="card" style={{ textAlign:"center", padding:"32px 20px", marginBottom:24 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>Invoice sent!</div>
          <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:16 }}>Sent to Tilt for processing. You'll receive payment shortly.</div>
          <button onClick={() => setSent(false)} style={{ background:"none", border:"none", fontSize:13, color:"#2563EB", cursor:"pointer" }}>Done</button>
        </div>
      ) : invoiceable.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:"32px 20px", marginBottom:24 }}>
          <div style={{ fontSize:14, color:"#6B6B6B" }}>No invoiceable videos right now</div>
          <div style={{ fontSize:12, color:"#A0A0A0", marginTop:4 }}>Videos become invoiceable once posted with a TikTok link (within 7 days)</div>
        </div>
      ) : (
        <div style={{ marginBottom:24 }}>
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Invoice period</div>
            <div style={{ fontSize:13, marginBottom:12 }}>{formatDateShort(periodStart)} – {formatDateShort(periodEnd)}</div>

            <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Line items</div>
            {invoiceable.map(v => (
              <div key={v.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F5F5F5", fontSize:13 }}>
                <div>
                  <span style={{ fontWeight:500 }}>{v.videoId || v.id}</span>
                  <span style={{ color:"#6B6B6B", marginLeft:8 }}>{(v.hook||"").slice(0,35)}{(v.hook||"").length>35?"…":""}</span>
                </div>
                <span style={{ fontWeight:500, flexShrink:0 }}>£{rate.toFixed(2)}</span>
              </div>
            ))}
            {bonusAmount > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F5F5F5", fontSize:13, color:"#16A34A" }}>
                <span style={{ fontWeight:500 }}>Performance bonus — week of {formatDateShort(thisMonday)}</span>
                <span style={{ fontWeight:500 }}>£{bonusAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", fontSize:16, fontWeight:700 }}>
              <span>Total</span>
              <span>£{total.toFixed(2)}</span>
            </div>
          </div>

          {!readOnly && (
            <button className="btn-primary" onClick={sendInvoice} disabled={sending} style={{ opacity:sending?0.6:1, fontSize:14 }}>
              {sending ? "Sending…" : "Generate & send invoice"}
            </button>
          )}
        </div>
      )}

      {/* Invoice history */}
      {invoiced.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:500, color:"#A0A0A0", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Previously invoiced</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {invoiced.map(v => (
              <div key={v.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"#FAFAFA", borderRadius:6, fontSize:13 }}>
                <span style={{ fontWeight:500 }}>{v.videoId || v.id}</span>
                <span style={{ color:"#16A34A", fontSize:11 }}>Invoiced</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Creator Ideas ────────────────────────────────────────────────────────────
function CreatorIdeas({ creator, briefIdeas, addBriefIdea, showToast, readOnly }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", description:"" });

  const submit = async () => {
    if (!form.title.trim()) return;
    await addBriefIdea({ id: Date.now().toString(), creatorId: creator.id, title: form.title, description: form.description });
    if (window.emailjs) {
      try { await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { creator_name: creator.name, idea_title: form.title, idea_description: form.description, to_email: ADMIN_NOTIFY_EMAIL }, EMAILJS_PUBLIC_KEY); } catch (e) {}
    }
    setForm({ title:"", description:"" });
    setShowForm(false);
    showToast("Idea submitted!");
  };

  const STATUS_STYLE = { pending:{ bg:"#FEF3C7", color:"#D97706" }, approved:{ bg:"#F0FDF4", color:"#16A34A" }, rejected:{ bg:"#FEF2F2", color:"#DC2626" } };

  return (
    <div className="fade">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontWeight:700, fontSize:22 }}>Your Ideas</div>
        {!readOnly && <button onClick={() => setShowForm(!showForm)} style={{ background:"#111111", color:"#FFFFFF", border:"none", borderRadius:6, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer", width:"auto" }}>+ New idea</button>}
      </div>
      <div style={{ fontSize:13, color:"#6B6B6B", marginBottom:24 }}>{briefIdeas.length} submitted</div>

      {showForm && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ marginBottom:12 }}><div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Idea title</div><input placeholder="e.g. Summer vintage haul" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} /></div>
          <div style={{ marginBottom:16 }}><div style={{ fontSize:12, color:"#6B6B6B", marginBottom:4 }}>Description (optional)</div><textarea rows={4} placeholder="Describe your idea…" value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} style={{ resize:"vertical" }} /></div>
          <div style={{ display:"flex", gap:8 }}><button className="btn-primary" onClick={submit}>Submit</button><button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button></div>
        </div>
      )}

      {briefIdeas.length === 0 && !showForm && (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <div style={{ fontSize:32, marginBottom:8, opacity:0.3 }}>💡</div>
          <div style={{ fontSize:14, color:"#6B6B6B", marginBottom:16 }}>No ideas submitted yet</div>
          {!readOnly && <button onClick={() => setShowForm(true)} style={{ background:"#111111", color:"#FFFFFF", border:"none", borderRadius:6, padding:"10px 24px", fontSize:14, fontWeight:500, cursor:"pointer" }}>Submit your first idea</button>}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {briefIdeas.map(idea => {
          const st = STATUS_STYLE[idea.status] || STATUS_STYLE.pending;
          return (
            <div key={idea.id} className="card">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontWeight:500, fontSize:14 }}>{idea.title}</div>
                <span style={{ padding:"4px 8px", borderRadius:100, fontSize:11, fontWeight:500, background:st.bg, color:st.color, textTransform:"capitalize", flexShrink:0 }}>{idea.status}</span>
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
