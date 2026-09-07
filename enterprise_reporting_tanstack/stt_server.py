#!/usr/bin/env python3
"""
OpenAI-compatible STT server — Moonshine v2 Tiny (ONNX)
Endpoints:
  GET  /health
  POST /v1/audio/transcriptions   (OpenAI SDK / CopilotKit compatible)
  POST /inference                  (whisper.cpp wire-format compatible)
"""
import os, subprocess, tempfile, sys
from flask import Flask, request, jsonify

app = Flask(__name__)

print("[STT] Loading Moonshine v2 Tiny ONNX model…", flush=True)
try:
    from moonshine.onnx_model import MoonshineOnnxModel
    from moonshine.audio import load_audio as moonshine_load
    _model = MoonshineOnnxModel(model_name="moonshine/tiny")
    _load_audio = moonshine_load
    print("[STT] Moonshine v2 Tiny ready.", flush=True)
except Exception as _e:
    print(f"[STT] ERROR: {_e}", flush=True)
    _model = None
    _load_audio = None


def _convert_to_wav(src: str, dst: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-ar", "16000", "-ac", "1", "-f", "wav", dst],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
    )


def _transcribe(file_storage) -> str:
    if _model is None:
        raise RuntimeError("Moonshine model not loaded — check container logs")

    filename = getattr(file_storage, "filename", "") or "audio.wav"
    ext = os.path.splitext(filename)[1].lower() or ".wav"

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "input" + ext)
        file_storage.save(src)

        wav = src
        if ext not in (".wav", ".wave"):
            wav = os.path.join(tmp, "audio.wav")
            _convert_to_wav(src, wav)

        audio = _load_audio(wav)
        result = _model.transcribe(audio)

        if isinstance(result, (list, tuple)):
            return "".join(str(t) for t in result).strip()
        return str(result).strip()


@app.route("/health")
def health():
    return jsonify({
        "status": "ok" if _model else "degraded",
        "model": "moonshine-v2-tiny",
    })


@app.route("/v1/audio/transcriptions", methods=["POST"])
def v1_transcriptions():
    f = request.files.get("file") or request.files.get("audio")
    if not f:
        return jsonify({"error": "no audio file in request"}), 400
    try:
        return jsonify({"text": _transcribe(f)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# whisper.cpp /inference wire format (also used by Mastra as a first try)
@app.route("/inference", methods=["POST"])
def inference():
    f = (
        request.files.get("file")
        or request.files.get("audio-file")
        or request.files.get("audio")
    )
    if not f:
        return jsonify({"error": "no audio file in request"}), 400
    try:
        return jsonify({"text": _transcribe(f)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8081)))
