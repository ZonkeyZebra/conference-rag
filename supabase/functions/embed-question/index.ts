import { verifySupabaseUser } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

const embeddingModel = "text-embedding-3-small";
const embeddingDimensions = 1536;

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  const headers = corsHeaders(request.headers.get("Origin"));
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin");

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse(request, { error: "Origin is not allowed" }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  const auth = await verifySupabaseUser(request);
  if (!auth.authenticated) {
    return jsonResponse(request, { error: auth.error }, auth.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Request body must be valid JSON" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("question" in body) ||
    typeof body.question !== "string" ||
    !body.question.trim()
  ) {
    return jsonResponse(
      request,
      { error: 'Request body must include a non-empty "question" string' },
      400,
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY environment variable");
    return jsonResponse(request, { error: "Embedding service is not configured" }, 500);
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: body.question.trim(),
        dimensions: embeddingDimensions,
      }),
    });
  } catch (error) {
    console.error("OpenAI embedding request failed:", error);
    return jsonResponse(request, { error: "Embedding service is unavailable" }, 502);
  }

  if (!response.ok) {
    console.error(`OpenAI embeddings API returned HTTP ${response.status}`);
    return jsonResponse(request, { error: "Could not generate embedding" }, 502);
  }

  let embedding: unknown;
  try {
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("data" in result) ||
      !Array.isArray(result.data) ||
      typeof result.data[0] !== "object" ||
      result.data[0] === null ||
      !("embedding" in result.data[0])
    ) {
      throw new Error("OpenAI response did not contain an embedding");
    }
    embedding = result.data[0].embedding;
  } catch (error) {
    console.error("Invalid OpenAI embeddings response:", error);
    return jsonResponse(request, { error: "Could not generate embedding" }, 502);
  }

  if (
    !Array.isArray(embedding) ||
    embedding.length !== embeddingDimensions ||
    !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    console.error("OpenAI returned an embedding with an unexpected shape");
    return jsonResponse(request, { error: "Could not generate embedding" }, 502);
  }

  return jsonResponse(request, { embedding });
});
