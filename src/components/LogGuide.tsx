import Image from 'next/image';
import Link from 'next/link';

// Step-by-step "how to log" walkthrough shown on the member How It Works page.
const card = { background: 'white', borderRadius: 16, padding: 24, border: '1px solid #f3f4f6', marginBottom: 16 };
const stepList = { margin: '0 0 14px', paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.7 };
const shot = { width: '100%', height: 'auto', borderRadius: 12, border: '1px solid #e5e7eb', display: 'block' };
const caption = { fontSize: 12, color: '#9ca3af', margin: '6px 0 14px' };

const TROUBLESHOOTING = [
  { see: 'No "Is this for a challenge?" question', why: "You haven't joined the challenge yet", fix: 'Join it from the Challenges tab or 🏁 Featured challenges in the chatbot, then reload' },
  { see: 'No question at all', why: 'The day you picked is outside the challenge dates', fix: 'Pick a day inside the challenge dates' },
  { see: "The challenge isn't in the list", why: "The activity type doesn't count for it", fix: 'Distance challenges take runs, walks and hikes, or cycling for ride challenges' },
  { see: '"Add a distance (km)" error', why: 'Distance is empty', fix: 'Enter the km you covered' },
  { see: "Logged it but the km didn't count", why: "It wasn't tagged when you logged it", fix: "A tag can't be added later, so tag each activity as you log it" },
];

export default function LogGuide() {
  return (
    <div id="log-guide">
      <div style={card}>
        <h3 style={{ fontWeight: 900, marginBottom: 6, fontSize: 16 }}>📝 How to log an activity</h3>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 14px' }}>You can log today, yesterday or 2 days ago, up to 2 activities a day.</p>
        <ol style={stepList}>
          <li>Open the <Link href="/member/log" style={{ color: '#1a7a4a', fontWeight: 700 }}>➕ Log Activity</Link> tab and pick the day.</li>
          <li>Choose your <strong>Activity Type</strong>.</li>
          <li>Optionally add distance, duration, steps, notes or teammates who were with you.</li>
          <li>Tap <strong>Log Activity</strong>. Your points show up straight away.</li>
        </ol>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>💡 Prefer chatting? Open the 🦏 chatbot and tap <strong>📝 Log an activity for me</strong>.</p>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight: 900, marginBottom: 6, fontSize: 16 }}>🎯 Optional: count it toward a challenge</h3>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 14px' }}>In a distance challenge like Project 50? An activity only counts if you tag it when you log it.</p>
        <ol style={stepList}>
          <li>Join the challenge first, from the <Link href="/member/challenges" style={{ color: '#1a7a4a', fontWeight: 700 }}>🏁 Challenges</Link> tab or the chatbot.</li>
          <li>Log a <strong>run, walk or hike</strong> (or a <strong>ride</strong> for cycling challenges) and enter the <strong>distance in km</strong>.</li>
          <li>Under <strong>🏁 Is this for a challenge?</strong> tap <strong>Yes, count it 🎯</strong>.</li>
          <li>Open <strong>Pick a challenge</strong>, tick yours, then tap <strong>Log Activity</strong>.</li>
        </ol>
        <Image src="/guide/log-form-pick.jpg" alt="Yes, count it selected with the challenge list open" width={900} height={206} style={shot} />
        <p style={caption}>Tap Yes, count it, then pick the challenge.</p>
        <Image src="/guide/log-form-tagged.jpg" alt="Log Activity form filled in: Run, 5.2 km, tagged to Project 50" width={900} height={799} style={shot} />
        <p style={caption}>Ready to log: a 5.2 km run counted toward Project 50. The question can take a second to appear.</p>

        <h4 style={{ fontWeight: 800, fontSize: 14, margin: '6px 0 8px' }}>Or let the chatbot do it</h4>
        <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px' }}>Tap <strong>📝 Log an activity for me</strong>. After you pick the day it asks <strong>Is this for a challenge?</strong>, then shows a preview before anything is saved.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <Image src="/guide/bot-challenge-step.jpg" alt="The chatbot asking Is this for a challenge?" width={480} height={755} style={shot} />
            <p style={caption}>Pick the challenge, or log it normally.</p>
          </div>
          <div>
            <Image src="/guide/bot-preview.jpg" alt="The chatbot preview showing the challenge before logging" width={480} height={755} style={shot} />
            <p style={caption}>Check the preview, then tap Yes, log it!</p>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight: 900, marginBottom: 12, fontSize: 16 }}>🤔 Why didn&apos;t my challenge show up?</h3>
        {TROUBLESHOOTING.map(t => (
          <div key={t.see} style={{ padding: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#9a3412' }}>{t.see}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.why}. <strong style={{ color: '#374151' }}>{t.fix}.</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
}
