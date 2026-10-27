/* The MongoDB implementations behind wordpress.ts, one import for its DATA_SOURCE
   switch. Server-only: wordpress.ts must stay out of client components (they
   import types and helpers from wp-model.ts instead). */
export { getPostByOldPath, getPostBySlug, getPosts, getPostsPage } from "@/lib/db/posts";
export { getPageBySlug } from "@/lib/db/pages";
export { getAllCategories, getCategories, getCategoryBySlug, getTagBySlug } from "@/lib/db/taxonomy";
export { getUserBySlug, getUsersPage, searchUsers } from "@/lib/db/users";
