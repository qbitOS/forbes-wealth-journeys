# Multi-stage base image for local dev
FROM python:3.11-slim AS base
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .

FROM base AS runtime
COPY . .
CMD ["python", "scripts/train.py"]
