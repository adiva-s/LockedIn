const setup = document.getElementById("setup")
const active = document.getElementById("active")

const taskText = document.getElementById("activeTask")
const timerText = document.getElementById("timer")

// ── Saved sites state ──────────────────────────────────────────
let savedSites = []      // persisted list from chrome.storage.sync
let selectedSites = new Set()  // toggled on for this session

function renderChips() {
  const row = document.getElementById("chipsRow")
  row.innerHTML = ""

  if (savedSites.length === 0) return

  savedSites.forEach(site => {
    const chip = document.createElement("div")
    chip.className = "chip" + (selectedSites.has(site) ? " selected" : "")

    const label = document.createTextNode(site)

    const removeBtn = document.createElement("span")
    removeBtn.className = "chip-remove"
    removeBtn.textContent = "×"
    removeBtn.title = "Remove from saved"
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      savedSites = savedSites.filter(s => s !== site)
      selectedSites.delete(site)
      chrome.storage.sync.set({ savedSites })
      renderChips()
    })

    chip.appendChild(label)
    chip.appendChild(removeBtn)

    chip.addEventListener("click", () => {
      if (selectedSites.has(site)) {
        selectedSites.delete(site)
      } else {
        selectedSites.add(site)
      }
      renderChips()
    })

    row.appendChild(chip)
  })
}

function addSite(raw) {
  const site = raw
    .trim()
    .replace("https://", "")
    .replace("http://", "")
    .replace("www.", "")
    .toLowerCase()

  if (!site || savedSites.includes(site)) return

  savedSites.push(site)
  selectedSites.add(site)   // auto-select when you add it
  chrome.storage.sync.set({ savedSites })
  renderChips()
}

document.getElementById("addSiteBtn").addEventListener("click", () => {
  const input = document.getElementById("newSiteInput")
  addSite(input.value)
  input.value = ""
})

document.getElementById("newSiteInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addSite(e.target.value)
    e.target.value = ""
  }
})

// Load saved sites on open
chrome.storage.sync.get(["savedSites"], data => {
  savedSites = data.savedSites || []
  renderChips()
})

// ── Active session timer ───────────────────────────────────────
function showActive(task, endTime) {
  setup.style.display = "none"
  active.style.display = "block"

  taskText.textContent = "Task: " + task

  function updateTimer() {
    const remaining = endTime - Date.now()
    if (remaining <= 0) {
      timerText.textContent = "00:00"
      return
    }
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    timerText.textContent = minutes + ":" + seconds.toString().padStart(2, "0")
  }

  updateTimer()
  setInterval(updateTimer, 1000)
}

chrome.storage.local.get(["focusLock", "task", "endTime"], data => {
  if (data.focusLock && Date.now() < data.endTime) {
    showActive(data.task, data.endTime)
  }
})

// ── Start session ──────────────────────────────────────────────
document.getElementById("start").addEventListener("click", () => {
  const task = document.getElementById("task").value
  const minutes = document.getElementById("minutes").value

  // Combine selected chips + anything typed in the add-site input
  const typedInput = document.getElementById("newSiteInput").value
  const extraSites = typedInput
    .split(",")
    .map(s => s.trim().replace("https://", "").replace("http://", "").replace("www.", "").toLowerCase())
    .filter(s => s.length > 0)

  const blockedSites = [...selectedSites, ...extraSites].filter((s, i, arr) => arr.indexOf(s) === i)

  const endTime = Date.now() + minutes * 60000

  chrome.storage.local.set({
    focusLock: true,
    task: task,
    endTime: endTime,
    startTime: Date.now(),
    blockedSites: blockedSites,
    lastBlockedUrl: null
  }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: chrome.runtime.getURL("focus.html") })
    })
  })
})

// ── End session ────────────────────────────────────────────────
document.getElementById("end").addEventListener("click", () => {
  chrome.storage.local.set({ focusLock: false })
  location.reload()
})

// ── Streak ─────────────────────────────────────────────────────
function calculateStreak(sessions) {
  if (sessions.length === 0) return 0

  const uniqueDates = [...new Set(sessions.map(s => {
    const d = new Date(s.date)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }))].sort((a, b) => a - b)

  let streak = 1
  for (let i = uniqueDates.length - 1; i > 0; i--) {
    const diff = (uniqueDates[i] - uniqueDates[i - 1]) / (1000 * 60 * 60 * 24)
    if (Math.round(diff) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

document.getElementById("viewHistory").onclick = () => {
  window.location.href = chrome.runtime.getURL("history.html")
}

chrome.storage.local.get(["sessions"], data => {
  const sessions = data.sessions || []
  const streak = calculateStreak(sessions)
  const streakText = document.getElementById("streak")
  if (streakText) {
    streakText.textContent = streak + " day streak"
  }
})
