import { personas } from "@/lib/personas";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  personaId?: string;
  messages?: ClientMessage[];
};

const classifyReason = (message: string | undefined, status: number) => {
  const text = message?.toLowerCase() ?? "";

  if (
    status === 429 ||
    text.includes("quota") ||
    text.includes("resource_exhausted")
  ) {
    return "Quota exceeded";
  }

  if (
    status === 503 ||
    text.includes("overloaded") ||
    text.includes("unavailable") ||
    text.includes("busy")
  ) {
    return "Model congested";
  }

  if (status >= 400 && status < 500) {
    return "Bad request";
  }

  return "Server error";
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return Response.json(
      { error: "Request failed", reason: "Configuration error" },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    console.error("Invalid JSON body.");
    return Response.json(
      { error: "Request failed", reason: "Bad request" },
      { status: 400 },
    );
  }

  const personaId = body.personaId ?? "";
  const persona = personas.find((item) => item.id === personaId);

  if (!persona) {
    console.error("Unknown persona.");
    return Response.json(
      { error: "Request failed", reason: "Bad request" },
      { status: 400 },
    );
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
    console.error("Message list is empty.");
    return Response.json(
      { error: "Request failed", reason: "Bad request" },
      { status: 400 },
    );
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

  //! MODEL ID HERE
  const model = "gemini-2.5-flash";
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
  } catch (error) {
    console.error("Failed to reach the Gemini API.", error);
    return Response.json(
      { error: "Request failed", reason: "Network error" },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Unexpected response from Gemini API.", error);
    return Response.json(
      { error: "Request failed", reason: "Server error" },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const message =
      typeof (data as { error?: { message?: string } })?.error?.message ===
      "string"
        ? (data as { error?: { message?: string } }).error?.message
        : "Gemini API returned an error.";

    console.error("Gemini API error.", {
      status: response.status,
      message,
      data,
    });

    const reason = classifyReason(message, response.status);

    return Response.json(
      { error: "Request failed", reason },
      { status: response.status },
    );
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
    console.error("Gemini API returned an empty response.");
    return Response.json(
      { error: "Request failed", reason: "Server error" },
      { status: 502 },
    );
  }

  return Response.json({ message: text });
}
