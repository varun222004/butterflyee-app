import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Calendar, X, Upload, Loader2, Mail, AudioLines } from "lucide-react";
import { api, formatApiError, API } from "@/lib/api";
import { magic } from "@/lib/magic";
import { ROOM_MAP } from "@/constants/rooms";
import { useAuth } from "@/context/AuthContext";
import { ROOM } from "@/constants/testIds";

/**
 * One generic Room page used by every room. The `world` prop drives behavior:
 *   - "my"     → read-only; shows entries authored FOR me. Hero copy = room.hero.my.
 *   - "buddy"  → Studio mode; I see entries I've written FOR my buddy. CRUD enabled.
 *   - "our"    → shared; both can CRUD.
 *
 * The room.key determines the room (look up ROOM_MAP).
 * Entries are rendered with a custom card variant per room (envelopes for letters,
 * audio cards for butterfly_lounge, badge cards for achievements, etc.).
 */
export default function RoomPage({ world }) {
  const { roomKey } = useParams();
  const navigate = useNavigate();
  const room = ROOM_MAP[roomKey];
  const { buddy, user } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // entry being edited or null for new

  // Redirect if invalid room or wrong world for room
  useEffect(() => {
    if (!room) { navigate("/"); return; }
    if (room.world === "shared" && world !== "our") { navigate(`/our/${room.key}`); return; }
    if (room.world === "personal" && world === "our") { navigate(`/my/${room.key}`); return; }
  }, [room, world, navigate]);

  // If no buddy yet for personal rooms, send to connect
  useEffect(() => {
    if (room && !buddy?.buddy && room.world === "personal" && world !== "our") {
      // allow viewing the empty hero anyway, but no CRUD possible
    }
  }, [room, buddy, world]);

  const canEdit = (world === "buddy" && !!buddy?.buddy) || (world === "our" && !!buddy?.buddy);
  const view = world === "my" ? "mine" : world === "buddy" ? "buddy" : "shared";

  async function load() {
    if (!room || !buddy?.buddy) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/rooms/${room.key}/entries`, {
        params: { view, include_unpublished: canEdit ? "true" : "false" },
      });
      setEntries(data.entries || []);
    } catch (e) {
      magic.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [roomKey, world, buddy?.buddy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() {
    setEditing({ title: "", body: "", media_path: null, metadata: {}, status: "published", publish_at: null });
    setEditorOpen(true);
  }
  function openEdit(entry) {
    setEditing({ ...entry });
    setEditorOpen(true);
  }

  async function saveEntry(payload) {
    try {
      if (editing?.id) {
        await api.put(`/rooms/${room.key}/entries/${editing.id}`, payload);
        magic.success("Updated, quietly.");
      } else {
        await api.post(`/rooms/${room.key}/entries`, { ...payload, room_key: room.key });
        magic.butterfly("Left for them to find.");
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      magic.error(formatApiError(e));
    }
  }

  async function removeEntry(id) {
    try {
      await api.delete(`/rooms/${room.key}/entries/${id}`);
      magic.whisper("Quietly removed.");
      await load();
    } catch (e) {
      magic.error(formatApiError(e));
    }
  }

  if (!room) return null;

  const heroKey = world === "our" ? "shared" : world === "buddy" ? "buddy" : "my";
  const heroTitle = room.hero[heroKey] || room.title;
  const heroSub = room.sub[heroKey] || "";

  return (
    <section data-testid={ROOM.page} className="relative min-h-screen px-6 sm:px-16 lg:px-32 py-20 sm:py-28">
      <div className="max-w-4xl bf-fade-up">
        <div className="bf-eyebrow mb-6">{room.eyebrow}</div>
        <h1 className="bf-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-5 max-w-3xl">
          {heroTitle}
        </h1>
        {heroSub && (
          <p className="text-sm sm:text-base text-[rgba(244,237,224,0.6)] max-w-xl leading-relaxed mb-10">
            {heroSub}
          </p>
        )}

        {canEdit && (
          <div className="mb-12">
            <button
              type="button"
              onClick={openNew}
              data-testid={ROOM.newEntryButton}
              className="bf-pill-btn inline-flex items-center gap-2"
            >
              <Plus size={14} strokeWidth={1.5} />
              {newLabel(room.key)}
            </button>
            {world === "buddy" && buddy?.buddy && (
              <p className="bf-script text-base text-[rgba(244,237,224,0.55)] mt-3">
                Writing For <span className="text-[rgb(232,196,184)]">{buddy.buddy.display_name || `@${buddy.buddy.handle}` || buddy.buddy.buddy_id}</span>
              </p>
            )}
          </div>
        )}

        {!buddy?.buddy && room.world === "personal" && (
          <div className="bf-glass rounded-3xl p-8 max-w-xl">
            <p className="bf-script text-2xl text-[rgb(232,196,184)] mb-3">A small empty page.</p>
            <p className="text-sm text-[rgba(244,237,224,0.6)] mb-6 leading-relaxed">
              You don&apos;t have a Butterfly buddy yet. Once you do, this room will begin to fill.
            </p>
            <button onClick={() => navigate("/connect")} className="bf-pill-btn">Connect with a buddy</button>
          </div>
        )}

        {/* Entries */}
        {buddy?.buddy && (
          <div>
            {loading ? (
              <div className="text-[rgba(244,237,224,0.4)] flex items-center gap-2 text-sm">
                <Loader2 className="animate-spin" size={14}/> opening the room…
              </div>
            ) : entries.length === 0 ? (
              <EmptyHint room={room} world={world} canEdit={canEdit} onCreate={openNew} />
            ) : (
              <EntryGrid
                room={room}
                world={world}
                entries={entries}
                canEdit={canEdit}
                onEdit={openEdit}
                onDelete={removeEntry}
              />
            )}
          </div>
        )}
      </div>

      {editorOpen && (
        <EntryEditor
          room={room}
          world={world}
          initial={editing}
          onClose={() => { setEditorOpen(false); setEditing(null); }}
          onSave={saveEntry}
        />
      )}
    </section>
  );
}

function newLabel(key) {
  const m = {
    appreciation: "Plant something",
    letters: "Write a letter",
    memories: "Save a memory",
    butterfly_lounge: "Record a voice note",
    good_night: "Leave a good-night",
    dog_cafe: "Drop something soft",
    doctor_corner: "Write a kind reminder",
    achievements: "Confer a badge",
    surprises: "Seal a surprise",
    secret_room: "Leave a secret",
    shared_journal: "New journal page",
    bucket_list: "Add to the list",
  };
  return m[key] || "Add something";
}

function EmptyHint({ room, world, canEdit, onCreate }) {
  const text =
    world === "my"
      ? "( nothing left for you here yet. )"
      : world === "buddy"
        ? `( this room is empty in their world — leave the first thing. )`
        : "( the page is still blank. )";
  return (
    <div data-testid={ROOM.entryEmptyState} className="py-12">
      <p className="bf-script text-2xl text-[rgba(244,237,224,0.55)] mb-6">{text}</p>
      {canEdit && (
        <button onClick={onCreate} className="bf-pill-btn inline-flex items-center gap-2">
          <Plus size={14} strokeWidth={1.5}/> {newLabel(room.key)}
        </button>
      )}
    </div>
  );
}

/* ===================== Entry Grid (room-specific card variants) ===================== */
function EntryGrid({ room, world, entries, canEdit, onEdit, onDelete }) {
  // Card layout varies by room.key
  switch (room.key) {
    case "letters":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {entries.map((e) => (
            <LetterCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    case "butterfly_lounge":
      return (
        <div className="space-y-4">
          {entries.map((e) => (
            <VoiceCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    case "memories":
    case "dog_cafe":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((e) => (
            <MemoryCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    case "achievements":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((e) => (
            <BadgeCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    case "good_night":
    case "appreciation":
    case "doctor_corner":
    case "secret_room":
    case "shared_journal":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {entries.map((e) => (
            <NoteCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    case "surprises":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((e) => (
            <SurpriseCard key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} world={world} />
          ))}
        </div>
      );
    case "bucket_list":
      return (
        <div className="space-y-3">
          {entries.map((e) => (
            <BucketRow key={e.id} entry={e} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      );
    default:
      return null;
  }
}

/* --------------- Card variants --------------- */
function CardActions({ entry, canEdit, onEdit, onDelete }) {
  if (!canEdit) return null;
  return (
    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
      <button
        onClick={(ev) => { ev.stopPropagation(); onEdit(entry); }}
        data-testid={ROOM.entryEditButton}
        className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-[rgba(244,237,224,0.7)] hover:text-[rgb(244,237,224)]"
        aria-label="Edit"
      ><Pencil size={12} strokeWidth={1.5}/></button>
      <button
        onClick={(ev) => { ev.stopPropagation(); if (confirm("Quietly remove this?")) onDelete(entry.id); }}
        data-testid={ROOM.entryDeleteButton}
        className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-[rgba(244,237,224,0.7)] hover:text-[rgb(232,180,180)]"
        aria-label="Delete"
      ><Trash2 size={12} strokeWidth={1.5}/></button>
    </div>
  );
}

function ScheduledBadge({ entry }) {
  if (entry.status !== "scheduled") return null;
  return (
    <span className="absolute top-3 left-3 text-[10px] tracking-[0.25em] uppercase bg-black/30 text-[rgba(244,237,224,0.7)] px-2 py-1 rounded-full">
      sealed
    </span>
  );
}

function NoteCard({ entry, canEdit, onEdit, onDelete }) {
  return (
    <article data-testid={ROOM.entryCard} className="group relative bf-glass bf-glass-hover rounded-2xl p-6">
      <ScheduledBadge entry={entry} />
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      {entry.title && <h3 className="bf-display text-2xl mb-3 leading-tight">{entry.title}</h3>}
      <p className="text-sm text-[rgba(244,237,224,0.78)] whitespace-pre-wrap leading-relaxed">{entry.body}</p>
      <div className="bf-eyebrow mt-5 opacity-60">{formatDate(entry.created_at)}</div>
    </article>
  );
}

function LetterCard({ entry, canEdit, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <article
      data-testid={ROOM.entryCard}
      className="group relative bf-envelope rounded-2xl p-7 cursor-pointer transition-transform duration-700 hover:-translate-y-1"
      onClick={() => setOpen((o) => !o)}
    >
      <ScheduledBadge entry={entry} />
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      <div className="flex items-start gap-4 mb-3">
        <div className="bf-envelope-seal flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-60">A LETTER</div>
          <h3 className="bf-display text-2xl leading-tight truncate">{entry.title || "Untitled"}</h3>
        </div>
      </div>
      {open ? (
        <p className="text-sm whitespace-pre-wrap leading-relaxed mt-4 border-t border-black/10 pt-4">{entry.body}</p>
      ) : (
        <div className="bf-script text-base opacity-70 mt-2 flex items-center gap-2">
          <Mail size={14}/> tap to open
        </div>
      )}
      <div className="text-[10px] tracking-[0.25em] uppercase opacity-50 mt-4">{formatDate(entry.created_at)}</div>
    </article>
  );
}

function VoiceCard({ entry, canEdit, onEdit, onDelete }) {
  return (
    <article data-testid={ROOM.entryCard} className="group relative bf-glass bf-glass-hover rounded-2xl p-6 flex items-center gap-5">
      <ScheduledBadge entry={entry} />
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[rgb(232,196,184)]">
        <AudioLines size={20} strokeWidth={1.5}/>
      </div>
      <div className="flex-1 min-w-0">
        {entry.title && <h3 className="bf-display text-xl leading-tight mb-1">{entry.title}</h3>}
        {entry.body && <p className="text-sm text-[rgba(244,237,224,0.7)] mb-2 leading-relaxed">{entry.body}</p>}
        {entry.media_path && (
          <audio controls className="w-full mt-2" preload="metadata">
            <source src={`${API}/files/${entry.media_path}`} />
          </audio>
        )}
        <div className="bf-eyebrow mt-2 opacity-60">{formatDate(entry.created_at)}</div>
      </div>
    </article>
  );
}

function MemoryCard({ entry, canEdit, onEdit, onDelete }) {
  return (
    <article data-testid={ROOM.entryCard} className="group relative bf-glass bf-glass-hover rounded-2xl overflow-hidden">
      <ScheduledBadge entry={entry} />
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      {entry.media_path && (
        <div className="aspect-[4/3] bg-black/30 overflow-hidden">
          <img src={`${API}/files/${entry.media_path}`} alt={entry.title || "memory"}
               className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5">
        {entry.title && <h3 className="bf-display text-xl mb-2 leading-tight">{entry.title}</h3>}
        {entry.body && <p className="text-sm text-[rgba(244,237,224,0.7)] whitespace-pre-wrap leading-relaxed">{entry.body}</p>}
        <div className="bf-eyebrow mt-3 opacity-60">{formatDate(entry.created_at)}</div>
      </div>
    </article>
  );
}

function BadgeCard({ entry, canEdit, onEdit, onDelete }) {
  return (
    <article data-testid={ROOM.entryCard} className="group relative bf-glass bf-glass-hover rounded-2xl p-6 flex gap-4">
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      <div className="flex-shrink-0 w-14 h-14 rounded-full border border-[rgba(232,196,184,0.4)] bg-[rgba(232,196,184,0.08)] flex items-center justify-center text-[rgb(232,196,184)] bf-glow-pulse">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="bf-display text-xl leading-tight mb-1">{entry.title || "Untitled badge"}</h3>
        <p className="text-sm text-[rgba(244,237,224,0.7)] italic leading-relaxed">{entry.body}</p>
      </div>
    </article>
  );
}

function SurpriseCard({ entry, canEdit, onEdit, onDelete, world }) {
  const sealed = entry.status === "scheduled";
  return (
    <article data-testid={ROOM.entryCard} className={`group relative bf-glass bf-glass-hover rounded-2xl p-6 ${sealed ? "border-[rgba(232,196,184,0.25)]" : ""}`}>
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      {sealed && (
        <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center px-6 bg-black/30 backdrop-blur-sm">
          <div className="text-3xl mb-2">🎁</div>
          <div className="bf-script text-xl text-[rgb(232,196,184)]">sealed for {formatDate(entry.publish_at)}</div>
          {world === "buddy" && (
            <p className="text-[10px] tracking-[0.2em] uppercase opacity-60 mt-2">they cannot see this yet</p>
          )}
        </div>
      )}
      {entry.title && <h3 className="bf-display text-xl mb-2 leading-tight">{entry.title}</h3>}
      <p className="text-sm text-[rgba(244,237,224,0.78)] whitespace-pre-wrap leading-relaxed">{entry.body}</p>
      <div className="bf-eyebrow mt-4 opacity-60">{formatDate(entry.created_at)}</div>
    </article>
  );
}

function BucketRow({ entry, canEdit, onEdit, onDelete }) {
  const done = entry.metadata?.completed;
  return (
    <article data-testid={ROOM.entryCard} className="group relative bf-glass bf-glass-hover rounded-2xl p-5 flex items-center gap-4">
      <CardActions entry={entry} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}/>
      <div className={`w-5 h-5 rounded-full border ${done ? "bg-[rgb(232,196,184)] border-[rgb(232,196,184)]" : "border-[rgba(244,237,224,0.3)]"}`}/>
      <div className="flex-1 min-w-0">
        <h3 className={`bf-display text-xl leading-tight ${done ? "line-through opacity-50" : ""}`}>
          {entry.title || "Untitled"}
        </h3>
        {entry.body && <p className="text-sm text-[rgba(244,237,224,0.6)] mt-1 leading-relaxed">{entry.body}</p>}
      </div>
    </article>
  );
}

/* ===================== Editor ===================== */
function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EntryEditor({ room, world, initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [mediaPath, setMediaPath] = useState(initial?.media_path || null);
  // Keep the datetime input as a plain local string while typing.
  // Convert to ISO only on submit so each keystroke doesn't trigger a UTC round-trip.
  const [publishAtLocal, setPublishAtLocal] = useState(isoToLocalInputValue(initial?.publish_at));
  const [completed, setCompleted] = useState(Boolean(initial?.metadata?.completed));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const needsMediaImage = ["memories", "dog_cafe"].includes(room.key);
  const needsMediaAudio = ["butterfly_lounge"].includes(room.key);
  const acceptMime = needsMediaAudio ? "audio/*" : needsMediaImage ? "image/*" : "image/*,audio/*";

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/uploads`, form, {
        params: { room_key: room.key },
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMediaPath(data.path);
      magic.whisper("File quietly stored.");
    } catch (err) {
      magic.error(formatApiError(err));
    } finally {
      setUploading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const metadata = room.key === "bucket_list" ? { completed } : (initial?.metadata || {});
    // Convert the local-time input string to a UTC ISO ONLY at submit time.
    const publishAtIso = publishAtLocal
      ? new Date(publishAtLocal).toISOString()
      : null;
    const payload = {
      title: title.trim(),
      body: body.trim(),
      media_path: mediaPath,
      metadata,
      status: publishAtIso ? "scheduled" : "published",
      publish_at: publishAtIso,
    };
    onSave(payload).finally(() => setBusy(false));
  }

  const titleLabel = labelFor(room.key, "title");
  const bodyLabel = labelFor(room.key, "body");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md bf-fade-up">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl bf-glass rounded-3xl p-8 sm:p-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="bf-eyebrow">{initial?.id ? "EDITING" : "WRITING"}</div>
            <h2 className="bf-display text-3xl mt-1">{room.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[rgba(244,237,224,0.6)] hover:text-[rgb(244,237,224)]" aria-label="Close">
            <X size={18}/>
          </button>
        </div>

        {titleLabel && (
          <div className="mb-5">
            <label className="bf-eyebrow block mb-2">{titleLabel}</label>
            <input
              data-testid={ROOM.entryEditTitleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className="bf-input w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
        )}

        {bodyLabel && (
          <div className="mb-5">
            <label className="bf-eyebrow block mb-2">{bodyLabel}</label>
            <textarea
              data-testid={ROOM.entryEditBodyInput}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              className="bf-input w-full rounded-xl px-4 py-3 text-sm leading-relaxed resize-y"
            />
          </div>
        )}

        {(needsMediaImage || needsMediaAudio) && (
          <div className="mb-5">
            <label className="bf-eyebrow block mb-2">
              {needsMediaAudio ? "Voice note" : "Image"}
            </label>
            <input
              ref={fileRef}
              data-testid={ROOM.mediaUploadInput}
              type="file"
              accept={acceptMime}
              onChange={uploadFile}
              className="hidden"
            />
            {mediaPath ? (
              <div className="bf-glass rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-[rgba(244,237,224,0.6)] truncate">{mediaPath}</span>
                <button type="button" onClick={() => setMediaPath(null)} className="text-xs text-[rgba(244,237,224,0.55)] hover:text-[rgb(232,180,180)]">
                  remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="bf-pill-btn inline-flex items-center gap-2 text-xs"
                disabled={uploading}
              >
                {uploading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                {needsMediaAudio ? "Upload audio" : "Upload image"}
              </button>
            )}
          </div>
        )}

        {room.key === "bucket_list" && (
          <label className="flex items-center gap-2 text-sm text-[rgba(244,237,224,0.7)] mb-5 cursor-pointer">
            <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="accent-[rgb(232,196,184)]" />
            Already happened
          </label>
        )}

        <div className="mb-6">
          <label className="bf-eyebrow block mb-2 flex items-center gap-2">
            <Calendar size={12}/> Open on (optional)
          </label>
          <input
            data-testid={ROOM.schedulePicker}
            type="datetime-local"
            value={publishAtLocal}
            onChange={(e) => setPublishAtLocal(e.target.value)}
            className="bf-input w-full rounded-xl px-4 py-3 text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-[rgba(244,237,224,0.45)]">
              Leave empty to publish now. Set a future date to seal it until then.
            </p>
            {publishAtLocal && (
              <button
                type="button"
                onClick={() => setPublishAtLocal("")}
                className="text-[11px] text-[rgba(232,196,184,0.7)] hover:text-[rgb(232,196,184)] transition-colors duration-500"
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={busy} data-testid={ROOM.entrySaveButton} className="bf-pill-btn flex-1">
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid={ROOM.entryCancelButton}
            className="text-sm text-[rgba(244,237,224,0.55)] hover:text-[rgb(244,237,224)] py-3 px-5 transition-colors duration-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function labelFor(roomKey, field) {
  const TITLES = {
    appreciation: { title: "What did you notice?", body: "Say more (optional)" },
    letters: { title: "Title", body: "Letter" },
    memories: { title: "Memory title", body: "What happened" },
    butterfly_lounge: { title: "Voice note title (optional)", body: "Caption (optional)" },
    good_night: { title: "Title (optional)", body: "Good-night" },
    dog_cafe: { title: "Title", body: "Story" },
    doctor_corner: { title: "Title", body: "Reminder" },
    achievements: { title: "Badge name", body: "What it was awarded for" },
    surprises: { title: "Surprise title", body: "Surprise contents" },
    secret_room: { title: "Secret title (optional)", body: "Secret" },
    shared_journal: { title: "Entry title (optional)", body: "Journal entry" },
    bucket_list: { title: "What is it?", body: "Notes (optional)" },
  };
  return TITLES[roomKey]?.[field];
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
