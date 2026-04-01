import React, { useEffect, useState } from "react";
import {
  Formik,
  Form,
  Field
} from "formik";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchMemberById,
  memberUpdate,
  resendLoginCredentials
} from "../../../redux/slices/api/memberApi";
import {
  setMessage,
  setError,
  clearMessage,
  setActiveTabs
} from "../../../redux/slices/memberSlice";
import TextInputComponent from "../../../Components/FormComponent/TextInputComponent";
import SubmitButton from "../../../Components/FormComponent/ButtonComponent/SubmitButton";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";
import PageContainer from "../../../Components/Ui/PageContainer";

// Email and phone regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const phoneRegex = /^(018|019|013|017|015|016|014)\d{8}$/;

const validationSchema = Yup.object().shape({
  method: Yup.string().required("Please select a delivery method"), // Ensure method is selected

  delivery_method: Yup.string()
    .nullable()
    .test("required-field", function (value) {
      const { method } = this.parent;
      if (method === "email" && !value) {
        return this.createError({ message: "Email required" });
      }
      // if (method === "contact" && !value) {
      //   return this.createError({ message: "Contact required" });
      // }
      return true;
    })
    .test("valid-email", function (value) {
      const { method } = this.parent;
      if (method === "email") {
        if (!value) return true; // If empty, required-field test will handle it
        if (!emailRegex.test(value)) {
          return this.createError({ message: "Email Invalid format" });
        }
      }
      return true;
    })
    // .test("valid-contact", function (value) {
    //   const { method } = this.parent;
    //   if (method === "contact") {
    //     if (!value) return true; // If empty, required-field test will handle it
    //     if (!phoneRegex.test(value)) {
    //       return this.createError({ message: "Contact Invalid format" });
    //     }
    //   }
    //   return true;
    // })
});

