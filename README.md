# Manim Animation Generator

An AI-powered chat interface that generates and renders math/CS animations from natural language prompts. Describe a concept, get a Manim animation — or ask follow-up questions and get Markdown + LaTeX answers.

---

## How It Works

```
User prompt
    │
    ▼
React frontend  ──POST /api/generate──▶  FastAPI backend
    │                                         │
    │                                         ▼
    │                               Oracle Cloud Generative AI
    │                               (Meta Llama 3.3 70B)
    │                                         │
    │                           ┌─────────────┴──────────────┐
    │                     Animation request            Question / explanation
    │                           │                             │
    │                    Writes + renders              Returns plain text
    │                    Manim script                         │
    │                           │                             │
    ◀────── video URL ──────────┘                             │
    ◀────── text (Markdown + LaTeX) ──────────────────────────┘
    │
    ▼
Displays video player  or  rendered Markdown / LaTeX
```

---

## Prerequisites

### System dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3.10+ | Backend + Manim | [python.org](https://www.python.org/downloads/) |
| Node.js 18+ | Frontend | [nodejs.org](https://nodejs.org/) |
| FFmpeg | Manim video rendering | `sudo apt install ffmpeg` |
| Cairo & Pango | Manim graphics | `sudo apt install libcairo2-dev libpango1.0-dev` |

> **Windows:** Install FFmpeg via [Chocolatey](https://chocolatey.org/packages/ffmpeg) or [winget](https://winget.run/pkg/Gyan/FFmpeg). Cairo/Pango are bundled with the Manim Windows installer.

### Oracle Cloud account

You need an OCI account with access to **Generative AI** in `us-chicago-1` (or update the region in your `.env`).

---

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd manim-animation-generator
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Node dependencies

```bash
npm install
```

### 4. Configure OCI authentication

OCI uses RSA key-pair authentication. You need a private key (`.pem`) and a config file.

**a) Generate an API key in OCI Console**

1. Log into [cloud.oracle.com](https://cloud.oracle.com)
2. Go to **Profile → My profile → API keys → Add API key**
3. Download the private key (`.pem`) and copy the config snippet shown

**b) Create `~/.oci/config`**

```ini
[DEFAULT]
user=ocid1.user.oc1..<your-user-ocid>
fingerprint=<your-key-fingerprint>
tenancy=ocid1.tenancy.oc1..<your-tenancy-ocid>
region=us-chicago-1
key_file=~/.oci/oci_api_key.pem
```

**c) Place your `.pem` file**

```bash
cp /path/to/downloaded-key.pem ~/.oci/oci_api_key.pem
chmod 600 ~/.oci/oci_api_key.pem
```

> **Alternatively**, place the `.pem` file in the project root directory. The server auto-detects it if the path in `~/.oci/config` no longer exists.

### 5. Create a `.env` file

```env
OCI_COMPARTMENT_ID=ocid1.tenancy.oc1..<your-tenancy-ocid>
OCI_REGION=us-chicago-1
OCI_MODEL_ID=ocid1.generativeaimodel.oc1.us-chicago-1.<model-ocid>
```

**Finding your `OCI_MODEL_ID`:**

```bash
# Option 1 — OCI CLI
oci generative-ai model-collection list-models \
  --compartment-id <your-tenancy-ocid> \
  --region us-chicago-1 \
  --lifecycle-state ACTIVE \
  --all \
  --output table \
  --query "data.items[*].{Name:\"display-name\",ID:id}"

# Option 2 — built-in CLI tool (after setup)
python generate_manim.py --list-models
```

---

## Running Locally

Start both the backend and frontend with a single command:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |

---

## Standalone CLI

Generate and render a Manim animation directly from the terminal without the frontend:

```bash
# Generate script only
python generate_manim.py "animate a bouncing ball"

# Generate and render immediately
python generate_manim.py "show the Pythagorean theorem" --run

# Custom output filename
python generate_manim.py "plot sine and cosine waves" --output trig.py --run

# List available OCI models
python generate_manim.py --list-models
```

---

## Project Structure

```
├── src/
│   ├── App.tsx          # React frontend — chat UI, history, Markdown/LaTeX rendering
│   ├── main.tsx         # React entry point
│   └── index.css        # Tailwind + KaTeX CSS imports
├── server.py            # FastAPI backend — OCI AI + Manim pipeline
├── generate_manim.py    # Standalone CLI tool
├── requirements.txt     # Python dependencies
├── package.json         # Node dependencies + npm scripts
├── vite.config.ts       # Vite config (Tailwind, HMR file exclusions)
├── index.html           # HTML entry point
├── .env                 # OCI credentials  ← not committed
└── media/               # Rendered video output  ← not committed
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4 |
| Icons | lucide-react |
| Markdown | react-markdown, remark-gfm |
| LaTeX | remark-math, rehype-katex, KaTeX |
| Backend | FastAPI, Uvicorn |
| AI | Oracle Cloud Generative AI — Meta Llama 3.3 70B |
| Animation | Manim Community Edition v0.19 |
| Auth | OCI SDK (RSA key-pair via `~/.oci/config`) |
| Dev | concurrently, ESLint, TypeScript |

---

## Troubleshooting

**`FileNotFoundError` during render**
> Manim is configured to avoid LaTeX. If this appears, the AI generated a `MathTex` call — re-run the prompt.

**`oci.exceptions.ConfigFileNotFound`**
> Ensure `~/.oci/config` exists and `key_file` points to a valid `.pem` file.

**`404` from OCI API**
> Verify `OCI_MODEL_ID` in `.env` is a valid OCID for your region. Run `python generate_manim.py --list-models` to confirm.

**Page refreshes mid-generation**
> Make sure `vite.config.ts` has the `server.watch.ignored` entries for `**/*.py` and `**/media/**`.

**Backend crashes mid-render**
> Do not use `--reload` with Uvicorn. The `npm run dev` script intentionally omits it to prevent restarts when `generated_scene.py` is written.
