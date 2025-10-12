/**
 * CardBrowserScreen Component Tests - Fixed with proper mocks
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CardBrowserScreen from '../CardBrowserScreen';
import { db } from '../../../services/anki/InMemoryDb';
import { createTestCard, createTestNote, createTestDeck } from '../../../services/anki/__tests__/helpers/factories';

// Mock SchedulerProvider to prevent crashes
jest.mock('../../../context/SchedulerProvider', () => ({
  useScheduler: () => ({
    current: null,
    next: null,
    cardType: null,
    currentDeckId: null,
    nextCardDueInSeconds: null,
    answer: jest.fn(),
    bootstrap: jest.fn(),
    setDeck: jest.fn(),
    reload: jest.fn(),
    stats: {
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      totalCards: 0,
    },
    decks: [],
  }),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('CardBrowserScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.clear();
  });

  describe('Card List', () => {
    it('should render list of cards', () => {
      const note = createTestNote({
        id: 'note1',
        flds: 'Front Text\x1fBack Text',
      });
      db.addNote(note);
      
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
      });
      db.addCard(card);

      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText(/Front Text/)).toBeTruthy();
    });

    it('should show empty state when no cards', () => {
      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText(/No cards/i)).toBeTruthy();
    });

    it('should display card count', () => {
      // Add 3 cards
      for (let i = 1; i <= 3; i++) {
        const note = createTestNote({ id: `note${i}` });
        db.addNote(note);
        db.addCard(createTestCard({ id: `card${i}`, nid: `note${i}`, did: '1' }));
      }

      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText(/3/)).toBeTruthy();
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete confirmation on trash icon press', () => {
      const note = createTestNote({ id: 'note1', flds: 'Test Card\x1fBack' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: '1' });
      db.addCard(card);

      const { getAllByLabelText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const deleteButtons = getAllByLabelText('Delete card');
      fireEvent.press(deleteButtons[0]);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Card',
        expect.stringContaining('cannot be undone'),
        expect.any(Array)
      );
    });

    it('should show different message for multi-card notes', () => {
      const note = createTestNote({
        id: 'note1',
        mid: 2, // Cloze
        flds: '{{c1::One}} {{c2::Two}}\x1fExtra',
      });
      db.addNote(note);
      
      db.addCard(createTestCard({ id: 'card1', nid: 'note1', did: '1', ord: 0 }));
      db.addCard(createTestCard({ id: 'card2', nid: 'note1', did: '1', ord: 1 }));

      const { getAllByLabelText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const deleteButtons = getAllByLabelText('Delete card');
      fireEvent.press(deleteButtons[0]);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Card',
        expect.stringContaining('2 cards'),
        expect.any(Array)
      );
    });

    it('should cancel deletion when cancel pressed', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: '1' });
      db.addCard(card);

      const { getAllByLabelText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const deleteButtons = getAllByLabelText('Delete card');
      fireEvent.press(deleteButtons[0]);

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[alertCalls.length - 1][2];
      const cancelButton = buttons.find((b: any) => b.text === 'Cancel');
      
      if (cancelButton && cancelButton.onPress) {
        cancelButton.onPress();
      }

      expect(db.getCard('card1')).toBeDefined();
    });

    it('should delete card when confirmed', async () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: '1' });
      db.addCard(card);

      const { getAllByLabelText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const deleteButtons = getAllByLabelText('Delete card');
      fireEvent.press(deleteButtons[0]);

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[alertCalls.length - 1][2];
      const deleteButton = buttons.find((b: any) => b.text === 'Delete');
      
      if (deleteButton && deleteButton.onPress) {
        await deleteButton.onPress();
      }

      await waitFor(() => {
        expect(db.getCard('card1')).toBeUndefined();
      });
    });
  });

  describe('Card Navigation', () => {
    it('should navigate to note editor on card press', () => {
      const note = createTestNote({ id: 'note1', flds: 'Front\x1fBack' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: '1' });
      db.addCard(card);

      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      fireEvent.press(getByText(/Front/));

      expect(mockNavigate).toHaveBeenCalledWith('NoteEditor', {
        noteId: 'note1',
        deckId: '1',
      });
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should render search input', () => {
      const { getByPlaceholderText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByPlaceholderText(/Search/i)).toBeTruthy();
    });

    it('should filter cards by search text', async () => {
      const note1 = createTestNote({ id: 'note1', flds: 'Apple\x1fFruit' });
      const note2 = createTestNote({ id: 'note2', flds: 'Banana\x1fFruit' });
      db.addNote(note1);
      db.addNote(note2);
      db.addCard(createTestCard({ id: 'card1', nid: 'note1', did: '1' }));
      db.addCard(createTestCard({ id: 'card2', nid: 'note2', did: '1' }));

      const { getByPlaceholderText, queryByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const searchInput = getByPlaceholderText(/Search/i);
      fireEvent.changeText(searchInput, 'Apple');

      // Advance timers for debounce
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(queryByText(/Apple/)).toBeTruthy();
        expect(queryByText(/Banana/)).toBeFalsy();
      });
    });
  });

  describe('Card Metadata Display', () => {
    it('should show deck name', () => {
      const deck = createTestDeck('Spanish Vocabulary');
      db.addDeck(deck);

      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: deck.id });
      db.addCard(card);

      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: deck.id } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText(/Spanish Vocabulary/)).toBeTruthy();
    });

    it('should show card type badge', () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
        did: '1',
        type: 0, // New card
      });
      db.addCard(card);

      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText(/New/i)).toBeTruthy();
    });
  });

  describe('FAB Button', () => {
    it('should show FAB when deckId provided', () => {
      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      expect(getByText('+')).toBeTruthy();
    });

    it('should navigate to note editor on FAB press', () => {
      const { getByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      fireEvent.press(getByText('+'));

      expect(mockNavigate).toHaveBeenCalledWith('NoteEditor', {
        deckId: '1',
        modelId: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing note gracefully', () => {
      const card = createTestCard({ id: 'card1', nid: 'missing-note', did: '1' });
      db.addCard(card);

      const { queryByText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      // Should show empty state
      expect(queryByText(/No cards/i)).toBeTruthy();
    });

    it('should show error alert if deletion fails', async () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: '1' });
      db.addCard(card);

      // Force deletion to fail by removing note first
      db.deleteNote('note1');

      const { getAllByLabelText } = render(
        <CardBrowserScreen
          route={{ params: { deckId: '1' } }}
          navigation={mockNavigation}
        />
      );

      const deleteButtons = getAllByLabelText('Delete card');
      fireEvent.press(deleteButtons[0]);

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[alertCalls.length - 1][2];
      const deleteButton = buttons.find((b: any) => b.text === 'Delete');
      
      if (deleteButton && deleteButton.onPress) {
        await deleteButton.onPress();
      }

      await waitFor(() => {
        const errorCalls = (Alert.alert as jest.Mock).mock.calls.filter(
          call => call[0] === 'Error'
        );
        expect(errorCalls.length).toBeGreaterThan(0);
      });
    });
  });
});
