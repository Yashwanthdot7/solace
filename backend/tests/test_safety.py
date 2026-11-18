"""Crisis detection must catch real risk and ignore everyday phrases."""
import pytest

from safety import detect_crisis

CRISIS = [
    "I want to kill myself",
    "i've been thinking about suicide",
    "I feel suicidal tonight",
    "I just want to end my life",
    "There's no reason to live anymore",
    "I don't want to live",
    "I dont want to wake up tomorrow",
    "Sometimes I cut myself",
    "I keep thinking about self-harm",
    "Everyone would be fine if I end it all",
    "I'm going to jump off the bridge",
    "I'm tired of living",
    "WANT TO DIE",
    "main marna chahta hoon",
    "ab jeena nahi chahti",
    "मैं मरना चाहता हूँ",
    "आत्महत्या के बारे में सोच रहा हूँ",
    "nanage saayabeku anisuttide",
    "ನನಗೆ ಸಾಯಬೇಕು ಅನಿಸುತ್ತಿದೆ",
]

CONCERN = [
    "I feel so hopeless",
    "I can't take it anymore",
    "Everyone would be better off without me",
    "I'm a burden to everyone",
    "Nobody would miss me",
    "What's the point of living like this",
    "koi umeed nahi bachi",
]

NONE = [
    "This traffic is killing me",
    "I killed it at my presentation today!",
    "I'm dying to try that new dosa place",
    "That movie was to die for",
    "My phone battery is dead",
    "Can you kill the lights?",
    "Drove 40 kms to see my grandson",
    "I had a lovely walk in Cubbon Park",
    "Feeling a bit tired today",
    "",
    "   ",
]


@pytest.mark.parametrize("text", CRISIS)
def test_crisis_messages(text):
    assert detect_crisis(text) == "crisis"


@pytest.mark.parametrize("text", CONCERN)
def test_concern_messages(text):
    assert detect_crisis(text) == "concern"


@pytest.mark.parametrize("text", NONE)
def test_everyday_messages_are_not_flagged(text):
    assert detect_crisis(text) == "none"


def test_none_input_is_safe():
    assert detect_crisis(None) == "none"
