// Imports the internal module directly, NOT "pdf-parse" itself: that
// package's index.js has a notorious "debug mode" footgun — when
// `!module.parent` (true for how Next.js's webpack wraps server modules,
// unlike a plain Node require), it synchronously reads a test PDF from
// its own package directory at import time. That throw happens at module
// load, before any request handler runs, and Next's dev server surfaces
// it as a bare 404 on the route instead of a 500 with the real error —
// which is exactly what made this look like an unrelated routing bug
// while wiring this feature up. Importing the inner file skips that
// wrapper entirely.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import * as mammoth from "mammoth";
import type { OpenAiContentPart } from "@shina/ai-gateway";

// Shinã Agent attachments (image/document) — client sends small files
// base64-encoded inline in the JSON body (no upload/storage bucket), the
// same "never persisted" posture as the voice transcription route: bytes
// are decoded, used to build the model input, and discarded when this
// module call returns — nothing is written to disk or Supabase Storage.
//
// Images go straight through as OpenAI vision content parts (gpt-4o-mini
// is vision-capable). Documents (PDF/DOCX/TXT) have no native chat-input
// path on OpenAI the way Anthropic supports PDFs, so their text is
// extracted server-side and appended to the query as plain text instead.

export interface AgentAttachmentInput {
  name: string;
  mimeType: string;
  /** Raw base64, no "data:...;base64," prefix. */
  dataBase64: string;
}

export class AttachmentError extends Error {}

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB raw per file
const MAX_EXTRACTED_TEXT_CHARS = 20_000; // bounds cost/context per document

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export interface ProcessedAttachments {
  imageParts: OpenAiContentPart[];
  /** Extracted document text, pre-formatted and ready to append to the
   * user's query text — null when no document attachments were sent. */
  documentText: string | null;
  meta: { count: number; types: string[]; totalBytes: number };
}

export async function processAttachments(
  attachments: AgentAttachmentInput[] | undefined,
): Promise<ProcessedAttachments> {
  if (!attachments || attachments.length === 0) {
    return { imageParts: [], documentText: null, meta: { count: 0, types: [], totalBytes: 0 } };
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new AttachmentError(`Máximo de ${MAX_ATTACHMENTS} anexos por mensagem.`);
  }

  const imageParts: OpenAiContentPart[] = [];
  const documentTexts: string[] = [];
  const types: string[] = [];
  let totalBytes = 0;

  for (const att of attachments) {
    const buffer = Buffer.from(att.dataBase64, "base64");
    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentError(
        `"${att.name}" excede o limite de ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
      );
    }
    if (buffer.byteLength === 0) {
      throw new AttachmentError(`"${att.name}" está vazio.`);
    }
    totalBytes += buffer.byteLength;
    types.push(att.mimeType);

    if (IMAGE_MIME_TYPES.has(att.mimeType)) {
      imageParts.push({
        type: "image_url",
        image_url: { url: `data:${att.mimeType};base64,${att.dataBase64}` },
      });
      continue;
    }

    if (!DOCUMENT_MIME_TYPES.has(att.mimeType)) {
      throw new AttachmentError(
        `Tipo de arquivo não suportado: "${att.name}" (${att.mimeType}). Envie imagem (PNG/JPEG/WEBP), PDF, DOCX ou TXT.`,
      );
    }

    let text: string;
    try {
      if (att.mimeType === "application/pdf") {
        text = (await pdfParse(buffer)).text;
      } else if (att.mimeType === "text/plain") {
        text = buffer.toString("utf-8");
      } else {
        text = (await mammoth.extractRawText({ buffer })).value;
      }
    } catch {
      throw new AttachmentError(`Não foi possível ler o conteúdo de "${att.name}".`);
    }

    const trimmed = text.trim();
    const truncated = trimmed.length > MAX_EXTRACTED_TEXT_CHARS;
    const excerpt = truncated
      ? `${trimmed.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n[...texto truncado...]`
      : trimmed;
    documentTexts.push(`--- Documento anexado: "${att.name}" ---\n${excerpt}`);
  }

  return {
    imageParts,
    documentText: documentTexts.length > 0 ? documentTexts.join("\n\n") : null,
    meta: { count: attachments.length, types, totalBytes },
  };
}
