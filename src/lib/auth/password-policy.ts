/* What a staff password has to be, checked wherever an administrator sets one
   (team add, team reset, author create). Length over complexity rules, as
   NIST SP 800-63B and OWASP ASVS V2.1 recommend: twelve characters, no upper
   bound worth hitting, and none of the passwords every guessing list starts
   with. Existing passwords are not re-checked; they meet this on next reset. */

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 200;

// the head of every breached-password list, plus this site's own obvious guesses
const COMMON = new Set([
  "123456789012", "1234567890123", "password1234", "password12345", "passwordpassword", "qwertyuiop12",
  "qwerty123456", "iloveyou1234", "admin1234567", "administrator", "letmein12345", "welcome12345",
  "abc123456789", "111111111111", "000000000000", "changeme1234", "islamonlive", "islamonlive123",
  "islamonline", "islamonlive@123", "islamonlive1234", "bismillah123", "bismillah1234", "alhamdulillah",
  "allahuakbar1", "masha allah", "mashaallah123", "insha allah", "inshaallah123",
]);

/** Why `password` is not acceptable for this account, or null when it is. */
export function passwordProblem(password: string, account: { username?: string; email?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD) return `The password must be at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return "The password is too long.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "That password is too easy to guess. Choose another.";
  const names = [account.username, account.email, account.email?.split("@")[0]].map((v) => v?.trim().toLowerCase()).filter((v): v is string => Boolean(v && v.length >= 4));
  if (names.some((name) => lower.includes(name))) return "The password must not contain the username or email.";
  return null;
}
