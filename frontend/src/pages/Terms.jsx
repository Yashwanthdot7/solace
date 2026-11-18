import { Link } from "react-router-dom";

const H = ({ children }) => <h2 className="font-display text-3xl mt-10 mb-3">{children}</h2>;

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 leading-relaxed text-[#D8D8D8]">
        <Link to="/" className="label-mono text-[#C8F04B]">← Solace</Link>
        <h1 className="font-display text-6xl mt-6 text-white">TERMS OF USE</h1>
        <p className="text-sm text-[#888] mt-2">Draft for review. Last updated 18 November 2026.</p>

        <H>Not medical care</H>
        <p>
          Solace and Mitra offer companionship and community, not medical, psychological or emergency care.
          Mitra is an AI and can be wrong. In an emergency call 112. For mental-health support call Tele-MANAS on 14416.
        </p>

        <H>Your account</H>
        <p>
          Use your real email, keep your password private, and tell us if you think someone else is using your account.
          You must be 18 or older to use Solace.
        </p>

        <H>Being kind</H>
        <p>
          Don't post anything hateful, harassing, sexual, or that shares someone else's private information. Don't
          pretend to be someone else. We may hide posts or close accounts that break these rules. Use the Report button
          if you see something wrong.
        </p>

        <H>Guardians</H>
        <p>
          Only invite people you trust. As a guardian, use what you see only to support the person who invited you.
        </p>

        <H>Changes and contact</H>
        <p>
          We may update these terms and will tell you in the app if we do. Questions: hello@solace.in. See also
          our <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
