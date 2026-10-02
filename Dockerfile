FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DB_PATH=/data/database.sqlite

WORKDIR /srv

# dlib-bin traz o dlib pré-compilado (evita compilar por ~15 min).
COPY requirements.txt .
RUN grep -vE '^(dlib|face_recognition)' requirements.txt > req-docker.txt \
 && pip install -r req-docker.txt dlib-bin==19.24.6 face_recognition_models==0.3.0 Click \
 && pip install --no-deps face_recognition==1.3.0

COPY app ./app
COPY static ./static

RUN mkdir -p /data
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
