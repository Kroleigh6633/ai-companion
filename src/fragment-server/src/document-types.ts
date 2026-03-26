import type { DocumentType } from '@ai-companion/types';

export const BUILT_IN_DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'adr',
    name: 'Architecture Decision Record',
    description: 'Captures architectural decisions with context, options considered, and rationale',
    templatePath: 'pas/docs/adr/_template.md',
    chunkStrategy: 'header',
    chunkSize: 768,
    chunkOverlap: 12,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pattern',
    name: 'Implementation Pattern',
    description: 'Reusable implementation pattern with examples and when-to-use guidance',
    templatePath: 'pas/docs/pattern/_template.md',
    chunkStrategy: 'recursive',
    chunkSize: 512,
    chunkOverlap: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'gotcha',
    name: 'Gotcha / Pitfall',
    description: 'A known trap, gotcha, or non-obvious behavior to watch out for',
    templatePath: 'pas/docs/gotcha/_template.md',
    chunkStrategy: 'recursive',
    chunkSize: 256,
    chunkOverlap: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'runbook',
    name: 'Runbook',
    description: 'Step-by-step operational procedure',
    templatePath: 'pas/docs/runbook/_template.md',
    chunkStrategy: 'hierarchical',
    chunkSize: 256,
    chunkOverlap: 10,
    createdAt: new Date().toISOString(),
  },
];
