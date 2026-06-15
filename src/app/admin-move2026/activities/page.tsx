'use client';
import { useEffect, useState, useRef } from 'react';
import { Member, ActivityLog, ActivityType, CountryConfig, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, getCountryFlag } from '@/types';

type Peer = { id: string; name: string; avatarInitials: string; };

const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
function today() { return new Date().toISOString().slice(0,10); }
function yesterday() { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function fmtDate(d:string) { return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }
function actMeta(a:ActivityLog) { return [a.distance!=null?`${a.distance}km`:null,a.duration!=null?`${a.duration}min`:null,a.notes||null].filter(Boolean).join(' · '); }
function initials(name:string) { return name.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase(); }

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ text, size=32, bg='#7c3aed' }: { text:string; size?:number; bg?:string }) {
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38,fontWeight:800,color:'white',flexShrink:0,letterSpacing:'-0.03em'}}>
      {text}
    </div>
  );
}

// ─── TeamMemberSelector ───────────────────────────────────────────────────────
function TeamMemberSelector({ peers, selected, onChange }: { peers:Peer[]; selected:string[]; onChange:(ids:string[])=>void; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function handler(e:MouseEvent){ if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false); }
    document.addEventListener('mousedown',handler);
    return ()=>document.removeEventListener('mousedown',handler);
  },[]);

  const selectedPeers = peers.filter(p=>selected.includes(p.id));
  const available = peers.filter(p=>!selected.includes(p.id));

  function toggle(id:string){ onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]); }

  return (
    <div ref={ref} style={{position:'relative'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:6,padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:10,background:'white',cursor:'pointer',minHeight:42}}>
        {selectedPeers.map(p=>(
          <span key={p.id} style={{display:'inline-flex',alignItems:'center',gap:5,background:'#ede9fe',borderRadius:20,padding:'3px 8px 3px 4px',fontSize:12,fontWeight:700,color:'#6d28d9'}}>
            <Avatar text={p.avatarInitials} size={18} bg='#7c3aed'/>
            {p.name.split(' ')[0]}
            <button type="button" onClick={e=>{e.stopPropagation();toggle(p.id);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#7c3aed',lineHeight:1,padding:0,marginLeft:2}}>×</button>
          </span>
        ))}
        {selectedPeers.length===0&&<span style={{color:'#9ca3af',fontSize:13}}>Select teammates…</span>}
        <span style={{marginLeft:'auto',fontSize:11,color:'#9ca3af',flexShrink:0}}>▾</span>
      </div>
      {open&&available.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',border:'1px solid #e5e7eb',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,maxHeight:200,overflowY:'auto',marginTop:4}}>
          {available.map(p=>(
            <div key={p.id} onClick={()=>toggle(p.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='#faf5ff')} onMouseLeave={e=>(e.currentTarget.style.background='white')}>
              <Avatar text={p.avatarInitials} size={28} bg='#6d28d9'/>
              <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>{p.name}</span>
            </div>
          ))}
        </div>
      )}
      {open&&available.length===0&&selectedPeers.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 16px',zIndex:100,marginTop:4,fontSize:12,color:'#6b7280',textAlign:'center'}}>All available teammates added!</div>
      )}
    </div>
  );
}

