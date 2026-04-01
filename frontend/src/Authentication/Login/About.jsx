import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  createOrUpdateAbout,
  deleteAbout,
  fetchAboutData,
} from "../../redux/slices/api/aboutApi";
import { clearMessage } from "../../redux/slices/aboutSlice";
import MessageBox from "../../Components/MessageBox/MessageBox";
import TextInputComponent from "../../Components/FormComponent/TextInputComponent";
import NumberInputComponent from "../../Components/FormComponent/NumberInputComponent";

const formFields = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "age", label: "Age", type: "number", required: true },
];

const About = () => {
  const dispatch = useDispatch();
  const { data, loading, error, message } = useSelector((state) => state.about);
console.log(data);
  const [showMessage, setShowMessage] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState(
    // Object.fromEntries(formFields.map((field) => [field.name, ""]))
    Object.fromEntries(formFields.map((field) => [field.name, field.type === "number" ? 12: ""]))

  );
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    dispatch(fetchAboutData());
  }, [dispatch]);

  useEffect(() => {
    if (message || error) {
      setShowMessage(true);
      setTimeout(() => {
        setShowMessage(false);
        dispatch(clearMessage());
      }, 3000);
    }
  }, [message, error, dispatch]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const validateForm = () => {
    const errors = {};
    formFields.forEach(({ name, label, type, required }) => {
      if (required && !formData[name]) {
        errors[name] = `${label} is required`;
      } else if (
        type === "email" &&
        formData[name] &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[name])
      ) {
        errors[name] = "Invalid email format";
      } else if (type === "number" && formData[name] && isNaN(formData[name])) {
        errors[name] = "Enter a valid number";
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      dispatch(createOrUpdateAbout(formData));
      setFormData(Object.fromEntries(formFields.map((field) => [field.name, ""])));
      setFormErrors({});
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      dispatch(deleteAbout(deleteId));
      setDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-5 mt-12 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
        Redux Form
      </h1>

      {showMessage && (
        <MessageBox
          message={message}
          error={error}
          clearMessage={() => dispatch(clearMessage())}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 flex justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white p-6 h-[202px] rounded-lg shadow-md text-center w-[400px]">
            <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this item?
            </p>
            <div className="flex justify-around">
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
              >
                Confirm
              </button>
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Section */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {formFields.map((field) =>
          field.type === "number" ? (
            <NumberInputComponent
              key={field.name}
              {...field}
              value={formData[field.name]}
              onChange={handleInputChange}
              error={formErrors[field.name]}
            />
          ) : (
            <TextInputComponent
              key={field.name}
              {...field}
              value={formData[field.name]}
              onChange={handleInputChange}
              error={formErrors[field.name]}
            />
          )
        )}

        <div className="col-span-2">
          <button
            type="submit"
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {formData.id ? "Update" : "Save"}
          </button>
        </div>
      </form>

      {/* Data Table */}
      <table className="min-w-full table-auto border-collapse mb-8">
        <thead>
          <tr>
            {formFields.map((field) => (
              <th key={field.name} className="border-b p-2 text-left">
                {field.label}
              </th>
            ))}
            <th className="border-b p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="4" className="text-center">
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={item.id}>
                {formFields.map((field) => (
                  <td key={field.name} className="border-b p-2">
                    {item[field.name]}
                  </td>
                ))}
                <td className="border-b p-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default About;
















// import React, { useEffect, useState } from 'react';
// import { useSelector, useDispatch } from 'react-redux';
// import { createOrUpdateAbout, deleteAbout, fetchAboutData } from '../../api/aboutApi';
// import { clearMessage } from '../../redux/slices/aboutSlice';
// import MessageBox from '../../Components/MessageBox/MessageBox';
// import TextInputComponent from '../../Components/FormComponent/TextInputComponent';
// import NumberInputComponent from '../../Components/FormComponent/NumberInputComponent';

// const About = () => {
//   const formFields = [
//     { name: 'name', label: 'Name', type: 'text' },
//     { name: 'age', label: 'age', type: 'number' },
//   ];

//   const dispatch = useDispatch();
//   const { data, loading, error, message } = useSelector((state) => state.about);
//   const [showMessage, setShowMessage] = useState(false);
//   const [deleteId, setDeleteId] = useState(null);
//   const [formData, setFormData] = useState({ name: '', age: '' });
//   const [formErrors, setFormErrors] = useState({ name: '', age: '' });

//   useEffect(() => {
//     dispatch(fetchAboutData());
//   }, [dispatch]);

//   useEffect(() => {
//     if (message || error) {
//       setShowMessage(true);
//       setTimeout(() => {
//         setShowMessage(false);
//         dispatch(clearMessage());
//       }, 3000);
//     }
//   }, [message, error, dispatch]);

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   const validateForm = () => {
//     const errors = { name: '', age: '' };

//     // Check if name is empty
//     if (!formData.name) {
//       errors.name = 'Name is required';
//     }

//     // Check if age is empty or not a number
//     if (!formData.age) {
//       errors.age = 'Age is required';
//     } else if (isNaN(formData.age) || formData.age <= 0) {
//       errors.age = 'Please enter a valid age';
//     }

//     setFormErrors(errors);

//     // Return true if no errors
//     return !errors.name && !errors.age;
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (validateForm()) {
//       dispatch(createOrUpdateAbout(formData));
//       setFormData({ name: '', age: '' });
//       setFormErrors({ name: '', age: '' }); // Reset errors
//     }
//   };

//   const handleEdit = (item) => {
//     setFormData(item);
//   };

//   const handleDelete = (id) => {
//     setDeleteId(id);
//   };

//   const confirmDelete = () => {
//     if (deleteId) {
//       dispatch(deleteAbout(deleteId));
//       setDeleteId(null);
//     }
//   };

//   const cancelDelete = () => {
//     setDeleteId(null);
//   };

//   return (
//     <div className="max-w-6xl mx-auto p-5 mt-12 bg-white shadow-lg rounded-lg">
//       <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">Redux </h1>
//       {showMessage && (
//         <MessageBox
//           message={message}
//           error={error}
//           clearMessage={() => dispatch(clearMessage())}
//         />
//       )}
//       {deleteId && (
//         <div className="fixed inset-0 flex justify-center bg-black bg-opacity-60 z-50">
//           <div className="bg-white p-6 h-[202px] top-[59px] rounded-lg shadow-md text-center w-[400px]">
//             <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
//             <p className="text-gray-600 mb-6">Are you sure you want to delete this item?</p>
//             <div className="flex justify-around">
//               <button
//                 onClick={confirmDelete}
//                 className="px-4 py-2 bg-red-600 text-white rounded-md"
//               >
//                 Confirm
//               </button>
//               <button
//                 onClick={cancelDelete}
//                 className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//       <form onSubmit={handleSubmit} className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
//         <TextInputComponent
//           value={formData.name}
//           onChange={handleInputChange}
//           name={formFields[0].name}
//           label={formFields[0].label}
//           field={formFields[0]}
//           placeholder={formFields[0].label}
//           error={formErrors.name}
//         />
//         <NumberInputComponent
//           type="number"
//           value={formData.age}
//           onChange={handleInputChange}
//           name={formFields[1].name}
//           label={formFields[1].label}
//           field={formFields[1]}
//           placeholder={formFields[1].label}
//           error={formErrors.age}
//         />
//         <div className="col-span-2">
//           <button
//             type="submit"
//             className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
//           >
//             {formData.id ? 'Update' : 'Save'}
//           </button>
//         </div>
//       </form>
//       <table className="min-w-full table-auto border-collapse mb-8">
//         <thead>
//           <tr>
//             <th className="border-b p-2 text-left">Name</th>
//             <th className="border-b p-2 text-left">Age</th>
//             <th className="border-b p-2 text-left">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {loading ? (
//             <tr>
//               <td colSpan="3" className="text-center">Loading...</td>
//             </tr>
//           ) : (
//             data.map((item) => (
//               <tr key={item.id}>
//                 <td className="border-b p-2">{item.name}</td>
//                 <td className="border-b p-2">{item.age}</td>
//                 <td className="border-b p-2">
//                   <button
//                     onClick={() => handleEdit(item)}
//                     className="px-4 py-2 bg-indigo-600 text-white rounded-md mr-2"
//                   >
//                     Edit
//                   </button>
//                   <button
//                     onClick={() => handleDelete(item.id)}
//                     className="px-4 py-2 bg-red-600 text-white rounded-md"
//                   >
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default About;



























































// import React, { useEffect, useState } from 'react';
// import { useSelector, useDispatch } from 'react-redux';
// import { createOrUpdateAbout, deleteAbout, fetchAboutData } from '../../api/aboutApi';
// import { clearMessage } from '../../redux/slices/aboutSlice';
// import MessageBox from '../../Components/MessageBox/MessageBox';

// const About = () => {
//   const dispatch = useDispatch();
//   const { data, loading, error, message } = useSelector((state) => state.about);
//   const [showMessage, setShowMessage] = useState(false);
//   const [deleteId, setDeleteId] = useState(null);
//   const [formData, setFormData] = useState({ name: '', age: '' });


//   useEffect(() => {
//     dispatch(fetchAboutData());
//   }, [dispatch]);

//   useEffect(() => {
//     if (message || error) {
//       setShowMessage(true);
//       setTimeout(() => {
//         setShowMessage(false);
//         dispatch(clearMessage());
//       }, 3000);
//     }
//   }, [message, error, dispatch]);

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     dispatch(createOrUpdateAbout(formData));
//     setFormData({ name: '', age: '' });
//   };

//   const handleEdit = (item) => {
//     setFormData(item);
//   };
//   const handleDelete = (id) => {
//     setDeleteId(id);
//   };
//   const confirmDelete = () => {
//     if (deleteId) {
//       dispatch(deleteAbout(deleteId));
//       setDeleteId(null);
//     }
//   };

//   const cancelDelete = () => {
//     setDeleteId(null);
//   };

//   return (
//     <div className="max-w-6xl mx-auto p-5 mt-12 bg-white shadow-lg rounded-lg">
//       <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">Redux </h1>
//       {showMessage && (
//         <MessageBox
//           message={message}
//           error={error}
//           clearMessage={() => dispatch(clearMessage())}
//         />
//       )}
//       {deleteId && (
//         <div className="fixed inset-0 flex justify-center bg-black bg-opacity-60 z-50">
//           <div className="bg-white p-6 h-[202px] top-[59px] rounded-lg shadow-md text-center w-[400px]">
//             <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
//             <p className="text-gray-600 mb-6">Are you sure you want to delete this item?</p>
//             <div className="flex justify-around">
//               <button
//                 onClick={confirmDelete}
//                 className="px-4 py-2 bg-red-600 text-white rounded-md"
//               >
//                 Confirm
//               </button>
//               <button
//                 onClick={cancelDelete}
//                 className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//       <form onSubmit={handleSubmit} className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
//         <FormField id="name" label="Name" value={formData.name} onChange={handleInputChange} />
//         <FormField id="age" label="Age" type="number" value={formData.age} onChange={handleInputChange} />
//         <div className="col-span-2">
//           <button
//             type="submit"
//             className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
//           >
//             {formData.id ? 'Update' : 'Save'}
//           </button>
//         </div>
//       </form>
//       <table className="min-w-full table-auto border-collapse mb-8">
//         <thead>
//           <tr>
//             <th className="border-b p-2 text-left">Name</th>
//             <th className="border-b p-2 text-left">Age</th>
//             <th className="border-b p-2 text-left">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {loading ? (
//             <tr>
//               <td colSpan="3" className="text-center">Loading...</td>
//             </tr>
//           ) : (
//             data.map((item) => (
//               <tr key={item.id}>
//                 <td className="border-b p-2">{item.name}</td>
//                 <td className="border-b p-2">{item.age}</td>
//                 <td className="border-b p-2">
//                   <button onClick={() => handleEdit(item)} className="px-4 py-2 bg-indigo-600 text-white rounded-md mr-2">
//                     Edit
//                   </button>
//                   <button onClick={() => handleDelete(item.id)} className="px-4 py-2 bg-red-600 text-white rounded-md">
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))
//           )}
//         </tbody>
//       </table>

//     </div>
//   );
// };

// const FormField = ({ id, label, type = 'text', value, onChange }) => (
//   <div>
//     <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
//     <input
//       id={id}
//       name={id}
//       type={type}
//       value={value}
//       onChange={onChange}
//       required
//       className="mt-1 px-4 py-2 border rounded-md w-full"
//     />
//   </div>
// );

// export default About;
