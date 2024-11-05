const siteInput = document.getElementById('site');
const addButton = document.getElementById('add');
const blockedSitesList = document.getElementById('blocked-sites');

// Load blocked sites from storage and display them
const loadBlockedSites = () => {
  chrome.storage.sync.get('blockedSites', (data) => {
    const sites = data.blockedSites || [];
    blockedSitesList.innerHTML = '';
    if (sites.length === 0) {
      blockedSitesList.innerHTML = '<li class="empty-message">No blocked sites</li>';
    } else {
      sites.forEach((site) => {
        const li = document.createElement('li');
        li.innerHTML = `${site.url} 
          ${site.timer ? `<span class="timer" data-site="${site.url}">${formatTime(site.timer)}</span>` : ''}
          <span class="set-timer-btn" data-site="${site.url}">Set Timer</span>
          <input type="number" class="timer-input" data-site="${site.url}" placeholder="Seconds" min="1" style="display:none;">
          <span class="remove-btn" data-site="${site.url}">Remove</span>
          ${site.timer ? `<span class="remove-timer-btn" data-site="${site.url}">Remove Timer</span>` : ''}`;
        blockedSitesList.appendChild(li);
      });
    }
  });
};

// Format the remaining time in seconds
const formatTime = (timestamp) => {
  const now = Date.now();
  const diff = timestamp - now;
  if (diff <= 0) return "Expired";

  const seconds = Math.floor(diff / 1000);
  return `${seconds}s`;
};

// Add a new site to the blocked list
addButton.addEventListener('click', () => {
  const site = siteInput.value.trim();
  if (site) {
    chrome.storage.sync.get('blockedSites', (data) => {
      const sites = data.blockedSites || [];
      if (!sites.find(s => s.url === site)) {
        sites.push({ url: site, timer: null });
        chrome.storage.sync.set({ blockedSites: sites }, () => {
          loadBlockedSites(); // Refresh list after adding
        });
        siteInput.value = '';
      }
    });
  }
});

// Handle interactions with the blocked sites list
blockedSitesList.addEventListener('click', (event) => {
  if (event.target.classList.contains('set-timer-btn')) {
    const site = event.target.dataset.site;
    const timerInput = document.querySelector(`input.timer-input[data-site="${site}"]`);
    timerInput.style.display = 'inline-block'; // Show timer input
    timerInput.focus();
  } else if (event.target.classList.contains('remove-btn')) {
    const site = event.target.dataset.site;
    chrome.storage.sync.get('blockedSites', (data) => {
      let sites = data.blockedSites || [];
      sites = sites.filter(s => s.url !== site);
      chrome.storage.sync.set({ blockedSites: sites }, () => {
        loadBlockedSites(); // Refresh list after removal
      });
    });
  } else if (event.target.classList.contains('remove-timer-btn')) {
    const site = event.target.dataset.site;
    chrome.storage.sync.get('blockedSites', (data) => {
      let sites = data.blockedSites || [];
      sites = sites.map(s => {
        if (s.url === site) {
          s.timer = null; // Remove timer
        }
        return s;
      });
      chrome.storage.sync.set({ blockedSites: sites }, () => {
        loadBlockedSites(); // Refresh list after removing timer
      });
    });
  }
});

// Handle timer input change
blockedSitesList.addEventListener('change', (event) => {
  if (event.target.classList.contains('timer-input')) {
    const site = event.target.dataset.site;
    const seconds = parseInt(event.target.value, 10);
    if (seconds > 0) {
      const timerEnd = Date.now() + seconds * 1000;
      chrome.storage.sync.get('blockedSites', (data) => {
        let sites = data.blockedSites || [];
        sites = sites.map(s => {
          if (s.url === site) {
            s.timer = timerEnd; // Set new timer
          }
          return s;
        });
        chrome.storage.sync.set({ blockedSites: sites }, () => {
          event.target.style.display = 'none'; // Hide timer input after setting
          loadBlockedSites(); // Refresh list after setting timer
        });
      });
    }
  }
});

// Hide timer input when clicking outside of it
document.addEventListener('click', (event) => {
  const timerInputs = document.querySelectorAll('.timer-input');
  timerInputs.forEach(input => {
    if (!input.contains(event.target) && event.target !== input.previousElementSibling) {
      input.style.display = 'none';
    }
  });
});

// Allow adding a site by pressing Enter
siteInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission if inside a form
    addButton.click();
  }
});

// Initial load of blocked sites
loadBlockedSites();

// Update the countdowns every second
setInterval(() => {
  chrome.storage.sync.get('blockedSites', (data) => {
    const sites = data.blockedSites || [];
    const now = Date.now();
    let updated = false;
    sites.forEach((site) => {
      if (site.timer && site.timer <= now) {
        // Timer has expired
        site.timer = null;
        updated = true;
      }
    });

    if (updated) {
      chrome.storage.sync.set({ blockedSites: sites });
    }

    // Update the timer display in the popup
    document.querySelectorAll('.timer').forEach(timer => {
      const siteUrl = timer.dataset.site;
      const site = sites.find(s => s.url === siteUrl);
      if (site && site.timer) {
        timer.textContent = formatTime(site.timer);
      } else {
        timer.textContent = "";
      }
    });
  });
}, 1000); // Check every second
