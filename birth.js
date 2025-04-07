// Birthday configuration
const BIRTHDAY_MONTH = 3; // April (0-indexed, so 3 = April)
const BIRTHDAY_DATE = 6;
const BIRTHDAY_KEY = 'lastBirthdayCelebration';

// Balloon colors
const BALLOON_COLORS = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink'
];

// Confetti colors
const CONFETTI_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
  '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50',
  '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800'
];

function checkBirthday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check if today is the birthday
  if (now.getMonth() === BIRTHDAY_MONTH && now.getDate() === BIRTHDAY_DATE) {
    const lastCelebration = localStorage.getItem(BIRTHDAY_KEY);
    const lastCelebrationDate = lastCelebration ? new Date(lastCelebration) : null;
    
    // Only show if we haven't celebrated today yet
    if (!lastCelebrationDate || lastCelebrationDate < today) {
      localStorage.setItem(BIRTHDAY_KEY, today.toISOString());
      startBirthdayCelebration();
    } else {
      // If we already celebrated today, just show small balloons
      showHeaderBalloons();
    }
  }
}
function createFireflies(count) {
    for (let i = 0; i < count; i++) {
      const firefly = document.createElement('div');
      firefly.className = 'firefly';
      firefly.style.left = `${Math.random() * 100}vw`;
      firefly.style.top = `${Math.random() * 100}vh`;
      firefly.style.animationDelay = `${Math.random() * 5}s`;
      firefly.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      document.body.appendChild(firefly);
      
      setTimeout(() => firefly.remove(), 20000);
    }
  }
function startBirthdayCelebration() {
    // Create celebration container
    const celebration = document.createElement('div');
    celebration.className = 'birthday-celebration';
    celebration.innerHTML = `
      <div class="birthday-message">
        <h2>Happy Birthday! Princy</h2>
        <p>Wishing you a wonderful day!</p>
      </div>
    `;
    document.body.appendChild(celebration);
    
    // Create party poppers
    createPartyPoppers(5);
    createFireflies(15);
    createComets(5);
    createBubbles(20);

    // Create cracker explosions
    createCrackerExplosions(10);
    
    // Create lots of balloons
    for (let i = 0; i < 50; i++) {
      createBalloon(true);
    }
   // Add 5 big confetti explosions at random positions
   for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      createConfettiExplosion(x, y, 150); // 150 pieces per explosion
    }, i * 800);
  }
    // Create confetti
    createConfetti();
    
    // Play birthday sound
    playBirthdaySound();
    
    // Remove celebration message after 5 seconds
    setTimeout(() => {
      celebration.remove();
      // Continue with small balloons in header
      showHeaderBalloons();
    }, 5000);
  }
  
  function createCrackerExplosions(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        // Original cracker effect
        const cracker = document.createElement('div');
        cracker.className = 'cracker-explosion';
        cracker.style.left = `${x}px`;
        cracker.style.top = `${y}px`;
        document.body.appendChild(cracker);
        
        // Add confetti explosion at same location
        createConfettiExplosion(x, y, 200); // Bigger explosion
        
        setTimeout(() => cracker.remove(), 1000);
      }, i * 300);
    }
  }
  function createBubbles(count) {
    for (let i = 0; i < count; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'floating-bubble';
      bubble.style.left = `${Math.random() * 100}vw`;
      bubble.style.width = `${5 + Math.random() * 15}px`;
      bubble.style.height = bubble.style.width;
      bubble.style.animationDuration = `${8 + Math.random() * 7}s`;
      document.body.appendChild(bubble);
      
      setTimeout(() => bubble.remove(), 15000);
    }
  }
function createConfetti() {
  for (let i = 0; i < 150; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      confetti.style.backgroundColor = color;
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confetti.style.animationDuration = `${3 + Math.random() * 4}s`;
      
      // Random shape
      if (Math.random() > 0.5) {
        confetti.style.borderRadius = '50%';
      }
      
      document.body.appendChild(confetti);
      
      // Remove after animation
      setTimeout(() => confetti.remove(), 7000);
    }, i * 50);
  }
}

