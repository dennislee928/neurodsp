# Use an official Python runtime as a parent image
FROM python:3.11-slim-bullseye

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Set work directory
WORKDIR /app

# Copy the project files
COPY . .

# Create virtual environment and install dependencies using uv
# We include jaxlib with CPU support by default. For GPU, different jaxlib would be needed.
RUN uv venv $UV_PROJECT_ENVIRONMENT && \
    . $UV_PROJECT_ENVIRONMENT/bin/activate && \
    uv pip install jax[cpu] altair fastplotlib robotframework polars pydantic .

# Add virtual environment to PATH
ENV PATH="$UV_PROJECT_ENVIRONMENT/bin:$PATH"

# Default command
CMD ["robot", "tests/robot/"]
