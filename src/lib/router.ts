import { useSyncExternalStore } from "react";

export type Route = "/" | "/channels" | "/favorites" | "/recents" | "/playlists" | "/settings" | "/watch";

const ROUTES: Route[] = ["/", "/channels", "/favorites", "/recents", "/playlists", "/settings", "/watch"];

function read(): Route {
  const h = window.location.hash.replace(/^#/, "").split("?")[0] || "/";
  return (ROUTES as string[]).includes(h) ? (h as Route) : "/";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, read, () => "/" as Route);
}

export function navigate(route: Route) {
  if (read() !== route) window.location.hash = route;
}
