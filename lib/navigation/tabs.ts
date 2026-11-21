export const TAB_CACHE_MS = 60 * 60 * 1000;
export const TAB_NAVIGATION_EVENT = "kitchen-tab-navigation";
export const TAB_LEAVING_EVENT = "kitchen-tab-leaving";
export function subscribeToPath(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(TAB_NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(TAB_NAVIGATION_EVENT, callback);
  };
}
export function switchTab(url: URL) {
  if (location.href === url.href) return;
  window.dispatchEvent(
    new CustomEvent(TAB_LEAVING_EVENT, {
      detail: { path: location.pathname, scrollY: window.scrollY },
    }),
  );
  history.pushState(null, "", url.href);
  window.dispatchEvent(new Event(TAB_NAVIGATION_EVENT));
}
