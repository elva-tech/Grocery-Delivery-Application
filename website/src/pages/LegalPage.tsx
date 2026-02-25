import React from 'react';
import { useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../api/mockdata';

const CONTENT = (brand: string) => ({
  '/about': {
    title: `About ${brand}.`,
    text: `At ${brand}, we are committed to redefining the way you consume daily essentials. Our platform was built to ensure that purity and quality are never compromised. We act as a bridge between high-quality producers and health-conscious consumers.

Our mission is to foster a "Pure Culture" where every product delivered to your doorstep is handled with the utmost care, maintaining its natural nutritional profile. We leverage technology to simplify your daily logistics, providing a seamless experience from farm to table.

Whether it is dairy, poultry, or organic pantry staples, ${brand} stands for transparency, sustainability, and uncompromising quality. We believe that better health starts with better ingredients.`
  },
  '/contact': {
    title: 'Get in Touch.',
    text: `We are here to assist you with any queries regarding your orders, subscriptions, or feedback.

Customer Support:
Email: ${APP_CONFIG.supportEmail}
Phone: ${APP_CONFIG.contactNumber}

Corporate Office:
${brand} Marketplace Technologies
${APP_CONFIG.address}

Our support team is available during standard business hours to ensure your experience remains smooth and hassle-free.`
  },
  '/faqs': {
    title: 'Common Queries.',
    text: `1. How do I place an order?
Simply browse our categories, add items to your basket, and proceed to checkout. You can choose from various available delivery slots.

2. Can I edit an existing order?
Orders can be modified or cancelled as long as they are in the "Placed" or "Confirmed" status. Once "Out for Delivery," no changes can be made.

3. What should I do if my items are damaged?
Use the "Report Issue" button in your Order History. Upload a photo of the damaged product, and our team will process a refund or replacement within 24 hours.

4. How do subscriptions work?
You can set up recurring orders for your daily essentials. You have full control to pause, resume, or skip deliveries via the app dashboard.`
  },
  '/privacy': {
    title: 'Privacy Policy.',
    text: `At ${brand}, we value your trust. This policy outlines how we handle your personal information:

- Information Collection: We collect only necessary details such as your name, delivery address, and contact number to facilitate our services.
- Data Usage: Your data is used to personalize your experience, process transactions, and send service-related updates.
- Security: We implement advanced security protocols to protect your data from unauthorized access or disclosure.
- Third Parties: We do not sell, trade, or rent your personal information to third parties for marketing purposes.
- Cookies: Our platform uses cookies to enhance site navigation and analyze usage patterns.`
  },
  '/terms': {
    title: 'Terms of Service.',
    text: `By accessing the ${brand} platform, you agree to the following:

- Account Accuracy: You are responsible for providing correct delivery and contact information.
- Use of Service: Our services are intended for personal use. Any commercial resale of products is prohibited.
- Payment: All transactions are processed through secured gateways. Ensure sufficient balance for prepaid deliveries.
- Order Fulfillment: While we strive for 100% fulfillment, orders are subject to stock availability and logistics feasibility.
- Modifications: ${brand} reserves the right to update these terms to reflect changes in our business or legal requirements.`
  },
  '/refund': {
    title: 'Refund Policy.',
    text: `We stand behind the quality of our products. Our refund policy ensures you are protected:

- Quality Claims: If a product does not meet the specified quality standards, please report it within 12 hours of delivery.
- Damaged Goods: For items received in a damaged or tampered state, a full refund or replacement will be provided upon verification.
- Processing Time: Approved refunds are credited to your original payment method or ${brand} Wallet within 3-5 business days.
- Non-Returnable Items: Due to the perishable nature of our goods, we do not accept physical returns, but we offer full financial resolution for valid issues.`
  }
});

const LegalPage = () => {
  const { pathname } = useLocation();
  const brand = APP_CONFIG.brandName;
  const page = CONTENT(brand)[pathname as keyof ReturnType<typeof CONTENT>] || CONTENT(brand)['/about'];

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 min-h-screen">
      <h1 className="text-6xl font-black text-slate-900 mb-12 italic uppercase tracking-tighter leading-none">
        {page.title}
      </h1>
      <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm">
        <p className="text-slate-600 font-bold text-lg leading-relaxed whitespace-pre-line italic">
          {page.text}
        </p>
      </div>
      <div className="mt-12 flex gap-4">
        <div className="h-1 w-20 bg-[#4b6f9e] rounded-full" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{brand} Pure Culture © 2026</p>
      </div>
    </div>
  );
};

export default LegalPage;