/**
 * Model Repository
 * Handles all CRUD operations for models (card templates)
 */

import { Model, AnkiCol } from '../schema';
import { nowSeconds, nowMillis } from '../time';

export class ModelRepository {
  private models: Map<number, Model>;
  private getColFn: () => AnkiCol | null;
  private usn: number;

  constructor(models: Map<number, Model>, getCol: () => AnkiCol | null, usn: number) {
    this.models = models;
    this.getColFn = getCol;
    this.usn = usn;
  }

  get(id: string | number): Model | undefined {
    // Accept both string and number, convert to number (Anki uses numbers)
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.models.get(numericId);
  }

  getAll(): Model[] {
    return Array.from(this.models.values());
  }

  add(model: Model): void {
    // Ensure ID is a number (Anki way)
    const normalizedModel = {
      ...model,
      id: typeof model.id === 'string' ? parseInt(model.id, 10) : model.id,
    };
    this.models.set(normalizedModel.id, normalizedModel);
    this.syncToCol();
  }

  update(id: string | number, updates: Partial<Model>): void {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const model = this.models.get(numericId);
    if (!model) {
      throw new Error(`Model ${id} not found`);
    }
    this.models.set(numericId, {
      ...model,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
    this.syncToCol();
  }

  delete(id: string | number): void {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    this.models.delete(numericId);
    this.syncToCol();
  }

  private syncToCol(): void {
    const col = this.getColFn();
    if (!col) return;
    const modelsObj: Record<string, Model> = {};
    this.models.forEach((model, id) => {
      modelsObj[id] = model;
    });
    col.models = JSON.stringify(modelsObj);
    col.mod = nowMillis();
  }
}
