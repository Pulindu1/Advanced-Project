import React from 'react'
import { useParams } from 'react-router-dom'

export const VaultEntryPage: React.FC = () => {
  const { entryId } = useParams()
  return (
    <div>
      <h2>Entry {entryId}</h2>
      <p>Details and edit form go here.</p>
    </div>
  )
}
