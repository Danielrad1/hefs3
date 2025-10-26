import { Request, Response } from 'express';
import * as mammoth from 'mammoth';
import { PDFExtract } from 'pdf.js-extract';
import { logger } from '../utils/logger';

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
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: fileData and fileType',
        },
      });
      return;
    }

    // Reject legacy .doc files (mammoth only supports .docx)
    if (fileType === 'doc') {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: 'Legacy DOC format is not supported. Please convert your file to DOCX or PDF format and try again.',
        },
      });
      return;
    }

    const startTime = Date.now();
    const fileSizeKB = Math.round(fileData.length / 1024);
    logger.info(`[Parse] Processing ${fileType} file: ${fileName || 'unnamed'} (${fileSizeKB} KB base64)`);

    // Convert base64 to buffer
    const decodeStart = Date.now();
    const buffer = Buffer.from(fileData, 'base64');
    const bufferSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    logger.info(`[Parse] Decoded base64 in ${Date.now() - decodeStart}ms (${bufferSizeMB} MB)`);

    let extractedText = '';

    if (fileType === 'docx') {
      // Parse Word document (DOCX only)
      const parseStart = Date.now();
      logger.info('[Parse] Parsing Word document...');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      logger.info(`[Parse] Extracted ${extractedText.length} characters from Word in ${Date.now() - parseStart}ms`);
    } else if (fileType === 'pdf') {
      // Parse PDF
      const parseStart = Date.now();
      logger.info('[Parse] Parsing PDF...');
      const pdfExtract = new PDFExtract();
      const data = await pdfExtract.extractBuffer(buffer);
      logger.info(`[Parse] PDF parsed in ${Date.now() - parseStart}ms (${data.pages.length} pages)`);
      
      // Extract text from all pages
      const textStart = Date.now();
      extractedText = data.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n');
      logger.info(`[Parse] Text extraction took ${Date.now() - textStart}ms`);
      
      logger.info(`[Parse] Extracted ${extractedText.length} characters from PDF`);
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: `Unsupported file type: ${fileType}. Supported formats are DOCX and PDF.`,
        },
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
        error: {
          code: 'NO_TEXT',
          message: 'No text could be extracted from the file. The file may be empty or contain only images.',
        },
      });
      return;
    }

    const totalTime = Date.now() - startTime;
    logger.info(`[Parse] ========== PARSING COMPLETE ==========`);
    logger.info(`[Parse] Total time: ${totalTime}ms`);
    logger.info(`[Parse] File size: ${bufferSizeMB} MB`);
    logger.info(`[Parse] Output: ${extractedText.length} characters`);
    logger.info(`[Parse] ==========================================`);
    
    res.json({
      success: true,
      data: {
        text: extractedText,
      },
    });
  } catch (error) {
    logger.error('[Parse] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse file. Please try again.',
      },
    });
  }
}

export const parseHandler = {
  parseFile,
};
