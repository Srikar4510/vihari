import React, { useState } from 'react'
import busContext from './busContext'

const STORAGE_KEY = 'vihari-booking-draft'

const readDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

// Holds the bus booking in progress ({ bus, seats, date, from, to }). It is kept in sessionStorage
// so refreshing the passenger page doesn't lose the selected seats.
const BusState = (props) => {
  const [draft, setDraftState] = useState(readDraft)

  const setDraft = (next) => {
    setDraftState(next)
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage can be unavailable (private mode); the in-memory draft still works.
    }
  }

  return (
    <busContext.Provider value={{ draft, setDraft }}>
      {props.children}
    </busContext.Provider>
  )
}

export default BusState
