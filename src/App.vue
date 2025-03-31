<script setup>
import { ref, onMounted, computed, reactive } from "vue";
import { Moon, Sun, Trash2, PlusCircle, HeartPulse, Bell, BellOff, Settings, Calendar, Clock } from "lucide-vue-next";
import { saveReminder, getReminders, deleteReminder, updateReminder } from "@/database";

// Dark Mode Toggle 
const isDark = ref(localStorage.getItem("darkMode") === "true");

// Function to toggle dark mode and store the preference
const toggleDarkMode = () => {
  isDark.value = !isDark.value;
  localStorage.setItem("darkMode", isDark.value); // Save preference
};

// Task Management with IndexedDB
const newTask = ref("");
const reminderTime = ref("12:00"); // Default time setting
const tasks = ref([]);

// New notification dashboard variables
const showNotificationCenter = ref(false);
const view = ref("main"); // main, settings, notificationCenter
const selectedCategory = ref("all");
const selectedDateFilter = ref("all");

// Notification settings
const notificationSettings = reactive({
  sound: localStorage.getItem("notificationSound") === "true" || true,
  vibration: localStorage.getItem("notificationVibration") === "true" || false,
  advanceWarning: parseInt(localStorage.getItem("advanceWarning") || "5"),
});

// Categories for health reminders
const categories = [
  { id: 'medication', name: 'Medication', color: 'bg-blue-500', icon: '💊' },
  { id: 'exercise', name: 'Exercise', color: 'bg-green-500', icon: '🏃' },
  { id: 'water', name: 'Hydration', color: 'bg-cyan-500', icon: '💧' },
  { id: 'food', name: 'Nutrition', color: 'bg-yellow-500', icon: '🍎' },
  { id: 'sleep', name: 'Sleep', color: 'bg-indigo-500', icon: '😴' },
  { id: 'other', name: 'Other', color: 'bg-gray-500', icon: '📝' }
];

const selectedTaskCategory = ref(categories[0].id);

// Save notification settings
const saveSettings = () => {
  localStorage.setItem("notificationSound", notificationSettings.sound);
  localStorage.setItem("notificationVibration", notificationSettings.vibration);
  localStorage.setItem("advanceWarning", notificationSettings.advanceWarning);
  view.value = "main";
};

// Request notification permission
const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    alert("This browser does not support desktop notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
};

// Function to send a notification
const sendNotification = (task) => {
  if (Notification.permission === "granted") {
    // Play sound if enabled
    if (notificationSettings.sound) {
      const audio = new Audio('/notification-sound.mp3');
      audio.play();
    }
    
    // Vibrate if enabled and supported
    if (notificationSettings.vibration && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
    
    const category = categories.find(c => c.id === task.category);
    
    const notification = new Notification("Health Reminder", {
      body: `${category ? category.icon + ' ' : ''}${task.text}`,
      icon: "/favicon.ico",
      badge: "/badge-icon.png",
      tag: `reminder-${task.id}`,
      requireInteraction: true
    });
    
    notification.onclick = () => {
      window.focus();
      showNotificationCenter.value = true;
    };
    
    // Update the task as notified
    task.notified = true;
    updateReminder(task);
  }
};

// Check for due reminders
const checkReminders = () => {
  const now = new Date().getTime();
  
  tasks.value.forEach(task => {
    // Send notification when due
    if (task.time <= now && !task.notified) {
      sendNotification(task);
    }
    
    // Send advance warning if enabled
    if (notificationSettings.advanceWarning > 0 && 
        !task.advanceWarningShown && 
        (task.time - (notificationSettings.advanceWarning * 60 * 1000) <= now) && 
        (task.time > now)) {
      
      const minutes = notificationSettings.advanceWarning;
      const category = categories.find(c => c.id === task.category);
      
      const advanceNotification = new Notification("Upcoming Health Reminder", {
        body: `${category ? category.icon + ' ' : ''}${task.text} in ${minutes} minute${minutes !== 1 ? 's' : ''}`,
        icon: "/favicon.ico"
      });
      
      task.advanceWarningShown = true;
      updateReminder(task);
    }
  });
};

// Start periodic checking for notifications
const startNotificationCheck = () => {
  // Check immediately
  checkReminders();
  
  // Then check every minute
  setInterval(checkReminders, 60000);
};

// Load saved reminders from IndexedDB when the app starts
onMounted(async () => {
  tasks.value = await getReminders();
  
  // Initialize advanceWarningShown property if not already set
  tasks.value.forEach(task => {
    if (task.advanceWarningShown === undefined) {
      task.advanceWarningShown = false;
      updateReminder(task);
    }
    
    // Initialize category if not set
    if (task.category === undefined) {
      task.category = 'other';
      updateReminder(task);
    }
  });
  
  await requestNotificationPermission();
  startNotificationCheck();
});

// Add Task & Save to IndexedDB
const addTask = () => {
  if (newTask.value.trim()) {
    // Get hours and minutes from the time input
    const [hours, minutes] = reminderTime.value.split(':').map(Number);
    
    // Create a date object for today with the selected time
    const reminderDate = new Date();
    reminderDate.setHours(hours, minutes, 0, 0);
    
    // If the time is in the past, set it for tomorrow
    if (reminderDate < new Date()) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }
    
    const task = {
      id: Date.now(),
      text: newTask.value.trim(),
      time: reminderDate.getTime(),
      notified: false,
      category: selectedTaskCategory.value,
      advanceWarningShown: false
    };
    
    tasks.value.push(task);
    saveReminder(task);
    newTask.value = "";
  }
};

