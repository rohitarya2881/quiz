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
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("QuizManagerDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('quizzes')) {
        db.createObjectStore('quizzes', { keyPath: 'folderName' });
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

// Load quizzes from IndexedDB
async function loadQuizzes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['quizzes'], 'readonly');
    const store = transaction.objectStore('quizzes');
    const request = store.getAll();

    request.onsuccess = (event) => {
      const data = event.target.result;
      quizzes = {};
      data.forEach(item => {
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
    const transaction = db.transaction(['quizzes'], 'readwrite');
    const store = transaction.objectStore('quizzes');

    // Clear existing data
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      // Save all folders
      const savePromises = Object.keys(quizzes).map(folderName => {
        return new Promise((innerResolve, innerReject) => {
          const putRequest = store.put({
            folderName: folderName,
            quizData: quizzes[folderName]
          });
          
          putRequest.onsuccess = () => innerResolve();
          putRequest.onerror = (e) => innerReject(e.target.error);
        });
      });

      Promise.all(savePromises)
        .then(() => resolve())
        .catch(error => reject(error));
    };

    clearRequest.onerror = (event) => {
      console.error("Error clearing quizzes:", event.target.error);
      reject(event.target.error);
    };
  });
}

// Load quizzes from IndexedDB on page load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initDB();
    await loadQuizzes();
    updateFolderList();
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Failed to initialize database. Please refresh the page.");
  }
});

// Toggle the mobile menu
function toggleMenu() {
  const menu = document.getElementById("mobile-menu");
  menu.classList.toggle("show");
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
  folderSelect.innerHTML = '<option value="" disabled selected>Select a folder</option>';
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

      if (Array.isArray(quizData) && quizData.every(q => "question" in q && "options" in q && "correctIndex" in q)) {
        // Ensure all questions have an "explanation" key
        quizData.forEach(q => {
          if (!("explanation" in q)) {
            q.explanation = ""; // Set to empty string if missing
          }
        });

        // Store in quizzes object and save to IndexedDB
        quizzes[currentFolder] = quizData;
        await saveQuizzes(); // Save updated data

        alert("Quiz uploaded and saved successfully!");
      } else {
        alert("Invalid JSON format! Ensure each question has 'question', 'options', and 'correctIndex'.");
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
      const transaction = db.transaction(['quizzes'], 'readwrite');
      const store = transaction.objectStore('quizzes');
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


// Handle answer selection
async function selectAnswer(selectedIndex) {
  // Calculate time taken for this question
  const endTime = Date.now();
  const timeTaken = (endTime - questionStartTime) / 1000; // in seconds
  questionTimes.push(timeTaken);
  totalQuizTime += timeTaken;
  const question = currentQuiz[currentQuestionIndex];
  if (selectedIndex === question.correctIndex) {
    score++;
  } else {
    question.timesIncorrect = (question.timesIncorrect || 0) + 1;
    question.selectedAnswer = question.options[selectedIndex]; // Track selected answer
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
          <li class="${isSlow ? 'slow-time' : 'fast-time'}">
              Q${index + 1}: ${timeTaken.toFixed(1)}s
              ${isSlow ? '⏱️' : '⚡'}
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
              <p><span style="color: red;">❌ Your Answer:</span> ${item.selectedAnswer}</p>
              <p><span style="color: green;">✔ Correct Answer:</span> ${item.options[item.correctIndex]}</p>
              <p><strong>Explanation:</strong> ${item.explanation || "No explanation provided."}</p>
              <hr>
          `;
          incorrectContainer.appendChild(div);
      });
  }

  if (incorrectQuestions.length > 0 && quizMode === "complete") {
      await storeIncorrectQuestions();
  }
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
  flashcardContainer.innerHTML = "";  // Clear previous content
  flashcardContainer.classList.remove("hidden");

  // Get questions from the selected folder
  const questions = quizzes[currentFolder];

  // Create flashcards
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

    // Add flip functionality
    flashcard.addEventListener("click", () => {
      flashcard.classList.toggle("flipped");
    });

    // Highlight incorrect attempts
    if (question.timesIncorrect > 0) {
      const incorrectText = flashcard.querySelector(".flashcard-content p:last-child");
      incorrectText.classList.add("incorrect-attempt");
    }

    flashcardContainer.appendChild(flashcard);
  });
}

// Function to clear memory (reset timesIncorrect to 0 for all questions)
async function clearMemory() {
  if (confirm("Are you sure you want to clear all memory? This will reset all 'timesIncorrect' to 0.")) {
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
      alert("Memory cleared! All 'timesIncorrect' values have been reset to 0.");

      // If flashcards are currently displayed, refresh them
      if (!document.getElementById("flashcardContainer").classList.contains("hidden")) {
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
    const timeDisplay = document.getElementById('time-display');
    
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 30) { // Warning when 30 seconds left
        timeDisplay.classList.add('warning');
    } else {
        timeDisplay.classList.remove('warning');
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
    document.getElementById('current-question').textContent = '1';
    document.getElementById('total-questions').textContent = currentQuiz.length;

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
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = currentQuiz.length;    
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

// Update goHome to clear timer
function goHome() {
  // Clear timer and reset states
  if (quizTimer) {
      clearInterval(quizTimer);
      quizTimer = null;
  }
  
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  quizMode = "";
  currentQuiz = [];
  timerEnabled = false;
  questionTimes = [];
  totalQuizTime = 0;

  // Hide containers
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");
  
  // Reset UI elements
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
  
  document.getElementById("flashcardContainer").innerHTML = "";
  
  // Show quiz options if a folder is selected
  if (currentFolder) {
      document.getElementById("quizOptions").classList.remove("hidden");
      document.getElementById("totalQuestions").textContent = quizzes[currentFolder].length;
      document.getElementById("endIndex").value = quizzes[currentFolder].length;
  } else {
      document.getElementById("quizOptions").classList.add("hidden");
  }
  
  // Reset timer display
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
      timeDisplay.textContent = "00:00";
      timeDisplay.classList.remove('warning');
  }
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
  container.dataset.quizOptionsVisible = !quizOptions.classList.contains("hidden");
  
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
          <p><strong>Times Incorrect:</strong> ${question.timesIncorrect || 0}</p>
          <p><strong>Last Selected Answer:</strong> ${question.selectedAnswer || 'N/A'}</p>
          <p><strong>Correct Answer:</strong> ${question.options[question.correctIndex]}</p>
          <p><strong>Explanation:</strong> ${question.explanation || 'No explanation provided.'}</p>
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

