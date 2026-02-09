// Update rapid.js with range-specific flashcards
let isRapidRound = false;
let currentRapidTimer = null;

let rapidRoundSettings = {
  folder: "",
  startIndex: 1,
  endIndex: 10,
  studyTime: 5, // minutes
  quizTime: 5 // minutes
};
let rapidRoundActive = false;
let rapidRoundPhase = ""; // "study" or "quiz"
let rapidRoundControls = null;

function startRapidRound() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'rapid-round-modal';
  modal.innerHTML = `
    <div class="rapid-round-dialog">
      <h3>Rapid Round Settings</h3>
      
      <div class="form-group">
        <label>Folder:</label>
        <select id="rapidFolderSelect">
          ${Object.keys(quizzes).filter(f => !f.includes('_Incorrect')).map(f => 
            `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label>Question Range:</label>
        <div class="range-inputs">
          <input type="number" id="rapidStartIndex" min="1" value="1" placeholder="Start">
          <span>to</span>
          <input type="number" id="rapidEndIndex" min="1" value="10" placeholder="End">
        </div>
      </div>
      
      <div class="form-group">
        <label>Study Time (minutes):</label>
        <input type="number" id="rapidStudyTime" min="0.1" step="0.1" value="5">
      </div>
      
      <div class="form-group">
        <label>Quiz Time (minutes):</label>
        <input type="number" id="rapidQuizTime" min="0.1" step="0.1" value="5">
      </div>
      
      <div class="button-group">
        <button class="quiz-btn" onclick="beginRapidRound()">Begin</button>
        <button class="quiz-btn cancel-btn" onclick="document.querySelector('.rapid-round-modal').remove()">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set current folder if one is selected
  if (currentFolder) {
    const select = modal.querySelector('#rapidFolderSelect');
    select.value = currentFolder;
    
    // Set max for end index
    const endIndexInput = modal.querySelector('#rapidEndIndex');
    endIndexInput.max = quizzes[currentFolder].length;
    endIndexInput.value = Math.min(10, quizzes[currentFolder].length);
  }
}

function beginRapidRound() {
  const modal = document.querySelector('.rapid-round-modal');
  if (!modal) return;
  
  // Get settings from modal - parse as float instead of int
  const folderSelect = modal.querySelector('#rapidFolderSelect');
  const startIndex = parseInt(modal.querySelector('#rapidStartIndex').value);
  const endIndex = parseInt(modal.querySelector('#rapidEndIndex').value);
  const studyTime = parseFloat(modal.querySelector('#rapidStudyTime').value);
  const quizTime = parseFloat(modal.querySelector('#rapidQuizTime').value);
  
  // Validate inputs
  if (!folderSelect.value || isNaN(startIndex) || isNaN(endIndex) || 
      isNaN(studyTime) || isNaN(quizTime) || startIndex > endIndex ||
      studyTime <= 0 || quizTime <= 0) {
    alert("Please enter valid settings!");
    return;
  }
  
  // Save settings (converting minutes to seconds)
  rapidRoundSettings = {
    folder: folderSelect.value,
    startIndex,
    endIndex,
    studyTime,  // Store original decimal value for display
    quizTime,   // Store original decimal value for display
    studySeconds: Math.floor(studyTime * 60),  // Convert to seconds
    quizSeconds: Math.floor(quizTime * 60)     // Convert to seconds
  };
  
  // Remove modal
  modal.remove();
  
  // Start rapid round in study phase
  startRapidStudyPhase();
}

function createRapidRoundControls() {
  // Remove existing controls if they exist
  if (rapidRoundControls) {
    rapidRoundControls.remove();
  }
  
  // Create new controls
  rapidRoundControls = document.createElement('div');
  rapidRoundControls.className = 'rapid-round-controls';
  rapidRoundControls.innerHTML = `
    <button class="rapid-round-btn end-btn" onclick="endRapidRound()">End Rapid Round</button>
  `;
  
  document.body.appendChild(rapidRoundControls);
}

function endRapidRound() {
  if (confirm("Are you sure you want to end the Rapid Round? Your progress will be saved.")) {
    cleanupRapidRound();
    goHome();
  }
}

function cleanupRapidRound() {
  if (currentRapidTimer) {
    clearInterval(currentRapidTimer);
    currentRapidTimer = null;
  }

  const timerDisplay = document.getElementById('rapidTimerDisplay');
  if (timerDisplay) timerDisplay.remove();

  if (rapidRoundControls) {
    rapidRoundControls.remove();
    rapidRoundControls = null;
  }

  rapidRoundActive = false;
  rapidRoundPhase = "";
  isRapidRound = false;
}



function startRapidQuizPhase() {
  rapidRoundPhase = "quiz";
  
  // Make sure quiz container is visible
  document.getElementById("quizContainer").classList.remove("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");
  
  // Start quiz with the same range
  document.getElementById('startIndex').value = rapidRoundSettings.startIndex;
  document.getElementById('endIndex').value = rapidRoundSettings.endIndex;
  
  // Start quiz with timer
  startQuiz('complete');
  
  // Start quiz timer using seconds
  currentRapidTimer = startRapidTimer(rapidRoundSettings.quizSeconds, "Quiz Time Left:", () => {
    // When quiz time ends, show results
    showRapidRoundResults();
  });
}


