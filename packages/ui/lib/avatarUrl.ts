// Google serves any size by URL; ask for 96 px, sharp at 48 px on a 2× screen.
export function avatar(url: string): string {
    try {
        if (new URL(url).hostname.endsWith(".googleusercontent.com")) {
            return url.replace(/=s\d+(-c)?$/, "") + "=s96-c";
        }
    } catch {
        // Not a URL: shown as it is.
    }
    return url;
}
