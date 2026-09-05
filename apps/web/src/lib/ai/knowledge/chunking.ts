// Simple fixed-size chunker with overlap — no sentence/semantic boundary
// detection, deliberately: Wave 5's first cut only needs "good enough"
// chunks for cosine similarity search, not a production-grade splitter.
// Overlap keeps a fact that straddles a chunk boundary retrievable from
// either neighboring chunk.
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_DOCUMENT = 200;

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const end = Math.min(start + CHUNK_SIZE, trimmed.length);
    chunks.push(trimmed.slice(start, end).trim());
    if (end >= trimmed.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}
