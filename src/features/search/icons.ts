import { BookOpen, FileText, ImageIcon, LayoutGrid, Megaphone, Route as RouteIcon, User, type LucideIcon } from "lucide-react";

export type SearchKind = "page" | "course" | "path" | "announcement" | "survey" | "person" | "banner";

export const SEARCH_KIND_ICON: Record<SearchKind, LucideIcon> = {
  page: LayoutGrid,
  course: BookOpen,
  path: RouteIcon,
  announcement: Megaphone,
  survey: FileText,
  person: User,
  banner: ImageIcon,
};