// Delete Task & Remove from IndexedDB
const deleteTask = (index) => {
  const taskId = tasks.value[index].id;
  tasks.value.splice(index, 1);
  deleteReminder(taskId);
};

// Format time for display
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date for display
const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString();
};

// Helper function to get the category object by ID
const getCategoryById = (categoryId) => {
  return categories.find(cat => cat.id === categoryId) || categories[categories.length - 1];
};

// Filter tasks by category and date
const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // Filter by category if one is selected
    if (selectedCategory.value !== 'all' && task.category !== selectedCategory.value) {
      return false;
    }
    
    // Filter by date if one is selected
    if (selectedDateFilter.value !== 'all') {
      const taskDate = new Date(task.time);
      const today = new Date();
      
      if (selectedDateFilter.value === 'today') {
        return taskDate.setHours(0,0,0,0) === today.setHours(0,0,0,0);
      } else if (selectedDateFilter.value === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return taskDate.setHours(0,0,0,0) === tomorrow.setHours(0,0,0,0);
      } else if (selectedDateFilter.value === 'week') {
        const weekLater = new Date();
        weekLater.setDate(weekLater.getDate() + 7);
        return taskDate >= today && taskDate <= weekLater;
      }
    }
    
    return true;
  });
});

// Get upcoming reminders (next 24 hours)
const upcomingReminders = computed(() => {
  const now = new Date().getTime();
  const tomorrow = now + (24 * 60 * 60 * 1000);
  
  return tasks.value
    .filter(task => task.time >= now && task.time <= tomorrow && !task.notified)
    .sort((a, b) => a.time - b.time);
});

// Re-enable notifications for a task
const resetNotification = (task) => {
  task.notified = false;
  task.advanceWarningShown = false;
  updateReminder(task);
};

// Get color class for time based on how soon it is
const getTimeColor = (timestamp) => {
  const now = new Date().getTime();
  const timeLeft = timestamp - now;
  
  if (timeLeft < 0) return 'text-gray-400'; // Past due
  if (timeLeft < 30 * 60 * 1000) return 'text-red-500'; // Less than 30 mins
  if (timeLeft < 60 * 60 * 1000) return 'text-orange-500'; // Less than 1 hour
  return 'text-green-500'; // More than 1 hour
};
</script>

