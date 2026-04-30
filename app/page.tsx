"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { personas } from "@/lib/personas";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "framer-motion";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  createdAt: string;
};

type ModelId = "gemini-2.5-flash" | "gemini-3-flash-preview";

const storageKey = (personaId: string) => `persona-chat:${personaId}`;

const hasMarkdown = (text: string) =>
  /(^|\n)#{1,6}\s|\*\*[^*]+\*\*|`[^`]+`|```/.test(text);

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
  const personaMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
  const [modelId, setModelId] = useState<ModelId>("gemini-2.5-flash");

  const modelOptions: Array<{ id: ModelId; label: string }> = [
    { id: "gemini-2.5-flash", label: "2.5" },
    { id: "gemini-3-flash-preview", label: "3" },
  ];

  const suggestionsContainerMotion = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { delayChildren: 0.06, staggerChildren: 0.08 },
    },
  } as const;

  const suggestionItemMotion = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  } as const;

  const messageListMotion = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.05 },
    },
    exit: {
      opacity: 0,
      transition: { staggerChildren: 0.04, staggerDirection: -1 },
    },
  } as const;

  const messageItemMotion = {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      y: 8,
      transition: { duration: 0.15, ease: "easeIn" },
    },
  } as const;

  const personaMenuMotion = {
    hidden: { opacity: 0, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.18, ease: "easeOut", staggerChildren: 0.08 },
    },
    exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.15 } },
  } as const;

  const personaItemMotion = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  } as const;

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
    if (!isPersonaMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (personaMenuRef.current?.contains(target)) return;
      setIsPersonaMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isPersonaMenuOpen]);

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
    setIsPersonaMenuOpen(false);
  };

  const handleClearChat = () => {
    if (typeof window === "undefined") return;
    if (messages.length > 0) {
      const confirmed = window.confirm(
        "Clear this chat? This will remove the conversation for this persona.",
      );
      if (!confirmed) return;
    }
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
          model: modelId,
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
        reason?: string;
      };

      if (!response.ok) {
        const errorLabel =
          typeof data.error === "string" ? data.error : "Request failed";
        const reason =
          typeof data.reason === "string" ? data.reason : "Unknown";
        const message = reason ? `${errorLabel}: ${reason}` : errorLabel;

        console.error("Chat request failed.", {
          status: response.status,
          error: data,
        });

        throw new Error(message);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat request error.", error);
      const message =
        error instanceof Error && error.message.startsWith("Request failed")
          ? error.message
          : "Request failed: Network error";

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "error",
        content: message,
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
    <div className="flex min-h-screen flex-col bg-transparent text-chat-ink">
      <motion.header
        className="border-b border-black/10 bg-white/70 backdrop-blur"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between relative">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-chat-muted">
              Active persona
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight truncate">
              {activePersona.name}
            </h1>
            <div className="mt-3 flex items-center justify-between gap-2 sm:gap-8">
              <div className="relative flex" ref={personaMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPersonaMenuOpen((prev) => !prev)}
                  className="flex justify-between items-center gap-2 rounded-full border border-chat-ink bg-chat-ink min-w-48 px-4 py-2 text-base text-white transition"
                  aria-haspopup="listbox"
                  aria-expanded={isPersonaMenuOpen}
                >
                  <span className="truncate">{activePersona.name}</span>
                  <div className="">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </button>
                <AnimatePresence>
                  {isPersonaMenuOpen ? (
                    <motion.div
                      className="absolute left-0 top-full z-20 mt-2 flex w-56 flex-col gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
                      variants={personaMenuMotion}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                    >
                      {personas.map((persona) => {
                        const isActive = persona.id === activePersonaId;
                        return (
                          <motion.button
                            key={persona.id}
                            type="button"
                            onClick={() => handlePersonaChange(persona.id)}
                            className={`flex w-full items-center justify-between rounded-full border px-4 py-2 text-base transition ${
                              isActive
                                ? "border-chat-ink bg-chat-ink text-white"
                                : "border-black/10 bg-white text-chat-muted hover:border-black/30 hover:text-chat-ink"
                            }`}
                            variants={personaItemMotion}
                          >
                            {persona.name}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2">
                <span className="sr-only">Gemini</span>
                <Image
                  src="/gemini_icon.svg"
                  alt="Gemini"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
                <div className="relative flex rounded-full border border-chat-ink bg-chat-ink p-1 shadow-sm">
                  {modelOptions.map((option) => {
                    const isActive = option.id === modelId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setModelId(option.id)}
                        className="relative flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold"
                      >
                        {isActive ? (
                          <motion.span
                            layoutId="model-toggle"
                            className="absolute inset-0 rounded-full bg-white"
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 35,
                            }}
                          />
                        ) : null}
                        <span
                          className={`relative z-10 ${
                            isActive ? "text-chat-ink" : "text-white"
                          }`}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length === 0 || isLoading}
            className="absolute right-6 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-red/10 bg-red-200 text-red-600 transition hover:border-red-700 hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:static sm:ml-auto"
          >
            <span className="sr-only">Clear chat</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16" />
              <path d="M9 7V5h6v2" />
              <path d="M7 7l1 12h8l1-12" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          </button>
        </div>
      </motion.header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-0 pb-10 pt-6 sm:px-6">
        <section className="w-full rounded-none border border-black/10 bg-white/80 px-5 py-4 sm:rounded-3xl">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-chat-muted">
              Suggestions
            </p>
            <button
              type="button"
              onClick={() => setIsSuggestionsOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 text-xs font-medium text-chat-muted transition hover:text-chat-ink"
              aria-expanded={isSuggestionsOpen}
            >
              {isSuggestionsOpen ? "Collapse" : "Expand"}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition ${
                  isSuggestionsOpen ? "rotate-180" : "rotate-0"
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
          <AnimatePresence>
            {isSuggestionsOpen ? (
              <motion.div
                key="suggestions"
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              >
                {activePersona.suggestions.length === 0 ? (
                  <p className="mt-2 text-sm text-chat-muted">
                    Suggestions will appear here once you add them.
                  </p>
                ) : (
                  <motion.div
                    className="mt-3 flex flex-wrap gap-2"
                    variants={suggestionsContainerMotion}
                    initial="hidden"
                    animate="show"
                  >
                    {activePersona.suggestions.map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="max-w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-chat-ink transition hover:border-black/30 sm:max-w-[240px]"
                        title={suggestion}
                        variants={suggestionItemMotion}
                      >
                        <span className="block truncate">{suggestion}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <motion.section
          className="flex min-h-[55vh] w-full flex-1 flex-col rounded-none border border-black/10 bg-white/80 sm:rounded-3xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
        >
          <div
            ref={transcriptRef}
            className="flex-1 space-y-6 overflow-y-auto px-5 py-6"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-sm text-chat-muted">
                Start a conversation with {activePersona.name}.
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePersonaId}
                  className="space-y-6"
                  variants={messageListMotion}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    const isError = message.role === "error";

                    return (
                      <motion.div
                        key={message.id}
                        className={`flex flex-col gap-1 ${
                          isUser ? "items-end" : "items-start"
                        }`}
                        variants={messageItemMotion}
                      >
                        <div
                          className={`sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm max-w-full ${
                            isUser
                              ? "bg-chat-ink text-white"
                              : isError
                                ? "border border-red-200 bg-red-50 text-red-700"
                                : "bg-chat-bubble text-chat-ink"
                          }`}
                        >
                          {message.role === "assistant" &&
                          hasMarkdown(message.content) ? (
                            <ReactMarkdown
                              className="space-y-2 text-sm leading-6"
                              components={{
                                h1: ({ children }) => (
                                  <h1 className="text-base font-semibold">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-sm font-semibold">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-sm font-semibold">
                                    {children}
                                  </h3>
                                ),
                                p: ({ children }) => (
                                  <p className="whitespace-pre-wrap">
                                    {children}
                                  </p>
                                ),
                                pre: ({ children }) => (
                                  <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs">
                                    {children}
                                  </pre>
                                ),
                                code: ({ children, className }) => (
                                  <code
                                    className={
                                      className
                                        ? "font-mono text-xs"
                                        : "rounded bg-black/5 px-1 py-0.5 font-mono text-xs"
                                    }
                                  >
                                    {children}
                                  </code>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold">
                                    {children}
                                  </strong>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          ) : (
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-chat-muted">
                          {formatTime(message.createdAt)}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-chat-ink px-6 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-12 sm:px-0"
              >
                <span className="sr-only">Send</span>
                {!isLoading ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 11l17-7-7 17-2-7-8-3z" />
                    <path d="M11 13l6-6" />
                  </svg>
                ) : (
                  <div className="">...</div>
                )}
                <span className="sm:hidden">
                  {isLoading ? "Sending" : "Send"}
                </span>
              </button>
            </div>
            <p className="mt-3 hidden text-xs text-chat-muted sm:block">
              Press Enter to send, Shift + Enter for a new line.
            </p>
          </form>
        </motion.section>
      </main>
    </div>
  );
}
