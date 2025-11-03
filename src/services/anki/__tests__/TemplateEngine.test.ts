/**
 * Tests for TemplateEngine - Anki template rendering
 */

import { render, registerFilter } from '../TemplateEngine';
import { Model, AnkiNote } from '../schema';

describe('TemplateEngine', () => {
  // Test model with basic templates
  const basicModel: Model = {
    id: 1,
    name: 'Basic',
    type: 0, // Standard model
    mod: Date.now(),
    usn: -1,
    sortf: 0,
    did: '1',
    tmpls: [
      {
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
      },
    ],
    flds: [
      { name: 'Front', ord: 0, sticky: false, rtl: false, font: '', size: 0, description: '' },
      { name: 'Back', ord: 1, sticky: false, rtl: false, font: '', size: 0, description: '' },
    ],
    css: '',
    latexPre: '',
    latexPost: '',
    req: [],
    tags: [],
  };

  const testNote: AnkiNote = {
    id: 'note1',
    guid: 'guid1',
    mid: 1,
    mod: Date.now(),
    usn: -1,
    tags: '',
    flds: 'What is 2+2?\x1f4',
    sfld: 0,
    csum: 0,
    flags: 0,
    data: '',
  };

  describe('field substitution', () => {
    it('replaces {{FieldName}} with field content', () => {
      const result = render(basicModel, testNote, 0, 'q');
      expect(result.front).toBe('What is 2+2?');
    });

    it('handles case-insensitive field names', () => {
      const model: Model = {
        ...basicModel,
        tmpls: [{
          ...basicModel.tmpls[0],
          qfmt: '{{FRONT}} / {{back}}', // Mixed case
        }],
      };
      
      const result = render(model, testNote, 0, 'q');
      expect(result.front).toBe('What is 2+2? / 4');
    });

    it('returns empty string for missing fields', () => {
      const model: Model = {
        ...basicModel,
        tmpls: [{
          ...basicModel.tmpls[0],
          qfmt: '{{NonexistentField}}',
        }],
      };
      
      const result = render(model, testNote, 0, 'q');
      expect(result.front).toBe('');
    });
  });

  describe('FrontSide substitution', () => {
    it('replaces {{FrontSide}} on back with rendered front', () => {
      const result = render(basicModel, testNote, 0, 'a');
      expect(result.back).toContain('What is 2+2?'); // From FrontSide
      expect(result.back).toContain('4'); // From Back field
    });

    it('includes HTML from front in FrontSide', () => {
      const noteWithHtml: AnkiNote = {
        ...testNote,
        flds: '<b>Bold Front</b>\x1fPlain Back',
      };
      
      const result = render(basicModel, noteWithHtml, 0, 'a');
      expect(result.back).toContain('<b>Bold Front</b>');
    });
  });

  describe('conditional sections', () => {
    const modelWithSections: Model = {
      ...basicModel,
      tmpls: [{
        ...basicModel.tmpls[0],
        qfmt: '{{#Front}}Front exists{{/Front}}{{^Front}}No front{{/Front}}',
      }],
    };

    it('shows content in {{#Field}} when field has content', () => {
      const result = render(modelWithSections, testNote, 0, 'q');
      expect(result.front).toBe('Front exists');
    });

    it('hides content in {{#Field}} when field is empty', () => {
      const emptyNote: AnkiNote = {
        ...testNote,
        flds: '\x1f4', // Empty front
      };
      
      const result = render(modelWithSections, emptyNote, 0, 'q');
      expect(result.front).toBe('No front');
    });

    it('shows content in {{^Field}} when field is empty', () => {
      const model: Model = {
        ...basicModel,
        tmpls: [{
          ...basicModel.tmpls[0],
          qfmt: '{{^Back}}No back{{/Back}}',
        }],
      };
      
      const emptyBackNote: AnkiNote = {
        ...testNote,
        flds: 'Front\x1f', // Empty back
      };
      
      const result = render(model, emptyBackNote, 0, 'q');
      expect(result.front).toBe('No back');
    });

    it('treats fields with only HTML tags as empty', () => {
      const htmlOnlyNote: AnkiNote = {
        ...testNote,
        flds: '<br><div></div>\x1f4', // Only HTML, no text
      };
      
      const result = render(modelWithSections, htmlOnlyNote, 0, 'q');
      expect(result.front).toBe('No front');
    });
  });

  describe('filters', () => {
    describe('text filter', () => {
      it('strips HTML tags', () => {
        const model: Model = {
          ...basicModel,
          tmpls: [{
            ...basicModel.tmpls[0],
            qfmt: '{{text:Front}}',
          }],
        };
        
        const htmlNote: AnkiNote = {
          ...testNote,
          flds: '<b>Bold</b> and <i>italic</i>\x1fBack',
        };
        
        const result = render(model, htmlNote, 0, 'q');
        expect(result.front).toBe('Bold and italic');
      });
    });

    describe('type filter', () => {
      it('returns field content unchanged', () => {
        const model: Model = {
          ...basicModel,
          tmpls: [{
            ...basicModel.tmpls[0],
            qfmt: '{{type:Front}}',
          }],
        };
        
        const result = render(model, testNote, 0, 'q');
        expect(result.front).toBe('What is 2+2?');
      });
    });

    describe('cloze filter', () => {
      const clozeModel: Model = {
        ...basicModel,
        id: 2,
        name: 'Cloze',
        type: 1, // Cloze model
        tmpls: [{
          name: 'Cloze',
          ord: 0,
          qfmt: '{{cloze:Text}}',
          afmt: '{{cloze:Text}}',
          bqfmt: '',
          bafmt: '',
          did: null,
        }],
        flds: [
          { name: 'Text', ord: 0, sticky: false, rtl: false, font: '', size: 0, description: '' },
        ],
      };

      it('hides active cloze on front', () => {
        const clozeNote: AnkiNote = {
          ...testNote,
          flds: 'The capital of France is {{c1::Paris}}',
        };
        
        const result = render(clozeModel, clozeNote, 0, 'q'); // ord=0 -> c1
        expect(result.front).toContain('[...]');
        expect(result.front).not.toContain('Paris');
      });

      it('shows all cloze deletions on back', () => {
        const clozeNote: AnkiNote = {
          ...testNote,
          flds: 'The capital of France is {{c1::Paris}}',
        };
        
        const result = render(clozeModel, clozeNote, 0, 'a');
        expect(result.back).toContain('Paris');
        expect(result.back).not.toContain('{{c1::');
      });

      it('shows inactive cloze as plain text on front', () => {
        const clozeNote: AnkiNote = {
          ...testNote,
          flds: '{{c1::Paris}} is the capital of {{c2::France}}',
        };
        
        const result = render(clozeModel, clozeNote, 0, 'q'); // c1 active
        expect(result.front).toContain('[...]'); // c1 hidden
        expect(result.front).toContain('France'); // c2 shown
      });

      it('handles cloze with hints', () => {
        const clozeNote: AnkiNote = {
          ...testNote,
          flds: 'The capital of France is {{c1::Paris::city}}',
        };
        
        const result = render(clozeModel, clozeNote, 0, 'q');
        expect(result.front).toContain('[city]'); // Hint shown
        expect(result.front).not.toContain('Paris');
      });

      it('handles multiple cloze deletions', () => {
        const clozeNote: AnkiNote = {
          ...testNote,
          flds: '{{c1::Paris}} is in {{c2::France}} which is in {{c3::Europe}}',
        };
        
        // Test c1 active (ord=0)
        const result1 = render(clozeModel, clozeNote, 0, 'q');
        expect(result1.front).toContain('[...]'); // c1 hidden
        expect(result1.front).toContain('France'); // c2 shown
        expect(result1.front).toContain('Europe'); // c3 shown
      });
    });

    describe('custom filters', () => {
      it('allows registering custom filters', () => {
        registerFilter('uppercase', (content) => content.toUpperCase());
        
        const model: Model = {
          ...basicModel,
          tmpls: [{
            ...basicModel.tmpls[0],
            qfmt: '{{uppercase:Front}}',
          }],
        };
        
        const result = render(model, testNote, 0, 'q');
        expect(result.front).toBe('WHAT IS 2+2?');
      });
    });

    describe('unknown filters', () => {
      it('passes through content for unknown filters', () => {
        const model: Model = {
          ...basicModel,
          tmpls: [{
            ...basicModel.tmpls[0],
            qfmt: '{{unknownfilter:Front}}',
          }],
        };
        
        const result = render(model, testNote, 0, 'q');
        expect(result.front).toBe('What is 2+2?'); // Unchanged
      });
    });
  });

  describe('error handling', () => {
    it('falls back to first two fields when template is missing', () => {
      const modelWithoutTemplate: Model = {
        ...basicModel,
        tmpls: [], // No templates
      };
      
      const result = render(modelWithoutTemplate, testNote, 0, 'q');
      expect(result.front).toBe('What is 2+2?');
      expect(result.back).toBe('4');
    });

    it('handles empty notes gracefully', () => {
      const emptyNote: AnkiNote = {
        ...testNote,
        flds: '\x1f', // Two empty fields
      };
      
      const result = render(basicModel, emptyNote, 0, 'q');
      expect(result.front).toBe('');
      // Back still has template HTML even if fields are empty
      expect(result.back).toContain('<hr id="answer">');
    });
  });

  describe('complex templates', () => {
    it('handles reversed card model', () => {
      const reversedModel: Model = {
        ...basicModel,
        tmpls: [
          // Card 1: Front -> Back
          {
            name: 'Card 1',
            ord: 0,
            qfmt: '{{Front}}',
            afmt: '{{FrontSide}}<hr>{{Back}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
          // Card 2: Back -> Front (reversed)
          {
            name: 'Card 2',
            ord: 1,
            qfmt: '{{Back}}',
            afmt: '{{FrontSide}}<hr>{{Front}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
      };
      
      // First card (normal)
      const result1 = render(reversedModel, testNote, 0, 'q');
      expect(result1.front).toBe('What is 2+2?');
      
      // Second card (reversed)
      const result2 = render(reversedModel, testNote, 1, 'q');
      expect(result2.front).toBe('4');
      expect(render(reversedModel, testNote, 1, 'a').back).toContain('What is 2+2?');
    });
  });
});
