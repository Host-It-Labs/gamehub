/** Unreleased games stay private to the development server and client. */
export function isGameAvailable(id: string) {
  return id !== 'diner' || process.env.NODE_ENV === 'development';
}
