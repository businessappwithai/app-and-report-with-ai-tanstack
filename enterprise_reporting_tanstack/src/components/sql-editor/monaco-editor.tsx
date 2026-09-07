"use client";

import Editor, { type OnChange, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useRef } from "react";
import type { SchemaInfo } from "@/types/api";

interface MonacoSQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  schema?: SchemaInfo | null;
}

function MonacoSQLEditorComponent({
  value,
  onChange,
  onExecute,
  readOnly: _readOnly, // Unused - editor is always editable
  height = "400px",
  className,
}: MonacoSQLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { theme } = useTheme();

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // DEBUG: Log to verify this code runs
      console.log("[Monaco Editor] Mounting - forcing editable mode");

      // Force editor to be editable (ignore readOnly prop)
      editor.updateOptions({
        readOnly: false, // Always false, never readonly
        domReadOnly: false,
        contextmenu: true,
      });

      // Verify the options were set
      const options = editor.getOptions();
      console.log(
        "[Monaco Editor] readOnly option:",
        options.get(monaco.editor.EditorOption.readOnly)
      );
      console.log(
        "[Monaco Editor] domReadOnly option:",
        options.get(monaco.editor.EditorOption.domReadOnly)
      );

      // Add keyboard shortcut for execute (Ctrl/Cmd + Enter)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecute?.();
      });

      // Add keyboard shortcut for format (Shift + Alt + F)
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction("editor.action.formatDocument")?.run();
      });
    },
    [onExecute]
  );

  const handleChange: OnChange = useCallback(
    (value) => {
      onChange(value || "");
    },
    [onChange]
  );

  // Force textarea to be editable and ensure pointer events work (monaco-editor workaround)
  useEffect(() => {
    const timer = setTimeout(() => {
      const monacoContainer = document.querySelector(".monaco-editor");
      const textarea = document.querySelector(".monaco-editor textarea");

      if (monacoContainer && textarea) {
        console.log("[Monaco Editor] Fixing z-index and input blocking...");

        // CRITICAL FIX: Bring textarea to front (z-index: -10 is wrong!)
        (textarea as HTMLTextAreaElement).style.zIndex = "1";
        console.log("[Monaco Editor] Set textarea z-index to 1");

        // Remove readonly
        (textarea as HTMLTextAreaElement).readOnly = false;
        (textarea as HTMLTextAreaElement).removeAttribute("readonly");
        console.log("[Monaco Editor] Removed readonly");

        // Remove aria-hidden
        textarea.removeAttribute("aria-hidden");
        console.log("[Monaco Editor] Removed aria-hidden");

        // Ensure pointer events are enabled
        const overflowGuard = monacoContainer.querySelector(".overflow-guard");
        if (overflowGuard) {
          (overflowGuard as HTMLElement).style.pointerEvents = "auto";
        }

        const viewLines = monacoContainer.querySelector(".view-lines");
        if (viewLines) {
          (viewLines as HTMLElement).style.pointerEvents = "auto";
        }

        // Focus the textarea
        (textarea as HTMLTextAreaElement).focus();
        console.log("[Monaco Editor] Focused textarea");
        console.log("[Monaco Editor] ✓ ALL FIXES APPLIED - TRY TYPING NOW!");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={className}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        zIndex: 9999,
        pointerEvents: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Editor
        height={typeof height === "number" ? height : parseInt(height as string, 10)}
        language="sql"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          readOnly: false,
          domReadOnly: false,
          minimap: { enabled: false },
          lineNumbers: "on",
          folding: true,
          autoIndent: "full",
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          wordBasedSuggestions: "off",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          fontSize: 14,
          fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
      />
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const MonacoSQLEditor = memo(MonacoSQLEditorComponent, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.onExecute === nextProps.onExecute &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.height === nextProps.height &&
    prevProps.className === nextProps.className
  );
});
