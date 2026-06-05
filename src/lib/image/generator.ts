import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { Purchase } from '../types';

import fs from 'fs/promises';
import path from 'path';

export async function generateWallImage(
  slots: Array<{
    x: number;
    y: number;
    size: number;
    tier: string;
    purchase?: Purchase | null;
  }>,
  occupiedCredits: number,
  totalCredits: number = 64
): Promise<Buffer> {
  const occupancyPercent = Math.round((occupiedCredits / totalCredits) * 100);

  // Load font
  const fontPath = path.join(process.cwd(), 'public/fonts/Inter-Bold.ttf');
  const fontData = await fs.readFile(fontPath);

  const svg = await satori(
    {
      type: 'div' as any,
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '1200px',
          height: '600px',
          backgroundColor: '#0f172a',
          padding: '40px',
          color: '#ffffff',
          fontFamily: 'Inter',
        },
        children: [
          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
              },
              children: [
                {
                  type: 'h1',
                  props: {
                    style: {
                      margin: 0,
                      fontSize: '32px',
                      fontWeight: 'bold',
                    },
                    children: 'BlinkBoard',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#8b5cf6',
                    },
                    children: `${occupancyPercent}% ocupado`,
                  },
                },
              ],
            },
          },
          // Grid
          {
            type: 'div',
            props: {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '4px',
                flex: 1,
                backgroundColor: '#1e293b',
                padding: '20px',
                borderRadius: '8px',
              },
              children: slots.map((slot) => renderSlotCell(slot)),
            },
          },
        ],
      },
    } as any,
    {
      width: 1200,
      height: 600,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'original',
    },
  });

  return resvg.render().asPng();
}

function renderSlotCell(slot: any) {
  const { x, y, size, tier, purchase } = slot;

  if (purchase) {
    return {
      type: 'div',
      props: {
        style: {
          gridColumn: `${x + 1} / span ${size}`,
          gridRow: `${y + 1} / span ${size}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#8b5cf6',
          borderRadius: '4px',
          padding: '8px',
          color: '#ffffff',
          textAlign: 'center',
          overflow: 'hidden',
          fontSize: '12px',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#e0e7ff',
                marginBottom: '4px',
              },
            },
          },
          {
            type: 'span',
            props: {
              style: {
                fontSize: '10px',
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
              children: `@${purchase.buyer_x_handle}`,
            },
          },
        ],
      },
    };
  }

  const tierColors: Record<string, string> = {
    VIP: '#ec4899',
    PLATINUM: '#06b6d4',
    GOLD: '#f59e0b',
    STANDARD: '#64748b',
  };

  return {
    type: 'div',
    props: {
      style: {
        gridColumn: `${x + 1} / span ${size}`,
        gridRow: `${y + 1} / span ${size}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tierColors[tier] || '#64748b',
        borderRadius: '4px',
        opacity: 0.3,
        fontSize: '8px',
        color: '#ffffff',
        fontWeight: 'bold',
        textAlign: 'center',
      },
      children: tier,
    },
  };
}
