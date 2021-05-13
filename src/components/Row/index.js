import styled from 'styled-components'
import { Box } from 'rebass/styled-components'

const Row = styled(Box)`
  width: ${(props) => props.width ?? '100%'};
  display: flex;
  padding: 0;
  align-items: ${(props) => props.align ?? 'center'};
  justify-content: ${(props) => props.justify ?? 'flex-start'};
  padding: ${(props) => props.padding};
  border: ${(props) => props.border};
  border-radius: ${(props) => props.borderRadius};
`

export const RowBetween = styled(Row)`
  justify-content: space-between;
`

export const RowFlat = styled.div`
  display: flex;
  align-items: flex-end;
`

export const AutoRow =
  styled(Row) <
  { gap: String, justify: String } >
  `
  flex-wrap: wrap;
  margin: ${({ gap }) => gap && `-${gap}`};
  justify-content: ${({ justify }) => justify && justify};

  & > * {
    margin: ${({ gap }) => gap} !important;
  }
`

export const RowFixed =
  styled(Row) <
  { gap: String, justify: String } >
  `
  width: fit-content;
  margin: ${({ gap }) => gap && `-${gap}`};
`

export default Row
