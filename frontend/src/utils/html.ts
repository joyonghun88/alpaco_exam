export function stripHtmlTags(input: string) {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeBasicHtml(input: string) {
  const raw = String(input ?? '');
  if (typeof window === 'undefined') return raw;

  const template = document.createElement('template');
  template.innerHTML = raw;

  template.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el) => {
    el.remove();
  });

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    const el = node;
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'style') {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
        continue;
      }
    }
    node = walker.nextNode() as Element | null;
  }

  return template.innerHTML;
}

