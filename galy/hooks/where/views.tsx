/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
// The pane's tree of elements — and nothing else.
//
// Every decision about what is drawn lives in `render.mjs`, which answers rows of plain
// segments; this file turns a row into a `Text`, into a `Button` when the row can be
// pressed, and wraps a segment in a `Link` when it carries an address. That boundary is
// what lets the whole appearance be tested in node.

import type { ElementConstructor, RenderElement } from 'claude-code'

import type { ButtonProps, BoxProps, LinkProps, TextProps } from 'claude-code'

export type Kit = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
}

export type Press = { kind: string; id?: number }

export type Segment = { text: string; bold?: boolean; dim?: boolean; strikethrough?: boolean; url?: string }

/** The columns before a row's text, drawn once and never wrapped. */
export type Lead = { indent: number; prefix: string; bold?: boolean }

export type Row = {
  key: string
  segments: Segment[]
  lead?: Lead
  /** An empty line: what parts two trees, and a chain from its brief. */
  kind?: 'blank'
  /** Framed the whole width of the body: the brief. */
  boxed?: boolean
  press?: Press
}

/**
 * The pane's body, one row per line.
 *
 * A row that names something carries its lead apart from its text: the lead is drawn
 * once, and the text wraps in the room left beside it, so a title longer than the pane
 * continues under its own first character rather than under the mark. A boxed row is
 * framed the whole width of the body, its text wrapping inside the frame; a blank row is
 * one empty line. A row without a lead — a key result, a gap, the inline summary — is
 * truncated at the body's width, and a row that can be pressed is a button, which
 * carries a label and is truncated too.
 *
 * @param kit the elements `$.ui.resolve(e)` handed out
 * @param rows what `dockRows` or `inlineRows` answered
 * @param onPress what a pressable row runs
 * @returns the pane's tree
 */
export function paneView(
  kit: Kit,
  rows: readonly Row[],
  onPress: (press: Press) => void,
): RenderElement {
  const { Box, Text, Button, Link } = kit

  /**
   * One segment: its text, and around it the address the row carries, so the name opens
   * the page it names. The style stays on the inner `Text` either way — a link is drawn
   * in the bold or dim it already had, not in a style of its own.
   */
  const segmentOf = (row: Row, segment: Segment, index: number): RenderElement => {
    const drawn = (
      <Text
        key={`${row.key}-${index}`}
        bold={segment.bold}
        dimColor={segment.dim}
        strikethrough={segment.strikethrough}
      >
        {segment.text}
      </Text>
    )

    if (segment.url === undefined) return drawn

    return (
      <Link key={`${row.key}-${index}-link`} href={segment.url}>
        {drawn}
      </Link>
    )
  }

  return (
    <Box flexDirection="column">
      {rows.map(row => {
        if (row.kind === 'blank') return <Box key={row.key} height={1} />

        if (row.boxed) {
          return (
            <Box key={row.key} borderStyle="round" borderDimColor paddingX={1}>
              <Text wrap="wrap">
                {row.segments.map((segment, index) => segmentOf(row, segment, index))}
              </Text>
            </Box>
          )
        }

        if (row.press) {
          const press = row.press
          const label = row.segments.map(segment => segment.text).join('')

          return (
            <Button
              key={row.key}
              plain
              dimColor
              label={label}
              onPress={() => onPress(press)}
            />
          )
        }

        if (row.lead) {
          // The lead keeps its columns whatever the width — it never shrinks into a wrap
          // of its own — and the text takes the rest of the row, wrapping inside it.
          return (
            <Box key={row.key} flexDirection="row" marginLeft={row.lead.indent}>
              <Box flexShrink={0}>
                <Text bold={row.lead.bold}>{row.lead.prefix}</Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="wrap">
                  {row.segments.map((segment, index) => segmentOf(row, segment, index))}
                </Text>
              </Box>
            </Box>
          )
        }

        return (
          <Text key={row.key} wrap="truncate-end">
            {row.segments.map((segment, index) => segmentOf(row, segment, index))}
          </Text>
        )
      })}
    </Box>
  )
}
