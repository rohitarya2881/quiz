// Global Variables
let db; // IndexedDB database instance
let quizzes = {}; // Stores all quiz data (temporary cache)
let currentQuiz = []; // Stores the current quiz being taken
let currentFolder = ""; // Stores the currently selected folder
let currentQuestionIndex = 0; // Tracks the current question index in the quiz
let incorrectQuestions = []; // Stores incorrectly answered questions
let score = 0; // Tracks the user's score
let quizMode = ""; // Tracks the current quiz mode (e.g., "complete" or "difficult")
let questionStartTime = 0;
let questionTimes = []; // Array to store time taken for each question
let totalQuizTime = 0;
// Add to your global variables
let flashcardInterval = null;
let flashcardStartTime = 0;
// Initialize IndexedDB
// Update the initDB function in script.js
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("QuizManagerDB", 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("goalTracking")) {
        const goalStore = db.createObjectStore("goalTracking", { keyPath: "id" });
        goalStore.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains("quizzes")) {
        db.createObjectStore("quizzes", { keyPath: "folderName" });
      }
      if (!db.objectStoreNames.contains("analytics")) {
        const analyticsStore = db.createObjectStore("analytics", {
          keyPath: "id",
          autoIncrement: true,
        });
        analyticsStore.createIndex("folderName", "folderName", { unique: false });
        analyticsStore.createIndex("date", "date", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };
  });
}
// Add these functions to script.js
async function saveQuizResult(resultData) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["analytics"], "readwrite");
    const store = transaction.objectStore("analytics");

    const record = {
      folderName: currentFolder,
      date: new Date().toISOString().split("T")[0],
      startIndex: parseInt(document.getElementById("startIndex").value),
      endIndex: parseInt(document.getElementById("endIndex").value),
      totalQuestions: resultData.totalQuestions,
      correctAnswers: resultData.correctAnswers,
      timeTaken: resultData.timeTaken,
      questionTimes: resultData.questionTimes,
      mode: quizMode,
      // Add this to track which specific questions were correct
      correctQuestionIds: resultData.correctQuestionIds || []
    };

    const request = store.add(record);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getQuizResults(folderName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["analytics"], "readonly");
    const store = transaction.objectStore("analytics");
    const index = store.index("folderName");
    const request = index.getAll(folderName);

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}
// Load quizzes from IndexedDB
async function loadQuizzes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["quizzes"], "readonly");
    const store = transaction.objectStore("quizzes");
    const request = store.getAll();

    request.onsuccess = (event) => {
      const data = event.target.result;
      quizzes = {};
      data.forEach((item) => {
        quizzes[item.folderName] = item.quizData;
      });
      resolve(quizzes);
    };

    request.onerror = (event) => {
      console.error("Error loading quizzes:", event.target.error);
      reject(event.target.error);
    };
  });
}

// Save quizzes to IndexedDB
async function saveQuizzes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["quizzes"], "readwrite");
    const store = transaction.objectStore("quizzes");

    // Clear existing data
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      // Save all folders
      const savePromises = Object.keys(quizzes).map((folderName) => {
        return new Promise((innerResolve, innerReject) => {
          const putRequest = store.put({
            folderName: folderName,
            quizData: quizzes[folderName],
          });

          putRequest.onsuccess = () => innerResolve();
          putRequest.onerror = (e) => innerReject(e.target.error);
        });
      });

      Promise.all(savePromises)
        .then(() => resolve())
        .catch((error) => reject(error));
    };

    clearRequest.onerror = (event) => {
      console.error("Error clearing quizzes:", event.target.error);
      reject(event.target.error);
    };
  });
}

// Load quizzes from IndexedDB on page load


// Toggle the mobile menu
function toggleMenu() {
  const menu = document.getElementById("mobile-menu");
  menu.classList.toggle("show");
}
function toggleTheme() {
    const body = document.body;
    body.classList.toggle("dark-theme");
    
    const isDark = body.classList.contains("dark-theme");
    localStorage.setItem("quizTheme", isDark ? "dark" : "light");
  }
// Create a new folder
async function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (folderName && !quizzes[folderName]) {
    quizzes[folderName] = [];
    quizzes[`${folderName}_Incorrect`] = []; // Create a folder for incorrect questions
    await saveQuizzes();
    updateFolderList();
  } else if (folderName) {
    alert("Folder already exists!");
  }
}

// Update the folder dropdown list
function updateFolderList() {
  const folderSelect = document.getElementById("folderSelect");
  folderSelect.innerHTML =
    '<option value="" disabled selected>Select a folder</option>';
  Object.keys(quizzes).forEach((folder) => {
    if (!folder.includes("_Incorrect")) {
      const option = document.createElement("option");
      option.value = folder;
      option.textContent = folder;
      folderSelect.appendChild(option);
    }
  });
  if (currentFolder) {
    folderSelect.value = currentFolder; // Retain selected folder
  }
}

// Handle folder selection
function selectFolder() {
  currentFolder = document.getElementById("folderSelect").value;
  trackFolderUsage(currentFolder); // Add this line
  currentFolder = document.getElementById("folderSelect").value;
  const quizOptions = document.getElementById("quizOptions");

  if (currentFolder) {
    quizOptions.classList.remove("hidden");
    let totalQuestions = quizzes[currentFolder]?.length || 0;
    document.getElementById("totalQuestions").textContent = totalQuestions;
    document.getElementById("startIndex").max = totalQuestions;
    document.getElementById("endIndex").max = totalQuestions;
    document.getElementById("endIndex").value = totalQuestions;
  } else {
    quizOptions.classList.add("hidden");
  }
}

// Handle file upload
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!currentFolder) {
    alert("Select a folder first!");
    return;
  }
  if (!file) {
    alert("No file selected!");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function () {
    try {
      const quizData = JSON.parse(reader.result);

      if (
        Array.isArray(quizData) &&
        quizData.every(
          (q) => "question" in q && "options" in q && "correctIndex" in q
        )
      ) {
        // Ensure all questions have an "explanation" key
        quizData.forEach((q) => {
          if (!("explanation" in q)) {
            q.explanation = ""; // Set to empty string if missing
          }
        });

        // Store in quizzes object and save to IndexedDB
        quizzes[currentFolder] = quizData;
        await saveQuizzes(); // Save updated data

        alert("Quiz uploaded and saved successfully!");
      } else {
        alert(
          "Invalid JSON format! Ensure each question has 'question', 'options', and 'correctIndex'."
        );
      }
    } catch (e) {
      alert("Error parsing JSON file. Please ensure the file is valid.");
    }
  };
  reader.readAsText(file);
}

// Clear all quizzes from IndexedDB
async function clearMemory() {
  if (confirm("Are you sure you want to clear all stored quizzes?")) {
    try {
      const transaction = db.transaction(["quizzes"], "readwrite");
      const store = transaction.objectStore("quizzes");
      const request = store.clear();

      request.onsuccess = () => {
        quizzes = {};
        updateFolderList();
        alert("All quizzes cleared!");
      };

      request.onerror = (event) => {
        console.error("Error clearing quizzes:", event.target.error);
        alert("Failed to clear quizzes. Please try again.");
      };
    } catch (error) {
      console.error("Error clearing memory:", error);
      alert("Failed to clear memory. Please try again.");
    }
  }
}

// Store incorrect questions in the _Incorrect folder
async function storeIncorrectQuestions() {
  if (incorrectQuestions.length > 0) {
    const incorrectFolder = `${currentFolder}_Incorrect`;

    // Initialize incorrect folder if it doesn't exist
    if (!quizzes[incorrectFolder]) {
      quizzes[incorrectFolder] = [];
    }

    incorrectQuestions.forEach((question) => {
      const existingQuestion = quizzes[incorrectFolder].find(
        (q) => q.question === question.question
      );
      if (existingQuestion) {
        existingQuestion.timesIncorrect =
          (existingQuestion.timesIncorrect || 0) + question.timesIncorrect;
      } else {
        quizzes[incorrectFolder].push(question);
      }
    });

    await saveQuizzes();
  }
}

// Download quiz data as a JSON file
function downloadData() {
  const blob = new Blob([JSON.stringify(quizzes, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "quiz_data.json";
  link.click();
}

// Restore quiz data from a JSON file
async function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      quizzes = JSON.parse(e.target.result);
      await saveQuizzes();
      updateFolderList();
      alert("Data restored successfully!");
    } catch (error) {
      console.error("Error restoring data:", error);
      alert("Error restoring data. Please ensure the file is valid.");
    }
  };
  reader.readAsText(file);
}

// Start the quiz

// Load the current question

async function selectAnswer(selectedIndex) {
  const endTime = Date.now();
  const timeTaken = (endTime - questionStartTime) / 1000;
  questionTimes.push(timeTaken);
  totalQuizTime += timeTaken;
  
  const question = currentQuiz[currentQuestionIndex];
  const isCorrect = selectedIndex === question.correctIndex;
  
  // Track recall accuracy
  if (recallMode) {
    let recallStatus = recallAttempts[currentQuestionIndex] || "🟡"; // Default to needed options
    
    // If marked "Remembered" but answered wrong, change to "Forgot"
    if (recallStatus === "🟢" && !isCorrect) {
      recallStatus = "🔴";
      recallAttempts[currentQuestionIndex] = "🔴"; // Update the recall attempt
    }
    
    // Update question with recall data
    question.recallData = question.recallData || {};
    question.recallData.lastAttempt = {
      status: recallStatus,
      correct: isCorrect,
      timestamp: new Date().toISOString()
    };
  }
  
  if (isCorrect) {
    score++;
    question.correctlyAnswered = true;
    
    // If recalled correctly without options (🟢), remove from HardRecall if present
    if (recallMode && recallAttempts[currentQuestionIndex] === "🟢") {
      removeFromHardRecall(question);
    }
  } else {
    question.timesIncorrect = (question.timesIncorrect || 0) + 1;
    question.selectedAnswer = question.options[selectedIndex];
    incorrectQuestions.push(question);
    
    // Always add to HardRecall if answered incorrectly
    addToHardRecall(question);
  }
  
  currentQuestionIndex++;
  if (currentQuestionIndex < currentQuiz.length) {
    loadQuestion();
  } else {
    // Check if we're in rapid round mode
    if (rapidRoundActive) {
      // Clear the quiz timer if it exists
      if (currentRapidTimer) {
        clearInterval(currentRapidTimer);
        currentRapidTimer = null;
      }
      // Remove the timer display if it exists
      const timerDisplay = document.getElementById('rapidTimerDisplay');
      if (timerDisplay) timerDisplay.remove();
      
      // Show results immediately
      await showRapidRoundResults();
    } else {
      await showResults();
    }
  }
  questionStartTime = Date.now();
}
function addToHardRecall(question) {
  const hardRecallFolder = `${currentFolder}_HardRecall`;
  
  if (!quizzes[hardRecallFolder]) {
    quizzes[hardRecallFolder] = [];
  }
  
  // Create a clean copy of the question without temporary properties
  const questionCopy = JSON.parse(JSON.stringify(question));
  delete questionCopy.recallData;
  delete questionCopy.correctlyAnswered;
  delete questionCopy.selectedAnswer;
  
  // Check if question already exists in HardRecall
  const exists = quizzes[hardRecallFolder].some(q => 
    q.question === questionCopy.question && 
    q.options.join('|') === questionCopy.options.join('|') &&
    q.correctIndex === questionCopy.correctIndex
  );
  
  if (!exists) {
    quizzes[hardRecallFolder].push(questionCopy);
    saveQuizzes();
  }
}
function removeFromHardRecall(question) {
  const hardRecallFolder = `${currentFolder}_HardRecall`;
  
  if (quizzes[hardRecallFolder]) {
    // Find and remove the question
    quizzes[hardRecallFolder] = quizzes[hardRecallFolder].filter(q => 
      !(q.question === question.question && 
        q.options.join('|') === question.options.join('|'))
    );
    
    saveQuizzes();
  }
}
// Fixed showResults function
async function showResults() {
  // Calculate average time threshold
  const avgTimeThreshold = totalQuizTime / currentQuiz.length;

  let timingHTML = `
      <h3>Time Statistics</h3>
      <p>Total Time: ${totalQuizTime.toFixed(1)} seconds</p>
      <p>Average Time: ${avgTimeThreshold.toFixed(1)} seconds per question</p>
      <div class="timing-stats">
          <h4>Time per Question:</h4>
          <ul>
  `;

  // Add timing for each question
  currentQuiz.forEach((question, index) => {
    const timeTaken = questionTimes[index] || 0;
    const isSlow = timeTaken > avgTimeThreshold * 1.5;
    timingHTML += `
          <li class="${isSlow ? "slow-time" : "fast-time"}">
              Q${index + 1}: ${timeTaken.toFixed(1)}s
              ${isSlow ? "⏱️" : "⚡"}
          </li>
      `;
  });

  timingHTML += `</ul></div>`;

  // Calculate recall statistics if in recall mode
  let recallHTML = "";
  if (recallMode) {
    const recallStats = {
      "🟢": 0,
      "🟡": 0,
      "🔴": 0
    };
    
    Object.values(recallAttempts).forEach(result => {
      recallStats[result]++;
    });
    
    const totalRecallAttempts = Object.values(recallStats).reduce((a, b) => a + b, 0);
    
    recallHTML = `
      <h3>Recall Performance</h3>
      <div class="recall-stats">
        <div class="recall-stat recall-success">
          <span class="recall-icon">🟢</span>
          <span class="recall-count">${recallStats["🟢"]}</span>
          <span class="recall-label">Remembered</span>
          <span class="recall-percent">${totalRecallAttempts > 0 ? Math.round((recallStats["🟢"] / totalRecallAttempts) * 100) : 0}%</span>
        </div>
        <div class="recall-stat recall-partial">
          <span class="recall-icon">🟡</span>
          <span class="recall-count">${recallStats["🟡"]}</span>
          <span class="recall-label">Needed Options</span>
          <span class="recall-percent">${totalRecallAttempts > 0 ? Math.round((recallStats["🟡"] / totalRecallAttempts) * 100) : 0}%</span>
        </div>
        <div class="recall-stat recall-fail">
          <span class="recall-icon">🔴</span>
          <span class="recall-count">${recallStats["🔴"]}</span>
          <span class="recall-label">Forgot</span>
          <span class="recall-percent">${totalRecallAttempts > 0 ? Math.round((recallStats["🔴"] / totalRecallAttempts) * 100) : 0}%</span>
        </div>
      </div>
    `;
    
    // Store questions that were hard to recall (🔴)
    // const hardRecallQuestions = currentQuiz.filter((_, index) => recallAttempts[index] === "🔴");
    // if (hardRecallQuestions.length > 0) {
    //   const hardRecallFolder = `${currentFolder}_HardRecall`;
    //   if (!quizzes[hardRecallFolder]) {
    //     quizzes[hardRecallFolder] = [];
    //   }
      
    //   hardRecallQuestions.forEach(question => {
    //     if (!quizzes[hardRecallFolder].some(q => q.question === question.question)) {
    //       quizzes[hardRecallFolder].push(question);
    //     }
    //   });
      
    //   await saveQuizzes();
    // }
  }

  // Create results HTML
  let resultsHTML = `
      <h2>Quiz Completed!</h2>
      <p>Your Score: ${score} / ${currentQuiz.length}</p>
      ${timingHTML}
      ${recallHTML}
      <h3>Incorrect Questions:</h3>
      <div id="incorrect-answers"></div>
      <button class="quiz-btn" onclick="restartQuiz()">Restart Quiz</button>
      <button class="quiz-btn" onclick="goHome()">Home</button>
      `;
    

  document.getElementById("quizContainer").innerHTML = resultsHTML;

  const incorrectContainer = document.getElementById("incorrect-answers");

  if (incorrectQuestions.length === 0) {
    incorrectContainer.innerHTML = "<p>Great job! No incorrect answers 🎉</p>";
  } else {
    incorrectQuestions.forEach((item) => {
      const div = document.createElement("div");
      div.classList.add("incorrect-item");
      div.innerHTML = `
              <p><strong>Question:</strong> ${item.question}</p>
              <p><span style="color: red;">❌ Your Answer:</span> ${
                item.selectedAnswer
              }</p>
              <p><span style="color: green;">✔ Correct Answer:</span> ${
                item.options[item.correctIndex]
              }</p>
              <p><strong>Explanation:</strong> ${formatExplanation(item.explanation)}</p>
              <hr>
          `;
      incorrectContainer.appendChild(div);
    });
  }

  if (incorrectQuestions.length > 0 && quizMode === "complete") {
    await storeIncorrectQuestions();
  }
  await saveQuizResult({
    totalQuestions: currentQuiz.length,
    correctAnswers: score,
    timeTaken: totalQuizTime,
    questionTimes: questionTimes,
  });
  const accuracy = (score / currentQuiz.length) * 100;
  
  if (accuracy >= 90) {
    triggerHighAccuracyCelebration();
  }
}
function triggerFlashcardMilestoneCelebration(milestone) {
  try {
    if (!milestone) return;
    
    // Gentle confetti for milestones
    if (milestone.confetti) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4a6fa5', '#2ecc71', '#3498db', '#f1c40f'],
        scalar: 0.8
      });
    }

    // ... rest of the function ...
  } catch (e) {
    console.error("Error in milestone celebration:", e);
  }
}


