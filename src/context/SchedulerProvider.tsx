/**
 * Scheduler Provider
 * React context for accessing scheduler state and methods
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Card } from '../domain/models';
import { Difficulty } from '../domain/srsTypes';
import { db } from '../services/anki/InMemoryDb';
import { SchedulerV2 } from '../services/anki/SchedulerV2';
import { bootstrapFromSeed, toViewCard } from '../services/anki/Adapter';
import { RevlogEase, CardType } from '../services/anki/schema';
import { isDue } from '../services/anki/time';

interface SchedulerContextValue {
  current: Card | null;
  next: Card | null;
  cardType: CardType | null;
  currentDeckId: string | null;
  answer: (difficulty: Difficulty, responseTimeMs: number) => void;
  bootstrap: (cards: Card[]) => void;
  setDeck: (deckId: string | null) => void;
  reload: () => void;
  stats: {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCards: number;
  };
  decks: Array<{ id: string; name: string; cardCount: number; dueCount: number }>;
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const [scheduler] = useState(() => new SchedulerV2(db));
  const [current, setCurrent] = useState<Card | null>(null);
  const [next, setNext] = useState<Card | null>(null);
  const [cardType, setCardType] = useState<CardType | null>(null);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    totalCards: 0,
  });
  const [decks, setDecks] = useState<Array<{ id: string; name: string; cardCount: number; dueCount: number }>>([]);

  // Load current and next cards
  const loadCards = useCallback(() => {
    console.log('[SchedulerProvider] Loading cards for deck:', currentDeckId || 'all');
    const currentAnkiCard = scheduler.getNext(currentDeckId || undefined);
    console.log('[SchedulerProvider] Current card:', currentAnkiCard?.id);
    
    const nextAnkiCard = currentAnkiCard ? scheduler.peekNext(currentDeckId || undefined) : null;
    console.log('[SchedulerProvider] Next card:', nextAnkiCard?.id);

    if (currentAnkiCard) {
      setCurrent(toViewCard(currentAnkiCard, db));
      setCardType(currentAnkiCard.type);
    } else {
      setCurrent(null);
      setCardType(null);
    }

    if (nextAnkiCard && nextAnkiCard.id !== currentAnkiCard?.id) {
      setNext(toViewCard(nextAnkiCard, db));
    } else {
      setNext(null);
    }

    // Update stats
    setStats(db.getStats(currentDeckId || undefined));
    
    // Update decks list with due counts
    const allDecks = db.getAllDecks();
    setDecks(allDecks.map(d => {
      const deckCards = db.getCardsByDeck(d.id);
      const dueCards = deckCards.filter(c => {
        const col = db.getCol();
        return isDue(c.due, c.type, col);
      });
      return {
        id: d.id,
        name: d.name,
        cardCount: deckCards.length,
        dueCount: dueCards.length,
      };
    }));
  }, [scheduler, currentDeckId]);

  // Bootstrap with seed data
  const bootstrap = useCallback((cards: Card[]) => {
    db.clear();
    bootstrapFromSeed(db, cards);
    loadCards();
  }, [loadCards]);

  // Set active deck
  const setDeck = useCallback((deckId: string | null) => {
    setCurrentDeckId(deckId);
  }, []);

  // Answer current card
  const answer = useCallback((difficulty: Difficulty, responseTimeMs: number) => {
    if (!current) {
      console.warn('No current card to answer');
      return;
    }

    // Map difficulty to Anki ease
    let ease: RevlogEase;
    
    // For learning cards, only 3 buttons: Again=1, Good=2, Easy=3
    // For review cards, 4 buttons: Again=1, Hard=2, Good=3, Easy=4
    const isLearning = cardType === CardType.New || 
                       cardType === CardType.Learning || 
                       cardType === CardType.Relearning;

    if (isLearning) {
      // Learning: map to 3-button ease
      switch (difficulty) {
        case 'again':
          ease = RevlogEase.Again;  // 1
          break;
        case 'good':
          ease = RevlogEase.Good;   // 2 (mapped from "good")
          break;
        case 'easy':
          ease = RevlogEase.Easy;   // 3
          break;
        case 'hard':
          // Treat "hard" as "good" for learning
          ease = RevlogEase.Good;   // 2
          break;
        default:
          ease = RevlogEase.Good;
      }
    } else {
      // Review: map to 4-button ease
      switch (difficulty) {
        case 'again':
          ease = RevlogEase.Again;  // 1
          break;
        case 'hard':
          ease = RevlogEase.Hard;   // 2
          break;
        case 'good':
          ease = RevlogEase.Good;   // 3
          break;
        case 'easy':
          ease = RevlogEase.Easy;   // 4
          break;
        default:
          ease = RevlogEase.Good;
      }
    }

    // Process answer
    scheduler.answer(current.id, ease, responseTimeMs);

    // Load next cards
    loadCards();
  }, [current, cardType, scheduler, loadCards]);

  // Reload cards when deck changes
  useEffect(() => {
    if (current || next) {
      loadCards();
    }
  }, [currentDeckId]);

  // Reload function to refresh from database
  const reload = useCallback(() => {
    console.log('[SchedulerProvider] Reloading from database');
    loadCards();
  }, [loadCards]);

  const value: SchedulerContextValue = {
    current,
    next,
    cardType,
    currentDeckId,
    answer,
    bootstrap,
    setDeck,
    reload,
    stats,
    decks,
  };

  return (
    <SchedulerContext.Provider value={value}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler(): SchedulerContextValue {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useScheduler must be used within SchedulerProvider');
  }
  return context;
}
