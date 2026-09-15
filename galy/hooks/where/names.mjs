// The names, marks and limits the pane is drawn with — one place, so a word never
// differs between the view that draws it and the test that reads it back.

/** The pane's id: `$.ui.open({ id })`, and what `ui.render` / `ui.close` are filtered on. */
export const PANE_ID = "bg-where";

/** The pane's tab label. */
export const PANE_TITLE = "Où j'en suis";

/** The slash command that opens and closes it. */
export const COMMAND_NAME = "where";

/** The one line `/help` and the typeahead show for it. */
export const COMMAND_DESCRIPTION =
  "Show, beside the transcript, the strategy tree of what this working copy has in hand";

/** Where the person's own open/close choice is remembered, across sessions of this machine. */
export const STORE_OPEN_KEY = "where/open";

/** How long a name read from the workspace stays good, in milliseconds. */
export const NAMES_TTL_MS = 180_000;

/** A read that runs past this is a gap, not a wait: the pane never sits on "reading". */
export const READ_DEADLINE_MS = 8_000;

/** Work untouched for longer than this is no longer in hand — the row's own horizon. */
export const HORIZON_MS = 86_400_000;

/** Redraws are coalesced: at most one every this many milliseconds. */
export const REDRAW_COALESCE_MS = 100;

/**
 * A workspace write is followed by ONE refresh, this long after the LAST write of a burst.
 *
 * The timer is re-armed by every write, so twenty writes in a row cost one read of the
 * entities they touched rather than twenty reads of everything.
 */
export const REFRESH_AFTER_WRITE_MS = 1_500;

/** How often the work file's modification time is read again. */
export const FILE_POLL_MS = 60_000;

/** Below this many columns the dock is not drawn, and `/where` answers the resize line. */
export const OPEN_MIN_COLUMNS = 110;

/** Sibling specs drawn before the rest become a count. */
export const SIBLINGS_SHOWN = 3;

/** The inline summary's budget, in rows. */
export const INLINE_MAX_ROWS = 8;

/** What each status is drawn as. */
export const MARKS = { Done: "✓", InProgress: "●", other: "○" };

/** What a phase drawn on a row of its own opens with: the one in progress points at itself. */
export const PHASE_ROW_MARKS = { Done: "✓", InProgress: "▶", other: "○" };

/** An objective that carries no icon of its own is drawn with this. */
export const OBJECTIVE_MARK = "◆";

/** The columns an objective's mark occupies, icon or not, so the chain stays aligned. */
export const MARK_COLUMNS = 2;

export const EMPTY_TEXT = "Pas de travail en cours.";
export const LOADING_TEXT = "Lecture de l'espace de travail…";
export const IN_HAND_TEXT = "← en main";
export const OUTSIDE_STRATEGY_TEXT = "brief hors stratégie";
export const REFRESH_TEXT = "rafraîchir";
export const TOO_LARGE_TEXT = "trop volumineuse pour l'API des mods";
export const RESIZE_TEXT =
  "The terminal is too narrow for the pane — widen it to at least 110 columns, then /where again.";
export const SHOWN_TEXT = "Où j'en suis is beside the transcript. /where hides it.";
export const HIDDEN_TEXT = "Où j'en suis is hidden. /where brings it back.";
export const NO_WORKSPACE_TEXT =
  "No workspace answers `feature_spec_get` here — connect this repository first (the `connect` skill).";