function playCelebrationSound() {
  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3');
  audio.volume = 0.3;
  audio.play().catch(e => console.log("Audio play failed:", e));
}



// Restart the quiz
function restartQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  document.getElementById("quizContainer").innerHTML = `
    <h2 id="question-text">Question will appear here</h2>
    <div id="options"></div>
  `;
  startQuiz(quizMode);
}
function handleVisibilityChange() {
  if (document.hidden) {
    stopFlashcardTimer();
  } else {
    startFlashcardTimer();
  }
}
let encouragementInterval;

// Show flashcards
function showFlashcards() {
  if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
    alert("Please select a folder with questions first!");
    return;
  }

  // Clear any existing quiz state
  if (quizTimer) {
    clearInterval(quizTimer);
    quizTimer = null;
  }

  // Hide quiz elements
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("quizOptions").classList.add("hidden");

  // Clear and show the flashcard container
  const flashcardContainer = document.getElementById("flashcardContainer");
  flashcardContainer.innerHTML = "";
  flashcardContainer.classList.remove("hidden");

  // Initialize timer
  if (!flashcardTimeStats[currentFolder]) {
    flashcardTimeStats[currentFolder] = { totalTime: 0, achievements: [] };
  }
  
  startFlashcardTimer();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Rest of your existing flashcard creation code...
  const questions = quizzes[currentFolder];
  
   questions.forEach((question, index) => {
    const flashcard = document.createElement("div");
    flashcard.className = "flashcard";
    flashcard.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flashcard-content">
            <div class="flashcard-header">
              <h3>Question ${index + 1}</h3>
              <button class="edit-question-btn" data-index="${index}">✏️</button>
            </div>
            <p>${question.question}</p>
            <p><strong>Options:</strong></p>
            <ul>
              ${question.options.map((option, i) => `<li>${option}</li>`).join("")}
            </ul>
            <p><strong>Times Incorrect:</strong> ${question.timesIncorrect || 0}</p>
          </div>
        </div>
        <div class="flashcard-back">
          <div class="flashcard-content">
            <h3>Answer</h3>
            <p><strong>Correct Answer:</strong> ${question.options[question.correctIndex]}</p>
<p><strong>Explanation:</strong> ${formatExplanation(question.explanation)}</p>
            <p><strong>Times Incorrect:</strong> ${question.timesIncorrect || 0}</p>
          </div>
        </div>
      </div>
    `;


    flashcard.addEventListener("click", () => {
      flashcard.classList.toggle("flipped");
    });

    if (question.timesIncorrect > 0) {
      const incorrectText = flashcard.querySelector(".flashcard-content p:last-child");
      incorrectText.classList.add("incorrect-attempt");
    }
const editBtn = flashcard.querySelector('.edit-question-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent flip when clicking edit
      showEditQuestionForm(index, question);
    });
    flashcardContainer.appendChild(flashcard);
  });
  encouragementInterval = setInterval(() => {
    if (Math.random() > 0.3) { // 30% chance to show
      showRandomEncouragement();
    }
  }, 140000); // Every 30 seconds
  startFlashcardStudySession(currentFolder);

}





function showEditQuestionForm(index, question) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'edit-question-modal';
  
  // Create form with current values
  modal.innerHTML = `
    <div class="edit-question-form">
      <h3>Edit Question</h3>
      <form id="editQuestionForm">
        <label>
          Question Text:
          <textarea name="question" required>${question.question}</textarea>
        </label>
        
        <div class="options-container">
          <label>Options:</label>
          ${question.options.map((option, i) => `
            <div class="option-row">
              <input type="text" name="option${i}" value="${option}" required>
              <input type="radio" name="correctIndex" value="${i}" ${i === question.correctIndex ? 'checked' : ''}>
              <span>Correct</span>
            </div>
          `).join('')}
        </div>
        
        <label>
          Explanation:
          <textarea name="explanation">${question.explanation || ''}</textarea>
        </label>
        
        <div class="form-buttons">
          <button type="submit" class="quiz-btn">Save</button>
          <button type="button" class="quiz-btn cancel-btn">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle form submission
  const form = modal.querySelector('#editQuestionForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form values
    const formData = new FormData(form);
    const updatedQuestion = {
      question: formData.get('question'),
      options: [],
      correctIndex: parseInt(formData.get('correctIndex')),
      explanation: formData.get('explanation') || '',
      timesIncorrect: question.timesIncorrect || 0
    };
    
    // Get all options
    for (let i = 0; i < question.options.length; i++) {
      updatedQuestion.options.push(formData.get(`option${i}`));
    }
    
    // Update in memory
    quizzes[currentFolder][index] = updatedQuestion;
    
    // Save to IndexedDB
    saveQuizzes().then(() => {
      // Refresh flashcards
      showFlashcards();
      // Close modal
      modal.remove();
    });
  });
  
  // Handle cancel
  modal.querySelector('.cancel-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}
// Enhanced encouragement system with improved timing and context awareness
let lastEncouragementTime = 0;
let lastBreakReminder = 0;
let encouragementLevel = 0;
let encouragementHistory = [];
const MAX_HISTORY = 20; // Keep last 20 messages to avoid repetition

function showContextualEncouragement() {
  if (!currentFolder || !flashcardStartTime) return;
  
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const folderStudyTime = flashcardDailyStudyTime[today]?.[currentFolder] || 0;
  const elapsedMinutes = Math.floor(folderStudyTime / 60);
  const accuracy = calculateCurrentAccuracy();
  
  // Don't show too frequently (minimum 90 seconds between messages)
  if (now - lastEncouragementTime < 90000 && Math.random() > 0.2) return;
  
  lastEncouragementTime = now;
  encouragementLevel = Math.min(encouragementLevel + 1, 10); // Track session intensity

  // Determine message category based on multiple factors
  let category = 'default';
  const currentThreshold = getCurrentThreshold(folderStudyTime);
  const isDifficult = incorrectQuestions.length > currentQuiz.length * 0.3;
  const needsBreak = now - lastBreakReminder > 1800000; // 30 minutes
  const isHighAccuracy = accuracy > 85;
  const isLowAccuracy = accuracy < 60;

  if (needsBreak) {
    category = 'break';
    lastBreakReminder = now;
  } 
  else if (isDifficult) {
    category = 'challenge';
  } 
  else if (isHighAccuracy) {
    category = 'highAccuracy';
  }
  else if (isLowAccuracy) {
    category = 'lowAccuracy';
  }
  else if (currentThreshold) {
    category = currentThreshold.type;
  }

  // Get appropriate message
  const msg = selectMessage(category, {
    studyTime: folderStudyTime,
    questionCount: currentQuestionIndex + 1,
    difficulty: incorrectQuestions.length,
    level: encouragementLevel,
    accuracy: accuracy,
    folderName: currentFolder
  });

  // Display the notification
  displayEncouragement(msg, category);
  
  // Track message history to avoid repeats
  encouragementHistory.push(msg.text);
  if (encouragementHistory.length > MAX_HISTORY) {
    encouragementHistory.shift();
  }
}

function calculateCurrentAccuracy() {
  if (currentQuestionIndex === 0) return 0;
  return Math.round((score / currentQuestionIndex) * 100);
}

// Enhanced threshold detection with more granular levels
function getCurrentThreshold(studyTime) {
  const thresholds = [
    { time: 300,   type: 'general' },    // 5 minutes
    { time: 900,   type: 'progress' },   // 15 minutes
    { time: 1800,  type: 'milestone' },  // 30 minutes
    { time: 2700,  type: 'achievement' }, // 45 minutes
    { time: 3600,  type: 'victory' },    // 1 hour
    { time: 5400,  type: 'extended' },   // 1.5 hours
    { time: 7200,  type: 'marathon' },   // 2 hours
    { time: 10800, type: 'legendary' }   // 3 hours
  ];
  
  return thresholds.slice().reverse().find(t => studyTime >= t.time);
}

// Enhanced message selection with more context awareness
function selectMessage(category, context) {
  const { studyTime, questionCount, difficulty, level, accuracy, folderName } = context;
  const mins = Math.floor(studyTime / 60);
  const subject = detectSubject(folderName);
  
  // Base messages with enhanced variety
  let messages = {
    // Early Session (0-5 mins)
    general: [
      { text: "Great start! You've got this! 💪", emoji: "✨", sound: "start", intensity: 1 },
      { text: "Learning mode activated! 🧠", emoji: "⚡", sound: "powerup", intensity: 2 },
      { text: "SSC success starts now! 🎯", emoji: "📌", sound: "begin", intensity: 3 },
      { text: "First card mastered - many to go! 📇", emoji: "🔄", sound: "flip", intensity: 2 },
      { text: "Brain cells firing up! 🔥", emoji: "🧪", sound: "spark", intensity: 3 },
      { text: "Let's make today count! 🗓️", emoji: "✏️", sound: "write", intensity: 1 },
      { text: "Knowledge is power - charging up! 🔋", emoji: "⚡", sound: "charge", intensity: 2 },
      { text: "Another step toward your goal! 👣", emoji: "🏁", sound: "step", intensity: 1 }
    ],
  
    // Progress Tracking (5-30 mins)
    progress: [
      { text: `You've reviewed ${questionCount} cards! 📚`, emoji: "📊", sound: "progress", intensity: 2 },
      { text: `${mins} minutes of quality study! ⏳`, emoji: "🔄", sound: "time", intensity: 1 },
      { text: `Accuracy: ${accuracy}% - solid work! 🎯`, emoji: "✅", sound: "hit", intensity: 3 },
      { text: "Neural pathways strengthening! 🛣️", emoji: "🧠", sound: "build", intensity: 2 },
      { text: "Retention rate climbing! 📈", emoji: "🔼", sound: "rising", intensity: 3 },
      { text: "Memory muscles getting stronger! 💪", emoji: "🏋️", sound: "gains", intensity: 2 },
      { text: "You're in the top 20% of studiers! 🔝", emoji: "🎖️", sound: "medal", intensity: 3 },
      { text: "Consistency beats intensity! 🐢", emoji: "🏁", sound: "slow", intensity: 1 }
    ],
  
    // Milestones (30+ mins)
    milestone: [
      { text: `30 minutes! You're crushing it! 🏋️`, emoji: "🔥", sound: "achievement", intensity: 3 },
      { text: "Half-hour of brain gains! 🧠", emoji: "💪", sound: "strong", intensity: 2 },
      { text: "Study stamina increasing! 🏃‍♂️", emoji: "📈", sound: "levelup", intensity: 3 },
      { text: "The compound effect is working! 💹", emoji: "📊", sound: "growth", intensity: 2 },
      { text: "Now we're cooking with knowledge! 🧑‍🍳", emoji: "🍳", sound: "sizzle", intensity: 1 },
      { text: "Serious learner status achieved! 🎓", emoji: "👨‍🎓", sound: "graduate", intensity: 3 },
      { text: "This is where mastery begins! 🛣️", emoji: "🏁", sound: "journey", intensity: 2 }
    ],
  
    // Major Achievements (45+ mins)
    achievement: [
      { text: `45 minutes! Super impressive! 🦸`, emoji: "🌟", sound: "super", intensity: 3 },
      { text: "You're a study machine! 🤖", emoji: "⚙️", sound: "mechanical", intensity: 3 },
      { text: "Triple-quarter hour of power! ⏱️", emoji: "⚡", sound: "energy", intensity: 3 },
      { text: "Future SSC topper in the making! 🏆", emoji: "👑", sound: "royal", intensity: 3 },
      { text: "Knowledge warrior! ⚔️", emoji: "🛡️", sound: "battle", intensity: 3 },
      { text: "This discipline will pay off! 💰", emoji: "🏦", sound: "coins", intensity: 2 }
    ],
  
    // Victory (60+ mins)
    victory: [
      { text: `HOUR OF POWER! 🎯 (${mins} minutes)`, emoji: "🚀", sound: "fanfare", intensity: 3 },
      { text: "Study champion! 🏆", emoji: "👑", sound: "triumph", intensity: 3 },
      { text: "60 minutes of focused learning! 💎", emoji: "⏳", sound: "diamond", intensity: 3 },
      { text: "Elite study session complete! 🥇", emoji: "🎖️", sound: "gold", intensity: 3 },
      { text: "You're in the top 10% now! 🔟", emoji: "💯", sound: "perfect", intensity: 3 },
      { text: "This is how SSC dreams come true! ✨", emoji: "🌠", sound: "magic", intensity: 3 }
    ],
  
    // Challenging Material
    challenge: [
      { text: `Tough questions = Stronger learning! 💪`, emoji: "🧗", sound: "climb", intensity: 2 },
      { text: `Mastering ${difficulty} difficult cards! 🎯`, emoji: "🎯", sound: "target", intensity: 3 },
      { text: "The struggle is where growth happens! 🌱", emoji: "🪴", sound: "grow", intensity: 2 },
      { text: "This challenge will make you smarter! 🧠+", emoji: "📈", sound: "progress", intensity: 3 },
      { text: "Embrace the difficulty! 💎", emoji: "⛏️", sound: "mine", intensity: 3 },
      { text: "You'll remember these the longest! 🏗️", emoji: "🧱", sound: "build", intensity: 2 }
    ],
  
    // Break Reminders
    break: [
      { text: "Microbreak time! Stretch! 🤸", emoji: "⏸️", sound: "pause", intensity: 1 },
      { text: "Quick posture check! 🧘", emoji: "🪑", sound: "adjust", intensity: 1 },
      { text: "20-20-20 rule: Look 20ft away 👁️", emoji: "🏙️", sound: "focus", intensity: 1 },
      { text: "Hydrate for better focus! 💧", emoji: "🚰", sound: "water", intensity: 1 },
      { text: "Deep breaths boost oxygen! 🌬️", emoji: "🌿", sound: "breathe", intensity: 1 },
      { text: "Quick walk = Better retention! 🚶‍♂️", emoji: "👟", sound: "walk", intensity: 1 }
    ],
  
    // Default Messages
    default: [
      { text: "Keep flipping! Each card matters! 🔄", emoji: "👏", sound: "flip", intensity: 1 },
      { text: "Your brain loves this workout! 🏋️‍♂️", emoji: "🧠", sound: "gains", intensity: 2 },
      { text: "Active recall in progress... ⚙️", emoji: "🔧", sound: "gear", intensity: 2 },
      { text: "Spaced repetition working! ✨", emoji: "⏱️", sound: "magic", intensity: 1 },
      { text: "Neuroplasticity activated! 🧫", emoji: "🔬", sound: "science", intensity: 2 }
    ],
  
    // SSC CGL Subject-Specific
    subject: {
      math: [
        { text: "Quantitative ninja in training! 🥷", emoji: "➗", sound: "sword", intensity: 3 },
        { text: "Math shortcuts saving time! ⏱️", emoji: "✖️", sound: "speed", intensity: 3 },
        { text: "Algebra/Geometry mastered! 📐", emoji: "📏", sound: "measure", intensity: 2 }
      ],
      english: [
        { text: "Vocabulary vault expanding! 📚", emoji: "🔠", sound: "page", intensity: 2 },
        { text: "Grammar guru status! 📝", emoji: "✔️", sound: "correct", intensity: 3 },
        { text: "Idioms conquered! 💬", emoji: "🗣️", sound: "talk", intensity: 2 }
      ],
      reasoning: [
        { text: "Logical circuits firing! 🧩", emoji: "🤔", sound: "think", intensity: 3 },
        { text: "Puzzles solved with ease! 🎲", emoji: "🔍", sound: "eureka", intensity: 3 }
      ],
      gk: [
        { text: "Static GK no match for you! 🛡️", emoji: "⚔️", sound: "battle", intensity: 2 },
        { text: "Current affairs updated! 📰", emoji: "🗞️", sound: "news", intensity: 2 }
      ]
    },
  
    // Productivity Tips (shown periodically)
    productivity: [
      { text: "Tip: Pomodoro technique boosts focus! 🍅", emoji: "⏲️", sound: "timer", intensity: 1 },
      { text: "Fact: Handwritten notes improve recall by 40% ✍️", emoji: "📝", sound: "write", intensity: 2 },
      { text: "SSC Hack: Master 5 formulas daily 📚", emoji: "🔢", sound: "math", intensity: 3 },
      { text: "Study smarter: Teach what you learn 👨‍🏫", emoji: "📢", sound: "teach", intensity: 2 }
    ],
  
    // Fun Facts (SSC/Study Related)
   
  
    // Intensity-Based Messages
    intensity: {
      low: [
        { text: "Small steps still move you forward 🐢", emoji: "🌱", sound: "grow", intensity: 1 },
        { text: "Progress is progress, no matter how small 👣", emoji: "🔄", sound: "step", intensity: 1 }
      ],
      high: [
        { text: "UNSTOPPABLE LEARNING MACHINE! 🤖", emoji: "⚡", sound: "laser", intensity: 3 },
        { text: "NOTHING can stop you today! 🚧", emoji: "🔥", sound: "explosion", intensity: 3 }
      ]
    },
  
    // New categories
    highAccuracy: [
      { text: `Accuracy ${accuracy}%! You're crushing it! 🎯`, emoji: "🏅", sound: "perfect", intensity: 3 },
      { text: "Nearly perfect! Your focus is paying off! 💎", emoji: "🔮", sound: "sparkle", intensity: 2 },
      { text: "Mastery in progress! Keep this streak going! 🔥", emoji: "🚀", sound: "rocket", intensity: 3 }
    ],
    
    lowAccuracy: [
      { text: "Mistakes are learning opportunities! 🌱", emoji: "🔄", sound: "retry", intensity: 1 },
      { text: "Each error makes you stronger! 💪", emoji: "📈", sound: "progress", intensity: 2 },
      { text: "Focus on understanding - speed will come! 🐢", emoji: "🏁", sound: "slow", intensity: 1 }
    ],
    
    extended: [
      { text: "90 minutes of intense focus! You're unstoppable! 🦾", emoji: "⏱️", sound: "time", intensity: 3 },
      { text: "1.5 hours deep - your dedication is inspiring! 🌟", emoji: "💎", sound: "diamond", intensity: 3 }
    ],
    
    marathon: [
      { text: "2 HOUR STUDY MARATHON! 🏃‍♂️", emoji: "🎽", sound: "fanfare", intensity: 3 },
      { text: "Elite learning session! Your brain is thriving! 🧠", emoji: "⚡", sound: "power", intensity: 3 }
    ],
    
    legendary: [
      { text: "LEGENDARY 3 HOUR SESSION! ⚡", emoji: "🏆", sound: "triumph", intensity: 3 },
      { text: "You're in the top 1% of studiers now! 💎", emoji: "👑", sound: "royal", intensity: 3 }
    ],
    
    // Enhanced subject-specific messages
    subject: {
      math: [
        { text: "Quantitative skills sharpening! ➗", emoji: "✖️", sound: "calculate", intensity: 2 },
        { text: "Math patterns becoming clear! 🔢", emoji: "🧮", sound: "numbers", intensity: 2 },
        { text: "SSC math shortcuts mastered! ⚡", emoji: "🏃‍♂️", sound: "speed", intensity: 3 }
      ],
      english: [
        { text: "Vocabulary expanding rapidly! 📖", emoji: "🔤", sound: "words", intensity: 2 },
        { text: "Grammar rules clicking into place! 📝", emoji: "✔️", sound: "correct", intensity: 2 },
        { text: "Idiom mastery achieved! 💬", emoji: "🗣️", sound: "talk", intensity: 3 }
      ],
      reasoning: [
        { text: "Logical thinking at its peak! 🧩", emoji: "🤔", sound: "think", intensity: 3 },
        { text: "Puzzles solved with precision! 🎯", emoji: "🔍", sound: "eureka", intensity: 3 }
      ],
      gk: [
        { text: "General knowledge expanding! 🌎", emoji: "🧠", sound: "knowledge", intensity: 2 },
        { text: "Current affairs mastered! 📰", emoji: "🗞️", sound: "news", intensity: 2 }
      ],
      science: [
        { text: "Scientific concepts crystallizing! 🔬", emoji: "🧪", sound: "science", intensity: 2 },
        { text: "Biology/Physics/Chemistry mastered! ⚛️", emoji: "🌡️", sound: "experiment", intensity: 3 }
      ],
      history: [
        { text: "Historical timelines memorized! ⏳", emoji: "🏛️", sound: "history", intensity: 2 },
        { text: "Ancient/Medieval/Modern mastered! 📜", emoji: "🖋️", sound: "document", intensity: 3 }
      ],
      polity: [
        { text: "Constitutional knowledge solidifying! ⚖️", emoji: "📜", sound: "law", intensity: 2 },
        { text: "Government structures understood! 🏛️", emoji: "🏢", sound: "government", intensity: 3 }
      ]
    }
  };

  // Get base messages for category
  let availableMessages = [...messages[category] || [], ...messages['default']];
  
  // Add subject-specific messages if detected
  if (subject && messages.subject?.[subject]) {
    availableMessages = availableMessages.concat(messages.subject[subject]);
  }
  
  // Filter out recently shown messages
  const freshMessages = availableMessages.filter(msg => 
    !encouragementHistory.includes(msg.text)
  );
  
  // Fall back to all messages if we've shown them all recently
  const messagePool = freshMessages.length > 0 ? freshMessages : availableMessages;
  
  // Add level-based messages for high intensity sessions
  if (level > 7) {
    messagePool.push(
      { text: "Incredible focus! Keep riding this wave! 🌊", emoji: "🤯", sound: "amazing", intensity: 3 },
      { text: "Next-level studying! You're on fire! 🔥", emoji: "🚒", sound: "fire", intensity: 3 }
    );
  }
  
  // Weight messages by intensity (higher intensity more likely when level is high)
  const weightedMessages = [];
  messagePool.forEach(msg => {
    const weight = msg.intensity <= level ? (msg.intensity * 2) : 1;
    for (let i = 0; i < weight; i++) {
      weightedMessages.push(msg);
    }
  });
  
  // Select random message from weighted pool
  return weightedMessages[Math.floor(Math.random() * weightedMessages.length)];
}

// Enhanced display with animations and tracking
function displayEncouragement(msg, category) {
  // Create notification element
  const bubble = document.createElement('div');
  bubble.className = `encouragement-bubble ${category} intensity-${msg.intensity}`;
  
  // Add study time for relevant categories
  const showStudyTime = ['progress', 'milestone', 'achievement', 'victory', 'extended', 'marathon', 'legendary'].includes(category);
  const today = new Date().toISOString().split('T')[0];
  const studyTime = flashcardDailyStudyTime[today]?.[currentFolder] || 0;
  
  bubble.innerHTML = `
    <div class="encouragement-content">
      <span class="encouragement-emoji">${msg.emoji}</span>
      <div class="encouragement-text-container">
        <span class="encouragement-text">${msg.text}</span>
        ${showStudyTime ? `<div class="study-time">${formatStudyTime(studyTime)}</div>` : ''}
      </div>
    </div>
  `;

  // Position randomly but within viewport
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const left = Math.max(10, Math.min(vw - 300, Math.random() * (vw - 300)));
  const top = Math.max(10, Math.min(vh - 100, Math.random() * (vh - 100)));
  
  bubble.style.position = 'fixed';
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  
  document.body.appendChild(bubble);
  playEncouragementSound(msg.sound);

  // Animate entrance with type-specific effects
  const entranceAnim = bubble.animate([
    { transform: 'translateY(20px) scale(0.95)', opacity: 0 },
    { transform: 'translateY(0) scale(1)', opacity: 1 }
  ], { 
    duration: 500, 
    easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' 
  });

  // Add special effects for high-intensity messages
  if (msg.intensity >= 3) {
    const sparkles = document.createElement('div');
    sparkles.className = 'sparkle-effect';
    bubble.appendChild(sparkles);
    
    setTimeout(() => {
      sparkles.remove();
    }, 1000);
  }

  // Auto-remove after delay with fade out
  setTimeout(() => {
    bubble.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-10px) scale(0.98)' }
    ], { 
      duration: 500,
      easing: 'ease-out'
    }).onfinish = () => bubble.remove();
  }, msg.intensity >= 3 ? 6000 : 4500); // Longer display for important messages
}

