// Leave for `path` with a full page load, dropping everything the page held in memory.
export const leave = (path: string): void => window.location.assign(path);
