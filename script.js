let quizzes = {};
let currentQuiz = [];
let currentFolder = "";
let currentQuestionIndex = 0;
let incorrectQuestions = [];
let score = 0;
let quizMode = ""; // Add this at the top with other global variables

// Sidebar Toggle
function toggleMenu() {
    const menu = document.getElementById("mobile-menu");
    menu.classList.toggle("show");
}



// Save to Local Storage
function saveToLocalStorage() {
    localStorage.setItem("quizzes", JSON.stringify(quizzes));
}

// Create Folder
// function createFolder() {
//     const folderName = prompt("Enter folder name:");
//     if (folderName && !quizzes[folderName]) {
//         quizzes[folderName] = [];
//         saveToLocalStorage();
//         updateFolderList();
//     }
// }

// Update Folder Dropdown
// function updateFolderList() {
//     const folderSelect = document.getElementById("folderSelect");
//     folderSelect.innerHTML = '<option value="" disabled selected>Select a folder</option>';
//     Object.keys(quizzes).forEach(folder => {
//         const option = document.createElement("option");
//         option.value = folder;
//         option.textContent = folder;
//         folderSelect.appendChild(option);
//     });
// }

// Load stored quizzes on page load
document.addEventListener("DOMContentLoaded", () => {
    quizzes = JSON.parse(localStorage.getItem("quizzes")) || {};  // Ensure quizzes are retrieved
    updateFolderList();
});

// Select Folder
// function selectFolder() {
//     currentFolder = document.getElementById("folderSelect").value;
//     if (currentFolder) {
//         document.getElementById("startQuizBtn").classList.remove("hidden");
//     }
// }

// Upload Quiz JSON
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!currentFolder) {
        alert("Select a folder first!");
        return;
    }
    const reader = new FileReader();
    reader.onload = function() {
        try {
            const quizData = JSON.parse(reader.result);
            if (Array.isArray(quizData)) {
                quizzes[currentFolder] = quizData;
                saveToLocalStorage();  // Save updated quizzes
                alert("Quiz uploaded successfully!");
            } else {
                alert("Invalid JSON format!");
            }
        } catch (e) {
            alert("Error parsing JSON!");
        }
    };
    reader.readAsText(file);
}

// Start Quiz
// function startQuiz() {
//     if (!currentFolder || !quizzes[currentFolder]) {
//         alert("Please select a valid folder!");
//         return;
//     }

//     currentQuiz = quizzes[currentFolder];

//     if (currentQuiz.length === 0) {
//         alert("The selected quiz is empty!");
//         return;
//     }

//     currentQuestionIndex = 0;
//     score = 0;
//     incorrectQuestions = [];

//     document.getElementById("quizContainer").classList.remove("hidden");
//     document.getElementById("startQuizBtn").classList.add("hidden");

//     loadQuestion();
// }

// Load Question
// function loadQuestion() {
//     if (currentQuestionIndex >= currentQuiz.length) {
//         showResults();
//         return;
//     }
//     const questionData = currentQuiz[currentQuestionIndex];
//     document.getElementById("question-text").textContent = questionData.question;
//     const optionsContainer = document.getElementById("options");
//     optionsContainer.innerHTML = "";
//     questionData.options.forEach((option, index) => {
//         const button = document.createElement("button");
//         button.classList.add("option-btn");
//         button.textContent = option;
//         button.onclick = () => selectAnswer(index);
//         optionsContainer.appendChild(button);
//     });
// }

// Select Answer
// function selectAnswer(selectedIndex) {
//     const questionData = currentQuiz[currentQuestionIndex];

//     if (questionData.correctIndex !== selectedIndex) {
//         incorrectQuestions.push({
//             question: questionData.question,
//             selectedAnswer: questionData.options[selectedIndex],
//             correctAnswer: questionData.options[questionData.correctIndex]
//         });
//     } else {
//         score++;
//     }

//     currentQuestionIndex++;
//     loadQuestion();
// }

// Show Results
// function showResults() {
//     document.getElementById("quizContainer").innerHTML = `
//         <h2>Quiz Completed!</h2>
//         <p>Your Score: ${score} / ${currentQuiz.length}</p>
//         <h3>Incorrect Questions:</h3>
//         <div id="incorrect-answers"></div>
//         <button class="quiz-btn" onclick="restartQuiz()">Restart Quiz</button>
//     `;

