FROM python:3.11-slim

# Manim system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY server.py generate_manim.py generated_scene.py ./

# Pre-built React frontend (run `npm run build` locally before deploying)
COPY dist/ ./dist/

# OCI credentials are mounted at runtime — never baked into the image
RUN mkdir -p /root/.oci

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
