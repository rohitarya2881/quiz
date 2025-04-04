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
// Initialize IndexedDB
// Update the initDB function in script.js
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("QuizManagerDB", 2); // Version 2

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create quizzes store if it doesn't exist
      if (!db.objectStoreNames.contains("quizzes")) {
        db.createObjectStore("quizzes", { keyPath: "folderName" });
      }

      // Create analytics store
      if (!db.objectStoreNames.contains("analytics")) {
        const analyticsStore = db.createObjectStore("analytics", {
          keyPath: "id",
          autoIncrement: true,
        });
        analyticsStore.createIndex("folderName", "folderName", {
          unique: false,
        });
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
  
  if (isCorrect) {
    score++;
    // Track correct question by some identifier (could use question text or index)
    question.correctlyAnswered = true;
  } else {
    question.timesIncorrect = (question.timesIncorrect || 0) + 1;
    question.selectedAnswer = question.options[selectedIndex];
    incorrectQuestions.push(question);
  }
  
  currentQuestionIndex++;
  if (currentQuestionIndex < currentQuiz.length) {
    loadQuestion();
  } else {
    await showResults();
  }
  questionStartTime = Date.now();
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
    const isSlow = timeTaken > avgTimeThreshold * 1.5; // 50% slower than average
    timingHTML += `
          <li class="${isSlow ? "slow-time" : "fast-time"}">
              Q${index + 1}: ${timeTaken.toFixed(1)}s
              ${isSlow ? "⏱️" : "⚡"}
          </li>
      `;
  });

  timingHTML += `</ul></div>`;

  // Create results HTML
  let resultsHTML = `
      <h2>Quiz Completed!</h2>
      <p>Your Score: ${score} / ${currentQuiz.length}</p>
      ${timingHTML}
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
              <p><strong>Explanation:</strong> ${
                item.explanation || "No explanation provided."
              }</p>
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
  
  // Add celebration for high accuracy
  if (accuracy >= 90) {
    triggerHighAccuracyCelebration();
  }
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
            <h3>Question ${index + 1}</h3>
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
            <p><strong>Explanation:</strong> ${question.explanation || "No explanation provided."}</p>
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

    flashcardContainer.appendChild(flashcard);
  });
  encouragementInterval = setInterval(() => {
    if (Math.random() > 0.7) { // 30% chance to show
      showRandomEncouragement();
    }
  }, 30000); // Every 30 seconds
}

function showRandomEncouragement() {
  const messages = [
    { text: "You're doing great! 👍", emoji: "✨" },
    { text: "Knowledge is power! 💪", emoji: "🧠" },
    { text: "Every minute counts! ⏱️", emoji: "🌟" }
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
  if (
    !currentFolder ||
    !quizzes[currentFolder] ||
    quizzes[currentFolder].length === 0
  ) {
    alert("Please select a valid folder with questions!");
    return;
  }

  // Reset time tracking
  questionTimes = [];
  totalQuizTime = 0;
  questionStartTime = Date.now(); // Moved this up

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
  questionTimes = [];
  totalQuizTime = 0;
  questionStartTime = Date.now();
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

  // Rest of your existing startQuiz code...
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
  document.getElementById("current-question").textContent =
    currentQuestionIndex + 1;
  document.getElementById("total-questions").textContent = currentQuiz.length;
  const questionData = currentQuiz[currentQuestionIndex];
  document.getElementById("question-text").textContent = questionData.question;
  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";
  questionData.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.classList.add("option-btn");
    button.textContent = option;
    button.onclick = () => selectAnswer(index);
    optionsContainer.appendChild(button);
  });
}

function goHome() {
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
function updateMedalDisplay() {
  try {
    const bronze = document.getElementById('bronze-count');
    const silver = document.getElementById('silver-count');
    const gold = document.getElementById('gold-count');
    
    if (bronze) bronze.textContent = medalCounts.bronze;
    if (silver) silver.textContent = medalCounts.silver;
    if (gold) gold.textContent = medalCounts.gold;
    
    // Update footer medals too
    const footerBronze = document.getElementById('footer-bronze');
    const footerSilver = document.getElementById('footer-silver');
    const footerGold = document.getElementById('footer-gold');
    
    if (footerBronze) footerBronze.textContent = medalCounts.bronze;
    if (footerSilver) footerSilver.textContent = medalCounts.silver;
    if (footerGold) footerGold.textContent = medalCounts.gold;
  } catch (error) {
    console.error("Error updating medals:", error);
  }
}
// Add this to your DOMContentLoaded event
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize database
    await initDB();
    
    // Load data
    await loadQuizzes();
    
    // Update UI components with null checks
    updateFolderList();
    updateMedalDisplay();
    
    // Set theme
    const savedTheme = localStorage.getItem("quizTheme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme");
    }
    
    // Safely set current year
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    } else {
      console.warn("Element 'current-year' not found");
    }
    
  } catch (error) {
    console.error("Initialization error details:", error);
    alert(`Initialization failed: ${error.message}. Please refresh.`);
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
function updateFlashcardTime() {
  const currentTime = Date.now();
  const elapsedSeconds = Math.floor((currentTime - flashcardStartTime) / 1000);
  flashcardStartTime = currentTime;
  
  if (!currentFolder) return;
  
  if (!flashcardTimeStats[currentFolder]) {
    flashcardTimeStats[currentFolder] = { totalTime: 0, achievements: [] };
  }
  
  flashcardTimeStats[currentFolder].totalTime += elapsedSeconds;
  localStorage.setItem('flashcardTimeStats', JSON.stringify(flashcardTimeStats));
  
  // Check for milestones
  checkFlashcardMilestones(flashcardTimeStats[currentFolder].totalTime);
  
  checkFlashcardAchievements();
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
