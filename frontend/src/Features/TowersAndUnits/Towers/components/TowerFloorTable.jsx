import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

const TowerFloorTable = ({ floors, unitNamingType = 'Numerical', addTowerNumberToUnitName = false, towerNumber = null }) => {
  // Get sorted floors (highest to lowest)
  const sortedFloors = useMemo(() => {
    return floors
      .slice()
      .sort((a, b) => b.floor_no - a.floor_no);
  }, [floors]);

  // Extract unit headers from the floor with most units
  const unitHeaders = useMemo(() => {
    if (sortedFloors.length === 0) return [];
    
    // Find the floor with the most units to determine header count
    const maxUnitsFloor = sortedFloors.reduce((max, floor) => 
      floor.units.length > max.units.length ? floor : max
    );
    
    if (maxUnitsFloor.units.length === 0) return [];
    
    // Generate headers based on unit naming type
    const maxUnits = maxUnitsFloor.units.length;
    const headers = [];
    
    for (let i = 0; i < maxUnits; i++) {
      if (unitNamingType === 'Alphabetical') {
        headers.push(`Unit ${String.fromCharCode(65 + i)}`);
      } else {
        // Numerical
        headers.push(`Unit ${String(i + 1).padStart(2, '0')}`);
      }
    }
    
    return headers;
  }, [sortedFloors, unitNamingType]);

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[450px] scroll-smooth w-full h-full min-w-[480px]">
      <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-sm font-medium text-center text-gray-600 bg-white sticky left-0 z-[2] !border-t-0 !border-l-0 !border-r-0 !border-b-0 w-[100px] p-0">
              <div className="py-3 px-2"></div>
            </th>
            {unitHeaders.map((header, index) => (
              <th 
                key={index}
                className="text-sm font-medium text-center text-gray-600 bg-white border-t-0 border-l-0 border-r-0 border-b border-gray-200 w-[90px] p-0"
              >
                <div className="py-3 px-2">{header}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="align-middle">
          {sortedFloors.map((floor, index) => {
            return (
              <tr key={floor.id} className={index === 0 ? '' : 'border-t border-gray-200'}>
                <td className="text-sm font-medium text-center text-gray-600 bg-white sticky left-0 z-[1] !border-t-0 !border-l-0 !border-r border-gray-200 !border-b-0 w-[100px] p-0">
                  <div className="py-3 px-2">
                    Floor {floor.floor_no}
                  </div>
                </td>
                {unitHeaders.map((header, headerIndex) => {
                  // Match unit by position (units are already in order)
                  const matchingUnit = headerIndex < floor.units.length 
                    ? floor.units[headerIndex] 
                    : null;

                  if (!matchingUnit) {
                    // Empty cell if no unit exists for this position
                    return (
                      <td key={`empty-${headerIndex}`} className={`bg-gray-50 p-0 w-[90px] ${index === 0 ? 'border-t-0' : 'border-t border-gray-200'} ${headerIndex === 0 ? 'border-l-0' : 'border-l border-gray-200'} border-r border-gray-200 border-b border-gray-200`}>
                        <div className="py-3 px-2"></div>
                      </td>
                    );
                  }

                  const bgColor = matchingUnit?.status_color || '#F3F4F6';
                  const textColor = matchingUnit?.unit_status !== 'no_owner' ? '#FFFFFF' : '#000000';
                  const tooltip = matchingUnit.unit_status !== 'no_owner' ? matchingUnit.unit_status : 'no owner';

                  return (
                    <td key={matchingUnit.id} className={`font-bold text-center p-0 m-0 w-[90px] ${index === 0 ? 'border-t-0' : 'border-t border-gray-200'} ${headerIndex === 0 ? 'border-l-0' : 'border-l border-gray-200'} border-r border-gray-200 border-b border-gray-200`}>
                      <Link to={`/unit-details/${matchingUnit.id}`} className="block">
                        <div 
                          className="py-3 px-2 hover:opacity-80 transition-opacity" 
                          style={{
                            backgroundColor: bgColor,
                            color: textColor
                          }}
                          title={tooltip}
                        >
                          {matchingUnit.unit_name}
                        </div>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TowerFloorTable; 