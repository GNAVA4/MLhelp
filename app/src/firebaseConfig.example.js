// Шаблон конфигурации Firebase (отдельный проект курса, не Life OS).
// Скопируй в firebaseConfig.js (он в .gitignore) и впиши значения из консоли Firebase:
// Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
// Эти значения не секрет (они попадают в клиентский бандл); данные защищают правила Firestore (firestore.rules).
// Без firebaseConfig.js приложение работает как раньше, синхронизация просто выключена.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
