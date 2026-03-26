interface ChunkDocType {
  chunkStrategy: 'header' | 'recursive' | 'hierarchical';
  chunkSize: number;
  chunkOverlap: number;
}

export interface Chunk {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  createdAt: string;
}

const AVG_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

function chunkByHeaders(content: string, docType: ChunkDocType): Chunk[] {
  const sections = content.split(/^#{1,3}\s/m).filter(Boolean);
  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    const maxChars = docType.chunkSize * AVG_CHARS_PER_TOKEN;
    const overlapChars = Math.floor(maxChars * (docType.chunkOverlap / 100));
    let start = 0;
    while (start < section.length) {
      const end = Math.min(start + maxChars, section.length);
      const chunkText = section.slice(start, end).trim();
      if (chunkText) {
        chunks.push({ id: globalThis.crypto.randomUUID(), chunkIndex: index++, content: chunkText, tokenCount: estimateTokens(chunkText), createdAt: new Date().toISOString() });
      }
      const newStart = end - overlapChars;
      if (newStart <= start) break; // guard: never loop in place
      start = newStart;
    }
  }
  return chunks;
}

function chunkRecursive(content: string, docType: ChunkDocType): Chunk[] {
  const maxChars = docType.chunkSize * AVG_CHARS_PER_TOKEN;
  const overlapChars = Math.floor(maxChars * (docType.chunkOverlap / 100));
  const chunks: Chunk[] = [];
  let index = 0;
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + maxChars, content.length);
    const chunkText = content.slice(start, end).trim();
    if (chunkText) {
      chunks.push({ id: globalThis.crypto.randomUUID(), chunkIndex: index++, content: chunkText, tokenCount: estimateTokens(chunkText), createdAt: new Date().toISOString() });
    }
    const newStart = end - overlapChars;
    if (newStart <= start) break; // guard: never loop in place
    start = newStart;
  }
  return chunks;
}

function chunkHierarchical(content: string, docType: ChunkDocType): Chunk[] {
  const summaryLines = content.split('\n').slice(0, 10);
  const summary = summaryLines.join('\n');
  const steps = content.split(/^\d+\.\s|^-\s|^\*\s/m).filter(Boolean);
  const chunks: Chunk[] = [];
  let index = 0;

  chunks.push({ id: globalThis.crypto.randomUUID(), chunkIndex: index++, content: summary.trim(), tokenCount: estimateTokens(summary), createdAt: new Date().toISOString() });

  for (const step of steps) {
    const chunkText = step.slice(0, docType.chunkSize * AVG_CHARS_PER_TOKEN).trim();
    if (chunkText) {
      chunks.push({ id: globalThis.crypto.randomUUID(), chunkIndex: index++, content: chunkText, tokenCount: estimateTokens(chunkText), createdAt: new Date().toISOString() });
    }
  }
  return chunks;
}

export function chunkDocument(content: string, docType: ChunkDocType): Chunk[] {
  switch (docType.chunkStrategy) {
    case 'header': return chunkByHeaders(content, docType);
    case 'recursive': return chunkRecursive(content, docType);
    case 'hierarchical': return chunkHierarchical(content, docType);
    default: return chunkRecursive(content, docType);
  }
}
