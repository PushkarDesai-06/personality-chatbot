"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { personas } from "@/lib/personas";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  createdAt: string;
};

const storageKey = (personaId: string) => `persona-chat:${personaId}`;

const formatTime = (isoTime: string) =>
  new Date(isoTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Home() {
  const [activePersonaId, setActivePersonaId] = useState(personas[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const skipNextSaveRef = useRef(false);

  const activePersona = useMemo(
    () =>
      personas.find((persona) => persona.id === activePersonaId) ?? personas[0],
    [activePersonaId],
  );

  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    skipNextSaveRef.current = true;
    const stored = window.localStorage.getItem(storageKey(activePersonaId));
    if (!stored) {
      setMessages([]);
      setInput("");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ChatMessage[];
      setMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMessages([]);
    }

    setInput("");
  }, [activePersonaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    window.localStorage.setItem(
      storageKey(activePersonaId),
      JSON.stringify(messages),
    );
  }, [activePersonaId, messages]);

  const handlePersonaChange = (personaId: (typeof personas)[number]["id"]) => {
    setActivePersonaId(personaId);
  };

  const handleClearChat = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey(activePersonaId));
    setMessages([]);
    setInput("");
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: activePersona.id,
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "error",
        content:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-chat-surface text-chat-ink">
      <header className="border-b border-black/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-chat-muted">
              Active persona
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {activePersona.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {personas.map((persona) => {
              const isActive = persona.id === activePersonaId;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => handlePersonaChange(persona.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isActive
                      ? "border-chat-ink bg-chat-ink text-white"
                      : "border-black/10 bg-white text-chat-muted hover:border-black/30 hover:text-chat-ink"
                  }`}
                >
                  {persona.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleClearChat}
              disabled={messages.length === 0 || isLoading}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-chat-muted transition hover:border-black/30 hover:text-chat-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear chat
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-6">
        <section className="rounded-3xl border border-black/10 bg-white/80 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-chat-muted">
            Suggestions
          </p>
          {activePersona.suggestions.length === 0 ? (
            <p className="mt-2 text-sm text-chat-muted">
              Suggestions will appear here once you add them.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activePersona.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-chat-ink transition hover:border-black/30"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex min-h-[55vh] flex-1 flex-col rounded-3xl border border-black/10 bg-white/80">
          <div
            ref={transcriptRef}
            className="flex-1 space-y-6 overflow-y-auto px-5 py-6"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-sm text-chat-muted">
                Start a conversation with {activePersona.name}.
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                const isError = message.role === "error";

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-1 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        isUser
                          ? "bg-chat-ink text-white"
                          : isError
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : "bg-chat-bubble text-chat-ink"
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="text-xs text-chat-muted">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                );
              })
            )}

            {isLoading ? (
              <div className="flex items-start">
                <div className="rounded-2xl bg-chat-bubble px-4 py-3 text-sm text-chat-muted">
                  <span className="typing-dots" aria-label="Typing" />
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="border-t border-black/10 px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="sr-only">Message</span>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder={`Message ${activePersona.name}...`}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-chat-ink outline-none transition focus:border-black/40"
                />
              </label>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="inline-flex h-12 items-center justify-center rounded-full bg-chat-ink px-6 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
            </div>
            <p className="mt-3 text-xs text-chat-muted">
              Press Enter to send, Shift + Enter for a new line.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
