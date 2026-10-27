import type { WPPage_, WPUser } from "@/lib/wp-model";

/* Authors from MongoDB, mirroring the wordpress.ts functions of the same names. */

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  void slug;
  throw new Error("db/users.getUserBySlug: not implemented");
}

export async function getUsersPage(page = 1, perPage = 60): Promise<WPPage_<WPUser>> {
  void page;
  void perPage;
  throw new Error("db/users.getUsersPage: not implemented");
}

export async function searchUsers(q: string): Promise<WPUser[]> {
  void q;
  throw new Error("db/users.searchUsers: not implemented");
}
