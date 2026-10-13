export type Home = {
  id: number; title: string; area: string; city: string; rent: number; deposit: number;
  beds: number; baths: number; size: number; image: string; tags: string[]; trust: number; complimentary?: boolean;
};

export const homes: Home[] = [
  { id: 4, title: 'The Nest at Bandra', area: 'Bandra West', city: 'Mumbai', rent: 0, deposit: 0, beds: 1, baths: 1, size: 540, image: '/homes/hero-home.jpg', tags: ['Furnished', 'Complimentary'], trust: 0, complimentary: true },
  { id: 1, title: 'Sea Glass Residence', area: 'Bandra West', city: 'Mumbai', rent: 42, deposit: 42, beds: 2, baths: 2, size: 1140, image: '/homes/sea-glass.jpg', tags: ['Sea view', 'Furnished'], trust: 96 },
  { id: 2, title: 'The Quiet Courtyard', area: 'Indiranagar', city: 'Bengaluru', rent: 29, deposit: 29, beds: 2, baths: 2, size: 980, image: '/homes/courtyard.jpg', tags: ['Pet friendly', 'Balcony'], trust: 93 },
  { id: 3, title: 'Palm House Studio', area: 'Assagao', city: 'Goa', rent: 21, deposit: 21, beds: 1, baths: 1, size: 610, image: '/homes/palm-house.jpg', tags: ['Work-ready', 'Garden'], trust: 98 },
];

export const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
