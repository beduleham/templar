import {
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  NotebookPen,
  Package,
  Store,
  type LucideIcon,
} from 'lucide-react'

export const navIcons: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'notebook-pen': NotebookPen,
  'file-spreadsheet': FileSpreadsheet,
  store: Store,
  package: Package,
  'clipboard-list': ClipboardList,
}
