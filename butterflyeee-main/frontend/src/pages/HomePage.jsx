import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HOME } from "@/constants/testIds";
import { PERSONAL_ROOMS } from "@/constants/rooms";

/**
 * Index page for a world (My, Buddy, Our).
 * Echoes the "Hello, Sunshine." page exactly. Title changes by world.
 */
export default function HomePage({ world = "my" }) {
  const { user, buddy } = useAuth();
  const navigate = useNavigate();

  const myName = user?.display_name || (user?.handle ? `@${user.handle}` : "friend");
  const buddyName = buddy?.buddy?.display_name || (buddy?.buddy?.handle ? `@${buddy.buddy.handle}` : "your buddy");

  let eyebrow, headline, scriptName, blurb, primaryAction;
  if (world === "buddy") {
    eyebrow = "WRITING FOR";
    headline = "For ";
    scriptName = buddyName + ".";
    blurb = "Pick a room. Leave something small and specific. They'll find it.";
    primaryAction = { label: "Open a room", to: `/buddy/${PERSONAL_ROOMS[0].key}` };
  } else if (world === "our") {
    eyebrow = "OUR WORLD";
    headline = "A page you share.";
    scriptName = "";
    blurb = "A small shared space. Both of you can write. The list grows when you do.";
    primaryAction = { label: "Step inside", to: `/our/shared_journal` };
  } else {
    eyebrow = "A SMALL PRIVATE WORLD";
    headline = "Hello,";
    scriptName = myName + ".";
    blurb = buddy?.buddy
      ? "Someone built you a quiet little place. Step in slowly — there is nothing here that needs to be answered, only kept."
      : "Your world is quiet. Connect with a Butterfly buddy and it will begin to fill on its own.";
    primaryAction = buddy?.buddy
      ? { label: "Step inside", to: `/my/${PERSONAL_ROOMS[0].key}` }
      : { label: "Connect with a buddy", to: "/connect" };
  }

  return (
    <section className="relative min-h-screen flex items-center px-6 sm:px-16 lg:px-32">
      <div className="max-w-2xl bf-fade-up">
        <div className="bf-eyebrow mb-8">{eyebrow}</div>
        <h1
          data-testid={HOME.greeting}
          className="bf-display text-5xl sm:text-6xl lg:text-7xl leading-[1.0] mb-2"
        >
          {headline}
        </h1>
        {scriptName && (
          <div className="bf-script text-6xl sm:text-7xl lg:text-8xl text-[rgb(232,196,184)] leading-[1.0] mb-8 -mt-1">
            {scriptName}
          </div>
        )}
        <p className="text-sm sm:text-base text-[rgba(244,237,224,0.62)] max-w-md leading-relaxed mb-12">
          {blurb}
        </p>
        <div className="flex items-center gap-6 flex-wrap">
          <button
            data-testid={HOME.stepInsideButton}
            onClick={() => navigate(primaryAction.to)}
            className="bf-pill-btn flex items-center gap-2"
          >
            {primaryAction.label}
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </button>
          <span className="bf-script text-base text-[rgba(244,237,224,0.5)]">
            {world === "buddy" ? "writing slowly, on purpose" : "made quietly, on purpose"}
          </span>
        </div>
      </div>
    </section>
  );
}
