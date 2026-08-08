export type Industry = {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: {
    hasInventory: boolean;
    hasProjects: boolean;
    hasHRM: boolean;
    hasAccounting: boolean;
    hasCRM: boolean;
    hasSupport: boolean;
    hasPOS: boolean;
    hasWhatsApp: boolean;
    hasEmail: boolean;
    hasInvoicing: boolean;
    hasPayroll: boolean;
    hasTimeTracking: boolean;
    hasExpenses: boolean;
    hasReports: boolean;
  };
  defaultModules: {
    dashboard: boolean;
    hrm: boolean;
    accounting: boolean;
    projects: boolean;
    crm: boolean;
    support: boolean;
    inventory: boolean;
  };
  themes: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    cardStyle: 'default' | 'modern' | 'minimal' | 'corporate';
  };
  terminology: {
    customer: string;
    invoice: string;
    quote: string;
    employee: string;
    project: string;
    task: string;
    product: string;
    service: string;
  };
};

export const INDUSTRIES: Industry[] = [
  {
    id: 'technology',
    name: 'Technology',
    description: 'Software development, IT services, and technology solutions',
    icon: '💻',
    features: {
      hasInventory: false,
      hasProjects: true,
      hasHRM: true,
      hasAccounting: true,
      hasCRM: true,
      hasSupport: true,
      hasPOS: false,
      hasWhatsApp: false,
      hasEmail: true,
      hasInvoicing: true,
      hasPayroll: true,
      hasTimeTracking: true,
      hasExpenses: true,
      hasReports: true,
    },
    defaultModules: {
      dashboard: true,
      hrm: true,
      accounting: true,
      projects: true,
      crm: true,
      support: true,
      inventory: false,
    },
    themes: {
      primaryColor: '#8B5CF6',
      secondaryColor: '#A855F7',
      accentColor: '#6366F1',
      backgroundColor: '#0F172A',
      textColor: '#E2E8F0',
      borderColor: '#1E293B',
      cardStyle: 'modern',
    },
    terminology: {
      customer: 'Client',
      invoice: 'Invoice',
      quote: 'Proposal',
      employee: 'Team Member',
      project: 'Project',
      task: 'Task',
      product: 'Product',
      service: 'Service',
    },
  },
  {
    id: 'cleaning-residential',
    name: 'Residential Cleaning',
    description: 'Home cleaning services for residential properties',
    icon: '🏠',
    features: {
      hasInventory: true,
      hasProjects: false,
      hasHRM: true,
      hasAccounting: true,
      hasCRM: true,
      hasSupport: true,
      hasPOS: true,
      hasWhatsApp: true,
      hasEmail: true,
      hasInvoicing: true,
      hasPayroll: true,
      hasTimeTracking: true,
      hasExpenses: true,
      hasReports: true,
    },
    defaultModules: {
      dashboard: true,
      hrm: true,
      accounting: true,
      projects: false,
      crm: true,
      support: true,
      inventory: true,
    },
    themes: {
      primaryColor: '#2563EB',
      secondaryColor: '#3B82F6',
      accentColor: '#10B981',
      backgroundColor: '#F8FAFC',
      textColor: '#1E293B',
      borderColor: '#E2E8F0',
      cardStyle: 'default',
    },
    terminology: {
      customer: 'Homeowner',
      invoice: 'Invoice',
      quote: 'Quote',
      employee: 'Cleaner',
      project: 'Job',
      task: 'Task',
      product: 'Supply',
      service: 'Service',
    },
  },
  {
    id: 'cleaning-commercial',
    name: 'Commercial Cleaning',
    description: 'Professional cleaning services for businesses and offices',
    icon: '🏢',
    features: {
      hasInventory: true,
      hasProjects: false,
      hasHRM: true,
      hasAccounting: true,
      hasCRM: true,
      hasSupport: true,
      hasPOS: true,
      hasWhatsApp: true,
      hasEmail: true,
      hasInvoicing: true,
      hasPayroll: true,
      hasTimeTracking: true,
      hasExpenses: true,
      hasReports: true,
    },
    defaultModules: {
      dashboard: true,
      hrm: true,
      accounting: true,
      projects: false,
      crm: true,
      support: true,
      inventory: true,
    },
    themes: {
      primaryColor: '#059669',
      secondaryColor: '#10B981',
      accentColor: '#059669',
      backgroundColor: '#FFFFFF',
      textColor: '#1F2937',
      borderColor: '#D1D5DB',
      cardStyle: 'corporate',
    },
    terminology: {
      customer: 'Business Client',
      invoice: 'Invoice',
      quote: 'Proposal',
      employee: 'Staff',
      project: 'Contract',
      task: 'Task',
      product: 'Supply',
      service: 'Service',
    },
  },
  {
    id: 'retail',
    name: 'Retail',
    description: 'Retail stores and product sales',
    icon: '🛍',
    features: {
      hasInventory: true,
      hasProjects: false,
      hasHRM: true,
      hasAccounting: true,
      hasCRM: true,
      hasSupport: true,
      hasPOS: true,
      hasWhatsApp: false,
      hasEmail: true,
      hasInvoicing: true,
      hasPayroll: true,
      hasTimeTracking: true,
      hasExpenses: true,
      hasReports: true,
    },
    defaultModules: {
      dashboard: true,
      hrm: true,
      accounting: true,
      projects: false,
      crm: true,
      support: true,
      inventory: true,
    },
    themes: {
      primaryColor: '#DC2626',
      secondaryColor: '#EA580C',
      accentColor: '#F59E0B',
      backgroundColor: '#FEF3C7',
      textColor: '#7C2D12',
      borderColor: '#CA8A04',
      cardStyle: 'minimal',
    },
    terminology: {
      customer: 'Customer',
      invoice: 'Invoice',
      quote: 'Quote',
      employee: 'Employee',
      project: 'Product',
      task: 'Task',
      product: 'Product',
      service: 'Product',
    },
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Medical practices and healthcare services',
    icon: '🏥',
    features: {
      hasInventory: true,
      hasProjects: false,
      hasHRM: true,
      hasAccounting: true,
      hasCRM: true,
      hasSupport: true,
      hasPOS: false,
      hasWhatsApp: false,
      hasEmail: true,
      hasInvoicing: true,
      hasPayroll: true,
      hasTimeTracking: true,
      hasExpenses: true,
      hasReports: true,
    },
    defaultModules: {
      dashboard: true,
      hrm: true,
      accounting: true,
      projects: false,
      crm: true,
      support: true,
      inventory: false,
    },
    themes: {
      primaryColor: '#10B981',
      secondaryColor: '#059669',
      accentColor: '#6366F1',
      backgroundColor: '#F0F9FF',
      textColor: '#1E40AF',
      borderColor: '#3B82F6',
      cardStyle: 'corporate',
    },
    terminology: {
      customer: 'Patient',
      invoice: 'Invoice',
      quote: 'Treatment Plan',
      employee: 'Staff',
      project: 'Appointment',
      task: 'Task',
      product: 'Medical Supply',
      service: 'Treatment',
    },
  },
];

export const getIndustryById = (id: string): Industry | undefined => {
  return INDUSTRIES.find(industry => industry.id === id);
};

export const getIndustryTheme = (industryId: string): Industry['themes'] => {
  const industry = getIndustryById(industryId);
  return industry?.themes || INDUSTRIES[0].themes;
};
