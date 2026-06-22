const txtMimeType = 'text/plain;charset=utf-8';

export const sanitizeFilenamePart = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
};

export const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([`\uFEFF${content}`], { type: txtMimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
