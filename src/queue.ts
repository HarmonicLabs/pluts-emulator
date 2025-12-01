export class Queue<T> {
    private items: T[] = [];

    enqueue(item: T): void {
      this.items.push(item);
    }

    dequeue(): T | undefined {
      return this.items.shift();
    }

    peek(): T | undefined {
      return this.items[0];
    }

    get length(): number {
      return this.items.length;
    }

    isEmpty(): boolean {
      return this.items.length === 0;
    }

    size(): number {
      return this.items.length;
    }

    asArray(): T[] {
      return [...this.items];
    }

    [Symbol.iterator]() {
      return this.items[Symbol.iterator]();
    }

    clear(): void {
      this.items = [];
    }
  }