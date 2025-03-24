// Global Variables
let quizzes = {}; // Stores all quiz data
let currentQuiz = []; // Stores the current quiz being taken
let currentFolder = ""; // Stores the currently selected folder
let currentQuestionIndex = 0; // Tracks the current question index in the quiz
let incorrectQuestions = []; // Stores incorrectly answered questions
let score = 0; // Tracks the user's score
let quizMode = ""; // Tracks the current quiz mode (e.g., "complete" or "difficult")

// Load quizzes from localStorage on page load
document.addEventListener("DOMContentLoaded", () => {
  quizzes = JSON.parse(localStorage.getItem("quizzes")) || {};
  updateFolderList();
});

// Toggle the mobile menu
function toggleMenu() {
  const menu = document.getElementById("mobile-menu");
  menu.classList.toggle("show");
}

// Save quizzes to localStorage
function saveToLocalStorage() {
  localStorage.setItem("quizzes", JSON.stringify(quizzes));
}

// Create a new folder
function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (folderName && !quizzes[folderName]) {
    quizzes[folderName] = [];
    quizzes[`${folderName}_Incorrect`] = []; // Create a folder for incorrect questions
    saveToLocalStorage();
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
  if (currentFolder) {
    document.getElementById("quizOptions").classList.remove("hidden"); // Show quiz mode selection
    let totalQuestions = quizzes[currentFolder]?.length || 0;
    document.getElementById("totalQuestions").textContent = totalQuestions;
    document.getElementById("startIndex").max = totalQuestions;
    document.getElementById("endIndex").max = totalQuestions;
    document.getElementById("endIndex").value = totalQuestions; // Set default to the last index
  }
}

