import * as XLSX from 'xlsx';
import { getRedis, KEYS } from './redis';
import { Member, ActivityLog, PrizeCategory, Winner, Feedback, CountryConfig, getTier } from '@/types';

async function fetchAll<T>(idKey: string, itemKey: (id: string) => string): Promise<T[]> {
  const r = getRedis();
  const ids = await r.smembers(idKey);
  if (!ids?.length) return [];
  const pipe = r.pipeline();
  ids.forEach(id => pipe.get(itemKey(id)));
  const results = await pipe.exec();
  return (results as (T | null)[]).filter(Boolean) as T[];
}

function computeStats(members: Member[], activities: ActivityLog[]) {
  const byMember = new Map<string, ActivityLog[]>();
  for (const a of activities) {
    if (!byMember.has(a.memberId)) byMember.set(a.memberId, []);
    byMember.get(a.memberId)!.push(a);
  }
  return members
    .filter(m => !m.isShadowUser && !(m.isInvited && !m.inviteAccepted))
    .map(m => {
      const acts = byMember.get(m.id) || [];
      let totalPoints = 0, runSessions = 0, lunchActivities = 0, raceSignups = 0, racesCompleted = 0;
      const dates = new Set<string>();
      for (const a of acts) {
        totalPoints += a.points; dates.add(a.date);
        if (a.category === 'run_session') runSessions++;
        if (a.category === 'lunch_time_activity') lunchActivities++;
        if (a.category === 'race_signup') raceSignups++;
        if (a.category === 'race_complete') racesCompleted++;
      }
      const sorted = [...dates].sort().reverse();
      return { MemberID: m.id, Name: m.name, Email: m.email, Country: m.country, IsActive: m.isActive, TotalPoints: totalPoints, Tier: getTier(totalPoints), RunSessions: runSessions, LunchActivities: lunchActivities, RaceSignups: raceSignups, RacesCompleted: racesCompleted, ActiveDays: dates.size, LastActive: sorted[0] || '' };
    })
    .sort((a, b) => b.TotalPoints - a.TotalPoints);
}

