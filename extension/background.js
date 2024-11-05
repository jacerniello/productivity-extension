chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get('blockedSites', (data) => {
      const sites = data.blockedSites || [];
      updateRules(sites);
    });
  });
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedSites) {
      updateRules(changes.blockedSites.newValue);
    }
  });
  
  function updateRules(blockedSites) {
    clearBlockingRules(() => {
      const now = Date.now();
      
      // Define rules for blocking sites
      const rules = blockedSites.map((site, index) => ({
        id: index + 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            url: chrome.runtime.getURL('block.html')
          }
        },
        condition: {
          urlFilter: `||${site.url}`,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'stylesheet']
        }
      }));
  
      // Update rules
      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
        removeRuleIds: rules.map(rule => rule.id) // Remove existing rules
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error updating rules:", chrome.runtime.lastError);
        } else {
          console.log("Rules updated successfully");
        }
      });
  
      // Handle timers and unblock sites temporarily
      blockedSites.forEach(site => {
        if (site.timer && site.timer > now) {
          // Remove the site from the rules temporarily
          // Find the rule with the matching URL and remove it
          const ruleId = rules.find(rule => rule.condition.urlFilter === `||${site.url}`)?.id;
          if (ruleId !== undefined) {
            chrome.declarativeNetRequest.updateDynamicRules({
              removeRuleIds: [ruleId] // Correctly remove rule by ID
            });
          }
        } else if (site.timer && site.timer <= now) {
          // Timer has expired; unblock site temporarily
          site.timer = null; // Reset timer
        } else {
            redirectToBlockPage(site.url);
        }
      });
  
      // Save updated sites with timers cleared
      chrome.storage.sync.set({ blockedSites: blockedSites });
    });
  }
  
  function clearBlockingRules(callback) {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      const ruleIds = rules.map(rule => rule.id);
      if (ruleIds.length > 0) {
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error clearing rules:", chrome.runtime.lastError);
          } else {
            console.log("All rules cleared successfully");
            if (callback) callback();
          }
        });
      } else {
        if (callback) callback();
      }
    });
  }
  
  function redirectToBlockPage(domain) {
    const domainRegex = new RegExp(`.*\\.${domain}$`, 'i'); // Regex to match any subdomain of the given domain
  
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          const url = new URL(tab.url);
          if (domainRegex.test(url.hostname)) {
            chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('block.html') });
          }
        } catch (error) {
          console.error("Error processing tab URL:", error);
        }
      });
    });
  }
  
  // Check for timer expirations periodically
  setInterval(() => {
    chrome.storage.sync.get('blockedSites', (data) => {
      const sites = data.blockedSites || [];
      const now = Date.now();
  
      let updated = false;
      sites.forEach(site => {
        if (site.timer && site.timer <= now) {
          // Timer has expired; unblock site temporarily
          site.timer = null;
          updated = true;
          redirectToBlockPage(site.url);
        }
      });
  
      if (updated) {
        chrome.storage.sync.set({ blockedSites: sites });
        updateRules(sites);
      }
    });
  }, 1000); // Check every second
  