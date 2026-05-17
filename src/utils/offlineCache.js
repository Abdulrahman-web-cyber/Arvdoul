export function saveToCache(key, data) {  
  try {  
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));  
  } catch (e) {}  
}  

export function loadFromCache(key) {  
  try {  
    const item = localStorage.getItem(key);  
    if (!item) return null;  
    const parsed = JSON.parse(item);  
    // TTL of 6 hours  
    if (Date.now() - parsed.timestamp > 6 * 60 * 60 * 1000) {  
      localStorage.removeItem(key);  
      return null;  
    }  
    return parsed.data;  
  } catch (e) {  
    return null;  
  }  
}
