const setup = document.getElementById("setup")
const active = document.getElementById("active")

const taskText = document.getElementById("activeTask")
const timerText = document.getElementById("timer")

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

    timerText.textContent =
      minutes + ":" + seconds.toString().padStart(2,"0")
  }

  updateTimer()
  setInterval(updateTimer,1000)
}


chrome.storage.local.get(["focusLock","task","endTime"], data => {

  if (data.focusLock && Date.now() < data.endTime) {

    showActive(data.task,data.endTime)
  }

})


document.getElementById("start").addEventListener("click", () => {

  const task = document.getElementById("task").value
  const minutes = document.getElementById("minutes").value
  const sitesInput = document.getElementById("blockedSites").value

  const blockedSites = sitesInput
    .split(",")
    .map(s => s.trim())
    .map(s => s.replace("https://","").replace("www.",""))
    .filter(s => s.length > 0)

  const endTime = Date.now() + minutes * 60000

  chrome.storage.local.set({
    focusLock: true,
    task: task,
    endTime: endTime,
    startTime: Date.now(),
    blockedSites: blockedSites
  }, () => {

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: chrome.runtime.getURL("focus.html") })
    })

  })

})


document.getElementById("end").addEventListener("click", () => {

  chrome.storage.local.set({focusLock:false})

  location.reload()

})

function calculateStreak(sessions){
    if(sessions.length === 0) return 0

    // Remove duplicate dates first
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

document.getElementById("viewHistory").onclick = () => {

  chrome.tabs.create({
    url: chrome.runtime.getURL("history.html")
  })

}


chrome.storage.local.get(["sessions"], data => {

  const sessions = data.sessions || []

  const streak = calculateStreak(sessions)

  const streakText = document.getElementById("streak")

  if(streakText){
    streakText.textContent = "🔥 " + streak + " Day Streak"
  }

})