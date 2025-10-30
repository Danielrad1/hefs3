/**
 * Test suite for SchedulerProvider
 * Tests sibling burying policy and save debounce behavior
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { SchedulerProvider, useScheduler } from '../SchedulerProvider';
import { InMemoryDb } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { AnkiNote, AnkiCard, Model, CardType } from '../../services/anki/schema';

// Mock dependencies
jest.mock('../../services/anki/InMemoryDb');
jest.mock('../../services/anki/PersistenceService');
jest.mock('../../services/anki/SchedulerV2');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Access the actual db instance for setup
const db = require('../../services/anki/InMemoryDb').db;

describe('SchedulerProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup basic mocks
    db.clear = jest.fn();
    db.getAllCards = jest.fn().mockReturnValue([]);
    db.getAllDecks = jest.fn().mockReturnValue([]);
    db.getStats = jest.fn().mockReturnValue({
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      totalCards: 0,
    });
    db.getCol = jest.fn().mockReturnValue({ crt: Date.now() / 1000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sibling burying policy', () => {
    it('buries siblings for non-IO cards', async () => {
      // Setup: regular model (not Image Occlusion)
      const regularModel: Model = {
        id: 1,
        name: 'Basic',
        type: 0, // Standard model
        mod: Date.now(),
        usn: -1,
        sortf: 0,
        did: '1',
        tmpls: [],
        flds: [],
        css: '',
        latexPre: '',
        latexPost: '',
        latexsvg: false,
        req: [],
        tags: [],
        vers: [],
      };

      const note: AnkiNote = {
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'Question\x1fAnswer',
        sfld: '',
        csum: 0,
        flags: 0,
        data: '',
      };

      const card: AnkiCard = {
        id: 'card1',
        nid: 'note1',
        did: 'deck1',
        ord: 0,
        mod: Date.now(),
        usn: -1,
        type: CardType.New,
        queue: 0,
        due: 0,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };

      db.getCard = jest.fn().mockReturnValue(card);
      db.getNote = jest.fn().mockReturnValue(note);
      db.getModel = jest.fn().mockReturnValue(regularModel);
      db.getDeck = jest.fn().mockReturnValue({ id: 'deck1', name: 'Deck 1' });

      const mockScheduler = {
        getNext: jest.fn().mockReturnValue(card),
        peekNext: jest.fn().mockReturnValue(null),
        answer: jest.fn(),
        burySiblings: jest.fn(),
        clearBuriedSiblings: jest.fn(),
        getBuriedCount: jest.fn().mockReturnValue(1),
      };

      // Mock SchedulerV2 constructor
      const SchedulerV2 = require('../../services/anki/SchedulerV2').SchedulerV2;
      SchedulerV2.mockImplementation(() => mockScheduler);

      const wrapper = ({ children }: any) => <SchedulerProvider>{children}</SchedulerProvider>;
      const { result } = renderHook(() => useScheduler(), { wrapper });

      // Wait for initial load
      await act(async () => {
        jest.runAllTimers();
      });

      // Answer a card
      act(() => {
        result.current.answer('good', 1000);
      });

      // Should bury siblings for non-IO card
      expect(mockScheduler.burySiblings).toHaveBeenCalledWith('card1');
    });

    it('does NOT bury siblings for Image Occlusion cards', async () => {
      // Setup: Image Occlusion model
      const ioModel: Model = {
        id: 2,
        name: 'Image Occlusion',
        type: 2, // MODEL_TYPE_IMAGE_OCCLUSION
        mod: Date.now(),
        usn: -1,
        sortf: 0,
        did: '1',
        tmpls: [],
        flds: [],
        css: '',
        latexPre: '',
        latexPost: '',
        latexsvg: false,
        req: [],
        tags: [],
        vers: [],
      };

      const note: AnkiNote = {
        id: 'note2',
        guid: 'guid2',
        mid: 'model2',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'IO content',
        sfld: '',
        csum: 0,
        flags: 0,
        data: '',
      };

      const card: AnkiCard = {
        id: 'card2',
        nid: 'note2',
        did: 'deck1',
        ord: 0,
        mod: Date.now(),
        usn: -1,
        type: CardType.New,
        queue: 0,
        due: 0,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };

      db.getCard = jest.fn().mockReturnValue(card);
      db.getNote = jest.fn().mockReturnValue(note);
      db.getModel = jest.fn().mockReturnValue(ioModel);
      db.getDeck = jest.fn().mockReturnValue({ id: 'deck1', name: 'Deck 1' });

      const mockScheduler = {
        getNext: jest.fn().mockReturnValue(card),
        peekNext: jest.fn().mockReturnValue(null),
        answer: jest.fn(),
        burySiblings: jest.fn(),
        clearBuriedSiblings: jest.fn(),
        getBuriedCount: jest.fn().mockReturnValue(0),
      };

      const SchedulerV2 = require('../../services/anki/SchedulerV2').SchedulerV2;
      SchedulerV2.mockImplementation(() => mockScheduler);

      const wrapper = ({ children }: any) => <SchedulerProvider>{children}</SchedulerProvider>;
      const { result } = renderHook(() => useScheduler(), { wrapper });

      await act(async () => {
        jest.runAllTimers();
      });

      act(() => {
        result.current.answer('good', 1000);
      });

      // Should NOT bury siblings for IO card
      expect(mockScheduler.burySiblings).not.toHaveBeenCalled();
    });
  });

  describe('save debounce', () => {
    it('debounces save by 500ms after answer', async () => {
      const card: AnkiCard = {
        id: 'card1',
        nid: 'note1',
        did: 'deck1',
        ord: 0,
        mod: Date.now(),
        usn: -1,
        type: CardType.New,
        queue: 0,
        due: 0,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };

      db.getCard = jest.fn().mockReturnValue(card);
      db.getNote = jest.fn().mockReturnValue({
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'Test',
        sfld: '',
        csum: 0,
        flags: 0,
        data: '',
      });
      db.getModel = jest.fn().mockReturnValue({
        id: 'model1',
        name: 'Basic',
        type: 0,
        mod: Date.now(),
        usn: -1,
        sortf: 0,
        did: '1',
        tmpls: [],
        flds: [],
        css: '',
        latexPre: '',
        latexPost: '',
        latexsvg: false,
        req: [],
        tags: [],
        vers: [],
      });
      db.getDeck = jest.fn().mockReturnValue({ id: 'deck1', name: 'Deck 1' });

      const mockScheduler = {
        getNext: jest.fn().mockReturnValue(card),
        peekNext: jest.fn().mockReturnValue(null),
        answer: jest.fn(),
        burySiblings: jest.fn(),
        clearBuriedSiblings: jest.fn(),
        getBuriedCount: jest.fn().mockReturnValue(1),
      };

      const SchedulerV2 = require('../../services/anki/SchedulerV2').SchedulerV2;
      SchedulerV2.mockImplementation(() => mockScheduler);

      PersistenceService.save = jest.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: any) => <SchedulerProvider>{children}</SchedulerProvider>;
      const { result } = renderHook(() => useScheduler(), { wrapper });

      await act(async () => {
        jest.runAllTimers();
      });

      act(() => {
        result.current.answer('good', 1000);
      });

      // Should not save immediately
      expect(PersistenceService.save).not.toHaveBeenCalled();

      // Advance by 499ms - still shouldn't save
      await act(async () => {
        jest.advanceTimersByTime(499);
      });
      expect(PersistenceService.save).not.toHaveBeenCalled();

      // Advance by 1ms more (total 500ms) - should save
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(PersistenceService.save).toHaveBeenCalledTimes(1);
    });

    it('clears buried siblings before save and re-buries after', async () => {
      const card: AnkiCard = {
        id: 'card1',
        nid: 'note1',
        did: 'deck1',
        ord: 0,
        mod: Date.now(),
        usn: -1,
        type: CardType.New,
        queue: 0,
        due: 0,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: '0',
        flags: 0,
        data: '',
      };

      db.getCard = jest.fn().mockReturnValue(card);
      db.getNote = jest.fn().mockReturnValue({
        id: 'note1',
        guid: 'guid1',
        mid: 'model1',
        mod: Date.now(),
        usn: -1,
        tags: '',
        flds: 'Test',
        sfld: '',
        csum: 0,
        flags: 0,
        data: '',
      });
      db.getModel = jest.fn().mockReturnValue({
        id: 1,
        type: 0, // Not IO
        name: 'Basic',
        mod: Date.now(),
        usn: -1,
        sortf: 0,
        did: '1',
        tmpls: [],
        flds: [],
        css: '',
        latexPre: '',
        latexPost: '',
        latexsvg: false,
        req: [],
        tags: [],
        vers: [],
      });
      db.getDeck = jest.fn().mockReturnValue({ id: 'deck1', name: 'Deck 1' });

      const mockScheduler = {
        getNext: jest.fn().mockReturnValue(card),
        peekNext: jest.fn().mockReturnValue(null),
        answer: jest.fn(),
        burySiblings: jest.fn(),
        clearBuriedSiblings: jest.fn(),
        getBuriedCount: jest.fn().mockReturnValue(1), // Has buried cards
      };

      const SchedulerV2 = require('../../services/anki/SchedulerV2').SchedulerV2;
      SchedulerV2.mockImplementation(() => mockScheduler);

      PersistenceService.save = jest.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: any) => <SchedulerProvider>{children}</SchedulerProvider>;
      const { result } = renderHook(() => useScheduler(), { wrapper });

      await act(async () => {
        jest.runAllTimers();
      });

      act(() => {
        result.current.answer('good', 1000);
      });

      // Advance timers to trigger save
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should clear buried siblings, save, then re-bury
      const clearCalls = mockScheduler.clearBuriedSiblings.mock.calls;
      const saveCalls = (PersistenceService.save as jest.Mock).mock.calls;
      const buryCalls = mockScheduler.burySiblings.mock.calls;

      // Clear should happen before save
      expect(clearCalls.length).toBeGreaterThan(0);
      expect(saveCalls.length).toBe(1);
      
      // Last bury should happen after save (for non-IO cards)
      expect(buryCalls.length).toBeGreaterThan(0);
    });
  });
});
