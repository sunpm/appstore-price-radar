function normalizeOriginRule(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isWildcardRule(rule: string): boolean {
  return rule.startsWith('*.') || rule.startsWith('http://*.') || rule.startsWith('https://*.');
}

function parseCorsRules(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(item => normalizeOriginRule(item))
    .filter(Boolean);
}

function matchWildcardOrigin(requestOrigin: string, wildcardRule: string): boolean {
  let normalizedRule = normalizeOriginRule(wildcardRule).toLowerCase();
  let protocol: 'http:' | 'https:' | null = null;

  if (normalizedRule.startsWith('http://*.')) {
    protocol = 'http:';
    normalizedRule = normalizedRule.slice('http://'.length);
  } else if (normalizedRule.startsWith('https://*.')) {
    protocol = 'https:';
    normalizedRule = normalizedRule.slice('https://'.length);
  }

  if (!normalizedRule.startsWith('*.')) {
    return false;
  }

  try {
    const parsed = new URL(requestOrigin);

    if (protocol && parsed.protocol !== protocol) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const suffix = normalizedRule.slice(2).toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

export function resolveCorsOrigin(requestOrigin: string | undefined, configuredOrigin?: string): string {
  const rules = parseCorsRules(configuredOrigin);
  const normalizedOrigin = requestOrigin ? normalizeOriginRule(requestOrigin) : undefined;

  if (rules.length === 0) {
    return normalizedOrigin ?? '*';
  }

  if (rules.includes('*')) {
    return '*';
  }

  if (!normalizedOrigin) {
    const fallback = rules.find(rule => !isWildcardRule(rule));
    return fallback ?? '*';
  }

  const exactMatched = rules.includes(normalizedOrigin);
  const wildcardMatched = rules.some(rule => matchWildcardOrigin(normalizedOrigin, rule));

  if (exactMatched || wildcardMatched) {
    return normalizedOrigin;
  }

  return 'null';
}
