"""
server.py — FastAPI backend for the Manim animation generator.

Start with:
    uvicorn server:app --reload --port 8000
"""

import asyncio
import glob
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import oci
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

COMPARTMENT_ID = os.getenv("OCI_COMPARTMENT_ID")
MODEL_ID       = os.getenv("OCI_MODEL_ID")
SCRIPT_DIR     = Path(__file__).parent
SCENE_FILE     = SCRIPT_DIR / "generated_scene.py"

SYSTEM_PROMPT = """You are an expert Manim (Community Edition v0.19) developer.
When the user describes an animation, respond with ONLY a complete, runnable Python script.

Rules:
- Use `from manim import *` at the top.
- Define exactly one Scene subclass.
- NEVER use MathTex or Tex — the environment has no LaTeX installed.
  Use Text() with Unicode characters instead (e.g. "θ", "π", "sin(θ)").
- NEVER use deprecated APIs:
    - Use Create() NOT ShowCreation()
    - Use axes.plot(func, color=X) NOT axes.get_graph()
    - For Axes use x_length and y_length, NEVER width or height
    - TRANSPARENT is not defined — use Line(...).set_stroke(opacity=0) for invisible paths
- When using always_redraw with axes.plot and a ValueTracker, guard x_range upper
  bound with max(tracker.get_value(), 0.001) to avoid zero-range errors.
- Keep animations clear and visually appealing.
- Do NOT include any explanation, markdown fences, or commentary — pure Python only.
"""

# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(SCRIPT_DIR / "media")), name="media")

executor = ThreadPoolExecutor(max_workers=2)


# ── OCI helpers ───────────────────────────────────────────────────────────────

def load_oci_config() -> dict:
    config = oci.config.from_file()
    key_file = config.get("key_file", "")
    if not Path(key_file).exists():
        pems = list(SCRIPT_DIR.glob("*.pem"))
        if pems:
            config["key_file"] = str(pems[0])
    return config


def call_oci_ai(prompt: str) -> str:
    config = load_oci_config()
    client = oci.generative_ai_inference.GenerativeAiInferenceClient(config=config)

    messages = [
        oci.generative_ai_inference.models.SystemMessage(
            content=[oci.generative_ai_inference.models.TextContent(text=SYSTEM_PROMPT)]
        ),
        oci.generative_ai_inference.models.UserMessage(
            content=[oci.generative_ai_inference.models.TextContent(text=prompt)]
        ),
    ]

    chat_request = oci.generative_ai_inference.models.GenericChatRequest(
        api_format=oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC,
        messages=messages,
        max_tokens=4096,
        temperature=0.3,
    )

    chat_detail = oci.generative_ai_inference.models.ChatDetails(
        compartment_id=COMPARTMENT_ID,
        serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(
            model_id=MODEL_ID,
            serving_type="ON_DEMAND",
        ),
        chat_request=chat_request,
    )

    response = client.chat(chat_detail)
    return response.data.chat_response.choices[0].message.content[0].text.strip()


def extract_code(raw: str) -> str:
    match = re.search(r"```(?:python)?\n(.*?)```", raw, re.DOTALL)
    return match.group(1).strip() if match else raw


def detect_class_name(code: str) -> str | None:
    match = re.search(r"class\s+(\w+)\s*\(\s*Scene\s*\)", code)
    return match.group(1) if match else None


# ── Pipeline ──────────────────────────────────────────────────────────────────

def run_pipeline(prompt: str) -> dict:
    # 1. Generate Manim code via OCI
    raw = call_oci_ai(prompt)
    code = extract_code(raw)

    # 2. Save script
    SCENE_FILE.write_text(code, encoding="utf-8")

    # 3. Detect scene class
    class_name = detect_class_name(code)
    if not class_name:
        raise ValueError("No Scene class detected in generated code.")

    # 4. Render with Manim (low quality, no auto-open)
    result = subprocess.run(
        ["manim", "-ql", str(SCENE_FILE), class_name],
        cwd=str(SCRIPT_DIR),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Manim render failed:\n{result.stderr or result.stdout}")

    # 5. Locate the output video
    pattern = str(SCRIPT_DIR / "media" / "videos" / "generated_scene" / "480p15" / f"{class_name}.mp4")
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(f"Rendered video not found at: {pattern}")

    return {
        "scene_name": class_name,
        "video_url": f"/media/videos/generated_scene/480p15/{class_name}.mp4",
    }


# ── Routes ────────────────────────────────────────────────────────────────────

class PromptRequest(BaseModel):
    prompt: str


@app.post("/api/generate")
async def generate(req: PromptRequest):
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(executor, run_pipeline, req.prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
