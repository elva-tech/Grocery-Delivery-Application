/** Update browser tab title and favicon from tenant branding. */
export function applyDocumentBranding({ title, faviconUrl }) {
  if (title) {
    document.title = title;
  }
  if (!faviconUrl) return;

  const lower = faviconUrl.toLowerCase();
  let type = 'image/png';
  if (lower.includes('.svg')) type = 'image/svg+xml';
  else if (lower.includes('.jpg') || lower.includes('.jpeg')) type = 'image/jpeg';
  else if (lower.includes('.webp')) type = 'image/webp';

  ['icon', 'shortcut icon', 'apple-touch-icon'].forEach((rel) => {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    if (rel !== 'apple-touch-icon') link.type = type;
  });
}
