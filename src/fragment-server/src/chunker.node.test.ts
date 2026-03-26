import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument } from './chunker.ts';

const base = {
  chunkStrategy: 'recursive' as const,
  chunkSize: 128,
  chunkOverlap: 10,
};

describe('chunkDocument', () => {
  it('produces chunks for recursive strategy', () => {
    const chunks = chunkDocument('A'.repeat(1000), base);
    assert.ok(chunks.length > 0);
    chunks.forEach((c) => assert.ok(c.content.length > 0));
  });

  it('produces chunks for header strategy', () => {
    const chunks = chunkDocument('## Section 1\nContent.\n## Section 2\nMore.', { ...base, chunkStrategy: 'header' });
    assert.ok(chunks.length > 0);
  });

  it('produces chunks for hierarchical strategy', () => {
    const chunks = chunkDocument('Summary.\n1. Step one\n2. Step two', { ...base, chunkStrategy: 'hierarchical' });
    assert.ok(chunks.length > 0);
    assert.equal(chunks[0].chunkIndex, 0);
  });

  it('assigns sequential chunk indices', () => {
    const chunks = chunkDocument('B'.repeat(2000), base);
    chunks.forEach((c, i) => assert.equal(c.chunkIndex, i));
  });

  it('estimates token count', () => {
    const chunks = chunkDocument('Hello world this is a test.', { ...base, chunkSize: 1000 });
    assert.ok(chunks[0].tokenCount > 0);
  });
});
