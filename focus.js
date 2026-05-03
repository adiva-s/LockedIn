document.addEventListener("DOMContentLoaded", () => {

  let intervalID
  let isCompleting = false 

  const summaryInput = document.getElementById("summaryInput")

  summaryInput.addEventListener("input", () => {
    summaryInput.style.borderBottomColor = "var(--blue-dim)"
  })

  chrome.storage.local.get(["task","endTime","sessions","startTime"], data => {

    const task = data.task
    let endTime = data.endTime
    const startTime = data.startTime

    document.getElementById("taskText").textContent =
      "Task: " + task

    const timerElement = document.getElementById("timer")
    const actions = document.getElementById("actions")
    const status = document.getElementById("statusText")
    const progressFill = document.getElementById("progressFill")
    const progressText = document.getElementById("progressText")

    function updateTimer(){

      const now = Date.now()
      const remaining = endTime - now

      if(startTime && endTime){
        const total = endTime - startTime
        const elapsed = now - startTime

        let percent = (elapsed / total) * 100
        percent = Math.max(0, Math.min(100, percent))

        progressFill.style.width = percent + "%"
        document.getElementById("bottomFill").style.width = percent + "%"
        progressText.textContent = Math.floor(percent) + "% completed"

        if(percent > 95){
          progressFill.style.background = "#ff3131"
          progressFill.style.boxShadow = "0 0 8px #ff3131"
          document.getElementById("bottomFill").style.background = "#ff3131"
          document.getElementById("timer").classList.add("danger")
          document.getElementById("timer").classList.remove("warning")
        } else if(percent > 80){
          progressFill.style.background = "#ffdd00"
          progressFill.style.boxShadow = "0 0 8px #ffdd00"
          document.getElementById("bottomFill").style.background = "#ffdd00"
          document.getElementById("timer").classList.add("warning")
          document.getElementById("timer").classList.remove("danger")
        }
      }

      if(remaining <= 0){

        timerElement.textContent = "00:00"
        status.textContent = "Did you finish your task?"
        actions.classList.add("show")

        clearInterval(intervalID)

        // FIX: freeze the end time the moment the timer hits zero
        chrome.storage.local.set({ sessionEndTime: Date.now() })

        return
      }

      const minutes = Math.floor(remaining/60000)
      const seconds = Math.floor((remaining%60000)/1000)

      timerElement.textContent =
        minutes + ":" + seconds.toString().padStart(2,"0")
    }

    updateTimer()
    intervalID = setInterval(updateTimer,1000)

  })

  // DONE BUTTON
  document.getElementById("doneBtn").onclick = () => {
    document.getElementById("actions").classList.remove("show")
    document.getElementById("summaryBox").classList.add("show")
  }

  // SAVE SUMMARY
  document.getElementById("saveSummary").onclick = () => {

    clearInterval(intervalID)

    const summary = summaryInput.value.trim()

    if(!summary){
      summaryInput.style.borderBottomColor = "#b85a5a"
      summaryInput.placeholder = "You must write what you did 👀"
      return
    }

    // FIX: include sessionEndTime in the get call
    chrome.storage.local.get(["sessions","task","startTime","sessionEndTime"], data => {

      const sessions = data.sessions || []

      const today = new Date().toISOString()
      const startTime = data.startTime

      // FIX: use sessionEndTime (frozen at timer end) instead of Date.now()
      const sessionEndTime = data.sessionEndTime || Date.now()

      let duration = 0
      if(startTime){
        duration = Math.round((sessionEndTime - startTime) / 60000)
      }

      const newSession = {
        date: today,
        task: data.task || "No task",
        summary: summary,
        duration: duration
      }

      sessions.push(newSession)
      sessions.sort((a, b) => new Date(a.date) - new Date(b.date))

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

      const streak = calculateStreak(sessions)

      window.isCompleting = true 

      // FIX: also clear sessionEndTime on save
      chrome.storage.local.set({
        sessions: sessions,
        focusLock: false,
        startTime: null,
        sessionEndTime: null
      }, () => {

        // Show complete screen
        document.getElementById("focusScreen").classList.add("hidden")
        document.getElementById("sessionLabel").textContent = "COMPLETE"
        const cs = document.getElementById("completeScreen")
        cs.classList.remove("hidden")

        document.getElementById("completeTask").textContent = newSession.task
        document.getElementById("completeSummary").textContent = "→ " + newSession.summary
        document.getElementById("streakNum").textContent = streak
        document.getElementById("sessionsNum").textContent = sessions.length

        document.getElementById("continueBtn").onclick = () => {
          window.location.href = chrome.runtime.getURL("popup.html")
        }
        document.getElementById("historyBtn").onclick = () => {
          window.location.href = chrome.runtime.getURL("history.html")
        }
        document.getElementById("returnBtn").onclick = () => {
          chrome.storage.local.get(["lastBlockedUrl"], data => {
            window.location.href = data.lastBlockedUrl || "https://www.google.com"
          })
        }

      })

    })

  }

  // ADD MORE TIME
  document.getElementById("moreBtn").onclick = () => {
    document.getElementById("addTimeBox").classList.add("show")
  }

  document.getElementById("addBtn").onclick = () => {

    const extra = document.getElementById("extraMinutes").value
    const newEnd = Date.now() + extra * 60000

    chrome.storage.local.set({ endTime: newEnd })

    location.reload()
  }

})

//  FIXED LISTENER
chrome.storage.onChanged.addListener((changes, area) => {

  if(area === "local" && changes.focusLock){

    const newValue = changes.focusLock.newValue

    //  DO NOT reload if we're completing session
    if(newValue === false && !window.isCompleting){
      location.reload()
    }
  }

})