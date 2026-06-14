'use client';
import { useEffect, useState } from 'react';
import { MemberStats, CountryConfig, TIER_CONFIG, PointTier, getCountryFlag } from '@/types';
import { getSticker, getStickerTier, STICKER_BG, STICKER_LABELS } from '@/lib/stickers';

interface StreakDay { date: string; hasActivity: boolean; isToday: boolean; }
interface Milestone { days: number; label: string; emoji: string; achieved: boolean; }
interface MyStreak {
  currentStreak: number; longestStreak: number; isActiveToday: boolean;
  totalActiveDays: number; recentDays: StreakDay[]; milestones: Milestone[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStreak, setMyStreak] = useState<MyStreak | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/leaderboard').then(r=>r.json()),
      fetch('/api/countries').then(r=>r.json()),
      fetch('/api/admin/my-streak').then(r=>r.json()),
    ]).then(([ld, cd, sd]) => {
      setStats(ld.stats || []);
      setCountries(cd.countries || []);
      if (!sd.error) setMyStreak(sd);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const active = stats.filter(s=>s.isActive);
  const total = { pts: active.reduce((s,m)=>s+m.totalPoints,0), days: active.reduce((s,m)=>s+m.activeDays,0), races: active.filter(m=>m.raceSignups>0).length };
  const tiers = Object.keys(TIER_CONFIG).reduce((a,k)=>({...a,[k]:active.filter(m=>m.tier===k).length}),{} as Record<string,number>);
  const activeCountries = [...new Set(active.map(m=>m.country))].sort();

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',minHeight:300}}><div style={{width:32,height:32,border:'4px solid #1a7a4a',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  return (
    <div style={{padding:24,maxWidth:900,margin:'0 auto'}}>
      <div style={{marginBottom:24}}><h1 style={{fontSize:26,fontWeight:900,color:'#1f2937',margin:0}}>Dashboard</h1><p style={{color:'#6b7280',fontSize:13,margin:'4px 0 0'}}>#Move2026 challenge overview</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14,marginBottom:28}}>
        {[['Active Members',active.length,'👥','#1a7a4a'],['Total Points',total.pts,'⚡','#f26522'],['Active Days',total.days,'📅','#7c3aed'],['Race Sign-Ups',total.races,'🏅','#d97706']].map(([l,v,i,c])=>(
          <div key={l as string} style={{background:'white',borderRadius:16,padding:18,border:'1px solid #f3f4f6'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:12,color:'#6b7280'}}>{l}</span>
              <span style={{fontSize:22}}>{i}</span>
            </div>
            <div style={{fontSize:36,fontWeight:900,color:'#1f2937'}}>{v}</div>
          </div>
        ))}
      </div>
      {myStreak && (
        <div style={{background:'white',borderRadius:16,padding:20,border:'1px solid #f3f4f6',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <h2 style={{fontWeight:700,color:'#374151',fontSize:15,margin:0}}>🔥 My Streak</h2>
            <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600,background:myStreak.isActiveToday?'#dcfce7':'#fef9c3',color:myStreak.isActiveToday?'#16a34a':'#92400e'}}>
              {myStreak.isActiveToday ? '✅ Logged today' : '⚠️ Not logged today'}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[['🔥','Current Streak',`${myStreak.currentStreak}d`],['🏆','Longest Streak',`${myStreak.longestStreak}d`],['📅','Total Active Days',`${myStreak.totalActiveDays}d`]].map(([e,l,v])=>(
              <div key={l} style={{background:'#f9fafb',borderRadius:10,padding:'12px 8px',textAlign:'center'}}>
                <div style={{fontSize:20,marginBottom:4}}>{e}</div>
                <div style={{fontSize:20,fontWeight:900,color:'#1f2937'}}>{v}</div>
                <div style={{fontSize:10,color:'#9ca3af',marginTop:2,lineHeight:1.3}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Last 30 Days</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(15,1fr)',gap:3}}>
              {myStreak.recentDays.map(day=>(
                <div key={day.date} title={day.date} style={{aspectRatio:'1',borderRadius:4,background:day.hasActivity?'#16a34a':'#f3f4f6',border:day.isToday?'2px solid #f26522':'2px solid transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:day.hasActivity?'white':'transparent'}}>✓</div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {myStreak.milestones.map(m=>(
              <div key={m.days} title={`${m.label} — ${m.days}-day streak`} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,background:m.achieved?'#f0fdf4':'#f9fafb',border:`1px solid ${m.achieved?'#bbf7d0':'#f3f4f6'}`,opacity:m.achieved?1:0.45,fontSize:11,fontWeight:600,color:m.achieved?'#166534':'#9ca3af'}}>
                <span style={{filter:m.achieved?'none':'grayscale(1)'}}>{m.emoji}</span> {m.label}
              </div>
            ))}
          </div>
          {(() => { const next = myStreak.milestones.find(m=>!m.achieved); return next ? (
            <div style={{marginTop:12,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#92400e'}}>
              🎯 <strong>{next.days - myStreak.currentStreak} more day{next.days - myStreak.currentStreak !== 1 ? 's' : ''}</strong> to unlock <strong>{next.label}</strong> {next.emoji}
            </div>
          ) : null; })()}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16,marginBottom:20}}>
        <div style={{background:'white',borderRadius:16,padding:20,border:'1px solid #f3f4f6'}}>
          <h2 style={{fontWeight:700,color:'#374151',marginBottom:16,fontSize:15}}>📈 Progress Tiers</h2>
          {active.length === 0 ? <p style={{color:'#9ca3af',fontSize:13,textAlign:'center',padding:'20px 0'}}>No active members yet</p> :
            (Object.entries(TIER_CONFIG) as [PointTier, typeof TIER_CONFIG[PointTier]][]).reverse().map(([key,cfg])=>{
              const cnt = tiers[key]||0; const pct = active.length > 0 ? (cnt/active.length)*100 : 0;
              return (<div key={key} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}><span style={{fontWeight:600}}>{cfg.emoji} {cfg.label}</span><span style={{color:'#6b7280'}}>{cnt}</span></div>
                <div style={{height:8,background:'#f3f4f6',borderRadius:999,overflow:'hidden'}}><div style={{height:8,borderRadius:999,background:cfg.color,width:`${pct}%`,transition:'width 0.5s'}} /></div>
              </div>);
            })
          }
        </div>
        <div style={{background:'white',borderRadius:16,padding:20,border:'1px solid #f3f4f6'}}>
          <h2 style={{fontWeight:700,color:'#374151',marginBottom:16,fontSize:15}}>🌍 By Country</h2>
          {active.length === 0 ? <p style={{color:'#9ca3af',fontSize:13,textAlign:'center',padding:'20px 0'}}>No active members yet</p> :
            activeCountries.map(c=>(
              <div key={c} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f9fafb',borderRadius:10,marginBottom:8}}>
                <span style={{fontSize:24}}>{getCountryFlag(c, countries)}</span>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{c}</div><div style={{fontSize:11,color:'#6b7280'}}>{active.filter(m=>m.country===c).reduce((s,m)=>s+m.totalPoints,0)} pts total</div></div>
                <div style={{fontWeight:900,fontSize:22,color:'#1f2937'}}>{active.filter(m=>m.country===c).length}</div>
              </div>
            ))
          }
        </div>
      </div>
      <div style={{background:'white',borderRadius:16,padding:20,border:'1px solid #f3f4f6'}}>
        <h2 style={{fontWeight:700,color:'#374151',marginBottom:16,fontSize:15}}>🏆 Top Performers</h2>
        {active.length === 0 ? (
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <div style={{fontSize:48,marginBottom:8}}>🏁</div>
            <p style={{color:'#9ca3af',fontSize:13}}>No members yet — add members to get started</p>
          </div>
        ) : active.slice(0,5).map((m,i)=>{ const rank=i+1; const sticker=getSticker(rank,active.length,m.memberId); const {bg,border}=STICKER_BG[getStickerTier(rank,active.length)]; return (
          <div key={m.memberId} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,marginBottom:4}}>
            <span style={{color:'#d1d5db',fontWeight:700,width:20,textAlign:'center',fontSize:13}}>{i===0?'👑':i+1}</span>
            <div title={`${m.memberName} · ${STICKER_LABELS[sticker]??sticker}`} style={{width:36,height:36,borderRadius:'50%',background:bg,border:`2px solid ${border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{sticker}</div>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:'#1f2937'}}>{m.memberName}</div><div style={{fontSize:11,color:'#9ca3af'}}>{getCountryFlag(m.country, countries)} {m.country}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontWeight:900,color:'#1a7a4a'}}>{m.totalPoints} pts</div><div style={{fontSize:11,color:'#9ca3af'}}>{m.activeDays} days</div></div>
          </div>
        ); })}
      </div>
    </div>
  );
}
