export interface GraphNode {
  id: string;
  type: 'Repository' | 'File' | 'Symbol' | 'Document' | 'DocumentChunk' | 'Task' | 'AgentRun';
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  fromId: string;
  toId: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface BlastRadiusResult {
  rootNode: string;
  affected: Array<{
    nodeId: string;
    nodeType: string;
    depth: number;
    confidence: number;
    path: string[];
  }>;
  totalAffected: number;
}

export interface CoupledFile {
  filePath: string;
  strength: number;
  commitCount: number;
}

export interface SymbolRef {
  name: string;
  filePath: string;
  line: number;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type';
}
