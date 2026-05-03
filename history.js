function calculateStreak(sessions){
  if(sessions.length === 0) return 0

  const uniqueDates = [...new Set(sessions.map(s => {
    const d = new Date(s.date)
    d.setHours(0,0,0,0)
    return d.getTime()
  }))].sort((a,b) => a - b)

  let streak = 1

  for(let i = uniqueDates.length - 1; i > 0; i--){
    const diff = (uniqueDates[i] - uniqueDates[i-1]) / (1000*60*60*24)
    if(Math.round(diff) === 1){
      streak++
    } else {
      break
    }
  }

  return streak
}

function getGroupKey(dateStr, view){
  const d = new Date(dateStr)

  if(view === "day"){
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
  }

  if(view === "week"){
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = d => d.toLocaleDateString("en-US", { month:"short", day:"numeric" })
    return `${fmt(monday)} – ${fmt(sunday)}`
  }

  if(view === "month"){
    return d.toLocaleDateString("en-US", { month:"long", year:"numeric" })
  }
}

function getSortKey(dateStr, view){
  const d = new Date(dateStr)
  if(view === "day"){
    d.setHours(0,0,0,0)
    return d.getTime()
  }
  if(view === "week"){
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0,0,0,0)
    return monday.getTime()
  }
  if(view === "month"){
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }
}

function renderHistory(sessions, view){
  const historyDiv = document.getElementById("history")
  historyDiv.innerHTML = ""

  if(sessions.length === 0){
    historyDiv.innerHTML = '<div class="empty">No sessions yet.</div>'
    return
  }

  // Group sessions
  const groups = {}
  const groupSortKeys = {}

  sessions.forEach(s => {
    const key = getGroupKey(s.date, view)
    const sortKey = getSortKey(s.date, view)
    if(!groups[key]){
      groups[key] = []
      groupSortKeys[key] = sortKey
    }
    groups[key].push(s)
  })

  // Sort groups newest first
  const sortedKeys = Object.keys(groups).sort((a,b) => groupSortKeys[b] - groupSortKeys[a])

  sortedKeys.forEach((key, index) => {
    const groupSessions = groups[key]

    const totalTime = groupSessions.reduce((sum, s) => sum + (s.duration || 0), 0)
    const sessionCount = groupSessions.length
    const uniqueTasks = [...new Set(groupSessions.map(s => s.task))].length

    const groupCard = document.createElement("div")
    groupCard.className = "group-card"

    const header = document.createElement("div")
    header.className = "group-header"
    header.innerHTML = `
      <div>
        <div class="group-title">${key}</div>
        <div class="group-stats">
          <span>${sessionCount} session${sessionCount !== 1 ? "s" : ""}</span>
          <span>${totalTime} min</span>
          <span>${uniqueTasks} task${uniqueTasks !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <span class="group-arrow ${index === 0 ? "open" : ""}">▼</span>
    `

    const sessionsDiv = document.createElement("div")
    sessionsDiv.className = `group-sessions ${index === 0 ? "open" : ""}`

    // Sort sessions newest first within group
    groupSessions.slice().reverse().forEach(s => {
      const time = new Date(s.date).toLocaleTimeString("en-US", {
        hour:"numeric", minute:"2-digit"
      })
      const dateStr = new Date(s.date).toLocaleDateString("en-US", {
        month:"short", day:"numeric"
      })

      const item = document.createElement("div")
      item.className = "session-item"
      item.innerHTML = `
        <div class="session-task"></div>
        <div class="session-meta">${view !== "day" ? dateStr + " · " : ""}${time} · ${s.duration || "?"} min</div>
        <div class="session-summary">→ <span></span></div>
      `
      item.querySelector(".session-task").textContent = s.task || "No task"
      item.querySelector(".session-summary span").textContent = s.summary || ""
      sessionsDiv.appendChild(item)
    })

    // Toggle open/close
    header.addEventListener("click", () => {
      const arrow = header.querySelector(".group-arrow")
      const isOpen = sessionsDiv.classList.contains("open")
      sessionsDiv.classList.toggle("open", !isOpen)
      arrow.classList.toggle("open", !isOpen)
    })

    groupCard.appendChild(header)
    groupCard.appendChild(sessionsDiv)
    historyDiv.appendChild(groupCard)
  })
}

