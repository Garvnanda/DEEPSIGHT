# Deep-Sight backend image for Google Cloud Run.
# data/ is not baked in: mount a Cloud Storage bucket at /app/data (demo tiles, uploads, saved surveys).
FROM python:3.11-slim

# libGL + glib: runtime libs opencv-python needs on a slim image (no GUI is used)
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# CPU-only torch first so ultralytics doesn't pull the ~2.5 GB CUDA build (Cloud Run has no GPU)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && grep -v '^pytest$' requirements.txt > req-prod.txt \
    && pip install --no-cache-dir -r req-prod.txt

COPY backend/ backend/

# One worker: survey registry is in-process memory (backend/state.py)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
