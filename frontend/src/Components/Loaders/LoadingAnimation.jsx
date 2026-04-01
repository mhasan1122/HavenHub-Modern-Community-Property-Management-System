import { motion } from "framer-motion";

const LoadingAnimation = () => {
  const floors = 5;
  const windowsPerFloor = 2;
  const delay = 0.5; // Time delay between each floor lighting up

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        {/* Building Structure */}
        <div className="relative w-12 h-30 bg-gray-300  rounded-lg p-2 flex flex-col justify-between border border-gray-400">
          {[...Array(floors)].map((_, floorIndex) => (
            <div key={floorIndex} className="flex justify-center space-x-2">
              {[...Array(windowsPerFloor)].map((_, windowIndex) => (
                <motion.div
                  key={windowIndex}
                  className="w-3 h-3 bg-primary rounded-sm "
                  animate={{
                    backgroundColor: ["#3D9D9B", "#ffffff", "#3D9D9B"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.5,
                    ease: "easeInOut",
                    delay: floorIndex * delay,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Side Structures */}
        <div className="absolute -left-8 bottom-0 w-6 h-10 bg-gray-300 rou-nded-md border border-gray-400"></div>
        <div className="absolute -right-8 bottom-0 w-6 h-10 bg-gray-300  rounded-md border border-gray-400"></div>
        <div className="absolute -left-4 bottom-0 w-6 h-16 bg-gray-300  rounded-md border border-gray-400"></div>
        <div className="absolute -right-4 bottom-0 w-6 h-16 bg-gray-300  rounded-md border border-gray-400"></div>
      </div>
    </div>
  );
};

export default LoadingAnimation;
