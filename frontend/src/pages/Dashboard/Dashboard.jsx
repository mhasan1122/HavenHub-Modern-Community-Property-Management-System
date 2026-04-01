import { useState } from 'react';
import { FaBars, FaHome, FaUserAlt, FaChartLine } from 'react-icons/fa';
import MainContent from './MainContent';
import Header from './Header';
import Footer from './Footer';
import './Dashboard.jsx.css'; // Import Sidebar CSS

import Sidebar from './SideBar';

const Dashboard = () => {
  const [isOpen, setIsOpen] = useState(true);  // Assuming default is open

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="container mx-auto ">
      <Header toggleSidebar={toggleDrawer} />

      <div className=" ">
        <Sidebar isOpen={isOpen} toggleSidebar={toggleDrawer} />

        <div className="  ">
          <MainContent />
        </div>
      </div>

      <Footer />
    </div>
  );
};


export default Dashboard;
