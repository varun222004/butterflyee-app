import { Outlet, useLocation, Link } from "react-router-dom";
import Background from "@/components/atmosphere/Background";
import IconRail from "@/components/atmosphere/IconRail";
import WorldSwitcher from "@/components/atmosphere/WorldSwitcher";
import { useAuth } from "@/context/AuthContext";

/**
 * AppShell — sets atmosphere, icon rail, world switcher, and renders children.
 * `world` is inferred from the URL: /my/* → my, /buddy/* → buddy, /our/* → our, / → my.
 */
export default function AppShell({ showMoon = true }) {
  const location = useLocation();
  const { user, buddy } = useAuth();

  const segs = location.pathname.split("/").filter(Boolean);
  let world = "my";
  if (segs[0] === "buddy") world = "buddy";
  else if (segs[0] === "our") world = "our";

  const buddyName = buddy?.buddy?.display_name || (buddy?.buddy?.handle ? `@${buddy.buddy.handle}` : null);
  const myName = user?.display_name || (user?.handle ? `@${user.handle}` : null);

  return (
    <div className="App relative min-h-screen text-[rgb(244,237,224)] overflow-hidden">
      <Background showMoon={showMoon} />

      {user && (
        <>
          <WorldSwitcher world={world} buddyName={world === "buddy" ? myName : buddyName} />
          <IconRail world={world} />
        </>
      )}

      {/* "/ INDEX" footer indicator from the screenshots */}
      <div className="fixed bottom-6 right-8 z-20 text-[10px] tracking-[0.4em] text-[rgba(244,237,224,0.35)] select-none pointer-events-none">
        / INDEX
      </div>

      <main className="relative z-10 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
