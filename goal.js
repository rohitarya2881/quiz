// Global variables for goal tracking
let folderGoals = JSON.parse(localStorage.getItem('folderGoals')) || {};
let dailyProgress = JSON.parse(localStorage.getItem('dailyProgress')) || {};

// Function to set folder goals
function setFolderGoals() {
    const folderNames = Object.keys(quizzes).filter(f => !f.includes('_Incorrect'));
    if (folderNames.length === 0) {
      alert("No folders available. Please create folders first.");
      return;
    }
  
    let selectedFolders = [];
    let questionsPerDay = 10;
    
    // Create dialog for folder selection
    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    dialog.style.top = '0';
    dialog.style.left = '0';
    dialog.style.width = '100%';
    dialog.style.height = '100%';
    dialog.style.backgroundColor = 'rgba(0,0,0,0.5)';
    dialog.style.display = 'flex';
    dialog.style.justifyContent = 'center';
    dialog.style.alignItems = 'center';
    dialog.style.zIndex = '1000';
    
    // Get current goals for pre-selection
    const currentGoals = Object.keys(folderGoals);
    
    dialog.innerHTML = `
      <div style="background: #0D1117; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <h3>Manage Daily Goals</h3>
        <p>Select folders and set daily question targets:</p>
        
        <div style="margin: 15px 0;">
          <label>Questions per folder per day: 
            <input type="number" id="goalQuestionsInput" min="1" value="10" style="width: 60px;">
          </label>
        </div>
        
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 15px;">
          ${folderNames.map(folder => `
            <div style="margin: 5px 0; display: flex; align-items: center;">
              <input type="checkbox" id="folder-${folder}" value="${folder}" 
                     ${currentGoals.includes(folder) ? 'checked' : ''}>
              <label for="folder-${folder}" style="flex-grow: 1;">${folder}</label>
              ${currentGoals.includes(folder) ? `
                <span style="color: #aaa; font-size: 0.9em; margin-left: 10px;">
                  Current: ${folderGoals[folder].dailyQuestions} questions
                </span>
              ` : ''}
            </div>
          `).join('')}
        </div>
        
        <div style="display: flex; justify-content: space-between;">
          <button id="saveGoalsBtn" style="padding: 8px 15px; background: #4a6fa5; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Changes</button>
          <button id="removeAllBtn" style="padding: 8px 15px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove All Goals</button>
          <button id="cancelGoalsBtn" style="padding: 8px 15px; background: #ddd; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Handle save button
    dialog.querySelector('#saveGoalsBtn').addEventListener('click', () => {
      questionsPerDay = parseInt(document.getElementById('goalQuestionsInput').value) || 10;
      const selectedCheckboxes = Array.from(dialog.querySelectorAll('input[type="checkbox"]:checked'));
      const unselectedCheckboxes = Array.from(dialog.querySelectorAll('input[type="checkbox"]:not(:checked)'));
      
      // Add new goals for selected folders
      selectedCheckboxes.forEach(el => {
        const folder = el.value;
        if (!folderGoals[folder]) {
          folderGoals[folder] = {
            dailyQuestions: questionsPerDay,
            completedToday: 0,
            lastIndex: 0
          };
        } else {
          // Update question count if already exists
          folderGoals[folder].dailyQuestions = questionsPerDay;
        }
      });
      
      // Remove goals for unselected folders
      unselectedCheckboxes.forEach(el => {
        const folder = el.value;
        if (folderGoals[folder]) {
          delete folderGoals[folder];
        }
      });
      
      localStorage.setItem('folderGoals', JSON.stringify(folderGoals));
      updateGoalDisplay();
      dialog.remove();
      
      const addedCount = selectedCheckboxes.length;
      const removedCount = unselectedCheckboxes.filter(el => currentGoals.includes(el.value)).length;
      
      let message = '';
      if (addedCount > 0 && removedCount > 0) {
        message = `Updated ${addedCount} goal(s) and removed ${removedCount} goal(s)`;
      } else if (addedCount > 0) {
        message = `Saved goals for ${addedCount} folder(s)`;
      } else if (removedCount > 0) {
        message = `Removed ${removedCount} goal(s)`;
      } else {
        message = "No changes made";
      }
      
      showAchievementNotification("Goals Updated", message, "🎯");
      updateFooterGoals();
    });
    
    // Handle remove all button
    dialog.querySelector('#removeAllBtn').addEventListener('click', () => {
      if (confirm("Are you sure you want to remove ALL goals?")) {
        folderGoals = {};
        localStorage.setItem('folderGoals', JSON.stringify(folderGoals));
        updateGoalDisplay();
        dialog.remove();
        showAchievementNotification("Goals Cleared", "All goals have been removed", "🗑️");
        updateFooterGoals();
      }
    });
    
    // Handle cancel button
    dialog.querySelector('#cancelGoalsBtn').addEventListener('click', () => {
      dialog.remove();
    });
  }

// Update goal progress display
function updateGoalDisplay() {
  const goalsContainer = document.getElementById('activeGoals');
  if (!goalsContainer) return;
  
  goalsContainer.innerHTML = '';
  
  Object.keys(folderGoals).forEach(folder => {
    const goal = folderGoals[folder];
    const today = new Date().toISOString().split('T')[0];
    const progress = dailyProgress[today]?.[folder]?.completed || 0;
    
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    goalItem.innerHTML = `
      <div class="goal-folder">${folder}</div>
      <div class="goal-progress-container">
        <div class="goal-progress-bar" style="width: ${Math.min(100, (progress / goal.dailyQuestions) * 100)}%"></div>
      </div>
      <div class="goal-count">${progress}/${goal.dailyQuestions}</div>
    `;
    
    goalItem.addEventListener('click', () => {
      startGoalQuiz(folder);
    });
    
    goalsContainer.appendChild(goalItem);
  });
  
  // Update footer display
  updateFooterGoals();
}
function checkMissedDays() {
    const today = new Date().toISOString().split('T')[0];
    const lastActiveDate = localStorage.getItem('lastActiveDate') || today;
    
    // Only update if we have a new day
    if (today !== lastActiveDate) {
      // We don't penalize for missed days - ranges stay the same
      localStorage.setItem('lastActiveDate', today);
    }
  }
// Start quiz for a specific goal
function startGoalQuiz(folder) {
    if (!folderGoals[folder]) return;
    
    const goal = folderGoals[folder];
    const quiz = quizzes[folder];
    if (!quiz || quiz.length === 0) {
        alert("No questions in this folder!");
        return;
    }
    
    // Reset lastIndex if it's beyond the quiz length
    if (goal.lastIndex >= quiz.length) {
        goal.lastIndex = 0;
    }
    
    // Calculate range based on last completed position
    let start = goal.lastIndex;
    let end = start + goal.dailyQuestions;
    
    // Handle wrapping around if we reach the end
    if (end > quiz.length) {
        end = quiz.length;
    }
    
    // Set the range inputs
    document.getElementById('folderSelect').value = folder;
    selectFolder();
    document.getElementById('startIndex').value = start + 1;
    document.getElementById('endIndex').value = end;
    
    // Show quiz options
    document.getElementById('quizOptions').classList.remove('hidden');
    
    // Scroll to quiz section
    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}
// Track goal progress when quiz is completed
function trackGoalProgress(correctAnswers, totalQuestions) {
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize data structures
    if (!dailyProgress[today]) {
        dailyProgress[today] = {};
    }
    if (!dailyProgress[today][currentFolder]) {
        dailyProgress[today][currentFolder] = {
            completed: 0,
            correct: 0,
            attempts: 0
        };
    }

    // Update progress (using proper number conversion)
    const questionsCompleted = Number(totalQuestions);
    dailyProgress[today][currentFolder].completed += questionsCompleted;
    dailyProgress[today][currentFolder].correct += Number(correctAnswers);
    dailyProgress[today][currentFolder].attempts += 1;

    // Update folder goals if they exist
    if (folderGoals[currentFolder]) {
        // Update completedToday in folderGoals
        folderGoals[currentFolder].completedToday = 
            (folderGoals[currentFolder].completedToday || 0) + questionsCompleted;
        
        // Update the lastIndex to move forward in the question list
        folderGoals[currentFolder].lastIndex += questionsCompleted;
        
        // Save to localStorage (both objects)
        localStorage.setItem('folderGoals', JSON.stringify(folderGoals));
        localStorage.setItem('dailyProgress', JSON.stringify(dailyProgress));
    }

    // Update UI
    updateGoalDisplay();
    renderConsistencyCalendar();
    updateFooterGoals();
}
// Render GitHub-like consistency calendar
function renderConsistencyCalendar() {
    const calendarContainer = document.getElementById('consistencyCalendar');
    if (!calendarContainer) return;

    // Load data with proper fallbacks
    const folderGoals = JSON.parse(localStorage.getItem('folderGoals')) || {};
    const dailyProgress = JSON.parse(localStorage.getItem('dailyProgress')) || {};

    // Debug: Verify data loading
    console.group("[Calendar] Data Verification");
    console.log("Folder Goals:", folderGoals);
    console.log("Daily Progress:", dailyProgress);
    console.groupEnd();

    // Clear previous calendar
    calendarContainer.innerHTML = '';

    // Date range setup (last 6 months)
    const monthsToShow = 6;
    const today = new Date();
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    const startDate = new Date(todayMidnight);
    startDate.setMonth(startDate.getMonth() - monthsToShow);
    startDate.setDate(1);

    // Prepare calendar data structure
    const calendarData = {};
    for (let d = new Date(startDate); d <= todayMidnight; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        calendarData[dateStr] = dailyProgress[dateStr] || {};
    }

    // Generate calendar HTML
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let calendarHTML = `
        <div class="calendar-legend">
            <span>Activity: 
                <div class="legend-box intensity-1"></div>
                <div class="legend-box intensity-2"></div>
                <div class="legend-box intensity-3"></div>
                <div class="legend-box intensity-4"></div>
            </span>
            <span>Accuracy: 
                <div class="legend-box low-accuracy"></div>
                <div class="legend-box medium-accuracy"></div>
                <div class="legend-box high-accuracy"></div>
            </span>
        </div>
        <div class="calendar-grid">
            <div class="day-labels">
                ${dayNames.map(day => `<div class="day-label">${day}</div>`).join('')}
            </div>
    `;

    // Generate months
    for (let i = 0; i <= monthsToShow; i++) {
        const monthDate = new Date(todayMidnight);
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthName = monthDate.toLocaleString('default', { month: 'short' });
        const year = monthDate.getFullYear();
        const daysInMonth = new Date(year, monthDate.getMonth() + 1, 0).getDate();
        const firstDay = new Date(year, monthDate.getMonth(), 1).getDay();

        let monthHTML = `
            <div class="month-container">
                <div class="month-label">${monthName} ${year}</div>
                <div class="month-days">
                    ${'<div class="day-cell empty"></div>'.repeat(firstDay)}
        `;

        // Generate days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, monthDate.getMonth(), day);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Fixed date comparison using normalized dates
            if (currentDate > todayMidnight) {
                monthHTML += '<div class="day-cell future"></div>';
                continue;
            }

            const dayData = calendarData[dateStr] || {};
            let totalQuestions = 0;
            let totalCorrect = 0;
            
            // Calculate totals with number conversion
            Object.values(dayData).forEach(folderData => {
                totalQuestions += Number(folderData.completed) || 0;
                totalCorrect += Number(folderData.correct) || 0;
            });

            // Determine intensity
            const intensity = totalQuestions > 0 ? Math.min(4, Math.floor(totalQuestions / 5) + 1) : 0;
            
            // Determine accuracy
            const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
            let accuracyClass = '';
            if (accuracy >= 80) accuracyClass = 'high-accuracy';
            else if (accuracy >= 50) accuracyClass = 'medium-accuracy';
            else if (totalQuestions > 0) accuracyClass = 'low-accuracy';

            // Check goal completion with proper validation
            let goalMet = false;
            Object.keys(folderGoals).forEach(folder => {
                const folderData = dayData[folder] || {};
                const goalTarget = Number(folderGoals[folder]?.dailyQuestions) || 0;
                const completed = Number(folderData.completed) || 0;
                
                if (completed >= goalTarget) {
                    goalMet = true;
                    console.debug(`Goal met on ${dateStr} for ${folder}:`, {
                        completed: completed,
                        required: goalTarget
                    });
                }
            });

            // Build day cell with all metadata
            monthHTML += `
                <div class="day-cell intensity-${intensity} ${accuracyClass} ${goalMet ? 'goal-met' : ''}"
                     title="${dateStr}: ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''}
                            (${totalCorrect} correct, ${accuracy.toFixed(1)}% accuracy)
                            ${goalMet ? '✓ Daily goal achieved' : ''}">
                </div>
            `;
        }

        monthHTML += '</div></div>';
        calendarHTML += monthHTML;
    }

    calendarHTML += '</div>'; // Close calendar-grid
    calendarContainer.innerHTML = calendarHTML;

    // Final debug output
    console.log("[Calendar] Render complete", {
        renderedMonths: monthsToShow + 1,
        firstDate: startDate.toISOString().split('T')[0],
        lastDate: todayMidnight.toISOString().split('T')[0]
    });
}

function checkForNewDay() {
    const today = new Date().toISOString().split('T')[0];
    const lastActiveDate = localStorage.getItem('lastActiveDate') || today;
    
    if (today !== lastActiveDate) {
        // Reset completedToday counters for all goals
        Object.keys(folderGoals).forEach(folder => {
            folderGoals[folder].completedToday = 0;
        });
        
        localStorage.setItem('lastActiveDate', today);
        localStorage.setItem('folderGoals', JSON.stringify(folderGoals));
        
        console.log("New day detected - reset daily counters");
    }
}



// Update footer goals display
function updateFooterGoals() {
    const footerGoals = document.getElementById('footerGoals');
    if (!footerGoals) return;
    
    // Clear existing goals
    footerGoals.innerHTML = '';
    
    // Check if there are any active goals
    if (Object.keys(folderGoals).length === 0) {
      footerGoals.innerHTML = '<li>No active goals set</li>';
      return;
    }
    
    // Add each active goal to the footer
    Object.keys(folderGoals).forEach(folder => {
      const goal = folderGoals[folder];
      const today = new Date().toISOString().split('T')[0];
      const progress = dailyProgress[today]?.[folder]?.completed || 0;
      
      const goalItem = document.createElement('li');
      goalItem.innerHTML = `
        <button class="footer-link" onclick="startGoalQuiz('${folder}')">
          <span class="goal-folder">${folder}</span>
          <span class="goal-progress">${progress}/${goal.dailyQuestions}</span>
        </button>
      `;
      footerGoals.appendChild(goalItem);
    });
  }



function shouldAdvanceRange(folder, accuracy) {
    const goal = folderGoals[folder];
    if (!goal) return false;
    
    // Minimum accuracy requirement (configurable)
    const MIN_ACCURACY = 50;
    
    // Mastery level tracking
    if (!goal.mastery) {
      goal.mastery = {
        currentStreak: 0,
        requiredStreak: 2 // Need 2 good attempts in a row
      };
    }
    
    if (accuracy >= MIN_ACCURACY) {
      goal.mastery.currentStreak++;
      
      // Only advance if mastery streak is achieved
      if (goal.mastery.currentStreak >= goal.mastery.requiredStreak) {
        goal.mastery.currentStreak = 0;
        return true;
      }
    } else {
      // Reset streak if accuracy is too low
      goal.mastery.currentStreak = 0;
    }
    
    return false;
  }