const LoginCredentialEdit = () => {
  const [showMessage, setShowMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    selectedMember,
    message,
    error,
    activeTabs: previousTab
  } = useSelector((state) => state.member);

  useEffect(() => {
    dispatch(fetchMemberById(id));
  }, [dispatch, id]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const resultAction = await dispatch(
        memberUpdate({ id, formData: values })
      );

      if (memberUpdate.fulfilled.match(resultAction)) {
        dispatch(
          setMessage("Login credentials successfully sent to email")
        );
        setShowMessage(true);
      } else {
        const errorMessage =
          resultAction.payload?.Error ||
          resultAction.error?.message ||
          "Failed to update member.";
        dispatch(setError(errorMessage)); // Set error message in Redux state
        setShowMessage(true); // Show the error message in the MessageBox
      }
    } catch (error) {
      dispatch(setError(error.message || "Something went wrong."));
      setShowMessage(true); // Show the error message in the MessageBox
    } finally {
      setLoading(false);
    }
  };
  const handleBack = () => {
    dispatch(setActiveTabs(previousTab));
    navigate(-1);
  };

  const handleResendCredentials = async () => {
    if (!selectedMember?.member?.id) return;
    setResendLoading(true);
    try {
      const resultAction = await dispatch(
        resendLoginCredentials(selectedMember.member.id)
      );

      if (resendLoginCredentials.fulfilled.match(resultAction)) {
        dispatch(
          setMessage(
            resultAction.payload?.message ||
              "Login credentials email sent successfully."
          )
        );
        setShowMessage(true);
      } else {
        const errorMessage =
          resultAction.payload?.error ||
          resultAction.error?.message ||
          "Failed to resend login credentials.";
        dispatch(setError(errorMessage));
        setShowMessage(true);
      }
    } catch (error) {
      dispatch(setError(error.message || "Something went wrong."));
      setShowMessage(true);
    } finally {
      setResendLoading(false);
    }
  };
  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {showMessage && (
        <MessageBox
          message={message}
          error={error}
          clearMessage={() => dispatch(clearMessage())}
          onOk={() => {
            dispatch(clearMessage());
            setShowMessage(false);
            if (!error) handleBack();
          }}
        />
      )}

      <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Login Credentials" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 max-w-xl w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <Formik
            initialValues={{
              // Set initial values based on `selectedMember`. If no member data, leave it blank.
              delivery_method:
                selectedMember?.member?.login_email ||
                // selectedMember?.member?.login_contact ||
                "",
              method: selectedMember?.member?.login_email
                ? "email"
                // : selectedMember?.member?.login_contact
                // ? "contact"
                : "" // Default to empty if no email/contact
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({
              errors,
              touched,
              handleChange,
              values,
              setFieldValue,
              validateField,
              isValid,
              dirty,
              setTouched,
              handleBlur
            }) => (
              <Form className="relative">
              {loading && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                  <ModernLoadingAnimation />
                </div>
              )}

              {/* Radio buttons for Email or Contact Selection */}
              <p className="font-medium text-bold text-primary my-3">
                Login Credential
              </p>

              <div className="flex items-center space-x-6 bg-white">
                <label className="flex items-center space-x-2">
                  <Field
                    type="radio"
                    name="method"
                    value="email"
                    checked={values.method === "email"}
                    onChange={() => {
                      setFieldValue("method", "email");
                      setFieldValue(
                        "delivery_method",
                        selectedMember?.member?.login_email || ""
                      );
                      validateField("delivery_method");
                      setTouched({}); // Clear touched on method change
                    }}
                    className="cursor-pointer w-[15px] h-[15px] accent-[#3C9D9B]"
                    disabled={loading || error || !selectedMember?.member} // Disable if no selected member
                  />
                  <span>Email</span>
                </label>
                {/* <label className="flex items-center space-x-2">
                  <Field
                    type="radio"
                    name="method"
                    value="contact"
                    checked={values.method === "contact"}
                    onChange={() => {
                      setFieldValue("method", "contact");
                      setFieldValue(
                        "delivery_method",
                        selectedMember?.member?.login_contact || ""
                      );
                      validateField("delivery_method");
                      setTouched({}); // Clear touched on method change
                    }}
                    className="cursor-pointer w-[15px] h-[15px] accent-[#3C9D9B]"
                    disabled={loading || error || !selectedMember?.member} // Disable if no selected member
                  />
                  <span>Phone Number</span>
                </label> */}
              </div>

              {/* Delivery Method Input Field */}
              <div className="login-field">
                {/* <div className="pb-3">
                  <p
                    className="text-base text-left font-medium "
                    htmlFor="Email"
                  >
                    Choose login method
                  </p>
                </div> */}
                <input
                  id="delivery_method"
                  name="delivery_method"
                  type="text"
                  value={values.delivery_method}
                  className="login-field-input"
                  // placeholder="Enter Email or Contact Number"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={
                    loading ||
                    error ||
                    !selectedMember?.member ||
                    !values.method
                  } // Disable input based on conditions
                />
              </div>
              <p className="text-base italic py-3 text-[#7A7A7A]">
                Login instructions will be sent to this email/phone number
              </p>
              {/* Error Message for Email or Contact */}
              {errors.delivery_method && touched.delivery_method && (
                <ErrorMessage message={errors.delivery_method} />
              )}

              <SubmitButton
                text="Update"
                width="full"
                disabled={loading || resendLoading || !dirty || error}
              />

              <button
                type="button"
                onClick={handleResendCredentials}
                disabled={
                  resendLoading ||
                  loading ||
                  error ||
                  !selectedMember?.member?.login_email ||
                  !selectedMember?.member?.is_first_login
                }
                className="mt-2 w-full rounded border border-primary px-4 py-2 font-semibold text-primary transition-all duration-200 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resendLoading ? "Resending..." : "Resend Login Credentials"}
              </button>
            </Form>
          )}
        </Formik>
        </section>
      </div>
    </PageContainer>
  );
};

export default LoginCredentialEdit;
