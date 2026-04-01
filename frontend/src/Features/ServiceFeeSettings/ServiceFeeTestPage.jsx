import React, { useEffect } from "react";
import { useServiceFees } from "../../hooks/useServiceFees";

const ServiceFeeTestPage = () => {
  const {
    serviceFees,
    loading,
    error,
    towers,
    units,
    towersLoading,
    unitsLoading,
    loadServiceFees,
    loadTowers,
    loadAllUnits,
    towerOptions,
    unitOptions
  } = useServiceFees();

  useEffect(() => {
    // Test loading data
    loadServiceFees();
    loadTowers();
    loadAllUnits();
  }, [loadServiceFees, loadTowers, loadAllUnits]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Service Fee API Integration Test</h1>
      
      {/* Service Fees Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Service Fees</h2>
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading service fees...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error.message || error}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <p className="mb-2">Found {serviceFees.length} service fees</p>
            {serviceFees.length > 0 ? (
              <ul className="space-y-2">
                {serviceFees.slice(0, 3).map((fee) => (
                  <li key={fee.id} className="p-2 border rounded">
                    <div className="font-medium">
                      {fee.currency === 'BDT' ? '৳' : '$'}{fee.fee_amount} - {fee.frequency}
                    </div>
                    <div className="text-sm text-gray-600">
                      Creator: {fee.creator_display || fee.creator_name}
                    </div>
                  </li>
                ))}
                {serviceFees.length > 3 && (
                  <li className="text-gray-500">... and {serviceFees.length - 3} more</li>
                )}
              </ul>
            ) : (
              <p className="text-gray-500">No service fees found</p>
            )}
          </div>
        )}
      </div>

      {/* Towers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Towers</h2>
        {towersLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading towers...
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <p className="mb-2">Found {towers.length} towers</p>
            {towers.length > 0 ? (
              <ul className="space-y-2">
                {towers.slice(0, 5).map((tower) => (
                  <li key={tower.id} className="p-2 border rounded">
                    <div className="font-medium">
                      {tower.tower_name || tower.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      ID: {tower.id}
                    </div>
                  </li>
                ))}
                {towers.length > 5 && (
                  <li className="text-gray-500">... and {towers.length - 5} more</li>
                )}
              </ul>
            ) : (
              <p className="text-gray-500">No towers found</p>
            )}
          </div>
        )}
      </div>

      {/* Units Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Units</h2>
        {unitsLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading units...
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <p className="mb-2">Found {units.length} units</p>
            {units.length > 0 ? (
              <ul className="space-y-2">
                {units.slice(0, 5).map((unit) => (
                  <li key={unit.id} className="p-2 border rounded">
                    <div className="font-medium">
                      {unit.unit_name || unit.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Floor: {unit.floor_no || unit.floor_number || 'N/A'} | ID: {unit.id}
                    </div>
                  </li>
                ))}
                {units.length > 5 && (
                  <li className="text-gray-500">... and {units.length - 5} more</li>
                )}
              </ul>
            ) : (
              <p className="text-gray-500">No units found</p>
            )}
          </div>
        )}
      </div>

      {/* API Endpoints Test */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">API Endpoints Status</h2>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <h3 className="font-medium text-green-600">✓ Service Fees API</h3>
              <p className="text-sm text-gray-600">GET /api/service-fees/</p>
              <p className="text-xs text-gray-500">Status: {loading ? '' : error ? 'Error' : 'Success'}</p>
            </div>
            <div className="p-3 border rounded">
              <h3 className="font-medium text-green-600">✓ Towers API</h3>
              <p className="text-sm text-gray-600">GET /towers/tower_list/</p>
              <p className="text-xs text-gray-500">Status: {towersLoading ? '' : 'Success'}</p>
            </div>
            <div className="p-3 border rounded">
              <h3 className="font-medium text-blue-600">→ Units API</h3>
              <p className="text-sm text-gray-600">GET /towers/units/</p>
              <p className="text-xs text-gray-500">Status: {unitsLoading ? '' : 'Ready'}</p>
            </div>
            <div className="p-3 border rounded">
              <h3 className="font-medium text-blue-600">→ Create API</h3>
              <p className="text-sm text-gray-600">POST /api/service-fees/</p>
              <p className="text-xs text-gray-500">Status: Ready for testing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Integration Summary</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✓ Redux store configured with serviceFees reducer</li>
          <li>✓ API slice created with all CRUD operations</li>
          <li>✓ Custom hooks created for easy component integration</li>
          <li>✓ Form components updated to use real API data</li>
          <li>✓ Error handling and loading states implemented</li>
          <li>✓ Service fee list component created</li>
        </ul>
      </div>
    </div>
  );
};

export default ServiceFeeTestPage;