function startRapidStudyPhase() {
  rapidRoundActive = true;
  rapidRoundPhase = "study";
  isRapidRound = true;

  currentFolder = rapidRoundSettings.folder;

  document.getElementById('startIndex').value = rapidRoundSettings.startIndex;
  document.getElementById('endIndex').value = rapidRoundSettings.endIndex;

  createRapidRoundControls();
  showRapidFlashcards();

  currentRapidTimer = startRapidTimer(
    rapidRoundSettings.studySeconds,
    "Study Time Left:",
    startRapidQuizPhase
  );
}


function startRapidQuizPhase() {
  rapidRoundPhase = "quiz";

  document.getElementById("quizContainer").classList.remove("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");

  document.getElementById('startIndex').value = rapidRoundSettings.startIndex;
  document.getElementById('endIndex').value = rapidRoundSettings.endIndex;

  startQuiz('complete'); // timer prompt will be skipped

  currentRapidTimer = startRapidTimer(
    rapidRoundSettings.quizSeconds,
    "Quiz Time Left:",
    showRapidRoundResults
  );
}

// New function to show flashcards for the rapid round range
function showRapidFlashcards() {
  if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
    alert("Please select a valid folder with questions!");
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

  // Get the selected range of questions
  const startIdx = rapidRoundSettings.startIndex - 1; // convert to 0-based index
  const endIdx = rapidRoundSettings.endIndex;
  const questions = quizzes[currentFolder].slice(startIdx, endIdx);
  
  // Initialize timer
  if (!flashcardTimeStats[currentFolder]) {
    flashcardTimeStats[currentFolder] = { totalTime: 0, achievements: [] };
  }
  
  startFlashcardTimer();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Create flashcards for the selected range
  questions.forEach((question, index) => {
    const flashcard = document.createElement("div");
    flashcard.className = "flashcard";
    flashcard.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flashcard-content">
            <div class="flashcard-header">
              <h3>Question ${startIdx + index + 1}</h3>
              <button class="edit-question-btn" data-index="${startIdx + index}">✏️</button>
            </div>
            <p>${question.question}</p>
            <p><strong>Options:</strong></p>
            <ul>
              ${question.options.map(option => `<li>${option}</li>`).join("")}
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
      showEditQuestionForm(startIdx + index, question);
    });
    
    flashcardContainer.appendChild(flashcard);
  });

  encouragementInterval = setInterval(() => {
    if (Math.random() > 0.3) { // 30% chance to show
      showRandomEncouragement();
    }
  }, 140000); // Every ~2 minutes
  
  startFlashcardStudySession(currentFolder);
}

function startRapidTimer(totalSeconds, labelText, onComplete) {
  if (currentRapidTimer) {
    clearInterval(currentRapidTimer);
    currentRapidTimer = null;
  }

  totalSeconds = Math.floor(totalSeconds);

  let timerDisplay = document.getElementById('rapidTimerDisplay');
  if (!timerDisplay) {
    timerDisplay = document.createElement('div');
    timerDisplay.id = 'rapidTimerDisplay';
    timerDisplay.className = 'rapid-timer';
    document.body.appendChild(timerDisplay);
  }

  timerDisplay.innerHTML = `
    <div class="rapid-timer-content">
      <span>${labelText}</span>
      <span id="rapidTimerValue">${formatTime(totalSeconds)}</span>
    </div>
  `;

  let secondsLeft = totalSeconds;
  const timerValue = document.getElementById('rapidTimerValue');

  const timer = setInterval(() => {
    secondsLeft--;
    timerValue.textContent = formatTime(secondsLeft);

    if (secondsLeft <= 30) {
      timerDisplay.classList.add('warning');
    }

    if (secondsLeft <= 0) {
      clearInterval(timer);
      timerDisplay.remove();
      onComplete();
    }
  }, 1000);

  return timer;
}


function showRapidRoundResults() {
  isRapidRound = false;

  if (currentRapidTimer) {
    clearInterval(currentRapidTimer);
    currentRapidTimer = null;
  }

  showResults();
}


let currentRapidTimer = null;

function restartRapidRound() {
  if (currentRapidTimer) {
    clearInterval(currentRapidTimer);
    currentRapidTimer = null;
  }
  
  // Reset quiz state
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  questionTimes = [];
  totalQuizTime = 0;
  
  // Clear any existing timer displays
  const timerDisplay = document.getElementById('rapidTimerDisplay');
  if (timerDisplay) timerDisplay.remove();
  
  // Hide quiz container and show flashcards again
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("flashcardContainer").classList.add("hidden");
  
  // Start again from study phase
  startRapidStudyPhase();
}

// Update the goHome function in script.js to handle rapid round cleanup
// Add this at the beginning of the goHome function:


// Helper function to format time as MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
