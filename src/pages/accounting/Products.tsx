import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductsStore, type Product } from "@/lib/productsStore";

const Products: React.FC = () => {
  const [list, setList] = useState<Product[]>(ProductsStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState<string>("");

  const refresh = () => setList(ProductsStore.list());
  useEffect(()=>{ refresh(); },[]);

  const startAdd = () => { setEditing(null); setName(""); setPrice(0); setDescription(""); setOpen(true); };
  const startEdit = (p: Product) => { setEditing(p); setName(p.name); setPrice(p.price); setDescription(p.description || ""); setOpen(true); };
  const remove = (id: string) => { ProductsStore.remove(id); refresh(); };
  const save = () => {
    if (!name.trim()) return;
    const p: Product = { id: editing?.id || `p_${Date.now()}`, name, price, description };
    ProductsStore.upsert(p);
    setOpen(false);
    refresh();
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Button onClick={startAdd}>Add Product</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.price.toFixed(2)}</TableCell>
                    <TableCell className="max-w-[360px] truncate" title={p.description || ""}>{p.description || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> startEdit(p)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={()=> remove(p.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
