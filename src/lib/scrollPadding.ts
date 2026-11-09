/**
 * Reserve room at the bottom of the scroll container so keyboard focus never lands under a pinned
 * bar (WCAG 2.2 SC 2.4.11). The console scrolls on <body>, not <html>, so the padding goes on the
 * element that actually scrolls. Several bars can be pinned at once (tabs stay mounted): the
 * container keeps the largest request, and one bar unpinning never clears another's.
 */
const requests = new Map<HTMLElement, Map<symbol, number>>();

function scrollContainer(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function apply(container: HTMLElement) {
  const sizes = requests.get(container);
  container.style.scrollPaddingBottom = sizes && sizes.size > 0 ? `${Math.max(...sizes.values())}px` : "";
}

/** Returns a release function. */
export function reserveScrollPadding(el: HTMLElement, px: number): () => void {
  const container = scrollContainer(el);
  const key = Symbol("save-bar");
  const sizes = requests.get(container) ?? new Map<symbol, number>();
  sizes.set(key, px);
  requests.set(container, sizes);
  apply(container);
  return () => {
    sizes.delete(key);
    if (sizes.size === 0) requests.delete(container);
    apply(container);
  };
}
