FROM python:3.11-slim

# Install system dependencies (ffmpeg is required for audio extraction/thumbnail generation)
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install python-dotenv uvicorn

# Copy application code
COPY . .

# Bake the Whisper model into the image so it doesn't download at runtime (avoids HF rate limits & speeds up boot)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

# Run the API
ENV HF_HUB_OFFLINE=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
