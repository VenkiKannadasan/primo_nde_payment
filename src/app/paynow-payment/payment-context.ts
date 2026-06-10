export interface PatronFineContext {
  patronName: string;
  patronId: string;
  fineAmount: number;
}

interface PatronFineCandidate {
  patronName?: string;
  patronId?: string;
  fineAmount?: number;
}

type UnknownRecord = Record<string, unknown>;

const TOKEN_SERVICE_PATHS = [
  ['finesService', 'personalInfoService', 'jwtUtilService'],
  ['personalInfoService', 'jwtUtilService'],
  ['jwtUtilService'],
];

export function extractPatronFineContext(...sources: unknown[]): PatronFineContext | null {
  const mergedCandidate: PatronFineCandidate = {};

  for (const source of sources) {
    const candidate = extractPatronFineCandidate(source);

    if (!mergedCandidate.patronName && candidate.patronName) {
      mergedCandidate.patronName = candidate.patronName;
    }

    if (!mergedCandidate.patronId && candidate.patronId) {
      mergedCandidate.patronId = candidate.patronId;
    }

    if (mergedCandidate.fineAmount === undefined && candidate.fineAmount !== undefined) {
      mergedCandidate.fineAmount = candidate.fineAmount;
    }
  }

  return normalizePatronFineCandidate(mergedCandidate);
}

export function isValidPatronFineContext(context: PatronFineContext | null): boolean {
  return Boolean(
    context
    && context.patronName.trim()
    && context.patronId.trim()
    && Number.isFinite(context.fineAmount)
    && context.fineAmount > 0
  );
}

export function patronFineContextsEqual(
  first: PatronFineContext | null,
  second: PatronFineContext | null,
): boolean {
  if (first === second) {
    return true;
  }

  if (!first || !second) {
    return false;
  }

  return first.patronName === second.patronName
    && first.patronId === second.patronId
    && first.fineAmount === second.fineAmount;
}

function extractPatronFineCandidate(source: unknown): PatronFineCandidate {
  if (!isRecord(source)) {
    return {};
  }

  const decodedToken = readDecodedToken(source);

  return {
    patronName: firstString(
      readStringByPath(decodedToken, ['displayName']),
      readStringByPath(decodedToken, ['name']),
      findStringValue(source, isNameKey),
    ),
    patronId: firstString(
      readStringByPath(decodedToken, ['userName']),
      readStringByPath(decodedToken, ['username']),
      readStringByPath(decodedToken, ['sub']),
      findStringValue(source, isPatronIdKey),
    ),
    fineAmount: findFineAmount(source),
  };
}

function normalizePatronFineCandidate(candidate: PatronFineCandidate): PatronFineContext | null {
  const patronName = candidate.patronName?.trim();
  const patronId = candidate.patronId?.trim();
  const fineAmount = candidate.fineAmount;

  if (!patronName || !patronId || fineAmount === undefined || !Number.isFinite(fineAmount)) {
    return null;
  }

  return {
    patronName,
    patronId,
    fineAmount,
  };
}

function readDecodedToken(source: UnknownRecord): unknown {
  for (const path of TOKEN_SERVICE_PATHS) {
    const tokenService = readValueByPath(source, path);

    if (isRecord(tokenService) && typeof tokenService['getDecodedToken'] === 'function') {
      try {
        return tokenService['getDecodedToken'].call(tokenService);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function findStringValue(
  source: unknown,
  keyPredicate: (key: string) => boolean,
  visited = new Set<object>(),
  depth = 0,
): string | undefined {
  if (!isRecord(source) || depth > 5 || visited.has(source)) {
    return undefined;
  }

  visited.add(source);

  for (const [key, value] of Object.entries(source)) {
    if (keyPredicate(key)) {
      const stringValue = toNonEmptyString(value);

      if (stringValue) {
        return stringValue;
      }
    }
  }

  for (const value of Object.values(source)) {
    if (isRecord(value) || Array.isArray(value)) {
      const nestedValue = findStringValue(value, keyPredicate, visited, depth + 1);

      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return undefined;
}

function findFineAmount(
  source: unknown,
  visited = new Set<object>(),
  depth = 0,
  keyHint = '',
): number | undefined {
  if (depth > 5) {
    return undefined;
  }

  if (Array.isArray(source)) {
    const arrayTotal = source
      .map((item) => findFineAmount(item, visited, depth + 1, keyHint))
      .filter((amount): amount is number => amount !== undefined)
      .reduce((total, amount) => total + amount, 0);

    return arrayTotal > 0 ? arrayTotal : undefined;
  }

  if (!isRecord(source) || visited.has(source)) {
    return undefined;
  }

  visited.add(source);

  for (const [key, value] of Object.entries(source)) {
    if (isFineAmountKey(key)) {
      const amountValue = parseAmount(value);

      if (amountValue !== undefined) {
        return amountValue;
      }
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (!isRecord(value) && !Array.isArray(value)) {
      continue;
    }

    const nestedAmount = findFineAmount(
      value,
      visited,
      depth + 1,
      isFineAmountKey(key) ? key : keyHint,
    );

    if (nestedAmount !== undefined && (keyHint || isFineAmountKey(key))) {
      return nestedAmount;
    }
  }

  return undefined;
}

function readValueByPath(source: unknown, path: string[]): unknown {
  let currentValue = source;

  for (const pathPart of path) {
    if (!isRecord(currentValue)) {
      return undefined;
    }

    currentValue = currentValue[pathPart];
  }

  return currentValue;
}

function readStringByPath(source: unknown, path: string[]): string | undefined {
  return toNonEmptyString(readValueByPath(source, path));
}

function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()));
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);

  if (!match) {
    return undefined;
  }

  const parsedValue = Number(match[0]);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object';
}

function normalizeKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isNameKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);
  return [
    'displayname',
    'fullname',
    'patronname',
    'preferredname',
    'name',
  ].includes(normalizedKey);
}

function isPatronIdKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);
  return [
    'username',
    'userid',
    'userprimaryid',
    'primaryid',
    'patronid',
    'patronbarcode',
    'barcode',
    'sub',
  ].includes(normalizedKey);
}

function isFineAmountKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);

  return normalizedKey.includes('fine')
    || normalizedKey.includes('fee')
    || normalizedKey.includes('balance')
    || normalizedKey.includes('outstanding')
    || normalizedKey.includes('amountdue')
    || normalizedKey.includes('dueamount')
    || normalizedKey === 'amount'
    || normalizedKey === 'finescounters'
    || normalizedKey === 'totalamount'
    || normalizedKey === 'total';
}
