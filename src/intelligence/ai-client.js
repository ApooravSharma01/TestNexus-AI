import { AppError } from "../utils/app-error.js";

export async function completeWithAi(prompt, { apiKey, model, baseUrl, fetchImpl = fetch }) {
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You help select regression tests. Reply with JSON only: {\"explanation\": string, \"additionalTestIds\": string[]}. Add a test only when the change can affect it. Do not invent test ids."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new AppError("AI request failed", response.status || 502, "AI_REQUEST_FAILED");
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new AppError("AI response did not include a message", 502, "AI_RESPONSE_INVALID");
  }

  return content;
}
