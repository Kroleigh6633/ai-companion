export type ChunkStrategy = 'header' | 'recursive' | 'hierarchical';

export interface DocumentType {
  id: string;
  name: string;
  description: string;
  templatePath: string;
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  createdAt: string;
}

export interface Document {
  id: string;
  typeId: string;
  title: string;
  contentPath: string;
  filePath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding?: number[];
  createdAt: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
}
