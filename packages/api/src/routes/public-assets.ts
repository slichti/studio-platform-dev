
import { Hono } from 'hono';

const app = new Hono();

app.get('/widget.js', (c) => {
    const script = `
(function() {
  const init = () => {
    const elements = document.querySelectorAll('[data-studio-widget]');
    elements.forEach(el => {
      if (el.dataset.initialized) return;
      el.dataset.initialized = "true";

      const slug = el.getAttribute('data-slug');
      const type = el.getAttribute('data-type') || 'calendar';
      const baseUrl = el.getAttribute('data-web-url') || 'https://studio-platform-web.pages.dev';
      
      const iframe = document.createElement('iframe');
      iframe.src = \`\${baseUrl}/embed/\${slug}/\${type}\`;
      iframe.style.width = '100%';
      iframe.style.minHeight = '400px';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.transition = 'height 0.2s ease-in-out';
      iframe.scrolling = 'no';
      
      iframe.style.height = el.getAttribute('data-height') || '600px';
      
      el.innerHTML = ''; // Clear fallback content
      el.appendChild(iframe);
      
      // Listen for resize messages from inside the iframe
      window.addEventListener('message', function(e) {
        if (new URL(e.origin).hostname !== new URL(baseUrl).hostname) return;
        if (e.data.type === 'studio-resize' && e.data.slug === slug) {
          iframe.style.height = e.data.height + 'px';
        }
        if (e.data.type === 'studio-redirect' && e.data.url) {
          window.open(e.data.url, '_blank');
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
    `;

    return c.text(script, 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
    });
});

export default app;
