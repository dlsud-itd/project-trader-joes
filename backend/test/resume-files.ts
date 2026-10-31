/**
 * Builds small but real resume files for tests, so text extraction runs on
 * the same kind of bytes an applicant uploads.
 */

/** A one-page PDF with each line of text on its own row. */
export function buildPdf(lines: string[]): Buffer {
  const escape = (line: string) =>
    line.replace(/[\\()]/g, (char) => `\\${char}`);
  const content = [
    'BT /F1 12 Tf 72 720 Td 16 TL',
    ...lines.map((line) => `(${escape(line)}) Tj T*`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** A PDF with a page but no text on it, like a scanned resume. */
export function buildEmptyPdf(): Buffer {
  return buildPdf([]);
}
