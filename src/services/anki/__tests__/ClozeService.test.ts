/**
 * ClozeService Tests - Fixed to match actual API
 */

import { ClozeService } from '../ClozeService';

describe('ClozeService', () => {
  let clozeService: ClozeService;

  beforeEach(() => {
    clozeService = new ClozeService();
  });

  describe('List Cloze Indices', () => {
    it('should list single cloze deletion', () => {
      const text = '{{c1::Paris}} is the capital of France';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1]);
    });

    it('should list multiple cloze deletions', () => {
      const text = '{{c1::Paris}} is the capital of {{c2::France}}';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1, 2]);
    });

    it('should handle clozes with hints', () => {
      const text = '{{c1::Paris::city}} is in {{c2::France::country}}';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1, 2]);
    });

    it('should handle out-of-order cloze numbers', () => {
      const text = '{{c3::Three}} {{c1::One}} {{c2::Two}}';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1, 2, 3]); // Sorted
    });

    it('should handle duplicate cloze numbers', () => {
      const text = '{{c1::First}} and {{c1::Second}} are both c1';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1]); // Unique only
    });

    it('should return empty array for text without clozes', () => {
      const text = 'Just regular text with no clozes';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([]);
    });

    it('should handle nested braces', () => {
      const text = '{{c1::Formula: {{x}}}} is correct';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toEqual([1]);
    });
  });

  describe('Count Clozes', () => {
    it('should return correct count', () => {
      const text = '{{c1::One}} {{c2::Two}} {{c3::Three}}';
      const count = clozeService.countClozes(text);
      
      expect(count).toBe(3);
    });

    it('should return 0 for non-cloze text', () => {
      const text = 'Regular text';
      const count = clozeService.countClozes(text);
      
      expect(count).toBe(0);
    });

    it('should count unique cloze numbers only', () => {
      const text = '{{c1::A}} {{c1::B}} {{c2::C}}';
      const count = clozeService.countClozes(text);
      
      expect(count).toBe(2); // Only c1 and c2
    });
  });

  describe('Extract Cloze Cards', () => {
    it('should extract card previews', () => {
      const text = '{{c1::Paris}} is the capital of {{c2::France}}';
      const cards = clozeService.extractClozeCards(text);
      
      expect(cards).toHaveLength(2);
      expect(cards[0].index).toBe(1);
      expect(cards[0].preview).toContain('[...]'); // c1 hidden
      expect(cards[0].preview).toContain('France'); // c2 shown
      
      expect(cards[1].index).toBe(2);
      expect(cards[1].preview).toContain('Paris'); // c1 shown
      expect(cards[1].preview).toContain('[...]'); // c2 hidden
    });

    it('should handle multiple deletions of same number', () => {
      const text = '{{c1::Red}} and {{c1::Blue}} are colors';
      const cards = clozeService.extractClozeCards(text);
      
      expect(cards).toHaveLength(1);
      expect(cards[0].preview).toContain('[...]');
      expect(cards[0].preview).not.toContain('Red');
      expect(cards[0].preview).not.toContain('Blue');
    });
  });

  describe('Validation', () => {
    it('should validate correct cloze syntax', () => {
      const text = '{{c1::Paris}} is correct';
      const errors = clozeService.validate(text);
      
      expect(errors).toHaveLength(0);
    });

    it('should detect gaps in numbering', () => {
      const text = '{{c1::First}} {{c3::Third}}'; // Missing c2
      const errors = clozeService.validate(text);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Gap');
    });

    it('should detect empty cloze fields', () => {
      const text = '{{c1::::}} is empty';
      const errors = clozeService.validate(text);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('empty'))).toBe(true);
    });
  });

  describe('Insert Cloze', () => {
    it('should insert cloze deletion', () => {
      const text = 'Paris is the capital';
      const result = clozeService.insertCloze(text, { start: 0, end: 5 }, 1);
      
      expect(result.html).toBe('{{c1::Paris}} is the capital');
      expect(result.newSelection.start).toBeLessThan(result.newSelection.end);
    });

    it('should auto-increment cloze index', () => {
      const text = '{{c1::Paris}} is the capital of France';
      const result = clozeService.insertCloze(text, { start: 32, end: 38 });
      
      expect(result.html).toContain('{{c2::France}}');
    });

    it('should insert with hint', () => {
      const text = 'Paris is the capital';
      const result = clozeService.insertClozeWithHint(
        text,
        { start: 0, end: 5 },
        'city',
        1
      );
      
      expect(result.html).toContain('{{c1::Paris::city}}');
    });
  });

  describe('Renumber Clozes', () => {
    it('should renumber sequential clozes', () => {
      const text = '{{c2::First}} {{c5::Second}} {{c10::Third}}';
      const result = clozeService.renumberClozes(text);
      
      expect(result).toBe('{{c1::First}} {{c2::Second}} {{c3::Third}}');
    });

    it('should handle already sequential numbering', () => {
      const text = '{{c1::First}} {{c2::Second}}';
      const result = clozeService.renumberClozes(text);
      
      expect(result).toBe(text);
    });

    it('should return text unchanged if no clozes', () => {
      const text = 'No clozes here';
      const result = clozeService.renumberClozes(text);
      
      expect(result).toBe(text);
    });
  });

  describe('Get Next Index', () => {
    it('should return 1 for text with no clozes', () => {
      const next = clozeService.getNextClozeIndex('Regular text');
      expect(next).toBe(1);
    });

    it('should return next sequential index', () => {
      const text = '{{c1::One}} {{c2::Two}}';
      const next = clozeService.getNextClozeIndex(text);
      expect(next).toBe(3);
    });

    it('should handle gaps in numbering', () => {
      const text = '{{c1::One}} {{c5::Five}}';
      const next = clozeService.getNextClozeIndex(text);
      expect(next).toBe(6); // Max + 1
    });
  });

  describe('Get Stats', () => {
    it('should return comprehensive statistics', () => {
      const text = '{{c1::Paris}} is in {{c2::France}}';
      const stats = clozeService.getStats(text);
      
      expect(stats.totalClozes).toBe(2);
      expect(stats.indices).toEqual([1, 2]);
      expect(stats.hasGaps).toBe(false);
      expect(stats.hasMalformed).toBe(false);
      expect(stats.errors).toHaveLength(0);
    });

    it('should detect gaps in stats', () => {
      const text = '{{c1::One}} {{c3::Three}}';
      const stats = clozeService.getStats(text);
      
      expect(stats.hasGaps).toBe(true);
      expect(stats.totalClozes).toBe(2);
    });

    it('should handle empty text', () => {
      const stats = clozeService.getStats('');
      
      expect(stats.totalClozes).toBe(0);
      expect(stats.indices).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large cloze numbers', () => {
      const text = '{{c999::Last}}';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toContain(999);
    });

    it('should handle text with special characters', () => {
      const text = '{{c1::C++ & JavaScript}} are languages';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toHaveLength(1);
    });

    it('should handle HTML in cloze deletions', () => {
      const text = '{{c1::<b>Bold text</b>}} is formatted';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toHaveLength(1);
    });

    it('should handle empty string', () => {
      const indices = clozeService.listClozeIndices('');
      expect(indices).toEqual([]);
    });

    it('should handle Unicode characters', () => {
      const text = '{{c1::日本語}} means Japanese';
      const indices = clozeService.listClozeIndices(text);
      
      expect(indices).toHaveLength(1);
    });
  });
});