<template>
  <!-- Main Wrapper -->
  <div :class="isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'" class="min-h-screen transition-colors duration-300">

    <!-- Stylish Header -->
    <header class="flex items-center justify-between p-6 bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg">
      <div class="flex items-center">
        <div class="relative">
          <div class="absolute inset-0 bg-purple-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
          <HeartPulse class="relative w-14 h-14 text-white drop-shadow-lg" />
        </div>
        
        <h1 class="ml-4 text-3xl font-extrabold text-white tracking-wide drop-shadow-md">
          Health Reminder
        </h1>
      </div>
      
      <div class="flex items-center space-x-3">
        <!-- Notification Center Toggle -->
        <button 
          @click="showNotificationCenter = !showNotificationCenter"
          class="p-2 rounded-full transition-all duration-300 hover:bg-white/20 relative"
        >
          <Bell v-if="!showNotificationCenter" class="w-7 h-7 text-yellow-100" />
          <BellOff v-else class="w-7 h-7 text-yellow-100" />
          <!-- Notification badge -->
          <div v-if="upcomingReminders.length > 0 && !showNotificationCenter" 
               class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {{ upcomingReminders.length }}
          </div>
        </button>
        
        <!-- Settings Button -->
        <button 
          @click="view = view === 'settings' ? 'main' : 'settings'"
          class="p-2 rounded-full transition-all duration-300 hover:bg-white/20"
        >
          <Settings class="w-7 h-7 text-yellow-100" />
        </button>
        
        <!-- Dark Mode Toggle -->
        <button 
          @click="toggleDarkMode"
          class="p-2 rounded-full transition-all duration-300 hover:bg-white/20"
        >
          <Sun v-if="isDark" class="w-7 h-7 text-yellow-400" />
          <Moon v-else class="w-7 h-7 text-gray-200" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="p-6">
      <!-- Settings View -->
      <div v-if="view === 'settings'" class="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fadeIn">
        <h2 class="text-2xl font-bold text-center dark:text-gray-100 text-gray-800 mb-6">Notification Settings</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-gray-700 dark:text-gray-300">Sound Notifications</label>
            <div class="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.sound"
                class="absolute w-6 h-6 cursor-pointer opacity-0 z-10"
              />
              <div 
                :class="[notificationSettings.sound ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600']"
                class="block w-12 h-6 rounded-full transition"
              ></div>
              <div
                :class="[notificationSettings.sound ? 'transform translate-x-6' : 'transform translate-x-0']"
                class="absolute top-0 left-0 w-6 h-6 transition duration-300 bg-white dark:bg-gray-100 rounded-full"
              ></div>
            </div>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-700 dark:text-gray-300">Vibration</label>
            <div class="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.vibration"
                class="absolute w-6 h-6 cursor-pointer opacity-0 z-10"
              />
              <div 
                :class="[notificationSettings.vibration ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600']"
                class="block w-12 h-6 rounded-full transition"
              ></div>
              <div
                :class="[notificationSettings.vibration ? 'transform translate-x-6' : 'transform translate-x-0']"
                class="absolute top-0 left-0 w-6 h-6 transition duration-300 bg-white dark:bg-gray-100 rounded-full"
              ></div>
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="text-gray-700 dark:text-gray-300 block">Advance Warning (minutes)</label>
            <select 
              v-model="notificationSettings.advanceWarning" 
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="0">No advance warning</option>
              <option value="5">5 minutes before</option>
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button 
            @click="saveSettings"
            class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
      
      <!-- Notification Center -->
      <div v-else-if="showNotificationCenter" class="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fadeIn">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold dark:text-gray-100 text-gray-800">Notification Center</h2>
          <button 
            @click="showNotificationCenter = false"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
        
        <!-- Filters -->
        <div class="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
          <span class="text-gray-600 dark:text-gray-400 whitespace-nowrap">Filter:</span>
          <button
            @click="selectedCategory = 'all'"
            :class="[
              selectedCategory === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors'
            ]"
          >
            All
          </button>
          <button
            v-for="category in categories"
            :key="category.id"
            @click="selectedCategory = category.id"
            :class="[
              selectedCategory === category.id ? `${category.color} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors flex items-center whitespace-nowrap'
            ]"
          >
            <span class="mr-1">{{ category.icon }}</span>
            {{ category.name }}
          </button>
        </div>
        
        <div class="flex items-center space-x-2 mb-6 overflow-x-auto pb-2">
          <span class="text-gray-600 dark:text-gray-400 whitespace-nowrap">When:</span>
          <button
            @click="selectedDateFilter = 'all'"
            :class="[
              selectedDateFilter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors'
            ]"
          >
            All
          </button>
          <button
            @click="selectedDateFilter = 'today'"
            :class="[
              selectedDateFilter === 'today' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors'
            ]"
          >
            Today
          </button>
          <button
            @click="selectedDateFilter = 'tomorrow'"
            :class="[
              selectedDateFilter === 'tomorrow' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors'
            ]"
          >
            Tomorrow
          </button>
          <button
            @click="selectedDateFilter = 'week'"
            :class="[
              selectedDateFilter === 'week' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              'px-3 py-1 rounded-full text-sm transition-colors'
            ]"
          >
            This Week
          </button>
        </div>
        
        <!-- Notification List -->
        <div class="space-y-3">
          <div v-if="filteredTasks.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-4">
            No reminders found with these filters
          </div>
          
          <div 
            v-for="task in filteredTasks" 
            :key="task.id" 
            class="p-4 bg-white dark:bg-gray-700 rounded-lg shadow border-l-4 transition-all hover:shadow-md"
            :class="[getCategoryById(task.category).color.replace('bg-', 'border-')]"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center">
                  <span class="mr-2">{{ getCategoryById(task.category).icon }}</span>
                  <h3 class="font-medium dark:text-white">{{ task.text }}</h3>
                </div>
                
                <div class="mt-1 flex items-center space-x-3 text-sm">
                  <div class="flex items-center" :class="getTimeColor(task.time)">
                    <Clock class="w-4 h-4 mr-1" />
                    <span>{{ formatTime(task.time) }}</span>
                  </div>
                  
                  <div class="flex items-center text-gray-500 dark:text-gray-400">
                    <Calendar class="w-4 h-4 mr-1" />
                    <span>{{ formatDate(task.time) }}</span>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button 
                  v-if="task.notified"
                  @click="resetNotification(task)"
                  class="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded"
                >
                  Reset
                </button>
                <button 
                  @click="deleteTask(tasks.value.findIndex(t => t.id === task.id))"
                  class="text-red-500 hover:text-red-600"
                >
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div v-if="task.notified" class="mt-2 text-xs text-green-500 font-medium">
              ✓ Notified
            </div>
          </div>
        </div>
      </div>
      
      <!-- Main Task View -->
      <div v-else class="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <!-- Title -->
        <h2 class="text-2xl font-bold text-center dark:text-gray-100 text-gray-800">Your Daily Reminders</h2>
        
        <!-- Add Reminder Input -->
        <div class="mt-4">
          <input 
            v-model="newTask"
            type="text" 
            placeholder="Enter a health reminder..." 
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          />
          
          <div class="flex flex-wrap items-center mt-2 gap-2">
            <div class="flex-1 min-w-[140px]">
              <label class="text-gray-700 dark:text-gray-300 text-sm">Category:</label>
              <select
                v-model="selectedTaskCategory"
                class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              >
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.icon }} {{ category.name }}
                </option>
              </select>
            </div>
            
            <div class="flex-1 min-w-[140px]">
              <label class="text-gray-700 dark:text-gray-300 text-sm">Time:</label>
              <input
                v-model="reminderTime"
                type="time"
                class="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <button 
              @click="addTask"
              class="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 transition-all self-end"
            >
              <PlusCircle class="w-6 h-6" />
            </button>
          </div>
        </div>

        <!-- Upcoming Reminders Section -->
        <div class="mt-6">
          <h3 class="font-medium text-lg text-gray-700 dark:text-gray-300 mb-2">
            Upcoming Reminders
            <span class="text-sm text-gray-500 dark:text-gray-400">(Next 24 hours)</span>
          </h3>
          
          <div v-if="upcomingReminders.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            No upcoming reminders in the next 24 hours
          </div>
          
          <div v-else class="space-y-2">
            <div 
              v-for="task in upcomingReminders" 
              :key="task.id" 
              class="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r transition-all"
              :class="[
                `from-${getCategoryById(task.category).color.replace('bg-', '')}/10 to-${getCategoryById(task.category).color.replace('bg-', '')}/30`
              ]"
            >
              <div>
                <div class="flex items-center">
                  <span class="mr-2">{{ getCategoryById(task.category).icon }}</span>
                  <span class="dark:text-white font-medium">{{ task.text }}</span>
                </div>
                <div class="text-sm" :class="getTimeColor(task.time)">
                  {{ formatTime(task.time) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- All Reminders -->
        <div class="mt-6">
          <h3 class="font-medium text-lg text-gray-700 dark:text-gray-300 mb-2">All Reminders</h3>
          
          <ul class="space-y-3">
            <li 
              v-for="(task, index) in tasks" 
              :key="index" 
              class="flex justify-between items-center p-3 rounded-lg border-l-4 bg-gray-200 dark:bg-gray-700"
              :class="[getCategoryById(task.category).color.replace('bg-', 'border-')]"
            >
              <div>
                <div class="flex items-center">
                  <span class="mr-2">{{ getCategoryById(task.category).icon }}</span>
                  <span class="dark:text-white">{{ task.text }}</span>
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-3">
                  <span>{{ formatTime(task.time) }}</span>
                  <span v-if="task.notified" class="text-green-500">✓ Notified</span>
                </div>
              </div>
              <button @click="deleteTask(index)" class="text-red-500 hover:text-red-600">
                <Trash2 class="w-5 h-5" />
              </button>
            </li>
          </ul>

          <!-- No Tasks Message -->
          <p v-if="tasks.length === 0" class="mt-4 text-center text-gray-500 dark:text-gray-400">
            No reminders yet. Add one!
          </p>
        </div>
        
      </div>
    </main>

  </div>
</template>

<style>
/* Animation classes */
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}
</style>