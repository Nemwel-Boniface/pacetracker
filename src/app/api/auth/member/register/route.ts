import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getMemberIdByEmail, setEmailIndex, saveMember, getActiveCountries, getMember, getAllMembers } from '@/lib/data';
import { createMemberToken, getMemberCookieOptions } from '@/lib/auth';
import { Member, ADMIN_CONTACT, maskEmail } from '@/types';

// Same person, however they typed it: case, accents, punctuation and word order are ignored.
function nameKey(name: string): string {
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
}
const isPendingInvite = (m: Member) => !!(m.isInvited && !m.inviteAccepted);
const contactLine = `If you're unsure, contact the admin ${ADMIN_CONTACT.name} at ${ADMIN_CONTACT.phone}.`;

// 409s carry a `code` so the sign-up form can explain what to do instead of creating a duplicate.
function invitedConflict(m: Member) {
  return NextResponse.json({
    code: 'invited', maskedEmail: maskEmail(m.email),
    error: `You've already been invited, so an account is waiting for you (${maskEmail(m.email)}). Sign in with that email and the temporary password you were given. ${contactLine}`,
  }, { status: 409 });
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, country, confirmDifferentPerson } = await req.json();
    if (!name?.trim() || !email?.trim() || !password || !country) return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const activeCountries = await getActiveCountries();
    if (!activeCountries.some(c => c.name === country)) return NextResponse.json({ error: 'Invalid country' }, { status: 400 });

    const existing = await getMemberIdByEmail(email.trim());
    if (existing) {
      const m = await getMember(existing);
      if (m && isPendingInvite(m)) return invitedConflict(m);
      return NextResponse.json({ code: 'email_taken', error: `An account with this email already exists. Sign in, or use Forgot password if you can't remember it. ${contactLine}` }, { status: 409 });
    }

    // Different email, same name: most often someone who was invited (or signed up before) under another address.
    const key = nameKey(name);
    const sameName = (await getAllMembers()).filter(m => !m.isShadowUser && nameKey(m.name) === key);
    const invited = sameName.find(isPendingInvite);
    if (invited) return invitedConflict(invited);
    if (sameName.length > 0 && !confirmDifferentPerson) {
      return NextResponse.json({
        code: 'possible_duplicate', maskedEmails: sameName.map(m => maskEmail(m.email)),
        error: `There's already an account for ${name.trim()} (${sameName.map(m => maskEmail(m.email)).join(', ')}). If it's yours, sign in instead. ${contactLine}`,
      }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const member: Member = {
      id, name: name.trim(), email: email.trim().toLowerCase(), country, isActive: true,
      joinedAt: new Date().toISOString(),
      avatarInitials: name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      passwordHash, selfRegistered: true,
    };
    await saveMember(member);
    await setEmailIndex(email.trim(), id);

    const token = await createMemberToken(id, email.trim().toLowerCase());
    const opts = getMemberCookieOptions();
    const res = NextResponse.json({ success: true, memberId: id }, { status: 201 });
    res.cookies.set({ name: opts.name, value: token, httpOnly: opts.httpOnly, secure: opts.secure, sameSite: opts.sameSite, maxAge: opts.maxAge, path: opts.path });
    return res;
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