// ─── PointsPreview ────────────────────────────────────────────────────────────
function PointsPreview({ basePoints, teamCount }: { basePoints:number; teamCount:number }) {
  const pts = teamCount>0?basePoints+1:basePoints;
  if(teamCount===0) return (
    <div style={{padding:'10px 14px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,color:'#6b7280'}}>
      Awards <strong style={{color:'#1a7a4a',fontSize:14}}>{basePoints}</strong> point{basePoints!==1?'s':''} to the member
    </div>
  );
  return (
    <div style={{borderRadius:10,overflow:'hidden',border:'1px solid #d1fae5'}}>
      <style>{`@keyframes slideGrad{0%{background-position:0% 0%}100%{background-position:200% 0%}}`}</style>
      <div style={{background:'linear-gradient(90deg,#059669,#7c3aed,#1a7a4a)',backgroundSize:'200% 100%',animation:'slideGrad 3s linear infinite',padding:'9px 14px',display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:18}}>🤝</span>
        <span style={{fontWeight:900,fontSize:12,color:'white',letterSpacing:'0.08em'}}>TEAM SPIRIT ACTIVATED</span>
        <span style={{marginLeft:'auto',background:'rgba(255,255,255,0.25)',color:'white',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:800}}>+1 BONUS</span>
      </div>
      <div style={{background:'#f0fdf4',padding:'10px 14px',display:'flex',alignItems:'center',gap:12}}>
        <span style={{textDecoration:'line-through',color:'#9ca3af',fontSize:12}}>{basePoints}pt</span>
        <strong style={{fontSize:20,color:'#14532d'}}>{pts} pts</strong>
        <span style={{fontSize:12,color:'#6b7280'}}>× {teamCount+1} people</span>
      </div>
    </div>
  );
}

// ─── AdminParticipantPanel ────────────────────────────────────────────────────
function AdminParticipantPanel({ originalId }: { originalId:string }) {
  const [open, setOpen] = useState(false);
  const [original, setOriginal] = useState<ActivityLog|null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if(original){setOpen(o=>!o);return;}
    setLoading(true);
    try {
      const res=await fetch(`/api/activities/${originalId}`);
      if(res.ok){const d=await res.json();setOriginal(d.activity);setOpen(true);}
    } finally{setLoading(false);}
  }

  return (
    <div style={{marginTop:4}}>
      <button type="button" onClick={load} style={{fontSize:11,color:'#7c3aed',background:'transparent',border:'none',cursor:'pointer',padding:'2px 0',textDecoration:'underline'}}>
        {loading?'Loading…':open?'Hide participants ▲':'Who was there? ▾'}
      </button>
      {open&&original&&(
        <div style={{marginTop:6,background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:8,padding:'10px 12px'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#7c3aed',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Participants</div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
            <Avatar text={initials(original.memberName)} size={22} bg='#1a7a4a'/>
            <span style={{fontSize:12,fontWeight:700,color:'#166534'}}>{original.memberName}</span>
            <span style={{fontSize:10,background:'#dcfce7',color:'#15803d',padding:'1px 6px',borderRadius:10}}>Organizer</span>
          </div>
          {(original.teamMembers??[]).map(m=>(
            <div key={m.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <Avatar text={initials(m.name)} size={22} bg='#7c3aed'/>
              <span style={{fontSize:12,color:'#6d28d9',fontWeight:600}}>{m.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AdminEditTeamPanel ───────────────────────────────────────────────────────
function AdminEditTeamPanel({ activity, allPeers, onUpdated }: { activity:ActivityLog; allPeers:Peer[]; onUpdated:(a:ActivityLog)=>void; }) {
  const [open, setOpen] = useState(false);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const alreadyTagged = new Set((activity.teamMembers??[]).map(m=>m.id));
  alreadyTagged.add(activity.memberId);
  const available = allPeers.filter(p=>!alreadyTagged.has(p.id));

  if(!open) return (
    <button type="button" onClick={()=>setOpen(true)} style={{fontSize:11,color:'#f26522',background:'transparent',border:'none',cursor:'pointer',padding:'3px 0',textDecoration:'underline',marginTop:3}}>
      + Add teammates
    </button>
  );

  async function save(){
    if(!newIds.length)return;
    setSaving(true);setError('');
    try{
      const res=await fetch(`/api/activities/${activity.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamMemberIds:newIds})});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Failed');}
      else{onUpdated(data.activity);setOpen(false);setNewIds([]);}
    }catch{setError('Connection error');}finally{setSaving(false);}
  }

  return (
    <div style={{marginTop:8,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:'10px 12px'}}>
      <div style={{fontWeight:700,fontSize:12,color:'#9a3412',marginBottom:8}}>Add teammates to this activity</div>
      {available.length===0?(
        <div style={{fontSize:12,color:'#9ca3af'}}>All members are already in this activity</div>
      ):(
        <>
          <TeamMemberSelector peers={available} selected={newIds} onChange={setNewIds}/>
          {error&&<div style={{color:'#dc2626',fontSize:11,marginTop:6}}>{error}</div>}
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button type="button" onClick={save} disabled={saving||!newIds.length} style={{padding:'6px 14px',borderRadius:8,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:12,border:'none',cursor:'pointer',opacity:saving||!newIds.length?0.5:1}}>
              {saving?'Saving…':'Save'}
            </button>
            <button type="button" onClick={()=>{setOpen(false);setNewIds([]);}} style={{padding:'6px 14px',borderRadius:8,background:'#f3f4f6',color:'#374151',fontWeight:700,fontSize:12,border:'none',cursor:'pointer'}}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivitiesPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(yesterday());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ memberId:'', activityType:'run' as ActivityType, notes:'', distance:'', duration:'' });
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(()=>{
    Promise.all([
      fetch('/api/members').then(r=>r.json()),
      fetch('/api/countries').then(r=>r.json()),
    ]).then(([md,cd])=>{
      setMembers((md.members||[]).filter((m:Member)=>m.isActive&&!m.isShadowUser));
      setCountries(cd.countries||[]);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    setLoading(true);
    fetch(`/api/activities?date=${date}`).then(r=>r.json()).then(d=>setActivities(d.activities||[])).catch(()=>setActivities([])).finally(()=>setLoading(false));
  },[date]);

  function setPrimaryMember(id:string){ setForm(f=>({...f,memberId:id})); setTeamMemberIds([]); }

  async function handleLog(e:React.FormEvent){
    e.preventDefault();
    if(!form.memberId){setError('Select a member');return;}
    setSaving(true);setError('');
    const member=members.find(m=>m.id===form.memberId);
    const body={
      memberId:form.memberId, memberName:member?.name||'', activityType:form.activityType,
      date, notes:form.notes,
      ...(form.distance?{distance:parseFloat(form.distance)}:{}),
      ...(form.duration?{duration:parseInt(form.duration)}:{}),
      ...(teamMemberIds.length>0?{teamMemberIds}:{}),
    };
    try{
      const res=await fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Failed');}
      else{
        setActivities(p=>[data.activity,...p]);
        setForm({memberId:'',activityType:'run',notes:'',distance:'',duration:''});
        setTeamMemberIds([]);
        setShowForm(false);
      }
    }catch{setError('Connection error');}finally{setSaving(false);}
  }

  async function handleDelete(id:string){
    if(!confirm('Remove this activity?'))return;
    await fetch(`/api/activities?id=${id}`,{method:'DELETE'});
    setActivities(p=>p.filter(a=>a.id!==id));
  }

  function handleActivityUpdated(updated:ActivityLog){ setActivities(p=>p.map(a=>a.id===updated.id?updated:a)); }

  const basePoints = ACTIVITY_POINTS[ACTIVITY_CATEGORY_MAP[form.activityType]];
  const teamPeers: Peer[] = members.filter(m=>m.id!==form.memberId).map(m=>({id:m.id,name:m.name,avatarInitials:m.avatarInitials}));
  const allPeers: Peer[] = members.map(m=>({id:m.id,name:m.name,avatarInitials:m.avatarInitials}));

  const ownActivities = activities.filter(a=>!a.isTeamActivity);
  const groupActivities = activities.filter(a=>a.isTeamActivity);
  const groupCount = groupActivities.length;

  const btnOrange = { padding:'10px 20px',borderRadius:10,background:'#f26522',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer' };
  const btnGreen  = { padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer' };
  const btnGray   = { padding:'10px 20px',borderRadius:10,background:'#f3f4f6',color:'#374151',fontWeight:700,fontSize:13,border:'none',cursor:'pointer' };
  const btnDate   = { padding:'6px 12px',borderRadius:8,border:'1px solid #e5e7eb',background:'white',fontSize:12,cursor:'pointer',fontWeight:600 };
  const lbl       = { display:'block' as const,fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.04em' };

  return (
    <div style={{padding:24,maxWidth:800,margin:'0 auto'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Log Activities</h1>
          <p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>Track daily participation — backfill previous days anytime</p>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={btnOrange}>+ Log Activity</button>
      </div>

      {/* Date picker */}
      <div style={{background:'white',borderRadius:16,padding:'14px 20px',border:'1px solid #f3f4f6',marginBottom:16,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <span style={{fontSize:14}}>📅</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{fontWeight:700,fontSize:14,color:'#1f2937',border:'none',outline:'none',background:'transparent'}}/>
        <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
          <button onClick={()=>setDate(yesterday())} style={btnDate}>Yesterday</button>
          <button onClick={()=>setDate(today())} style={btnDate}>Today</button>
        </div>
      </div>

      {/* Log form */}
      {showForm&&(
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:16}}>
          <h2 style={{fontWeight:700,marginBottom:16,fontSize:15,color:'#1f2937'}}>Log for {fmtDate(date)}</h2>
          <form onSubmit={handleLog}>
            {/* Primary Member + Activity */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={lbl}>Primary Member *</label>
                <select value={form.memberId} onChange={e=>setPrimaryMember(e.target.value)} style={inp}>
                  <option value="">Select member…</option>
                  {members.map(m=><option key={m.id} value={m.id}>{getCountryFlag(m.country,countries)} {m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Activity *</label>
                <select value={form.activityType} onChange={e=>setForm({...form,activityType:e.target.value as ActivityType})} style={inp}>
                  {Object.entries(ACTIVITY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Distance / Duration / Notes */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:12,marginBottom:12}}>
              <div>
                <label style={lbl}>Distance — km</label>
                <input type="number" min="0" step="0.1" value={form.distance} onChange={e=>setForm({...form,distance:e.target.value})} placeholder="e.g. 5.2" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Duration — min</label>
                <input type="number" min="1" step="1" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} placeholder="e.g. 32" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="e.g. morning run…" style={inp}/>
              </div>
            </div>

            {/* Team selector */}
            {form.memberId&&teamPeers.length>0&&(
              <div style={{marginBottom:14}}>
                <label style={lbl}>
                  Who else was with {members.find(m=>m.id===form.memberId)?.name.split(' ')[0]}? (optional)
                </label>
                <TeamMemberSelector peers={teamPeers} selected={teamMemberIds} onChange={setTeamMemberIds}/>
              </div>
            )}

            {/* Points preview */}
            <div style={{marginBottom:14}}>
              <PointsPreview basePoints={basePoints} teamCount={teamMemberIds.length}/>
            </div>

            {error&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            {members.length===0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',padding:'8px 12px',borderRadius:8,fontSize:12,marginBottom:12}}>No active members found.</div>}

            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving||members.length===0} style={{...btnGreen,opacity:saving||members.length===0?0.6:1}}>{saving?'Logging…':'Log Activity'}</button>
              <button type="button" onClick={()=>{setShowForm(false);setError('');setTeamMemberIds([]);}} style={btnGray}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Own Activities list */}
      <div style={{background:'white',borderRadius:16,border:'1px solid #f3f4f6',marginBottom:groupCount>0?16:0}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{fontWeight:700,fontSize:15,color:'#374151',margin:0}}>{fmtDate(date)} · {ownActivities.length} entr{ownActivities.length!==1?'ies':'y'}</h2>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {groupCount>0&&<span style={{fontSize:11,background:'#ede9fe',color:'#7c3aed',padding:'3px 10px',borderRadius:20,fontWeight:700}}>🤝 {groupCount} group</span>}
            <span style={{fontSize:12,color:'#9ca3af'}}>{ownActivities.reduce((s,a)=>s+a.points,0)} pts</span>
          </div>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:'3rem'}}>
            <div style={{width:24,height:24,border:'3px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/>
          </div>
        ):ownActivities.length===0?(
          <div style={{textAlign:'center',padding:'3rem',color:'#9ca3af'}}>
            <div style={{fontSize:40,marginBottom:8}}>📋</div>
            <p style={{margin:0,fontSize:13}}>No activities logged for this date</p>
            <p style={{fontSize:11,marginTop:4,color:'#d1d5db'}}>You can backfill entries for any previous day</p>
          </div>
        ):ownActivities.map(a=>{
          const meta=actMeta(a);
          const withNames=a.teamMembers?.map(m=>m.name.split(' ')[0]).join(', ');
          return (
            <div key={a.id} style={{borderBottom:'1px solid #fafafa'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:14,padding:'14px 20px'}}>
                <span style={{fontSize:22,flexShrink:0,marginTop:2}}>{ACTIVITY_LABELS[a.activityType]?.split(' ')[0]||'✨'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,color:'#1f2937'}}>
                    {a.memberName} <span style={{color:'#9ca3af',fontWeight:400}}>· {ACTIVITY_LABELS[a.activityType]}</span>
                  </div>
                  {meta&&<div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{meta}</div>}
                  {withNames&&(
                    <div style={{fontSize:11,color:'#7c3aed',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                      🤝 with {withNames}
                    </div>
                  )}
                  <div style={{fontSize:10,color:'#d1d5db',marginTop:2}}>Logged {new Date(a.loggedAt).toLocaleTimeString()}</div>
                  <AdminEditTeamPanel activity={a} allPeers={allPeers} onUpdated={handleActivityUpdated}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                  <span style={{fontWeight:900,color:'#1a7a4a',fontSize:14}}>+{a.points}pt{a.points!==1?'s':''}</span>
                  <button onClick={()=>handleDelete(a.id)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16}}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Group Activities section */}
      {!loading&&groupCount>0&&(
        <div style={{borderRadius:16,border:'1px solid #e9d5ff',overflow:'hidden'}}>
          <div style={{background:'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)',padding:'14px 20px',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>🤝</span>
            <div>
              <div style={{fontWeight:800,fontSize:14,color:'white'}}>Group Activities</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.7)'}}>Auto-logged for tagged members</div>
            </div>
            <span style={{marginLeft:'auto',background:'rgba(255,255,255,0.2)',color:'white',padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:700}}>{groupCount}</span>
          </div>
          {groupActivities.map(a=>{
            const meta=actMeta(a);
            return (
              <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'14px 20px',borderBottom:'1px solid #f3e8ff',background:'#faf5ff'}}>
                <div style={{width:38,height:38,background:'#ede9fe',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                  {ACTIVITY_LABELS[a.activityType]?.split(' ')[0]||'✨'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontWeight:600,fontSize:14,color:'#3b0764'}}>{a.memberName}</span>
                    <span style={{fontSize:10,background:'#ede9fe',color:'#7c3aed',padding:'2px 7px',borderRadius:10,fontWeight:700}}>GROUP</span>
                  </div>
                  <div style={{fontSize:11,color:'#7c3aed',marginTop:2}}>{ACTIVITY_LABELS[a.activityType]}</div>
                  {meta&&<div style={{fontSize:11,color:'#a78bfa',marginTop:2}}>{meta}</div>}
                  {a.teamActivityOwner&&(
                    <div style={{fontSize:11,color:'#6b7280',marginTop:4,display:'flex',alignItems:'center',gap:5}}>
                      <Avatar text={initials(a.teamActivityOwner.name)} size={16} bg='#7c3aed'/>
                      Added by <strong style={{color:'#7c3aed',marginLeft:3}}>{a.teamActivityOwner.name}</strong>
                    </div>
                  )}
                  {a.teamActivityId&&<AdminParticipantPanel originalId={a.teamActivityId}/>}
                  <div style={{fontSize:10,color:'#c4b5fd',marginTop:3}}>Logged {new Date(a.loggedAt).toLocaleTimeString()}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                  <span style={{fontWeight:900,color:'#7c3aed',fontSize:14}}>+{a.points}pt{a.points!==1?'s':''}</span>
                  <button onClick={()=>handleDelete(a.id)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16}}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
