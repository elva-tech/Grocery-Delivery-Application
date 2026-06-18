/** Update browser tab title and favicon from tenant branding. */
export function applyDocumentBranding({ title, faviconUrl }) {
  if (title) {
    document.title = title;
  }
  if (!faviconUrl) return;

  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  link.href = faviconUrl;
  const lower = faviconUrl.toLowerCase();
  if (lower.includes('.svg')) link.type = 'image/svg+xml';
  else if (lower.includes('.png')) link.type = 'image/png';
  else if (lower.includes('.jpg') || lower.includes('.jpeg')) link.type = 'image/jpeg';
  else if (lower.includes('.webp')) link.type = 'image/webp';
  else link.removeAttribute('type');
}
