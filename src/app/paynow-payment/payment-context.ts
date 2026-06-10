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
  const pageCandidate = extractPageTextCandidate(source);

  if (pageCandidate) {
    return pageCandidate;
  }

  if (!isRecord(source)) {
    return {};
  }

  const decodedToken = readDecodedToken(source);

  return {
    patronName: firstString(
      readStringByPath(decodedToken, ['displayName']),
      readStringByPath(decodedToken, ['name']),
      findPatronNameValue(source),
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

function extractPageTextCandidate(source: unknown): PatronFineCandidate | null {
  const pageText = readPageText(source);

  if (!pageText) {
    return null;
  }

  return {
    patronName: readProfileName(source, pageText),
    fineAmount: readCurrentFinesBalance(pageText),
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

function findPatronNameValue(
  source: unknown,
  visited = new Set<object>(),
  depth = 0,
  path: string[] = [],
): string | undefined {
  if (!isRecord(source) || depth > 5 || visited.has(source)) {
    return undefined;
  }

  visited.add(source);

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = normalizeKey(key);

    if (isExplicitPatronNameKey(normalizedKey) || isProfileScopedNameKey(normalizedKey, path)) {
      const stringValue = toNonEmptyString(value);

      if (stringValue) {
        return stringValue;
      }
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) || Array.isArray(value)) {
      const nestedValue = findPatronNameValue(value, visited, depth + 1, [...path, key]);

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

function readPageText(source: unknown): string | undefined {
  if (!isDomTextSource(source)) {
    return undefined;
  }

  const textContent = (
    isDocumentSource(source)
      ? source.body?.textContent
      : source.textContent
  )?.replace(/\s+/g, ' ').trim();

  return textContent || undefined;
}

function readProfileName(source: unknown, pageText: string): string | undefined {
  if (isQueryableDomSource(source)) {
    const profileElements = source.querySelectorAll(
      '[aria-label*="profile" i], [id*="profile" i], [class*="profile" i], [data-testid*="profile" i]',
    );

    for (const profileElement of Array.from(profileElements)) {
      const profileName = readLabeledName(profileElement.textContent ?? '', true);

      if (profileName) {
        return profileName;
      }
    }
  }

  if (isElementSource(source) && hasProfileHint(source)) {
    const scopedProfileName = readLabeledName(source.textContent ?? '', true);

    if (scopedProfileName) {
      return scopedProfileName;
    }
  }

  return readLabeledName(pageText, false);
}

function readCurrentFinesBalance(pageText: string): number | undefined {
  const balanceMatch = pageText.match(/current\s+fines?\s+balance\s+is\s+(-?\d[\d,]*(?:\.\d+)?)\s*[A-Z]{0,3}/i);

  if (!balanceMatch) {
    return undefined;
  }

  return parseAmount(balanceMatch[1]);
}

function readLabeledName(text: string, allowPlainNameLabel: boolean): string | undefined {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const labels = allowPlainNameLabel
    ? ['Preferred Name', 'Display Name', 'Full Name', 'Patron Name', 'Name']
    : ['Preferred Name', 'Display Name', 'Full Name', 'Patron Name'];

  for (const label of labels) {
    const nameMatch = normalizedText.match(new RegExp(`${label}\\s*:?\\s*([^:]+?)(?=\\s+(?:Preferred Name|Display Name|Full Name|Patron Name|Name|User ID|Barcode|Email|Address|Phone|Current fines balance)\\b|$)`, 'i'));

    if (!nameMatch) {
      continue;
    }

    const name = cleanProfileName(nameMatch[1]);

    if (name) {
      return name;
    }
  }

  return undefined;
}

function cleanProfileName(value: string): string | undefined {
  const cleanValue = value.replace(/\s+/g, ' ').trim();

  if (!cleanValue || /^(not available|none|null|undefined)$/i.test(cleanValue)) {
    return undefined;
  }

  return cleanValue;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object';
}

function isDomTextSource(value: unknown): value is Document | Element {
  return isDocumentSource(value) || isElementSource(value);
}

function isDocumentSource(value: unknown): value is Document {
  return typeof Document !== 'undefined' && value instanceof Document;
}

function isElementSource(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function isQueryableDomSource(value: unknown): value is Document | Element {
  return isDocumentSource(value) || isElementSource(value);
}

function hasProfileHint(element: Element): boolean {
  const profileText = [
    element.getAttribute('aria-label'),
    element.getAttribute('id'),
    element.getAttribute('class'),
    element.getAttribute('data-testid'),
  ].join(' ');

  return /profile/i.test(profileText);
}

function normalizeKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isExplicitPatronNameKey(normalizedKey: string): boolean {
  return [
    'displayname',
    'fullname',
    'patronname',
    'preferredname',
  ].includes(normalizedKey);
}

function isProfileScopedNameKey(normalizedKey: string, path: string[]): boolean {
  return normalizedKey === 'name' && path.some((pathPart) => isPatronProfilePathKey(pathPart));
}

function isPatronProfilePathKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);

  return [
    'account',
    'borrower',
    'currentuser',
    'patron',
    'personal',
    'personalinfo',
    'profile',
    'user',
    'userinfo',
    'userprofile',
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
