import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Eye, Mail, Printer } from 'lucide-react';
import { CompanySettingsStore } from '@/lib/companySettings';
import { generatePayslipPdf } from '@/lib/payslipPdf';

interface PayslipData {
  employee: string;
  employeeId: string;
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: string;
}

interface ProfessionalPayslipPreviewProps {
  payroll: PayslipData;
  showActions?: boolean;
}

const ProfessionalPayslipPreview: React.FC<ProfessionalPayslipPreviewProps> = ({ 
  payroll, 
  showActions = true 
}) => {
  const cs = CompanySettingsStore.get();
  const gross = payroll.basicSalary + payroll.allowances;
  const primaryColor = cs.primaryColor || "#2563eb";
  const secondaryColor = cs.secondaryColor || "#64748b";

  return (
    <div
      className="max-w-4xl mx-auto"
      style={{
        // Same brand source as the invoice and quotation documents.
        ['--brand' as string]: cs.primaryColor || '#128768',
        ['--brand-2' as string]: cs.secondaryColor || '#1BA37E',
      }}
    >
      {/* Professional Header */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-lg">
        {/* Header Section */}
        <div className="relative">
          {/* Colored header background */}
          <div 
            className="p-6 text-white text-center"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                {/* Logo with white background */}
                {cs.logoDataUrl && (
                  <div className="bg-white p-5 rounded-lg shadow-sm">
                    <img src={cs.logoDataUrl} alt="Company Logo" className="h-24 w-auto object-contain" />
                  </div>
                )}
                <div className="text-left">
                  <h1 className="text-3xl font-bold mb-2">PAYSLIP</h1>
                  <p className="text-sm opacity-90">CONFIDENTIAL - EMPLOYEE PAYMENT RECORD</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-medium">{cs.name || "Company Name"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Period Information */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex justify-between items-center">
            <div className="text-sm space-y-1">
              <p><strong>Pay Period:</strong> {payroll.paymentDate}</p>
              <p><strong>Generated:</strong> {new Date().toLocaleDateString('en-GB')}</p>
            </div>
            <div className="text-right space-y-1">
              <Badge variant={payroll.status === 'Paid' ? 'default' : 'secondary'}>
                {payroll.status.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground">Tax Year: {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>

        {/* Employee Details */}
        <div className="p-6 border-b">
          <div 
            className="px-4 py-2 text-white font-medium rounded-t-md"
            style={{ backgroundColor: primaryColor }}
          >
            EMPLOYEE DETAILS
          </div>
          <div className="border border-t-0 rounded-b-md p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{payroll.employee}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-medium">{payroll.employeeId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{payroll.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Date</p>
                <p className="font-medium">{payroll.paymentDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pay Method</p>
                <p className="font-medium">Bank Transfer</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax Year</p>
                <p className="font-medium">{new Date().getFullYear()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Earnings and Deductions */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Earnings Section */}
            <div>
              <div 
                className="px-4 py-2 text-white font-medium rounded-t-md"
                style={{ backgroundColor: primaryColor }}
              >
                EARNINGS
              </div>
              <div className="border border-t-0 rounded-b-md p-4 bg-gray-50">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Basic Salary</span>
                    <span className="font-medium">{cs.currencySymbol || "R"}{payroll.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Allowances</span>
                    <span className="font-medium">{cs.currencySymbol || "R"}{payroll.allowances.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Gross Pay</span>
                      <span>{cs.currencySymbol || "R"}{gross.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deductions Section */}
            <div>
              <div 
                className="px-4 py-2 text-white font-medium rounded-t-md"
                style={{ backgroundColor: secondaryColor }}
              >
                DEDUCTIONS
              </div>
              <div className="border border-t-0 rounded-b-md p-4 bg-gray-50">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">PAYE Tax</span>
                    <span className="font-medium">{cs.currencySymbol || "R"}{Math.round(payroll.deductions * 0.7).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">UIF Contributions</span>
                    <span className="font-medium">{cs.currencySymbol || "R"}{Math.round(payroll.deductions * 0.1).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Other Deductions</span>
                    <span className="font-medium">{cs.currencySymbol || "R"}{Math.round(payroll.deductions * 0.2).toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total Deductions</span>
                      <span>{cs.currencySymbol || "R"}{payroll.deductions.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight */}
          <div className="mt-6">
            <div className="bg-[color:var(--brand)] text-white p-4 rounded-lg text-center">
              <p className="text-sm font-medium mb-1">NET PAY</p>
              <p className="text-2xl font-bold">
                {cs.currencySymbol || "R"}{payroll.netSalary.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-gray-700">{cs.name || "Company Name"}</p>
              {cs.address && <p>{cs.address}</p>}
              {cs.phone && <p>Tel: {cs.phone}</p>}
              {cs.email && <p>Email: {cs.email}</p>}
              {cs.taxId && <p>Tax ID: {cs.taxId}</p>}
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-700">Legal Notice</p>
              <p>This document contains confidential financial information.</p>
              <p>Unauthorized distribution is prohibited.</p>
              <p>This is a computer-generated payslip and does not require a physical signature.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => generatePayslipPdf(payroll)} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfessionalPayslipPreview;
