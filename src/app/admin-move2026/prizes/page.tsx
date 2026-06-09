'use client';
import { useEffect, useState } from 'react';
import { PrizeCategory } from '@/types';
const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
export default function PrizesPage() {
  const [prizes, setPrizes] = useState<PrizeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', amount:'', description:'', criteria:'', isVisible:false });
  const [error, setError] = useState('');
  useEffect(()=>{ fetch('/api/prizes').then(r=>r.json()).then(d=>setPrizes(d.prizes||[])).catch(()=>setPrizes([])).finally(()=>setLoading(false)); },[]);
  async function handleCreate(e:React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res=await fetch('/api/prizes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,amount:Number(form.amount)||0})});
      const data=await res.json(); if(!res.ok){setError(data.error||'Failed');}else{setPrizes(p=>[data.prize,...p]);setForm({name:'',amount:'',description:'',criteria:'',isVisible:false});setShowForm(false);}
    } catch{setError('Connection error');}finally{setSaving(false);}
  }
  async function toggleVisibility(p:PrizeCategory){
    const res=await fetch('/api/prizes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,isVisible:!p.isVisible})});
    const data=await res.json(); if(res.ok)setPrizes(pp=>pp.map(x=>x.id===p.id?data.prize:x));
  }
  async function handleDelete(id:string,name:string){ if(!confirm(`Delete prize "${name}"?`))return; await fetch(`/api/prizes?id=${id}`,{method:'DELETE'}); setPrizes(p=>p.filter(x=>x.id!==id)); }
  return (
    <div style={{padding:24,maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div><h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Prizes</h1><p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>Configure challenge prize categories and control their public visibility</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>+ Add Prize</button>
      </div>
      <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:14,marginBottom:20,fontSize:13,color:'#92400e'}}>
        <strong>Visibility tip:</strong> Toggle prizes visible when ready to show them on the public leaderboard (e.g., 3 weeks before the challenge ends). Hidden prizes are only visible here.
      </div>
      {showForm && (
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:20}}>
          <h2 style={{fontWeight:700,marginBottom:16,fontSize:15}}>New Prize Category</h2>
          <form onSubmit={handleCreate}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Prize Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Consistency Champion" required style={inp}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Amount (USD)</label><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="100" style={inp}/></div>
            </div>
            <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Description</label><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Awarded to the most consistent participant" style={inp}/></div>
            <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Selection Criteria</label><input value={form.criteria} onChange={e=>setForm({...form,criteria:e.target.value})} placeholder="Highest number of activity days logged" style={inp}/></div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><input type="checkbox" id="vis" checked={form.isVisible} onChange={e=>setForm({...form,isVisible:e.target.checked})}/><label htmlFor="vis" style={{fontSize:13,color:'#374151'}}>Show on public leaderboard immediately</label></div>
            {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving} style={{padding:'10px 20px',borderRadius:10,background:'#1a7a4a',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',opacity:saving?0.6:1}}>{saving?'Saving...':'Create Prize'}</button>
              <button type="button" onClick={()=>{setShowForm(false);setError('');}} style={{padding:'10px 20px',borderRadius:10,background:'#f3f4f6',color:'#374151',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <div style={{textAlign:'center',padding:'3rem'}}><div style={{width:32,height:32,border:'4px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
      : prizes.length===0 ? <div style={{textAlign:'center',padding:'4rem',background:'white',borderRadius:16,border:'1px solid #f3f4f6'}}><div style={{fontSize:48,marginBottom:8}}>🎁</div><h3 style={{fontWeight:700,color:'#374151',marginBottom:4}}>No prizes set up yet</h3><p style={{color:'#9ca3af',fontSize:13}}>Add prize categories to motivate participants</p></div>
      : <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {prizes.map(p=>(
          <div key={p.id} style={{background:'white',borderRadius:16,padding:20,border:p.isVisible?'1px solid #bbf7d0':'1px solid #f3f4f6'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:4}}>
                  <span style={{fontWeight:700,color:'#1f2937'}}>{p.name}</span>
                  {p.amount>0 && <span style={{fontWeight:900,fontSize:13,padding:'2px 10px',borderRadius:999,background:'#fff7ed',color:'#f26522'}}>${p.amount}</span>}
                  <span style={{fontSize:11,padding:'2px 10px',borderRadius:999,fontWeight:600,background:p.isVisible?'#f0fdf4':'#f9fafb',color:p.isVisible?'#15803d':'#6b7280'}}>{p.isVisible?'👁️ Visible':'🔒 Hidden'}</span>
                </div>
                {p.description && <p style={{fontSize:13,color:'#6b7280',margin:'0 0 2px'}}>{p.description}</p>}
                {p.criteria && <p style={{fontSize:11,color:'#9ca3af',margin:0,fontStyle:'italic'}}>{p.criteria}</p>}
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>toggleVisibility(p)} title={p.isVisible?'Hide':'Show'} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #e5e7eb',background:'white',cursor:'pointer',fontSize:14}}>{p.isVisible?'👁️':'🚫'}</button>
                <button onClick={()=>handleDelete(p.id,p.name)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:14}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}