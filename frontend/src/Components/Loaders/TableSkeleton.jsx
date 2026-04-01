const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full rounded-8 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {[...Array(columns)].map((_, index) => (
              <th key={index} className="p-3 text-left">
                <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, rowIndex) => (
            <tr key={rowIndex} className="border-t">
              {[...Array(columns)].map((_, colIndex) => (
                <td key={colIndex} className="p-3">
                  <div className="h-4 bg-gray-300 rounded w-full animate-pulse"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton;
