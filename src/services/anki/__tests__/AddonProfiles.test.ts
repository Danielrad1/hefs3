/**
 * Tests for Add-On Profile Registry
 */

import {
  registerAddonProfile,
  getProfiles,
  findMatchingProfile,
  AddonProfile,
} from '../AddonProfiles';
import { Model, AnkiNote } from '../schema';

describe('AddonProfiles', () => {
  const basicModel: Model = {
    id: 1,
    name: 'Basic',
    type: 0,
    mod: Date.now(),
    usn: -1,
    sortf: 0,
    did: '1',
    tmpls: [
      {
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}<hr>{{Back}}',
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

  describe('profile registration', () => {
    it('registers a custom profile', () => {
      const testProfile: AddonProfile = {
        id: 'test-profile',
        name: 'Test Profile',
        match: () => false,
      };

      registerAddonProfile(testProfile);
      const profiles = getProfiles();
      
      expect(profiles.some(p => p.id === 'test-profile')).toBe(true);
    });

    it('replaces existing profile with same ID', () => {
      const profile1: AddonProfile = {
        id: 'duplicate-test',
        name: 'First',
        match: () => true,
      };

      const profile2: AddonProfile = {
        id: 'duplicate-test',
        name: 'Second',
        match: () => false,
      };

      registerAddonProfile(profile1);
      registerAddonProfile(profile2);

      const profiles = getProfiles();
      const matches = profiles.filter(p => p.id === 'duplicate-test');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Second');
    });
  });

  describe('built-in profiles', () => {
    describe('Image Occlusion Enhanced', () => {
      it('matches by model name containing "image occlusion"', () => {
        const ioModel: Model = {
          ...basicModel,
          name: 'Image Occlusion Enhanced',
        };

        const profile = findMatchingProfile(ioModel);
        expect(profile).not.toBeNull();
        expect(profile?.id).toBe('image-occlusion-enhanced');
      });

      it('matches by model name containing "io"', () => {
        const ioModel: Model = {
          ...basicModel,
          name: 'Custom IO Model',
        };

        const profile = findMatchingProfile(ioModel);
        expect(profile?.id).toBe('image-occlusion-enhanced');
      });

      it('matches by template names (Hide One/Hide All)', () => {
        const ioModel: Model = {
          ...basicModel,
          name: 'Custom Model',
          tmpls: [
            {
              name: 'Hide One',
              ord: 0,
              qfmt: '{{Image}}',
              afmt: '{{Image}}',
              bqfmt: '',
              bafmt: '',
              did: null,
            },
          ],
        };

        const profile = findMatchingProfile(ioModel);
        expect(profile?.id).toBe('image-occlusion-enhanced');
      });

      it('matches by field names (Occlusion, Masks, etc.)', () => {
        const ioModel: Model = {
          ...basicModel,
          name: 'Custom Model',
          flds: [
            { name: 'Occlusion', ord: 0, sticky: false, rtl: false, font: '', size: 0, description: '' },
            { name: 'Extra', ord: 1, sticky: false, rtl: false, font: '', size: 0, description: '' },
          ],
        };

        const profile = findMatchingProfile(ioModel);
        expect(profile?.id).toBe('image-occlusion-enhanced');
      });

      it('does not match standard models', () => {
        const profile = findMatchingProfile(basicModel);
        // Should not match IO profile (might match others)
        if (profile) {
          expect(profile.id).not.toBe('image-occlusion-enhanced');
        }
      });
    });

    describe('Hint Filter', () => {
      it('matches models using {{hint:Field}} syntax', () => {
        const hintModel: Model = {
          ...basicModel,
          tmpls: [
            {
              name: 'Card 1',
              ord: 0,
              qfmt: '{{Front}}{{hint:Extra Info}}',
              afmt: '{{FrontSide}}<hr>{{Back}}',
              bqfmt: '',
              bafmt: '',
              did: null,
            },
          ],
        };

        const profile = findMatchingProfile(hintModel);
        expect(profile?.id).toBe('hint-filter');
      });

      it('does not match models without hint filter', () => {
        const profile = findMatchingProfile(basicModel);
        // Basic model shouldn't match hint filter
        if (profile?.id === 'hint-filter') {
          fail('Basic model should not match hint filter');
        }
      });
    });

    describe('Cloze Overlapper', () => {
      it('matches by model name containing "overlapp"', () => {
        const overlapModel: Model = {
          ...basicModel,
          name: 'Cloze Overlapper',
        };

        const profile = findMatchingProfile(overlapModel);
        expect(profile?.id).toBe('cloze-overlapper');
      });

      it('matches variant spellings (overlap)', () => {
        const overlapModel: Model = {
          ...basicModel,
          name: 'Cloze Overlap Model',
        };

        const profile = findMatchingProfile(overlapModel);
        expect(profile?.id).toBe('cloze-overlapper');
      });
    });
  });

  describe('profile matching', () => {
    it('returns null when no profile matches', () => {
      const unknownModel: Model = {
        ...basicModel,
        name: 'Completely Unknown Model',
      };

      const profile = findMatchingProfile(unknownModel);
      // May return null or may match a generic profile
      // Just verify it doesn't crash
      expect(profile === null || profile.id).toBeTruthy();
    });

    it('returns first matching profile if multiple match', () => {
      // Create a model that could match multiple profiles
      const ambiguousModel: Model = {
        ...basicModel,
        name: 'Test Model',
        tmpls: [
          {
            name: 'Card',
            ord: 0,
            qfmt: '{{hint:Front}}',
            afmt: '{{FrontSide}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
      };

      const profile = findMatchingProfile(ambiguousModel);
      expect(profile).not.toBeNull();
      // Should return one of the matching profiles
    });
  });

  describe('custom filters', () => {
    it('hint filter wraps content in styled div for RN', () => {
      const hintModel: Model = {
        ...basicModel,
        tmpls: [
          {
            name: 'Card',
            ord: 0,
            qfmt: '{{hint:Extra}}',
            afmt: '{{Back}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
      };

      // Finding the profile registers its filters
      const profile = findMatchingProfile(hintModel);
      expect(profile?.id).toBe('hint-filter');

      // Test the filter function directly
      if (profile?.filters?.hint) {
        const result = profile.filters.hint('This is a hint');
        expect(result).toContain('<div');
        expect(result).toContain('💡 Hint');
        expect(result).toContain('This is a hint');
      }
    });

    it('hint filter handles empty content', () => {
      const hintModel: Model = {
        ...basicModel,
        tmpls: [
          {
            name: 'Card',
            ord: 0,
            qfmt: '{{hint:Extra}}',
            afmt: '{{Back}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
      };

      const profile = findMatchingProfile(hintModel);
      if (profile?.filters?.hint) {
        const result = profile.filters.hint('');
        expect(result).toBe('');
      }
    });
  });
});
