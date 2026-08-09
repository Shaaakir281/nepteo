import {
  CREATIVE_IMAGE_FORMATS,
  type CreativeImageFormat,
} from "./creative-image-rules.ts";

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { code?: string; message?: string; type?: string };
}

export type ImageGenerationFailure =
  | "configuration"
  | "moderation"
  | "quota"
  | "provider"
  | "storage"
  | "invalid_response";

export class ImageGenerationError extends Error {
  public readonly reason: ImageGenerationFailure;
  public readonly status: number;

  constructor(
    reason: ImageGenerationFailure,
    message: string,
    status = 502,
  ) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

export async function generateOpenAIImage(input: {
  prompt: string;
  format: CreativeImageFormat;
}): Promise<{ base64: string; mimeType: "image/jpeg"; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ImageGenerationError(
      "configuration",
      "La génération d'image n'est pas encore configurée.",
      503,
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const requestedSize = CREATIVE_IMAGE_FORMATS[input.format].size;
  const size = model.startsWith("gpt-image-2")
    ? requestedSize
    : input.format === "square"
      ? "1024x1024"
      : input.format === "landscape"
        ? "1536x1024"
        : "1024x1536";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      n: 1,
      size,
      quality: "medium",
      output_format: "jpeg",
      output_compression: 86,
      moderation: "auto",
    }),
    signal: AbortSignal.timeout(125_000),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIImageResponse;
  if (!response.ok) {
    const code = payload.error?.code;
    if (code === "moderation_blocked") {
      throw new ImageGenerationError(
        "moderation",
        "Ce visuel ne peut pas être généré. Reformulez le message de façon plus neutre.",
        400,
      );
    }
    if (response.status === 429) {
      throw new ImageGenerationError(
        "quota",
        "Le studio est très sollicité. Réessayez dans un instant.",
        429,
      );
    }
    throw new ImageGenerationError(
      "provider",
      "OpenAI n'a pas pu créer le visuel. Réessayez.",
      502,
    );
  }

  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) {
    throw new ImageGenerationError(
      "invalid_response",
      "Le visuel reçu est incomplet. Réessayez.",
      502,
    );
  }

  return { base64, mimeType: "image/jpeg", model };
}
