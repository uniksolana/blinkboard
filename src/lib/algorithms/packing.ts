export interface PackedSlot {
  tier: string;
  x: number;
  y: number;
  size: number;
}

export function packSlots(tierCounts: Record<string, number>): {
  isValid: boolean;
  slots: PackedSlot[];
  error?: string;
} {
  const GRID_SIZE = 8;
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
  const packedSlots: PackedSlot[] = [];

  // Define tier sizes
  const tierSizes: Record<string, number> = {
    VIP: 4,
    PLATINUM: 3,
    GOLD: 2,
    STANDARD: 1,
  };

  // Sort tiers by size descending
  const sortedTiers = Object.entries(tierCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => tierSizes[b[0]] - tierSizes[a[0]]);

  for (const [tier, count] of sortedTiers) {
    const size = tierSizes[tier];
    
    for (let i = 0; i < count; i++) {
      let found = false;
      
      // Look for the first available spot (row-major)
      for (let y = 0; y <= GRID_SIZE - size; y++) {
        for (let x = 0; x <= GRID_SIZE - size; x++) {
          if (canPlace(grid, x, y, size)) {
            place(grid, x, y, size);
            packedSlots.push({ tier, x, y, size });
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return {
          isValid: false,
          slots: [],
          error: `Could not fit all slots. Failed at ${tier} #${i + 1}`,
        };
      }
    }
  }

  // Verify total credits
  const totalCredits = packedSlots.reduce((acc, slot) => acc + (slot.size * slot.size), 0);
  if (totalCredits !== 64) {
    return {
      isValid: false,
      slots: [],
      error: `Total credits (${totalCredits}) must be exactly 64.`,
    };
  }

  return { isValid: true, slots: packedSlots };
}

function canPlace(grid: boolean[][], x: number, y: number, size: number): boolean {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (grid[y + dy][x + dx]) return false;
    }
  }
  return true;
}

function place(grid: boolean[][], x: number, y: number, size: number) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      grid[y + dy][x + dx] = true;
    }
  }
}
