import { RiContactsBook3Fill } from "react-icons/ri";

const ContactButton = ({ onClick, label = "Add Contact", className = "" }) => {
  return (
    <button
    type="button"
      onClick={onClick}
      className={`flex items-center justify-center text-md font-medium bg-[#3D9D9B] text-white hover:bg-[#34977A] transition-all duration-300 py-1 px-2 rounded ${className}`}
    >
      <RiContactsBook3Fill className="mr-2" />
      {label}
    </button>
  );
};

export default ContactButton;
