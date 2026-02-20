"""
server.py — FastAPI backend for the Manim animation generator.

Start with:
    uvicorn server:app --port 8000
"""

import asyncio
import glob
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

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

SYSTEM_PROMPT = """You are an AI assistant for a Manim animation tool.

Decide how to respond based on the user's intent:

─── If the user wants an animation (asks to animate, visualize, show, demonstrate, etc.) ───
Respond with ONLY a complete, runnable Python Manim script. No explanation, no markdown fences.

Manim rules (Community Edition v0.19):
- Use `from manim import *` at the top.
- Define exactly one Scene subclass.
- NEVER use MathTex or Tex — no LaTeX installed. Use Text() with Unicode (e.g. "θ", "π").
- NEVER use deprecated APIs:
    - Create() not ShowCreation()
    - axes.plot(func, color=X) not axes.get_graph()
    - Axes uses x_length/y_length, never width/height
    - No TRANSPARENT constant — use Line(...).set_stroke(opacity=0) for invisible paths
- Guard always_redraw x_range upper bounds: max(tracker.get_value(), 0.001)

─── If the user asks a question or wants an explanation ───
Respond with a clear, helpful text answer. Do NOT generate code.
Use the conversation history for context (e.g. if they ask about a previously generated animation).
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


def call_oci_ai(history: list[dict]) -> str:
    """Call OCI with a full conversation history."""
    config = load_oci_config()
    client = oci.generative_ai_inference.GenerativeAiInferenceClient(config=config)

    oci_messages = [
        oci.generative_ai_inference.models.SystemMessage(
            content=[oci.generative_ai_inference.models.TextContent(text=SYSTEM_PROMPT)]
        )
    ]

    for turn in history:
        if turn["role"] == "user":
            oci_messages.append(
                oci.generative_ai_inference.models.UserMessage(
                    content=[oci.generative_ai_inference.models.TextContent(text=turn["content"])]
                )
            )
        else:
            oci_messages.append(
                oci.generative_ai_inference.models.AssistantMessage(
                    content=[oci.generative_ai_inference.models.TextContent(text=turn["content"])]
                )
            )

    chat_request = oci.generative_ai_inference.models.GenericChatRequest(
        api_format=oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC,
        messages=oci_messages,
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


def is_animation_response(raw: str) -> bool:
    """Return True if the AI returned Manim code rather than a text answer."""
    return bool(re.search(r"class\s+\w+\s*\(\s*Scene\s*\)", raw))


# ── Pipeline ──────────────────────────────────────────────────────────────────

def run_pipeline(history: list[dict]) -> dict:
    raw = call_oci_ai(history)

    # ── Text answer ──────────────────────────────────────────────────────────
    if not is_animation_response(raw):
        return {"type": "text", "content": raw}

    # ── Animation ────────────────────────────────────────────────────────────
    code = extract_code(raw)
    SCENE_FILE.write_text(code, encoding="utf-8")

    class_name = detect_class_name(code)
    if not class_name:
        raise ValueError("No Scene class detected in generated code.")

    result = subprocess.run(
        ["manim", "-ql", str(SCENE_FILE), class_name],
        cwd=str(SCRIPT_DIR),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Manim render failed:\n{result.stderr or result.stdout}")

    pattern = str(SCRIPT_DIR / "media" / "videos" / "generated_scene" / "480p15" / f"{class_name}.mp4")
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(f"Rendered video not found at: {pattern}")

    return {
        "type": "animation",
        "scene_name": class_name,
        "video_url": f"/media/videos/generated_scene/480p15/{class_name}.mp4",
    }


# ── Routes ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/api/generate")
async def generate(req: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(executor, run_pipeline, history)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
