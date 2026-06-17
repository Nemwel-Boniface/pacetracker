'use client';
import { useEffect, useState } from 'react';
import { Member, CountryConfig, getCountryFlag } from '@/types';
import { getStickerByName, STICKER_LABELS } from '@/lib/stickers';

const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const };
const btn = (bg: string) => ({ padding:'10px 20px', borderRadius:10, background:bg, color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer' });

interface NewInviteData { member: Member; tempPassword: string; }

function WelcomeMessage({ member, tempPassword, onDismiss }: { member: Member; tempPassword: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const platformUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pacetracker.app';
  const message = `Hello ${member.name},

You've been invited to PaceTracker – Eden Care's #Move2026 fitness challenge! 🏃‍♂️

Sign in at: ${platformUrl}/authenticate
Email: ${member.email}
Temporary password: ${tempPassword}

When you first log in, you'll be asked to create your own password.

Once you're in, feel free to play around with the 🦏 chatbot — it can answer questions and even log activities for you!

Let's move together! 💪`;

  function copyMsg() { navigator.clipboard.writeText(message).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }
  function copyPwd() { navigator.clipboard.writeText(tempPassword).then(() => { setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 2000); }); }

  return (
    <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:16,padding:20,marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:20}}>✅</span>
          <span style={{fontWeight:700,color:'#166534',fontSize:14}}>{member.name} invited!</span>
        </div>
        <button onClick={onDismiss} style={{background:'transparent',border:'none',cursor:'pointer',color:'#6b7280',fontSize:18,lineHeight:1}}>×</button>
      </div>

      <div style={{background:'white',border:'1px solid #bbf7d0',borderRadius:10,padding:12,marginBottom:12,fontSize:12,color:'#374151'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontWeight:600,color:'#166534',fontSize:11}}>TEMPORARY PASSWORD</span>
          <button onClick={copyPwd} style={{...btn(copiedPwd ? '#16a34a' : '#1a7a4a'),padding:'4px 10px',fontSize:11}}>{copiedPwd ? '✓ Copied' : '📋 Copy'}</button>
        </div>
        <code style={{fontFamily:'monospace',fontSize:15,fontWeight:700,color:'#1f2937',letterSpacing:'0.05em'}}>{tempPassword}</code>
        <p style={{color:'#9ca3af',fontSize:11,margin:'6px 0 0'}}>This password will not be shown again. Share it with {member.name} to complete their invite.</p>
      </div>

      <div style={{background:'white',border:'1px solid #bbf7d0',borderRadius:10,padding:12,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontWeight:600,color:'#166534',fontSize:11}}>WELCOME MESSAGE</span>
          <button onClick={copyMsg} style={{...btn(copied ? '#16a34a' : '#1a7a4a'),padding:'4px 10px',fontSize:11}}>{copied ? '✓ Copied!' : '📋 Copy message'}</button>
        </div>
        <pre style={{margin:0,fontSize:12,color:'#374151',whiteSpace:'pre-wrap',fontFamily:'inherit',lineHeight:1.5}}>{message}</pre>
      </div>
    </div>
  );
}