// --- Main ---
chrome.storage.local.get(["sessions"], data => {

  // Dates to exclude from stats and history (format: YYYY-MM-DD)
  const IGNORED_DATES = ["2026-03-18"]

  const allSessions = data.sessions || []
  const sessions = allSessions.filter(s => !IGNORED_DATES.some(d => s.date.startsWith(d)))
  const totalSessions = sessions.length

  const uniqueDays = new Set(
    sessions.map(s => {
      const d = new Date(s.date)
      d.setHours(0,0,0,0)
      return d.getTime()
    })
  )

  const totalDays = uniqueDays.size

  let totalMinutes = 0
  sessions.forEach(s => { totalMinutes += s.duration || 0 })

  const validSessions = sessions.filter(s => s.duration)
  const avgMinutes = validSessions.length
    ? Math.round(validSessions.reduce((sum, s) => sum + s.duration, 0) / validSessions.length)
    : 0

  // Best day
  // Best day based on TOTAL TIME
  const dayTotals = {}

  sessions.forEach(s => {
    const day = new Date(s.date).toDateString()
    dayTotals[day] = (dayTotals[day] || 0) + (s.duration || 0)
  })

  let bestDay = null
  let maxMinutes = 0

  for(const day in dayTotals){
    if(dayTotals[day] > maxMinutes){
      maxMinutes = dayTotals[day]
      bestDay = day
    }
  }

  const bestHours = Math.floor(maxMinutes / 60)
  const bestMins = maxMinutes % 60

  const formattedBestDay = bestDay
    ? new Date(bestDay).toLocaleDateString("en-US", { month:"short", day:"numeric" })
    : "N/A"

  const bestDayText = bestDay
    ? `${formattedBestDay} • ${bestHours ? bestHours + "h " : ""}${bestMins}m`
    : "N/A"

  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  document.getElementById("s-sessions").textContent = totalSessions
  document.getElementById("s-time").textContent = hours + "h " + mins + "m"
  document.getElementById("s-avg").textContent = avgMinutes
  document.getElementById("s-best").textContent = formattedBestDay || "—"

  const streak = calculateStreak(sessions)
  const streakRow = document.getElementById("streakRow")
  if(streakRow) streakRow.innerHTML = "Current streak — <span>" + streak + " day" + (streak !== 1 ? "s" : "") + "</span>"
  // Render with default view
  let currentView = "day"
  renderHistory(sessions, currentView)

  // Toggle buttons
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"))
      btn.classList.add("active")
      currentView = btn.dataset.view
      renderHistory(sessions, currentView)
    })
  })

})

// --- Nav ---
document.getElementById("backBtn").onclick = () => {
  window.location.href = chrome.runtime.getURL("popup.html")
}

// --- Export ---
document.getElementById("exportBtn").onclick = () => {
  chrome.storage.local.get(["sessions"], data => {
    const sessions = data.sessions || []
    const blob = new Blob(
      [JSON.stringify(sessions, null, 2)],
      {type: "application/json"}
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "lockedin-backup.json"
    a.click()
    URL.revokeObjectURL(url)
  })
}

// --- Import ---
document.getElementById("importBtn").onclick = () => {
  document.getElementById("importFile").click()
}

document.getElementById("importFile").onchange = (e) => {
  const file = e.target.files[0]
  if(!file) return

  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result)

      if(!Array.isArray(imported)){
        alert("Invalid backup file!")
        return
      }

      chrome.storage.local.get(["sessions"], data => {
        const existing = data.sessions || []
        const merged = [...existing, ...imported]

        const seen = new Set()
        const deduped = merged.filter(s => {
          const key = s.date + s.task
          if(seen.has(key)) return false
          seen.add(key)
          return true
        })

        deduped.sort((a, b) => new Date(a.date) - new Date(b.date))

        chrome.storage.local.set({sessions: deduped}, () => {
          alert("Import successful! " + imported.length + " sessions imported.")
          location.reload()
        })
      })

    } catch(err) {
      alert("Failed to read file. Make sure it's a valid FocusLock backup!")
    }
  }

  reader.readAsText(file)
}