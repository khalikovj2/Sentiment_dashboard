"""
app.py
------
Flask REST API for the Sentiment Analysis Dashboard.
Zero NLTK dependency — uses only built-in Python + vaderSentiment + sklearn.

Run:  python backend/app.py
"""

import re
import os
import string
import threading
import webbrowser
from collections import Counter

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import TfidfVectorizer

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

# ── Flask app ─────────────────────────────────────────────────────────────────
app      = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)
analyzer = SentimentIntensityAnalyzer()

# ── Stopwords (built-in — no NLTK needed) ─────────────────────────────────────
STOP_WORDS = {
    "i","me","my","myself","we","our","ours","ourselves","you","your","yours",
    "yourself","yourselves","he","him","his","himself","she","her","hers",
    "herself","it","its","itself","they","them","their","theirs","themselves",
    "what","which","who","whom","this","that","these","those","am","is","are",
    "was","were","be","been","being","have","has","had","having","do","does",
    "did","doing","a","an","the","and","but","if","or","because","as","until",
    "while","of","at","by","for","with","about","against","between","into",
    "through","during","before","after","above","below","to","from","up","down",
    "in","out","on","off","over","under","again","further","then","once","here",
    "there","when","where","why","how","all","both","each","few","more","most",
    "other","some","such","no","nor","not","only","own","same","so","than",
    "too","very","s","t","can","will","just","don","should","now","d","ll",
    "m","o","re","ve","y","ain","aren","couldn","didn","doesn","hadn","hasn",
    "haven","isn","ma","mightn","mustn","needn","shan","shouldn","wasn","weren",
    "won","wouldn","also","would","could","said","like","even","well","back",
    "still","way","get","go","one","two","new","first","last","long","great",
}

# ── Emotion lexicon ───────────────────────────────────────────────────────────
EMOTION_LEXICON = {
    "joy":      {"happy","joy","joyful","delight","wonderful","fantastic","amazing",
                 "love","great","excellent","pleasure","bliss","cheerful","elated",
                 "thrilled","excited","glad","positive","enjoy","enjoyed","enjoying"},
    "anger":    {"angry","furious","rage","hate","outraged","annoyed","frustrated",
                 "mad","hostile","bitter","infuriated","livid","resentful","irritated",
                 "disgusted","anger","hatred","aggressive"},
    "fear":     {"afraid","fear","scared","terrified","anxious","worried","nervous",
                 "panic","dread","horror","frightened","uneasy","threatened","tense",
                 "apprehensive","scary","terrifying"},
    "sadness":  {"sad","unhappy","depressed","miserable","grief","sorrow","heartbroken",
                 "lonely","hopeless","disappointed","melancholy","gloomy","devastated",
                 "cry","tears","crying","upset","hurt"},
    "surprise": {"surprised","astonished","amazed","unexpected","shocking","unbelievable",
                 "wow","incredible","sudden","startled","stunned","astounding","remarkable",
                 "shocking","shocked"},
    "disgust":  {"disgusting","gross","revolting","nasty","horrible","awful","terrible",
                 "repulsive","vile","foul","dreadful","appalling","hideous","offensive",
                 "disgusted","repulsed"},
}


# ── Pure-Python tokenisers (no NLTK) ─────────────────────────────────────────

def tokenize_sentences(text):
    """
    Split text into sentences using regex.
    Handles common abbreviations to avoid false splits.
    """
    # Protect common abbreviations
    text = re.sub(r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp)\.',
                  r'\1<DOT>', text)
    # Split on sentence-ending punctuation followed by space + capital letter
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z"])', text)
    # Restore protected dots
    return [p.replace('<DOT>', '.').strip() for p in parts if p.strip()]


def tokenize_words(text):
    """Split text into lowercase words (letters only)."""
    return re.findall(r"[a-zA-Z']+", text.lower())


def clean_text(text):
    text = re.sub(r"http\S+|www\S+", "", text)
    return re.sub(r"\s+", " ", text).strip()


# ── Analysis functions ────────────────────────────────────────────────────────

def get_sentences(text):
    result = []
    for sent in tokenize_sentences(text):
        if len(sent.split()) < 3:
            continue
        s = analyzer.polarity_scores(sent)
        c = s["compound"]
        result.append({
            "text":     sent,
            "compound": round(c, 4),
            "label":    "positive" if c >= 0.05 else "negative" if c <= -0.05 else "neutral",
            "pos":      round(s["pos"], 4),
            "neu":      round(s["neu"], 4),
            "neg":      round(s["neg"], 4),
        })
    return result


