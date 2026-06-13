import { inflateRawSync } from 'node:zlib';

import type { Branch, BranchImportInput } from '@/types';

interface BranchImportHeaderIndexes {
  name: number;
  impact: number;
  base: number;
  dev: number;
  qa: number;
  uat: number;
  pro: number;
}

interface ParseBranchImportBufferOptions {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

type EnvSnapshot = Pick<BranchImportInput, 'dev' | 'qa' | 'uat' | 'pro'>;

const defaultHeaderIndexes: BranchImportHeaderIndexes = {
  name: 0,
  impact: 1,
  base: 2,
  dev: 3,
  qa: 4,
  uat: 5,
  pro: 6,
};

const xlsxContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectoryFileHeaderSignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;

const normalizeHeader = (value: string): string =>
  value.trim().replace(/\s+/g, '').toLowerCase();

const detectDelimiter = (text: string): ',' | '\t' => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const commaCount = firstLine.split(',').length - 1;
  const tabCount = firstLine.split('\t').length - 1;
  return tabCount > commaCount ? '\t' : ',';
};

const pushParsedRow = (rows: string[][], row: string[], field: string): void => {
  const nextRow = [...row, field];
  if (nextRow.some((cell) => cell.trim() !== '')) {
    rows.push(nextRow);
  }
};

const parseDelimitedRows = (text: string): string[][] => {
  const delimiter = detectDelimiter(text);
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let isQuoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === delimiter && !isQuoted) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !isQuoted) {
      pushParsedRow(rows, row, field);
      row = [];
      field = '';
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    pushParsedRow(rows, row, field);
  }

  return rows;
};

const findHeaderIndex = (headers: string[], aliases: string[], fallback: number): number => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
  return index >= 0 ? index : fallback;
};

const getHeaderIndexes = (headers: string[]): BranchImportHeaderIndexes => ({
  name: findHeaderIndex(headers, ['分支', 'branch', 'branch name', 'name'], defaultHeaderIndexes.name),
  impact: findHeaderIndex(
    headers,
    ['内容(影响)', '内容 / 影响', '内容', '影响', 'impact'],
    defaultHeaderIndexes.impact
  ),
  base: findHeaderIndex(headers, ['base', '基础分支'], defaultHeaderIndexes.base),
  dev: findHeaderIndex(headers, ['dev'], defaultHeaderIndexes.dev),
  qa: findHeaderIndex(headers, ['qa'], defaultHeaderIndexes.qa),
  uat: findHeaderIndex(headers, ['uat'], defaultHeaderIndexes.uat),
  pro: findHeaderIndex(headers, ['pro', 'prod'], defaultHeaderIndexes.pro),
});

const getCell = (row: string[], index: number): string => (row[index] ?? '').trim();

const toBoolean = (value: string): boolean =>
  ['1', 'true', 'yes', 'y', '是', '已发布', '发布', '☑', '✓', '✔', 'checked'].includes(
    value.trim().toLowerCase()
  );

const deriveImportStatus = (branch: EnvSnapshot): Branch['status'] => {
  if (branch.pro) return 'Merged';
  if (branch.uat) return 'Approved';
  if (branch.qa || branch.dev) return 'Testing';
  return 'Draft';
};

const inferBranchType = (name: string): Branch['type'] | undefined => {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('/bug/')) return 'Bug';
  if (normalizedName.includes('/task/')) return 'Task';
  if (normalizedName.includes('/story/')) return 'Story';
  return undefined;
};

const rowToImportedBranch = (
  row: string[],
  indexes: BranchImportHeaderIndexes,
  lineNumber: number
): BranchImportInput | null => {
  if (!row.some((cell) => cell.trim() !== '')) return null;

  const name = getCell(row, indexes.name);
  if (!name) {
    throw new Error(`第 ${lineNumber} 行缺少分支名称。`);
  }

  const branchBase = {
    name,
    impact: getCell(row, indexes.impact),
    base: getCell(row, indexes.base) || 'master',
    dev: toBoolean(getCell(row, indexes.dev)),
    qa: toBoolean(getCell(row, indexes.qa)),
    uat: toBoolean(getCell(row, indexes.uat)),
    pro: toBoolean(getCell(row, indexes.pro)),
  };

  return {
    ...branchBase,
    status: deriveImportStatus(branchBase),
    type: inferBranchType(name),
  };
};

