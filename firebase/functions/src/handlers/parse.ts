import { Request, Response } from 'express';
import * as mammoth from 'mammoth';
import { PDFExtract } from 'pdf.js-extract';

interface ParseRequest {
  fileData: string; // base64 encoded
  fileType: 'docx' | 'doc' | 'pdf';
  fileName: string;
}

/**
 * Parse Word or PDF documents and extract text
 */
async function parseFile(req: Request, res: Response): Promise<void> {
  try {
    const { fileData, fileType, fileName }: ParseRequest = req.body;

    if (!fileData || !fileType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: fileData, fileType',
      });
      return;
    }

    console.log(`[Parse] Processing ${fileType} file: ${fileName || 'unnamed'}`);

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');

    let extractedText = '';

    if (fileType === 'docx' || fileType === 'doc') {
      // Parse Word document
      console.log('[Parse] Parsing Word document...');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      console.log(`[Parse] Extracted ${extractedText.length} characters from Word`);
    } else if (fileType === 'pdf') {
      // Parse PDF
      console.log('[Parse] Parsing PDF...');
      const pdfExtract = new PDFExtract();
      const data = await pdfExtract.extractBuffer(buffer);
      
      // Extract text from all pages
      extractedText = data.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n');
      
      console.log(`[Parse] Extracted ${extractedText.length} characters from PDF`);
    } else {
      res.status(400).json({
        success: false,
        error: `Unsupported file type: ${fileType}`,
      });
      return;
    }

    // Clean up the text
    extractedText = extractedText
      .trim()
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines

    if (!extractedText) {
      res.status(400).json({
        success: false,
        error: 'No text could be extracted from the file',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        text: extractedText,
      },
    });
  } catch (error) {
    console.error('[Parse] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file',
    });
  }
}

export const parseHandler = {
  parseFile,
};
