import React from 'react';

/**
 * ResponsiveGrid component for bulletin layout
 * Provides consistent grid layout with responsive design
 */
const ResponsiveGrid = ({ children, className = "" }) => {
  return (
    <div 
      className={`
        grid 
        grid-cols-1 
        md:grid-cols-2 
        lg:grid-cols-3 
        xl:grid-cols-4 
        gap-4 
        md:gap-6 
        ${className}
      `}
      style={{
        gridAutoFlow: 'row dense',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
      }}
    >
      {children}
    </div>
  );
};

export default ResponsiveGrid;
