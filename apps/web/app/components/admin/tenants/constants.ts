
import { Smartphone, Globe, MessagesSquare, CreditCard, Video, Monitor, ShoppingCart, MessageSquare, Mail, BookOpen } from "lucide-react";

export const FEATURES = [
    { key: 'mobile_app', label: 'White-Label Mobile App', icon: Smartphone, sections: 'Settings > Mobile App' },
    { key: 'website_builder', label: 'Website Builder', icon: Globe, sections: 'Settings > Website Widgets' },
    { key: 'chat', label: 'Chat System', icon: MessagesSquare, sections: 'Settings > Chat Settings, Chat Widget' },
    { key: 'financials', label: 'Financials & Payouts', icon: CreditCard, sections: 'Management > Finances, My Payouts' },
    { key: 'vod', label: 'Video on Demand', icon: Video, sections: 'Operations > Media Library' },
    { key: 'zoom', label: 'Zoom Integration', icon: Monitor, sections: 'Backend Integrations' },
    { key: 'pos', label: 'POS & Retail', icon: ShoppingCart, sections: 'Commerce > POS, Coupons, Gift Cards' },
    { key: 'sms', label: 'SMS Messaging', icon: MessageSquare, sections: 'Backend Capability (Notifications)' },
    { key: 'marketing', label: 'Marketing & CRM', icon: Mail, sections: 'CRM > Email Automations' },
    { key: 'payroll', label: 'Payroll & Compensation', icon: CreditCard, sections: 'Management > Payroll Admin' },
    { key: 'course_management', label: 'Course Management', icon: BookOpen, sections: 'Platform > Courses' },
];
