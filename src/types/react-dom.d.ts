declare module 'react-dom' {
  export function createPortal(
    children: import('react').ReactNode,
    container: Element | DocumentFragment,
    key?: null | string,
  ): import('react').ReactPortal;
  export function flushSync<R>(fn: () => R): R;
}
