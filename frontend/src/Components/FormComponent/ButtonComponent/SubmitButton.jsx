// SubmitButton.jsx

// const SubmitButton = ({ text = 'Submit', loading = false, disabled = false, onClick, width = 'auto'  }) => {
//   return (
//     <button
//       type="submit"
//       disabled={disabled || loading}
//       onClick={onClick}
//       className={`px-4 py-3 mt-[21px] text-white font-semibold rounded transition-all duration-200
//         ${width === 'full' ? 'w-full' : 'w-auto'}  
//         ${loading ? 'bg-primary cursor-not-allowed' : 'bg-primary hover:bg-primary'}
//         ${disabled || loading ? 'opacity-50' : 'opacity-100'}
//       `}>
//       {loading ? 'Submitting...' : text}
//     </button>
//   );
// };

// export default SubmitButton;



// SubmitButton.jsx
import React from 'react';

const SubmitButton = ({
  text = 'Submit',
  loading = false,
  disabled = false,
  onClick,
  width = 'auto',
  bgColor = 'bg-primary',
  textColor = 'text-white',
  border = '',
  isFormChange = false, // e.g., 'border border-red-500'
  className = '',
}) => {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      onClick={!isFormChange&&onClick}
      className={`px-4 py-2 my-3 font-semibold border border-primary rounded transition-all duration-200
        ${width === 'full' ? 'w-full' : 'w-auto'}  
        ${loading ? `${bgColor} cursor-not-allowed` : `${bgColor} hover:${bgColor}`}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}
        ${textColor} ${border}
        ${isFormChange ? 'cursor-not-allowed opacity-50' : ''}
        ${className}
      `}
    >
      {loading ? 'Submitting...' : text}
    </button>
  );
};

export default SubmitButton;

