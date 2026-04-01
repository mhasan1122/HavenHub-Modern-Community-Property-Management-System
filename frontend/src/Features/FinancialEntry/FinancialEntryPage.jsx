import { useState } from "react";
import {
  FaFileAlt,
  FaMoneyBillWave,
  FaMoneyCheckAlt,
  FaExchangeAlt
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import JournalEntryTab from "./JournalEntryTab";
import ReceiptVoucherTab from "./ReceiptVoucherTab";
import PaymentVoucherTab from "./PaymentVoucherTab";
import ContraEntryTab from "./ContraEntryTab";

const FinancialEntryPage = () => {
  const [activeTab, setActiveTab] = useState("journal"); // Default to journal entry

  const tabs = [
    {
      id: "journal",
      label: "Journal Entry",
      component: JournalEntryTab,
      icon: FaFileAlt,
      color: "blue",
      description: "General ledger entries"
    },
    {
      id: "receipt",
      label: "Receipt Voucher (Income)",
      component: ReceiptVoucherTab,
      icon: FaMoneyBillWave,
      color: "green",
      description: "Income/inflow transactions"
    },
    {
      id: "payment",
      label: "Payment Voucher (Expense)",
      component: PaymentVoucherTab,
      icon: FaMoneyCheckAlt,
      color: "red",
      description: "Expense/outflow transactions"
    },
    {
      id: "contra",
      label: "Balance Transfer (Contra)",
      component: ContraEntryTab,
      icon: FaExchangeAlt,
      color: "purple",
      description: "Balance transfers between accounts"
    }
  ];

  const ActiveTabComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || JournalEntryTab;

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-10 print:rounded-none print:border-0 print:px-4 print:py-2">
        <div className="space-y-6 print:space-y-3">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Financial Entry
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Create and manage financial voucher entries
              </p>
            </div>
          </div>

          {/* Tabs - Mobile Optimized */}
          <div className="border-b border-gray-200 mb-6">
            {/* Desktop Tabs */}
            <nav className="hidden md:flex -mb-px gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-t-lg transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 text-primary border-b-2 border-primary"
                        : "text-gray-600 bg-gray-50 hover:text-primary hover:bg-primary/5"
                    }`}
                    title={tab.description}
                  >
                    <tab.icon className="text-lg" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Tabs - Scrollable Horizontal */}
            <nav 
              className="md:hidden -mb-px flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 px-3 py-3 min-w-[85px] max-w-[100px] text-xs font-semibold rounded-xl transition-all duration-200 touch-manipulation flex-shrink-0 ${
                      isActive
                        ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105"
                        : "text-gray-600 bg-gray-50 active:bg-gray-100 active:scale-95"
                    }`}
                    title={tab.description}
                  >
                    <Icon className={`text-2xl ${isActive ? "text-white" : "text-gray-500"}`} />
                    <span className={`text-center leading-tight font-medium ${isActive ? "text-white" : "text-gray-700"}`}>
                      {tab.label.split(" ")[0]}
                      {tab.label.includes("(") && (
                        <span className={`block text-[10px] mt-0.5 ${isActive ? "text-white/90" : "text-gray-500"}`}>
                          {tab.label.match(/\(([^)]+)\)/)?.[1] || ""}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div>
            <ActiveTabComponent />
          </div>
        </div>
      </section>
    </PageContainer>
  );
};

export default FinancialEntryPage;