// Enhanced subject detection for SSC CGL
function detectSubject(folderName) {
  if (!folderName) return null;
  const lowerName = folderName.toLowerCase();
  
  const subjectMap = {
    math: ['math', 'quant', 'arithmetic', 'algebra', 'geometry', 'trigonometry', 'calculation'],
    english: ['english', 'grammar', 'vocab', 'vocabulary', 'comprehension', 'idiom', 'phrase'],
    reasoning: ['reasoning', 'logic', 'puzzle', 'analogy', 'deduction'],
    gk: ['gk', 'general knowledge', 'general studies', 'static', 'current affairs'],
    science: ['science', 'physics', 'phy', 'chemistry', 'chem', 'biology', 'bio'],
    history: ['history', 'modern', 'medieval', 'ancient', 'historical'],
    polity: ['polity', 'constitution', 'governance', 'parliament', 'political']
  };

  for (const [subject, keywords] of Object.entries(subjectMap)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return subject;
    }
  }
  
  return null;
}

// Helper function to format study time
function formatStudyTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

// Enhanced sound system with fallbacks
function playEncouragementSound(type) {
  const sounds = {
    start: 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
    powerup: 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
    progress: 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3',
    perfect: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
    // ... other sounds ...
    fallback: 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'
  };

  try {
    const audio = new Audio(sounds[type] || sounds.fallback);
    audio.volume = Math.min(0.3 + (encouragementLevel * 0.02), 0.6); // Volume scales with intensity
    audio.play().catch(e => console.log("Audio play failed:", e));
  } catch (e) {
    console.log("Sound error:", e);
  }
}


