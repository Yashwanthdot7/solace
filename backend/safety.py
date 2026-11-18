"""Crisis detection for Solace.

`detect_crisis(text)` looks for words and phrases that suggest someone may be
thinking about suicide or self-harm, and returns one of:

    "crisis"   clear signs of suicidal thoughts or self-harm
    "concern"  softer signs of hopelessness or feeling like a burden
    "none"     nothing found

It is deliberately simple (a phrase list, no AI) so that it is fast, works when
Gemini is down, and its behaviour is easy to read and test. It is tuned to
over-trigger rather than miss: showing a helpline card to someone who did not
need it is far less harmful than missing someone who did.

Phrases cover English, Hindi / Hinglish and Kannada (both scripts and common
romanised spellings). The non-English lists should be reviewed by native
speakers before launch. Add new phrases to the lists below and add a matching
example to backend/tests/test_safety.py.
"""
import re
import unicodedata
from typing import List, Literal

RiskLevel = Literal["none", "concern", "crisis"]

# ── Helplines (India). Keep in sync with frontend/src/constants/helplines.js ──
# Re-verify these numbers before launch and periodically afterwards.
HELPLINES = [
    {
        "name": "Tele-MANAS",
        "number": "14416",
        "alt_number": "1-800-891-4416",
        "description": "Free, 24x7 mental-health support from the Government of India, in many Indian languages.",
    },
    {
        "name": "Emergency",
        "number": "112",
        "alt_number": None,
        "description": "Police, ambulance and fire if you or someone else is in immediate danger.",
    },
]

# ── Phrase lists ───────────────────────────────────────────────────────────
# Write phrases in lower case, without apostrophes ("dont", not "don't").
# Latin-script phrases must match whole words. A trailing "*" means the last
# word may continue (e.g. "suicid*" matches "suicide" and "suicidal").

CRISIS_PHRASES: List[str] = [
    # English
    "kill myself", "killing myself", "end my life", "ending my life",
    "end it all", "ending it all", "take my own life", "take my life",
    "suicid*", "want to die", "wanna die", "want to be dead", "wish i was dead",
    "wish i were dead", "better off dead", "ready to die", "no reason to live",
    "nothing to live for", "dont want to live", "do not want to live",
    "dont want to be alive", "do not want to be alive", "tired of living",
    "dont want to wake up", "do not want to wake up", "hurt myself",
    "hurting myself", "harm myself", "harming myself", "self harm", "selfharm",
    "cut myself", "cutting myself", "take an overdose", "took an overdose",
    "overdose on pills", "overdose of pills", "overdose on sleeping pills", "hang myself", "hanging myself",
    "jump off a bridge", "jump off the bridge", "jump off a building",
    "jump off the building", "jump off the roof", "jump off the terrace",
    "jump in front of a train", "jump in front of a bus", "end myself", "unalive",
    # Hindi / Hinglish (romanised)
    "marna chahta", "marna chahti", "mar jana chahta", "mar jana chahti",
    "mar jaana chahta", "mar jaana chahti", "marna hai", "mar jaunga",
    "mar jaungi", "jeena nahi chahta", "jeena nahi chahti", "jina nahi chahta",
    "jina nahi chahti", "jeene ka mann nahi", "jeene ka man nahi", "khudkushi",
    "khud kushi", "aatmahatya", "atmahatya", "apni jaan de", "jaan dena chahta",
    "jaan dena chahti", "zindagi khatam karna", "khud ko khatam",
    # Hindi (Devanagari)
    "आत्महत्या", "खुदकुशी", "ख़ुदकुशी", "मरना चाहता", "मरना चाहती", "मर जाना चाहता",
    "मर जाना चाहती", "जीना नहीं चाहता", "जीना नहीं चाहती", "अपनी जान दे",
    "ज़िंदगी खत्म", "जिंदगी खत्म",
    # Kannada (script and romanised)
    "ಆತ್ಮಹತ್ಯೆ", "ಸಾಯಬೇಕು", "ಸಾಯಲು ಬಯಸುತ್ತೇನೆ", "ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ",
    "athmahathye", "aatmahatye", "saayabeku", "sayabeku", "saybeku",
    "badukalu ishta illa", "badukoke ishta illa",
]

