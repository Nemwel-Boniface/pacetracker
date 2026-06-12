'use client';
import { useEffect, useState } from 'react';
import { Member, ActivityLog, ActivityType, CountryConfig, ACTIVITY_LABELS, ACTIVITY_CATEGORY_MAP, ACTIVITY_POINTS, getCountryFlag } from '@/types';

const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
function today() { return new Date().toISOString().slice(0,10); }
function yesterday() { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function fmtDate(d:string) { return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }

export default function ActivitiesPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(yesterday());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ memberId:'', activityType:'run' as ActivityType, notes:'' });
  const [error, setError] = useState('');

  useEffect(()=>{
    Promise.all([
      fetch('/api/members').then(r=>r.json()),
      fetch('/api/countries').then(r=>r.json()),
    ]).then(([md, cd])=>{
      setMembers((md.members||[]).filter((m:Member)=>m.isActive));
      setCountries(cd.countries || []);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{ setLoading(true); fetch(`/api/activities?date=${date}`).then(r=>r.json()).then(d=>setActivities(d.activities||[])).catch(()=>setActivities([])).finally(()=>setLoading(false)); },[date]);

  async function handleLog(e:React.FormEvent) {
    e.preventDefault(); if(!form.memberId){setError('Select a member');return;} setSaving(true); setError('');
    const member=members.find(m=>m.id===form.memberId);
    try {
      const res=await fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,memberName:member?.name||'',date})});
      const data=await res.json();
      if(!res.ok){setError(data.error||'Failed');}else{setActivities(p=>[data.activity,...p]);setForm({memberId:'',activityType:'run',notes:''});setShowForm(false);}
    } catch{setError('Connection error');}finally{setSaving(false);}
  }
  async function handleDelete(id:string){if(!confirm('Remove this activity?'))return;await fetch(`/api/activities?id=${id}`,{method:'DELETE'});setActivities(p=>p.filter(a=>a.id!==id));}
  const pts=ACTIVITY_POINTS[ACTIVITY_CATEGORY_MAP[form.activityType]];

  return (
    <div style={{padding:24,maxWidth:800,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div><h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Log Activities</h1><p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>Track daily participation — backfill previous days anytime</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:'10px 20px',borderRadius:10,background:'#f26522',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>+ Log Activity</button>
      </div>

      <div style={{background:'white',borderRadius:16,padding:'14px 20px',border:'1px solid #f3f4f6',marginBottom:16,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <span style={{fontSize:14}}>📅</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={today()} style={{fontWeight:700,fontSize:14,color:'#1f2937',border:'none',outline:'none',background:'transparent'}}/>
        <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
          <button onClick={()=>setDate(yesterday())} style={{padding:'6px 12px',borderRadius:8,border:'1px solid #e5e7eb',background:'white',fontSize:12,cursor:'pointer',fontWeight:600}}>Yesterday</button>
          <button onClick={()=>setDate(today())} style={{padding:'6px 12px',borderRadius:8,border:'1px solid #e5e7eb',background:'white',fontSize:12,cursor:'pointer',fontWeight:600}}>Today</button>
        </div>
      </div>

      {showForm && (
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:16}}>
          <h2 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Log for {fmtDate(date)}</h2>
          <form onSubmit={handleLog}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Member *</label>
                <select value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})} style={inp}>
                  <option value="">Select member...</option>
                  {members.map(m=><option key={m.id} value={m.id}>{getCountryFlag(m.country, countries)} {m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Activity *</label>
                <select value={form.activityType} onChange={e=>setForm({...form,activityType:e.target.value as ActivityType})} style={inp}>
                  {Object.entries(ACTIVITY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Notes (optional)</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="e.g. 5km in 32min..." style={inp}/>
              </div>
            </div>
            <div style={{fontSize:13,color:'#6b7280',marginBottom:12}}>This awards <strong style={{color:'#1a7a4a',fontSize:16}}>{pts}</strong> point{pts!==1?'s':''}</div>
            {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            {members.length===0 && <div style={{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',padding:'8px 12px',borderRadius:8,fontSize:12,marginBottom:12}}>No active members found. Add members first.</div>}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving||members.length===0} style={{padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',opacity:saving||members.length===0?0.6:1}}>{saving?'Logging...':'Log Activity'}</button>
              <button type="button" onClick={()=>{setShowForm(false);setError('');}} style={{padding:'10px 20px',borderRadius:10,background:'#f3f4f6',color:'#374151',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{background:'white',borderRadius:16,border:'1px solid #f3f4f6'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{fontWeight:700,fontSize:15,color:'#374151',margin:0}}>{fmtDate(date)} · {activities.length} entr{activities.length!==1?'ies':'y'}</h2>
          <span style={{fontSize:12,color:'#9ca3af'}}>{activities.reduce((s,a)=>s+a.points,0)} pts total</span>
        </div>
        {loading ? <div style={{textAlign:'center',padding:'3rem'}}><div style={{width:24,height:24,border:'3px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        : activities.length===0 ? <div style={{textAlign:'center',padding:'3rem',color:'#9ca3af'}}><div style={{fontSize:40,marginBottom:8}}>📋</div><p style={{margin:0,fontSize:13}}>No activities logged for this date</p><p style={{fontSize:11,marginTop:4,color:'#d1d5db'}}>You can backfill entries for any previous day</p></div>
        : activities.map(a=>(
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 20px',borderBottom:'1px solid #fafafa'}}>
            <span style={{fontSize:20}}>{ACTIVITY_LABELS[a.activityType]?.split(' ')[0]||'✨'}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,color:'#1f2937'}}>{a.memberName} <span style={{color:'#9ca3af',fontWeight:400}}>· {ACTIVITY_LABELS[a.activityType]}</span></div>
              {a.notes && <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{a.notes}</div>}
              <div style={{fontSize:10,color:'#d1d5db',marginTop:2}}>Logged {new Date(a.loggedAt).toLocaleTimeString()}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
              <span style={{fontWeight:900,color:'#1a7a4a',fontSize:14}}>+{a.points}pt{a.points!==1?'s':''}</span>
              <button onClick={()=>handleDelete(a.id)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
