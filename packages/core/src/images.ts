/** The file extensions an image may have (lower case, with the dot). Shared by the server and the loader. */
export const IMAGE_EXTS: readonly string[] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

/** True for a file name whose extension is an image type. */
export function isImageName(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && IMAGE_EXTS.includes(name.slice(dot).toLowerCase());
}