const isBranchImportInput = (value: BranchImportInput | null): value is BranchImportInput =>
  value !== null;

const mergeContinuationRows = (
  rows: string[][],
  indexes: BranchImportHeaderIndexes
): string[][] => {
  const mergedRows: string[][] = [];

  for (const row of rows) {
    const name = getCell(row, indexes.name);
    if (name) {
      mergedRows.push([...row]);
      continue;
    }

    const continuationText = getCell(row, indexes.impact);
    const previousRow = mergedRows[mergedRows.length - 1];
    if (continuationText && previousRow) {
      const currentImpact = getCell(previousRow, indexes.impact);
      previousRow[indexes.impact] = currentImpact
        ? `${currentImpact}\n${continuationText}`
        : continuationText;
    }
  }

  return mergedRows;
};

const parseBranchImportRows = (rows: string[][]): BranchImportInput[] => {
  const [headers, ...dataRows] = rows;
  if (!headers) {
    throw new Error('导入文件为空。');
  }

  const indexes = getHeaderIndexes(headers);
  const branches = mergeContinuationRows(dataRows, indexes)
    .map((row, index) => rowToImportedBranch(row, indexes, index + 2))
    .filter(isBranchImportInput);

  if (branches.length === 0) {
    throw new Error('没有找到可导入的分支行。');
  }

  return branches;
};

const decodeTextBuffer = (buffer: Buffer): string => {
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  if (!utf8Text.includes('\uFFFD')) return utf8Text;

  try {
    return new TextDecoder('gb18030').decode(buffer);
  } catch {
    return utf8Text;
  }
};

const isXlsxFile = (fileName: string, contentType: string): boolean =>
  fileName.toLowerCase().endsWith('.xlsx') || contentType === xlsxContentType;

const decodeXmlText = (value: string): string =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&#(\d+);/g, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const getAttributeValue = (attributes: string, attributeName: string): string | null => {
  const pattern = new RegExp(`(?:^|\\s)${attributeName}="([^"]*)"`);
  const match = pattern.exec(attributes);
  return match?.[1] ?? null;
};

const collectTextNodes = (xml: string): string => {
  const values = Array.from(xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), (match) =>
    decodeXmlText(match[1] ?? '')
  );

  if (values.length > 0) {
    return values.join('');
  }

  return decodeXmlText(xml.replace(/<[^>]+>/g, ''));
};

