// import { IoIosCheckmark } from "react-icons/io";
// import { RxCross2 } from "react-icons/rx";

// const MessageBox = ({ message, error, clearMessage, onOk }) => {
//   // Helper function to safely render errors or messages:
//   const renderContent = (content) => {
//     if (!content) return "";
//     if (typeof content === "object") {
//       return Object.values(content).flat().join(", ");
//     }
//     return content;
//   };

//   const displayContent = renderContent(message) || renderContent(error);

//   return (
//     <>
//       {(message || error) && (
//         <div className="fixed inset-0 bg-black bg-opacity-60 z-50"></div>
//       )}
//       {(message || error) && (
//         <div className="fixed inset-0 flex top-[5%] justify-center z-50">
//           <div className="h-[352px] w-[410px] bg-white border border-gray-300 rounded-[16px] shadow-md flex flex-col items-center justify-center p-[27px]">
//             <div className={`bg-[#BEFEC7] ${error ? "text-red-600" : "text-[#00A81C]"} rounded-full p-4`}>
//               <IoIosCheckmark className="text-5xl" />
//               <RxCross2 className="text-5xl" />
//             </div>
//             <h2 className="text-[24px] font-semibold text-center text-gray-800 mt-4">
//               {error ? "Error" : "Success!"}
//             </h2>
//             <p className="text-center text-[16px] text-gray-600 mt-2">
//               {displayContent}
//             </p>
//             <button
//               onClick={() => {
//                 if (onOk) {
//                   onOk();
//                 }
//                 clearMessage();
//               }}
//               className="bg-[#3D9D9B] w-full text-white font-semibold py-2 px-6 mt-6 rounded-lg"
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}
//     </>
//   );
// };

// export default MessageBox;

import { useState } from "react";
import { RxCross1 } from "react-icons/rx";

const MessageBox = ({ message, error, clearMessage, onOk }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Helper function to safely render errors or messages:
  const renderContent = (content) => {
    if (!content) return "";

    if (Array.isArray(content)) {
      const [title, ...items] = content;
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-lg">{title}</div>
          {items.length > 0 && (
            <ul className="text-left list-disc pl-5 mt-2 max-h-40 overflow-y-auto">
              {items.map((item, idx) => (
                <li key={idx} className="text-sm text-gray-600 mb-1">{item}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (typeof content === "object") {
      return Object.values(content).flat().join(", ");
    }
    return content;
  };
  const displayContent = renderContent(message) || renderContent(error);

  const handleOkClick = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onOk) onOk();
      clearMessage();
      setIsFadingOut(false);
    }, 600); // Smooth fade-out delay
  };

  return (
    <>
      {(message || error) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50"></div>
      )}
      {(message || error) && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="w-[410px] bg-white border border-gray-300 rounded-16 shadow-md flex flex-col items-center justify-center p-7 pb-6">
            {/* Success/Error Icon */}
            {error ? (
              <div className="rounded-full p-4 bg-red-100 text-red-600">
                <RxCross1 className="text-5xl" />
              </div>
            ) : (
              <div className="relative flex items-center justify-center w-[76.53px] h-[76.53px] bg-[#BEFEC7] rounded-[43.7333px]">
                <svg
                  width="38.27"
                  height="38.27"
                  viewBox="0 0 38.27 38.27"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <path
                    d="M 8.5 19.135 L 15.5 26.135 L 29.5 12.135"
                    fill="none"
                    stroke="#00A81C"
                    strokeWidth="2.73333"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            <div className="flex flex-col items-center gap-[10.93px] p-0 w-full">
              <div
                className="w-full text-center text-[18px] font-semibold leading-[140%] text-[#14181F]"
                style={{ fontFamily: 'Lato, sans-serif' }}
              >
                {displayContent}
              </div>
            </div>
            <button
              onClick={handleOkClick}
              className="bg-primary w-full text-white font-semibold py-2 px-6 mt-6 rounded-lg hover:bg-primary-dark transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default MessageBox;
