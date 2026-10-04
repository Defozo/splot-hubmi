import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import App from './App';
import './styles.css';

const url = import.meta.env.VITE_CONVEX_URL;
const root = ReactDOM.createRoot(document.getElementById('root')!);
if (!url) {
  root.render(<main className="configuration"><h1>Splot dla HubMI</h1><p>Brakuje połączenia z serwerem. Ustaw VITE_CONVEX_URL i uruchom aplikację ponownie.</p></main>);
} else {
  const convex = new ConvexReactClient(url);
  root.render(<React.StrictMode><ConvexAuthProvider client={convex}><App /></ConvexAuthProvider></React.StrictMode>);
}