def get_keywords(text, top_n=15):
    sentences = [s for s in tokenize_sentences(text) if len(s.split()) >= 3]

    if len(sentences) < 2:
        # Frequency fallback for short texts
        words = [w.strip(string.punctuation) for w in tokenize_words(text)
                 if w not in STOP_WORDS and len(w) > 3]
        freq  = Counter(words)
        total = sum(freq.values()) or 1
        return [{"word": w, "score": round(c / total, 4)} for w, c in freq.most_common(top_n)]

    try:
        vec    = TfidfVectorizer(stop_words="english", max_features=200,
                                 ngram_range=(1, 2), min_df=1)
        mat    = vec.fit_transform(sentences)
        scores = mat.sum(axis=0).A1
        vocab  = vec.get_feature_names_out()
        pairs  = sorted(zip(vocab, scores), key=lambda x: x[1], reverse=True)
        return [{"word": w, "score": round(float(s), 4)} for w, s in pairs[:top_n]]
    except Exception:
        return []


def get_emotions(text):
    words = set(tokenize_words(text))
    raw   = {e: len(words & kw) for e, kw in EMOTION_LEXICON.items()}
    total = sum(raw.values()) or 1
    return {e: round(c / total * 100, 1) for e, c in raw.items()}


def get_readability(text):
    sentences = tokenize_sentences(text)
    words     = [w for w in tokenize_words(text) if w.isalpha()]
    ns        = max(len(sentences), 1)
    nw        = max(len(words), 1)

    def syllables(word):
        count, prev = 0, False
        for ch in word.lower():
            v = ch in "aeiouy"
            if v and not prev:
                count += 1
            prev = v
        return max(count, 1)

    nsyl   = sum(syllables(w) for w in words)
    flesch = max(0, min(100, 206.835 - 1.015*(nw/ns) - 84.6*(nsyl/nw)))
    grade  = 0.39*(nw/ns) + 11.8*(nsyl/nw) - 15.59

    if   flesch >= 90: level = "Very Easy"
    elif flesch >= 70: level = "Easy"
    elif flesch >= 60: level = "Standard"
    elif flesch >= 50: level = "Fairly Difficult"
    elif flesch >= 30: level = "Difficult"
    else:              level = "Very Difficult"

    return {
        "flesch_score":           round(flesch, 1),
        "grade_level":            round(max(grade, 1), 1),
        "level_label":            level,
        "word_count":             nw,
        "sentence_count":         ns,
        "avg_words_per_sentence": round(nw / ns, 1),
    }


def analyse_text(text):
    text = clean_text(text)
    if not text or len(text.split()) < 3:
        return {"error": "Text too short. Please enter at least a few sentences."}

    overall = analyzer.polarity_scores(text)
    c       = overall["compound"]
    label   = "positive" if c >= 0.05 else "negative" if c <= -0.05 else "neutral"
    sentences = get_sentences(text)
    counts    = Counter(s["label"] for s in sentences)

    return {
        "overall": {
            "compound":  round(c, 4),
            "label":     label,
            "pos":       round(overall["pos"], 4),
            "neu":       round(overall["neu"], 4),
            "neg":       round(overall["neg"], 4),
            "score_pct": round((c + 1) / 2 * 100, 1),
        },
        "sentences":       sentences,
        "sentence_counts": {
            "positive": counts.get("positive", 0),
            "neutral":  counts.get("neutral",  0),
            "negative": counts.get("negative", 0),
        },
        "keywords":    get_keywords(text),
        "emotions":    get_emotions(text),
        "readability": get_readability(text),
        "char_count":  len(text),
        "word_count":  len(text.split()),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)

@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided."}), 400
    return jsonify(analyse_text(text))

@app.route("/api/url", methods=["POST"])
def analyze_url():
    data = request.get_json(silent=True) or {}
    url  = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided."}), 400
    try:
        import requests as req
        from bs4 import BeautifulSoup
        resp = req.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script","style","nav","header","footer","aside"]):
            tag.decompose()
        text   = soup.get_text(separator=" ", strip=True)[:5000]
        result = analyse_text(text)
        result["source_url"] = url
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Could not fetch URL: {str(e)}"}), 400

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "analyzer": "VADER + TF-IDF (no NLTK)"})


# ── Auto-open browser (Windows-compatible) ────────────────────────────────────

def open_browser():
    import time, subprocess, sys
    time.sleep(1.5)
    url = "http://localhost:5000"
    try:
        if sys.platform == "win32":
            os.startfile(url)
            return
    except Exception:
        pass
    try:
        if sys.platform == "win32":
            subprocess.Popen(["cmd", "/c", "start", url], shell=False)
            return
    except Exception:
        pass
    try:
        webbrowser.open_new_tab(url)
    except Exception:
        pass


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  SENTIX  Sentiment Analysis Dashboard")
    print("  URL  :  http://localhost:5000")
    print("  Opening browser automatically...")
    print("=" * 50 + "\n")

    threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=False, port=5000, host="0.0.0.0", use_reloader=False)
