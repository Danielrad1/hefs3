/**
 * ClozeService - Cloze deletion authoring and management
 */

export class ClozeService {
  /**
   * Insert cloze deletion around selected text
   * @param html Current HTML content
   * @param selection Selection range { start, end }
   * @param index Optional cloze index (auto-increments if not provided)
   */
  insertCloze(
    html: string,
    selection: { start: number; end: number },
    index?: number
  ): { html: string; newSelection: { start: number; end: number } } {
    const { start, end } = selection;
    const selectedText = html.substring(start, end);

    // If no index provided, find next available
    const clozeIndex = index !== undefined ? index : this.getNextClozeIndex(html);

    // Create cloze markup
    const clozeMarkup = `{{c${clozeIndex}::${selectedText || 'text'}}}`;

    // Insert into HTML
    const newHtml = html.substring(0, start) + clozeMarkup + html.substring(end);

    // Calculate new selection (select the text inside the cloze)
    const textStart = start + `{{c${clozeIndex}::`.length;
    const textEnd = textStart + (selectedText || 'text').length;

    return {
      html: newHtml,
      newSelection: { start: textStart, end: textEnd },
    };
  }

  /**
   * Insert cloze with hint
   */
  insertClozeWithHint(
    html: string,
    selection: { start: number; end: number },
    hint: string,
    index?: number
  ): { html: string; newSelection: { start: number; end: number } } {
    const { start, end } = selection;
    const selectedText = html.substring(start, end);

    const clozeIndex = index !== undefined ? index : this.getNextClozeIndex(html);
    const clozeMarkup = `{{c${clozeIndex}::${selectedText || 'text'}::${hint}}}`;

    const newHtml = html.substring(0, start) + clozeMarkup + html.substring(end);

    const textStart = start + `{{c${clozeIndex}::`.length;
    const textEnd = textStart + (selectedText || 'text').length;

    return {
      html: newHtml,
      newSelection: { start: textStart, end: textEnd },
    };
  }

  /**
   * Get next available cloze index in text
   */
  getNextClozeIndex(html: string): number {
    const indices = this.listClozeIndices(html);
    if (indices.length === 0) return 1;
    return Math.max(...indices) + 1;
  }

  /**
   * List all cloze indices in text
   */
  listClozeIndices(html: string): number[] {
    const clozeRegex = /{{c(\d+)::/g;
    const indices = new Set<number>();
    let match;

    while ((match = clozeRegex.exec(html)) !== null) {
      indices.add(parseInt(match[1]));
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Renumber clozes sequentially (1, 2, 3, ...)
   */
  renumberClozes(html: string): string {
    const indices = this.listClozeIndices(html);
    
    if (indices.length === 0) return html;

    // Create mapping of old indices to new sequential indices
    const mapping: Record<number, number> = {};
    indices.forEach((oldIndex, newIndex) => {
      mapping[oldIndex] = newIndex + 1;
    });

    // Replace all cloze indices
    return html.replace(/{{c(\d+)::/g, (match, index) => {
      const oldIndex = parseInt(index);
      const newIndex = mapping[oldIndex];
      return `{{c${newIndex}::`;
    });
  }

  /**
   * Count total cloze deletions in text
   */
  countClozes(html: string): number {
    return this.listClozeIndices(html).length;
  }

  /**
   * Extract cloze cards that would be generated
   * Returns array of { index, front, back }
   */
  extractClozeCards(html: string): Array<{ index: number; preview: string }> {
    const indices = this.listClozeIndices(html);

    return indices.map((index) => {
      // Generate preview by showing cloze as [...] and others as text
      const preview = html.replace(
        /{{c(\d+)::([^:}]+)(?:::([^}]+))?}}/g,
        (match, clozeIndex, text, hint) => {
          const idx = parseInt(clozeIndex);
          if (idx === index) {
            return '[...]';
          }
          return text;
        }
      );

      return {
        index,
        preview: this.stripHtml(preview),
      };
    });
  }

  /**
   * Validate cloze markup
   * Returns array of errors
   */
  validate(html: string): string[] {
    const errors: string[] = [];

    // Check for orphaned cloze indices (gaps in sequence)
    const indices = this.listClozeIndices(html);
    if (indices.length > 0) {
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] - indices[i - 1] > 1) {
          errors.push(`Gap in cloze numbering: ${indices[i - 1]} to ${indices[i]}`);
        }
      }
    }

    // Check for malformed cloze syntax
    const malformedRegex = /{{c\d*::|{{c\d+:[^:}]*}}/g;
    const matches = html.match(malformedRegex);
    if (matches) {
      errors.push('Found malformed cloze syntax');
    }

    // Check for empty clozes
    const emptyClozeRegex = /{{c\d+::::}}/g;
    if (emptyClozeRegex.test(html)) {
      errors.push('Found empty cloze deletions');
    }

    return errors;
  }

  /**
   * Strip HTML tags for preview
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get cloze statistics
   */
  getStats(html: string) {
    const indices = this.listClozeIndices(html);
    const errors = this.validate(html);

    return {
      totalClozes: indices.length,
      indices,
      hasGaps: errors.some((e) => e.includes('Gap')),
      hasMalformed: errors.some((e) => e.includes('malformed')),
      errors,
    };
  }
}