function playBirthdaySound() {
  const audio = new Audio('data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
  audio.volume = 0.2;
  audio.play().catch(e => console.log('Audio playback failed:', e));
}

function createBalloon(isLarge = false) {
  const balloon = document.createElement('div');
  const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
  const size = isLarge ? '30px' : '20px';
  
  balloon.className = isLarge ? 'birthday-balloon' : 'header-balloon';
  if (Math.random() > 0.5 && isLarge) {
    balloon.classList.add('side');
  }
  
  balloon.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><path fill="${color}" d="M15,5 Q25,0 25,15 Q25,30 15,35 Q5,30 5,15 Q5,0 15,5"/></svg>')`;
  balloon.style.left = `${Math.random() * 100}vw`;
  balloon.style.width = size;
  balloon.style.height = `calc(${size} * 1.33)`;
  balloon.style.animationDuration = `${8 + Math.random() * 7}s`;
  
  if (!isLarge) {
    // For header balloons, position them near the medals
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      const rect = headerRight.getBoundingClientRect();
      balloon.style.left = `${rect.left + Math.random() * rect.width}px`;
      balloon.style.top = `${rect.top + rect.height}px`;
    }
  }
  
  document.body.appendChild(balloon);
  
  // Remove balloon after animation completes
  setTimeout(() => {
    balloon.remove();
    if (!isLarge) {
      // Keep creating new small balloons
      createBalloon(false);
    }
  }, isLarge ? 8000 : 15000);
}
function createBoomExplosion(x, y) {
    const boom = document.createElement('div');
    boom.className = 'boom-explosion';
    boom.style.left = `${x}px`;
    boom.style.top = `${y}px`;
    document.body.appendChild(boom);
    
    // Create sparkles
    for (let i = 0; i < 30; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      boom.appendChild(sparkle);
    }
    
    setTimeout(() => boom.remove(), 1000);
  }
function showHeaderBalloons() {
  // Show 3 small balloons initially
  for (let i = 0; i < 3; i++) {
    setTimeout(() => createBalloon(false) , i * 2000);
  }
}




// Add this to your existing code

function createPartyPoppers(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const popper = document.createElement('div');
        popper.className = 'party-popper';
        
        // Position at bottom of screen
        popper.style.left = `${10 + (i % 8) * 10}vw`;
        popper.style.bottom = '0';
        
        // Random rotation
        popper.style.transform = `rotate(${-30 + Math.random() * 60}deg)`;
        
        // Create popper stream
        for (let j = 0; j < 15; j++) {
          const stream = document.createElement('div');
          stream.className = 'popper-stream';
          stream.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
          stream.style.animationDelay = `${j * 0.05}s`;
          popper.appendChild(stream);
        }
        
        document.body.appendChild(popper);
        
        // Remove after animation
        setTimeout(() => popper.remove(), 2000);
      }, i * 300);
    }
  }
  
  // Update your startBirthdayCelebration function to include poppers:
  function createComets(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const comet = document.createElement('div');
        comet.className = 'shooting-comet';
        comet.style.left = `${Math.random() * 100}vw`;
        comet.style.top = `${Math.random() * 50}vh`;
        document.body.appendChild(comet);
        
        setTimeout(() => comet.remove(), 3000);
      }, i * 2000);
    }
  }




  function createConfettiExplosion(x, y, count = 100) {
    const explosion = document.createElement('div');
    explosion.className = 'confetti-explosion';
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    document.body.appendChild(explosion);
  
    // Create confetti pieces
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      
      // Random properties
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const size = 5 + Math.random() * 10;
      const shape = Math.random() > 0.5 ? 'rect' : 'circle';
      
      // Apply styles
      confetti.style.backgroundColor = color;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.setProperty('--distance', 50 + Math.random() * 100);
      confetti.style.setProperty('--angle', Math.random() * Math.PI * 2);
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      
      if (shape === 'circle') {
        confetti.style.borderRadius = '50%';
      }
      
      explosion.appendChild(confetti);
    }
  
    // Remove after animation
    setTimeout(() => explosion.remove(), 3000);
  }
