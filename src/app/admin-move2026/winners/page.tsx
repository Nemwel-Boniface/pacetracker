'use client';
import { useEffect, useState } from 'react';
import { Winner, PrizeCategory, MemberStats, CountryConfig, getCountryFlag } from '@/types';
const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
export default function WinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ prizeCategoryId:'', memberId:'', isVisible:false });
  const [error, setError] = useState('');
  useEffect(()=>{
    Promise.all([fetch('/api/winners').then(r=>r.json()),fetch('/api/prizes').then(r=>r.json()),fetch('/api/leaderboard').then(r=>r.json()),fetch('/api/countries').then(r=>r.json())])
      .then(([w,p,l,cd])=>{ setWinners(w.winners||[]); setPrizes(p.prizes||[]); setStats(l.stats||[]); setCountries(cd.countries||[]); }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  async function handleCreate(e:React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    const prize=prizes.find(p=>p.id===form.prizeCategoryId); const member=stats.find(s=>s.memberId===form.memberId);
    try {
      const res=await fetch('/api/winners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prizeCategoryId:form.prizeCategoryId,prizeCategoryName:prize?.name||'',memberId:form.memberId,memberName:member?.memberName||'',country:member?.country||'Kenya',isVisible:form.isVisible})});
      const data=await res.json(); if(!res.ok){setError(data.error||'Failed');}else{setWinners(p=>[data.winner,...p]);setForm({prizeCategoryId:'',memberId:'',isVisible:false});setShowForm(false);}
    } catch{setError('Connection error');}finally{setSaving(false);}
  }
  async function toggleVisibility(winner:Winner){
    const res=await fetch('/api/winners',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:winner.id,isVisible:!winner.isVisible})});
    const data=await res.json(); if(res.ok)setWinners(w=>w.map(x=>x.id===winner.id?data.winner:x));
  }
  async function handleDelete(id:string,name:string){ if(!confirm(`Remove winner entry for ${name}?`))return; await fetch(`/api/winners?id=${id}`,{method:'DELETE'}); setWinners(w=>w.filter(x=>x.id!==id)); }
  return (
    <div style={{padding:24,maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div><h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Winners</h1><p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>Announce and display challenge winners</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>+ Add Winner</button>
      </div>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:14,marginBottom:20,fontSize:13,color:'#1e40af'}}>
        <strong>How it works:</strong> Add winners once the challenge concludes. Toggle visibility to show them on the public leaderboard and all generated images/PDFs. You can hide them again at any time.
      </div>
      {showForm && (
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:20}}>
          <h2 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Announce a Winner</h2>
          {prizes.length===0 ? <div style={{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',padding:'10px 14px',borderRadius:8,fontSize:13}}>Create prize categories first before adding winners.</div>
          : stats.length===0 ? <div style={{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',padding:'10px 14px',borderRadius:8,fontSize:13}}>No members found. Add members and log activities first.</div>
          : <form onSubmit={handleCreate}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Prize Category *</label>
                <select value={form.prizeCategoryId} onChange={e=>setForm({...form,prizeCategoryId:e.target.value})} required style={inp}><option value="">Select prize...</option>{prizes.map(p=><option key={p.id} value={p.id}>{p.name}{p.amount>0?` ($${p.amount})`:''}</option>)}</select>
              </div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Winner *</label>
                <select value={form.memberId} onChange={e=>setForm({...form,memberId:e.target.value})} required style={inp}><option value="">Select member...</option>{stats.filter(s=>s.isActive).map(s=><option key={s.memberId} value={s.memberId}>{getCountryFlag(s.country, countries)} {s.memberName} ({s.totalPoints}pts)</option>)}</select>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><input type="checkbox" id="wvis" checked={form.isVisible} onChange={e=>setForm({...form,isVisible:e.target.checked})}/><label htmlFor="wvis" style={{fontSize:13,color:'#374151'}}>Show on public leaderboard immediately</label></div>
            {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving} style={{padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',opacity:saving?0.6:1}}>{saving?'Saving...':'Add Winner'}</button>
              <button type="button" onClick={()=>{setShowForm(false);setError('');}} style={{padding:'10px 20px',borderRadius:10,background:'#f3f4f6',color:'#374151',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>Cancel</button>
            </div>
          </form>}
        </div>
      )}
      {loading ? <div style={{textAlign:'center',padding:'3rem'}}><div style={{width:32,height:32,border:'4px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
      : winners.length===0 ? <div style={{textAlign:'center',padding:'4rem',background:'white',borderRadius:16,border:'1px solid #f3f4f6'}}><div style={{fontSize:48,marginBottom:8}}>🏆</div><h3 style={{fontWeight:700,color:'#374151',marginBottom:4}}>No winners announced yet</h3><p style={{color:'#9ca3af',fontSize:13}}>Winners will appear here once you add them</p></div>
      : <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {winners.map(w=>(
          <div key={w.id} style={{background:w.isVisible?'#fffbeb':'white',borderRadius:16,padding:20,border:w.isVisible?'1px solid #fcd34d':'1px solid #f3f4f6'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:36}}>🏅</span>
                <div>
                  <div style={{fontWeight:700,color:'#1f2937'}}>{w.memberName}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#f26522'}}>{w.prizeCategoryName}</div>
                  <div style={{fontSize:11,color:'#9ca3af'}}>{getCountryFlag(w.country, countries)} {w.country}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:999,fontWeight:600,background:w.isVisible?'#f0fdf4':'#f9fafb',color:w.isVisible?'#15803d':'#6b7280'}}>{w.isVisible?'👁️ Visible':'🔒 Hidden'}</span>
                <button onClick={()=>toggleVisibility(w)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #e5e7eb',background:'white',cursor:'pointer',fontSize:14}}>{w.isVisible?'👁️':'🚫'}</button>
                <button onClick={()=>handleDelete(w.id,w.memberName)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:14}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
