export { default } from '../../page';

// Invitations are created at runtime. The production server serves the SPA shell.
export function generateStaticParams() {
  return [];
}
