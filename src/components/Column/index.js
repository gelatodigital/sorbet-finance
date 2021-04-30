import styled from 'styled-components'

export const Column = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`
export const ColumnCenter = styled(Column)`
  width: 100%;
  align-items: center;
`
export const AutoColumn = styled.div`
    display: grid;
    grid-auto-rows: auto;
    grid-row-gap: inherit;
    justify-items: ${(props) => props.justify && props.justify};
  `