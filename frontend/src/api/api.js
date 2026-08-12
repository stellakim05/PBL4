const API_BASE_URL = 'http://localhost:8000/api';

export const api = {
  async signup(payload) {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMsg = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      } catch (e) {
        if (e instanceof Error && e.message !== '') {
          throw e;
        }
        const msg = await response.text();
        throw new Error(msg || `HTTP error! status: ${response.status}`);
      }
    }
    return response.json();
  },

  async login(payload) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMsg = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      } catch (e) {
        if (e instanceof Error && e.message !== '') {
          throw e;
        }
        const msg = await response.text();
        throw new Error(msg || `HTTP error! status: ${response.status}`);
      }
    }
    return response.json();
  },
  async savePreferences(preferences) {
    const response = await fetch(`${API_BASE_URL}/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getPreferences() {
    const response = await fetch(`${API_BASE_URL}/preferences`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getCourses(termId = null) {
    const url = termId ? `${API_BASE_URL}/courses?term_id=${termId}` : `${API_BASE_URL}/courses`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getTerms() {
    const response = await fetch(`${API_BASE_URL}/terms`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getActiveTerm() {
    const response = await fetch(`${API_BASE_URL}/terms/active`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; 
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data || null;
  },

  async initTerms() {
    const response = await fetch(`${API_BASE_URL}/terms/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async generateSchedule(preferences, termId = null) {
    const url = termId ? `${API_BASE_URL}/generate-schedule?term_id=${termId}` : `${API_BASE_URL}/generate-schedule`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async saveSchedule(scheduleData, userId) {
    const response = await fetch(`${API_BASE_URL}/saved-schedules?user_id=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scheduleData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getSavedSchedules(userId) {
    const response = await fetch(`${API_BASE_URL}/saved-schedules?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async deleteSavedSchedule(scheduleId, userId) {
    const response = await fetch(`${API_BASE_URL}/saved-schedules/${scheduleId}?user_id=${userId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async updateUser(userId, userData) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMsg = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      } catch (e) {
        if (e instanceof Error && e.message !== '') {
          throw e;
        }
        const msg = await response.text();
        throw new Error(msg || `HTTP error! status: ${response.status}`);
      }
    }
    
    return response.json();
  },

  async getUser(userId) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        const errorMsg = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      } catch (e) {
        if (e instanceof Error && e.message !== '') {
          throw e;
        }
        const msg = await response.text();
        throw new Error(msg || `HTTP error! status: ${response.status}`);
      }
    }
    
    return response.json();
  }
};
