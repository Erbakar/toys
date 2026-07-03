# Render-friendly single-stage build:
# - CPU-only PyTorch (smaller/faster build)
# - Model downloaded via curl (no YOLO inference at build time)
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libgthread-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Download YOLO weights directly — avoids fragile multi-stage copy + OpenCV at build time
RUN curl -fsSL -o yolo11n.pt \
    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt" && \
    test -s yolo11n.pt

COPY main.py config.py ./

RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=yolo11n.pt \
    CONFIDENCE_THRESHOLD=0.25 \
    IOU_THRESHOLD=0.45 \
    MAX_DETECTIONS=100 \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]
