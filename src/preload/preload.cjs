// preload.cjs
// Description: the narrow, safe API each renderer window gets. CommonJS on
//              purpose — sandboxed preloads require it. Nothing here decides
//              behaviour; it only ferries events, queries, and state.
// Inputs:  ipcRenderer channels registered in src/main/ipc.js
// Outputs: window.logit = { getStateSync, send, query, onState, onNav,
//                           onShellError, onToast }
// Created: 2026-08-17

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('logit', {
  // Description: synchronous first-paint snapshot.
  // Inputs: none  Outputs: state object
  getStateSync: () => ipcRenderer.sendSync('state-sync'),

  // Description: dispatch a user trigger to the core.
  // Inputs: type — event name; payload — object
  // Outputs: Promise of the core's result ({ ok, ... } for form actions)
  send: (type, payload) => ipcRenderer.invoke('event', { type, payload }),

  // Description: read-only pane question.
  // Inputs: type — query name; payload — object
  // Outputs: Promise of the result
  query: (type, payload) => ipcRenderer.invoke('query', { type, payload }),

  // Description: subscribe to state broadcasts / navigation / errors / toasts.
  // Inputs: cb — handler
  // Outputs: none
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onNav: (cb) => ipcRenderer.on('nav', (_e, pane) => cb(pane)),
  onShellError: (cb) => ipcRenderer.on('shell-error', (_e, text) => cb(text)),
  onToast: (cb) => ipcRenderer.on('toast', (_e, text) => cb(text))
});
