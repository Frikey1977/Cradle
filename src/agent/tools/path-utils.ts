export function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return filePath.replace("~", home);
  }
  return filePath;
}