//     const incorrectContainer = document.getElementById("incorrect-answers");
//     if (incorrectQuestions.length === 0) {
//         incorrectContainer.innerHTML = "<p>Great job! No incorrect answers 🎉</p>";
//     } else {
//         incorrectQuestions.forEach(item => {
//             const div = document.createElement("div");
//             div.classList.add("incorrect-item");
//             div.innerHTML = `
//                 <p><strong>Question:</strong> ${item.question}</p>
//                 <p><span style="color: red;">❌ Your Answer:</span> ${item.selectedAnswer}</p>
//                 <p><span style="color: green;">✔ Correct Answer:</span> ${item.correctAnswer}</p>
//                 <hr>
//             `;
//             incorrectContainer.appendChild(div);
//         });
//     }
// }

// Restart Quiz
// function restartQuiz() {
//     currentQuestionIndex = 0;
//     score = 0;
//     incorrectQuestions = [];
//     document.getElementById("quizContainer").innerHTML = `
//         <h2 id="question-text">Question will appear here</h2>
//         <div id="options"></div>
//     `;
//     startQuiz();
// }

// Clear Local Storage
function clearLocalStorage() {
    if (confirm("Are you sure you want to clear all stored quizzes?")) {
        localStorage.removeItem("quizzes");
        quizzes = {};
        updateFolderList();
        alert("All quizzes cleared!");
    }
}

// Store Incorrect Questions
function storeIncorrectQuestions() {
    if (!currentFolder) return;

    if (!quizzes["Incorrect"]) {
        quizzes["Incorrect"] = [];
    }
    
    quizzes["Incorrect"].push(...incorrectQuestions);
    saveToLocalStorage(); // Save incorrect questions
    alert("Incorrect questions saved!");
}

// Shuffle Quiz
function shuffleQuiz() {
    currentQuiz = currentQuiz.sort(() => Math.random() - 0.5);
}

// Download Data
function downloadData() {
    const blob = new Blob([JSON.stringify(quizzes, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "quiz_data.json";
    link.click();
}

// Restore Data
function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        quizzes = JSON.parse(e.target.result);
        saveToLocalStorage(); // Save restored data
        updateFolderList();
        alert("Data restored successfully!");
    };
    reader.readAsText(file);
}

// Initialize
updateFolderList();









// Save to Local Storage
function saveToLocalStorage() {
    localStorage.setItem("quizzes", JSON.stringify(quizzes));
}

// Create Folder
function createFolder() {
    const folderName = prompt("Enter folder name:");
    if (folderName && !quizzes[folderName]) {
        quizzes[folderName] = [];
        quizzes[`${folderName}_Incorrect`] = []; // Store incorrect answers separately
        saveToLocalStorage();
        updateFolderList();
    }
}

// Update Folder Dropdown
function updateFolderList() {
    const folderSelect = document.getElementById("folderSelect");
    folderSelect.innerHTML = '<option value="" disabled selected>Select a folder</option>';
    Object.keys(quizzes).forEach(folder => {
        if (!folder.includes("_Incorrect")) { // Hide incorrect storage
            const option = document.createElement("option");
            option.value = folder;
            option.textContent = folder;
            folderSelect.appendChild(option);
        }
    });
}

document.addEventListener("DOMContentLoaded", updateFolderList);

// Select Folder
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



// Start Quiz
function startQuiz(mode) {
        quizMode = mode; // Set the quiz mode

    if (!currentFolder || !quizzes[currentFolder]) {
        alert("Please select a valid folder!");
        return;
    }

    let totalQuestions = quizzes[currentFolder].length;
    let startIndex = parseInt(document.getElementById("startIndex").value) - 1;
    let endIndex = parseInt(document.getElementById("endIndex").value);

    if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 0 || endIndex > totalQuestions || startIndex >= endIndex) {
        alert(`Invalid range! Choose between 1 and ${totalQuestions}.`);
        return;
    }

    quizMode = mode;
    if (mode === "difficult") {
        currentQuiz = quizzes[`${currentFolder}_Incorrect`] || [];
        if (currentQuiz.length === 0) {
            alert("No difficult questions stored yet. Try the complete quiz first.");
            return;
        }
    } else {
        currentQuiz = quizzes[currentFolder].slice(startIndex, endIndex);  // Extract selected range
    }

    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    document.getElementById("quizContainer").classList.remove("hidden");
    document.getElementById("quizOptions").classList.add("hidden");
    loadQuestion();
}

