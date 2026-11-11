import { useEffect } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Header, MobileNav, OfflineBanner, Sidebar, Toasts } from "@/components/Shell";
import { EmptyState } from "@/components/ui";
import { useRoute } from "@/lib/router";
import { useStore } from "@/lib/store";
import { ChannelsPage } from "@/pages/Channels";
import { HomePage } from "@/pages/Home";
import { PlaylistsPage } from "@/pages/Playlists";
import { RecentsPage } from "@/pages/Recents";
import { SettingsPage } from "@/pages/Settings";
import { WatchPage } from "@/pages/Watch";

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#090D16" : "#F1F5F9");
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);
}

export default function App() {
  const init = useStore((s) => s.init);
  const fatal = useStore((s) => s.fatalError);
  const route = useRoute();
  useTheme();

  useEffect(() => {
    void init();
  }, [init]);

  if (fatal) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState icon={ExclamationTriangleIcon} title="No se pudo iniciar el almacenamiento" text={`${fatal} NEXA IPTV necesita IndexedDB; comprueba que no estés en modo privado restringido.`} />
      </div>
    );
  }

  const fill = route === "/channels" || route === "/favorites";

  return (
    <div className="flex h-full bg-bg text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <OfflineBanner />
        <main className={fill ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"} key={fill ? "fill" : route}>
          <div className={fill ? "h-full" : "min-h-full anim-fade-up"}>
            {route === "/" && <HomePage />}
            {route === "/channels" && <ChannelsPage />}
            {route === "/favorites" && <ChannelsPage favoritesOnly />}
            {route === "/recents" && <RecentsPage />}
            {route === "/playlists" && <PlaylistsPage />}
            {route === "/settings" && <SettingsPage />}
            {route === "/watch" && <WatchPage />}
          </div>
        </main>
      </div>
      <MobileNav />
      <Toasts />
    </div>
  );
}
