import { NavLink, useLocation } from 'react-router-dom';

const ServiceFeeNavigation = () => {
  const location = useLocation();
  
  const tabs = [
    { name: 'Units Overview', path: '/service-fee-overview' },
    { name: 'Record Payment', path: '/service-fee-list' },
    { name: 'Send Reminder', path: '/service-fee-reminders' },
    // { name: 'Reports', path: '/service-fee-history' },
    { name: 'Unit Payment History', path: '/unit-payment-history' },
  ];

  return (
    <div className="sticky top-0 z-10 mb-6 flex rounded-none overflow-hidden bg-primaryTransparent" role="tablist">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            replace={true}
            state={{ fromOverview: true }}
            role="tab"
            aria-selected={isActive}
            className={`flex-1 min-w-0 rounded-none px-4 py-2 text-sm font-semibold transition-colors text-center ${
              isActive
                ? "border border-primary bg-primaryTransparent text-primary"
                : "bg-primaryTransparent text-textDark hover:text-primary"
            }`}
          >
            {tab.name}
          </NavLink>
        );
      })}
    </div>
  );
};

export default ServiceFeeNavigation;
