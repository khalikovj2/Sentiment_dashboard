# ◈ SENTIX — Real-Time Sentiment Analysis Dashboard

A production-grade AI-powered sentiment analysis web application with a premium dark interface. Analyses text or webpage content for sentiment, emotions, keywords, and readability — instantly, with no GPU or paid APIs required.

---

## Features

- **Overall sentiment scoring** — Positive / Neutral / Negative with animated gauge
- **Sentence-level heatmap** — Every sentence colour-coded by sentiment
- **Emotion profile radar** — Joy, Anger, Fear, Sadness, Surprise, Disgust
- **Keyword extraction** — TF-IDF ranked keyword bar chart  
- **Readability analysis** — Flesch score, grade level, sentence stats
- **URL fetching** — Paste any public URL to analyse webpage content
- **Zero model downloads** — VADER + TF-IDF run in milliseconds on CPU

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Python 3.10+ · Flask · Flask-CORS   |
| NLP       | VADER Sentiment · scikit-learn TF-IDF · NLTK |
| Frontend  | Vanilla HTML/CSS/JS · Chart.js 4    |
| Fonts     | Google Fonts (Syne + DM Mono)       |

---

## Installation & Running

```bash
# 1. Navigate to project folder
cd sentiment_dashboard

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start the backend
python backend/app.py

# 4. Open the frontend
# Open frontend/index.html in your browser
# OR visit http://localhost:5000 (Flask also serves the HTML)
```

> First run downloads small NLTK data files (~2MB). No other downloads needed.

---

## Project Structure

```
sentiment_dashboard/
├── backend/
│   └── app.py              # Flask REST API
├── frontend/
│   ├── index.html          # Main UI
│   ├── css/
│   │   └── style.css       # Dark theme styles
│   └── js/
│       └── app.js          # Chart rendering + API calls
├── requirements.txt
└── README.md
```

---

## API Endpoints

| Method | Endpoint       | Description                        |
|--------|----------------|------------------------------------|
| POST   | /api/analyze   | Analyse raw text (JSON body)       |
| POST   | /api/url       | Fetch URL and analyse content      |
| GET    | /api/health    | Server health check                |

### Example request
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "This product is absolutely amazing! I love it."}'
```

---

## Keyboard Shortcut

Press **Ctrl + Enter** (or **Cmd + Enter** on Mac) to run analysis instantly.
