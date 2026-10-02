import { Icon, type IconName } from "./icons";

/** A card heading: a violet icon tile and a title. */
export function CardTitle({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon name={icon} className="h-5 w-5" /></span><h2 className="text-base font-bold text-[#12093a]">{children}</h2></div>;
}

export function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return <span className="block text-sm font-semibold text-slate-900">{children}{required && <span className="text-red-500"> *</span>}</span>;
}
