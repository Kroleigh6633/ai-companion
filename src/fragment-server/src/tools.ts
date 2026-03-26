import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { DocumentType, Document } from '@ai-companion/types';
import { execute, query, blobWrite, blobRead, makeBlobPath, createLogger } from '@ai-companion/utils';
import { chunkDocument } from './chunker.js';
import { BUILT_IN_DOCUMENT_TYPES } from './document-types.js';
import { randomUUID } from 'crypto';

const log = createLogger('fragment-server');

let _docTypes: DocumentType[] | null = null;

async function getDocumentTypes(): Promise<DocumentType[]> {
  if (_docTypes) return _docTypes;
  try {
    const rows = await query<DocumentType[]>(
      'SELECT id, name, description, templatePath, chunkStrategy, chunkSize, chunkOverlap, createdAt FROM DocumentTypes'
    );
    _docTypes = rows.length > 0 ? rows : BUILT_IN_DOCUMENT_TYPES;
  } catch {
    _docTypes = BUILT_IN_DOCUMENT_TYPES;
  }
  return _docTypes;
}

async function createDocument(args: Record<string, unknown>): Promise<CallToolResult> {
  const { typeId, title, content, tags } = args as {
    typeId: string; title: string; content: string; tags?: string[];
  };

  const docTypes = await getDocumentTypes();
  const docType = docTypes.find((t) => t.id === typeId);
  if (!docType) {
    return { content: [{ type: 'text', text: `Unknown document type: ${typeId}` }], isError: true };
  }

  const id = randomUUID();
  const contentPath = makeBlobPath('Documents', id, 'content', 'md');
  const filePath = `pas/docs/${typeId}/${id}.md`;

  blobWrite(contentPath, content);

  await execute(
    `INSERT INTO Documents (id, typeId, title, contentPath, filePath, tags, createdAt, updatedAt)
     VALUES (@id, @typeId, @title, @contentPath, @filePath, @tags, GETUTCDATE(), GETUTCDATE())`,
    { id, typeId, title, contentPath, filePath, tags: JSON.stringify(tags ?? []) }
  );

  const chunks = chunkDocument(content, docType);
  for (const chunk of chunks) {
    await execute(
      `INSERT INTO DocumentChunks (id, documentId, content, chunkIndex, tokenCount, createdAt)
       VALUES (@id, @documentId, @content, @chunkIndex, @tokenCount, GETUTCDATE())`,
      { id: chunk.id, documentId: id, content: chunk.content, chunkIndex: chunk.chunkIndex, tokenCount: chunk.tokenCount }
    );
  }

  log.info(`Created document: ${id}`, { typeId, title, chunks: chunks.length });
  return { content: [{ type: 'text', text: JSON.stringify({ id, title, typeId, chunks: chunks.length }) }] };
}

async function getDocument(args: Record<string, unknown>): Promise<CallToolResult> {
  const { id } = args as { id: string };
  const rows = await query<Document[]>('SELECT * FROM Documents WHERE id = @id', { id });
  if (!rows.length) {
    return { content: [{ type: 'text', text: `Document not found: ${id}` }], isError: true };
  }
  const doc = rows[0];
  const content = blobRead(doc.contentPath);
  return { content: [{ type: 'text', text: JSON.stringify({ ...doc, content }) }] };
}

async function searchDocuments(args: Record<string, unknown>): Promise<CallToolResult> {
  const { query: searchQuery, typeId, limit = 10 } = args as {
    query: string; typeId?: string; limit?: number;
  };
  const typeFilter = typeId ? 'AND d.typeId = @typeId' : '';
  const rows = await query(
    `SELECT TOP (@limit) dc.id, dc.documentId, dc.content, dc.chunkIndex,
            d.title, d.typeId, d.filePath
     FROM DocumentChunks dc
     JOIN Documents d ON dc.documentId = d.id
     WHERE dc.content LIKE @pattern ${typeFilter}
     ORDER BY dc.chunkIndex`,
    { limit, pattern: `%${searchQuery}%`, ...(typeId ? { typeId } : {}) }
  );
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
}

async function addDocumentType(args: Record<string, unknown>): Promise<CallToolResult> {
  const dt = args as DocumentType;
  dt.createdAt = new Date().toISOString();
  await execute(
    `INSERT INTO DocumentTypes (id, name, description, templatePath, chunkStrategy, chunkSize, chunkOverlap, createdAt)
     VALUES (@id, @name, @description, @templatePath, @chunkStrategy, @chunkSize, @chunkOverlap, GETUTCDATE())`,
    dt as unknown as Record<string, unknown>
  );
  _docTypes = null; // invalidate cache
  log.info(`Added document type: ${dt.id}`);
  return { content: [{ type: 'text', text: JSON.stringify(dt) }] };
}

async function listDocumentTypes(_args: Record<string, unknown>): Promise<CallToolResult> {
  const types = await getDocumentTypes();
  return { content: [{ type: 'text', text: JSON.stringify(types) }] };
}

export const TOOLS: Tool[] = [
  {
    name: 'create_document',
    description: 'Create a new document fragment (ADR, pattern, gotcha, runbook, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        typeId: { type: 'string', description: 'Document type ID (adr, pattern, gotcha, runbook, or custom)' },
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Full markdown content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['typeId', 'title', 'content'],
    },
  },
  {
    name: 'get_document',
    description: 'Retrieve a document by ID including its full content',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Document UUID' } },
      required: ['id'],
    },
  },
  {
    name: 'search_documents',
    description: 'Search document chunks by keyword (use semantic_search for embedding-based search)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        typeId: { type: 'string', description: 'Filter by document type' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_document_type',
    description: 'Register a new document type in the registry',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        templatePath: { type: 'string' },
        chunkStrategy: { type: 'string', enum: ['header', 'recursive', 'hierarchical'] },
        chunkSize: { type: 'number' },
        chunkOverlap: { type: 'number' },
      },
      required: ['id', 'name', 'description', 'templatePath', 'chunkStrategy', 'chunkSize', 'chunkOverlap'],
    },
  },
  {
    name: 'list_document_types',
    description: 'List all registered document types',
    inputSchema: { type: 'object', properties: {} },
  },
];

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult>> = {
  create_document: createDocument,
  get_document: getDocument,
  search_documents: searchDocuments,
  add_document_type: addDocumentType,
  list_document_types: listDocumentTypes,
};

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(args);
}