// function selectAnswer(selectedIndex) {
//     const questionData = currentQuiz[currentQuestionIndex];

//     if (questionData.correctIndex !== selectedIndex) {
//         // Initialize or update incorrect count
//         let incorrectData = JSON.parse(localStorage.getItem("incorrectCounts")) || {};
//         let questionKey = `${currentFolder}_${questionData.question}`;

//         incorrectData[questionKey] = (incorrectData[questionKey] || 0) + 1; // Increment count
//         localStorage.setItem("incorrectCounts", JSON.stringify(incorrectData));

//         // Store incorrect question details
//         incorrectQuestions.push({
//             question: questionData.question,
//             options: questionData.options,
//             correctIndex: questionData.correctIndex
//         });
//     } else {
//         score++;
//     }

//     currentQuestionIndex++;
//     loadQuestion();
// }

function selectAnswer(selectedIndex) {
    const questionData = currentQuiz[currentQuestionIndex];

    if (questionData.correctIndex !== selectedIndex) {
        // Initialize or update incorrect count
        let incorrectData = JSON.parse(localStorage.getItem("incorrectCounts")) || {};
        let questionKey = `${currentFolder}_${questionData.question}`;

        incorrectData[questionKey] = (incorrectData[questionKey] || 0) + 1; // Increment count
        localStorage.setItem("incorrectCounts", JSON.stringify(incorrectData));

        // Store incorrect question details
        incorrectQuestions.push({
            question: questionData.question,
            selectedAnswer: questionData.options[selectedIndex], // Add this line
            options: questionData.options,
            correctIndex: questionData.correctIndex
        });
    } else {
        score++;
    }

    currentQuestionIndex++;
    loadQuestion();
}

