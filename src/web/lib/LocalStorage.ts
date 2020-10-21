const NamePrefix = 'msb3-';

export function pullFromLocalStorage<T = any>(name: string): T | null {
  const v = localStorage.getItem(NamePrefix + name);
  if (v === null) return null;
  try {
    return JSON.parse(v);
  } catch (e) {
    return null;
  }
}

export function pushToLocalStorage<T = any>(name: string, v: T): void {
  if (v === undefined) {
    localStorage.removeItem(NamePrefix + name);
    return;
  }
  const j = JSON.stringify(v);
  localStorage.setItem(NamePrefix + name, j);
}
