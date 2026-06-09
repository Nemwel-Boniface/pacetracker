'use client';
import { useEffect, useState } from 'react';
import { Member, COUNTRIES, Country } from '@/types';
import { getStickerByName, STICKER_LABELS } from '@/lib/stickers';
const FLAGS: Record<Country, string> = { Kenya: '🇰🇪', Rwanda: '🇷🇼', India: '🇮🇳', 'South Africa': '🇿🇦' };
const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
const btn = (bg: string) => ({ padding:'10px 20px', borderRadius:10, background:bg, color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer' });

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', country:'Kenya' as Country });
  const [error, setError] = useState('');
  useEffect(()=>{ fetch('/api/members').then(r=>r.json()).then(d=>setMembers(d.members||[])).catch(()=>setMembers([])).finally(()=>setLoading(false)); },[]);
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data = await res.json();
      if (!res.ok){setError(data.error||'Failed');}else{setMembers(p=>[...p,data.member]);setForm({name:'',email:'',country:'Kenya'});setShowForm(false);}
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }
  async function handleToggle(id:string){ const res=await fetch('/api/members',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'toggle'})}); const d=await res.json(); if(res.ok)setMembers(p=>p.map(m=>m.id===id?d.member:m)); }
  async function handleDelete(id:string,name:string){ if(!confirm(`Remove ${name}?`))return; await fetch(`/api/members?id=${id}`,{method:'DELETE'}); setMembers(p=>p.filter(m=>m.id!==id)); }
  const filtered = members.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.email.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{padding:24,maxWidth:800,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div><h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Members</h1><p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>{members.length} registered participants</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={btn('#1a7a4a')}>+ Add Member</button>
      </div>
      {showForm && (
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:20}}>
          <h2 style={{fontWeight:700,marginBottom:16,fontSize:15}}>New Participant</h2>
          <form onSubmit={handleCreate}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:12}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Full Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Jane Wanjiku" required style={inp}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="jane@edencaremedical.com" style={inp}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Country</label>
                <select value={form.country} onChange={e=>setForm({...form,country:e.target.value as Country})} style={inp}>{COUNTRIES.map(c=><option key={c} value={c}>{FLAGS[c]} {c}</option>)}</select>
              </div>
            </div>
            {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving} style={btn('#1a7a4a')}>{saving?'Adding...':'Add Participant'}</button>
              <button type="button" onClick={()=>{setShowForm(false);setError('');}} style={{...btn('#f3f4f6'),color:'#374151'}}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div style={{position:'relative',marginBottom:16}}>
        <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..." style={{...inp,paddingLeft:34}}/>
      </div>
      {loading ? <div style={{textAlign:'center',padding:'4rem 0'}}><div style={{width:32,height:32,border:'4px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
      : filtered.length===0 ? <div style={{textAlign:'center',padding:'4rem',background:'white',borderRadius:16,border:'1px solid #f3f4f6'}}><div style={{fontSize:48,marginBottom:12}}>👥</div><h3 style={{fontWeight:700,color:'#374151',marginBottom:4}}>{search?'No members found':'No members yet'}</h3><p style={{color:'#9ca3af',fontSize:13}}>{search?'Try a different search':'Click "Add Member" to register the first participant'}</p></div>
      : (<div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(m=>(
          <div key={m.id} style={{background:'white',borderRadius:16,padding:'14px 16px',border:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:14,opacity:m.isActive?1:0.6}}>
            {(() => { const s = getStickerByName(m.name); return <div title={`${m.name} · ${STICKER_LABELS[s] ?? s}`} style={{width:40,height:40,borderRadius:'50%',background:m.isActive?'#f3e8ff':'#f3f4f6',border:`2px solid ${m.isActive?'#e9d5ff':'#e5e7eb'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,opacity:m.isActive?1:0.5}}>{s}</div>; })()}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontWeight:700,color:'#1f2937'}}>{m.name}</span>
                <span>{FLAGS[m.country]}</span>
                {!m.isActive && <span style={{fontSize:11,background:'#f3f4f6',color:'#6b7280',padding:'2px 8px',borderRadius:999}}>Inactive</span>}
              </div>
              <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{m.email||'No email'} · Joined {new Date(m.joinedAt).toLocaleDateString()}</div>
            </div>
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button onClick={()=>handleToggle(m.id)} title={m.isActive?'Deactivate':'Activate'} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:20}}>{m.isActive?'🟢':'⚫'}</button>
              <button onClick={()=>handleDelete(m.id,m.name)} title="Remove" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>)}
    </div>
  );
}