import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceMode = "web-speech" | "llama-asr" | "unavailable";

export interface UseVoiceRecordingOptions {
  onTranscription: (text: string) => void;
  onError?: (msg: string) => void;
}

export interface UseVoiceRecordingResult {
  mode: VoiceMode;
  isRecording: boolean;
  isTranscribing: boolean;
  interimText: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => void;
  cancelRecording: () => void;
}

// Web Speech API types (not always in TS lib)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

function detectMode(): VoiceMode {
  if (typeof window === "undefined") return "unavailable";
  if (window.SpeechRecognition || window.webkitSpeechRecognition) return "web-speech";
  if (typeof navigator !== "undefined" && typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia === "function") return "llama-asr";
  return "unavailable";
}

export function useVoiceRecording({
  onTranscription,
  onError,
}: UseVoiceRecordingOptions): UseVoiceRecordingResult {
  const [mode] = useState<VoiceMode>(() => detectMode());
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Web Speech API path ──────────────────────────────────────────────────────

  const startWebSpeech = useCallback(async () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    setError(null);
    finalTranscriptRef.current = "";
    setInterimText("");

    const rec: ISpeechRecognition = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalPart += t;
        else interim += t;
      }
      if (finalPart) finalTranscriptRef.current += finalPart;
      setInterimText(finalTranscriptRef.current + interim);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg =
        event.error === "not-allowed"
          ? "Microphone access denied — please allow microphone in browser settings"
          : event.error === "no-speech"
            ? "No speech detected — try speaking more clearly"
            : `Speech recognition error: ${event.error}`;
      setError(msg);
      onError?.(msg);
      setIsRecording(false);
      setInterimText("");
    };

    rec.onend = () => {
      const text = (finalTranscriptRef.current || interimText).trim();
      setIsRecording(false);
      setInterimText("");
      if (text) {
        onTranscription(text);
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [onTranscription, onError, interimText]);

  const stopWebSpeech = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const cancelWebSpeech = useCallback(() => {
    recognitionRef.current?.abort();
    setIsRecording(false);
    setInterimText("");
    setError(null);
  }, []);

  // ── Llama ASR path ──────────────────────────────────────────────────────────

  const transcribeBlobLlama = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.wav");

        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { success: boolean; text?: string; error?: string };
        if (data.success && data.text) {
          onTranscription(data.text);
        } else {
          const msg = data.error ?? "Transcription returned no text";
          setError(msg);
          onError?.(msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transcription request failed";
        setError(msg);
        onError?.(msg);
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscription, onError],
  );

  const startLlamaRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const mimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((t) =>
          MediaRecorder.isTypeSupported(t),
        ) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        transcribeBlobLlama(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const msg =
        raw.toLowerCase().includes("permission") || raw.toLowerCase().includes("denied")
          ? "Microphone access denied — please allow microphone in browser settings"
          : `Could not start recording: ${raw}`;
      setError(msg);
      onError?.(msg);
    }
  }, [transcribeBlobLlama, onError]);

  const stopLlamaRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setIsRecording(false);
  }, []);

  const cancelLlamaRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setError(null);
  }, []);

  // ── Unified API ─────────────────────────────────────────────────────────────

  const startRecording = mode === "web-speech" ? startWebSpeech : startLlamaRecording;
  const stopAndTranscribe = mode === "web-speech" ? stopWebSpeech : stopLlamaRecording;
  const cancelRecording = mode === "web-speech" ? cancelWebSpeech : cancelLlamaRecording;

  return { mode, isRecording, isTranscribing, interimText, error, startRecording, stopAndTranscribe, cancelRecording };
}
