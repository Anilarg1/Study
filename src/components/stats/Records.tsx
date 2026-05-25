// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso: string): string {
  if (!iso) return '—'
  // Append T00:00 so the browser parses as local midnight, not UTC midnight
  const d = new Date(`${iso}T00:00`)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ─── props ────────────────────────────────────────────────────────────────────

interface RecordsProps {
  records: {
    bestDayMins:   number
    bestDayStr:    string
    bestWeekMins:  number
    bestWeekStart: string
  }
  longestStreak: number
}

// ─── component ────────────────────────────────────────────────────────────────

export function Records({ records, longestStreak }: RecordsProps) {
  return (
    <div className="sc">
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
          </svg>
          Records
        </span>
      </div>

      {/* Records strip */}
      <div className="s-records">
        <div>
          <div className="lbl">Best day</div>
          <div className="val">
            {records.bestDayMins >= 60
              ? <>{Math.floor(records.bestDayMins / 60)}<sup>h</sup> {records.bestDayMins % 60}<sup>m</sup></>
              : <>{records.bestDayMins}<sup>m</sup></>
            }
          </div>
          <div className="when">{records.bestDayStr ? fmtDate(records.bestDayStr) : '—'}</div>
        </div>
        <div>
          <div className="lbl">Best week</div>
          <div className="val">
            {records.bestWeekMins >= 60
              ? <>{Math.floor(records.bestWeekMins / 60)}<sup>h</sup> {records.bestWeekMins % 60}<sup>m</sup></>
              : <>{records.bestWeekMins}<sup>m</sup></>
            }
          </div>
          <div className="when">{records.bestWeekStart ? fmtDate(records.bestWeekStart) : '—'}</div>
        </div>
        <div>
          <div className="lbl">Longest streak</div>
          <div className="val">{longestStreak > 0 ? <>{longestStreak}<sup>d</sup></> : '—'}</div>
          <div className="when">{longestStreak > 0 ? 'all time' : ''}</div>
        </div>
      </div>
    </div>
  )
}
