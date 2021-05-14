import styled from 'styled-components'
import { AutoColumn } from '../Column'

export const TextBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 20px;
  width: fit-content;
  justify-self: flex-end;
`

export const DataCard = styled(AutoColumn)`
  border-radius: 12px;
  width: 100%;
  position: relative;
  overflow: hidden;
`

export const CardSection = styled(AutoColumn)`
  padding: 1rem;
  z-index: 1;
  opacity: ${(props) => props.disabled && '0.4'};
`

export const Break = styled.div`
  width: 100%;
  background-color: rgba(255, 255, 255, 0.2);
  height: 1px;
`
