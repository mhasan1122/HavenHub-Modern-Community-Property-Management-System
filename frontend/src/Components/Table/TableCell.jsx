const TableCell = ({ children, className }) => {
  return <td className={`px-2 py-2 text-sm ${className}`}>{children}</td>;
};

export default TableCell;
