/** Simple object pool with swap-remove compaction. */
export class Pool<T extends { alive: boolean }> {
  list: T[] = [];
  private free: T[] = [];
  constructor(private make: () => T, prealloc = 0) {
    for (let i = 0; i < prealloc; i++) this.free.push(make());
  }
  get(): T {
    const o = this.free.pop() ?? this.make();
    o.alive = true;
    this.list.push(o);
    return o;
  }
  /** Remove dead items; call once per tick after updates. */
  sweep() {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      if (!l[i].alive) {
        this.free.push(l[i]);
        l[i] = l[l.length - 1];
        l.pop();
      }
    }
  }
  clear() { for (const o of this.list) { o.alive = false; this.free.push(o); } this.list.length = 0; }
}