// Handle file upload
function handleFileUpload(event) {
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
  reader.onload = function () {
    try {
      const quizData = JSON.parse(reader.result);

      if (Array.isArray(quizData) && quizData.every(q => "question" in q && "options" in q && "correctIndex" in q)) {
        // Ensure all questions have an "explanation" key
        quizData.forEach(q => {
          if (!("explanation" in q)) {
            q.explanation = ""; // Set to empty string if missing
          }
        });

        // Store in quizzes object and save to localStorage
        quizzes[currentFolder] = quizData;
        saveToLocalStorage(); // Save updated data

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


// Clear all quizzes from localStorage
function clearLocalStorage() {
  if (confirm("Are you sure you want to clear all stored quizzes?")) {
    localStorage.removeItem("quizzes");
    quizzes = {};
    updateFolderList();
    alert("All quizzes cleared!");
  }
}

// Store incorrect questions in the _Incorrect folder
function storeIncorrectQuestions() {
  if (incorrectQuestions.length > 0) {
    const incorrectFolder = `${currentFolder}_Incorrect`;
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
    saveToLocalStorage();
  }
}

// Shuffle the current quiz
function shuffleQuiz() {
  currentQuiz = currentQuiz.sort(() => Math.random() - 0.5);
}

// Show difficult questions (sorted by timesIncorrect)
function showDifficultQuestions() {
  const incorrectFolder = `${currentFolder}_Incorrect`;
  if (!quizzes[incorrectFolder] || quizzes[incorrectFolder].length === 0) {
    alert("No difficult questions found.");
    return;
  }

  const sortedQuestions = quizzes[incorrectFolder].sort(
    (a, b) => (b.timesIncorrect || 0) - (a.timesIncorrect || 0)
  );

  const quizContainer = document.getElementById("quizContainer");
  const optionsDiv = document.getElementById("options");
  quizContainer.classList.remove("hidden");
  optionsDiv.innerHTML = "";

  sortedQuestions.forEach((question, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "difficult-question";
    questionDiv.innerHTML = `
      <p><strong>Question ${index + 1}:</strong> ${question.question}</p>
      <p><strong>Times Incorrect:</strong> ${question.timesIncorrect || 0}</p>
      <p><strong>Correct Answer:</strong> ${question.options[question.correctIndex]}</p>
      <hr>
    `;
    optionsDiv.appendChild(questionDiv);
  });

  // Add a button to take a quiz from difficult questions
  const quizButton = document.createElement("button");
  quizButton.className = "quiz-btn";
  quizButton.textContent = "Take Quiz from Difficult Questions";
  quizButton.onclick = () => startDifficultQuiz(sortedQuestions);
  optionsDiv.appendChild(quizButton);

  // Add a home button
  const homeButton = document.createElement("button");
  homeButton.className = "quiz-btn";
  homeButton.textContent = "Home";
  homeButton.onclick = goHome;
  optionsDiv.appendChild(homeButton);

  document.getElementById("quizOptions").classList.add("hidden");
}

// Start a quiz from difficult questions
function startDifficultQuiz(difficultQuestions) {
  if (!difficultQuestions || difficultQuestions.length === 0) {
    alert("No difficult questions available!");
    return;
  }

  const startIndex = parseInt(prompt("Enter start index (1 to " + difficultQuestions.length + "):")) - 1;
  const endIndex = parseInt(prompt("Enter end index (1 to " + difficultQuestions.length + "):"));

  if (
    isNaN(startIndex) ||
    isNaN(endIndex) ||
    startIndex < 0 ||
    endIndex > difficultQuestions.length ||
    startIndex >= endIndex
  ) {
    alert(`Invalid range! Choose between 1 and ${difficultQuestions.length}.`);
    return;
  }

  currentQuiz = difficultQuestions.slice(startIndex, endIndex);
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];
  document.getElementById("quizContainer").classList.remove("hidden");
  document.getElementById("quizOptions").classList.add("hidden");
  loadQuestion();
}

// Go back to the home screen
function goHome() {
    // Hide the quiz container
    document.getElementById("quizContainer").classList.add("hidden");

    // Hide the flashcard container
    const flashcardContainer = document.getElementById("flashcardContainer");
    flashcardContainer.classList.add("hidden");
    flashcardContainer.innerHTML = ""; // Clear all flashcards

    // Show the quiz options (home screen)
    document.getElementById("quizOptions").classList.remove("hidden");

    // Update the folder list
    updateFolderList();
}
// Go back to the home screen

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
function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    quizzes = JSON.parse(e.target.result);
    saveToLocalStorage();
    updateFolderList();
    alert("Data restored successfully!");
  };
  reader.readAsText(file);
}

// Start the quiz
function startQuiz(mode) {
  if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
      alert("Please select a valid folder with questions!");
      return;
  }

  let totalQuestions = quizzes[currentFolder].length;
  let startIndex = parseInt(document.getElementById("startIndex").value) - 1;
  let endIndex = parseInt(document.getElementById("endIndex").value);

  if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 0 || endIndex > totalQuestions || startIndex >= endIndex) {
      alert(`Invalid range! Choose between 1 and ${totalQuestions}.`);
      return;
  }

  // 🛑 **Reset Quiz State to avoid showing previous data**
  currentQuestionIndex = 0;
  score = 0;
  incorrectQuestions = [];

  // 🛑 **Clear previous results & reset UI**
  document.getElementById("quizContainer").innerHTML = `
      <h2 id="question-text">Question will appear here</h2>
      <div id="options"></div>
      <p id="score-text"></p>
  `;

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

  loadQuestion(); // 🛑 **Now it starts fresh**
}


// Load the current question
function loadQuestion() {
  if (currentQuestionIndex >= currentQuiz.length) {
    showResults();
    return;
  }
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

// Handle answer selection
function selectAnswer(selectedIndex) {
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
    showResults();
  }
}

// Show quiz results
function showResults() {
  document.getElementById("quizContainer").innerHTML = `
      <h2>Quiz Completed!</h2>
      <p>Your Score: ${score} / ${currentQuiz.length}</p>
      <h3>Incorrect Questions:</h3>
      <div id="incorrect-answers"></div>
      <button class="quiz-btn" onclick="restartQuiz()">Restart Quiz</button>
      <button class="quiz-btn" onclick="goHome()">Home</button>
  `;

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
      storeIncorrectQuestions();
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








function showFlashcards() {
  if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
      alert("Please select a folder with questions first!");
      return;
  }

  // Hide quiz elements
  document.getElementById("quizContainer").classList.add("hidden");
  document.getElementById("quizOptions").classList.add("hidden");

  // Show the flashcard container
  const flashcardContainer = document.getElementById("flashcardContainer");
  flashcardContainer.innerHTML = ""; // Clear previous content
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
function clearMemory() {
    if (confirm("Are you sure you want to clear all memory? This will reset all 'timesIncorrect' to 0.")) {
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

        // Save the updated data to localStorage
        saveToLocalStorage();

        // Notify the user
        alert("Memory cleared! All 'timesIncorrect' values have been reset to 0.");

        // If flashcards are currently displayed, refresh them
        if (!document.getElementById("flashcardContainer").classList.contains("hidden")) {
            showFlashcards();
        }
    }
}
