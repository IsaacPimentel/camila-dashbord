import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// El componente App.jsx fue escrito originalmente para correr dentro de un
// "artifact" de Claude, que provee window.storage de forma nativa.
// Fuera de ese entorno (aquí, en la web normal) no existe, así que lo
// simulamos con localStorage para que el dashboard funcione igual.
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v === null ? null : { key, value: v, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix) {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
