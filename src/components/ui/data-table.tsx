import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface Column<T> {
  /** Stable key; also the sort key unless `sortValue` is given. */
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Return a primitive to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  /** Hide below the `sm` breakpoint to keep narrow screens readable. */
  hideOnMobile?: boolean;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Fields searched by the search box. Omit to hide search. */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  isLoading?: boolean;
  /** Shown when there are no rows at all (as opposed to none matching a filter). */
  empty?: { title: string; description?: string; action?: React.ReactNode };
  /** Extra controls rendered next to the search box. */
  toolbar?: React.ReactNode;
  className?: string;
}

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

const compare = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * One table implementation for every list in the app: search, sort, pagination,
 * loading and empty states. Pages previously hand-rolled bare <table> markup
 * with none of these, which is the main reason list screens felt unfinished.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchAccessor,
  searchPlaceholder = "Search…",
  onRowClick,
  pageSize = 25,
  isLoading = false,
  empty,
  toolbar,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(null);
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    if (!searchAccessor || !query.trim()) return rows;
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => searchAccessor(row).toLowerCase().includes(needle));
  }, [rows, query, searchAccessor]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    // Copy first: Array.sort mutates, and `rows` belongs to the caller.
    return [...filtered].sort((a, b) => compare(column.sortValue!(a), column.sortValue!(b)) * factor);
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  // Filtering can shorten the list past the current page.
  React.useEffect(() => setPage(0), [query, rows.length]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((prev) =>
      prev?.columnId === column.id
        ? prev.direction === "asc"
          ? { columnId: column.id, direction: "desc" }
          : null
        : { columnId: column.id, direction: "asc" },
    );
  };

  const showToolbar = Boolean(searchAccessor || toolbar);
  const isFiltered = Boolean(query.trim());

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchAccessor && (
            <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 pl-8 pr-8"
              />
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs text-muted-foreground transition-colors duration-fast hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {/* Filters wrap and share the row rather than being pushed off it. */}
          {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="scrollbar-subtle overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                {columns.map((column) => {
                  const active = sort?.columnId === column.id;
                  const SortIcon = active && sort?.direction === "desc" ? ArrowDown : ArrowUp;
                  return (
                    <th
                      key={column.id}
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                        column.align === "right" ? "text-right" : "text-left",
                        column.hideOnMobile && "hidden sm:table-cell",
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-xs transition-colors duration-fast hover:text-foreground",
                            active && "text-foreground",
                            column.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {column.header}
                          <SortIcon
                            className={cn("h-3 w-3 transition-opacity duration-fast", active ? "opacity-100" : "opacity-0")}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className="border-b border-border last:border-0">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn("px-3 py-3", column.hideOnMobile && "hidden sm:table-cell")}
                      >
                        <Skeleton className="h-4 w-full max-w-[10rem]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    {isFiltered ? (
                      <EmptyState
                        variant="search"
                        icon={Search}
                        title={`No results for “${query}”`}
                        description="Check the spelling or try a different term."
                        action={
                          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                            Clear search
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Inbox}
                        title={empty?.title ?? "Nothing here yet"}
                        description={empty?.description}
                        action={empty?.action}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-border last:border-0",
                      onRowClick && "cursor-pointer transition-colors duration-fast hover:bg-surface-raised",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-3 py-2.5 text-foreground",
                          column.align === "right" && "text-right",
                          column.hideOnMobile && "hidden sm:table-cell",
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