CONCERN_PHRASES: List[str] = [
    # English
    "hopeless", "no hope", "worthless", "cant go on", "cannot go on",
    "cant take it anymore", "cannot take it anymore", "cant do this anymore",
    "better off without me", "be better off without me", "im a burden",
    "i am a burden", "burden to everyone", "burden on everyone",
    "no one would miss me", "nobody would miss me", "no one cares about me",
    "nobody cares about me", "give up on life", "giving up on life",
    "whats the point of living", "what is the point of living", "life is pointless",
    "no point in living", "disappear forever", "want to disappear",
    # Hindi / Hinglish
    "koi umeed nahi", "koi ummeed nahi", "zindagi se thak", "jindagi se thak",
    "kisi ko farak nahi", "kisi ko fark nahi",
    "कोई उम्मीद नहीं", "ज़िंदगी से थक", "जिंदगी से थक",
    # Kannada
    "ಯಾವುದೇ ಭರವಸೆ ಇಲ್ಲ", "ಸಾಕಾಗಿದೆ ಜೀವನ", "jeevana saakagide",
]

# Letters used inside words, including Devanagari and Kannada vowel signs.
_WORD_CHARS = r"0-9A-Za-z_À-ɏऀ-ॿಀ-೿"


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFC", text or "").lower()
    text = re.sub(r"['’‘`]", "", text)                    # don't -> dont
    text = re.sub(rf"[^{_WORD_CHARS}\s]", " ", text)      # punctuation -> space
    text = text.replace("-", " ")
    return re.sub(r"\s+", " ", text).strip()


def _compile(phrase: str) -> "re.Pattern[str]":
    open_end = phrase.endswith("*")
    phrase = _normalise(phrase.rstrip("*"))
    body = r"\s+".join(re.escape(w) for w in phrase.split(" "))
    latin = bool(re.match(r"[0-9a-z]", phrase))
    start = rf"(?<![{_WORD_CHARS}])"
    # Latin phrases must end on a word boundary; Indic phrases may take
    # inflection suffixes (e.g. चाहता हूँ), so they only need a start boundary.
    end = "" if (open_end or not latin) else rf"(?![{_WORD_CHARS}])"
    return re.compile(start + body + end)


_CRISIS = [_compile(p) for p in CRISIS_PHRASES]
_CONCERN = [_compile(p) for p in CONCERN_PHRASES]


def detect_crisis(text: str) -> RiskLevel:
    """Return "crisis", "concern" or "none" for a piece of user text."""
    norm = _normalise(text)
    if not norm:
        return "none"
    if any(p.search(norm) for p in _CRISIS):
        return "crisis"
    if any(p.search(norm) for p in _CONCERN):
        return "concern"
    return "none"


def helpline_line() -> str:
    """One short sentence with the helplines, for adding to a reply."""
    return (
        "If things ever feel too heavy, you can call Tele-MANAS on 14416 (free, any time), "
        "or 112 in an emergency."
    )


CRISIS_REPLY = (
    "I'm really glad you told me. It sounds like you are carrying something very heavy "
    "right now, and you don't have to carry it alone. Please talk to someone who can help "
    "right now: call Tele-MANAS on 14416 (free, 24x7, in many Indian languages), or call 112 "
    "if you are in immediate danger. If you can, let someone you trust know how you are "
    "feeling, or ask them to sit with you. I'm an AI companion, not a counsellor, but I'm "
    "still here with you."
)

# Added to every Mitra persona so Gemini follows the same rules.
SAFETY_RULES = (
    " Safety rules you must always follow: You are an AI companion, not a doctor, "
    "therapist or counsellor, and you never claim to be one. Never give information about "
    "methods or means of self-harm or suicide. Never diagnose or give medical advice. If the "
    "user talks about wanting to die, hurting themselves or someone else, respond with care, "
    "take it seriously, and encourage them to call Tele-MANAS on 14416 or emergency 112 and "
    "to reach out to someone they trust. For serious or ongoing distress, gently encourage "
    "professional help."
)

CONCERN_PERSONA = (
    "You are Mitra, a calm and caring AI companion from Bengaluru, India. The user may be "
    "feeling hopeless or like a burden. Do not joke, do not be upbeat, and do not rush to fix "
    "things. Gently acknowledge what they shared, tell them their feelings matter, and ask "
    "one soft check-in question about how they are doing right now and whether someone is "
    "with them. Speak in warm, simple Indian English. Reply in under 70 words."
)

# Gemini's own content filters, sent with every request.
GEMINI_SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_LOW_AND_ABOVE"},
]
