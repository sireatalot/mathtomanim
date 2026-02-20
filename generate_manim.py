"""
generate_manim.py  —  Generate Manim animation scripts via Oracle Cloud Generative AI.

Uses OCI SDK authentication (via ~/.oci/config + .pem key).

Usage:
    python generate_manim.py "animate a bouncing ball"
    python generate_manim.py "show the unit circle" --output my_scene.py
    python generate_manim.py "plot sine and cosine" --run
    python generate_manim.py --list-models
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

import oci
from dotenv import load_dotenv

load_dotenv()

COMPARTMENT_ID = os.getenv("OCI_COMPARTMENT_ID")
MODEL_ID       = os.getenv("OCI_MODEL_ID")

SYSTEM_PROMPT = """You are an expert Manim (Community Edition v0.19) developer.
When the user describes an animation, respond with ONLY a complete, runnable Python script.

Rules:
- Use `from manim import *` at the top.
- Define exactly one Scene subclass.
- NEVER use MathTex or Tex — the environment has no LaTeX installed.
  Use Text() with Unicode characters instead (e.g. "θ", "π", "sin(θ)").
- NEVER use deprecated APIs. Specifically:
    - Use Create() NOT ShowCreation()
    - Use FadeIn() / FadeOut() NOT ShowPassingFlash() for simple fades
    - Use Uncreate() NOT UnCreate()
- For Axes, always use x_length and y_length — NEVER width or height.
- Use axes.plot(func, color=COLOR) to draw graphs — NEVER axes.get_graph() which is deprecated.
- TRANSPARENT is not defined in Manim. For invisible paths use Line(...).set_stroke(opacity=0).
- When using always_redraw with axes.plot and a ValueTracker, guard the x_range
  upper bound with max(tracker.get_value(), 0.001) to avoid zero-range errors.
- Keep animations clear and visually appealing.
- Do NOT include any explanation, markdown fences, or commentary — pure Python only.
"""

# ─────────────────────────────────────────────────────────────────────────────

def load_oci_config() -> dict:
    """
    Load ~/.oci/config and fix key_file path if the original .pem has moved.
    Falls back to searching the current directory for a .pem file.
    """
    config = oci.config.from_file()

    key_file = config.get("key_file", "")
    if not Path(key_file).exists():
        # Try to find a .pem in the script's directory
        script_dir = Path(__file__).parent
        pems = list(script_dir.glob("*.pem"))
        if pems:
            config["key_file"] = str(pems[0])
            print(f"[i] key_file not found at original path — using: {pems[0].name}")
        else:
            print(f"[!] Cannot find .pem key file. Expected: {key_file}")
            sys.exit(1)

    return config


def make_client() -> oci.generative_ai_inference.GenerativeAiInferenceClient:
    config = load_oci_config()
    return oci.generative_ai_inference.GenerativeAiInferenceClient(config=config)


def list_models():
    """List all chat-capable models in the compartment."""
    config = load_oci_config()
    ga_client = oci.generative_ai.GenerativeAiClient(config=config)

    models = oci.pagination.list_call_get_all_results(
        ga_client.list_models,
        compartment_id=COMPARTMENT_ID,
    ).data

    chat_models = [
        m for m in models
        if m.lifecycle_state == "ACTIVE"
        and any(
            getattr(c, "capability", c) in (
                "CHAT",
                oci.generative_ai.models.Model.CAPABILITIES_CHAT,
            )
            for c in (m.capabilities or [])
        )
    ]

    if not chat_models:
        print("No active chat models found.")
        return

    print(f"\nFound {len(chat_models)} chat model(s):\n")
    for m in chat_models:
        print(f"  {m.display_name}")
        print(f"    OCID : {m.id}")
        print(f"    State: {m.lifecycle_state}\n")


def call_oci_ai(prompt: str) -> str:
    client = make_client()

    # System + user messages
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


def main():
    parser = argparse.ArgumentParser(description="Generate a Manim script with Oracle Cloud AI.")
    parser.add_argument("prompt", nargs="?", help="Describe the animation you want.")
    parser.add_argument("-o", "--output", default="generated_scene.py",
                        help="Output filename (default: generated_scene.py)")
    parser.add_argument("--run", action="store_true",
                        help="Render the scene with manim -pql after generating.")
    parser.add_argument("--list-models", action="store_true",
                        help="List available chat models and their OCIDs.")
    args = parser.parse_args()

    if args.list_models:
        list_models()
        return

    if not args.prompt:
        parser.print_help()
        sys.exit(1)

    print(f"[→] Model ID : {MODEL_ID}")
    print(f"[→] Sending prompt to Oracle Cloud Generative AI...")

    raw = call_oci_ai(args.prompt)
    code = extract_code(raw)

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(code)

    class_name = detect_class_name(code)
    print(f"[✓] Script saved to: {args.output}")
    if class_name:
        print(f"[✓] Scene class detected: {class_name}")

    if args.run:
        if not class_name:
            print("[!] Could not detect Scene class name — skipping render.")
            sys.exit(1)
        cmd = ["manim", "-pql", args.output, class_name]
        print(f"[→] Running: {' '.join(cmd)}")
        subprocess.run(cmd)


if __name__ == "__main__":
    main()
