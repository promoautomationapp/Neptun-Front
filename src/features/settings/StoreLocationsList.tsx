import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { NavIcon } from "../studio/NavIcon";
import { EditorIcon } from "../brochure/EditorIcon";
import { t } from "../brochure/i18n";
import { Field } from "./components";
import { moveItem } from "./campaign-defaults";
import type { SettingsTabProps } from "./SettingsEditor";
import type { WorkspaceSettings } from "./settings.schema";
import "./store-locations.css";

type Location = WorkspaceSettings["stores"][number];
const keyFor = (store: Location, index: number) =>
  store.id || `location-${index}`;
const labelFor = (store: Location, index: number) =>
  store.name || store.city || `${t("Location")} ${index + 1}`;
interface Drag {
  key: string;
  pointerId: number;
  startY: number;
  active: boolean;
  destination: number | null;
}

export function StoreLocationsList({ draft, update }: SettingsTabProps) {
  const list = useRef<HTMLOListElement>(null);
  const gesture = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{
    store: Location;
    index: number;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const instructions = useId();
  const editorId = useId();
  const stores = draft.stores;

  useEffect(() => {
    if (!editing) return;
    const row = [...(list.current?.children || [])].find(
      (element) => (element as HTMLElement).dataset.locationKey === editing,
    );
    const input = row?.querySelector<HTMLInputElement>(
      "input[data-location-name]",
    );
    input?.focus();
    input?.select();
  }, [editing]);

  function move(key: string, destination: number) {
    const index = stores.findIndex(
      (store, position) => keyFor(store, position) === key,
    );
    if (
      index < 0 ||
      destination === index ||
      destination < 0 ||
      destination >= stores.length
    )
      return;
    const label = labelFor(stores[index]!, index);
    update((next) => {
      const current = next.stores.findIndex(
        (store, position) => keyFor(store, position) === key,
      );
      if (current >= 0)
        next.stores = moveItem(
          next.stores,
          current,
          Math.min(destination, next.stores.length - 1),
        );
    });
    setAnnouncement(
      `${label}: ${t("Position")} ${destination + 1} ${t("of")} ${stores.length}.`,
    );
  }

  function start(event: PointerEvent<HTMLButtonElement>, key: string) {
    if (event.button !== 0 || stores.length < 2) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      key,
      pointerId: event.pointerId,
      startY: event.clientY,
      active: false,
      destination: null,
    };
  }
  function track(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || !list.current)
      return;
    if (!current.active && Math.abs(event.clientY - current.startY) < 5) return;
    event.preventDefault();
    current.active = true;
    const bounds = list.current.getBoundingClientRect();
    current.destination = null;
    if (
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top - 12 &&
      event.clientY <= bounds.bottom + 12
    ) {
      const others = [...list.current.children].filter(
        (element) =>
          (element as HTMLElement).dataset.locationKey !== current.key,
      );
      const before = others.findIndex((element) => {
        const rect = element.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      current.destination = before < 0 ? others.length : before;
      if (event.clientY < 72) window.scrollBy(0, -24);
      else if (event.clientY > window.innerHeight - 72) window.scrollBy(0, 24);
    }
    setDrag({ ...current });
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDrag(null);
    if (!cancel && current.active && current.destination !== null)
      move(current.key, current.destination);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function add() {
    if (stores.length >= 200) return;
    const id = crypto.randomUUID();
    update((next) => {
      next.stores.push({
        id,
        city: "",
        name: t("New location"),
        address: "",
        phone: "",
        visible: true,
      });
    });
    setEditing(id);
  }
  function remove(key: string) {
    const index = stores.findIndex(
      (store, position) => keyFor(store, position) === key,
    );
    if (index < 0) return;
    setRemoved({ store: structuredClone(stores[index]!), index });
    update((next) => {
      const current = next.stores.findIndex(
        (store, position) => keyFor(store, position) === key,
      );
      if (current >= 0) next.stores.splice(current, 1);
    });
    if (editing === key) setEditing(null);
    setAnnouncement(t("Location removed from this draft."));
  }
  const canUndo =
    removed &&
    !stores.some((store) => store.id && store.id === removed.store.id);
  const sourceIndex = drag
    ? stores.findIndex((store, index) => keyFor(store, index) === drag.key)
    : -1;

  return (
    <div className="ns-locations">
      <header className="ns-locations-heading">
        <div>
          <h3>
            {t("Locations")} <span>{stores.length}</span>
          </h3>
          <p id={instructions}>
            {t(
              "Drag a handle or use the arrows to change the order. Arrow keys also work on a focused handle.",
            )}
          </p>
        </div>
        <button
          type="button"
          className="ns-location-add"
          disabled={stores.length >= 200}
          onClick={add}
        >
          <NavIcon name="plus" size={16} />
          {t("Add location")}
        </button>
      </header>
      {canUndo && (
        <div className="ns-location-undo">
          <span>
            {labelFor(removed.store, removed.index)} ·{" "}
            {t("Removed from this draft")}
          </span>
          <button
            type="button"
            disabled={stores.length >= 200}
            onClick={() => {
              update((next) => {
                next.stores.splice(
                  Math.min(removed.index, next.stores.length),
                  0,
                  structuredClone(removed.store),
                );
              });
              setRemoved(null);
              setAnnouncement(t("Location restored."));
            }}
          >
            {t("Undo")}
          </button>
        </div>
      )}
      {!stores.length && (
        <p className="ns-locations-empty">
          {t("No locations yet. Add a location to get started.")}
        </p>
      )}
      <ol
        ref={list}
        className="ns-location-list"
        aria-label={t("Store locations")}
      >
        {stores.map((store, index) => {
          const key = keyFor(store, index),
            label = labelFor(store, index),
            open = editing === key;
          const target =
            drag?.active &&
            drag.destination !== null &&
            sourceIndex !== drag.destination;
          const before =
            target &&
            (sourceIndex < drag.destination!
              ? index === drag.destination! + 1
              : index === drag.destination);
          const after =
            target &&
            drag.destination === stores.length - 1 &&
            index === stores.length - 1;
          return (
            <li
              key={key}
              data-location-key={key}
              className={`ns-location ${open ? "is-editing" : ""} ${drag?.active && drag.key === key ? "is-dragging" : ""} ${before ? "drop-before" : ""} ${after ? "drop-after" : ""}`}
            >
              <div className="ns-location-row">
                <button
                  type="button"
                  className="ns-location-grip"
                  aria-label={`${t("Drag to reorder")}: ${label}`}
                  title={t("Drag to reorder")}
                  aria-describedby={instructions}
                  disabled={stores.length < 2}
                  onPointerDown={(event) => start(event, key)}
                  onPointerMove={track}
                  onPointerUp={(event) => finish(event)}
                  onPointerCancel={(event) => finish(event, true)}
                  onLostPointerCapture={(event) => finish(event, true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      gesture.current = null;
                      setDrag(null);
                      return;
                    }
                    if (
                      !["ArrowUp", "ArrowDown", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    move(
                      key,
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? stores.length - 1
                          : index + (event.key === "ArrowUp" ? -1 : 1),
                    );
                  }}
                >
                  <EditorIcon name="drag" />
                </button>
                <div className="ns-location-copy">
                  <div>
                    <span className="ns-location-number">{index + 1}</span>
                    <strong>{label}</strong>
                  </div>
                  <span className="ns-location-address">
                    {[store.city, store.address].filter(Boolean).join(" · ") ||
                      t("Add an address")}
                  </span>
                  {store.phone && (
                    <span className="ns-location-phone">{store.phone}</span>
                  )}
                  <label className="ns-location-visible">
                    <input
                      type="checkbox"
                      checked={store.visible}
                      aria-label={`${t("Show")} ${label} ${t("in new brochures")}`}
                      onChange={(event) => {
                        const value = event.target.checked;
                        update((next) => {
                          const current = next.stores.find(
                            (entry, position) =>
                              keyFor(entry, position) === key,
                          );
                          if (current) current.visible = value;
                        });
                      }}
                    />
                    <span>{t("Include in new brochures")}</span>
                  </label>
                </div>
                <div className="ns-location-actions">
                  <div className="ns-location-order">
                    {(["up", "down"] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        disabled={
                          direction === "up"
                            ? index === 0
                            : index === stores.length - 1
                        }
                        aria-label={`${t("Move")} ${label} ${t(direction)}`}
                        title={t(direction === "up" ? "Move up" : "Move down")}
                        onClick={() =>
                          move(key, index + (direction === "up" ? -1 : 1))
                        }
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path
                            d={
                              direction === "up"
                                ? "m5 12 5-5 5 5"
                                : "m5 8 5 5 5-5"
                            }
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ns-location-edit"
                    aria-label={`${t(open ? "Close location editor" : "Edit location")}: ${label}`}
                    aria-expanded={open}
                    aria-controls={open ? editorId : undefined}
                    onClick={() => setEditing(open ? null : key)}
                  >
                    <NavIcon name={open ? "check" : "edit"} size={16} />
                    <span>{t(open ? "Done" : "Edit")}</span>
                  </button>
                  <button
                    type="button"
                    className="ns-location-delete"
                    aria-label={`${t("Delete location")}: ${label}`}
                    title={t("Delete location")}
                    onClick={() => remove(key)}
                  >
                    <NavIcon name="trash" size={16} />
                  </button>
                </div>
              </div>
              {open && (
                <div id={editorId} className="ns-location-fields">
                  {(
                    [
                      ["name", "Store name"],
                      ["city", "City"],
                      ["address", "Address"],
                      ["phone", "Phone"],
                    ] as const
                  ).map(([field, caption]) => (
                    <Field key={field} label={t(caption)}>
                      <input
                        data-location-name={
                          field === "name" ? "true" : undefined
                        }
                        value={store[field]}
                        type={field === "phone" ? "tel" : "text"}
                        onChange={(event) => {
                          const value = event.target.value;
                          update((next) => {
                            const current = next.stores.find(
                              (entry, position) =>
                                keyFor(entry, position) === key,
                            );
                            if (current) current[field] = value;
                          });
                        }}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <span
        className="ns-location-announcement"
        role="status"
        aria-live="polite"
      >
        {announcement}
      </span>
    </div>
  );
}
