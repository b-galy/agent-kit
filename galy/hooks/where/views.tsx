/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
// The pane's tree of elements — and nothing else.
//
// Every decision about what is drawn lives in `render.mjs`, which answers rows of plain
// segments; this file turns a row into a `Text`, or into a `Button` when the row can be
// pressed. That boundary is what lets the whole appearance be tested in node.

import type { ElementConstructor, RenderElement } from 'claude-code'

import type { ButtonProps, BoxProps, TextProps } from 'claude-code'

export type Kit = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

export type Press = { kind: string; id?: number }

export type Row = {
  key: string
  segments: Array<{ text: string; bold?: boolean; dim?: boolean }>
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
  const { Box, Text, Button } = kit

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
            {row.segments.map((segment, index) => (
              <Text key={`${row.key}-${index}`} bold={segment.bold} dimColor={segment.dim}>
                {segment.text}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}