// Helper function to format study time

// Helper function to format time
function formatStudyTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

// Sound player (same as previous implementation)
function playEncouragementSound(type) {
  const sounds = {
    start: 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
    powerup: 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
    progress: 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3',
    coins: 'https://assets.mixkit.co/sfx/preview/mixkit-coins-handling-1939.mp3',
    achievement: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    applause: 'https://assets.mixkit.co/sfx/preview/mixkit-audience-clapping-strongly-476.mp3',
    fanfare: 'https://assets.mixkit.co/sfx/preview/mixkit-victory-fanfare-2013.mp3',
    triumph: 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-completed-2068.mp3',
    click: 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
    ding: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'
  };

  if (sounds[type]) {
    const audio = new Audio(sounds[type]);
    audio.volume = 0.3;
    audio.play().catch(e => console.log("Audio play failed:", e));
  }
}

// Modify your updateFlashcardTime to trigger encouragement





















// Function to clear memory (reset timesIncorrect to 0 for all questions)
async function clearMemory() {
  if (
    confirm(
      "Are you sure you want to clear all memory? This will reset all 'timesIncorrect' to 0."
    )
  ) {
    try {
      // Loop through all folders
      Object.keys(quizzes).forEach((folder) => {
        // Check if the folder is not an "_Incorrect" folder
        if (!folder.includes("_Incorrect")) {
          // Loop through all questions in the folder
          quizzes[folder].forEach((question) => {
            question.timesIncorrect = 0; // Reset timesIncorrect to 0
          });
        }
      });

      // Save the updated data to IndexedDB
      await saveQuizzes();

      // Notify the user
      alert(
        "Memory cleared! All 'timesIncorrect' values have been reset to 0."
      );

      // If flashcards are currently displayed, refresh them
      if (
        !document
          .getElementById("flashcardContainer")
          .classList.contains("hidden")
      ) {
        showFlashcards();
      }
    } catch (error) {
      console.error("Error clearing memory:", error);
      alert("Failed to clear memory. Please try again.");
    }
  }
}

// Add these variables to your global variables section
let quizTimer;
let timeLeft = 0;
let timerEnabled = false;

// Add this function to handle timer
function startTimer(minutes) {
  if (quizTimer) {
    clearInterval(quizTimer);
    quizTimer = null;
  }

  timeLeft = minutes * 60;
  updateTimerDisplay();

  quizTimer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(quizTimer);
      quizTimer = null;
      timeUp();
    }
  }, 1000);
}
function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = document.getElementById("time-display");

  timeDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  if (timeLeft <= 30) {
    // Warning when 30 seconds left
    timeDisplay.classList.add("warning");
  } else {
    timeDisplay.classList.remove("warning");
  }
}

function timeUp() {
  // Mark all remaining questions as incorrect
  while (currentQuestionIndex < currentQuiz.length) {
    const question = currentQuiz[currentQuestionIndex];
    question.timesIncorrect = (question.timesIncorrect || 0) + 1;
    question.selectedAnswer = "Time expired";
    incorrectQuestions.push(question);
    currentQuestionIndex++;
  }

  showResults();
}

// Modify your startQuiz function to include timer setup
// In startQuiz function - move questionStartTime before timer prompt
async function startQuiz(mode) {
  if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
    alert("Please select a valid folder with questions!");
    return;
  }

  // Reset time tracking
  questionTimes = [];
  totalQuizTime = 0;
  questionStartTime = Date.now();

  // Ask for recall mode preference
  recallMode = confirm("Do you want to test your recall before seeing options?\n\n" +
                      "🟢 = Remembered before options (will remove from HardRecall if correct)\n" +
                      "🟡 = Needed options to recall\n" +
                      "🔴 = Forgot\n\n" +
                      "Any wrong answer will add to HardRecall");
  
  if (recallMode) {
    recallAttempts = {};
  }



  // Ask for timer preference
  const useTimer = confirm("Would you like to enable a timer for this quiz?");
  if (useTimer) {
    const minutes = parseInt(prompt("Enter time limit in minutes:", "5"));
    if (!isNaN(minutes) && minutes > 0) {
      timerEnabled = true;
      startTimer(minutes);
    } else {
      timerEnabled = false;
    }
  } else {
    timerEnabled = false;
  }

  let totalQuestions = quizzes[currentFolder].length;
  let startIndex = parseInt(document.getElementById("startIndex").value) - 1;
  let endIndex = parseInt(document.getElementById("endIndex").value);

  // Validate range
  if (isNaN(startIndex)) startIndex = 0;
  if (isNaN(endIndex)) endIndex = totalQuestions;
  if (startIndex < 0) startIndex = 0;
  if (endIndex > totalQuestions) endIndex = totalQuestions;
  if (startIndex >= endIndex) {
    startIndex = 0;
    endIndex = totalQuestions;
  }

  // Reset quiz state
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];

  // Update progress display
  document.getElementById("current-question").textContent = "1";
  document.getElementById("total-questions").textContent = currentQuiz.length;

  quizMode = mode;

  if (mode === "difficult") {
    currentQuiz = quizzes[`${currentFolder}_Incorrect`] || [];
    if (currentQuiz.length === 0) {
      alert("No difficult questions stored yet. Try the complete quiz first.");
      return;
    }
  } else {
    currentQuiz = quizzes[currentFolder].slice(startIndex, endIndex);
  }

  document.getElementById("quizContainer").classList.remove("hidden");
  document.getElementById("quizOptions").classList.add("hidden");

  loadQuestion();
}
// Update loadQuestion to show progress
function loadQuestion() {
  if (currentQuestionIndex >= currentQuiz.length) {
    if (quizTimer) clearInterval(quizTimer);
    showResults();
    return;
  }

  // Update progress display
  document.getElementById("current-question").textContent = currentQuestionIndex + 1;
  document.getElementById("total-questions").textContent = currentQuiz.length;

  const questionData = currentQuiz[currentQuestionIndex];
  document.getElementById("question-text").textContent = questionData.question;
  
  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";

  // Add recall UI if in recall mode
  if (recallMode) {
    const recallContainer = document.createElement("div");
    recallContainer.className = "recall-container";
    
    recallContainer.innerHTML = `
      <div class="recall-prompt">
        <p>Try to recall the answer before seeing options:</p>
        <button class="recall-btn recall-success" onclick="handleRecallAttempt('🟢')">🟢 Remembered</button>
        <button class="recall-btn recall-partial" onclick="handleRecallAttempt('🟡')">🟡 Needed Options</button>
        <button class="recall-btn recall-fail" onclick="handleRecallAttempt('🔴')">🔴 Forgot</button>
      </div>
      <div id="options-container" class="hidden options"></div>
      <button id="show-options-btn" class="quiz-btn" onclick="showOptionsNow()">Show Options Now</button>
    `;
    
    optionsContainer.appendChild(recallContainer);
    
    // Create actual options in hidden container
    const optionsInnerContainer = document.getElementById("options-container");
    questionData.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.classList.add("option-btn");
      button.textContent = option;
      button.onclick = () => selectAnswer(index);
      optionsInnerContainer.appendChild(button);
    });
  } 
  else {
    // Normal mode - show options immediately
    questionData.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.classList.add("option-btn");
      button.textContent = option;
      button.onclick = () => selectAnswer(index);
      optionsContainer.appendChild(button);
    });
  }
}
function handleRecallAttempt(result) {
  recallAttempts[currentQuestionIndex] = result;
  showOptionsNow();
}

function showOptionsNow() {
  const optionsContainer = document.getElementById("options-container");
  const showBtn = document.getElementById("show-options-btn");
  
  if (optionsContainer) optionsContainer.classList.remove("hidden");
  if (showBtn) showBtn.classList.add("hidden");
  
  // If user hasn't made a recall attempt yet, default to "needed options"
  if (recallAttempts[currentQuestionIndex] === undefined) {
    recallAttempts[currentQuestionIndex] = "🟡";
  }
}

