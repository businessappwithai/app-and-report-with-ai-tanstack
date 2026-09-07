#!/usr/bin/env python3
"""Lightweight Whisper STT server exposing OpenAI-compatible /v1/audio/transcriptions endpoint."""

import io
import tempfile
import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import uvicorn
import whisper

MODEL_NAME = os.environ.get("WHISPER_MODEL", "tiny.en")
PORT = int(os.environ.get("LLAMA_STT_PORT", "8081"))

print(f"[Whisper STT] Loading model: {MODEL_NAME}")
model = whisper.load_model(MODEL_NAME)
print(f"[Whisper STT] Model loaded. Server starting on port {PORT}")

app = FastAPI(title="Whisper STT Server")


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-tiny.en"),
    response_format: str = Form(default="json"),
):
    audio_bytes = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = whisper.transcribe(globals()["model"], tmp_path, fp16=False)
        text = result.get("text", "").strip()
    finally:
        os.unlink(tmp_path)

    if response_format == "text":
        return text

    return JSONResponse({"text": text})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
