"use client";

import { useEffect, useRef, useState } from "react";
import type { Embed } from "@/lib/video-embed";
import { ImageDialog, TableDialog, VideoDialog } from "./EditorDialogs";
import { Icon, type IconName } from "./icons";
import { prepareImage, uploadMedia, type UploadedMedia } from "./media-client";

const blockTags = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "UL"]);

function rewriteEditorMediaUrl(value: string): string {
  if (!value || value.trim().toLowerCase().startsWith("data:")) return value;
  if (/^\/?wp-content\//i.test(value)) return value.startsWith("/") ? value : `/${value}`;
  try {
    const url = new URL(value, window.location.origin);
    if ((url.hostname === "islamonlive.in" || url.hostname === "www.islamonlive.in" || url.hostname === "admin.islamonlive.in") && url.pathname.startsWith("/wp-content/")) return `${url.pathname}${url.search}`;
  } catch { /* Leave malformed or non-URL values untouched. */ }
  return value;
}

function normalizeEditorMedia(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("img, source, video").forEach((element) => {
    for (const attribute of ["src", "data-src", "poster"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, rewriteEditorMediaUrl(value));
    }
    for (const attribute of ["srcset", "data-srcset"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (value.toLowerCase().includes("data:")) continue;
      element.setAttribute(attribute, value.split(",").map((candidate) => {
        const match = candidate.trim().match(/^(\S+)(\s+.*)?$/);
        return match ? `${rewriteEditorMediaUrl(match[1])}${match[2] || ""}` : candidate;
      }).join(", "));
    }
  });
}

/**
 * Classic WordPress content often stores each paragraph as a span separated
 * by blank lines. The public REST renderer wraps that same content in p tags,
 * but a contentEditable element does not: whitespace collapses into one run.
 * Add the missing block wrappers for visual editing while preserving all
 * inline markup, images and existing block markup.
 */
function normalizeEditorHtml(value: string): string {
  if (!value || typeof window === "undefined") return value;
  const document = new DOMParser().parseFromString(value, "text/html");
  const root = document.body;
  normalizeEditorMedia(root);
  if (Array.from(root.childNodes).some((node) => node.nodeType === Node.COMMENT_NODE)) return root.innerHTML;
  if (Array.from(root.children).some((element) => blockTags.has(element.tagName))) return root.innerHTML;

  const groups: ChildNode[][] = [];
  let group: ChildNode[] = [];
  const flush = () => { if (group.some((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())) groups.push(group); group = []; };
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim() && /\n/.test(node.textContent || "")) flush();
    else group.push(node);
  });
  flush();
  if (!groups.length) return root.innerHTML;
  const fragment = document.createDocumentFragment();
  groups.forEach((nodes) => { const paragraph = document.createElement("p"); nodes.forEach((node) => paragraph.appendChild(node.cloneNode(true))); fragment.appendChild(paragraph); });
  root.replaceChildren(fragment);
  return root.innerHTML;
}

const blockOptions = [{ value: "p", label: "Paragraph" }, { value: "h2", label: "Heading 2" }, { value: "h3", label: "Heading 3" }, { value: "blockquote", label: "Quote" }, { value: "pre", label: "Preformatted" }];

type Dialog = "image" | "video" | "table";
type ToolbarAction = { label: string; command?: string; value?: string; dialog?: Dialog; icon?: IconName; glyph?: React.ReactNode };

const bold: ToolbarAction = { label: "Bold", command: "bold", glyph: <span className="text-[15px] font-extrabold">B</span> };
const italic: ToolbarAction = { label: "Italic", command: "italic", glyph: <span className="font-serif text-[15px] font-semibold italic">I</span> };
const underline: ToolbarAction = { label: "Underline", command: "underline", glyph: <span className="text-[15px] font-semibold underline underline-offset-2">U</span> };
const strikethrough: ToolbarAction = { label: "Strikethrough", command: "strikeThrough", glyph: <span className="text-[15px] font-semibold line-through">S</span> };
const bulletList: ToolbarAction = { label: "Bulleted list", command: "insertUnorderedList", icon: "listUl" };
const numberList: ToolbarAction = { label: "Numbered list", command: "insertOrderedList", icon: "listOl" };
const quote: ToolbarAction = { label: "Quote", command: "formatBlock", value: "blockquote", icon: "quote" };
const link: ToolbarAction = { label: "Insert link", command: "createLink", icon: "link" };
const image: ToolbarAction = { label: "Insert image", dialog: "image", icon: "image" };