function showHardRecallQuestions() {
  if (!currentFolder) {
    alert("Please select a folder first!");
    return;
  }

  const hardRecallFolder = `${currentFolder}_HardRecall`;
  if (!quizzes[hardRecallFolder] || quizzes[hardRecallFolder].length === 0) {
    alert("No hard recall questions found!");
    return;
  }

  currentQuiz = quizzes[hardRecallFolder];
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  
  document.getElementById("quizContainer").classList.remove("hidden");
  document.getElementById("quizOptions").classList.add("hidden");
  
  loadQuestion();
}
function goHome() {
  if (rapidRoundActive) {
    cleanupRapidRound();
  }
  // Clear timer and reset states
  if (quizTimer) {
    clearInterval(quizTimer);
    quizTimer = null;
  }
  if (encouragementInterval) {
    clearInterval(encouragementInterval);
  }
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  quizMode = "";
  currentQuiz = [];
  timerEnabled = false;
  questionTimes = [];
  totalQuizTime = 0;

  // Reset timer display
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    timeDisplay.textContent = "00:00";
    timeDisplay.classList.remove('warning');
  }

  // Hide all specialized containers
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");
  document.getElementById("analysisContainer").classList.add("hidden");

  // Reset quiz container to its initial state
  document.getElementById("quizContainer").innerHTML = `
    <div id="quiz-progress">
      <span id="current-question">1</span> / <span id="total-questions">0</span>
    </div>
    <div id="quiz-timer">
      Time Left: <span id="time-display">00:00</span>
    </div>
    <h2 id="question-text">Question will appear here</h2>
    <div id="options"></div>
  `;

  // Clear flashcard container
  document.getElementById("flashcardContainer").innerHTML = "";

  // Clear any chart canvases (important to prevent memory leaks)
  const chartCanvases = document.querySelectorAll('.analysis-section canvas');
  chartCanvases.forEach(canvas => {
    const chart = Chart.getChart(canvas);
    if (chart) {
      chart.destroy();
    }
  });

  // Clear analysis container
  document.getElementById("progressStats").innerHTML = "";
  document.getElementById("goalProgress").innerHTML = "";
  document.getElementById("achievementsList").innerHTML = "";

  // Reset progress bar
  const progressBar = document.getElementById("progressBar");
  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.textContent = "";
  }

  // Show quiz options if a folder is selected
  if (currentFolder) {
    document.getElementById("quizOptions").classList.remove("hidden");
    document.getElementById("totalQuestions").textContent = quizzes[currentFolder].length;
    document.getElementById("endIndex").value = quizzes[currentFolder].length;
    document.getElementById("startIndex").value = 1;
  } else {
    document.getElementById("quizOptions").classList.add("hidden");
  }

  // Reset the main container to show the default view
  document.getElementById("quiz-title").textContent = "Select a Quiz";
  document.getElementById("quizRangeContainer").classList.remove("hidden");
  document.getElementById("showDifficultBtn").classList.remove("hidden");
  stopFlashcardTimer();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopFlashcardStudy();
  
  

}




function stopFlashcardStudy() {
  if (currentFolder) {
    endFlashcardStudySession(currentFolder);
  }
  // ... any existing stop code ...
}




function restartQuiz() {
  // Clear timer if active
  if (quizTimer) {
    clearInterval(quizTimer);
    quizTimer = null;
  }

  // Reset quiz state
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  questionTimes = [];
  totalQuizTime = 0;
  questionStartTime = Date.now();
  // Reset UI
  document.getElementById("quizContainer").innerHTML = `
      <div id="quiz-progress">
          <span id="current-question">1</span> / <span id="total-questions">${currentQuiz.length}</span>
      </div>
      <div id="quiz-timer">
          Time Left: <span id="time-display">00:00</span>
      </div>
      <h2 id="question-text">Question will appear here</h2>
      <div id="options"></div>
  `;

  // Restart with same settings
  loadQuestion();

  // Restart timer if it was enabled
  if (timerEnabled) {
    const minutes = Math.ceil(timeLeft / 60);
    startTimer(minutes);
  }
}

function showDifficultQuestions() {
  if (!currentFolder) {
    alert("Please select a folder first!");
    return;
  }

  // Save the complete home state before showing difficult questions
  const container = document.querySelector(".container");
  const quizOptions = document.getElementById("quizOptions");

  // Store both the container HTML and quiz options visibility state
  container.dataset.originalHtml = container.innerHTML;
  container.dataset.quizOptionsVisible =
    !quizOptions.classList.contains("hidden");

  const incorrectFolder = `${currentFolder}_Incorrect`;
  if (!quizzes[incorrectFolder] || quizzes[incorrectFolder].length === 0) {
    alert("No difficult questions found!");
    return;
  }

  // Sort and display difficult questions
  const difficultQuestions = [...quizzes[incorrectFolder]].sort((a, b) => {
    return (b.timesIncorrect || 0) - (a.timesIncorrect || 0);
  });

  let html = `<h2>Difficult Questions (${difficultQuestions.length})</h2>`;

  difficultQuestions.forEach((question, index) => {
    html += `
      <div class="difficult-question">
          <p><strong>Question ${index + 1}:</strong> ${question.question}</p>
          <p><strong>Times Incorrect:</strong> ${
            question.timesIncorrect || 0
          }</p>
          <p><strong>Last Selected Answer:</strong> ${
            question.selectedAnswer || "N/A"
          }</p>
          <p><strong>Correct Answer:</strong> ${
            question.options[question.correctIndex]
          }</p>
          <p><strong>Explanation:</strong> ${
            question.explanation || "No explanation provided."
          }</p>
      </div>
      <hr>
      `;
  });

  // Add back button
  html += `<button class="quiz-btn" onclick="restoreHomeView()">Back to Quiz</button>`;
  container.innerHTML = html;
}

// New function to restore the original home view
function restoreHomeView() {
  const container = document.querySelector(".container");
  if (container.dataset.originalHtml) {
    container.innerHTML = container.dataset.originalHtml;
  } else {
    goHome(); // Fallback
  }
}

// Add these functions to script.js
async function showAnalysis() {
  if (!currentFolder) {
    alert("Please select a folder first!");
    return;
  }

  // Hide other containers
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");

  // Show analysis container
  const analysisContainer = document.getElementById("analysisContainer");
  analysisContainer.classList.remove("hidden");

  // Update folder selector in analysis
  const analysisFolderSelect = document.getElementById("analysisFolderSelect");
  analysisFolderSelect.innerHTML = '<option value="all">All Folders</option>';

  Object.keys(quizzes).forEach((folder) => {
    if (!folder.includes("_Incorrect")) {
      const option = document.createElement("option");
      option.value = folder;
      option.textContent = folder;
      if (folder === currentFolder) option.selected = true;
      analysisFolderSelect.appendChild(option);
    }
  });

  // Load and display analysis data
  await updateAnalysisForFolder();
}

