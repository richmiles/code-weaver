export function calculateTotal(items: number[]): number {
  let total = 0;
  for (const item of items) {
    total += item;
  }
  return total;
}

export function processData(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse data:', error);
    return null;
  }
}