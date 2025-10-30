/**
 * Test suite for HintsSanitizer
 * Tests content validation, HTML stripping, entity decoding, and skip reason messages
 */

import { sanitizeHintsInput, getSkipReasonMessage } from '../HintsSanitizer';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('HintsSanitizer', () => {
  describe('basic cards', () => {
    it('accepts valid basic cards with text content', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'What is JavaScript?',
          back: 'A programming language',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]).toEqual({
        id: 'card1',
        model: 'basic',
        front: 'What is JavaScript?',
        back: 'A programming language',
      });
      expect(result.skipped).toHaveLength(0);
    });

    it('strips HTML tags from basic cards', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: '<b>Question</b>',
          back: '<i>Answer</i>',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].front).toBe('Question');
      expect(result.valid[0].back).toBe('Answer');
    });

    it('decodes HTML entities', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'Test&nbsp;&amp;&lt;&gt;',
          back: '&quot;Answer&quot;',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].front).toBe('Test &<>'); // No spaces between entities in input
      expect(result.valid[0].back).toBe('"Answer"');
    });

    it('collapses multiple whitespace', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'Multiple    spaces',
          back: 'Also   multiple   spaces',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].front).toBe('Multiple spaces');
      expect(result.valid[0].back).toBe('Also multiple spaces');
    });

    it('skips cards with image-only back', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'What is this?',
          back: '[img]',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toEqual({
        id: 'card1',
        reason: 'image-only-answer',
      });
    });

    it('skips cards with [image] tag', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'Question',
          back: '[image]',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('image-only-answer');
    });

    it('skips cards with <img tag', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'Question',
          back: '<img src="test.jpg">',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('image-only-answer');
    });

    it('skips cards with sound reference', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'Question',
          back: '[sound:audio.mp3]',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('image-only-answer');
    });

    it('skips cards with empty front or back', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: '',
          back: 'Answer',
        },
        {
          id: 'card2',
          model: 'basic' as const,
          front: 'Question',
          back: '',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(0);
      expect(result.skipped).toHaveLength(2);
      expect(result.skipped[0].reason).toBe('empty-content'); // Empty front
      expect(result.skipped[1].reason).toBe('image-only-answer'); // Empty back (treated as image-only)
    });

    it('skips cards with non-substantive text (less than 3 alphanumeric chars)', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'AB',
          back: 'Answer',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('empty-content');
    });

    it('accepts cards with at least 3 alphanumeric characters', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: 'ABC',
          back: 'DEF',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
    });
  });

  describe('cloze cards', () => {
    it('accepts valid cloze cards with cloze mask', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: 'Paris is the capital of {{c1::France}}',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]).toEqual({
        id: 'card1',
        model: 'cloze',
        cloze: 'Paris is the capital of {{c1::France}}',
      });
      expect(result.skipped).toHaveLength(0);
    });

    it('accepts multiple cloze deletions', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: '{{c1::Paris}} is the capital of {{c2::France}}',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
    });

    it('strips HTML from cloze cards', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: '<b>{{c1::Paris}}</b> is the capital',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].cloze).toContain('{{c1::Paris}}');
      expect(result.valid[0].cloze).not.toContain('<b>');
    });

    it('skips cloze cards without cloze mask', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: 'Paris is the capital of France',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toEqual({
        id: 'card1',
        reason: 'no-cloze-mask',
      });
    });

    it('skips cloze cards with malformed cloze syntax', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: 'Paris is the capital of {c1::France}', // Missing one brace
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('no-cloze-mask');
    });

    it('skips empty cloze cards', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: '',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('no-cloze-mask');
    });

    it('skips cloze cards with only whitespace', () => {
      const items = [
        {
          id: 'card1',
          model: 'cloze' as const,
          cloze: '   \n\n   ',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped[0].reason).toBe('no-cloze-mask');
    });
  });

  describe('mixed validation', () => {
    it('processes mix of valid and invalid items', () => {
      const items = [
        {
          id: 'valid1',
          model: 'basic' as const,
          front: 'Question 1',
          back: 'Answer 1',
        },
        {
          id: 'invalid1',
          model: 'basic' as const,
          front: 'Question 2',
          back: '[img]',
        },
        {
          id: 'valid2',
          model: 'cloze' as const,
          cloze: 'Test {{c1::content}}',
        },
        {
          id: 'invalid2',
          model: 'cloze' as const,
          cloze: 'No cloze here',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(2);
      expect(result.valid.map(v => v.id)).toEqual(['valid1', 'valid2']);
      
      expect(result.skipped).toHaveLength(2);
      expect(result.skipped.map(s => s.id)).toEqual(['invalid1', 'invalid2']);
    });
  });

  describe('error handling', () => {
    it('handles invalid HTML gracefully', () => {
      const items = [
        {
          id: 'card1',
          model: 'basic' as const,
          front: null as any, // Invalid input
          back: 'Answer',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('empty-content');
    });

    it('continues processing after error', () => {
      const items = [
        {
          id: 'bad',
          model: 'basic' as const,
          front: null as any,
          back: 'Answer',
        },
        {
          id: 'good',
          model: 'basic' as const,
          front: 'Question',
          back: 'Answer',
        },
      ];

      const result = sanitizeHintsInput(items);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].id).toBe('good');
      expect(result.skipped).toHaveLength(1);
    });
  });

  describe('getSkipReasonMessage', () => {
    it('returns correct message for image-only-answer', () => {
      const message = getSkipReasonMessage('image-only-answer');
      expect(message).toBe('Answer contains only images - needs text');
    });

    it('returns correct message for no-cloze-mask', () => {
      const message = getSkipReasonMessage('no-cloze-mask');
      expect(message).toBe('Missing cloze deletion ({{c1::...}})');
    });

    it('returns correct message for empty-content', () => {
      const message = getSkipReasonMessage('empty-content');
      expect(message).toBe('Card has no substantive text content');
    });

    it('returns correct message for invalid-html', () => {
      const message = getSkipReasonMessage('invalid-html');
      expect(message).toBe('Failed to parse card content');
    });

    it('returns default message for unknown reason', () => {
      const message = getSkipReasonMessage('unknown' as any);
      expect(message).toBe('Unable to process this card');
    });
  });
});
