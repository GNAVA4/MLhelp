import React from 'react';
import { createRoot } from 'react-dom/client';
// Шрифт локально через @fontsource (офлайн-safe), как в Life OS.
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import './index.css';
import App from './App.jsx';
import { initSync } from './lib/sync.js';
import UpdateBanner from './ui/UpdateBanner.jsx';
import { Capacitor } from '@capacitor/core';

initSync();

// В APK service worker не нужен: контент лежит внутри приложения, обновление — новым APK (ADR 011).
createRoot(document.getElementById('root')).render(<><App />{!Capacitor.isNativePlatform() && <UpdateBanner />}</>);
