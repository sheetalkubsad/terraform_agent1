export const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE = isDev ? 'http://localhost:8000/api' : '/api';
