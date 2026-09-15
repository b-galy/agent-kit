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

export type Segment = { text: string; bold?: boolean; dim?: boolean; url?: string }

export type Row = {
  key: string
  segments: Segment[]
  press?: Press
}

/**
 * The pane's body: one row a line, truncated at the body's width rather than wrapped —
 * a title that wraps breaks the tree apart, which is the one thing this pane is for.
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
      <Text key={`${row.key}-${index}`} bold={segment.bold} dimColor={segment.dim}>
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

        return (
          <Text key={row.key} wrap="truncate-end">
            {row.segments.map((segment, index) => segmentOf(row, segment, index))}
          </Text>
        )
      })}
    </Box>
  )
}
