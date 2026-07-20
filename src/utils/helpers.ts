const genreImages: Record<string, string> = {
  'Classic Rock': 'classic-rock',
  'Country & Folk': 'country-folk',
  'Blues & Soul': 'blues-soul',
  '60s/70s Pop Ballad': 'pop-ballad',
  'Country Folk': 'country-folk',
  'Warm Country Folk': 'country-folk',
};

export function MapGenreToImage(genre: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const imageName = genreImages[genre] || 'default';
  return `${baseUrl}/images/${imageName}-cover.jpg`;
}