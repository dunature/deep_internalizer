import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up worker
if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
    ).toString();
}

/**
 * Parses a file and returns its text content
 * @param {File} file 
 * @returns {Promise<{title: string, content: string}>}
 */
export async function parseFile(file) {
    const title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    let content = '';

    const extension = file.name.split('.').pop().toLowerCase();
    const mimeType = file.type;

    if (extension === 'pdf' || mimeType === 'application/pdf') {
        content = await parsePdf(file);
    } else if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        content = await parseDocx(file);
    } else {
        // Default to text
        content = await parseTxt(file);
    }

    return { title, content };
}

async function parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Simple text joining, could be improved with better layout detection
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText.trim();
}

async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}

async function parseTxt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}
