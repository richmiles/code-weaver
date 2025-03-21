import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import browser from 'webextension-polyfill';
import './options.css';

const Options: React.FC = () => {
  const [settings, setSettings] = useState({
    enabled: true,
    theme: 'light'
  });

  useEffect(() => {
    browser.storage.sync.get(['enabled', 'theme'])
      .then(result => {
        setSettings({
          enabled: typeof result.enabled === 'boolean' ? result.enabled : true,
          theme: typeof result.theme === 'string' ? result.theme : 'light'
        });
      })
      .catch(error => {
        console.error('Error loading settings:', error);
      });
  }, []);
  
  

  const handleToggleEnabled = () => {
    const newSettings = {
      ...settings,
      enabled: !settings.enabled
    };
    
    setSettings(newSettings);
    browser.storage.sync.set({ enabled: newSettings.enabled })
      .catch(error => {
        console.error('Error saving setting:', error);
      });
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSettings = {
      ...settings,
      theme: e.target.value
    };
    
    setSettings(newSettings);
    browser.storage.sync.set({ theme: newSettings.theme })
      .catch(error => {
        console.error('Error saving setting:', error);
      });
  };

  return (
    <div className="options-container">
      <h1>Code Weaver Options</h1>
      
      <div className="option-item">
        <label>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={handleToggleEnabled}
          />
          Enable extension
        </label>
      </div>
      
      <div className="option-item">
        <label>
          Theme:
          <select value={settings.theme} onChange={handleThemeChange}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
      </div>
      
      <div className="info-box">
        <h2>About Code Weaver</h2>
        <p>Version 0.1.0</p>
        <p>A browser extension for Code Weaver</p>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);