/** The full set for articles; bios get the short one. */
const fullToolbar: ToolbarAction[][] = [
  [bold, italic, underline, strikethrough],
  [bulletList, numberList, quote],
  [{ label: "Align center", command: "justifyCenter", icon: "alignCenter" }, { label: "Align right", command: "justifyRight", icon: "alignRight" }],
  [link, image, { label: "Insert video", dialog: "video", icon: "video" }, { label: "Insert table", dialog: "table", icon: "table" }],
  [{ label: "Undo", command: "undo", icon: "undo" }, { label: "Redo", command: "redo", icon: "redo" }, { label: "Clear formatting", command: "removeFormat", icon: "clearFormat" }],
];
const compactToolbar: ToolbarAction[][] = [[bold, italic, underline], [bulletList, numberList, quote], [link, image]];

function imageHtml(media: UploadedMedia): string {
  const element = document.createElement("img");
  element.src = rewriteEditorMediaUrl(media.url);
  element.alt = media.alt;
  element.className = `wp-image-${media.id}`; // lets WordPress add responsive sizes when it renders the article
  if (media.width && media.height) { element.width = media.width; element.height = media.height; }
  return element.outerHTML;
}

function videoHtml(embed: Embed): string {
  const frame = document.createElement("iframe");
  frame.src = embed.src;
  frame.title = `${embed.provider[0].toUpperCase()}${embed.provider.slice(1)} video player`;
  frame.width = "560"; frame.height = "315"; frame.loading = "lazy"; frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
  frame.setAttribute("frameborder", "0");
  return `<p>${frame.outerHTML}</p>`;
}

function tableHtml(rows: number, columns: number, header: boolean): string {
  const cells = (tag: string) => `<tr>${`<${tag}><br></${tag}>`.repeat(columns)}</tr>`;
  const body = Array.from({ length: header ? rows - 1 : rows }, () => cells("td")).join("");
  return `<table style="border-collapse: collapse; width: 100%;" border="1" cellpadding="6">${header ? `<thead>${cells("th")}</thead>` : ""}<tbody>${body}</tbody></table><p><br></p>`;
}

const imageFiles = (files?: FileList | null) => Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));

