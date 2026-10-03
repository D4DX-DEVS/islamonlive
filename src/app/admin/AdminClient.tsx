"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLogin from "./AdminLogin";
import AdminShell from "./AdminShell";
import { Overview, type OverviewData } from "./AdminOverview";
import Articles from "./AdminArticles";
import Authors from "./AdminAuthors";
import NewArticle from "./AdminArticleForm";
import type { Author, Category, Tab } from "./ui";


export default function AdminClient({ initialUser, lostPasswordUrl }: { initialUser: string | null; lostPasswordUrl: string }) {
  const [tab, setTab] = useState<Tab>("overview"); const [overview, setOverview] = useState<OverviewData | null>(null); const [overviewError, setOverviewError] = useState(""); const [overviewLoading, setOverviewLoading] = useState(false); const [days, setDays] = useState(30); const overviewRequest = useRef(0); const [articleSearch, setArticleSearch] = useState({ query: "", status: "any", author: "", notice: "", id: 0 }); const [authors, setAuthors] = useState<Author[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [taxonomyError, setTaxonomyError] = useState(""); const [editingPostId, setEditingPostId] = useState<number | null>(null); const [publishOnOpen, setPublishOnOpen] = useState(false); const [taxonomiesLoading, setTaxonomiesLoading] = useState(false); const [taxonomiesLoaded, setTaxonomiesLoaded] = useState(false);
  const loadOverview = useCallback(async (range: number) => {
    const request = ++overviewRequest.current; const current = () => request === overviewRequest.current;
    setOverviewError(""); setOverviewLoading(true);
    try { const response = await fetch(`/api/admin/overview/?days=${range}`, { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "The overview service returned an error."); if (current()) setOverview(body); } catch (error) { if (current()) setOverviewError(error instanceof Error ? error.message : "Could not reach the overview service."); } finally { if (current()) setOverviewLoading(false); }
  }, []);
  async function loadTaxonomies() { setTaxonomiesLoading(true); setTaxonomyError(""); try { const [authorResponse, categoryResponse] = await Promise.all([fetch("/api/admin/authors/"), fetch("/api/admin/categories/")]); if (!authorResponse.ok || !categoryResponse.ok) throw new Error("The author or category service returned an error."); const [authorBody, categoryBody] = await Promise.all([authorResponse.json(), categoryResponse.json()]); setAuthors(authorBody.items || []); setCategories(categoryBody.items || []); setTaxonomiesLoaded(true); } catch (error) { setTaxonomyError(error instanceof Error ? error.message : "Could not reach the author and category service."); } finally { setTaxonomiesLoading(false); } }
  const navigate = useCallback((nextTab: Tab) => { setTab(nextTab); if (initialUser && nextTab !== "overview" && !taxonomiesLoaded && !taxonomiesLoading) void loadTaxonomies(); }, [initialUser, taxonomiesLoaded, taxonomiesLoading]);
  const openArticles = useCallback((query: string, status = "any", author = "") => { setArticleSearch((previous) => ({ query, status, author, notice: "", id: previous.id + 1 })); navigate("articles"); }, [navigate]);
  useEffect(() => {
    if (!initialUser) return;
    let cancelled = false;
    void fetch("/api/admin/overview/", { cache: "no-store" }).then(async (overviewResponse) => {
      if (cancelled) return;
      if (overviewResponse.ok) setOverview(await overviewResponse.json()); else setOverviewError((await overviewResponse.json().catch(() => ({}))).error || "The overview service returned an error.");
    }).catch(() => { if (!cancelled) setOverviewError("Could not reach the overview service."); });
    return () => { cancelled = true; };
  }, [initialUser]);
  const content = useMemo(() => { if (tab === "overview") return <Overview data={overview} loading={overviewLoading} error={overviewError} days={days} onDaysChange={(next) => { setDays(next); void loadOverview(next); }} onRefresh={() => void loadOverview(days)} onOpenArticles={(status) => openArticles("", status)} />; if (tab === "articles") return <Articles key={articleSearch.id} initialSearch={articleSearch.query} initialStatus={articleSearch.status} initialAuthor={articleSearch.author} initialNotice={articleSearch.notice} authors={authors} categories={categories} authorsLoading={taxonomiesLoading} onNew={() => { setEditingPostId(null); setPublishOnOpen(false); navigate("new"); }} onEdit={(id, shouldPublish = false) => { setEditingPostId(id); setPublishOnOpen(shouldPublish); navigate("edit"); }} />; if (tab === "new" || tab === "edit") return <NewArticle editId={tab === "edit" ? editingPostId : null} publishOnOpen={publishOnOpen} authors={authors} categories={categories} taxonomiesLoading={taxonomiesLoading} onCreated={(notice) => { setEditingPostId(null); setPublishOnOpen(false); setArticleSearch((previous) => ({ ...previous, notice: notice ?? "", id: previous.id + 1 })); navigate("articles"); }} onCancel={() => { setEditingPostId(null); setPublishOnOpen(false); navigate("articles"); }} onCategoryCreated={loadTaxonomies} />; return <Authors authors={authors} refresh={loadTaxonomies} loading={taxonomiesLoading} error={taxonomyError} onViewArticles={(id) => openArticles("", "any", String(id))} />; }, [tab, overview, overviewError, overviewLoading, days, loadOverview, articleSearch, authors, categories, editingPostId, publishOnOpen, taxonomiesLoading, taxonomyError, navigate, openArticles]);
  if (!initialUser) return <AdminLogin lostPasswordUrl={lostPasswordUrl} />;
  return <AdminShell tab={tab} setTab={(next) => { if (next === "articles" && tab !== "articles") openArticles(""); else navigate(next); }} username={initialUser} onSearch={openArticles} onLogout={async () => { await fetch("/api/admin/logout/", { method: "POST", cache: "no-store", credentials: "same-origin" }); window.location.replace("/admin/"); }}>{content}</AdminShell>;
}
