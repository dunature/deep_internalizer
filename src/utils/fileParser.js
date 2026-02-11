// Import worker directly using Vite's worker suffix
import PDFWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker';

let pdfjsLibPromise = null;
let mammothPromise = null;
const PDF_CONCURRENCY = 3;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function reportProgress(onProgress, data) {
    if (typeof onProgress === 'function') {
        onProgress(data);
    }
}

async function loadPdfjs() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf');
    }
    const pdfjsLib = await pdfjsLibPromise;

    // Use Vite's worker import mechanism
    if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
        pdfjsLib.GlobalWorkerOptions.workerPort = new PDFWorker();
    }

    return pdfjsLib;
}

async function loadMammoth() {
    if (!mammothPromise) {
        mammothPromise = import('mammoth');
    }
    const module = await mammothPromise;
    return module.default || module;
}

function yieldToMainThread() {
    return new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

export function cleanTextPreserveParagraphs(content) {
    if (!content) return '';
    return content
        .split(/\n\n+/)
        .map(para => para.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
        .join('\n\n');
}

export function shouldAutoClean(content) {
    if (!content) return false;
    const totalNewlines = (content.match(/\n/g) || []).length;
    if (totalNewlines < 20) return false;

    const doubleMatches = content.match(/\n{2,}/g) || [];
    const newlinesInDouble = doubleMatches.reduce((sum, match) => sum + match.length, 0);
    const singleNewlines = totalNewlines - newlinesInDouble;

    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const avgLineLength = lines.length
        ? Math.round(lines.reduce((sum, line) => sum + line.trim().length, 0) / lines.length)
        : 0;

    return singleNewlines > 30 && avgLineLength > 0 && avgLineLength < 80 && newlinesInDouble <= Math.max(2, Math.round(singleNewlines * 0.1));
}

/**
 * Parses a file and returns its text content
 * @param {File} file 
 * @param {object} options
 * @param {function} options.onProgress
 * @param {boolean} options.autoClean
 * @returns {Promise<{title: string, content: string, cleaned: boolean, rawContent?: string}>}
 */
export async function parseFile(file, options = {}) {
    const { onProgress, autoClean = true } = options;
    const title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    let content = '';
    let cleaned = false;
    let rawContent = null;
    let cleanMs = 0;
    const parseStart = now();

    const extension = file.name.split('.').pop().toLowerCase();
    const mimeType = file.type;

    if (extension === 'pdf' || mimeType === 'application/pdf') {
        reportProgress(onProgress, { stage: 'pdf', message: 'Reading PDF...' });
        content = await parsePdf(file, onProgress);
    } else if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        reportProgress(onProgress, { stage: 'docx', message: 'Reading DOCX...' });
        content = await parseDocx(file, onProgress);
    } else {
        // Default to text
        reportProgress(onProgress, { stage: 'txt', message: 'Reading text file...' });
        content = await parseTxt(file);
    }

    if (autoClean && shouldAutoClean(content)) {
        const cleanStart = now();
        rawContent = content;
        content = cleanTextPreserveParagraphs(content);
        cleaned = true;
        cleanMs = Math.round(now() - cleanStart);
    }

    const parseMs = Math.round(now() - parseStart);
    reportProgress(onProgress, { stage: 'done', message: 'Parsing complete.', parseMs, cleanMs });

    return { title, content, cleaned, rawContent, parseMs, cleanMs };
}

async function parsePdf(file, onProgress) {
    const pdfjsLib = await loadPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts = new Array(pdf.numPages);

    for (let start = 1; start <= pdf.numPages; start += PDF_CONCURRENCY) {
        const batch = [];

        for (let pageNum = start; pageNum < start + PDF_CONCURRENCY && pageNum <= pdf.numPages; pageNum++) {
            batch.push((async () => {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                // Simple text joining, could be improved with better layout detection
                const items = textContent.items;
                const parts = new Array(items.length);
                for (let i = 0; i < items.length; i++) {
                    parts[i] = items[i].str;
                }
                pageTexts[pageNum - 1] = parts.join(' ');
            })());
        }

        await Promise.all(batch);
        const done = Math.min(start + PDF_CONCURRENCY - 1, pdf.numPages);
        reportProgress(onProgress, {
            stage: 'pdf',
            current: done,
            total: pdf.numPages,
            message: `Extracting page ${done}/${pdf.numPages}...`
        });
        await yieldToMainThread();
    }

    return pageTexts.filter(Boolean).join('\n\n').trim();
}

async function parseDocx(file, onProgress) {
    const mammoth = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    reportProgress(onProgress, { stage: 'docx', message: 'Extracting text...' });
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}

async function parseTxt(file) {
    return file.text();
}
