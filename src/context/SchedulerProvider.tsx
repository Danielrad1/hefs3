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

interface SchedulerContextValue {
  current: Card | null;
  next: Card | null;
  cardType: CardType | null;
  answer: (difficulty: Difficulty, responseTimeMs: number) => void;
  bootstrap: (cards: Card[]) => void;
  stats: {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCards: number;
  };
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const [scheduler] = useState(() => new SchedulerV2(db));
  const [current, setCurrent] = useState<Card | null>(null);
  const [next, setNext] = useState<Card | null>(null);
  const [cardType, setCardType] = useState<CardType | null>(null);
  const [stats, setStats] = useState({
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    totalCards: 0,
  });

  // Load current and next cards
  const loadCards = useCallback(() => {
    const currentAnkiCard = scheduler.getNext();
    const nextAnkiCard = currentAnkiCard ? scheduler.peekNext() : null;

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
    setStats(db.getStats());
  }, [scheduler]);

  // Bootstrap with seed data
  const bootstrap = useCallback((cards: Card[]) => {
    db.clear();
    bootstrapFromSeed(db, cards);
    loadCards();
  }, [loadCards]);

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

  const value: SchedulerContextValue = {
    current,
    next,
    cardType,
    answer,
    bootstrap,
    stats,
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
