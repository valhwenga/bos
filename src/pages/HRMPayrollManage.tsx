import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useCache } from "@/lib/collectionCache";
import { payrollCache } from "@/lib/payrollStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PayrollStore, type PayrollEntry } from "@/lib/payrollStore";
import { UsersStore } from "@/lib/usersStore";
import { HRMStore, type Employee } from "@/lib/hrmStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { generatePayslipPdf } from "@/lib/payslipPdf";
import { Plus, Edit, Trash2, Eye, Calculator, DollarSign, Play, CheckCircle } from "lucide-react";

const HRMPayrollManage = () => {
  // Entries come from Postgres via a cache, so this re-renders when they arrive.
  const { rows: payrollList } = useCache(payrollCache);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const [search, setSearch] = useState("");
  const [processingPayroll, setProcessingPayroll] = useState(false);
  
  const employees = HRMStore.list();
  const users = UsersStore.list();
  const cs = CompanySettingsStore.get();

  const [form, setForm] = useState<Omit<PayrollEntry, 'id' | 'createdAt' | 'netSalary'>>({
    employeeId: "",
    employee: "",
    department: "",
    basicSalary: 0,
    allowances: {
      housing: 0,
      transport: 0,
      medical: 0,
      bonus: 0,
      other: 0
    },
    deductions: {
      paye: 0,
      ui: 0,
      pension: 0,
      medical: 0,
      other: 0
    },
    overtime: {
      hours: 0,
      rate: 1.5,
      amount: 0
    },
    paymentDate: new Date().toISOString().slice(0, 10),
    status: "draft",
    notes: ""
  });

  useEffect(() => {
    void payrollCache.refresh();
  }, []);

  const filtered = payrollList.filter(p => 
    p.employee.toLowerCase().includes(search.toLowerCase()) ||
    p.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      employeeId: "",
      employee: "",
      department: "",
      basicSalary: 0,
      allowances: {
        housing: 0,
        transport: 0,
        medical: 0,
        bonus: 0,
        other: 0
      },
      deductions: {
        paye: 0,
        ui: 0,
        pension: 0,
        medical: 0,
        other: 0
      },
      overtime: {
        hours: 0,
        rate: 1.5,
        amount: 0
      },
      paymentDate: new Date().toISOString().slice(0, 10),
      status: "draft",
      notes: ""
    });
    setEditing(null);
  };

  const startEdit = (entry: PayrollEntry) => {
    setForm(entry);
    setEditing(entry);
    setOpen(true);
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      // Parse salary from employee record or default to 0
      const salary = employee.salary ? parseFloat(employee.salary.replace(/,/g, '')) : 0;
      
      setForm({
        ...form,
        employeeId: employee.id,
        employee: employee.name,
        department: employee.department || "",
        basicSalary: salary,
        // Pre-fill some defaults based on employee data
        allowances: {
          ...form.allowances,
          housing: salary * 0.05, // 5% of basic salary as housing allowance
          transport: salary * 0.03, // 3% of basic salary as transport allowance
        },
        deductions: {
          ...form.deductions,
          paye: salary * 0.20, // 20% PAYE tax (example rate)
          ui: salary * 0.01, // 1% Unemployment Insurance
          pension: salary * 0.075, // 7.5% Pension contribution
        }
      });
    }
  };

  const getSelectedEmployee = () => {
    return employees.find(e => e.id === form.employeeId);
  };

  const save = async () => {
    if (!form.employeeId || !form.employee || form.basicSalary <= 0) {
      alert("Please fill in required fields");
      return;
    }

    const totals = PayrollStore.calculateTotals(form as PayrollEntry);
    const entry: PayrollEntry = {
      id: editing?.id || `PAY_${Date.now()}`,
      employeeId: form.employeeId,
      employee: form.employee,
      department: form.department,
      basicSalary: form.basicSalary,
      allowances: form.allowances,
      deductions: form.deductions,
      overtime: {
        hours: form.overtime.hours,
        rate: form.overtime.rate,
        amount: form.overtime.hours * form.overtime.rate * form.basicSalary / 160 // Assuming 160 hours/month
      },
      netSalary: totals.net,
      paymentDate: form.paymentDate,
      status: form.status as "draft" | "pending" | "approved" | "paid",
      createdAt: editing?.createdAt || new Date().toISOString(),
      notes: form.notes
    };

    try {
      await PayrollStore.upsert(entry);
    } catch (err) {
      toast({
        title: "Could not save the payroll entry",
        description: err instanceof Error ? err.message : "Nothing was saved.",
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    resetForm();
  };

  const deleteEntry = (id: string) => {
    if (confirm("Are you sure you want to delete this payroll entry?")) {
      void PayrollStore.remove(id).catch((err: unknown) =>
      toast({
        title: "Could not delete the entry",
        description: err instanceof Error ? err.message : "The entry is unchanged.",
        variant: "destructive",
      }),
    );
    }
  };

  const updateStatus = (id: string, status: PayrollEntry['status']) => {
    const entry = PayrollStore.get(id);
    if (entry) {
      void PayrollStore.upsert({ ...entry, status }).catch((err: unknown) =>
      toast({
        title: "Could not change the status",
        description: err instanceof Error ? err.message : "The entry is unchanged.",
        variant: "destructive",
      }),
    );
    }
  };

  const sumAmounts = (parts: Record<string, number>) =>
    Object.values(parts).reduce((total, amount) => total + (amount || 0), 0);

  const printPayslip = (entry: PayrollEntry) => {
    // The payslip takes allowance and deduction totals; the entry itemises
    // them (housing, transport, PAYE, UI, …), so collapse each side first.
    // Overtime is paid on top of basic rather than being an allowance line.
    generatePayslipPdf({
      employee: entry.employee,
      employeeId: entry.employeeId,
      department: entry.department,
      basicSalary: entry.basicSalary,
      allowances: sumAmounts(entry.allowances) + (entry.overtime?.amount || 0),
      deductions: sumAmounts(entry.deductions),
      netSalary: entry.netSalary,
      status: entry.status,
      paymentDate: new Date().toLocaleDateString('en-GB')
    });
  };

  const processPayroll = async () => {
    setProcessingPayroll(true);
    try {
      // Get all pending payroll entries
      const pendingEntries = payrollList.filter(entry => entry.status === 'pending');
      
      if (pendingEntries.length === 0) {
        alert('No pending payroll entries to process');
        return;
      }

      // Simulate processing (in real app, this would integrate with payment systems)
      for (const entry of pendingEntries) {
        // Update status to 'paid'
        updateStatus(entry.id, 'paid');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      alert(`Successfully processed ${pendingEntries.length} payroll entries`);
    } catch (error) {
      console.error('Error processing payroll:', error);
      alert('Error processing payroll. Please try again.');
    } finally {
      setProcessingPayroll(false);
    }
  };

  const approveAllPayroll = () => {
    const pendingEntries = payrollList.filter(entry => entry.status === 'pending');
    
    if (pendingEntries.length === 0) {
      alert('No pending payroll entries to approve');
      return;
    }

    if (confirm(`Approve ${pendingEntries.length} pending payroll entries?`)) {
      pendingEntries.forEach(entry => {
        updateStatus(entry.id, 'approved');
      });
      alert(`Approved ${pendingEntries.length} payroll entries`);
    }
  };

  const totals = PayrollStore.calculateTotals(form as PayrollEntry);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Payroll Management</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={approveAllPayroll} variant="outline">
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve All
            </Button>
            <Button onClick={processPayroll} disabled={processingPayroll}>
              <Play className="w-4 h-4 mr-2" />
              {processingPayroll ? 'Processing...' : 'Process Payroll'}
            </Button>
            <Button onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Payroll Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.employee}</div>
                      <div className="text-sm text-muted-foreground">{entry.employeeId}</div>
                    </div>
                  </TableCell>
                  <TableCell>{entry.department}</TableCell>
                  <TableCell>{cs.currencySymbol}{entry.basicSalary.toLocaleString()}</TableCell>
                  <TableCell>{cs.currencySymbol}{Object.values(entry.allowances).reduce((sum, val) => sum + val, 0).toLocaleString()}</TableCell>
                  <TableCell>{cs.currencySymbol}{Object.values(entry.deductions).reduce((sum, val) => sum + val, 0).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{cs.currencySymbol}{entry.netSalary.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === 'paid' ? 'default' : entry.status === 'approved' ? 'secondary' : 'outline'}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => printPayslip(entry)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(entry)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteEntry(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payroll Entry" : "Add Payroll Entry"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* Employee Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={form.employeeId} onValueChange={handleEmployeeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id}) - {emp.designation || 'No designation'} - {emp.department || 'No department'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g., Engineering"
                />
              </div>
            </div>

            {/* Employee Details Display */}
            {form.employeeId && (() => {
              const emp = getSelectedEmployee();
              return emp ? (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-sm">Employee Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{emp.email || 'Not specified'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <div className="font-medium">{emp.phone || 'Not specified'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Designation:</span>
                      <div className="font-medium">{emp.designation || 'Not specified'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Joining Date:</span>
                      <div className="font-medium">{emp.joiningDate || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Salary Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Salary Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Basic Salary ({cs.currencySymbol})</Label>
                  <Input
                    type="number"
                    value={form.basicSalary}
                    onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as PayrollEntry['status'] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Allowances Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Allowances & Bonuses
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Housing</Label>
                  <Input
                    type="number"
                    value={form.allowances.housing}
                    onChange={(e) => setForm({ ...form, allowances: { ...form.allowances, housing: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Transport</Label>
                  <Input
                    type="number"
                    value={form.allowances.transport}
                    onChange={(e) => setForm({ ...form, allowances: { ...form.allowances, transport: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Medical</Label>
                  <Input
                    type="number"
                    value={form.allowances.medical}
                    onChange={(e) => setForm({ ...form, allowances: { ...form.allowances, medical: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Bonus</Label>
                  <Input
                    type="number"
                    value={form.allowances.bonus}
                    onChange={(e) => setForm({ ...form, allowances: { ...form.allowances, bonus: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Other</Label>
                  <Input
                    type="number"
                    value={form.allowances.other}
                    onChange={(e) => setForm({ ...form, allowances: { ...form.allowances, other: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Deductions Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Deductions
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>PAYE Tax</Label>
                  <Input
                    type="number"
                    value={form.deductions.paye}
                    onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, paye: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>UI (Unemployment)</Label>
                  <Input
                    type="number"
                    value={form.deductions.ui}
                    onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, ui: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Pension</Label>
                  <Input
                    type="number"
                    value={form.deductions.pension}
                    onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, pension: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Medical Aid</Label>
                  <Input
                    type="number"
                    value={form.deductions.medical}
                    onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, medical: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Other Deductions</Label>
                  <Input
                    type="number"
                    value={form.deductions.other}
                    onChange={(e) => setForm({ ...form, deductions: { ...form.deductions, other: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Overtime Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Overtime</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    value={form.overtime.hours}
                    onChange={(e) => setForm({ ...form, overtime: { ...form.overtime, hours: parseFloat(e.target.value) || 0 } })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Rate (multiplier)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.overtime.rate}
                    onChange={(e) => setForm({ ...form, overtime: { ...form.overtime, rate: parseFloat(e.target.value) || 0 } })}
                    placeholder="1.5"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Amount ({cs.currencySymbol})</Label>
                  <Input
                    type="number"
                    value={form.overtime.hours * form.overtime.rate * form.basicSalary / 160}
                    readOnly
                    placeholder="Calculated automatically"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add any notes or comments..."
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-3">Payroll Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Basic Salary:</span>
                  <div className="font-medium">{cs.currencySymbol}{form.basicSalary.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Allowances:</span>
                  <div className="font-medium">{cs.currencySymbol}{Object.values(form.allowances).reduce((sum, val) => sum + val, 0).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Deductions:</span>
                  <div className="font-medium">{cs.currencySymbol}{Object.values(form.deductions).reduce((sum, val) => sum + val, 0).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Salary:</span>
                  <div className="font-bold text-lg">{cs.currencySymbol}{totals.net.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>
              {editing ? "Update" : "Save"} Payroll Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRMPayrollManage;
