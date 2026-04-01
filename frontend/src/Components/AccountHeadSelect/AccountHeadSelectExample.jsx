import { useState, useEffect } from 'react';
import AccountHeadSelect from './AccountHeadSelect';
import axiosInstance from '../../utils/axiosInstance';

/**
 * Example usage of the AccountHeadSelect component
 * This demonstrates various use cases and configurations
 */
const AccountHeadSelectExample = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Example 1: Basic usage
  const [selectedAccount1, setSelectedAccount1] = useState(null);
  
  // Example 2: With validation
  const [selectedAccount2, setSelectedAccount2] = useState(null);
  const [error2, setError2] = useState('');
  
  // Example 3: Pre-selected value
  const [selectedAccount3, setSelectedAccount3] = useState(null);
  
  // Example 4: Disabled state
  const [selectedAccount4] = useState(null);

  // Fetch accounts from API
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await axiosInstance.get('/api/accounts/accounts/');
        const accountsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data.results || []);
        const activeAccounts = accountsData.filter(acc => acc.isActive);
        setAccounts(activeAccounts);
        
        // Pre-select first account for example 3
        if (activeAccounts.length > 0) {
          setSelectedAccount3(activeAccounts[0].id);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Handle account selection with validation
  const handleAccount2Change = (account) => {
    setSelectedAccount2(account?.id || null);
    
    // Example validation
    if (!account) {
      setError2('Please select an account');
    } else {
      setError2('');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AccountHeadSelect Component Examples
          </h1>
          <p className="text-gray-600">
            A comprehensive, searchable account head selector with various configuration options
          </p>
        </div>

        {/* Example 1: Basic Usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 1: Basic Usage
          </h2>
          <AccountHeadSelect
            accountHeads={accounts}
            value={selectedAccount1}
            onChange={(account) => setSelectedAccount1(account?.id || null)}
            placeholder="Select an account"
            label="Account Head"
            showCode={true}
            clearable={true}
          />
          {selectedAccount1 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                Selected Account ID: <strong>{selectedAccount1}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Example 2: With Validation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 2: Required Field with Validation
          </h2>
          <AccountHeadSelect
            accountHeads={accounts}
            value={selectedAccount2}
            onChange={handleAccount2Change}
            placeholder="Select an account (required)"
            label="Account Head"
            required={true}
            error={error2}
            showCode={true}
          />
          <button
            onClick={() => {
              if (!selectedAccount2) {
                setError2('This field is required');
              } else {
                setError2('');
                alert(`Form submitted with account ID: ${selectedAccount2}`);
              }
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Submit
          </button>
        </div>

        {/* Example 3: Pre-selected Value */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 3: Pre-selected Value
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            This example shows a pre-selected account (first account from the list)
          </p>
          <AccountHeadSelect
            accountHeads={accounts}
            value={selectedAccount3}
            onChange={(account) => setSelectedAccount3(account?.id || null)}
            placeholder="Select an account"
            label="Default Account"
            showCode={true}
          />
        </div>

        {/* Example 4: Disabled State */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 4: Disabled State
          </h2>
          <AccountHeadSelect
            accountHeads={accounts}
            value={selectedAccount4}
            onChange={() => {}}
            placeholder="This field is disabled"
            label="Disabled Account Select"
            disabled={true}
          />
        </div>

        {/* Example 5: Without Account Code */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 5: Display Without Account Code
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Only shows account names, no codes
          </p>
          <AccountHeadSelect
            accountHeads={accounts}
            value={null}
            onChange={(account) => console.log('Selected:', account)}
            placeholder="Select account (name only)"
            label="Account Name Only"
            showCode={false}
          />
        </div>

        {/* Example 6: Not Clearable */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Example 6: Without Clear Button
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Once selected, cannot be cleared
          </p>
          <AccountHeadSelect
            accountHeads={accounts}
            value={null}
            onChange={(account) => console.log('Selected:', account)}
            placeholder="Select account (no clear)"
            label="Non-clearable"
            clearable={false}
          />
        </div>

        {/* Props Documentation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Component Props
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prop
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Default
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">accountHeads</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Array</td>
                  <td className="px-4 py-3 text-sm text-gray-900">[]</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Array of account objects (required)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">value</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Number/String</td>
                  <td className="px-4 py-3 text-sm text-gray-900">null</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Selected account ID</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">onChange</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Function</td>
                  <td className="px-4 py-3 text-sm text-gray-900">-</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Callback when selection changes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">placeholder</td>
                  <td className="px-4 py-3 text-sm text-gray-900">String</td>
                  <td className="px-4 py-3 text-sm text-gray-900">&quot;Select Account&quot;</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Placeholder text</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">label</td>
                  <td className="px-4 py-3 text-sm text-gray-900">String</td>
                  <td className="px-4 py-3 text-sm text-gray-900">&quot;&quot;</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Label text</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">required</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Boolean</td>
                  <td className="px-4 py-3 text-sm text-gray-900">false</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Shows asterisk if true</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">disabled</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Boolean</td>
                  <td className="px-4 py-3 text-sm text-gray-900">false</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Disables the component</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">error</td>
                  <td className="px-4 py-3 text-sm text-gray-900">String</td>
                  <td className="px-4 py-3 text-sm text-gray-900">&quot;&quot;</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Error message to display</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">showCode</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Boolean</td>
                  <td className="px-4 py-3 text-sm text-gray-900">true</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Shows account code</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">clearable</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Boolean</td>
                  <td className="px-4 py-3 text-sm text-gray-900">true</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Shows clear button</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">className</td>
                  <td className="px-4 py-3 text-sm text-gray-900">String</td>
                  <td className="px-4 py-3 text-sm text-gray-900">&quot;&quot;</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Additional CSS classes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountHeadSelectExample;
