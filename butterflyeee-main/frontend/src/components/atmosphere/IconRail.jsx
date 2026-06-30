import { NavLink, useLocation } from "react-router-dom";
import { Infinity as InfinityIcon, Settings } from "lucide-react";
import { PERSONAL_ROOMS, SHARED_ROOMS } from "@/constants/rooms";
import { NAV } from "@/constants/testIds";

function railItemKey(roomKey) {
  // map to NAV constants
  const map = {
    appreciation: NAV.itemAppreciation,
    letters: NAV.itemLetters,
    memories: NAV.itemMemories,
    butterfly_lounge: NAV.itemButterflyLounge,
    good_night: NAV.itemGoodNight,
    dog_cafe: NAV.itemDogCafe,
    doctor_corner: NAV.itemDoctorCorner,
    achievements: NAV.itemAchievements,
    surprises: NAV.itemSurprises,
    secret_room: NAV.itemSecretRoom,
  };
  return map[roomKey] || `nav-item-${roomKey}`;
}

export default function IconRail({ world }) {
  const location = useLocation();
  // hide rail when on auth pages handled at App level; we just render here.
  const rooms = world === "our" ? SHARED_ROOMS : PERSONAL_ROOMS;
  const homePath = world === "our" ? "/our" : world === "buddy" ? "/buddy" : "/";

  return (
    <nav
      data-testid={NAV.rail}
      className="fixed left-4 sm:left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 py-3 px-2 rounded-full bf-glass"
      aria-label="Butterfly rooms"
    >
      <NavLink
        to={homePath}
        end
        data-testid={NAV.itemHome}
        title="Home"
        className={({ isActive }) =>
          `relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-700 ${
            isActive || location.pathname === homePath
              ? "text-[rgb(244,237,224)] bg-white/8"
              : "text-[rgba(244,237,224,0.55)] hover:text-[rgb(244,237,224)] hover:bg-white/5"
          }`
        }
      >
        <InfinityIcon size={16} strokeWidth={1.5} />
      </NavLink>

      <div className="w-5 h-px my-1 bg-[rgba(244,237,224,0.12)]" />

      {rooms.map((room) => {
        const Icon = room.icon;
        const base = world === "our" ? "/our" : world === "buddy" ? "/buddy" : "/my";
        const to = `${base}/${room.key}`;
        return (
          <NavLink
            key={room.key}
            to={to}
            data-testid={railItemKey(room.key)}
            title={room.title}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-700 ${
                isActive
                  ? "text-[rgb(244,237,224)] bg-white/8"
                  : "text-[rgba(244,237,224,0.55)] hover:text-[rgb(244,237,224)] hover:bg-white/5"
              }`
            }
          >
            <Icon size={16} strokeWidth={1.5} />
          </NavLink>
        );
      })}

      <div className="w-5 h-px my-1 bg-[rgba(244,237,224,0.12)]" />

      <NavLink
        to="/settings"
        data-testid={NAV.itemSettings}
        title="Settings"
        className={({ isActive }) =>
          `relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-700 ${
            isActive
              ? "text-[rgb(244,237,224)] bg-white/8"
              : "text-[rgba(244,237,224,0.55)] hover:text-[rgb(244,237,224)] hover:bg-white/5"
          }`
        }
      >
        <Settings size={15} strokeWidth={1.5} />
      </NavLink>
    </nav>
  );
}
