import { useNavigate, useLocation } from "react-router-dom";
import { WORLDS } from "@/constants/testIds";

/**
 * Three quiet tabs at the top of every page:
 *   My World  ·  Buddy's World  ·  Our World
 * Stays subtle; uses opacity to indicate active.
 */
export default function WorldSwitcher({ world, buddyName }) {
  const navigate = useNavigate();
  const location = useLocation();

  // When switching, try to preserve the current room key if possible.
  function goto(targetWorld) {
    const segs = location.pathname.split("/").filter(Boolean);
    // First segment is the world (my|buddy|our|...). Second is the room.
    const room = (segs.length > 1 && ["my", "buddy", "our"].includes(segs[0])) ? segs[1] : null;
    if (targetWorld === "our") {
      navigate(room && ["shared_journal", "bucket_list"].includes(room) ? `/our/${room}` : "/our");
    } else if (targetWorld === "buddy") {
      navigate(room && !["shared_journal", "bucket_list"].includes(room) ? `/buddy/${room}` : "/buddy");
    } else {
      navigate(room && !["shared_journal", "bucket_list"].includes(room) ? `/my/${room}` : "/");
    }
  }

  const buddyLabel = buddyName ? `${buddyName}'s World` : "Buddy's World";

  return (
    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bf-glass">
      <button
        type="button"
        data-testid={WORLDS.tabMine}
        data-active={world === "my"}
        className="bf-world-tab"
        onClick={() => goto("my")}
      >
        My World
      </button>
      <span className="w-px h-3 bg-[rgba(244,237,224,0.15)]" />
      <button
        type="button"
        data-testid={WORLDS.tabBuddy}
        data-active={world === "buddy"}
        className="bf-world-tab"
        onClick={() => goto("buddy")}
      >
        <span className="hidden sm:inline">{buddyLabel}</span>
        <span className="inline sm:hidden">Buddy</span>
      </button>
      <span className="w-px h-3 bg-[rgba(244,237,224,0.15)]" />
      <button
        type="button"
        data-testid={WORLDS.tabShared}
        data-active={world === "our"}
        className="bf-world-tab"
        onClick={() => goto("our")}
      >
        Our World
      </button>
    </div>
  );
}
