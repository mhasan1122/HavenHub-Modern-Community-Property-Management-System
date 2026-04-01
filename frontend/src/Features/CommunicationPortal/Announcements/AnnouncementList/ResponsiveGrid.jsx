import React, { useState, useEffect } from 'react';

const ResponsiveGrid = ({ children, cardWidth = 350, gap = 16 }) => {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const calculateColumns = () => {
      const containerWidth = window.innerWidth - 32; // Account for padding
      const availableWidth = containerWidth - gap; // Account for gap
      const cardWithGap = cardWidth + gap;
      const maxColumns = Math.floor(availableWidth / cardWithGap);
      
      // Set responsive breakpoints
      if (window.innerWidth >= 1400) {
        setColumns(Math.min(maxColumns, 4));
      } else if (window.innerWidth >= 1024) {
        setColumns(Math.min(maxColumns, 3));
      } else if (window.innerWidth >= 768) {
        setColumns(Math.min(maxColumns, 2));
      } else {
        setColumns(1);
      }
    };

    calculateColumns();
    window.addEventListener('resize', calculateColumns);
    return () => window.removeEventListener('resize', calculateColumns);
  }, [cardWidth, gap]);

  return (
    <div
      className="grid justify-start w-full"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
        gap: `${gap}px`
      }}
    >
      {children}
    </div>
  );
};

export default ResponsiveGrid;