async function updateAnalysisForFolder() {
  const folderSelect = document.getElementById("analysisFolderSelect");
  const selectedFolder = folderSelect.value;

  let results;
  if (selectedFolder === "all") {
    // Get results for all folders
    const allResults = await Promise.all(
      Object.keys(quizzes)
        .filter((f) => !f.includes("_Incorrect"))
        .map((f) => getQuizResults(f))
    );
    results = allResults.flat();
  } else {
    results = await getQuizResults(selectedFolder);
  }

  if (!results || results.length === 0) {
    document.getElementById("progressStats").innerHTML =
      "<p>No quiz data available yet.</p>";
    return;
  }

  // Calculate statistics
  const totalQuizzes = results.length;
  const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
  const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
  const accuracy =
    totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;

  // Calculate streak
  const streaks = calculateStreaks(results);

  // Display basic stats
  document.getElementById("progressStats").innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Quizzes Taken</span>
        <span class="stat-value">${totalQuizzes}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Questions Answered</span>
        <span class="stat-value">${totalQuestions}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Overall Accuracy</span>
        <span class="stat-value">${accuracy}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Current Streak</span>
        <span class="stat-value">${streaks.current} days</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Longest Streak</span>
        <span class="stat-value">${streaks.longest} days</span>
      </div>
    `;

  // Update progress bar
  const progressBar = document.getElementById("progressBar");
  const progressPercentage = Math.min(
    100,
    (totalCorrect / totalQuestions) * 100
  );
  progressBar.style.width = `${progressPercentage}%`;
  progressBar.textContent = `${progressPercentage.toFixed(1)}%`;

  // Render charts
  renderPerformanceChart(results);
  renderDifficultyChart(results);
  renderHistoricalProgressChart(results);

  // Update achievements
  updateAchievementsDisplay(results);
  await updateGoalProgress();

}






// Add this function to script.js
function showAchievementNotification(title, message, icon) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-notification-content">
        <div class="achievement-icon">${icon}</div>
        <div>
          <h3>${title}</h3>
          <p>${message}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }














function calculateStreaks(results) {
  if (!results || results.length === 0) return { current: 0, longest: 0 };

  // Sort results by date (oldest first)
  const sortedResults = [...results].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let prevDate = null;

  // We'll consider a streak if quizzes are taken on consecutive days
  sortedResults.forEach((result) => {
    const currentDate = new Date(result.date);

    if (prevDate) {
      const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentStreak++;
      } else if (dayDiff > 1) {
        currentStreak = 1; // reset streak
      }
    } else {
      currentStreak = 1;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
    prevDate = currentDate;
  });

  return { current: currentStreak, longest: longestStreak };
}

function renderPerformanceChart(results) {
  const ctx = document.getElementById("performanceChart").getContext("2d");

  // Group results by date and calculate daily accuracy
  const dailyResults = {};
  results.forEach((result) => {
    if (!dailyResults[result.date]) {
      dailyResults[result.date] = { correct: 0, total: 0 };
    }
    dailyResults[result.date].correct += result.correctAnswers;
    dailyResults[result.date].total += result.totalQuestions;
  });

  const dates = Object.keys(dailyResults).sort();
  const accuracyData = dates.map((date) => {
    const day = dailyResults[date];
    return ((day.correct / day.total) * 100).toFixed(1);
  });

  new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Accuracy %",
          data: accuracyData,
          borderColor: "#4a6fa5",
          backgroundColor: "rgba(74, 111, 165, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });
}

function renderDifficultyChart(results) {
  const ctx = document.getElementById("difficultyChart").getContext("2d");

  // Calculate difficulty distribution (based on time taken)
  const timeBins = {
    fast: 0, // < 30 sec
    medium: 0, // 30-60 sec
    slow: 0, // > 60 sec
  };

  results.forEach((result) => {
    result.questionTimes.forEach((time) => {
      if (time < 30) timeBins.fast++;
      else if (time <= 60) timeBins.medium++;
      else timeBins.slow++;
    });
  });

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fast (<30s)", "Medium (30-60s)", "Slow (>60s)"],
      datasets: [
        {
          data: [timeBins.fast, timeBins.medium, timeBins.slow],
          backgroundColor: [
            "#2ecc71", // green
            "#f39c12", // orange
            "#e74c3c", // red
          ],
        },
      ],
    },
    options: {
      responsive: true,
    },
  });
}

function renderHistoricalProgressChart(results) {
  const ctx = document
    .getElementById("historicalProgressChart")
    .getContext("2d");

  // Sort results by date
  const sortedResults = [...results].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const dates = [];
  const cumulativeCorrect = [];
  const cumulativeTotal = [];
  let totalCorrect = 0;
  let totalQuestions = 0;

  sortedResults.forEach((result) => {
    dates.push(result.date);
    totalCorrect += result.correctAnswers;
    totalQuestions += result.totalQuestions;
    cumulativeCorrect.push(totalCorrect);
    cumulativeTotal.push(totalQuestions);
  });

  const accuracyData = cumulativeCorrect.map((correct, i) =>
    ((correct / cumulativeTotal[i]) * 100).toFixed(1)
  );

  new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Total Questions",
          data: cumulativeTotal,
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          yAxisID: "y1",
        },
        {
          label: "Accuracy %",
          data: accuracyData,
          borderColor: "#2ecc71",
          backgroundColor: "rgba(46, 204, 113, 0.1)",
          yAxisID: "y2",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y1: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Total Questions",
          },
        },
        y2: {
          type: "linear",
          display: true,
          position: "right",
          min: 0,
          max: 100,
          title: {
            display: true,
            text: "Accuracy %",
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

function updateAchievementsDisplay(results) {
  const achievementsList = document.getElementById("achievementsList");
  achievementsList.innerHTML = "";
   // Add this section to show flashcard time achievements
  if (currentFolder && flashcardTimeStats[currentFolder]) {
    const folderStats = flashcardTimeStats[currentFolder];
    const folderName = currentFolder.replace(/_/g, ' ');

    const timeHeader = document.createElement("h3");
    timeHeader.textContent = `Flashcard Time in ${folderName}`;
    timeHeader.style.gridColumn = "1 / -1";
    timeHeader.style.marginTop = "20px";
    achievementsList.appendChild(timeHeader);

    timeBasedAchievements.forEach(achievement => {
      const earned = folderStats.achievements.includes(achievement.id);
      const progress = Math.min(100, (folderStats.totalTime / achievement.timeThreshold) * 100);
      
      const achievementEl = document.createElement("div");
      achievementEl.className = `achievement ${earned ? "earned" : ""}`;
      achievementEl.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-details">
          <h4>${achievement.title}</h4>
          <p>${achievement.description} (${formatTime(folderStats.totalTime)}/${formatTime(achievement.timeThreshold)})</p>
          ${earned ? '<span class="earned-text">Earned!</span>' : `
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
          `}
        </div>
      `;
      achievementsList.appendChild(achievementEl);
    });
  }
  // Calculate achievements
  const totalQuizzes = results.length;
  const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
  const streaks = calculateStreaks(results);

  const achievements = [
    {
      id: "first_quiz",
      title: "First Quiz",
      description: "Complete your first quiz",
      icon: "🥇",
      earned: totalQuizzes > 0,
    },
    {
      id: "perfect_score",
      title: "Perfect Score",
      description: "Get 100% on a quiz",
      icon: "💯",
      earned: results.some((r) => r.correctAnswers === r.totalQuestions),
    },
    {
      id: "fast_learner",
      title: "Fast Learner",
      description: "Average time per question < 30s",
      icon: "⚡",
      earned: false, // You'd need to calculate this
    },
    {
      id: "three_day_streak",
      title: "3-Day Streak",
      description: "Take quizzes for 3 consecutive days",
      icon: "🔥",
      earned: streaks.longest >= 3,
    },
    {
      id: "week_streak",
      title: "7-Day Streak",
      description: "Take quizzes for 7 consecutive days",
      icon: "🏆",
      earned: streaks.longest >= 7,
    },
    {
      id: "hundred_questions",
      title: "100 Questions",
      description: "Answer 100 questions correctly",
      icon: "💪",
      earned: totalCorrect >= 100,
    },
  ];

  achievements.forEach((achievement) => {
    const achievementEl = document.createElement("div");
    achievementEl.className = `achievement ${
      achievement.earned ? "earned" : ""
    }`;
    achievementEl.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-details">
          <h4>${achievement.title}</h4>
          <p>${achievement.description}</p>
          ${
            achievement.earned ? '<span class="earned-text">Earned!</span>' : ""
          }
        </div>
      `;
    achievementsList.appendChild(achievementEl);
  });
}

// Add these functions to script.js
async function setDailyGoal() {
  const goal = parseInt(document.getElementById("dailyGoalInput").value);
  if (isNaN(goal) || goal < 1) {
    alert("Please enter a valid number (at least 1)");
    return;
  }

  localStorage.setItem("dailyGoal", goal);
  updateGoalProgress();
}

async function updateGoalProgress() {
  const goal = parseInt(localStorage.getItem("dailyGoal")) || 10;
  document.getElementById("dailyGoalInput").value = goal;

  // Get today's results
  const today = new Date().toISOString().split("T")[0];
  const results = await getQuizResults(currentFolder);
  const todayResults = results.filter((r) => r.date === today);

  const todayQuestions = todayResults.reduce(
    (sum, r) => sum + r.totalQuestions,
    0
  );
  const progressPercentage = Math.min(100, (todayQuestions / goal) * 100);

  const goalProgress = document.getElementById("goalProgress");
  goalProgress.innerHTML = `
      <p>Today's progress: ${todayQuestions}/${goal} questions</p>
      <div class="goal-progress-bar">
        <div class="goal-progress" style="width: ${progressPercentage}%"></div>
      </div>
      ${
        progressPercentage >= 100
          ? '<p class="earned-text">Daily goal achieved! 🎉</p>'
          : `<p>${goal - todayQuestions} more to reach your goal</p>`
      }
    `;

  if (
    progressPercentage >= 100 &&
    !localStorage.getItem("goalCompletedToday")
  ) {
    showAchievementNotification(
      "Daily Goal Achieved",
      "You completed your daily goal!",
      "🎯"
    );
    localStorage.setItem("goalCompletedToday", "true");
  }
}

// Call this in updateAnalysisForFolder


















// Add this to the global variables section
let dailyStreakCount = parseInt(localStorage.getItem("dailyStreakCount")) || 0;
let weeklyStreakCount = parseInt(localStorage.getItem("weeklyStreakCount")) || 0;
let monthlyStreakCount = parseInt(localStorage.getItem("monthlyStreakCount")) || 0;
let lastQuizDate = localStorage.getItem("lastQuizDate") || null;

// Update this function in your existing code
function updateAchievementsDisplay(results) {
  const achievementsList = document.getElementById("achievementsList");
  achievementsList.innerHTML = "";

  // Calculate achievements
  const totalQuizzes = results.length;
  const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
  const streaks = calculateStreaks(results);
  
  // Check for perfect folder completions
  const perfectFolders = checkPerfectFolderCompletions(results);
  
  // Update streak counts
  updateStreakCounts(results);

  const achievements = [
    // Basic achievements
    {
      id: "first_quiz",
      title: "First Quiz",
      description: "Complete your first quiz",
      icon: "🥇",
      earned: totalQuizzes > 0,
    },
    {
      id: "perfect_score",
      title: "Perfect Score",
      description: "Get 100% on a quiz",
      icon: "💯",
      earned: results.some((r) => r.correctAnswers === r.totalQuestions),
    },
    {
      id: "fast_learner",
      title: "Fast Learner",
      description: "Average time per question < 30s",
      icon: "⚡",
      earned: calculateAverageTime(results) < 30,
    },
    {
      id: "hundred_questions",
      title: "100 Questions",
      description: "Answer 100 questions correctly",
      icon: "💪",
      earned: totalCorrect >= 100,
    },
    {
      id: "five_hundred_questions",
      title: "500 Questions",
      description: "Answer 500 questions correctly",
      icon: "🧠",
      earned: totalCorrect >= 500,
    },
    {
      id: "thousand_questions",
      title: "1000 Questions",
      description: "Answer 1000 questions correctly",
      icon: "🏆",
      earned: totalCorrect >= 1000,
    },
    
    // Streak achievements
    {
      id: "three_day_streak",
      title: "3-Day Streak",
      description: "Take quizzes for 3 consecutive days",
      icon: "🔥",
      earned: streaks.longest >= 3,
    },
    {
      id: "week_streak",
      title: "7-Day Streak",
      description: "Take quizzes for 7 consecutive days",
      icon: "🌟",
      earned: streaks.longest >= 7,
    },
    {
      id: "month_streak",
      title: "30-Day Streak",
      description: "Take quizzes for 30 consecutive days",
      icon: "🚀",
      earned: streaks.longest >= 30,
    },
    
    // Consistency medals
    {
      id: "daily_bronze",
      title: "Daily Bronze",
      description: "Complete quizzes for 1 day straight",
      icon: "🥉",
      earned: dailyStreakCount >= 1,
      medal: "bronze"
    },
    {
      id: "weekly_silver",
      title: "Weekly Silver",
      description: "Complete quizzes for 7 days straight",
      icon: "🥈",
      earned: weeklyStreakCount >= 1,
      medal: "silver"
    },
    {
      id: "monthly_gold",
      title: "Monthly Gold",
      description: "Complete quizzes for 30 days straight",
      icon: "🥇",
      earned: monthlyStreakCount >= 1,
      medal: "gold"
    },
    
    // Perfect folder achievements
    {
      id: "perfect_folder",
      title: "Perfect Folder",
      description: "Correctly answer every question in a folder at least once",
      icon: "✨",
      earned: perfectFolders > 0,
      count: perfectFolders,
      // Only show if actually earned
      show: () => perfectFolders > 0
    },
    {
      id: "master_collector",
      title: "Master Collector",
      description: "Complete all questions in 3 folders correctly",
      icon: "🏅",
      earned: perfectFolders >= 3,
      // Only show if at least 1 perfect folder
      show: () => perfectFolders >= 1
    },
    {
      id: "grand_quizmaster",
      title: "Grand Quizmaster",
      description: "Complete all questions in 10 folders correctly",
      icon: "👑",
      earned: perfectFolders >= 10,
      // Only show if at least 3 perfect folders
      show: () => perfectFolders >= 3
    },
    
    // Special achievements
    {
      id: "early_bird",
      title: "Early Bird",
      description: "Complete a quiz before 8 AM",
      icon: "🌅",
      earned: checkEarlyBird(results),
    },
    {
      id: "night_owl",
      title: "Night Owl",
      description: "Complete a quiz after 10 PM",
      icon: "🌙",
      earned: checkNightOwl(results),
    },
    {
      id: "speed_demon",
      title: "Speed Demon",
      description: "Complete a quiz with average time < 15s per question",
      icon: "🏎️",
      earned: results.some(r => calculateQuizAverageTime(r) < 15),
    },
    {
      id: "persistent_learner",
      title: "Persistent Learner",
      description: "Answer 50 questions in one session",
      icon: "🦉",
      earned: results.some(r => r.totalQuestions >= 50),
    }
  ];

  achievements.forEach((achievement) => {
    const achievementEl = document.createElement("div");
    achievementEl.className = `achievement ${
      achievement.earned ? "earned" : ""
    }`;
    
    let countText = "";
    if (achievement.count) {
      countText = `<span class="achievement-count">x${achievement.count}</span>`;
    }
    
    let medalClass = "";
    if (achievement.medal) {
      medalClass = `medal-${achievement.medal}`;
    }
    
    achievementEl.innerHTML = `
        <div class="achievement-icon ${medalClass}">${achievement.icon}</div>
        <div class="achievement-details">
          <h4>${achievement.title}</h4>
          <p>${achievement.description}</p>
          ${
            achievement.earned ? '<span class="earned-text">Earned!</span>' : ""
          }
          ${countText}
        </div>
      `;
    achievementsList.appendChild(achievementEl);
  });



  // Add flashcard time achievements
  if (currentFolder && flashcardTimeStats[currentFolder]) {
    const folderStats = flashcardTimeStats[currentFolder];
    
    timeBasedAchievements.forEach(achievement => {
      const earned = folderStats.achievements.includes(achievement.id);
      const progress = Math.min(100, (folderStats.totalTime / achievement.timeThreshold) * 100);
      
      const achievementEl = document.createElement("div");
      achievementEl.className = `achievement ${earned ? "earned" : ""}`;
      achievementEl.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-details">
          <h4>${achievement.title}</h4>
          <p>${achievement.description} (${formatTime(folderStats.totalTime)}/${formatTime(achievement.timeThreshold)})</p>
          ${earned ? '<span class="earned-text">Earned!</span>' : `
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
          `}
        </div>
      `;
      achievementsList.appendChild(achievementEl);
    });
  }
}
// Helper function to format time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}














// Add these new helper functions
function checkPerfectFolderCompletions(results) {
  if (!results || results.length === 0) return 0;
  
  const folders = Object.keys(quizzes).filter(f => !f.includes('_Incorrect'));
  let perfectCount = 0;

  folders.forEach(folder => {
    const folderQuestions = quizzes[folder];
    const folderResults = results.filter(r => r.folderName === folder);
    
    // Create a set of all question indices in this folder
    const allQuestionIndices = new Set(
      folderQuestions.map((_, index) => index)
    );
    
    // Create a set of questions answered correctly at least once
    const correctlyAnswered = new Set();
    
    folderResults.forEach(result => {
      // Assuming result includes which specific questions were correct
      if (result.correctQuestionIds) {
        result.correctQuestionIds.forEach(id => correctlyAnswered.add(id));
      }
    });
    
    // Check if all questions were answered correctly at least once
    const allCorrect = [...allQuestionIndices].every(index => 
      correctlyAnswered.has(index)
    );
    
    if (allCorrect) perfectCount++;
  });
  
  return perfectCount;
}

// In your global variables
let medalCounts = {
  bronze: parseInt(localStorage.getItem('medalBronze')) || 0,
  silver: parseInt(localStorage.getItem('medalSilver')) || 0,
  gold: parseInt(localStorage.getItem('medalGold')) || 0
};

// In your updateStreakCounts function
function updateStreakCounts(results) {
  if (!results || results.length === 0) return;

  const today = new Date().toISOString().split("T")[0];
  const todayResults = results.filter(r => r.date === today);
  
  if (todayResults.length > 0) {
    const lastDate = new Date(lastQuizDate || 0);
    const currentDate = new Date();
    const dayDiff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);

    // Reset streak if more than a day has passed
    if (lastQuizDate && dayDiff > 1) {
      dailyStreakCount = 0;
    }

    // Only increment if this is a new day
    if (dayDiff >= 1) {
      dailyStreakCount++;
      localStorage.setItem("dailyStreakCount", dailyStreakCount.toString());
      localStorage.setItem("lastQuizDate", today);

      // Award bronze medal for daily streak (every day)
      medalCounts.bronze++;
      localStorage.setItem('medalBronze', medalCounts.bronze.toString());

      // Award silver medal for weekly streak (every 7 days)
      if (dailyStreakCount % 7 === 0) {
        medalCounts.silver++;
        localStorage.setItem('medalSilver', medalCounts.silver.toString());
      }

      // Award gold medal for monthly streak (every 30 days)
      if (dailyStreakCount % 30 === 0) {
        medalCounts.gold++;
        localStorage.setItem('medalGold', medalCounts.gold.toString());
      }

      updateMedalDisplay(); // Update the UI

      showMedalNotification('bronze');
  if (dailyStreakCount % 7 === 0) {
    showMedalNotification('silver');
  }
  if (dailyStreakCount % 30 === 0) {
    showMedalNotification('gold');
  }
    }
  }
}

function calculateAverageTime(results) {
  if (!results || results.length === 0) return 0;
  
  let totalTime = 0;
  let totalQuestions = 0;
  
  results.forEach(result => {
    if (result.questionTimes && result.questionTimes.length > 0) {
      totalTime += result.questionTimes.reduce((sum, time) => sum + time, 0);
      totalQuestions += result.questionTimes.length;
    }
  });
  
  return totalQuestions > 0 ? totalTime / totalQuestions : 0;
}

function calculateQuizAverageTime(result) {
  if (!result.questionTimes || result.questionTimes.length === 0) return 0;
  return result.questionTimes.reduce((sum, time) => sum + time, 0) / result.questionTimes.length;
}

