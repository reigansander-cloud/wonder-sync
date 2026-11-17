// The site can live at a sub-path (e.g. https://you.github.io/cardsmith/).
// appUrl('/clans') gives the right address for a full-page navigation.
export const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export function appUrl(path = '/') {
  return BASE_PATH + (path.startsWith('/') ? path : `/${path}`);
}
