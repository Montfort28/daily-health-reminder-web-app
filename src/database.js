

import { openDB } from 'idb'; 

const DB_NAME = 'healthReminderDB';
const STORE_NAME = 'reminders';
const DB_VERSION = 1;

// Open/create the database
const openDatabase = async () => {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    }
  });
};

// Save a reminder to IndexedDB
export const saveReminder = async (reminder) => {
  const db = await openDatabase();
  await db.put(STORE_NAME, reminder);
};

// Get all reminders from IndexedDB
export const getReminders = async () => {
  const db = await openDatabase();
  return await db.getAll(STORE_NAME);
};

// Delete a reminder by ID
export const deleteReminder = async (id) => {
  const db = await openDatabase();
  await db.delete(STORE_NAME, id);
};

// NEW FUNCTION: Update an existing reminder
export const updateReminder = async (task) => {
  const db = await openDatabase();
  await db.put(STORE_NAME, task);
};