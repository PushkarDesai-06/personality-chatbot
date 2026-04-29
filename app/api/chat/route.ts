import { personas } from "@/lib/personas";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  personaId?: string;
  messages?: ClientMessage[];
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY environment variable." },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const personaId = body.personaId ?? "";
  const persona = personas.find((item) => item.id === personaId);

  if (!persona) {
    return Response.json({ error: "Unknown persona." }, { status: 400 });
  }

  const inputMessages = Array.isArray(body.messages) ? body.messages : [];
  const sanitizedMessages = inputMessages
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);

  if (sanitizedMessages.length === 0) {
    return Response.json({ error: "Message list is empty." }, { status: 400 });
  }

  const contents = sanitizedMessages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const payload: Record<string, unknown> = { contents };
  const systemPrompt = persona.systemPrompt.trim();

  if (systemPrompt.length > 0) {
    payload.systemInstruction = {
      role: "system",
      parts: [{ text: systemPrompt }],
    };
  }

  const model = "gemini-3-flash-preview";
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Failed to reach the Gemini API." },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return Response.json(
      { error: "Unexpected response from Gemini API." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const message =
      typeof (data as { error?: { message?: string } })?.error?.message ===
      "string"
        ? (data as { error?: { message?: string } }).error?.message
        : "Gemini API returned an error.";

    return Response.json({ error: message }, { status: response.status });
  }

  const candidateText =
    (
      data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }
    )?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";

  const text = candidateText.trim();

  if (!text) {
    return Response.json(
      { error: "Gemini API returned an empty response." },
      { status: 502 },
    );
  }

  return Response.json({ message: text });
}
