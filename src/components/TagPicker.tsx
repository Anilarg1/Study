import { useState, useRef, useEffect } from 'react'
import useTagStore from '../store/useTagStore'

// ── AddTagForm ────────────────────────────────────────────────────────────────
// Renders the inline add-tag input + button + error message.
// Escape in the input calls onDismiss (stopPropagation prevents the modal's
// own Escape listener from also firing).

interface AddTagFormProps {
  value:     string
  onChange:  (name: string) => void
  onSubmit:  () => void
  onDismiss: () => void
  error:     string | null
}

export function AddTagForm({ value, onChange, onSubmit, onDismiss, error }: AddTagFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); onSubmit() }
            if (e.key === 'Escape') { e.stopPropagation(); onDismiss() }
          }}
          placeholder="Tag name"
          maxLength={30}
          style={{
            flex: 1,
            background: 'var(--surface-3)',
            border: '1px solid var(--hairline-2)',
            borderRadius: 6,
            padding: '5px 8px',
            fontSize: 12,
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>
      )}
    </div>
  )
}

// ── useTagPicker ──────────────────────────────────────────────────────────────
// Encapsulates add-tag form state. Call onTagCreated(id) when a tag is saved.

interface UseTagPickerReturn {
  newTagName:    string
  setNewTagName: (v: string) => void
  tagAddError:   string | null
  showAddTag:    boolean
  setShowAddTag: (v: boolean) => void
  handleAddTag:  () => Promise<void>
  dismissAddTag: () => void
}

export function useTagPicker(onTagCreated: (tagId: string) => void): UseTagPickerReturn {
  const addTag = useTagStore(s => s.addTag)

  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
  const [showAddTag,  setShowAddTag]  = useState(false)

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setTagAddError(null)
    const tag = await addTag(name)
    if (tag) {
      onTagCreated(tag.id)
      setNewTagName('')
      setShowAddTag(false)
    } else {
      setTagAddError('Could not save — check your connection.')
    }
  }

  function dismissAddTag() {
    setNewTagName('')
    setTagAddError(null)
    setShowAddTag(false)
  }

  return { newTagName, setNewTagName, tagAddError, showAddTag, setShowAddTag, handleAddTag, dismissAddTag }
}
