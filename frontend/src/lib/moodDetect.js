/**
 * moodDetect.js
 * Client-side mood detection for Mitra AI.
 * Uses priority-ordered regex patterns against user message text.
 * Returns one of: sad | anxious | angry | tired | happy | playful | neutral
 */

const MOOD_PATTERNS = [
  // Priority 1 — Sad / Lonely (most important to catch first)
  {
    mood: "sad",
    patterns: [
      /\b(lonely|alone|isolat|no one|nobody|miss|missing|cry|crying|tears|sob|depress|hopeless|worthless|empty|hollow|invisible|forgotten|unloved)\b/i,
      /\b(sad|sadness|heartbreak|heartbroken|grief|grieve|mourn|mourning|loss|lost)\b/i,
      /\b(feel(ing)?\s+(so\s+)?(bad|terrible|awful|horrible|low|down|low|dull|numb))\b/i,
      /\b(no\s+point|don.t\s+care|given\s+up|can.t\s+go\s+on|what.s\s+the\s+use)\b/i,
    ],
    voice: { rate: 0.84, pitch: 0.93 },
  },

  // Priority 2 — Anxious / Worried
  {
    mood: "anxious",
    patterns: [
      /\b(anxious|anxiety|worried|worry|nervous|panic|panicking|scared|fear|afraid|dread|dreading|overwhelm|overwhelmed)\b/i,
      /\b(can.t\s+(sleep|breathe|focus|think)|racing\s+thoughts|heart\s+pounding|shaking|trembling)\b/i,
      /\b(stress|stressed|stressful|pressure|burden|too\s+much)\b/i,
    ],
    voice: { rate: 0.90, pitch: 1.00 },
  },

  // Priority 3 — Angry / Frustrated
  {
    mood: "angry",
    patterns: [
      /\b(angry|anger|furious|rage|fuming|hate|hating|frustrat|frustration|annoyed|annoying|irritat|irritable|mad\b)\b/i,
      /\b(fed\s+up|sick\s+of|can.t\s+stand|drives?\s+me\s+(crazy|mad)|unfair|injustice)\b/i,
    ],
    voice: { rate: 0.92, pitch: 0.97 },
  },

  // Priority 4 — Tired / Exhausted
  {
    mood: "tired",
    patterns: [
      /\b(tired|exhausted|exhaustion|fatigue|fatigued|sleepy|drained|no\s+energy|worn\s+out|burnt?\s+out|burnout)\b/i,
      /\b(can.t\s+anymore|too\s+tired|so\s+tired|just\s+want\s+to\s+(sleep|rest|stop))\b/i,
    ],
    voice: { rate: 0.87, pitch: 0.91 },
  },

  // Priority 5 — Happy / Joyful
  {
    mood: "happy",
    patterns: [
      /\b(happy|happiness|joy|joyful|wonderful|amazing|fantastic|brilliant|love\s+it|so\s+good|feel\s+great)\b/i,
      /\b(grateful|thankful|blessed|content|peaceful|delighted|excited\s+about|looking\s+forward)\b/i,
    ],
    voice: { rate: 1.00, pitch: 1.10 },
  },

  // Priority 6 — Playful / Fun
  {
    mood: "playful",
    patterns: [
      /\b(haha|lol|lmao|funny|fun|joke|laugh|hilarious|cracking\s+up|😂|🤣|😆)\b/i,
      /\b(excited|cool|awesome|wow|yay|woo|let.s\s+go|can.t\s+wait|pumped)\b/i,
    ],
    voice: { rate: 1.06, pitch: 1.15 },
  },
];

/** Default voice params for neutral mood */
const NEUTRAL_VOICE = { rate: 0.96, pitch: 1.08 };

/**
 * Detect mood from a text message.
 * @param {string} text - User's message
 * @returns {{ mood: string, voice: { rate: number, pitch: number }, confidence: number }}
 */
export function detectMood(text) {
  if (!text || typeof text !== "string") {
    return { mood: "neutral", voice: NEUTRAL_VOICE, confidence: 0 };
  }

  const clean = text.toLowerCase().trim();

  for (const { mood, patterns, voice } of MOOD_PATTERNS) {
    const matchCount = patterns.filter((p) => p.test(clean)).length;
    if (matchCount > 0) {
      return {
        mood,
        voice,
        confidence: Math.min(1, matchCount / patterns.length + 0.3),
      };
    }
  }

  return { mood: "neutral", voice: NEUTRAL_VOICE, confidence: 0 };
}

/**
 * Map detected mood to Mitra UI mood id (for visual display).
 * detected_mood → UI mood button id
 */
export const MOOD_TO_UI = {
  sad: "gentle",
  anxious: "warm",
  angry: "warm",
  tired: "gentle",
  happy: "hype",
  playful: "playful",
  neutral: "playful",
};

/**
 * Human-readable mood label for the UI badge.
 */
export const MOOD_LABELS = {
  sad:     { label: "Sad",     emoji: "🌧",  color: "#B8A8E8" },
  anxious: { label: "Anxious", emoji: "💭",  color: "#F2A68A" },
  angry:   { label: "Tense",   emoji: "🔥",  color: "#E8854A" },
  tired:   { label: "Tired",   emoji: "🌙",  color: "#8BBF7A" },
  happy:   { label: "Happy",   emoji: "✨",  color: "#C8F04B" },
  playful: { label: "Playful", emoji: "⚡",  color: "#C8F04B" },
  neutral: { label: "Neutral", emoji: "🫧",  color: "#A0A0A0" },
};
