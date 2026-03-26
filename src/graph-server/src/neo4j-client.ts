import neo4j, { Driver, Session } from 'neo4j-driver';
import { getConfig, createLogger } from '@ai-companion/utils';

const log = createLogger('neo4j-client');
let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (_driver) return _driver;
  const cfg = getConfig().neo4j;
  _driver = neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user, cfg.password));
  log.info('Neo4j driver created', { url: cfg.url });
  return _driver;
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session: Session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => {
      const obj: Record<string, unknown> = {};
      r.keys.forEach((k) => { obj[k as string] = r.get(k); });
      return obj as T;
    });
  } finally {
    await session.close();
  }
}
