/** Inject dark-theme overrides for MapLibre popup once per page load. */
export function injectDarkPopupStyles() {
  if (document.getElementById('boatops-popup-css')) return
  const s = document.createElement('style')
  s.id = 'boatops-popup-css'
  s.textContent = `
    .boatops-popup .maplibregl-popup-content {
      background: #1e2030;
      border: 1px solid #2d3148;
      border-radius: 6px;
      padding: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      color: #e2e8f0;
    }
    .boatops-popup .maplibregl-popup-close-button {
      color: #64748b;
      font-size: 16px;
      padding: 4px 8px;
    }
    .boatops-popup .maplibregl-popup-close-button:hover { color: #e2e8f0; }
    .boatops-popup .maplibregl-popup-tip { border-top-color: #1e2030; border-bottom-color: #1e2030; }
  `
  document.head.appendChild(s)
}
