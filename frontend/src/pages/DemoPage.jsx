import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {fetchRoleData } from './../redux/slices/api/roleApi';
import ModernLoadingAnimation from '../Components/Loaders/ModernLoadingAnimation';


const DemoPage = () => {
  const dispatch = useDispatch();

  const { roles, loading, error } = useSelector((state) => state.role || {});  // Add fallback for undefined state

  useEffect(() => {
    dispatch(fetchRoleData());
  }, [dispatch]);
   console.log(roles);
  if (loading) {
    return <ModernLoadingAnimation className="min-h-screen" />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Members List (Demo)</h1>
 
        {/* <ul>
          {member?.map((member) => (
            <li key={member.id}>
              <p>{member.full_name}</p>
            </li>
          ))}
        </ul> */}

    </div>
  );
};

export default DemoPage;