function checkEarlyBird(results) {
  return results.some(result => {
    const quizDate = new Date(result.date);
    return quizDate.getHours() < 8; // Before 8 AM
  });
}

function checkNightOwl(results) {
  return results.some(result => {
    const quizDate = new Date(result.date);
    return quizDate.getHours() >= 22; // After 10 PM
  });
}

// Add this to your updateMedalDisplay function
// Update updateMedalDisplay function
function updateMedalDisplay() {
  try {
    const bronze = document.getElementById('bronze-count');
    const silver = document.getElementById('silver-count');
    const gold = document.getElementById('gold-count');
    
    if (bronze) bronze.textContent = medalCounts.bronze || 0;
    if (silver) silver.textContent = medalCounts.silver || 0;
    if (gold) gold.textContent = medalCounts.gold || 0;
    
    // Update footer medals too
    const footerBronze = document.getElementById('footer-bronze');
    const footerSilver = document.getElementById('footer-silver');
    const footerGold = document.getElementById('footer-gold');
    
    if (footerBronze) footerBronze.textContent = medalCounts.bronze || 0;
    if (footerSilver) footerSilver.textContent = medalCounts.silver || 0;
    if (footerGold) footerGold.textContent = medalCounts.gold || 0;
  } catch (error) {
    console.error("Error updating medals:", error);
  }
}
// Add this to your DOMContentLoaded event
// Update DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize database
    await initDB();
    
    // Load data
    await loadQuizzes();
    
    // Initialize goal tracking data
    await initializeGoalData();
    
    // Update UI components
    updateFolderList();
    updateMedalDisplay();
    checkBirthday();
    checkMissedDays();
    
    // Set theme (keep using localStorage for this as it's small)
    const savedTheme = localStorage.getItem("quizTheme");
    document.body.classList.toggle("dark-theme", savedTheme === "dark" || savedTheme === null);
    
    // Update goal-related components
    updateGoalDisplay();
    updateFooterGoals();
    
    // Render calendar
    setTimeout(() => {
      try {
        renderConsistencyCalendar();
      } catch (err) {
        console.error("Error rendering calendar:", err);
      }
    }, 100);
    
  } catch (error) {
    console.error("Initialization error:", error);
  }
});
const maxRetries = 3;
let retries = 0;

async function initializeApp() {
  try {
    await initDB();
    // ... rest of initialization ...
  } catch (error) {
    if (retries < maxRetries) {
      retries++;
      setTimeout(initializeApp, 1000 * retries);
    } else {
      console.error("Final initialization error:", error);
      alert("Failed after multiple attempts. Please refresh.");
    }
  }
}

document.addEventListener("DOMContentLoaded", initializeApp);
function showMedalNotification(type) {
  let title, message, icon;
  
  switch(type) {
    case 'bronze':
      title = "Bronze Medal Earned!";
      message = "You've completed your daily streak!";
      icon = "🥉";
      break;
    case 'silver':
      title = "Silver Medal Earned!";
      message = "You've completed a weekly streak!";
      icon = "🥈";
      break;
    case 'gold':
      title = "Gold Medal Earned!";
      message = "You've completed a monthly streak!";
      icon = "🥇";
      break;
  }
  
  showAchievementNotification(title, message, icon);
}

// Back to top button
window.addEventListener('scroll', function() {
  const backToTopButton = document.querySelector('.back-to-top');
  if (window.scrollY > 300) {
    backToTopButton.classList.add('visible');
  } else {
    backToTopButton.classList.remove('visible');
  }
});




// Add to your global variables
let flashcardTimeStats = {}; // { folderName: { totalTime: seconds, achievements: [] } }

// Add these to your achievements list (in updateAchievementsDisplay function)
const timeBasedAchievements = [
  { id: "flashcard_30m", title: "Flashcard Novice", description: "Spent 30 minutes with flashcards", icon: "⏳", timeThreshold: 1800 },
  { id: "flashcard_1h", title: "Flashcard Learner", description: "Spent 1 hour with flashcards", icon: "📖", timeThreshold: 3600 },
  { id: "flashcard_2h", title: "Flashcard Scholar", description: "Spent 2 hours with flashcards", icon: "🎓", timeThreshold: 7200 },
  { id: "flashcard_6h", title: "Flashcard Master", description: "Spent 6 hours with flashcards", icon: "🏛️", timeThreshold: 21600 },
  { id: "flashcard_12h", title: "Flashcard Expert", description: "Spent 12 hours with flashcards", icon: "🧠", timeThreshold: 43200 },
  { id: "flashcard_24h", title: "Flashcard Guru", description: "Spent 24 hours with flashcards", icon: "👨‍🏫", timeThreshold: 86400 }
];


function checkFlashcardAchievements() {
  if (!currentFolder || !flashcardTimeStats[currentFolder]) return;
  
  const folderStats = flashcardTimeStats[currentFolder];
  const folderName = currentFolder.replace(/_/g, ' ');
  
  timeBasedAchievements.forEach(achievement => {
    if (folderStats.totalTime >= achievement.timeThreshold && 
        !folderStats.achievements.includes(achievement.id)) {
      folderStats.achievements.push(achievement.id);
      localStorage.setItem('flashcardTimeStats', JSON.stringify(flashcardTimeStats));
      
      showAchievementNotification(
        achievement.title,
        `${achievement.description} in ${folderName}`,
        achievement.icon
      );
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  });
}

function startFlashcardTimer() {
  flashcardStartTime = Date.now();
  flashcardInterval = setInterval(updateFlashcardTime, 1000);
  console.log("Flashcard timer started");
}
// Replace the existing updateFlashcardTime function with this:


function updateFlashcardTime() {
  if (!currentFolder || !flashcardStartTime) return;
  
  const today = new Date().toISOString().split('T')[0];
  const currentTime = Date.now();
  const elapsedSeconds = Math.floor((currentTime - flashcardStartTime) / 1000);
  const now = Date.now();
  const elapsedMinutes = Math.floor(folderStudyTime / 60);
  
  // Trigger different encouragement types
  if (elapsedMinutes > 0 && elapsedMinutes % 15 === 0) {
    showEncouragement('milestone');
  } 
  else if (incorrectQuestions.length > 3 && Math.random() > 0.5) {
    showEncouragement('challenge');
  }
  else if (now - lastBreakReminder > 1800000) { // 30 minutes
    showEncouragement('break');
    lastBreakReminder = now;
  }
  else if (Math.random() < 0.15) { // 15% chance for general encouragement
    showEncouragement();
  }

  // Update session time
  flashcardStartTime = currentTime;
  
  // Update daily study time
  if (!flashcardDailyStudyTime[today]) {
    flashcardDailyStudyTime[today] = {};
  }
  if (!flashcardDailyStudyTime[today][currentFolder]) {
    flashcardDailyStudyTime[today][currentFolder] = 0;
  }
  
  flashcardDailyStudyTime[today][currentFolder] += elapsedSeconds;
  localStorage.setItem('flashcardDailyStudyTime', JSON.stringify(flashcardDailyStudyTime));
  
  // Check for medals
  checkRealTimeMedals(currentFolder, flashcardDailyStudyTime[today][currentFolder]);
  
  // Show encouragement at appropriate intervals (20% chance each check)
  if (Math.random() < 0.2) {
    showContextualEncouragement();
  }
}

// Add this new function for real-time medal checking
function checkRealTimeMedals(folderName, currentStudyTime) {
  if (!flashcardStudyMedals[folderName]) {
    flashcardStudyMedals[folderName] = {};
  }
  
  const today = new Date().toISOString().split('T')[0];
  const medalThresholds = [
    { type: 'bronze', threshold: 1850, awarded: flashcardStudyMedals[folderName].bronze === today },  // 30 minutes
    { type: 'silver', threshold: 3650, awarded: flashcardStudyMedals[folderName].silver === today },  // 1 hour
    { type: 'gold', threshold: 7300, awarded: flashcardStudyMedals[folderName].gold === today }       // 2 hours
  ];
  
  medalThresholds.forEach(({ type, threshold, awarded }) => {
    if (currentStudyTime >= threshold && !awarded) {
      flashcardStudyMedals[folderName][type] = today;
      awardFlashcardMedal(type, folderName);
    }
  });
  
  localStorage.setItem('flashcardStudyMedals', JSON.stringify(flashcardStudyMedals));
}

function checkFlashcardMilestones(currentTime) {
  // Find all milestones we've passed but haven't celebrated yet
  const newMilestones = flashcardMilestones.filter(m => 
    currentTime >= m.time && 
    (!flashcardTimeStats[currentFolder]?.achievedMilestones || 
     !flashcardTimeStats[currentFolder].achievedMilestones.includes(m.time))
  );

  if (newMilestones.length > 0) {
    // Update achieved milestones in storage
    if (!flashcardTimeStats[currentFolder]) {
      flashcardTimeStats[currentFolder] = { totalTime: 0, achievedMilestones: [] };
    }
    if (!flashcardTimeStats[currentFolder].achievedMilestones) {
      flashcardTimeStats[currentFolder].achievedMilestones = [];
    }
    
    newMilestones.forEach(milestone => {
      // Add to achieved milestones
      flashcardTimeStats[currentFolder].achievedMilestones.push(milestone.time);
      
      // Trigger celebration
      triggerFlashcardMilestoneCelebration(milestone);
    });
    
    // Save to storage
    localStorage.setItem('flashcardTimeStats', JSON.stringify(flashcardTimeStats));
  }
}
function stopFlashcardTimer() {
  if (flashcardInterval) {
    clearInterval(flashcardInterval);
    updateFlashcardTime(); // Final update
    lastCelebratedMilestone = 0; // Reset for next session
    console.log("Flashcard timer stopped");
  }
}

// Add with your other global variables
const flashcardMilestones = [
  { time: 60,    name: "1 Minute",    emoji: "⏳", message: "You've started! Keep going!", confetti: false },
  { time: 600,   name: "10 Minutes",  emoji: "⏳", message: "Great start! You're doing well!", confetti: true },
  { time: 1200,  name: "20 Minutes",  emoji: "📖", message: "Making progress! Stay focused!", confetti: true },
  { time: 1800,  name: "30 Minutes",  emoji: "📚", message: "Half hour of learning! Awesome!", confetti: true },
  { time: 2400,  name: "40 Minutes",  emoji: "🧠", message: "Your brain is getting stronger!", confetti: true },
  { time: 3000,  name: "50 Minutes",  emoji: "⚡", message: "Almost an hour! Keep pushing!", confetti: true },
  { time: 3600,  name: "1 Hour",      emoji: "🎓", message: "Hour of mastery! You're crushing it!", confetti: true },
  { time: 4200,  name: "70 Minutes",  emoji: "🌟", message: "Going above and beyond!", confetti: true },
  { time: 4800,  name: "80 Minutes",  emoji: "💪", message: "Incredible dedication!", confetti: true },
  { time: 5400,  name: "90 Minutes",  emoji: "🔥", message: "1.5 hours! You're unstoppable!", confetti: true },
  { time: 6000,  name: "100 Minutes", emoji: "🚀", message: "Making amazing progress!", confetti: true },
  { time: 7200,  name: "2 Hours",     emoji: "🏛️", message: "Incredible focus! Keep it up!", confetti: true }
];
let lastCelebratedMilestone = 0;


function triggerFlashcardMilestoneCelebration(milestone) {
  // Gentle confetti for milestones
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#4a6fa5', '#2ecc71', '#3498db', '#f1c40f'],
    scalar: 0.8
  });

  // Create milestone message
  const message = document.createElement('div');
  message.innerHTML = `
    <div style="
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translate(-50%, 0);
      background: rgba(74, 111, 165, 0.9);
      color: white;
      padding: 15px 25px;
      border-radius: 50px;
      font-size: 1.2em;
      text-align: center;
      z-index: 1001;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      animation: slideDown 0.5s forwards, fadeOut 1s forwards 2.5s;
    ">
      <span style="font-size: 1.5em;">${milestone.emoji}</span>
      <div>
        <div style="font-weight: bold;">${milestone.name} Completed!</div>
        <div style="font-size: 0.8em;">${milestone.message}</div>
      </div>
    </div>
  `;
  document.body.appendChild(message);

  // Add progress particles
  const container = document.getElementById('flashcardContainer');
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const particle = document.createElement('div');
      particle.textContent = ['✨', '🌟', '⚡', '💡'][Math.floor(Math.random() * 4)];
      particle.style.position = 'absolute';
      particle.style.fontSize = `${Math.random() * 20 + 15}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.bottom = '0';
      particle.style.opacity = '0';
      particle.style.transform = 'translateY(0)';
      particle.style.transition = 'all 1s ease-out';
      particle.style.zIndex = '1000';
      particle.style.pointerEvents = 'none';
      container.appendChild(particle);
      
      setTimeout(() => {
        particle.style.opacity = '1';
        particle.style.transform = `translateY(-${Math.random() * 100 + 50}px)`;
      }, 10);
      
      setTimeout(() => {
        particle.remove();
      }, 1000);
    }, i * 100);
  }

  // Remove message after animation
  setTimeout(() => {
    message.remove();
  }, 3500);
}


// Add this to your global variables
let folderUsageStats = JSON.parse(localStorage.getItem('folderUsageStats')) || {};

// Add this function to track folder usage
function trackFolderUsage(folderName) {
  if (!folderName) return;
  
  if (!folderUsageStats[folderName]) {
    folderUsageStats[folderName] = 0;
  }
  folderUsageStats[folderName]++;
  
  localStorage.setItem('folderUsageStats', JSON.stringify(folderUsageStats));
}

// Call this function whenever a folder is selected
function getTopFolders(limit = 5) {
  const folders = Object.keys(folderUsageStats);
  if (folders.length === 0) return [];
  
  return folders
    .sort((a, b) => folderUsageStats[b] - folderUsageStats[a])
    .slice(0, limit);
}
function updateFrequentFoldersList() {
  const frequentFoldersContainer = document.getElementById('frequentFolders');
  if (!frequentFoldersContainer) return;
  
  const topFolders = getTopFolders(5);
  
  frequentFoldersContainer.innerHTML = '';
  
  if (topFolders.length === 0) {
    frequentFoldersContainer.innerHTML = '<li>No folder usage data yet</li>';
    return;
  }
  
  topFolders.forEach(folder => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'footer-link';
    btn.textContent = folder;
    btn.onclick = () => {
      document.getElementById('folderSelect').value = folder;
      selectFolder();
      goHome();
    };
    li.appendChild(btn);
    frequentFoldersContainer.appendChild(li);
  });
}

// Call this in your DOMContentLoaded event
document.addEventListener("DOMContentLoaded", async () => {
  // ... existing code ...
  updateFrequentFoldersList();
});


// Add these to your global variables
let flashcardStudyMedals = JSON.parse(localStorage.getItem('flashcardStudyMedals')) || {};
let flashcardDailyStudyTime = JSON.parse(localStorage.getItem('flashcardDailyStudyTime')) || {};
let flashcardSessionStartTime = null;


// Add these constants for medal thresholds (in seconds)
const FLASHCARD_MEDAL_THRESHOLDS = {
  bronze: 1800,  // 30 minutes
  silver: 3600,  // 1 hour
  gold: 7200     // 2 hours
};
function startFlashcardTimer() {
  flashcardStartTime = Date.now();
  flashcardInterval = setInterval(() => {
    const currentTime = Math.floor((Date.now() - flashcardStartTime) / 1000);
    
    // Update current folder's study time
    const today = new Date().toISOString().split('T')[0];
    if (!flashcardDailyStudyTime[today]) {
      flashcardDailyStudyTime[today] = {};
    }
    if (!flashcardDailyStudyTime[today][currentFolder]) {
      flashcardDailyStudyTime[today][currentFolder] = 0;
    }
    flashcardDailyStudyTime[today][currentFolder] = currentTime;
    
    // Check for milestones and medals
    checkFlashcardMilestones(currentTime);
    checkRealTimeMedals(currentFolder, currentTime);
    
    localStorage.setItem('flashcardDailyStudyTime', JSON.stringify(flashcardDailyStudyTime));
  }, 1000);
}
// Add this function to start tracking flashcard study time
function startFlashcardStudySession(folderName) {
  if (!folderName) return;
  
  // Reset daily timer if it's a new day
  const today = new Date().toISOString().split('T')[0];
  if (!flashcardDailyStudyTime[today]) {
    flashcardDailyStudyTime[today] = {};
  }
  if (!flashcardDailyStudyTime[today][folderName]) {
    flashcardDailyStudyTime[today][folderName] = 0;
  }
  
  flashcardSessionStartTime = Date.now();
  localStorage.setItem('flashcardDailyStudyTime', JSON.stringify(flashcardDailyStudyTime));
}

// Add this function to stop tracking and award medals
function endFlashcardStudySession(folderName) {
  if (!flashcardSessionStartTime || !folderName) return;
  
  const today = new Date().toISOString().split('T')[0];
  const sessionTime = Math.floor((Date.now() - flashcardSessionStartTime) / 1000);
  
  // Update daily study time
  flashcardDailyStudyTime[today][folderName] = 
    (flashcardDailyStudyTime[today][folderName] || 0) + sessionTime;
  
  localStorage.setItem('flashcardDailyStudyTime', JSON.stringify(flashcardDailyStudyTime));
  
  // Check for medals
  checkFlashcardMedals(folderName, flashcardDailyStudyTime[today][folderName]);
}

// Add this function to check and award medals
function checkFlashcardMedals(folderName, totalStudyTime) {
  const today = new Date().toISOString().split('T')[0];
  
  if (!flashcardStudyMedals[folderName]) {
    flashcardStudyMedals[folderName] = {};
  }
  
  // Check each medal threshold
  Object.entries(FLASHCARD_MEDAL_THRESHOLDS).forEach(([medal, threshold]) => {
    if (totalStudyTime >= threshold && !flashcardStudyMedals[folderName][medal]) {
      flashcardStudyMedals[folderName][medal] = today;
      awardFlashcardMedal(medal, folderName);
    }
  });
  
  localStorage.setItem('flashcardStudyMedals', JSON.stringify(flashcardStudyMedals));
}

// Add this function to award medals with animation
function awardFlashcardMedal(medalType, folderName) {
  // Update medal counts
  medalCounts[medalType] = (medalCounts[medalType] || 0) + 1;
  localStorage.setItem(`medal${medalType.charAt(0).toUpperCase() + medalType.slice(1)}`, medalCounts[medalType]);
  
  // Create floating medal animation
  const medal = document.createElement('div');
  medal.className = 'flashcard-medal';
  medal.innerHTML = medalType === 'bronze' ? '🥉' : medalType === 'silver' ? '🥈' : '🥇';
  document.body.appendChild(medal);
  
  // Remove medal after animation
  setTimeout(() => {
    medal.remove();
  }, 3000);
  
  // Show notification
  const medalNames = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold'
  };
  const times = {
    bronze: '30 minutes',
    silver: '1 hour',
    gold: '2 hours'
  };
  
  showAchievementNotification(
    `${medalNames[medalType]} Flashcard Medal Earned!`,
    `You've studied ${folderName} for ${times[medalType]} today!`,
    medalType === 'bronze' ? '🥉' : medalType === 'silver' ? '🥈' : '🥇'
  );
  
  // Update medal display with animation
  updateMedalDisplay();
  
  // Trigger appropriate confetti
  const confettiConfig = {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  };
  
  if (medalType === 'gold') {
    confettiConfig.colors = ['#ffd700', '#ffffff', '#ffd700'];
    confettiConfig.particleCount = 150;
  } else if (medalType === 'silver') {
    confettiConfig.colors = ['#c0c0c0', '#ffffff', '#c0c0c0'];
  } else {
    confettiConfig.colors = ['#cd7f32', '#ffffff', '#cd7f32'];
  }
  
  confetti(confettiConfig);
  
  // Pulse the medal counter in header
  const medalElement = document.querySelector(`.medal.${medalType}`);
  if (medalElement) {
    medalElement.classList.add('medal-pulse');
    setTimeout(() => {
      medalElement.classList.remove('medal-pulse');
    }, 1000);
  }
}



