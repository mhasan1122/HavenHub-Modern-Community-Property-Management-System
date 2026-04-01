import PropTypes from 'prop-types';

const EmptyState = ({ icon: Icon, title, message, children, align='center' }) => {
    const alignmentMap = {
    center: "justify-center",
    top: "justify-start",
    bottom: "justify-end",
  };
  return (
    <div className={`flex flex-col items-center ${alignmentMap[align]} min-h-[400px] text-gray-500`}>
      <div className="w-16 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-lg font-semibold text-gray-700 mb-1">{title}</p>
      {message && <p className="text-sm text-gray-500">{message}</p>}
      {children}
    </div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  children: PropTypes.node,
  align: PropTypes.string
};

export default EmptyState;