export async function generateExportBuffer(): Promise<Buffer> {
  const r = getRedis();

  const [members, activities, prizes, winners, feedback, countries, settings, emailIndex] = await Promise.all([
    fetchAll<Member>(KEYS.members, KEYS.member),
    fetchAll<ActivityLog>(KEYS.activities, KEYS.activity),
    fetchAll<PrizeCategory>(KEYS.prizes, KEYS.prize),
    fetchAll<Winner>(KEYS.winners, KEYS.winner),
    fetchAll<Feedback>(KEYS.feedback, KEYS.feedbackItem),
    fetchAll<CountryConfig>(KEYS.countries, KEYS.country),
    r.get<Record<string, unknown>>(KEYS.settings),
    r.hgetall(KEYS.emailIndex),
  ]);

  const wb = XLSX.utils.book_new();

  // ── Members ──────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    members.map(m => ({
      ID: m.id, Name: m.name, Email: m.email, Country: m.country,
      IsActive: m.isActive, JoinedAt: m.joinedAt, AvatarInitials: m.avatarInitials,
      PasswordHash: m.passwordHash || '',
      SelfRegistered: m.selfRegistered ?? false, IsAdminMember: m.isAdminMember ?? false,
      IsShadowUser: m.isShadowUser ?? false, IsInvited: m.isInvited ?? false,
      InviteAccepted: m.inviteAccepted ?? false,
      MarathonRegistered: m.marathonRegistered ?? false, MarathonDistance: m.marathonDistance || '',
    }))
  ), 'Members');

  // ── Activities ────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    activities.map(a => ({
      ID: a.id, MemberID: a.memberId, MemberName: a.memberName,
      ActivityType: a.activityType, Category: a.category, Date: a.date,
      Points: a.points, Notes: a.notes || '', Distance: a.distance ?? '',
      Duration: a.duration ?? '', Steps: a.steps ?? '', LoggedAt: a.loggedAt,
      IsTeamActivity: a.isTeamActivity ?? false, TeamActivityID: a.teamActivityId || '',
      TeamActivityOwner: a.teamActivityOwner ? JSON.stringify(a.teamActivityOwner) : '',
      TeamMembers: a.teamMembers?.length ? JSON.stringify(a.teamMembers) : '',
    }))
  ), 'Activities');

  // ── Computed Stats ────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    computeStats(members, activities)
  ), 'Stats');

  // ── Prizes ────────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    prizes.map(p => ({ ID: p.id, Name: p.name, Amount: p.amount, Description: p.description, Criteria: p.criteria, IsVisible: p.isVisible, CreatedAt: p.createdAt }))
  ), 'Prizes');

  // ── Winners ───────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    winners.map(w => ({ ID: w.id, PrizeCategoryID: w.prizeCategoryId, PrizeCategoryName: w.prizeCategoryName, MemberID: w.memberId, MemberName: w.memberName, Country: w.country, IsVisible: w.isVisible, AnnouncedAt: w.announcedAt }))
  ), 'Winners');

  // ── Feedback ──────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    feedback.map(f => ({ ID: f.id, MemberID: f.memberId, MemberName: f.memberName, Message: f.message, Category: f.category, Status: f.status, AdminComment: f.adminComment || '', SubmittedAt: f.submittedAt, UpdatedAt: f.updatedAt || '' }))
  ), 'Feedback');

  // ── Countries ─────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    countries.map(c => ({ Name: c.name, Flag: c.flag, IsActive: c.isActive }))
  ), 'Countries');

  // ── Settings ──────────────────────────────────────────────────────────────
  const s = settings;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    s ? Object.entries(s).map(([Key, Value]) => ({ Key, Value: typeof Value === 'object' ? JSON.stringify(Value) : String(Value) })) : [{ Key: '(none)', Value: '' }]
  ), 'Settings');

  // ── Email Index ───────────────────────────────────────────────────────────
  const idx = (emailIndex ?? {}) as Record<string, string>;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    Object.entries(idx).map(([Email, MemberID]) => ({ Email, MemberID }))
  ), 'EmailIndex');

  // ── Restore Guide ─────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['PaceTracker — Full Data Export'],
    [''],
    ['Generated', new Date().toISOString()],
    ['Members', members.length],
    ['Activities', activities.length],
    ['Prizes', prizes.length],
    ['Winners', winners.length],
    ['Feedback items', feedback.length],
    ['Countries', countries.length],
    [''],
    ['HOW TO RESTORE INTO A NEW UPSTASH DB'],
    [''],
    ['Step 1', 'Create a new Upstash Redis database and update UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in your Vercel env vars'],
    ['Step 2', 'Write a restore script that reads each sheet and runs the corresponding Redis commands:'],
    ['  Members', '→ SET pt:member:{ID} <full row as JSON>  +  SADD pt:members {ID}'],
    ['  Activities', '→ SET pt:activity:{ID} <full row as JSON>  +  SADD pt:activities {ID}  +  SADD pt:mact:{MemberID} {ID}  +  SADD pt:daily:{Date} {ID}'],
    ['  Activities (team)', '→ If IsTeamActivity=true: also SADD pt:gact:{TeamActivityID} {ID}'],
    ['  Prizes', '→ SET pt:prize:{ID} <row as JSON>  +  SADD pt:prizes {ID}'],
    ['  Winners', '→ SET pt:winner:{ID} <row as JSON>  +  SADD pt:winners {ID}'],
    ['  Feedback', '→ SET pt:fb:{ID} <row as JSON>  +  SADD pt:feedback {ID}  +  SADD pt:mfb:{MemberID} {ID}'],
    ['  Countries', '→ SET pt:country:{name.toLowerCase().replace(/ /g,"_")} <row as JSON>  +  SADD pt:countries {slug}'],
    ['  Settings', '→ SET pt:settings <rebuild JSON from Key/Value pairs>'],
    ['  EmailIndex', '→ HSET pt:email:index {Email} {MemberID}  (for each row)'],
    [''],
    ['Step 3', 'Redeploy your app — it will connect to the new DB automatically'],
    ['Step 4', 'Verify data by visiting /admin-move2026/dashboard'],
    [''],
    ['NOTE', 'PasswordHash values in the Members sheet are bcrypt hashes — safe to store and restore as-is'],
    ['NOTE', 'TeamMembers and TeamActivityOwner columns are JSON strings — parse before storing'],
  ]), 'Restore Guide');

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
