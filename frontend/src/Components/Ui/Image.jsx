const Image = ({ src, alt = "Image", width = "24px", height = "24px", className = "" }) => {
    return (
      <img 
        src={src} 
        alt={alt} 
        className={`h-[${height}] w-[${width}] ${className}`} 
      />
    );
  };
  
  export default Image;
  