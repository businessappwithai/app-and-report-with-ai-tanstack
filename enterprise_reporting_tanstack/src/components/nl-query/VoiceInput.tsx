import { useCopilotChat } from "@copilotkit/react-core";
import { AlertCircle, CheckCircle, Loader2, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StepStatus = "pending" | "running" | "done" | "error";

interface WorkflowStep {
  name: string;
  status: StepStatus;
  detail?: string;
}

type VoiceState = "idle" | "recording" | "processing";

export function VoiceInput() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { appendMessage } = useCopilotChat();

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [stepsTarget, setStepsTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const findTargets = () => {
      if (!mounted) return;
      const inputControls = document.querySelector(
        ".copilotKitInputControls"
      ) as HTMLElement | null;
      const messagesFooter = document.querySelector(
        ".copilotKitMessagesFooter"
      ) as HTMLElement | null;

      if (inputControls && !inputControls.querySelector(".voice-mic-portal")) {
        const wrapper = document.createElement("div");
        wrapper.className = "voice-mic-portal";
        wrapper.style.display = "contents";
        const sendBtn = inputControls.querySelector('button[aria-label="Send"]');
        if (sendBtn) {
          inputControls.insertBefore(wrapper, sendBtn);
        } else {
          inputControls.appendChild(wrapper);
        }
        setPortalTarget(wrapper);
      } else if (inputControls) {
        const existing = inputControls.querySelector(".voice-mic-portal") as HTMLElement | null;
        if (existing) setPortalTarget(existing);
      }

      if (messagesFooter) setStepsTarget(messagesFooter);
    };

    const debouncedFind = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(findTargets, 200);
    };

    findTargets();

    const observer = new MutationObserver(debouncedFind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      mounted = false;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const updateStep = useCallback((name: string, status: StepStatus, detail?: string) => {
    setSteps((prev) => {
      const existing = prev.find((s) => s.name === name);
      if (existing) {
        return prev.map((s) => (s.name === name ? { ...s, status, detail } : s));
      }
      return [...prev, { name, status, detail }];
    });
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    setSteps([]);
    setErrorMsg(null);
    setTranscribedText(null);
    chunksRef.current = [];

    updateStep("Microphone", "running", "Requesting access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      updateStep("Microphone", "done", "Access granted");
    } catch {
      updateStep("Microphone", "error", "Mic access denied by browser");
      setErrorMsg(
        "Microphone access denied. Please allow mic access in your browser settings and try again, or type your question in the chat."
      );
      setVoiceState("idle");
      return;
    }

    updateStep("Recording", "running", "Speak now...");
    const recorder = new MediaRecorder(mediaStreamRef.current);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(500);
    setVoiceState("recording");
  }, [updateStep]);

  const stopAndTranscribe = useCallback(async () => {
    setVoiceState("processing");

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      updateStep("Recording", "error", "No audio captured");
      setErrorMsg("No audio was captured. Try again or type your question in the chat.");
      setVoiceState("idle");
      cleanup();
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      updateStep("Recording", "error", "No audio data");
      setErrorMsg("No audio data was recorded. Try again or type your question in the chat.");
      setVoiceState("idle");
      return;
    }

    const mimeType = recorder.mimeType || "audio/webm";
    const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
    const blob = new Blob(chunks, { type: mimeType });
    const sizeKB = (blob.size / 1024).toFixed(1);
    updateStep("Recording", "done", `${chunks.length} chunks, ${sizeKB}KB`);

    updateStep("Audio conversion", "running", `Converting ${ext} → WAV...`);

    try {
      const form = new FormData();
      form.append("file", blob, `recording.${ext}`);

      updateStep("Audio conversion", "done", `${sizeKB}KB ${ext} ready`);
      updateStep("Whisper STT", "running", "Transcribing...");

      const res = await fetch("/api/copilotkit/transcribe", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        updateStep("Whisper STT", "error", `HTTP ${res.status}`);
        setErrorMsg(`Transcription server error (${res.status}). Type your question instead.`);
        setVoiceState("idle");
        return;
      }

      const data = await res.json();
      const text = (data.text || "").trim();

      if (!text) {
        updateStep("Whisper STT", "done", "No speech detected");
        setErrorMsg("No speech detected. Speak closer to the mic or type your question.");
        setVoiceState("idle");
        return;
      }

      updateStep("Whisper STT", "done", "Transcription complete");
      setTranscribedText(text);

      updateStep("Send to agent", "running", "Submitting...");

      appendMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      });

      updateStep("Send to agent", "done", "Sent");

      setTimeout(() => {
        setSteps([]);
        setTranscribedText(null);
      }, 8000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateStep("Whisper STT", "error", msg);
      setErrorMsg(`Transcription failed: ${msg}. Type your question instead.`);
    }

    setVoiceState("idle");
  }, [updateStep, cleanup, appendMessage]);

  const handleClick = useCallback(() => {
    if (voiceState === "idle") {
      startRecording();
    } else if (voiceState === "recording") {
      stopAndTranscribe();
    }
  }, [voiceState, startRecording, stopAndTranscribe]);

  const stepIcon = (status: StepStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />;
      case "running":
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />;
      default:
        return <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />;
    }
  };

  const micButton = (
    <button
      type="button"
      onClick={handleClick}
      disabled={voiceState === "processing"}
      className={`copilotKitInputControlButton ${voiceState === "recording" ? "voice-recording-active" : ""}`}
      title={
        voiceState === "idle"
          ? "Voice input"
          : voiceState === "recording"
            ? "Stop recording"
            : "Transcribing..."
      }
      style={{ position: "relative" }}
    >
      {voiceState === "idle" && <Mic className="h-4 w-4" />}
      {voiceState === "recording" && <Square className="h-3.5 w-3.5 fill-red-500 text-red-500" />}
      {voiceState === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
      {voiceState === "recording" && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </button>
  );

  const stepsPanel =
    steps.length > 0 ? (
      <div
        className="voice-steps-panel"
        style={{
          padding: "8px 12px",
          margin: "4px 8px",
          background: "var(--copilotkit-background-color, hsl(0 0% 96%))",
          borderRadius: "8px",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 500,
            marginBottom: "4px",
          }}
        >
          {voiceState !== "idle" ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          ) : steps.some((s) => s.status === "error") ? (
            <AlertCircle className="h-3 w-3 text-red-500" />
          ) : (
            <CheckCircle className="h-3 w-3 text-emerald-600" />
          )}
          <span>Voice-to-Text</span>
        </div>
        <div style={{ marginLeft: "20px", opacity: 0.8 }}>
          {steps.map((s) => (
            <div
              key={s.name}
              style={{ display: "flex", alignItems: "center", gap: "4px", lineHeight: "1.6" }}
            >
              {stepIcon(s.status)}
              <span>
                <strong>{s.name}</strong>
                {s.detail ? `: ${s.detail}` : ""}
              </span>
            </div>
          ))}
        </div>
        {transcribedText && (
          <div
            style={{
              marginLeft: "20px",
              marginTop: "6px",
              padding: "6px 10px",
              background: "hsl(142 76% 95%)",
              border: "1px solid hsl(142 76% 80%)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 500,
                color: "hsl(142 76% 30%)",
                marginBottom: "2px",
              }}
            >
              Transcribed:
            </div>
            <div style={{ fontWeight: 600, color: "hsl(142 76% 20%)" }}>
              &ldquo;{transcribedText}&rdquo;
            </div>
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              marginLeft: "20px",
              marginTop: "6px",
              padding: "6px 10px",
              background: "hsl(0 84% 95%)",
              border: "1px solid hsl(0 84% 80%)",
              borderRadius: "6px",
              color: "hsl(0 84% 35%)",
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      {portalTarget && createPortal(micButton, portalTarget)}
      {stepsTarget && stepsPanel && createPortal(stepsPanel, stepsTarget)}
    </>
  );
}
