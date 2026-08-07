import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PDF_SIZE = 15 * 1024 * 1024;

export const extractTextFromPdf = async (file) => {
  if (!file) {
    throw new Error('Please choose a PDF file.');
  }

  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported.');
  }

  if (file.size > MAX_PDF_SIZE) {
    throw new Error('PDF is too large. Please upload a file under 15 MB.');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  const text = pages.join('\n\n').trim();

  if (!text) {
    throw new Error('No readable text was found in this PDF.');
  }

  return text;
};
