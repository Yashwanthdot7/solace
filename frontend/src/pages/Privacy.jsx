import { Link } from "react-router-dom";

const H = ({ children }) => <h2 className="font-display text-3xl mt-10 mb-3">{children}</h2>;

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 leading-relaxed text-[#D8D8D8]">
        <Link to="/" className="label-mono text-[#C8F04B]">← Solace</Link>
        <h1 className="font-display text-6xl mt-6 text-white">PRIVACY POLICY</h1>
        <p className="text-sm text-[#888] mt-2">Draft for review. Last updated 18 November 2026.</p>

        <p className="mt-6">
          This page explains, in plain language, what Solace stores about you, why, who can see it,
          and how to get a copy or delete it. If anything is unclear, write to us at hello@solace.in.
        </p>

        <H>Solace is not a medical service</H>
        <p>
          Mitra is an AI companion, not a doctor, therapist or counsellor. In an emergency in India call 112.
          For mental-health support call Tele-MANAS on 14416 (free, 24x7).
        </p>

        <H>What we store</H>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your account: name, email, role, locality, goals, and a scrambled (hashed) password.</li>
          <li>What you write: journal entries, community posts, and your messages to Mitra with Mitra's replies.</li>
          <li>Activity: joy challenges, events you RSVP to, games, hobbies and wellness sessions, and your points and score.</li>
          <li>Safety information: whether a message showed signs of crisis, so that Solace can respond with help.</li>
          <li>Guardian links you create, and when you agreed to this policy.</li>
        </ul>

        <H>Why we use it</H>
        <p>
          To run the app for you: show your journal and feed, calculate your wellbeing score, keep Mitra's
          conversation going, show helplines when you may need them, and share a summary with guardians
          you choose. We do not sell your data and we do not use it for advertising.
        </p>

        <H>Google Gemini (AI)</H>
        <p>
          Your messages to Mitra, with a few recent messages for context and your first name and role, are
          sent to Google's Gemini service to write Mitra's reply. If a message shows clear signs of crisis,
          it is <strong>not</strong> sent to Gemini; Solace replies with helplines instead. For guardian
          summaries we only send activity counts and a wellbeing band to Gemini, never names or anything you wrote.
          Google processes this data under its own terms.
        </p>

        <H>What guardians can see</H>
        <p>
          Nobody can see your wellbeing unless you invite them and they accept. A guardian sees a summary only:
          your wellbeing score and band, how active you have been, and a trend. If you turn it on, they also see
          mood labels. <strong>Guardians never see your journal, your conversations with Mitra, or the text of
          your posts.</strong> If you turn on crisis alerts, a guardian gets a short email saying you may need
          support, without anything you wrote. You can stop sharing at any time in Settings, and access ends at once.
        </p>

        <H>Community posts</H>
        <p>
          Posts in the community feed can be seen by other Solace members. Posts that suggest someone is in crisis
          are kept private, and posts reported by several members are hidden until reviewed.
        </p>

        <H>Your rights</H>
        <p>
          In Settings you can download all your data as a file, or permanently delete your account and everything
          linked to it. You can withdraw consent at any time by deleting your account. These rights follow India's
          Digital Personal Data Protection Act, 2023.
        </p>

        <H>Where data is kept and for how long</H>
        <p>
          Data is stored with our database provider (Supabase) and kept while your account exists. When you delete
          your account it is removed from the live database; backups are overwritten on their normal schedule.
        </p>

        <H>Contact</H>
        <p>Questions or complaints: hello@solace.in.</p>

        <p className="mt-10 text-sm text-[#888]">See also our <Link to="/terms" className="underline">terms of use</Link>.</p>
      </div>
    </div>
  );
}
