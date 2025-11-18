export interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  marketType: 'event' | 'sentiment' | 'index';
}

export interface Position {
  id: string;
  marketId: string;
  userId: string;
  side: 'long' | 'short';
  entryPrice: number;
  size: number;
}