function showDifficultQuestions() {
    if (!currentFolder) {
        alert("Please select a folder first!");
        return;
    }

    let incorrectData = JSON.parse(localStorage.getItem("incorrectCounts")) || {};
    let allQuestions = quizzes[currentFolder] || [];

    // Filter questions that were answered incorrectly at least once
    let difficultQuestions = allQuestions.map(q => {
        let key = `${currentFolder}_${q.question}`;
        return { ...q, wrongCount: incorrectData[key] || 0 };
    }).filter(q => q.wrongCount > 0);

    // Sort by most incorrect attempts
    difficultQuestions.sort((a, b) => b.wrongCount - a.wrongCount);

    if (difficultQuestions.length === 0) {
        alert("No difficult questions found. Try the full quiz first!");
        return;
    }

    // Store difficult questions globally for later use
    localStorage.setItem("difficultQuiz", JSON.stringify(difficultQuestions));

    // Display Difficult Questions with Range Selection
    document.getElementById("quizContainer").innerHTML = `
        <h2>Most Difficult Questions</h2>
        <p>Total Difficult Questions: <span id="difficultTotal">${difficultQuestions.length}</span></p>
        <label>Start Index: <input type="number" id="difficultStart" min="1" max="${difficultQuestions.length}" value="1"></label>
        <label>End Index: <input type="number" id="difficultEnd" min="1" max="${difficultQuestions.length}" value="${difficultQuestions.length}"></label>
        <ul id="difficult-list"></ul>
        <button class="quiz-btn" onclick="startDifficultQuiz()">Attempt These Questions</button>
    `;

    const listContainer = document.getElementById("difficult-list");
    difficultQuestions.forEach((q, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <p><strong>Q${index + 1}:</strong> ${q.question}</p>
            <p><span style="color: red;">❌ Wrong Attempts:</span> ${q.wrongCount}</p>
            <hr>
        `;
        listContainer.appendChild(li);
    });
}


// Load Question
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

function startDifficultQuiz() {
    
    let difficultQuiz = JSON.parse(localStorage.getItem("difficultQuiz")) || [];
    if (difficultQuiz.length === 0) {
        alert("No difficult questions found!");
        return;
    }

    let totalDifficult = difficultQuiz.length;
    let startIndex = parseInt(document.getElementById("difficultStart").value) - 1;
    let endIndex = parseInt(document.getElementById("difficultEnd").value);

    if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 0 || endIndex > totalDifficult || startIndex >= endIndex) {
        alert(`Invalid range! Choose between 1 and ${totalDifficult}.`);
        return;
    }

    // Apply range filter to difficult questions
    currentQuiz = difficultQuiz.slice(startIndex, endIndex);
    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    
    document.getElementById("quizContainer").classList.remove("hidden");
    loadQuestion();
}












// Select Answer


// function selectAnswer(selectedIndex) {
//     const questionData = currentQuiz[currentQuestionIndex];

//     if (questionData.correctIndex !== selectedIndex) {
//         incorrectQuestions.push({
//             question: questionData.question,
//             selectedAnswer: questionData.options[selectedIndex],
//             correctAnswer: questionData.options[questionData.correctIndex]
//         });
//     } else {
//         score++;
//     }

//     currentQuestionIndex++;
//     loadQuestion();
// }



// Show Results
// function showResults() {
//     document.getElementById("quizContainer").innerHTML = `
//         <h2>Quiz Completed!</h2>
//         <p>Your Score: ${score} / ${currentQuiz.length}</p>
//         <h3>Incorrect Questions:</h3>
//         <div id="incorrect-answers"></div>
//         <button class="quiz-btn" onclick="restartQuiz()">Restart Quiz</button>
//     `;

//     const incorrectContainer = document.getElementById("incorrect-answers");
//     if (incorrectQuestions.length === 0) {
//         incorrectContainer.innerHTML = "<p>Great job! No incorrect answers 🎉</p>";
//     } else {
//         incorrectQuestions.forEach(item => {
//             const div = document.createElement("div");
//             div.classList.add("incorrect-item");
//             div.innerHTML = `
//                 <p><strong>Question:</strong> ${item.question}</p>
//                 <p><span style="color: red;">❌ Your Answer:</span> ${item.selectedAnswer}</p>
//                 <p><span style="color: green;">✔ Correct Answer:</span> ${item.options[item.correctIndex]}</p>
//                 <hr>
//             `;
//             incorrectContainer.appendChild(div);
//         });
//     }

//     // Save Incorrect Questions for "Difficult" mode
//     if (incorrectQuestions.length > 0 && quizMode === "complete") {
//         quizzes[`${currentFolder}_Incorrect`] = incorrectQuestions;
//         saveToLocalStorage();
//     }
// }


function showResults() {
    document.getElementById("quizContainer").innerHTML = `
        <h2>Quiz Completed!</h2>
        <p>Your Score: ${score} / ${currentQuiz.length}</p>
        <h3>Incorrect Questions:</h3>
        <div id="incorrect-answers"></div>
        <button class="quiz-btn" onclick="restartQuiz()">Restart Quiz</button>
    `;

    const incorrectContainer = document.getElementById("incorrect-answers");
    if (incorrectQuestions.length === 0) {
        incorrectContainer.innerHTML = "<p>Great job! No incorrect answers 🎉</p>";
    } else {
        incorrectQuestions.forEach(item => {
            const div = document.createElement("div");
            div.classList.add("incorrect-item");
            div.innerHTML = `
                <p><strong>Question:</strong> ${item.question}</p>
                <p><span style="color: red;">❌ Your Answer:</span> ${item.selectedAnswer}</p>
                <p><span style="color: green;">✔ Correct Answer:</span> ${item.options[item.correctIndex]}</p>
                <hr>
            `;
            incorrectContainer.appendChild(div);
        });
    }

    // Save Incorrect Questions for "Difficult" mode
    if (incorrectQuestions.length > 0 && quizMode === "complete") {
        quizzes[`${currentFolder}_Incorrect`] = incorrectQuestions;
        saveToLocalStorage();
    }
}
// Restart Quiz
function restartQuiz() {
    document.getElementById("quizContainer").innerHTML = `
        <h2 id="question-text">Question will appear here</h2>
        <div id="options"></div>
    `;
        quizMode = ""; // Reset quiz mode

    startQuiz(quizMode);
}

// Initialize
updateFolderList();
