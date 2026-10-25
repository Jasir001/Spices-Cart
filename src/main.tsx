import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The application root element is missing.');

let navigationStarted = false;
rootElement.classList.add('page-entering');
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
  if (destination.pathname === window.location.pathname
    && destination.search === window.location.search
    && destination.hash) return;

  event.preventDefault();
  if (navigationStarted) return;
  navigationStarted = true;
  rootElement.classList.remove('page-entering');
  rootElement.classList.add('page-leaving');
  window.setTimeout(() => window.location.assign(destination.href), 180);
}, true);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