const getTagText = (xml: string, tagName: string): string => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`);
  const match = pattern.exec(xml);
  return match ? decodeXmlText(match[1] ?? '') : '';
};

const parseSharedStrings = (xml: string | undefined): string[] => {
  if (!xml) return [];

  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), (match) =>
    collectTextNodes(match[1] ?? '')
  );
};

const getColumnIndex = (cellReference: string | null, fallback: number): number => {
  const columnMatch = /^[A-Z]+/i.exec(cellReference ?? '');
  if (!columnMatch) return fallback;

  let index = 0;
  for (const char of columnMatch[0].toUpperCase()) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
};

const getCellValue = (attributes: string, body: string, sharedStrings: string[]): string => {
  const type = getAttributeValue(attributes, 't');

  if (type === 'inlineStr') {
    return collectTextNodes(body);
  }

  const rawValue = getTagText(body, 'v');
  if (type === 's') {
    const sharedStringIndex = Number.parseInt(rawValue, 10);
    return Number.isInteger(sharedStringIndex) ? sharedStrings[sharedStringIndex] ?? '' : '';
  }

  if (type === 'b') {
    return rawValue === '1' ? 'true' : 'false';
  }

  return rawValue;
};

const parseWorksheetRows = (worksheetXml: string, sharedStrings: string[]): string[][] => {
  const rows: string[][] = [];

  for (const rowMatch of worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[1] ?? '';
    const row: string[] = [];
    const cellPattern = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;

    for (const cellMatch of rowXml.matchAll(cellPattern)) {
      const attributes = cellMatch[1] ?? cellMatch[2] ?? '';
      const body = cellMatch[3] ?? '';
      const cellReference = getAttributeValue(attributes, 'r');
      const columnIndex = getColumnIndex(cellReference, row.length);
      row[columnIndex] = getCellValue(attributes, body, sharedStrings);
    }

    if (row.some((cell) => (cell ?? '').trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
};

const findEndOfCentralDirectoryOffset = (buffer: Buffer): number => {
  const minimumEndOfCentralDirectorySize = 22;
  const maxCommentLength = 0xffff;
  const lowestOffset = Math.max(
    0,
    buffer.length - minimumEndOfCentralDirectorySize - maxCommentLength
  );

  for (let offset = buffer.length - minimumEndOfCentralDirectorySize; offset >= lowestOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      return offset;
    }
  }

  throw new Error('无法读取 xlsx 文件，请确认文件未损坏。');
};

const getZipEntryData = (
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  compressionMethod: number
): Buffer => {
  if (buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature) {
    throw new Error('xlsx 文件结构异常。');
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return Buffer.from(compressedData);
  }

  if (compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error('xlsx 文件使用了暂不支持的压缩方式。');
};

const unzipEntries = (buffer: Buffer): Map<string, Buffer> => {
  const entries = new Map<string, Buffer>();
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(buffer);
  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  let offset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirectoryFileHeaderSignature) {
      throw new Error('xlsx 文件目录结构异常。');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileName = buffer
      .subarray(fileNameStart, fileNameStart + fileNameLength)
      .toString('utf8')
      .replace(/\\/g, '/');

    entries.set(fileName, getZipEntryData(buffer, localHeaderOffset, compressedSize, compressionMethod));
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
};

const getFirstRelationshipTarget = (relationshipsXml: string, relationshipId: string): string | null => {
  const relationshipPattern = /<Relationship\b([^>]*)\/>/g;

  for (const match of relationshipsXml.matchAll(relationshipPattern)) {
    const attributes = match[1] ?? '';
    if (getAttributeValue(attributes, 'Id') === relationshipId) {
      return getAttributeValue(attributes, 'Target');
    }
  }

  return null;
};

const normalizeWorksheetPath = (target: string): string => {
  const cleanTarget = target.replace(/^\/+/, '');
  if (cleanTarget.startsWith('xl/')) return cleanTarget;
  return `xl/${cleanTarget}`;
};

const getFirstWorksheetPath = (entries: Map<string, Buffer>): string => {
  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8');
  const relationshipsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  const firstSheetMatch = workbookXml?.match(/<sheet\b([^>]*)\/>/);
  const relationshipId = firstSheetMatch ? getAttributeValue(firstSheetMatch[1] ?? '', 'r:id') : null;

  if (relationshipId && relationshipsXml) {
    const target = getFirstRelationshipTarget(relationshipsXml, relationshipId);
    if (target) {
      return normalizeWorksheetPath(target);
    }
  }

  const fallbackPath = Array.from(entries.keys()).find(
    (path) => path.startsWith('xl/worksheets/') && path.endsWith('.xml')
  );
  if (!fallbackPath) {
    throw new Error('xlsx 文件中没有找到工作表。');
  }

  return fallbackPath;
};

const parseXlsxRows = (buffer: Buffer): string[][] => {
  const entries = unzipEntries(buffer);
  const worksheetPath = getFirstWorksheetPath(entries);
  const worksheetXml = entries.get(worksheetPath)?.toString('utf8');
  if (!worksheetXml) {
    throw new Error('xlsx 文件中没有找到工作表数据。');
  }

  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml')?.toString('utf8'));
  return parseWorksheetRows(worksheetXml, sharedStrings);
};

export const parseBranchImportBuffer = ({
  fileName,
  contentType,
  buffer,
}: ParseBranchImportBufferOptions): BranchImportInput[] => {
  if (buffer.length === 0) {
    throw new Error('导入文件为空。');
  }

  const rows = isXlsxFile(fileName, contentType)
    ? parseXlsxRows(buffer)
    : parseDelimitedRows(decodeTextBuffer(buffer));

  return parseBranchImportRows(rows);
};
