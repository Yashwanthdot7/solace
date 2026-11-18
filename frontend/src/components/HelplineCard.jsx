import { Phone, X } from "lucide-react";
import { HELPLINES } from "@/constants/helplines";

/** Calm, high-contrast card with tap-to-call helplines. */
export function HelplineCard({ title = "You don't have to face this alone", message, compact = false }) {
  return (
    <div
      role="region"
      aria-label="Helplines"
      data-testid="helpline-card"
      className="w-full bg-[#F5F1E8] text-[#141414] rounded-sm p-5 border-2 border-[#F5F1E8]"
    >
      <p className="font-sans text-lg font-semibold leading-snug">{title}</p>
      {message && <p className="mt-2 text-base leading-relaxed">{message}</p>}
      {!compact && (
        <p className="mt-2 text-base leading-relaxed">
          Talking to someone right now can help. These calls are free and confidential.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {HELPLINES.map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            data-testid={`helpline-call-${h.number}`}
            className="flex items-center gap-4 bg-[#141414] text-white rounded-sm px-4 py-3 hover:bg-black transition"
          >
            <Phone size={22} aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-lg font-semibold">
                Call {h.name} · {h.number}
              </span>
              <span className="block text-sm text-[#D0D0D0]">
                {h.description}
                {h.altNumber ? ` Also ${h.altNumber}.` : ""}
              </span>
            </span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm text-[#444]">
        Solace and Mitra are not an emergency or medical service.
      </p>
    </div>
  );
}

/** Full-screen overlay version of the card, used from any page. */
export function HelplineDialog({ open, onClose, title, message }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Need help now"
      data-testid="helpline-dialog"
      onClick={onClose}
    >
      <div className="w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          data-testid="helpline-close"
          className="absolute -top-3 -right-3 bg-white text-black rounded-full p-1.5 shadow"
        >
          <X size={18} />
        </button>
        <HelplineCard title={title} message={message} />
      </div>
    </div>
  );
}

export default HelplineCard;
