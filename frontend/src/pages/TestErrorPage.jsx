import { useState } from 'react';

const TestErrorPage = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  // This will throw an error when button is clicked, which ErrorBoundary will catch
  if (shouldThrow) {
    throw new Error('Test error: This is a test error to demonstrate the GenericError component');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full px-4 py-8 text-center bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Boundary Test</h1>
        <p className="text-gray-600 mb-6">
          Click the button below to trigger a React error. The ErrorBoundary will catch it and display the GenericError page.
        </p>
        <button
          onClick={() => setShouldThrow(true)}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Trigger Error
        </button>
        <p className="text-sm text-gray-500 mt-4">
          Note: This will show the "all_other_errors.svg" illustration
        </p>
      </div>
    </div>
  );
};

export default TestErrorPage;

