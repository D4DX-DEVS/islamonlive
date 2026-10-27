import type { WPCategory } from "@/lib/wp-model";

/* Categories and tags from MongoDB, mirroring the wordpress.ts functions of the
   same names. */

export async function getCategories(perPage = 50): Promise<WPCategory[]> {
  void perPage;
  throw new Error("db/taxonomy.getCategories: not implemented");
}

export async function getAllCategories(): Promise<WPCategory[]> {
  throw new Error("db/taxonomy.getAllCategories: not implemented");
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  void slug;
  throw new Error("db/taxonomy.getCategoryBySlug: not implemented");
}

export async function getTagBySlug(slug: string): Promise<WPCategory | null> {
  void slug;
  throw new Error("db/taxonomy.getTagBySlug: not implemented");
}