//testing 
function showRandomEncouragement() {
  const messages = [
  { text: "You're doing great! 👍", emoji: "✨" },
  { text: "Knowledge is power! 💪", emoji: "🧠" },
  { text: "Every minute counts! ⏱️", emoji: "🌟" },
  { text: "One step at a time! 👣", emoji: "🚀" },
  { text: "Stay curious, stay sharp! 🧐", emoji: "🔍" },
  { text: "Keep pushing forward! ➡️", emoji: "🔥" },
  { text: "You're on the right path! 🛤️", emoji: "✅" },
  { text: "Big things start small! 🌱", emoji: "🌈" },
  { text: "Consistency is key! 🔑", emoji: "📆" },
  { text: "Believe in yourself! 💖", emoji: "🌠" },
  { text: "Almost there, keep it up! ⛰️", emoji: "🏁" },
  { text: "Smash your goals! 🎯", emoji: "💥" },
  { text: "Focus mode: ON 🧘‍♂️", emoji: "🛡️" },
  { text: "Progress over perfection! 🛠️", emoji: "📈" },
  { text: "Dream big, start now! 🌌", emoji: "💫" },
  { text: "Hard work pays off! 🏋️", emoji: "🏆" },
  { text: "You're unstoppable! 🏃‍♀️", emoji: "💨" },
  { text: "Turn challenges into victories! 🧗", emoji: "🪄" },
  { text: "You got this! 🙌", emoji: "🎉" },
  { text: "Make today count! 📅", emoji: "🌞" },
  { text: "Learning never stops! 📚", emoji: "🧭" },
  { text: "Dedication leads to success! 🎓", emoji: "🥇" },
  { text: "Stay focused, stay winning! 🎮", emoji: "🥳" },
  { text: "One more push! 💼", emoji: "🚴" },
  { text: "Break time? You've earned it! ☕", emoji: "💤" },
  { text: "Level up your mind! 🧠", emoji: "🆙" },
  { text: "Greatness takes time ⏳", emoji: "🛤️" },
  { text: "Effort never goes unnoticed! 👀", emoji: "📣" },
  { text: "Keep shining bright! 💡", emoji: "🌟" },
  { text: "You’re building your future! 🏗️", emoji: "🧱" },
  { text: "Finish strong! 🏁", emoji: "⚡" },
  { text: "Rise. Grind. Repeat. 🔁", emoji: "🏋️‍♂️" },
  { text: "Brains + Hustle = Magic! ✨", emoji: "🧙" },
  { text: "Success starts with action! 🏃", emoji: "💡" }
];

  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  const bubble = document.createElement('div');
  bubble.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(255,255,255,0.9);
      color: #333;
      padding: 10px 15px;
      border-radius: 20px;
      font-size: 0.9em;
      z-index: 999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeInOut 3s forwards;
    ">
      <span style="font-size: 1.2em;">${msg.emoji}</span>
      ${msg.text}
    </div>
  `;
  document.body.appendChild(bubble);
  
  setTimeout(() => bubble.remove(), 3000);
}

function triggerHighAccuracyCelebration() {
  // Fireworks effect
  playCelebrationSound();

  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);

  // Floating trophy animation
  const trophy = document.createElement('div');
  trophy.innerHTML = '🏆';
  trophy.style.position = 'fixed';
  trophy.style.fontSize = '100px';
  trophy.style.left = '50%';
  trophy.style.top = '50%';
  trophy.style.transform = 'translate(-50%, -50%) scale(0)';
  trophy.style.zIndex = '1001';
  trophy.style.textShadow = '0 0 10px gold';
  trophy.style.animation = 'trophyRise 2s forwards';
  document.body.appendChild(trophy);

  setTimeout(() => {
    trophy.remove();
  }, 2000);
}
// Add this function to your script
function formatExplanation(explanation) {
  if (!explanation) return "No explanation provided.";
  
  // Replace newlines with <br> tags for HTML display
  const formattedText = explanation
    .replace(/\n/g, '<br>') // Convert \n to <br>
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim(); // Remove leading/trailing whitespace
  
  return `<span class="explanation-text">${formattedText}</span>`;
}
// Add this function to delete a folder
async function confirmDeleteFolder() {
  if (!currentFolder) {
    alert("Please select a folder first!");
    return;
  }

  const confirmation = confirm(`Are you sure you want to permanently delete the folder "${currentFolder}" and all its associated data? This cannot be undone!`);
  
  if (confirmation) {
    try {
      // Delete the main folder and its associated folders (_Incorrect, _HardRecall)
      const foldersToDelete = [currentFolder, `${currentFolder}_Incorrect`, `${currentFolder}_HardRecall`];
      
      foldersToDelete.forEach(folder => {
        if (quizzes[folder]) {
          delete quizzes[folder];
        }
      });

      // Save the updated quizzes object
      await saveQuizzes();
      
      // Clear current folder selection
      currentFolder = "";
      
      // Update the UI
      updateFolderList();
      goHome();
      
      // Show success message
      alert(`Folder "${currentFolder}" and its associated data have been deleted successfully.`);
      
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder. Please try again.");
    }
  }
}

// Add this function to handle folder deletion with all its data
async function deleteFolder(folderName) {
  if (!folderName || !quizzes[folderName]) {
    console.error("Invalid folder name or folder doesn't exist");
    return false;
  }

  try {
    // Delete the main folder and its associated folders
    const foldersToDelete = [folderName, `${folderName}_Incorrect`, `${folderName}_HardRecall`];
    
    foldersToDelete.forEach(folder => {
      if (quizzes[folder]) {
        delete quizzes[folder];
      }
    });

    // Save to IndexedDB
    await saveQuizzes();
    
    // If the deleted folder was the current folder, reset it
    if (currentFolder === folderName) {
      currentFolder = "";
      goHome();
    }
    
    // Update folder list
    updateFolderList();
    
    return true;
  } catch (error) {
    console.error("Error deleting folder:", error);
    return false;
  }
}