export default function MembersPage() {
  type FilterType = 'all' | 'active' | 'inactive' | 'pending' | 'self_reg';

  const [members, setMembers] = useState<Member[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('active');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', country:'' });
  const [error, setError] = useState('');
  const [newInvite, setNewInvite] = useState<NewInviteData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/members').then(r=>r.json()),
      fetch('/api/countries').then(r=>r.json()),
    ]).then(([md, cd]) => {
      setMembers(md.members || []);
      const active = (cd.countries || []).filter((c: CountryConfig) => c.isActive);
      setCountries(active);
      if (active.length > 0) setForm(f => ({ ...f, country: active[0].name }));
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data = await res.json();
      if (!res.ok) { setError(data.error||'Failed'); }
      else {
        setMembers(p=>[...p, data.member]);
        setNewInvite({ member: data.member, tempPassword: data.tempPassword });
        setForm(f=>({name:'',email:'',country:f.country}));
        setShowForm(false);
      }
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }
  async function handleToggle(id:string){ const res=await fetch('/api/members',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'toggle'})}); const d=await res.json(); if(res.ok)setMembers(p=>p.map(m=>m.id===id?d.member:m)); }
  async function handleDelete(id:string,name:string){ if(!confirm(`Remove ${name}?`))return; await fetch(`/api/members?id=${id}`,{method:'DELETE'}); setMembers(p=>p.filter(m=>m.id!==id)); }

  const counts = {
    all:      members.length,
    active:   members.filter(m => m.isActive).length,
    inactive: members.filter(m => !m.isActive).length,
    pending:  members.filter(m => m.isInvited && !m.inviteAccepted).length,
    self_reg: members.filter(m => !!m.selfRegistered && !m.isAdminMember).length,
  };

  const filtered = members
    .filter(m => {
      const q = search.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    })
    .filter(m => {
      switch (filter) {
        case 'active':   return m.isActive;
        case 'inactive': return !m.isActive;
        case 'pending':  return m.isInvited && !m.inviteAccepted;
        case 'self_reg': return !!m.selfRegistered && !m.isAdminMember;
        default:         return true;
      }
    });

  return (
    <div style={{padding:24,maxWidth:800,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Members</h1>
          <p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>
            {filtered.length !== members.length ? `${filtered.length} of ${members.length}` : members.length} registered participants
          </p>
        </div>
        <button onClick={()=>{setShowForm(!showForm);setError('');}} style={btn('#1a7a4a')}>+ Invite Member</button>
      </div>

      {/* Filter chips */}
      {!loading && (
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          {([
            { key: 'active',   label: 'Active',          bg: '#f0fdf4', activeBg: '#1a7a4a', color: '#166534',  activeColor: 'white', border: '#86efac' },
            { key: 'all',      label: 'All',             bg: '#f9fafb', activeBg: '#1f2937', color: '#374151',  activeColor: 'white', border: '#e5e7eb' },
            { key: 'inactive', label: 'Inactive',        bg: '#f9fafb', activeBg: '#6b7280', color: '#6b7280',  activeColor: 'white', border: '#e5e7eb' },
            { key: 'pending',  label: 'Invite Pending',  bg: '#fffbeb', activeBg: '#d97706', color: '#92400e',  activeColor: 'white', border: '#fde68a' },
            { key: 'self_reg', label: 'Self-Registered', bg: '#eff6ff', activeBg: '#1d4ed8', color: '#1d4ed8',  activeColor: 'white', border: '#bfdbfe' },
          ] as const).map(chip => {
            const active = filter === chip.key;
            const count = counts[chip.key];
            if (count === 0 && chip.key !== 'active' && chip.key !== 'all') return null;
            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'transparent' : chip.border}`,
                  background: active ? chip.activeBg : chip.bg,
                  color: active ? chip.activeColor : chip.color,
                  transition: 'all 0.15s',
                }}
              >
                {chip.label} <span style={{opacity: 0.75}}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {newInvite && (
        <WelcomeMessage
          member={newInvite.member}
          tempPassword={newInvite.tempPassword}
          onDismiss={() => setNewInvite(null)}
        />
      )}

      {showForm && (
        <div style={{background:'white',borderRadius:16,padding:24,border:'1px solid #f3f4f6',marginBottom:20}}>
          <h2 style={{fontWeight:700,marginBottom:4,fontSize:15}}>Invite a Participant</h2>
          <p style={{color:'#6b7280',fontSize:12,marginBottom:16,margin:'0 0 16px'}}>A temporary password will be generated. Share it with the member so they can sign in and set their own password.</p>
          <form onSubmit={handleCreate}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:12}}>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Full Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Jane Wanjiku" required style={inp}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Email *</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="jane@edencaremedical.com" required style={inp}/></div>
              <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Country</label>
                <select value={form.country} onChange={e=>setForm({...form,country:e.target.value})} style={inp}>
                  {countries.map(c=><option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12}}>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button type="submit" disabled={saving} style={btn('#1a7a4a')}>{saving?'Sending invite...':'Send Invite'}</button>
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
      : filtered.length===0 ? <div style={{textAlign:'center',padding:'4rem',background:'white',borderRadius:16,border:'1px solid #f3f4f6'}}><div style={{fontSize:48,marginBottom:12}}>👥</div><h3 style={{fontWeight:700,color:'#374151',marginBottom:4}}>{search?'No members found':'No members in this filter'}</h3><p style={{color:'#9ca3af',fontSize:13}}>{search?'Try a different search':'Try switching to a different filter above'}</p></div>
      : (<div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(m=>{
          const isInvitePending = m.isInvited && !m.inviteAccepted;
          const isInviteAccepted = m.isInvited && m.inviteAccepted;
          return (
            <div key={m.id} style={{borderRadius:16,overflow:'hidden',border: m.isAdminMember ? '1px solid #86efac' : m.isShadowUser ? '1.5px dashed #c4b5fd' : isInvitePending ? '1px solid #fde68a' : '1px solid #f3f4f6',opacity:m.isActive?1:0.6}}>
              <div style={{background: m.isAdminMember ? '#f0fdf4' : m.isShadowUser ? '#faf5ff' : isInvitePending ? '#ffffbf' : 'white',padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                {m.isAdminMember
                  ? <div title="Nemwel Boniface · Creator 🦏" style={{width:40,height:40,borderRadius:'50%',background:'#dcfce7',border:'2px solid #16a34a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🦏</div>
                  : m.isShadowUser
                    ? <div style={{width:40,height:40,borderRadius:'50%',background:'#ede9fe',border:'2px solid #c4b5fd',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🔍</div>
                    : isInvitePending
                      ? <div title="Invite pending" style={{width:40,height:40,borderRadius:'50%',background:'#fef9c3',border:'2px solid #fde68a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>✉️</div>
                      : (() => { const s = getStickerByName(m.name); return <div title={`${m.name} · ${STICKER_LABELS[s] ?? s}`} style={{width:40,height:40,borderRadius:'50%',background:m.isActive?'#f3e8ff':'#f3f4f6',border:`2px solid ${m.isActive?'#e9d5ff':'#e5e7eb'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,opacity:m.isActive?1:0.5}}>{s}</div>; })()
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,color:'#1f2937'}}>{m.name}</span>
                    <span>{getCountryFlag(m.country, countries)}</span>
                    {m.isAdminMember && <span style={{fontSize:11,background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:999,fontWeight:700}}>🦏 Admin</span>}
                    {m.isShadowUser && <span style={{fontSize:11,background:'#ede9fe',color:'#7c3aed',padding:'2px 8px',borderRadius:999,fontWeight:700}}>🔍 Test Account</span>}
                    {m.selfRegistered && !m.isAdminMember && !m.isShadowUser && <span style={{fontSize:11,background:'#eff6ff',color:'#1d4ed8',padding:'2px 8px',borderRadius:999}}>Self-registered</span>}
                    {isInvitePending && <span style={{fontSize:11,background:'#fef9c3',color:'#92400e',padding:'2px 8px',borderRadius:999,fontWeight:600}}>✉️ Invite pending</span>}
                    {isInviteAccepted && <span style={{fontSize:11,background:'#f0fdf4',color:'#166534',padding:'2px 8px',borderRadius:999,fontWeight:600}}>✅ Invite accepted</span>}
                    {!m.isActive && <span style={{fontSize:11,background:'#f3f4f6',color:'#6b7280',padding:'2px 8px',borderRadius:999}}>Inactive</span>}
                  </div>
                  <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{m.email||'No email'} · Joined {new Date(m.joinedAt).toLocaleDateString()}</div>
                </div>
                {!m.isAdminMember && (
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    <button onClick={()=>handleToggle(m.id)} title={m.isActive?'Deactivate':'Activate'} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:20}}>{m.isActive?'🟢':'⚫'}</button>
                    {!m.isShadowUser && <button onClick={()=>handleDelete(m.id,m.name)} title="Remove" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18}}>🗑️</button>}
                  </div>
                )}
              </div>
              {m.isShadowUser && (
                <div style={{background:'#1e1b4b',padding:'10px 16px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#a5b4fc',fontWeight:600,flexShrink:0}}>Login credentials:</span>
                  <code style={{fontSize:12,color:'#c7d2fe',background:'rgba(255,255,255,0.08)',padding:'3px 8px',borderRadius:5}}>{m.email}</code>
                  <code style={{fontSize:12,color:'#c7d2fe',background:'rgba(255,255,255,0.08)',padding:'3px 8px',borderRadius:5}}>Move2026test!</code>
                  <span style={{fontSize:11,color:'#6366f1',marginLeft:'auto'}}>Hidden from leaderboard · not visible to other members</span>
                </div>
              )}
              {isInvitePending && (
                <div style={{background:'#78350f',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#fde68a',fontWeight:600}}>✉️ Awaiting invite acceptance</span>
                  <span style={{fontSize:11,color:'#fbbf24'}}>Hidden from leaderboard until they sign in and set a password</span>
                </div>
              )}
            </div>
          );
        })}
      </div>)}
    </div>
  );
}
