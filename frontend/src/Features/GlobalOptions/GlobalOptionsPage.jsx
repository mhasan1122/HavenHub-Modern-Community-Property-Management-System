import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ArrowHeading from '../../Components/HeadingComponent/ArrowHeading';
import PageContainer from '../../Components/Ui/PageContainer';
import MessageBox from '../../Components/MessageBox/MessageBox';
import {
  IoSettingsOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoCubeOutline,
  IoCalculatorOutline,
} from 'react-icons/io5';

/**
 * Global Options Page
 * Provides access to system-wide settings and configurations
 * Accessible from any page in the application
 */
const GlobalOptionsPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleGoBack = () => {
    navigate(-1);
  };

  // Global Options categories
  const globalOptions = [
    {
      id: 'default-account-heads',
      title: 'Default Account Heads',
      description: 'Configure default account mappings for transaction types (income, expense, sales, service fee, etc.)',
      icon: IoCalculatorOutline,
      action: () => navigate('/default-account-heads'),
      comingSoon: false,
    },
    {
      id: 'system-config',
      title: 'System Configuration',
      description: 'Configure system-wide settings and parameters',
      icon: IoSettingsOutline,
      action: () => navigate('/system-config'),
      comingSoon: true,
    },
    {
      id: 'audit-logs',
      title: 'Audit Logs',
      description: 'View system-wide audit trail and activity logs',
      icon: IoDocumentTextOutline,
      action: () => navigate('/audit-logs'),
      comingSoon: true,
    },
    {
      id: 'system-info',
      title: 'System Information',
      description: 'View system version, status, and configuration details',
      icon: IoInformationCircleOutline,
      action: () => navigate('/system-info'),
      comingSoon: true,
    },
  ];

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={handleGoBack}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <div className="space-y-6">
            {/* Introduction Card */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to Global Options
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Access system-wide settings and configurations that apply to the entire application.
                These options control organization-wide behaviors and system parameters.
              </p>
              {user && (
                <p className="text-xs text-gray-500 mt-3">
                  Logged in as: <span className="font-medium">{user.full_name}</span>
                </p>
              )}
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {globalOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <div
                    key={option.id}
                    onClick={!option.comingSoon ? option.action : undefined}
                    className={`rounded-lg border border-gray-100 bg-white p-6 transition-all duration-300 ${!option.comingSoon ? 'cursor-pointer hover:shadow-md hover:border-primary/30' : 'cursor-not-allowed opacity-75'} group`}
                  >
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 text-base">
                            {option.title}
                          </h3>
                          {option.comingSoon && (
                            <span className="flex-shrink-0 px-2.5 py-1 bg-gray-100 text-xs font-medium text-gray-600 rounded-full whitespace-nowrap border border-gray-200">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Arrow */}
                    {!option.comingSoon && (
                      <div className="flex items-center justify-end mt-4">
                        <div className="text-primary group-hover:translate-x-1 transition-transform duration-300">
                          →
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info Section */}
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-base font-semibold text-blue-900 mb-3">
                About Global Options
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                  <span>Global Options are accessible from any page in the application</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                  <span>Settings changed here apply system-wide to all users and modules</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                  <span>These settings require administrative access to modify</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                  <span>All changes are logged in the system audit trail</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* MessageBox - Modal Dialog for Success/Error Messages */}
      <MessageBox
        message={message}
        error={error}
        clearMessage={() => {
          setMessage('');
          setError('');
        }}
      />
    </PageContainer>
  );
};

export default GlobalOptionsPage;
