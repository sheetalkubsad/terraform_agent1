# --- Stage 1: Build Frontend (Vite) ---
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY ai-infra-scribe/package*.json ./
RUN npm install

# Build the production assets
COPY ai-infra-scribe/ ./
RUN npm run build


# --- Stage 2: Final Image (Python/FastAPI) ---
FROM python:3.11-bookworm
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements (aiohttp removed from requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
 && AIOHTTP_NO_EXTENSIONS=1 pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY src/ ./src/
COPY main.tf .
COPY github_utils.py .
COPY build_shared_context.py .
COPY run.py .
COPY requirements.txt .

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./ai-infra-scribe/dist

# Expose Cloud Run default port
EXPOSE 8080

# Run with uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