/** Words and characters of the visible text, tags and entities excluded. */
function countText(html: string): { words: number; characters: number } {
  if (!html) return { words: 0, characters: 0 };
  const text = (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").trim();
  return { words: text ? text.split(/\s+/).length : 0, characters: text.length };
}

export default function HtmlEditor({ label, value, onChange, minHeight = "min-h-72", helpText, required = false, placeholder = "Start writing your content here…", compact = false }: { label: string; value: string; onChange: (value: string) => void; minHeight?: string; helpText?: string; required?: boolean; placeholder?: string; /** A shorter toolbar, for short text such as an author bio. */ compact?: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  /** Where the caret was when a dialog took focus away, so the insert lands there. */
  const savedRange = useRef<Range | null>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [block, setBlock] = useState("p");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<{ kind: "busy" | "error"; text: string } | null>(null);
  const displayValue = normalizeEditorHtml(value);
  const { words, characters } = countText(value);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== displayValue) editorRef.current.innerHTML = displayValue;
    lastValue.current = displayValue;
  }, [displayValue, mode]);
  useEffect(() => {
    // Mirror the paragraph style at the caret in the style picker.
    const sync = () => {
      if (!editorRef.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      const current = String(document.queryCommandValue("formatBlock")).toLowerCase().replace("heading ", "h");
      setBlock(blockOptions.some((option) => option.value === current) ? current : "p");
    };
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);
  function commit() { const html = editorRef.current?.innerHTML || ""; lastValue.current = html; onChange(html); }
  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    if (command === "createLink") { const url = window.prompt("Link URL"); if (url) document.execCommand(command, false, url); }
    else document.execCommand(command, false, commandValue);
    commit();
  }
  function rememberCaret() {
    const selection = window.getSelection();
    savedRange.current = selection?.rangeCount && editorRef.current?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  }
  function openDialog(next: Dialog) { rememberCaret(); setDialog(next); }
  /** Puts HTML at the remembered caret, else at the caret, else at the end of the text. */
  function insertHtml(html: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (savedRange.current) { selection?.removeAllRanges(); selection?.addRange(savedRange.current); }
    else if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) { const end = document.createRange(); end.selectNodeContents(editor); end.collapse(false); selection?.removeAllRanges(); selection?.addRange(end); }
    savedRange.current = null;
    document.execCommand("insertHTML", false, html);
    commit();
  }
  function insertFromDialog(html: string) { setDialog(null); insertHtml(html); }
  /** Uploads pictures pasted or dropped into the text and puts them in as they finish. */
  async function addImages(files: File[]) {
    setNotice({ kind: "busy", text: files.length > 1 ? `Uploading ${files.length} images…` : "Uploading image…" });
    try {
      for (const file of files) insertHtml(imageHtml(await uploadMedia(await prepareImage(file), "image")));
      setNotice(null);
    } catch (failure) {
      setNotice({ kind: "error", text: failure instanceof Error ? failure.message : "The image could not be uploaded." });
    }
  }
  const toolButton = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-700";
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <span className="block text-sm font-semibold">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-semibold">
        <button type="button" aria-pressed={mode === "visual"} onClick={() => setMode("visual")} className={`min-h-10 px-4 py-1.5 transition ${mode === "visual" ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Visual</button>
        <button type="button" aria-pressed={mode === "html"} onClick={() => setMode("html")} className={`min-h-10 px-4 py-1.5 transition ${mode === "html" ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>HTML</button>
      </div>
    </div>
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
      {mode === "visual" ? <>
        <div role="toolbar" aria-label="Formatting" className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white p-1.5">
          <label className="relative mr-1 flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm text-slate-800 hover:bg-slate-50">
            {blockOptions.find((option) => option.value === block)?.label}
            <Icon name="chevronDown" className="ml-2 h-4 w-4 text-slate-500" strokeWidth={2} />
            <select aria-label="Text style" value={block} onChange={(event) => { setBlock(event.target.value); run("formatBlock", event.target.value); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">{blockOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </label>
          {(compact ? compactToolbar : fullToolbar).map((group, index) => <div key={index} className="flex shrink-0 items-center border-l border-slate-200 pl-1">
            {group.map((action) => <button type="button" key={action.label} aria-label={action.label} title={action.label} onMouseDown={(event) => event.preventDefault()} onClick={() => (action.dialog ? openDialog(action.dialog) : run(action.command!, action.value))} className={toolButton}>{action.icon ? <Icon name={action.icon} className="h-[18px] w-[18px]" /> : action.glyph}</button>)}
          </div>)}
        </div>
        {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${notice.kind === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-violet-100 bg-violet-50 text-violet-800"}`}><span>{notice.text}</span>{notice.kind === "error" && <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold hover:underline">Dismiss</button>}</p>}
        <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder} onInput={(event) => { const html = event.currentTarget.innerHTML; const next = html === "<br>" ? "" : html; if (!next) event.currentTarget.innerHTML = ""; lastValue.current = next; onChange(next); }}
          onPaste={(event) => { const pictures = imageFiles(event.clipboardData.files); if (!pictures.length) return; event.preventDefault(); rememberCaret(); void addImages(pictures); }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
          onDrop={(event) => { const pictures = imageFiles(event.dataTransfer.files); if (!pictures.length) return; event.preventDefault(); const range = document.caretRangeFromPoint?.(event.clientX, event.clientY); if (range && editorRef.current?.contains(range.startContainer)) savedRange.current = range; else rememberCaret(); void addImages(pictures); }}
          className={`${minHeight} prose prose-slate prose-sm max-w-none overflow-x-auto px-4 py-3 leading-relaxed outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] prose-headings:font-display prose-a:text-violet-700 prose-img:mx-auto prose-img:max-w-full [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_img]:h-auto [&_img]:max-w-full sm:prose-base`} />
      </> : <textarea aria-label={`${label} (HTML)`} className={`${minHeight} block w-full resize-y bg-white px-4 py-3 font-mono text-xs outline-none`} value={displayValue} onChange={(event) => onChange(event.target.value)} />}
      <div className="flex justify-end gap-5 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-500"><span>Words: {words.toLocaleString()}</span><span>Characters: {characters.toLocaleString()}</span></div>
    </div>
    {helpText && <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>}
    {dialog === "image" && <ImageDialog onClose={() => setDialog(null)} onInsert={(media) => insertFromDialog(imageHtml(media))} />}
    {dialog === "video" && <VideoDialog onClose={() => setDialog(null)} onInsert={(embed) => insertFromDialog(videoHtml(embed))} />}
    {dialog === "table" && <TableDialog onClose={() => setDialog(null)} onInsert={(rows, columns, header) => insertFromDialog(tableHtml(rows, columns, header))} />}
  </div>;
}
