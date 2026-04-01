const ModernLoadingAnimation = ({ className = "" }) => {
  // Base classes for centering - always needed
  const baseClasses = "flex items-center justify-center";
  // If className is provided, append it; otherwise use default min-height
  const containerClass = className 
    ? `${baseClasses} ${className}`
    : `${baseClasses} min-h-[200px]`;
  
  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-5 w-full max-w-md px-4">
        {/* Main flowing bars with staggered animation */}
        <div className="w-full space-y-4">
          {/* Top bar - full width */}
          <div className="h-6 bg-gray-300 rounded-lg w-full modern-loading-pulse"></div>
          
          {/* Middle section - varying widths */}
          <div className="flex gap-3">
            <div 
              className="h-6 bg-gray-400 rounded-lg flex-1 modern-loading-pulse" 
              style={{ animationDelay: '0.3s' }}
            ></div>
            <div 
              className="h-6 bg-gray-300 rounded-lg w-28 modern-loading-pulse" 
              style={{ animationDelay: '0.6s' }}
            ></div>
          </div>
          
          {/* Bottom section - more variation */}
          <div className="flex gap-3">
            <div 
              className="h-6 bg-gray-300 rounded-lg w-36 modern-loading-pulse" 
              style={{ animationDelay: '0.9s' }}
            ></div>
            <div 
              className="h-6 bg-gray-400 rounded-lg flex-1 modern-loading-pulse" 
              style={{ animationDelay: '1.2s' }}
            ></div>
            <div 
              className="h-6 bg-gray-300 rounded-lg w-24 modern-loading-pulse" 
              style={{ animationDelay: '1.5s' }}
            ></div>
          </div>
        </div>

        {/* Secondary flowing elements below */}
        <div className="w-full space-y-3 mt-3">
          <div 
            className="h-5 bg-gray-200 rounded-lg w-4/5 mx-auto modern-loading-pulse" 
            style={{ animationDelay: '1.8s' }}
          ></div>
          <div 
            className="h-5 bg-gray-200 rounded-lg w-3/5 mx-auto modern-loading-pulse" 
            style={{ animationDelay: '2.1s' }}
          ></div>
        </div>

        {/* Decorative dots/circles */}
        <div className="flex gap-3 mt-5">
          <div 
            className="w-3 h-3 bg-gray-400 rounded-full modern-loading-pulse" 
            style={{ animationDelay: '2.4s' }}
          ></div>
          <div 
            className="w-3 h-3 bg-gray-400 rounded-full modern-loading-pulse" 
            style={{ animationDelay: '2.7s' }}
          ></div>
          <div 
            className="w-3 h-3 bg-gray-400 rounded-full modern-loading-pulse" 
            style={{ animationDelay: '3s' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ModernLoadingAnimation;

