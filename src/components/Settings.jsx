import { useState, useEffect } from 'react'
import useSettingsStore, {
  applyTheme, applyDensity, applyFontScale, applyContrast,
} from '../store/useSettingsStore'
import useAuthStore from '../store/useAuthStore'
import { supabase } from '../lib/supabase'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IcUser() {
  return (
    <svg className="sni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )
}
function IcPalette() {
  return (
    <svg className="sni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.55.45-1 1-1h1c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
      <circle cx="8.5"  cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12.5" cy="7.5"  r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="11"   r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IcBell() {
  return (
    <svg className="sni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
    </svg>
  )
}
function IcChevLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  )
}
function IcDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

// ── Theme selector icons ───────────────────────────────────────────────────────
function IcMoon() {
  return (
    <svg className="s-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
    </svg>
  )
}
function IcSun() {
  return (
    <svg className="s-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  )
}
function IcMonitor() {
  return (
    <svg className="s-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

// ── Nav sections ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'account',       label: 'Account & Profile', Icon: IcUser },
  { id: 'interface',     label: 'Interface',          Icon: IcPalette },
  { id: 'notifications', label: 'Notifications',      Icon: IcBell },
]

// ── Shared primitives ─────────────────────────────────────────────────────────

function Group({ title, children }) {
  return (
    <div className="s-group">
      {title && <div className="s-group-title">{title}</div>}
      <div className="s-group-body">{children}</div>
    </div>
  )
}

function Row({ label, description, children, danger, column }) {
  return (
    <div className={`s-row${danger ? ' s-row-danger' : ''}${column ? ' s-row-col' : ''}`}>
      <div className="s-row-left">
        <span className="s-row-label">{label}</span>
        {description && <span className="s-row-desc">{description}</span>}
      </div>
      <div className="s-row-right">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`s-toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  )
}

function Segment({ options, value, onChange }) {
  return (
    <div className="s-segment">
      {options.map(o => (
        <button
          key={o.value}
          className={`s-seg-btn${value === o.value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Avatar colour swatches ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#c97b5b', '#5d4a82'],
  ['#4cb782', '#2d7a9a'],
  ['#8b85ff', '#e05b8a'],
  ['#f5a25a', '#c45858'],
  ['#5e9eea', '#3d6ba8'],
]

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT SECTION
// ─────────────────────────────────────────────────────────────────────────────

function AccountSection({ onToast }) {
  const { user, signOut } = useAuthStore()
  const email    = user?.email ?? ''
  const handle   = email.split('@')[0]

  const [displayName,       setDisplayName]       = useState(user?.user_metadata?.display_name ?? handle)
  const [avatarIdx,         setAvatarIdx]          = useState(user?.user_metadata?.avatar_color_idx ?? 0)
  const [saving,            setSaving]             = useState(false)
  const [showDeletePrompt,  setShowDeletePrompt]   = useState(false)
  const [deleteInput,       setDeleteInput]        = useState('')

  const initials = (displayName || handle).slice(0, 2).toUpperCase()
  const [c1, c2] = AVATAR_COLORS[avatarIdx] ?? AVATAR_COLORS[0]

  async function saveName() {
    if (saving) return
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_color_idx: avatarIdx },
      })
      if (error) throw error
      onToast('Profile saved')
    } catch (e) {
      onToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordReset() {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      onToast('Reset link sent to ' + email)
    } catch (e) {
      onToast(e.message, 'error')
    }
  }

  async function handleExport() {
    try {
      const uid = user?.id
      const [{ data: sessions }, { data: subjects }] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', uid).order('completed_at', { ascending: false }),
        supabase.from('subjects').select('*').eq('user_id', uid),
      ])
      const payload = {
        exported_at: new Date().toISOString(),
        sessions:    sessions  ?? [],
        subjects:    subjects  ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `notebook-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      onToast('Data exported successfully')
    } catch (e) {
      onToast(e.message, 'error')
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'delete my account') return
    try {
      // Requires a Supabase RPC function 'delete_user' — sign out as fallback.
      const { error } = await supabase.rpc('delete_user').maybeSingle()
      if (error) throw error
      await signOut()
    } catch {
      // RPC not yet deployed — sign out and inform user
      await signOut()
      onToast('Signed out. Contact support to complete deletion.', 'error')
    }
  }

  return (
    <div>
      <div className="s-header">
        <h2 className="s-h2">Account &amp; Profile</h2>
        <p className="s-subhead">Manage your personal info, security, and data.</p>
      </div>

      {/* ── Profile ── */}
      <Group title="Profile">
        {/* Avatar */}
        <div className="s-avatar-row">
          <div
            className="s-avatar-preview"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="s-row-desc">Avatar colour</span>
            <div className="s-avatar-swatches">
              {AVATAR_COLORS.map(([a, b], i) => (
                <button
                  key={i}
                  className={`s-avatar-swatch${avatarIdx === i ? ' active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  onClick={() => setAvatarIdx(i)}
                  title={`Colour ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <Row label="Display name" description="Shown in your workspace and sessions">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="s-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Your name"
            />
            <button className="s-btn" onClick={saveName} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </Row>

        <Row label="Email" description="Your sign-in address">
          <span className="s-value-mono">{email}</span>
        </Row>
      </Group>

      {/* ── Plan ── */}
      <Group title="Subscription">
        <Row label="Current plan" description="You're on the free tier">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="s-badge-plan">Free</span>
            <button className="s-btn s-btn-ghost">Upgrade →</button>
          </div>
        </Row>
        <Row label="Renewal date" description="No active subscription">
          <span className="s-value-mono">—</span>
        </Row>
        <Row label="Billing history">
          <span className="s-value-mono" style={{ fontStyle: 'italic', opacity: 0.6 }}>
            No charges yet
          </span>
        </Row>
      </Group>

      {/* ── Security ── */}
      <Group title="Security">
        <Row label="Password" description="Send a reset link to your email">
          <button className="s-btn" onClick={handlePasswordReset}>Reset password</button>
        </Row>
        <Row label="Two-factor authentication" description="Adds a second layer of sign-in security">
          <span className="s-badge-soon">Coming soon</span>
        </Row>
        <Row label="Active sessions" description="Currently signed in on this device">
          <span className="s-value-mono">1 device</span>
        </Row>
      </Group>

      {/* ── Data ── */}
      <Group title="Data &amp; Privacy">
        <Row label="Export all data" description="Download your sessions and subjects as JSON">
          <button className="s-btn" onClick={handleExport}>
            <IcDownload />
            <span style={{ marginLeft: 6 }}>Export JSON</span>
          </button>
        </Row>

        {/* Delete account */}
        <div className={`s-row s-row-danger${showDeletePrompt ? ' s-row-col' : ''}`}>
          <div className="s-row-left">
            <span className="s-row-label">Delete account</span>
            <span className="s-row-desc">Permanently remove your account and all data</span>
          </div>
          <div className="s-row-right">
            {!showDeletePrompt ? (
              <button className="s-btn s-btn-danger" onClick={() => setShowDeletePrompt(true)}>
                Delete account
              </button>
            ) : (
              <div className="s-delete-confirm">
                <p className="s-delete-warning">
                  Type <strong>delete my account</strong> to confirm:
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="s-input s-input-danger"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="delete my account"
                    autoFocus
                  />
                  <button
                    className="s-btn s-btn-danger"
                    disabled={deleteInput !== 'delete my account'}
                    onClick={handleDeleteAccount}
                  >
                    Confirm
                  </button>
                  <button
                    className="s-btn s-btn-ghost"
                    onClick={() => { setShowDeletePrompt(false); setDeleteInput('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Group>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACE SECTION
// ─────────────────────────────────────────────────────────────────────────────

function InterfaceSection() {
  const s = useSettingsStore()

  function setTheme(theme) {
    s.setField('theme', theme)
    applyTheme(theme)
  }
  function setDensity(density) {
    s.setField('density', density)
    applyDensity(density)
  }
  function setFontScale(scale) {
    s.setField('fontScale', scale)
    applyFontScale(scale)
  }
  function setHighContrast(v) {
    s.setField('highContrast', v)
    applyContrast(v)
  }

  return (
    <div>
      <div className="s-header">
        <h2 className="s-h2">Interface &amp; Preferences</h2>
        <p className="s-subhead">Customise the look, layout, and regional settings of your workspace.</p>
      </div>

      {/* ── Theme ── */}
      <Group title="Theme">
        <div className="s-theme-grid">
          {[
            { id: 'dark',   label: 'Dark',   Icon: IcMoon },
            { id: 'light',  label: 'Light',  Icon: IcSun },
            { id: 'system', label: 'System', Icon: IcMonitor },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`s-theme-opt${s.theme === id ? ' active' : ''}`}
              onClick={() => setTheme(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Group>

      {/* ── Layout density ── */}
      <Group title="Layout Density">
        <Row label="View density" description="Controls spacing throughout the interface">
          <Segment
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact',     label: 'Compact' },
            ]}
            value={s.density}
            onChange={setDensity}
          />
        </Row>
      </Group>

      {/* ── Localisation ── */}
      <Group title="Localisation &amp; Regional">
        <Row label="Language">
          <select
            className="s-select"
            value={s.language}
            onChange={e => s.setField('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </Row>
        <Row label="Time format">
          <Segment
            options={[
              { value: '24h', label: '24 h' },
              { value: '12h', label: '12 h' },
            ]}
            value={s.timeFormat}
            onChange={v => s.setField('timeFormat', v)}
          />
        </Row>
        <Row label="First day of week">
          <Segment
            options={[
              { value: 'monday', label: 'Monday' },
              { value: 'sunday', label: 'Sunday' },
            ]}
            value={s.weekStart}
            onChange={v => s.setField('weekStart', v)}
          />
        </Row>
      </Group>

      {/* ── Accessibility ── */}
      <Group title="Accessibility">
        <Row label="Font size" description="Scales text throughout the app">
          <Segment
            options={[
              { value: 100, label: 'Normal' },
              { value: 110, label: 'Large' },
              { value: 120, label: 'X-Large' },
            ]}
            value={s.fontScale}
            onChange={setFontScale}
          />
        </Row>
        <Row label="High contrast" description="Increases border and text contrast">
          <Toggle checked={s.highContrast} onChange={setHighContrast} />
        </Row>
      </Group>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsSection() {
  const s = useSettingsStore()

  return (
    <div>
      <div className="s-header">
        <h2 className="s-h2">Notification Control</h2>
        <p className="s-subhead">Choose how and when Notebook reaches you.</p>
      </div>

      {/* ── Sound ── */}
      <Group title="Sound">
        <Row label="Sound alerts" description="Play a chime when each timer session completes">
          <Toggle checked={s.soundEnabled} onChange={v => s.setField('soundEnabled', v)} />
        </Row>
      </Group>

      {/* ── Channels ── */}
      <Group title="Channels">
        <Row label="Push notifications" description="Browser and mobile push alerts">
          <Toggle checked={s.pushEnabled} onChange={v => s.setField('pushEnabled', v)} />
        </Row>
        <Row label="Email digest" description="Daily summary of your activity">
          <Toggle checked={s.emailDigest} onChange={v => s.setField('emailDigest', v)} />
        </Row>
        <Row label="Desktop alerts" description="System-level desktop notifications">
          <Toggle checked={s.desktopAlerts} onChange={v => s.setField('desktopAlerts', v)} />
        </Row>
      </Group>

      {/* ── Triggers ── */}
      <Group title="Notification Triggers">
        <Row label="Mentions only" description="Alert only when mentioned in a shared session">
          <Toggle checked={s.notifyMentions} onChange={v => s.setField('notifyMentions', v)} />
        </Row>
        <Row label="Task due dates" description="Remind me before timetable blocks start">
          <Toggle checked={s.notifyDueDates} onChange={v => s.setField('notifyDueDates', v)} />
        </Row>
        <Row label="Daily recap" description="End-of-day summary of completed sessions">
          <Toggle checked={s.notifyDailyRecap} onChange={v => s.setField('notifyDailyRecap', v)} />
        </Row>
      </Group>

      {/* ── Do Not Disturb ── */}
      <Group title="Do Not Disturb">
        <Row label="Enable DND" description="Mute all notifications during quiet hours">
          <Toggle checked={s.dndEnabled} onChange={v => s.setField('dndEnabled', v)} />
        </Row>
        {s.dndEnabled && (
          <>
            <Row label="Quiet hours start">
              <input
                type="time"
                className="s-input s-input-time"
                value={s.dndStart}
                onChange={e => s.setField('dndStart', e.target.value)}
              />
            </Row>
            <Row label="Quiet hours end">
              <input
                type="time"
                className="s-input s-input-time"
                value={s.dndEnd}
                onChange={e => s.setField('dndEnd', e.target.value)}
              />
            </Row>
          </>
        )}
      </Group>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function Settings({ onBack }) {
  const [section, setSection] = useState('account')
  const [toast,   setToast]   = useState(null)

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Esc key → back
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="settings-view">

      {/* ── Left sub-nav ── */}
      <aside className="settings-sidenav">
        <button className="s-back-btn" onClick={onBack}>
          <IcChevLeft />
          Back
        </button>
        <div className="s-nav-label">Settings</div>
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`settings-nav-item${section === id ? ' active' : ''}`}
            onClick={() => setSection(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </aside>

      {/* ── Content ── */}
      <div className="settings-content">
        {section === 'account'       && <AccountSection       onToast={showToast} />}
        {section === 'interface'     && <InterfaceSection     onToast={showToast} />}
        {section === 'notifications' && <NotificationsSection onToast={showToast} />}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`v2-toast${toast.type === 'error' ? ' toast-err' : ''}`}>
          {toast.type === 'error' ? '✕  ' : '✓  '}{toast.msg}
        </div>
      )}
    </div>
  )
}
