import { useState, useEffect } from 'react';

const ResponsiveGrid = ({ children, minItemWidth = 320, gap = 20 }) => {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const calculateColumns = () => {
      const containerWidth = window.innerWidth - 48; // Account for padding
      const availableWidth = containerWidth - gap;
      const itemWidthWithGap = minItemWidth + gap;
      const calculatedColumns = Math.floor(availableWidth / itemWidthWithGap);
      setColumns(Math.max(1, calculatedColumns));
    };

    calculateColumns();
    window.addEventListener('resize', calculateColumns);
    return () => window.removeEventListener('resize', calculateColumns);
  }, [minItemWidth, gap]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
    width: '100%'
  };

  return (
    <div style={gridStyle}>
      {children}
    </div>
  );
};

export default ResponsiveGrid;
