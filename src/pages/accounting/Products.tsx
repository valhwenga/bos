import React, { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useCache } from "@/lib/collectionCache";
import { Package, Pencil, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { productsCache, ProductsStore, type Product } from "@/lib/productsStore";

const Products: React.FC = () => {
  // Rows come from Postgres via a cache, so this re-renders when they arrive.
  const { rows: list } = useCache(productsCache);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState<string>("");

  const refresh = () => void productsCache.refresh();
  useEffect(()=>{ refresh(); },[]);

  const startAdd = () => { setEditing(null); setName(""); setPrice(0); setDescription(""); setOpen(true); };
  const startEdit = (p: Product) => { setEditing(p); setName(p.name); setPrice(p.price); setDescription(p.description || ""); setOpen(true); };
  const remove = (id: string) => {
    const ok = window.confirm("Delete this product? This action cannot be undone.");
    if (!ok) return;
    void ProductsStore.remove(id).catch((err: unknown) =>
      toast({
        title: "Could not delete product",
        description: err instanceof Error ? err.message : "The product is unchanged.",
        variant: "destructive",
      }),
    );
  };
  const save = async () => {
    if (!name.trim()) return;
    const p: Product = { id: editing?.id || `p_${Date.now()}`, name, price, description };
    try {
      await ProductsStore.upsert(p);
    } catch (err) {
      toast({
        title: "Could not save product",
        description: err instanceof Error ? err.message : "Nothing was saved.",
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    refresh();
  };

  const currency = CompanySettingsStore.get().currencySymbol || "";

  const columns: Column<Product>[] = [
    { id: "name", header: "Name", sortValue: (p) => p.name, cell: (p) => <span className="font-medium">{p.name}</span> },
    {
      id: "price",
      header: "Price",
      align: "right",
      sortValue: (p) => p.price,
      cell: (p) => `${currency}${p.price.toFixed(2)}`,
    },
    {
      id: "description",
      header: "Description",
      hideOnMobile: true,
      cell: (p) => (
        <span className="block max-w-md truncate text-muted-foreground" title={p.description || ""}>
          {p.description || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (p) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            onClick={() => remove(p.id)}
            aria-label={`Delete ${p.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const averagePrice = list.length ? list.reduce((sum, p) => sum + p.price, 0) / list.length : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Products"
        description="The items and services you can add to quotes and invoices."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Products" }]}
        actions={<Button onClick={startAdd}>Add product</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Products" value={list.length} hint="Available to bill" icon={Package} />
          <StatCard
            label="Average price"
            value={`${currency}${averagePrice.toFixed(2)}`}
            hint={list.length ? `Across ${list.length} item${list.length === 1 ? "" : "s"}` : "Nothing priced yet"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(p) => p.id}
        searchAccessor={(p) => `${p.name} ${p.description ?? ""}`}
        searchPlaceholder="Search products…"
        onRowClick={startEdit}
        empty={{
          title: "No products yet",
          description: "Add the items or services you sell so they're one click away on a quote.",
          action: <Button onClick={startAdd}>Add product</Button>,
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={(e)=> setName(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Price</label>
              <Input type="number" value={price} onChange={(e)=> setPrice(parseFloat(e.target.value||"0"))} />
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Short description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
