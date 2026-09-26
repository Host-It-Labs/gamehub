/** Shared by the head script and the theme store (lib/theme.ts). Kept free of
 *  React so the server layout can import it. */
export const THEME_KEY = 'gamehub.theme.v1';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Runs in the document head so the first paint already has the right look. */
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('${DARK_QUERY}').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;
